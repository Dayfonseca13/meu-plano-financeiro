import { Income, Expense, Category, Goal } from '../types/finance.ts';

// Groq API Details
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_API_KEY = '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';

function getApiKey(): string {
  // Use environment variable first, then fallback to user-provided key as requested
  const key = process.env.GROQ_API_KEY;
  if (!key || key === 'MY_GEMINI_API_KEY' || key.includes('MY_')) {
    return DEFAULT_API_KEY;
  }
  return key;
}

// System instructions for the financial assistant
const SYSTEM_CHAT_PROMPT = `Você é o "Assistente Financeiro", um consultor de finanças pessoal integrado ao aplicativo "Meu Plano Financeiro".
Seu tom de voz deve ser acolhedor, profissional, didático e empático. Evite termos técnicos desnecessários e use explicações práticas sempre que possível (por exemplo: "Você já utilizou 75% do limite de alimentação").

Instruções fundamentais:
1. Você deve basear todas as suas respostas EXCLUSIVAMENTE nos dados financeiros reais que foram fornecidos a você no contexto abaixo.
2. Seja transparente: se o usuário perguntar algo que não consta em seu histórico, explique de forma simpática.
3. Não recomende investimentos específicos ou prometa lucros garantidos. Foco na organização, economia e planejamento.
4. Se o usuário quiser criar ou alterar algum registro (ex: adicionar despesa, alterar limite, contribuir para meta), você deve sugerir a ação anexando um bloco JSON especial de ação no FINAL de sua resposta. O aplicativo identificará esse bloco e mostrará um card de confirmação para o usuário clicar e autorizar.

Formatos de Ação suportados (adicione exatamente no final da resposta se aplicável):
Para criar despesa:
[ACTION: {"type": "create_expense", "data": {"descricao": "Exemplo", "valor": 120.50, "categoriaNome": "Alimentação"}}]

Para criar receita:
[ACTION: {"type": "create_income", "data": {"descricao": "Exemplo", "valor": 500, "categoriaNome": "Renda Extra"}}]

Para alterar limite de categoria:
[ACTION: {"type": "set_category_limit", "data": {"categoriaNome": "Alimentação", "limiteMensal": 800}}]

Para contribuir para meta:
[ACTION: {"type": "goal_contribution", "data": {"metaNome": "Reserva de Emergência", "valor": 200}}]

Sempre confirme os valores e detalhes antes de sugerir a ação. Exemplo: "Identifiquei que você deseja cadastrar uma despesa de R$ 50 em alimentação. Deseja confirmar?" seguido do bloco de ação correspondente.`;

interface ChatContext {
  incomes: Income[];
  expenses: Expense[];
  categories: Category[];
  goals: Goal[];
  userName: string;
}

export const groqService = {
  async chat(
    message: string,
    history: { papel: 'user' | 'assistant'; conteudo: string }[],
    context: ChatContext
  ): Promise<string> {
    const apiKey = getApiKey();
    
    // Structure context data briefly for the prompt
    const contextBrief = `
Nome do Usuário: ${context.userName}
Categorias cadastradas: ${context.categories.map(c => `${c.nome} (tipo: ${c.tipo}, limite: R$ ${c.limiteMensal || 'não definido'})`).join(', ')}
Receitas Recentes: ${context.incomes.slice(-5).map(i => `${i.descricao}: R$ ${i.valor} em ${i.dataPrevista} (Status: ${i.status})`).join(', ')}
Despesas Recentes: ${context.expenses.slice(-10).map(e => `${e.descricao}: R$ ${e.valor} em ${e.dataCompra} (Status: ${e.status}, categoria: ${context.categories.find(c => c.id === e.categoriaId)?.nome || 'Outros'})`).join(', ')}
Metas Financeiras: ${context.goals.map(g => `${g.nome}: R$ ${g.valorAcumulado} de R$ ${g.valorDesejado} (Status: ${g.status})`).join(', ')}
    `;

    const messages = [
      { role: 'system', content: `${SYSTEM_CHAT_PROMPT}\n\nCONTEXTO FINANCEIRO ATUAL DO USUÁRIO:\n${contextBrief}` },
      ...history.map(h => ({ role: h.papel === 'user' ? 'user' : 'assistant', content: h.conteudo })),
      { role: 'user', content: message }
    ];

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.3,
          max_tokens: 1200
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API Error: ${response.status} - ${errText}`);
      }

      const resJson = await response.json();
      return resJson.choices[0]?.message?.content || 'Desculpe, não consegui obter uma resposta.';
    } catch (error) {
      console.error("AI Assistant service failure:", error);
      return 'O Assistente Financeiro está temporariamente indisponível. Verifique sua conexão e tente novamente em instantes.';
    }
  },

  async interpretPlanning(
    planningText: string,
    categories: Category[]
  ): Promise<{
    rendaPlanejada: number;
    reservaPlanejada: number;
    margemImprevistos: number;
    items: { categoriaNome: string; valorPlanejado: number; prioridade: 'baixa' | 'media' | 'alta' }[];
    explicacao: string;
  }> {
    const apiKey = getApiKey();

    const systemPrompt = `Você é um robô de planejamento financeiro integrado. Sua tarefa é ler a descrição em linguagem natural de como um usuário recebe e deseja planejar seu dinheiro, estruturar isso em um JSON de planejamento financeiro, e retornar APENAS o JSON válido.

Categorias de despesa disponíveis no sistema do usuário:
${categories.filter(c => c.tipo === 'despesa').map(c => `- ${c.nome}`).join('\n')}

O seu retorno deve ser exclusivamente um objeto JSON com as seguintes chaves (sem blocos markdown de código, sem textos adicionais, apenas o JSON bruto):
{
  "rendaPlanejada": number (renda mensal total estimada),
  "reservaPlanejada": number (valor destinado a poupar/investir),
  "margemImprevistos": number (margem reservada para emergências/imprevistos),
  "items": [
    {
      "categoriaNome": "Nome exato de uma das categorias acima",
      "valorPlanejado": number,
      "prioridade": "baixa" | "media" | "alta"
    }
  ],
  "explicacao": "Uma justificativa curta e amigável da sugestão estruturada baseada no texto do usuário"
}

A soma de reservaPlanejada + margemImprevistos + a soma de todos os valorPlanejado dos items não deve ultrapassar a rendaPlanejada. Se ultrapassar, ajuste os valores das categorias ou aponte de forma compreensiva na explicação. Faça com que o plano seja matematicamente sustentável!`;

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Aqui está meu planejamento em texto livre: "${planningText}"` }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API Error: ${response.status}`);
      }

      const resJson = await response.json();
      const rawContent = resJson.choices[0]?.message?.content?.trim() || '{}';
      
      return JSON.parse(rawContent);
    } catch (error) {
      console.error("AI Planning interpreter failure:", error);
      // Return a basic mathematical structure if AI fails
      return {
        rendaPlanejada: 3000,
        reservaPlanejada: 300,
        margemImprevistos: 100,
        items: [
          { categoriaNome: 'Alimentação', valorPlanejado: 800, prioridade: 'alta' },
          { categoriaNome: 'Moradia', valorPlanejado: 1000, prioridade: 'alta' },
          { categoriaNome: 'Transporte', valorPlanejado: 400, prioridade: 'media' },
          { categoriaNome: 'Lazer', valorPlanejado: 200, prioridade: 'baixa' }
        ],
        explicacao: 'Peço desculpas, tivemos um problema ao chamar a inteligência artificial para estruturar seu plano. Sugerimos esta divisão inicial padrão baseada em uma média de consumo.'
      };
    }
  }
};
