import { useState } from 'react';
import { 
  PiggyBank, ArrowUpRight, ArrowDownRight, Calendar, AlertTriangle, 
  CheckCircle, PlusCircle, Bell, ArrowRight, ShieldCheck, ChevronRight, Activity 
} from 'lucide-react';
import type { Income, Expense, Category, Goal, MonthlyBudget, BudgetItem } from '../types/finance.ts';

interface DashboardProps {
  incomes: Income[];
  expenses: Expense[];
  categories: Category[];
  goals: Goal[];
  budgets: MonthlyBudget[];
  userCurrency: string;
  onQuickAction: (action: 'income' | 'expense' | 'pay' | 'goal') => void;
  onNavigateToView: (view: string) => void;
}

export default function Dashboard({
  incomes,
  expenses,
  categories,
  goals,
  budgets,
  userCurrency,
  onQuickAction,
  onNavigateToView
}: DashboardProps) {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const monthsList = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' }
  ];

  // Helper to format currency
  const formatVal = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: userCurrency || 'BRL'
    }).format(val);
  };

  // Filter items for selected month and year
  const getMonthStr = (m: number) => m < 10 ? `0${m}` : `${m}`;
  const monthFilter = `${selectedYear}-${getMonthStr(selectedMonth)}`;

  const currentIncomes = incomes.filter(i => i.dataPrevista.startsWith(monthFilter));
  const currentExpenses = expenses.filter(e => e.dataVencimento.startsWith(monthFilter) || e.dataCompra.startsWith(monthFilter));

  // Calculated totals
  const totalIncomesExpected = currentIncomes.reduce((acc, i) => acc + i.valor, 0);
  const totalIncomesReceived = currentIncomes.filter(i => i.status === 'recebida').reduce((acc, i) => acc + i.valor, 0);

  const totalExpensesExpected = currentExpenses.reduce((acc, e) => acc + e.valor, 0);
  const totalExpensesPaid = currentExpenses.filter(e => e.status === 'paga').reduce((acc, e) => acc + e.valor, 0);

  const currentBalance = totalIncomesReceived - totalExpensesPaid;
  const projectedBalance = (totalIncomesReceived + (totalIncomesExpected - totalIncomesReceived)) - totalExpensesExpected;

  const committedPercentage = totalIncomesExpected > 0 ? Math.min(100, Math.round((totalExpensesExpected / totalIncomesExpected) * 100)) : 0;

  // Find category usages and limits
  const currentBudget = budgets.find(b => b.mes === selectedMonth && b.ano === selectedYear);
  const categoryUsages = categories.filter(c => c.tipo === 'despesa').map(cat => {
    const spent = currentExpenses
      .filter(e => e.categoriaId === cat.id && e.status === 'paga')
      .reduce((acc, e) => acc + e.valor, 0);
    
    // Check limit from category or budget
    const limit = cat.limiteMensal || 0;
    const percentage = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;

    return {
      cat,
      spent,
      limit,
      percentage
    };
  }).filter(item => item.limit > 0);

  const criticalCategories = categoryUsages.filter(item => item.percentage >= 75);

  // Bill calendars due shortly (next 7 days or overdue)
  const todayStr = new Date().toISOString().split('T')[0];
  const next7DaysStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const upcomingBills = currentExpenses.filter(e => {
    return e.status !== 'paga' && e.status !== 'cancelada' && e.dataVencimento <= next7DaysStr;
  }).sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento));

  // Goals preview
  const activeGoals = goals.filter(g => g.status === 'em_andamento' || g.status === 'nao_iniciada').slice(0, 2);

  // Recent 4 transactions
  const allTransactions = [
    ...currentIncomes.map(i => ({ ...i, txType: 'receita' as const, date: i.dataPrevista, desc: i.descricao })),
    ...currentExpenses.map(e => ({ ...e, txType: 'despesa' as const, date: e.dataCompra || e.dataVencimento, desc: e.descricao }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  return (
    <div className="space-y-6 pb-24" id="dashboard-view">
      {/* RANGE FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80" id="db-range-bar">
        <div className="flex items-center gap-2.5">
          <Calendar className="text-teal-400" size={18} />
          <span className="text-sm font-semibold text-slate-300">Selecione o Ciclo:</span>
          <div className="flex gap-2">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold outline-none text-white focus:border-teal-500"
            >
              {monthsList.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
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

        {/* QUICK ACCESS ACTIONS ROW */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto" id="db-quick-actions">
          <button 
            onClick={() => onQuickAction('income')}
            className="flex-1 sm:flex-initial px-3 py-1.5 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 border border-teal-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            + Receita
          </button>
          <button 
            onClick={() => onQuickAction('expense')}
            className="flex-1 sm:flex-initial px-3 py-1.5 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            + Despesa
          </button>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="db-metrics-cards">
        {/* Total Incomes Card */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-2 relative overflow-hidden">
          <div className="absolute -right-3 -top-3 w-10 h-10 bg-teal-500/10 rounded-full"></div>
          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Receitas</span>
            <ArrowUpRight size={16} className="text-teal-400" />
          </div>
          <p className="text-lg md:text-xl font-black text-white">{formatVal(totalIncomesReceived)}</p>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Previsto: {formatVal(totalIncomesExpected)}</span>
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-2 relative overflow-hidden">
          <div className="absolute -right-3 -top-3 w-10 h-10 bg-rose-500/10 rounded-full"></div>
          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Despesas</span>
            <ArrowDownRight size={16} className="text-rose-400" />
          </div>
          <p className="text-lg md:text-xl font-black text-white">{formatVal(totalExpensesPaid)}</p>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Previsto: {formatVal(totalExpensesExpected)}</span>
          </div>
        </div>

        {/* Current Balance Card */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Saldo Real</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
          </div>
          <p className="text-lg md:text-xl font-black text-teal-300">{formatVal(currentBalance)}</p>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Disponível em caixa</span>
          </div>
        </div>

        {/* Projected Balance Card */}
        <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <span>Projetado Fim Mês</span>
            <span className="h-2 w-2 rounded-full bg-teal-400"></span>
          </div>
          <p className={`text-lg md:text-xl font-black ${projectedBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatVal(projectedBalance)}
          </p>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Se mantiver o ritmo</span>
          </div>
        </div>
      </div>

      {/* COMMITMENT BAR */}
      <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/60 space-y-2" id="db-commitment-bar">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-slate-300">Comprometimento de Renda</span>
          <span className={`${committedPercentage >= 85 ? 'text-rose-400' : 'text-teal-400'}`}>{committedPercentage}% da Renda</span>
        </div>
        <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${committedPercentage >= 85 ? 'bg-rose-500' : 'bg-teal-500'}`}
            style={{ width: `${committedPercentage}%` }}
          ></div>
        </div>
        <p className="text-[10px] text-slate-400 italic">
          {committedPercentage >= 85 
            ? 'Atenção! Você comprometeu mais de 85% de suas receitas planejadas para este ciclo.' 
            : 'Seu comprometimento de despesas planejadas está em um nível saudável.'}
        </p>
      </div>

      {/* BENTO LAYOUT MAIN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="db-bento-grid">
        {/* COLUMN LEFT: ALERTS & BILLS (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* CRITICAL ALERTS LIMITS */}
          {criticalCategories.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-3" id="db-critical-alerts">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle size={18} />
                <h4 className="font-bold text-xs uppercase tracking-wider">Atenção ao Orçamento!</h4>
              </div>
              <div className="space-y-2">
                {criticalCategories.map(({ cat, spent, limit, percentage }) => (
                  <div key={cat.id} className="text-xs flex flex-col gap-1 text-slate-300">
                    <div className="flex justify-between font-semibold">
                      <span>{cat.nome}</span>
                      <span className="text-amber-400">{percentage}% (R$ {spent} de R$ {limit})</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UPCOMING BILLS SECTION */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 space-y-4" id="db-upcoming-bills">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-white uppercase tracking-wider">Contas a Vencer</h3>
              <button onClick={() => onNavigateToView('planejamento')} className="text-xs text-teal-400 hover:underline flex items-center gap-1">
                Ver calendário <ChevronRight size={14} />
              </button>
            </div>

            {upcomingBills.length === 0 ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle className="text-teal-400 mx-auto" size={24} />
                <p className="text-xs text-slate-400 font-medium">Tudo pago! Nenhuma conta vencendo nos próximos 7 dias.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingBills.map(bill => {
                  const isOverdue = bill.dataVencimento < todayStr;
                  return (
                    <div key={bill.id} className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-800/50 gap-4">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-slate-200 block truncate">{bill.descricao}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-medium px-2 py-0.2 rounded ${isOverdue ? 'bg-rose-500/15 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
                            {isOverdue ? 'Atrasado' : 'Vence em ' + bill.dataVencimento.split('-').reverse().slice(0, 2).join('/')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-100 block">{formatVal(bill.valor)}</span>
                        <button 
                          onClick={() => onQuickAction('pay')}
                          className="mt-1 px-2.5 py-0.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-[10px] font-bold rounded-md transition"
                        >
                          Pagar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* DYNAMIC PURE-SVG EVOLUTION CHART */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 space-y-4" id="db-expenses-chart">
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">Uso do Planejamento</h3>
            <div className="h-44 flex items-end justify-between px-4 pt-4 border-b border-slate-800/60">
              {categoryUsages.length === 0 ? (
                <div className="w-full text-center pb-12">
                  <span className="text-xs text-slate-500 font-medium">Crie limites na área "Meu Planejamento" para ver seu consumo</span>
                </div>
              ) : (
                categoryUsages.slice(0, 5).map(item => (
                  <div key={item.cat.id} className="flex flex-col items-center gap-2 group w-1/5">
                    <div className="w-full bg-slate-950 rounded-t-lg relative h-28 overflow-hidden border border-slate-800/60">
                      <div 
                        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-teal-500 to-emerald-400 rounded-t-md transition-all duration-500 group-hover:opacity-90"
                        style={{ height: `${item.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-[9px] font-medium text-slate-300 truncate max-w-full">{item.cat.nome}</span>
                    <span className="text-[8px] text-slate-500 font-semibold">{item.percentage}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLUMN RIGHT: SAVINGS, RECENT (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          {/* METAS PROGRESS */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 space-y-4" id="db-goals-preview">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-white uppercase tracking-wider">Metas em Andamento</h3>
              <button onClick={() => onNavigateToView('metas')} className="text-xs text-teal-400 hover:underline flex items-center gap-1">
                Ver todas <ChevronRight size={14} />
              </button>
            </div>

            {activeGoals.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs font-medium">
                Nenhuma meta criada ainda. Organize sua viagem, casa ou reserva!
              </div>
            ) : (
              <div className="space-y-4">
                {activeGoals.map(goal => {
                  const percent = goal.valorDesejado > 0 ? Math.min(100, Math.round((goal.valorAcumulado / goal.valorDesejado) * 100)) : 0;
                  return (
                    <div key={goal.id} className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/40">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-200">{goal.nome}</span>
                        <span className="text-teal-400 font-bold">{percent}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full" style={{ width: `${percent}%` }}></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>R$ {goal.valorAcumulado} acum.</span>
                        <span>Alvo: R$ {goal.valorDesejado}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RECENT TRANSACTIONS */}
          <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 space-y-4" id="db-recent-transactions">
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">Últimos Lançamentos</h3>
            {allTransactions.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs font-medium">
                Nenhum lançamento registrado neste mês. Use o botão + para lançar!
              </div>
            ) : (
              <div className="space-y-2.5">
                {allTransactions.map((tx: any) => {
                  const isInc = tx.txType === 'receita';
                  const cat = categories.find(c => c.id === tx.categoriaId);
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-2.5 bg-slate-950/30 rounded-xl border border-slate-800/30">
                      <div className="min-w-0 flex-1 flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-lg shrink-0 ${isInc ? 'bg-teal-500/10 text-teal-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {isInc ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-slate-200 block truncate">{tx.desc}</span>
                          <span className="text-[9px] text-slate-500 font-medium block">{cat?.nome || 'Lançamento'} • {tx.date.split('-').reverse().slice(0, 2).join('/')}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`text-xs font-bold ${isInc ? 'text-teal-400' : 'text-rose-400'}`}>
                          {isInc ? '+' : '-'} R$ {tx.valor}
                        </span>
                        <span className="text-[8px] text-slate-500 block uppercase tracking-wider font-semibold">{tx.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
