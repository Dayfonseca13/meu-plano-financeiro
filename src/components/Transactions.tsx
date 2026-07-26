import React, { useState } from 'react';
import { 
  Plus, Calendar, CreditCard, ChevronDown, Check, Trash2, Edit2, 
  Layers, ArrowUpRight, ArrowDownRight, Tag, Bookmark, MapPin, Sparkles, Filter, Loader2
} from 'lucide-react';
import type { Income, Expense, Category } from '../types/finance.ts';

interface TransactionsProps {
  incomes: Income[];
  expenses: Expense[];
  categories: Category[];
  token: string;
  onAddIncome: (inc: any) => Promise<void>;
  onUpdateIncome: (id: string, updates: any, mode: 'single' | 'future' | 'all') => Promise<void>;
  onDeleteIncome: (id: string, mode: 'single' | 'future' | 'all') => Promise<void>;
  onAddExpense: (exp: any) => Promise<void>;
  onUpdateExpense: (id: string, updates: any, mode: 'single' | 'future' | 'all') => Promise<void>;
  onDeleteExpense: (id: string, mode: 'single' | 'future' | 'all') => Promise<void>;
}

export default function Transactions({
  incomes,
  expenses,
  categories,
  onAddIncome,
  onUpdateIncome,
  onDeleteIncome,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense
}: TransactionsProps) {
  const [activeTab, setActiveTab] = useState<'expenses' | 'incomes'>('expenses');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters state
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form Fields
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [dataCompra, setDataCompra] = useState(new Date().toISOString().split('T')[0]);
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('prevista');
  const [formaPagamento, setFormaPagamento] = useState('PIX');
  const [estabelecimento, setEstabelecimento] = useState('');
  const [observacao, setObservacao] = useState('');
  
  // Recurrence / Installments
  const [recorrencia, setRecorrencia] = useState('unica');
  const [quantidadeParcelas, setQuantidadeParcelas] = useState(3);
  const [previewInstallments, setPreviewInstallments] = useState<any[]>([]);

  // Sequence confirmation modal
  const [sequenceAction, setSequenceAction] = useState<{ type: 'edit' | 'delete'; item: any; updates?: any } | null>(null);

  // Load editing values
  const handleStartEdit = (item: any) => {
    setEditingItem(item);
    setDescricao(item.descricao);
    setValor(item.valor.toString());
    setCategoriaId(item.categoriaId);
    setStatus(item.status);
    setObservacao(item.observacao || '');
    if (activeTab === 'expenses') {
      setDataCompra(item.dataCompra);
      setDataVencimento(item.dataVencimento);
      setFormaPagamento(item.formaPagamento);
      setEstabelecimento(item.estabelecimento || '');
    } else {
      setDataVencimento(item.dataPrevista);
    }
    setShowAddForm(true);
  };

  const handleRecorrenciaChange = (rec: string) => {
    setRecorrencia(rec);
    if (rec === 'parcelada') {
      generateInstallmentPreviews();
    } else {
      setPreviewInstallments([]);
    }
  };

  const generateInstallmentPreviews = () => {
    if (!valor || isNaN(Number(valor))) return;
    const items = [];
    const baseDate = new Date(dataVencimento);
    const splitVal = Number(valor);

    for (let i = 0; i < quantidadeParcelas; i++) {
      const nextDate = new Date(baseDate);
      nextDate.setMonth(baseDate.getMonth() + i);
      items.push({
        num: i + 1,
        vencimento: nextDate.toISOString().split('T')[0],
        valor: splitVal
      });
    }
    setPreviewInstallments(items);
  };

  const resetForm = () => {
    setDescricao('');
    setValor('');
    setCategoriaId('');
    setStatus('prevista');
    setFormaPagamento('PIX');
    setEstabelecimento('');
    setObservacao('');
    setRecorrencia('unica');
    setPreviewInstallments([]);
    setEditingItem(null);
    setShowAddForm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !valor || !categoriaId) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const payload: any = {
      descricao,
      valor: Number(valor),
      categoriaId,
      status,
      observacao,
      recorrencia
    };

    if (activeTab === 'expenses') {
      payload.dataCompra = dataCompra;
      payload.dataVencimento = dataVencimento;
      payload.formaPagamento = formaPagamento;
      payload.estabelecimento = estabelecimento;
      if (recorrencia === 'parcelada') {
        payload.quantidadeParcelas = Number(quantidadeParcelas);
      }
    } else {
      payload.dataPrevista = dataVencimento;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        if (editingItem.grupoRecorrencia) {
          // Open sequence choices dialog
          setSequenceAction({ type: 'edit', item: editingItem, updates: payload });
          return;
        }
        if (activeTab === 'expenses') {
          await onUpdateExpense(editingItem.id, payload, 'single');
        } else {
          await onUpdateIncome(editingItem.id, payload, 'single');
        }
      } else {
        if (activeTab === 'expenses') {
          await onAddExpense(payload);
        } else {
          await onAddIncome(payload);
        }
      }
      resetForm();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (item: any) => {
    if (item.grupoRecorrencia) {
      setSequenceAction({ type: 'delete', item });
    } else {
      if (window.confirm("Deseja realmente excluir este lançamento?")) {
        setIsSubmitting(true);
        const action = activeTab === 'expenses' ? onDeleteExpense(item.id, 'single') : onDeleteIncome(item.id, 'single');
        action.catch((err: any) => alert(err.message)).finally(() => setIsSubmitting(false));
      }
    }
  };

  const handleExecuteSequence = async (mode: 'single' | 'future' | 'all') => {
    if (!sequenceAction) return;
    const { type, item, updates } = sequenceAction;

    setIsSubmitting(true);
    try {
      if (type === 'edit') {
        if (activeTab === 'expenses') {
          await onUpdateExpense(item.id, updates, mode);
        } else {
          await onUpdateIncome(item.id, updates, mode);
        }
      } else {
        if (activeTab === 'expenses') {
          await onDeleteExpense(item.id, mode);
        } else {
          await onDeleteIncome(item.id, mode);
        }
      }
      setSequenceAction(null);
      resetForm();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter list results
  const filteredList = (activeTab === 'expenses' ? expenses : incomes).filter(item => {
    if (filterCategory && item.categoriaId !== filterCategory) return false;
    if (filterStatus && item.status !== filterStatus) return false;
    return true;
  }).sort((a, b) => {
    const dateA = activeTab === 'expenses' ? (a as Expense).dataVencimento : (a as Income).dataPrevista;
    const dateB = activeTab === 'expenses' ? (b as Expense).dataVencimento : (b as Income).dataPrevista;
    return dateB.localeCompare(dateA);
  });

  return (
    <div className="space-y-6 pb-24" id="ledger-manager">
      {/* TABS SELECTOR */}
      <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80" id="ledger-tabs">
        <button 
          onClick={() => { setActiveTab('expenses'); setShowAddForm(false); }}
          className={`flex-1 py-3 text-center text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition duration-200 ${activeTab === 'expenses' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' : 'text-slate-400 hover:text-white'}`}
          id="btn-ledger-expenses-tab"
        >
          <ArrowDownRight size={15} /> Despesas
        </button>
        <button 
          onClick={() => { setActiveTab('incomes'); setShowAddForm(false); }}
          className={`flex-1 py-3 text-center text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition duration-200 ${activeTab === 'incomes' ? 'bg-teal-500/10 border border-teal-500/20 text-teal-400' : 'text-slate-400 hover:text-white'}`}
          id="btn-ledger-incomes-tab"
        >
          <ArrowUpRight size={15} /> Receitas
        </button>
      </div>

      {/* FILTER PANEL AND ADD BUTTON ROW */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between" id="ledger-filters-row">
        <div className="flex flex-1 gap-2">
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="flex-1 max-w-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:border-teal-500 outline-none"
          >
            <option value="">Todas Categorias</option>
            {categories.filter(c => c.tipo === (activeTab === 'expenses' ? 'despesa' : 'receita')).map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nome}</option>
            ))}
          </select>

          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 max-w-xs px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:border-teal-500 outline-none"
          >
            <option value="">Todos Status</option>
            {activeTab === 'expenses' ? (
              <>
                <option value="paga">Paga</option>
                <option value="prevista">Prevista</option>
                <option value="pendente">Pendente</option>
                <option value="atrasada">Atrasada</option>
              </>
            ) : (
              <>
                <option value="recebida">Recebida</option>
                <option value="prevista">Prevista</option>
                <option value="atrasada">Atrasada</option>
              </>
            )}
          </select>
        </div>

        <button 
          onClick={() => { resetForm(); setShowAddForm(true); }}
          className={`py-2 px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition text-slate-950 ${activeTab === 'expenses' ? 'bg-rose-400 hover:bg-rose-300' : 'bg-teal-400 hover:bg-teal-300'}`}
          id="btn-add-ledger-item"
        >
          <Plus size={16} /> Novo Lançamento
        </button>
      </div>

      {/* MODAL / COLLAPSIBLE ADD OR EDIT FORM */}
      {showAddForm && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl animate-fade-in space-y-4" id="ledger-form">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-200">
              {editingItem ? 'Editar Lançamento' : 'Novo Lançamento de ' + (activeTab === 'expenses' ? 'Despesa' : 'Receita')}
            </h3>
            <button onClick={resetForm} className="text-xs text-slate-400 hover:text-white font-semibold">Cancelar</button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Descrição */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descrição *</label>
                <input 
                  type="text" 
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500"
                  placeholder="Ex: Almoço restaurante, Salário Mensal"
                />
              </div>

              {/* Valor */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Valor *</label>
                <input 
                  type="number" 
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  onBlur={() => recorrencia === 'parcelada' && generateInstallmentPreviews()}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500 font-bold"
                  placeholder="0,00"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Categoria *</label>
                <select 
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500 font-semibold"
                >
                  <option value="">Selecione...</option>
                  {categories.filter(c => c.tipo === (activeTab === 'expenses' ? 'despesa' : 'receita')).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date */}
              {activeTab === 'expenses' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Data de Compra</label>
                  <input 
                    type="date" 
                    value={dataCompra}
                    onChange={(e) => setDataCompra(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {activeTab === 'expenses' ? 'Data de Vencimento' : 'Data Prevista'}
                </label>
                <input 
                  type="date" 
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  onBlur={() => recorrencia === 'parcelada' && generateInstallmentPreviews()}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500 font-medium"
                >
                  {activeTab === 'expenses' ? (
                    <>
                      <option value="prevista">Prevista</option>
                      <option value="pendente">Pendente</option>
                      <option value="paga">Paga</option>
                      <option value="atrasada">Atrasada</option>
                      <option value="cancelada">Cancelada</option>
                    </>
                  ) : (
                    <>
                      <option value="prevista">Prevista</option>
                      <option value="recebida">Recebida</option>
                      <option value="atrasada">Atrasada</option>
                      <option value="cancelada">Cancelada</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Payment Method / Estabelecimento */}
              {activeTab === 'expenses' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Forma de Pagamento</label>
                    <select 
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500"
                    >
                      <option value="dinheiro">Dinheiro</option>
                      <option value="PIX">PIX</option>
                      <option value="debito">Cartão de Débito</option>
                      <option value="credito">Cartão de Crédito</option>
                      <option value="boleto">Boleto</option>
                      <option value="transferencia">Transferência</option>
                      <option value="debito_automatico">Débito Automático</option>
                      <option value="outra">Outra</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estabelecimento</label>
                    <input 
                      type="text" 
                      value={estabelecimento}
                      onChange={(e) => setEstabelecimento(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500"
                      placeholder="Nome do local"
                    />
                  </div>
                </>
              )}

              {/* Recurrence Selection */}
              {!editingItem && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Recorrência</label>
                  <select 
                    value={recorrencia}
                    onChange={(e) => handleRecorrenciaChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500"
                  >
                    <option value="unica">Lançamento Único</option>
                    {activeTab === 'expenses' ? (
                      <>
                        <option value="recorrente_fixa">Despesa Fixa Mensal</option>
                        <option value="recorrente_variavel">Despesa Variável Mensal</option>
                        <option value="parcelada">Parcelado</option>
                      </>
                    ) : (
                      <>
                        <option value="mensal">Receita Mensal</option>
                        <option value="quinzenal">Receita Quinzenal</option>
                        <option value="semanal">Receita Semanal</option>
                        <option value="anual">Receita Anual</option>
                      </>
                    )}
                  </select>
                </div>
              )}
            </div>

            {/* Installments preview list */}
            {recorrencia === 'parcelada' && !editingItem && (
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={14} /> Prévia de Parcelamento
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400">Parcelas:</span>
                    <input 
                      type="number" 
                      value={quantidadeParcelas}
                      onChange={(e) => { setQuantidadeParcelas(Number(e.target.value)); }}
                      onBlur={generateInstallmentPreviews}
                      className="w-12 p-1 bg-slate-900 border border-slate-800 rounded text-center text-xs font-bold text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                  {previewInstallments.map((inst, idx) => (
                    <div key={idx} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-center text-[10px] space-y-1">
                      <span className="font-bold text-slate-400 block">Parcela {inst.num}/{quantidadeParcelas}</span>
                      <span className="text-white block font-semibold">R$ {inst.valor}</span>
                      <span className="text-slate-500 block">{inst.vencimento.split('-').reverse().slice(0, 2).join('/')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observação */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observações</label>
              <textarea 
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="w-full h-16 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-500 resize-none leading-relaxed"
                placeholder="Notas opcionais..."
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition duration-200 disabled:opacity-60 text-slate-950 ${activeTab === 'expenses' ? 'bg-rose-400 hover:bg-rose-300' : 'bg-teal-400 hover:bg-teal-300'}`}
              id="btn-save-transaction"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-slate-950" />
                  <span>Gravando lançamento... Aguarde um instante</span>
                </>
              ) : (
                <span>Confirmar e Gravar</span>
              )}
            </button>
          </form>
        </div>
      )}

      {/* LEDGER TRANSACTIONS LIST */}
      <div className="space-y-3" id="ledger-list-container">
        {filteredList.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-slate-800/60 text-slate-500 text-xs">
            Nenhum lançamento encontrado para os filtros selecionados neste ciclo.
          </div>
        ) : (
          filteredList.map((item: any) => {
            const date = activeTab === 'expenses' ? item.dataVencimento : item.dataPrevista;
            const cat = categories.find(c => c.id === item.categoriaId);
            return (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 gap-4"
              >
                <div className="min-w-0 flex-1 flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${activeTab === 'expenses' ? 'bg-rose-500/10 text-rose-400' : 'bg-teal-500/10 text-teal-400'}`}>
                    {activeTab === 'expenses' ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-100 block truncate leading-tight">{item.descricao}</span>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-400 flex items-center gap-0.5">
                        <Tag size={10} /> {cat?.nome || 'Geral'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5"><Calendar size={10} /> {date.split('-').reverse().join('/')}</span>
                      {item.estabelecimento && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5"><MapPin size={10} /> {item.estabelecimento}</span>
                        </>
                      )}
                      {item.formaPagamento && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5"><CreditCard size={10} /> {item.formaPagamento}</span>
                        </>
                      )}
                      {item.grupoRecorrencia && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-0.5 text-teal-400 bg-teal-500/10 px-1 rounded">
                            <Layers size={9} /> Recorrente
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right columns metrics / actions */}
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div className="space-y-0.5">
                    <span className={`text-xs font-black block ${activeTab === 'expenses' ? 'text-rose-400' : 'text-teal-400'}`}>
                      {activeTab === 'expenses' ? '-' : '+'} R$ {item.valor}
                    </span>
                    <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider block">{item.status}</span>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleStartEdit(item)}
                      className="p-1.5 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(item)}
                      className="p-1.5 bg-slate-850 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CASCADE SEQUENCE ALTER MODAL / CHOICES */}
      {sequenceAction && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" id="sequence-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full space-y-4">
            <h4 className="font-bold text-sm text-white uppercase tracking-wider">Lançamento Recorrente</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Você selecionou uma transação recorrente ou parcelada. Deseja aplicar esta operação a quais lançamentos?
            </p>
            <div className="space-y-2 pt-2">
              <button 
                onClick={() => handleExecuteSequence('single')}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl text-left px-4 border border-slate-700/60 block"
              >
                Somente este lançamento
              </button>
              <button 
                onClick={() => handleExecuteSequence('future')}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl text-left px-4 border border-slate-700/60 block"
              >
                Este e os próximos lançamentos
              </button>
              <button 
                onClick={() => handleExecuteSequence('all')}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl text-left px-4 border border-slate-700/60 block"
              >
                Toda a sequência
              </button>
            </div>
            <button 
              onClick={() => setSequenceAction(null)}
              className="w-full py-2 text-xs text-slate-400 hover:text-white font-medium border-t border-slate-800 mt-2 block"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
