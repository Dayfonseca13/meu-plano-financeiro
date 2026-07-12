import { useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Heart, DollarSign, Target, CheckCircle2, Loader2, Landmark } from 'lucide-react';
import { Category } from '../types/finance.ts';

interface OnboardingProps {
  categories: Category[];
  token: string;
  onComplete: (onboardingData: {
    rendaMensal: number;
    rendaVariavel: boolean;
    diaRecebimento: number;
    objetivos: string[];
    despesasFixas: { descricao: string; valor: number; categoriaNome: string }[];
    budget?: {
      rendaPlanejada: number;
      reservaPlanejada: number;
      margemImprevistos: number;
      items: { categoriaNome: string; valorPlanejado: number; prioridade: 'baixa' | 'media' | 'alta' }[];
    };
  }) => void;
}

export default function Onboarding({ categories, token, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [rendaMensal, setRendaMensal] = useState<number>(3500);
  const [rendaVariavel, setRendaVariavel] = useState(false);
  const [diaRecebimento, setDiaRecebimento] = useState(5);
  
  // Fixed expenses list builder
  const [despesasFixas, setDespesasFixas] = useState<{ descricao: string; valor: number; categoriaNome: string }[]>([
    { descricao: 'Aluguel / Prestação', valor: 0, categoriaNome: 'Moradia' },
    { descricao: 'Energia / Água', valor: 0, categoriaNome: 'Moradia' },
    { descricao: 'Internet / Telefone', valor: 0, categoriaNome: 'Moradia' },
    { descricao: 'Assinaturas (Netflix, etc.)', valor: 0, categoriaNome: 'Assinaturas' }
  ]);

  const [newExpDesc, setNewExpDesc] = useState('');
  const [newExpVal, setNewExpVal] = useState('');
  const [newExpCat, setNewExpCat] = useState('Moradia');

  // Goals
  const [objetivos, setObjetivos] = useState<string[]>([]);
  const objetivosDisponiveis = [
    { id: 'dividas', label: 'Sair das dívidas' },
    { id: 'reserva', label: 'Formar reserva de emergência' },
    { id: 'controle', label: 'Controlar gastos supérfluos' },
    { id: 'guardar', label: 'Poupar dinheiro' },
    { id: 'veiculo', label: 'Comprar um veículo' },
    { id: 'viagem', label: 'Viajar' },
    { id: 'reforma', label: 'Reformar a casa' },
    { id: 'familia', label: 'Organizar despesas familiares' }
  ];

  // Natural Language Planning
  const [planningText, setPlanningText] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiProposal, setAiProposal] = useState<any | null>(null);

  const toggleObjetivo = (id: string) => {
    if (objetivos.includes(id)) {
      setObjetivos(objetivos.filter(o => o !== id));
    } else {
      setObjetivos([...objetivos, id]);
    }
  };

  const handleAddFixedExpense = () => {
    if (!newExpDesc || !newExpVal) return;
    setDespesasFixas([
      ...despesasFixas,
      { descricao: newExpDesc, valor: Number(newExpVal), categoriaNome: newExpCat }
    ]);
    setNewExpDesc('');
    setNewExpVal('');
  };

  const handleRemoveFixedExpense = (index: number) => {
    setDespesasFixas(despesasFixas.filter((_, i) => i !== index));
  };

  const handleCallPlanningAi = async () => {
    if (!planningText.trim()) return;
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai/planning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: planningText })
      });

      if (!res.ok) throw new Error("Erro na API de Inteligência Artificial");
      const data = await res.json();
      setAiProposal(data);
    } catch (error) {
      console.error(error);
      // Construct a safe default proposal based on raw income
      setAiProposal({
        rendaPlanejada: rendaMensal,
        reservaPlanejada: Math.round(rendaMensal * 0.15),
        margemImprevistos: Math.round(rendaMensal * 0.05),
        items: [
          { categoriaNome: 'Alimentação', valorPlanejado: Math.round(rendaMensal * 0.25), prioridade: 'alta' },
          { categoriaNome: 'Moradia', valorPlanejado: Math.round(rendaMensal * 0.35), prioridade: 'alta' },
          { categoriaNome: 'Transporte', valorPlanejado: Math.round(rendaMensal * 0.10), prioridade: 'media' },
          { categoriaNome: 'Lazer', valorPlanejado: Math.round(rendaMensal * 0.10), prioridade: 'baixa' }
        ],
        explicacao: 'Configuramos um planejamento inicial equilibrado com 15% para reserva de emergência e despesas essenciais estruturadas.'
      });
    } finally {
      setLoadingAi(false);
    }
  };

  const handleEditProposalItem = (index: number, val: number) => {
    if (!aiProposal) return;
    const newItems = [...aiProposal.items];
    newItems[index].valorPlanejado = Number(val);
    setAiProposal({ ...aiProposal, items: newItems });
  };

  const handleFinish = () => {
    // Collect and format all data to save
    const filteredFixed = despesasFixas.filter(d => d.valor > 0);
    onComplete({
      rendaMensal,
      rendaVariavel,
      diaRecebimento,
      objetivos,
      despesasFixas: filteredFixed,
      budget: aiProposal ? {
        rendaPlanejada: Number(aiProposal.rendaPlanejada),
        reservaPlanejada: Number(aiProposal.reservaPlanejada),
        margemImprevistos: Number(aiProposal.margemImprevistos),
        items: aiProposal.items
      } : undefined
    });
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col items-center justify-center p-4" id="onboarding-container">
      <div className="max-w-xl w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md" id="onboarding-card">
        {/* PROGRESS INDICATOR */}
        <div className="flex justify-between items-center mb-6">
          <span className="text-xs font-semibold text-teal-400">Etapa {step} de 5</span>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(i => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'w-6 bg-teal-400' : 'w-2 bg-slate-800'}`}
              ></div>
            ))}
          </div>
        </div>

        {/* STEP 1: WELCOME */}
        {step === 1 && (
          <div className="space-y-6 text-center animate-fade-in" id="step-1">
            <div className="p-4 bg-teal-500/10 text-teal-400 rounded-3xl w-fit mx-auto border border-teal-500/20">
              <Sparkles size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">Boas-vindas ao seu Novo Começo!</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Parabéns por dar este passo para transformar sua relação com o dinheiro. O <strong>Meu Plano Financeiro</strong> vai ajudar você a gerenciar seus gastos, conquistar objetivos de vida e obter conselhos com inteligência artificial.
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-2xl text-xs text-left text-slate-400 border border-slate-800 flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
              <span>Leva menos de 3 minutos para configurar seu planejamento financeiro inicial de teste. Vamos lá?</span>
            </div>
            <button 
              onClick={() => setStep(2)}
              className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 transition duration-200"
              id="onboarding-start-btn"
            >
              Começar Configuração
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* STEP 2: INCOME */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in" id="step-2">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white tracking-tight">Qual é a sua renda habitual?</h3>
              <p className="text-xs text-slate-400">Insira sua renda estimada para basearmos seus limites mensais.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Renda Mensal Estimada (R$)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 text-sm font-medium">R$</span>
                  <input 
                    type="number" 
                    value={rendaMensal}
                    onChange={(e) => setRendaMensal(Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl focus:border-teal-500 text-white font-bold outline-none"
                    placeholder="0,00"
                    id="input-onboarding-income"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-800">
                <span className="text-xs font-semibold text-slate-200">Possui renda variável / freelance?</span>
                <input 
                  type="checkbox"
                  checked={rendaVariavel}
                  onChange={(e) => setRendaVariavel(e.target.checked)}
                  className="accent-teal-500 w-4 h-4"
                  id="chk-onboarding-variable"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Dia habitual de recebimento</label>
                <select 
                  value={diaRecebimento}
                  onChange={(e) => setDiaRecebimento(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-white outline-none focus:border-teal-500"
                  id="select-onboarding-day"
                >
                  {[1, 2, 3, 4, 5, 10, 15, 20, 25, 28, 30].map(day => (
                    <option key={day} value={day}>Dia {day}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setStep(1)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl flex items-center justify-center gap-1 transition"
                id="btn-back-step-2"
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <button 
                onClick={() => setStep(3)}
                className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1 transition"
                id="btn-next-step-2"
              >
                Avançar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: FIXED EXPENSES */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-in" id="step-3">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white tracking-tight">Suas despesas fixas recorrentes</h3>
              <p className="text-xs text-slate-400 font-medium">Informe os gastos básicos recorrentes que você precisa pagar todos os meses.</p>
            </div>

            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {despesasFixas.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/80 gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-slate-400 block">{item.categoriaNome}</span>
                    <span className="text-xs font-semibold text-slate-200 truncate block">{item.descricao}</span>
                  </div>
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1 text-[11px] text-slate-400">R$</span>
                    <input 
                      type="number"
                      value={item.valor === 0 ? '' : item.valor}
                      onChange={(e) => {
                        const newExps = [...despesasFixas];
                        newExps[idx].valor = Number(e.target.value);
                        setDespesasFixas(newExps);
                      }}
                      className="w-full pl-8 pr-2 py-1 bg-slate-900 border border-slate-800 rounded focus:border-teal-500 text-right text-xs font-semibold text-white outline-none"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Expense Adder */}
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 block">Adicionar outra despesa fixa</span>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="text"
                  placeholder="Nome (ex: Faculdade)"
                  value={newExpDesc}
                  onChange={(e) => setNewExpDesc(e.target.value)}
                  className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                />
                <input 
                  type="number"
                  placeholder="Valor (R$)"
                  value={newExpVal}
                  onChange={(e) => setNewExpVal(e.target.value)}
                  className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <button 
                onClick={handleAddFixedExpense}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-200"
              >
                + Adicionar Gasto Fixo
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setStep(2)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl flex items-center justify-center gap-1 transition"
                id="btn-back-step-3"
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <button 
                onClick={() => setStep(4)}
                className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1 transition"
                id="btn-next-step-3"
              >
                Avançar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: GOALS */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in" id="step-4">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white tracking-tight">Seus objetivos financeiros</h3>
              <p className="text-xs text-slate-400">Selecione uma ou mais metas para criarmos no sistema.</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {objetivosDisponiveis.map(obj => {
                const active = objetivos.includes(obj.id);
                return (
                  <button
                    key={obj.id}
                    onClick={() => toggleObjetivo(obj.id)}
                    className={`p-3 text-left rounded-xl text-xs font-semibold border transition duration-200 ${active ? 'bg-teal-500/10 border-teal-500 text-teal-300' : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/20'}`}
                  >
                    {obj.label}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setStep(3)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl flex items-center justify-center gap-1 transition"
                id="btn-back-step-4"
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <button 
                onClick={() => setStep(5)}
                className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1 transition"
                id="btn-next-step-4"
              >
                Avançar <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: AI PLANNING */}
        {step === 5 && (
          <div className="space-y-5 animate-fade-in" id="step-5">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <Sparkles size={20} className="text-purple-400" />
                Planejamento Inteligente
              </h3>
              <p className="text-xs text-slate-400">
                Escreva livremente como recebe e como deseja utilizar seu dinheiro. A IA estruturará um orçamento personalizado para você revisar.
              </p>
            </div>

            {!aiProposal ? (
              <div className="space-y-4">
                <textarea 
                  value={planningText}
                  onChange={(e) => setPlanningText(e.target.value)}
                  placeholder={`Exemplo: "Eu ganho R$ ${rendaMensal}. Quero reservar R$ 500 para poupar, pagar minhas contas fixas e limitar alimentação em R$ 700."`}
                  className="w-full h-32 p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 text-xs outline-none focus:border-teal-500 resize-none leading-relaxed"
                  id="onboarding-ai-textarea"
                />
                
                <div className="flex items-center gap-2.5 p-3 bg-purple-500/10 text-purple-300 text-xs rounded-xl border border-purple-500/20">
                  <Sparkles size={16} className="shrink-0" />
                  <span>Nossa Inteligência Artificial lerá seu texto, separará as categorias, calculará os percentuais e sugerirá um limite para cada uma delas.</span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setStep(4)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition"
                    id="btn-back-step-5"
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={handleCallPlanningAi}
                    disabled={loadingAi || !planningText.trim()}
                    className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg"
                    id="btn-run-planning-ai"
                  >
                    {loadingAi ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Interpretando...
                      </>
                    ) : (
                      <>
                        Planejar com IA
                        <Sparkles size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              // AI PROPOSAL REVIEW
              <div className="space-y-4">
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider">Proposta de Orçamento</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-slate-900 border border-slate-800/80 rounded-xl">
                      <span className="text-[9px] text-slate-400 block">Renda</span>
                      <span className="text-xs font-bold text-white">R$ {aiProposal.rendaPlanejada}</span>
                    </div>
                    <div className="p-2 bg-slate-900 border border-slate-800/80 rounded-xl">
                      <span className="text-[9px] text-slate-400 block">Reserva</span>
                      <span className="text-xs font-bold text-emerald-400">R$ {aiProposal.reservaPlanejada}</span>
                    </div>
                    <div className="p-2 bg-slate-900 border border-slate-800/80 rounded-xl">
                      <span className="text-[9px] text-slate-400 block">Imprevistos</span>
                      <span className="text-xs font-bold text-amber-400">R$ {aiProposal.margemImprevistos}</span>
                    </div>
                  </div>
                  
                  {/* Proposal Explanation */}
                  <p className="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/40 italic">
                    "{aiProposal.explicacao}"
                  </p>
                </div>

                {/* Proposal Items List */}
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {aiProposal.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-950/60 rounded-xl border border-slate-800/60 gap-3">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-slate-200 block truncate">{item.categoriaNome}</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded-md font-medium capitalize">
                          Prioridade: {item.prioridade}
                        </span>
                      </div>
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1 text-[10px] text-slate-400">R$</span>
                        <input 
                          type="number"
                          value={item.valorPlanejado}
                          onChange={(e) => handleEditProposalItem(idx, Number(e.target.value))}
                          className="w-full pl-8 pr-2 py-1 bg-slate-900 border border-slate-800 rounded text-right text-xs font-bold text-white outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button 
                    onClick={() => setAiProposal(null)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
                  >
                    Nova Descrição
                  </button>
                  <button 
                    onClick={handleFinish}
                    className="flex-1 py-3 bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-teal-500/10"
                    id="btn-complete-onboarding"
                  >
                    <CheckCircle2 size={16} />
                    Confirmar e Salvar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
