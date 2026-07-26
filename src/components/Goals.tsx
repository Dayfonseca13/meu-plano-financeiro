import React, { useState } from 'react';
import { 
  PiggyBank, Calendar, Trophy, ChevronRight, Plus, Save, 
  Trash2, TrendingUp, CheckCircle, Clock, Sparkles, PlusCircle, Loader2 
} from 'lucide-react';
import type { Goal, GoalContribution } from '../types/finance.ts';

interface GoalsProps {
  goals: Goal[];
  token: string;
  onCreateGoal: (goal: any) => Promise<void>;
  onUpdateGoal: (id: string, updates: any) => Promise<void>;
  onDeleteGoal: (id: string) => Promise<void>;
  onCreateGoalContribution: (id: string, contrib: any) => Promise<void>;
}

export default function Goals({
  goals,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onCreateGoalContribution
}: GoalsProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedGoalForContrib, setSelectedGoalForContrib] = useState<Goal | null>(null);
  const [isCreatingGoal, setIsCreatingGoal] = useState(false);
  const [isAddingContrib, setIsAddingContrib] = useState(false);

  // Form Fields
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valorDesejado, setValorDesejado] = useState('');
  const [valorAcumulado, setValorAcumulado] = useState('0');
  const [dataInicial, setDataInicial] = useState(new Date().toISOString().split('T')[0]);
  const [dataPretendida, setDataPretendida] = useState(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [contribuicaoMensalPlanejada, setContribuicaoMensalPlanejada] = useState('');
  const [prioridade, setPrioridade] = useState<'baixa' | 'media' | 'alta'>('media');

  // Contribution Form Field
  const [contribVal, setContribVal] = useState('');
  const [contribSource, setContribSource] = useState('Reserva Mensal');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !valorDesejado) {
      alert("Por favor, informe o nome e o valor desejado da meta.");
      return;
    }

    setIsCreatingGoal(true);
    try {
      await onCreateGoal({
        nome,
        descricao,
        valorDesejado: Number(valorDesejado),
        valorAcumulado: Number(valorAcumulado),
        dataInicial,
        dataPretendida,
        contribuicaoMensalPlanejada: contribuicaoMensalPlanejada ? Number(contribuicaoMensalPlanejada) : 100,
        prioridade,
        status: 'em_andamento'
      });
      setNome('');
      setDescricao('');
      setValorDesejado('');
      setValorAcumulado('0');
      setShowAddForm(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsCreatingGoal(false);
    }
  };

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalForContrib || !contribVal) return;

    setIsAddingContrib(true);
    try {
      await onCreateGoalContribution(selectedGoalForContrib.id, {
        valor: Number(contribVal),
        origem: contribSource,
        data: new Date().toISOString().split('T')[0]
      });
      setContribVal('');
      setSelectedGoalForContrib(null);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsAddingContrib(false);
    }
  };

  return (
    <div className="space-y-6 pb-24" id="goals-view">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between" id="goals-header">
        <h3 className="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
          <Trophy className="text-teal-400" size={18} />
          Minhas Metas de Poupança
        </h3>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
        >
          <Plus size={15} /> Criar Nova Meta
        </button>
      </div>

      {/* CREATE META FORM */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 animate-fade-in" id="goals-add-form">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">Nova Meta Financeira</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome da Meta *</label>
              <input 
                type="text" 
                placeholder="Ex: Reserva de Emergência, Viagem"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descrição</label>
              <input 
                type="text" 
                placeholder="Ex: Comprar móveis da sala"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Valor Alvo (R$) *</label>
              <input 
                type="number" 
                placeholder="R$ 10.000"
                value={valorDesejado}
                onChange={(e) => setValorDesejado(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Valor Inicial Acumulado (R$)</label>
              <input 
                type="number" 
                placeholder="0,00"
                value={valorAcumulado}
                onChange={(e) => setValorAcumulado(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none font-semibold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data Pretendida</label>
              <input 
                type="date" 
                value={dataPretendida}
                onChange={(e) => setDataPretendida(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isCreatingGoal}
            className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-950 text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2"
          >
            {isCreatingGoal ? (
              <>
                <Loader2 size={16} className="animate-spin text-slate-950" />
                <span>Criando meta... Aguarde um instante</span>
              </>
            ) : (
              <span>Confirmar e Iniciar Meta</span>
            )}
          </button>
        </form>
      )}

      {/* QUICK CONTRIBUTION FORM */}
      {selectedGoalForContrib && (
        <form onSubmit={handleAddContribution} className="p-5 bg-slate-900 border border-teal-500/30 rounded-2xl space-y-4 animate-fade-in" id="goals-contrib-form">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-xs uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <Sparkles size={14} /> Contribuir para: {selectedGoalForContrib.nome}
            </h4>
            <button type="button" onClick={() => setSelectedGoalForContrib(null)} className="text-xs text-slate-400 hover:text-white">Cancelar</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Valor da Contribuição (R$)</label>
              <input 
                type="number" 
                placeholder="0,00"
                value={contribVal}
                onChange={(e) => setContribVal(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Origem do Dinheiro</label>
              <select 
                value={contribSource} 
                onChange={(e) => setContribSource(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none"
              >
                <option value="Reserva Mensal">Reserva Mensal</option>
                <option value="Salário Extra">Salário Extra</option>
                <option value="Rendimento">Rendimentos de Aplicações</option>
                <option value="Economias de Lazer">Economias de Lazer</option>
              </select>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isAddingContrib}
            className="w-full py-2 bg-gradient-to-r from-teal-500 to-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-teal-500/10 flex items-center justify-center gap-2"
          >
            {isAddingContrib ? (
              <>
                <Loader2 size={16} className="animate-spin text-slate-950" />
                <span>Registrando depósito... Aguarde um instante</span>
              </>
            ) : (
              <span>Confirmar Depósito / Contribuição</span>
            )}
          </button>
        </form>
      )}

      {/* METAS COLLECTION CARDS DISPLAY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="goals-collection">
        {goals.length === 0 ? (
          <div className="col-span-2 text-center py-12 bg-slate-900/40 border border-slate-800/60 rounded-2xl text-slate-500 text-xs">
            Nenhuma meta de poupança criada. Defina uma meta para economizar de forma focada!
          </div>
        ) : (
          goals.map(goal => {
            const percent = goal.valorDesejado > 0 ? Math.min(100, Math.round((goal.valorAcumulado / goal.valorDesejado) * 100)) : 0;
            const remaining = goal.valorDesejado - goal.valorAcumulado;
            
            // Time remaining math
            const start = new Date(goal.dataInicial);
            const target = new Date(goal.dataPretendida);
            const diffMonths = Math.max(1, (target.getFullYear() - start.getFullYear()) * 12 + target.getMonth() - start.getMonth());
            const monthlyGoalReq = Math.round((remaining > 0 ? remaining : 0) / diffMonths);

            return (
              <div key={goal.id} className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl space-y-4 relative overflow-hidden flex flex-col justify-between">
                {goal.status === 'concluida' && (
                  <div className="absolute -right-12 -top-12 w-28 h-28 bg-emerald-500/10 rounded-full flex items-center justify-center p-3 blur-md"></div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-slate-100 block truncate">{goal.nome}</span>
                      {goal.descricao && <span className="text-[10px] text-slate-400 block truncate leading-relaxed">{goal.descricao}</span>}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${goal.status === 'concluida' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-teal-500/10 text-teal-300'}`}>
                      {goal.status === 'concluida' ? 'Concluída!' : 'Ativa'}
                    </span>
                  </div>

                  {/* Progress values display */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] font-bold text-slate-400">Acumulado</span>
                      <span className="text-teal-400 font-bold">{percent}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 border border-slate-800/50 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>R$ {goal.valorAcumulado}</span>
                      <span>Alvo: R$ {goal.valorDesejado}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-400 gap-4 flex-wrap">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-slate-500" />
                    <span>Req. Mensal: <strong>R$ {monthlyGoalReq}/mês</strong></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={12} className="text-slate-500" />
                    <span>Alvo: {goal.dataPretendida.split('-').reverse().slice(0, 2).join('/')}</span>
                  </div>
                </div>

                {/* Contribution Action Buttons Row */}
                {goal.status !== 'concluida' && (
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={() => setSelectedGoalForContrib(goal)}
                      className="flex-1 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1"
                    >
                      <PlusCircle size={13} /> Depositar
                    </button>
                    <button 
                      onClick={() => { if (window.confirm("Excluir esta meta permanentemente?")) onDeleteGoal(goal.id); }}
                      className="px-2.5 py-1.5 bg-slate-850 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded-xl transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
