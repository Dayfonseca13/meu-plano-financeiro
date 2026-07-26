import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, Bot, User, Trash2, ArrowRight, Loader2, 
  WifiOff, AlertCircle, CheckCircle2, TrendingUp, HelpCircle 
} from 'lucide-react';
import type { Category, Income, Expense, Goal, AiMessage } from '../types/finance.ts';

interface AiAssistantProps {
  token: string;
  categories: Category[];
  goals: Goal[];
  isOnline: boolean;
  onAddExpense: (exp: any) => Promise<void>;
  onAddIncome: (inc: any) => Promise<void>;
  onUpdateCategory: (id: string, updates: any) => Promise<void>;
  onCreateGoalContribution: (id: string, contrib: any) => Promise<void>;
}

export default function AiAssistant({
  token,
  categories,
  goals,
  isOnline,
  onAddExpense,
  onAddIncome,
  onUpdateCategory,
  onCreateGoalContribution
}: AiAssistantProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Pre-made prompts list
  const suggestedPrompts = [
    'Onde estou gastando mais?',
    'Quanto ainda posso gastar com alimentação?',
    'Qual categoria está próxima do limite?',
    'Se eu reduzir o lazer em R$ 200, quanto terei em seis meses?',
    'O que vence esta semana?'
  ];

  // Initialize conversation ID
  useEffect(() => {
    const initConversation = async () => {
      try {
        const res = await fetch('/api/ai/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title: 'Conversa Financeira' })
        });
        const data = await res.json();
        setConversationId(data.id);
        
        // Add greeting message
        setMessages([
          {
            id: 'greet',
            papel: 'assistant',
            conteudo: 'Olá! Sou seu Assistente Financeiro 🧠. Como posso ajudar você a otimizar seu orçamento hoje? Posso responder perguntas sobre seus gastos atuais ou até sugerir transações para você confirmar!',
            criadoEm: new Date().toISOString()
          }
        ]);
      } catch (err) {
        console.error("Conversation creation failed:", err);
      }
    };
    
    if (token) {
      initConversation();
    }
  }, [token]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;
    if (!isOnline) return;

    const userMsg = {
      id: `usr_${Date.now()}`,
      papel: 'user' as const,
      conteudo: textToSend,
      criadoEm: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({ papel: m.papel, conteudo: m.conteudo }));
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: textToSend,
          conversationId,
          history
        })
      });

      if (!res.ok) throw new Error("Falha ao consultar IA.");
      const data = await res.json();
      setMessages(prev => [...prev, data]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        papel: 'assistant',
        conteudo: 'Perdão, estou tendo problemas para conectar com o servidor no momento. Verifique sua conexão e vamos tentar novamente!'
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Parsing helper to find structured action cues inside AI responses:
  // e.g., [ACTION: {"type": "create_expense", "data": {...}}]
  const parseActionBlock = (text: string) => {
    const actionRegex = /\[ACTION:\s*({.*?})\]/s;
    const match = text.match(actionRegex);
    if (match) {
      try {
        const cleanJson = match[1];
        const actionObj = JSON.parse(cleanJson);
        const textWithoutAction = text.replace(actionRegex, '').trim();
        return { actionObj, textWithoutAction };
      } catch (e) {
        console.error("Failed to parse action json:", e);
      }
    }
    return null;
  };

  const handleExecuteAction = async (action: any, msgId: string) => {
    setActionLoadingId(msgId);
    try {
      if (action.type === 'create_expense') {
        const cat = categories.find(c => c.nome.toLowerCase() === action.data.categoriaNome.toLowerCase());
        await onAddExpense({
          descricao: action.data.descricao,
          valor: action.data.valor,
          categoriaId: cat?.id || categories[0]?.id,
          dataCompra: new Date().toISOString().split('T')[0],
          dataVencimento: new Date().toISOString().split('T')[0],
          status: 'paga',
          formaPagamento: 'PIX',
          recorrencia: 'unica'
        });
        alert(`Despesa de "${action.data.descricao}" criada com sucesso!`);
      } else if (action.type === 'create_income') {
        const cat = categories.find(c => c.nome.toLowerCase() === action.data.categoriaNome.toLowerCase());
        await onAddIncome({
          descricao: action.data.descricao,
          valor: action.data.valor,
          categoriaId: cat?.id || categories[0]?.id,
          dataPrevista: new Date().toISOString().split('T')[0],
          status: 'recebida',
          recorrencia: 'unica'
        });
        alert(`Receita de "${action.data.descricao}" criada com sucesso!`);
      } else if (action.type === 'set_category_limit') {
        const cat = categories.find(c => c.nome.toLowerCase() === action.data.categoriaNome.toLowerCase());
        if (cat) {
          await onUpdateCategory(cat.id, { limiteMensal: action.data.limiteMensal });
          alert(`Limite de "${cat.nome}" alterado para R$ ${action.data.limiteMensal}!`);
        }
      } else if (action.type === 'goal_contribution') {
        const goal = goals.find(g => g.nome.toLowerCase() === action.data.metaNome.toLowerCase());
        if (goal) {
          await onCreateGoalContribution(goal.id, {
            valor: action.data.valor,
            origem: 'Reserva Mensal',
            data: new Date().toISOString().split('T')[0]
          });
          alert(`Depósito de R$ ${action.data.valor} na meta "${goal.nome}" efetuado!`);
        }
      }

      // Filter out this action card locally so it can only be run once
      setMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          return { ...m, actionExecuted: true };
        }
        return m;
      }));
    } catch (err: any) {
      alert("Erro ao executar ação recomendada pela IA: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col justify-between" id="ai-chat-view">
      {/* OFFLINE STATUS BANNER */}
      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-500/25 p-3 rounded-2xl flex items-start gap-2.5 mb-4 animate-fade-in" id="ai-offline-banner">
          <WifiOff size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-300">
            <span className="font-bold text-amber-400">Você está offline.</span> O Assistente Financeiro precisa de conexão com a internet. Seus demais registros podem continuar sendo feitos normalmente e serão sincronizados depois.
          </div>
        </div>
      )}

      {/* CHAT MESSAGES LOG */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin" id="ai-messages-list">
        {messages.map((m) => {
          const isUser = m.papel === 'user';
          const actionDetails = !isUser ? parseActionBlock(m.conteudo) : null;
          const displayContent = actionDetails ? actionDetails.textWithoutAction : m.conteudo;

          return (
            <div key={m.id} className={`flex gap-3 max-w-xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
              <div className={`p-2.5 rounded-xl shrink-0 ${isUser ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-900 border border-slate-800 text-slate-300'}`}>
                {isUser ? <User size={15} /> : <Bot size={15} />}
              </div>
              
              <div className="space-y-3">
                <div className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-md ${isUser ? 'bg-teal-500 text-slate-950 font-semibold' : 'bg-slate-900/60 border border-slate-800 text-slate-100'}`}>
                  {displayContent}
                </div>

                {/* DYNAMIC CONFIRMATION CARD FOR ACTION TRIPS */}
                {actionDetails && !m.actionExecuted && (
                  <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-4 space-y-3 animate-fade-in">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                      <Sparkles size={12} /> Ação Recomendada
                    </span>
                    <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
                      {actionDetails.actionObj.type === 'create_expense' && (
                        <span>Cadastrar Despesa: <strong>{actionDetails.actionObj.data.descricao}</strong> de R$ {actionDetails.actionObj.data.valor}</span>
                      )}
                      {actionDetails.actionObj.type === 'create_income' && (
                        <span>Cadastrar Receita: <strong>{actionDetails.actionObj.data.descricao}</strong> de R$ {actionDetails.actionObj.data.valor}</span>
                      )}
                      {actionDetails.actionObj.type === 'set_category_limit' && (
                        <span>Limitar categoria <strong>{actionDetails.actionObj.data.categoriaNome}</strong> em R$ {actionDetails.actionObj.data.limiteMensal}</span>
                      )}
                      {actionDetails.actionObj.type === 'goal_contribution' && (
                        <span>Adicionar R$ {actionDetails.actionObj.data.valor} para a meta <strong>{actionDetails.actionObj.data.metaNome}</strong></span>
                      )}
                    </div>
                    <button 
                      onClick={() => handleExecuteAction(actionDetails.actionObj, m.id)}
                      disabled={actionLoadingId === m.id}
                      className="w-full py-2 bg-gradient-to-r from-purple-500 to-indigo-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-purple-500/10"
                    >
                      {actionLoadingId === m.id ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-white" />
                          <span>Executando... Aguarde um instante</span>
                        </>
                      ) : (
                        <span>Sim, Confirmar e Salvar!</span>
                      )}
                    </button>
                  </div>
                )}

                {/* IF ACTION CARD ALREADY CONFIRMED */}
                {m.actionExecuted && (
                  <div className="bg-slate-900/40 border border-slate-800 text-slate-400 text-[11px] p-2 rounded-xl flex items-center gap-1.5 font-medium">
                    <CheckCircle2 size={13} className="text-teal-400" />
                    <span>Ação de IA já executada com sucesso.</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 max-w-sm animate-pulse">
            <div className="p-2.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl shrink-0">
              <Bot size={15} />
            </div>
            <div className="p-3.5 bg-slate-900/60 border border-teal-500/30 rounded-2xl text-xs text-teal-300 flex items-center gap-2.5 shadow-md">
              <Loader2 size={16} className="animate-spin text-teal-400 shrink-0" />
              <div>
                <p className="font-bold">Analisando dados...</p>
                <p className="text-[10px] text-slate-400">Aguarde um instante enquanto o assistente processa sua resposta.</p>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef}></div>
      </div>

      {/* QUICK SUGGESTIONS CAROUSEL */}
      {messages.length === 1 && (
        <div className="py-3 flex gap-2 overflow-x-auto no-scrollbar scroll-smooth" id="suggested-prompts-row">
          {suggestedPrompts.map((p, idx) => (
            <button 
              key={idx}
              onClick={() => handleSendMessage(p)}
              disabled={!isOnline}
              className="shrink-0 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-300 transition"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* CHAT INPUT FORM PANEL */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSendMessage(input); }} 
        className="flex gap-2.5 bg-slate-900 p-2 border border-slate-800 rounded-2xl items-center shadow-lg"
        id="ai-input-form"
      >
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isOnline ? "Fale com seu Assistente de Finanças..." : "Assistente offline..."}
          disabled={!isOnline || loading}
          className="flex-1 bg-transparent px-3 py-2 border-0 outline-none focus:ring-0 text-slate-200 text-xs"
          id="ai-chat-input"
        />
        <button 
          type="submit" 
          disabled={!isOnline || loading || !input.trim()}
          className="p-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 rounded-xl transition duration-200"
          id="btn-ai-send"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
