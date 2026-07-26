import React, { useState, useEffect } from 'react';
import { 
  PiggyBank, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle, 
  PlusCircle, Edit2, Bookmark, Save, Trash2, ArrowUpRight, FolderPlus, Loader2
} from 'lucide-react';
import type { Category, Expense, MonthlyBudget, BudgetItem } from '../types/finance.ts';

interface PlanningProps {
  categories: Category[];
  expenses: Expense[];
  budgets: MonthlyBudget[];
  token: string;
  onSaveBudget: (budget: any, items: any[]) => Promise<void>;
  onCreateCategory: (cat: any) => Promise<void>;
  onUpdateCategory: (id: string, updates: any) => Promise<void>;
}

export default function Planning({
  categories,
  expenses,
  budgets,
  onSaveBudget,
  onCreateCategory,
  onUpdateCategory
}: PlanningProps) {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Budget values
  const [rendaEsperada, setRendaEsperada] = useState(3500);
  const [reservaPlanejada, setReservaPlanejada] = useState(500);
  const [margemImprevistos, setMargemImprevistos] = useState(200);

  // Limits values per category
  const [limits, setLimits] = useState<{ [categoryId: string]: number }>({});

  // Category creation form
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Bookmark');
  const [newCatLimit, setNewCatLimit] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingCat, setIsCreatingCat] = useState(false);

  // Load existing budget if any
  useEffect(() => {
    const activeBudget = budgets.find(b => b.mes === selectedMonth && b.ano === selectedYear);
    if (activeBudget) {
      setRendaEsperada(activeBudget.rendaPlanejada);
      setReservaPlanejada(activeBudget.reservaPlanejada);
      setMargemImprevistos(activeBudget.margemImprevistos);
    }
    
    // Load limits from categories
    const initialLimits: { [categoryId: string]: number } = {};
    categories.forEach(cat => {
      if (cat.tipo === 'despesa') {
        initialLimits[cat.id] = cat.limiteMensal || 0;
      }
    });
    setLimits(initialLimits);
  }, [selectedMonth, selectedYear, categories, budgets]);

  const handleLimitChange = (catId: string, val: number) => {
    setLimits({ ...limits, [catId]: val });
  };

  const handleSaveAll = async () => {
    // Total planned despesa from category limits
    const totalPlanned = Object.values(limits).reduce((acc: number, curr: number) => acc + curr, 0);

    const budgetPayload = {
      mes: selectedMonth,
      ano: selectedYear,
      rendaPlanejada: Number(rendaEsperada),
      totalPlanejado: totalPlanned,
      reservaPlanejada: Number(reservaPlanejada),
      margemImprevistos: Number(margemImprevistos),
      status: 'ativo' as const
    };

    const itemsPayload = Object.entries(limits).map(([categoryId, plannedValue]) => {
      const val = plannedValue as number;
      return {
        categoriaId: categoryId,
        valorPlanejado: val,
        percentual: Number(rendaEsperada) > 0 ? Math.round((val / Number(rendaEsperada)) * 100) : 0,
        prioridade: 'media' as const,
        alertaConfigured: true
      };
    });

    setIsSaving(true);
    try {
      await onSaveBudget(budgetPayload, itemsPayload);
      
      // Update individual categories on server as well for cache safety
      for (const [catId, val] of Object.entries(limits)) {
        await onUpdateCategory(catId, { limiteMensal: val });
      }

      alert("Planejamento de limites salvo com sucesso!");
    } catch (error: any) {
      alert("Erro ao salvar planejamento: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;

    setIsCreatingCat(true);
    try {
      await onCreateCategory({
        nome: newCatName,
        tipo: 'despesa',
        icone: newCatIcon,
        limiteMensal: newCatLimit ? Number(newCatLimit) : undefined,
        status: 'ativo',
        ordem: categories.length + 1,
        subcategorias: []
      });
      setNewCatName('');
      setNewCatLimit('');
      setShowAddCat(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsCreatingCat(false);
    }
  };

  // Filter expenses for selected month
  const getMonthStr = (m: number) => m < 10 ? `0${m}` : `${m}`;
  const monthFilter = `${selectedYear}-${getMonthStr(selectedMonth)}`;
  const currentExpenses = expenses.filter(e => e.dataVencimento.startsWith(monthFilter) || e.dataCompra.startsWith(monthFilter));

  const totalLimitsSum: number = Object.values(limits).reduce((acc: number, val: any) => acc + Number(val || 0), 0) as number;
  const remainingRenda = Number(rendaEsperada) - Number(reservaPlanejada) - Number(margemImprevistos) - Number(totalLimitsSum);

  return (
    <div className="space-y-6 pb-24" id="planning-view">
      {/* RANGE SELECTOR BAR */}
      <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80" id="plan-range-bar">
        <h3 className="font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
          <PiggyBank className="text-teal-400" size={18} />
          Distribuição de Renda
        </h3>
        <div className="flex gap-2">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold outline-none text-white focus:border-teal-500"
          >
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
              <option key={m} value={m}>Mês {m}</option>
            ))}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold outline-none text-white focus:border-teal-500"
          >
            {[2025, 2026, 2027].map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>
      </div>

      {/* CORE ALLOCATION STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="plan-core-allocs">
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Renda Esperada</span>
          <input 
            type="number"
            value={rendaEsperada}
            onChange={(e) => setRendaEsperada(Number(e.target.value))}
            className="w-full bg-transparent border-b border-transparent focus:border-teal-500 text-lg font-black text-white outline-none"
          />
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Reserva / Poupar</span>
          <input 
            type="number"
            value={reservaPlanejada}
            onChange={(e) => setReservaPlanejada(Number(e.target.value))}
            className="w-full bg-transparent border-b border-transparent focus:border-teal-500 text-lg font-black text-emerald-400 outline-none"
          />
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Imprevistos</span>
          <input 
            type="number"
            value={margemImprevistos}
            onChange={(e) => setMargemImprevistos(Number(e.target.value))}
            className="w-full bg-transparent border-b border-transparent focus:border-teal-500 text-lg font-black text-amber-400 outline-none"
          />
        </div>
        <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Saldo Livre</span>
          <p className={`text-lg font-black ${remainingRenda >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
            R$ {remainingRenda}
          </p>
        </div>
      </div>

      {/* PLAN LIMIT BUDGETS ACTIONS ROWS */}
      <div className="flex items-center justify-between" id="plan-actions-panel">
        <button 
          onClick={() => setShowAddCat(!showAddCat)}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 rounded-xl flex items-center gap-1.5 transition"
        >
          <FolderPlus size={15} /> Criar Categoria
        </button>
        <button 
          onClick={handleSaveAll}
          disabled={isSaving}
          className="px-6 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition shadow-lg shadow-teal-500/10"
        >
          {isSaving ? (
            <>
              <Loader2 size={15} className="animate-spin text-slate-950" />
              <span>Salvando orçamento... Aguarde um instante</span>
            </>
          ) : (
            <>
              <Save size={15} />
              <span>Salvar Orçamento</span>
            </>
          )}
        </button>
      </div>

      {/* CREATE CATEGORY MODAL FORM */}
      {showAddCat && (
        <form onSubmit={handleCreateCategorySubmit} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 animate-fade-in" id="plan-add-cat-form">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300">Criar Nova Categoria de Despesa</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input 
              type="text" 
              placeholder="Nome da Categoria (Ex: Pet)"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none"
              required
            />
            <input 
              type="number" 
              placeholder="Limite Mensal Padrão (R$ - opcional)"
              value={newCatLimit}
              onChange={(e) => setNewCatLimit(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none"
            />
            <select 
              value={newCatIcon}
              onChange={(e) => setNewCatIcon(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none font-semibold"
            >
              <option value="Bookmark">Marcador (Padrão)</option>
              <option value="Utensils">Alimentação (Talher)</option>
              <option value="Home">Casa (Moradia)</option>
              <option value="Car">Carro (Transporte)</option>
              <option value="HeartPulse">Saúde (Coração)</option>
              <option value="Gamepad2">Controle (Lazer)</option>
            </select>
          </div>
          <button 
            type="submit" 
            disabled={isCreatingCat}
            className="w-full py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
          >
            {isCreatingCat ? (
              <>
                <Loader2 size={14} className="animate-spin text-slate-950" />
                <span>Criando categoria... Aguarde um instante</span>
              </>
            ) : (
              <span>Confirmar e Criar Categoria</span>
            )}
          </button>
        </form>
      )}

      {/* DETAILED CATEGORY LIST WITH SPENT VS PLANNED COMPARISONS */}
      <div className="space-y-3.5" id="plan-category-limits-list">
        {categories.filter(c => c.tipo === 'despesa' && c.status === 'ativo').map(cat => {
          const limit = limits[cat.id] || 0;
          const spent = currentExpenses
            .filter(e => e.categoriaId === cat.id && e.status === 'paga')
            .reduce((acc, e) => acc + e.valor, 0);

          const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
          const remaining = limit - spent;

          // Accessibility tagging and visual indicator states
          let stateLabel = 'Sem limite definido';
          let stateIcon = <CheckCircle2 size={14} className="text-slate-500" />;
          let stateColor = 'text-slate-400';

          if (limit > 0) {
            if (pct >= 100) {
              stateLabel = 'Limite excedido! Ajuste seus gastos imediatamente.';
              stateIcon = <AlertTriangle size={14} className="text-rose-500" />;
              stateColor = 'text-rose-400 font-bold';
            } else if (pct >= 85) {
              stateLabel = 'Atenção: Limite muito próximo do fim!';
              stateIcon = <AlertTriangle size={14} className="text-amber-500" />;
              stateColor = 'text-amber-400 font-bold';
            } else {
              stateLabel = 'Orçamento saudável e sob controle.';
              stateIcon = <CheckCircle2 size={14} className="text-teal-400" />;
              stateColor = 'text-teal-400 font-medium';
            }
          }

          return (
            <div key={cat.id} className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="min-w-0">
                  <span className="font-bold text-xs text-white block">{cat.nome}</span>
                  {/* Accessibility indicator text */}
                  <span className={`text-[10px] flex items-center gap-1 mt-0.5 ${stateColor}`}>
                    {stateIcon} {stateLabel}
                  </span>
                </div>

                {/* Edit Category Limit Field */}
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Limite: R$</span>
                  <input 
                    type="number"
                    value={limit === 0 ? '' : limit}
                    onChange={(e) => handleLimitChange(cat.id, Number(e.target.value))}
                    className="w-24 p-1 py-0.5 bg-slate-950 border border-slate-800 rounded-lg text-right text-xs font-bold text-white outline-none focus:border-teal-500"
                    placeholder="0,00"
                  />
                </div>
              </div>

              {limit > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="h-2 w-full bg-slate-950 border border-slate-800/40 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-rose-500' : pct >= 85 ? 'bg-amber-400' : 'bg-teal-500'}`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Gasto: R$ {spent} ({pct}%)</span>
                    <span>Restante: R$ {remaining >= 0 ? remaining : 0} (Disponível)</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
