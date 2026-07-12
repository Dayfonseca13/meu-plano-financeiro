export interface User {
  id: string;
  nome: string;
  email: string;
  passwordHash: string;
  telefone?: string;
  moeda: string; // e.g., "BRL", "USD"
  fusoHorario: string;
  diaRecebimentoSalario?: number;
  inicioCicloMensal: number; // e.g., 1 (dia 1 do mês)
  dataCriacao: string;
  dataAtualizacao: string;
  status: 'ativo' | 'inativo';
  preferencias: {
    modoEscuro: 'claro' | 'escuro' | 'sistema';
    limiteAlertaAlimentacao?: number;
    notificarContasVencendo: boolean;
    notificarOrcamento70: boolean;
    notificarOrcamento90: boolean;
  };
  ultimoAcesso?: string;
  role: 'admin' | 'user';
}

export interface Category {
  id: string;
  userId: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  icone: string; // e.g., icon key
  subcategorias: string[];
  categoriaPaiId?: string;
  limiteMensal?: number;
  status: 'ativo' | 'arquivado';
  ordem: number;
}

export interface Income {
  id: string;
  userId: string;
  categoriaId: string;
  descricao: string;
  valor: number;
  dataPrevista: string; // YYYY-MM-DD
  dataRecebimento?: string; // YYYY-MM-DD
  status: 'prevista' | 'recebida' | 'atrasada' | 'cancelada';
  recorrencia: 'unica' | 'semanal' | 'quinzenal' | 'mensal' | 'anual' | string;
  grupoRecorrencia?: string; // Identifica a série recorrente
  observacao?: string;
  formaRecebimento?: string;
  criadoEm: string;
  atualizadoEm: string;
  versao: number;
}

export interface Expense {
  id: string;
  userId: string;
  categoriaId: string;
  descricao: string;
  valor: number;
  dataCompra: string; // YYYY-MM-DD
  dataVencimento: string; // YYYY-MM-DD
  dataPagamento?: string; // YYYY-MM-DD
  status: 'prevista' | 'pendente' | 'paga' | 'atrasada' | 'cancelada';
  formaPagamento: 'dinheiro' | 'PIX' | 'debito' | 'credito' | 'boleto' | 'transferencia' | 'debito_automatico' | string;
  estabelecimento?: string;
  observacao?: string;
  recorrencia: 'unica' | 'recorrente_fixa' | 'recorrente_variavel' | 'parcelada';
  grupoRecorrencia?: string; // Identifica a série recorrente ou parcelada
  quantidadeParcelas?: number;
  numeroParcela?: number;
  criadoEm: string;
  atualizadoEm: string;
  versao: number;
}

export interface MonthlyBudget {
  id: string;
  userId: string;
  mes: number; // 1-12
  ano: number;
  rendaPlanejada: number;
  totalPlanejado: number;
  reservaPlanejada: number;
  margemImprevistos: number;
  observacao?: string;
  status: 'rascunho' | 'ativo' | 'fechado';
}

export interface BudgetItem {
  id: string;
  monthlyBudgetId: string;
  categoriaId: string;
  valorPlanejado: number;
  percentual: number;
  prioridade: 'baixa' | 'media' | 'alta';
  alertaConfigurado: boolean;
}

export interface Goal {
  id: string;
  userId: string;
  nome: string;
  descricao?: string;
  valorDesejado: number;
  valorAcumulado: number;
  dataInicial: string; // YYYY-MM-DD
  dataPretendida: string; // YYYY-MM-DD
  contribuicaoMensalPlanejada: number;
  prioridade: 'baixa' | 'media' | 'alta';
  status: 'nao_iniciada' | 'em_andamento' | 'concluida' | 'pausada' | 'cancelada';
  icone?: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  userId: string;
  valor: number;
  data: string; // YYYY-MM-DD
  origem: string;
  observacao?: string;
}

export interface Notification {
  id: string;
  userId: string;
  titulo: string;
  mensagem: string;
  tipo: 'vencimento' | 'orcamento' | 'meta' | 'receita' | 'sincronizacao' | 'seguranca' | 'lembrete' | 'informacao';
  prioridade: 'baixa' | 'media' | 'alta';
  data: string; // ISO String
  lida: boolean;
  linkRelacionado?: string;
}

export interface PushSubscriptionModel {
  id: string;
  userId: string;
  dispositivo: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  ativo: boolean;
  dataCriacao: string;
  ultimoUso: string;
}

export interface RecurringItem {
  id: string;
  userId: string;
  tipo: 'receita' | 'despesa';
  referenciaId: string;
  frequencia: 'semanal' | 'quinzenal' | 'mensal' | 'anual' | string;
  dataInicial: string;
  dataFinal?: string;
  proximaExecucao: string;
  status: 'ativo' | 'pausado' | 'concluido';
}

export interface AiConversation {
  id: string;
  userId: string;
  titulo: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface AiMessage {
  id: string;
  conversationId: string;
  userId: string;
  papel: 'user' | 'assistant';
  conteudo: string;
  criadoEm: string;
  tokensEstimados?: number;
}

export interface SyncOperation {
  id: string;
  userId: string;
  clientOperationId: string;
  tipo: 'criar' | 'atualizar' | 'excluir';
  entidade: 'receita' | 'despesa' | 'categoria' | 'meta' | 'planejamento' | string;
  entidadeId: string;
  conteudo: string; // JSON string of the entry
  status: 'pendente' | 'sincronizado' | 'erro';
  tentativas: number;
  criadoEm: string;
  sincronizadoEm?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  data: string;
  dispositivo: string;
  descricaoResumida: string;
}

export interface DbSchema {
  users: User[];
  categories: Category[];
  incomes: Income[];
  expenses: Expense[];
  monthly_budgets: MonthlyBudget[];
  budget_items: BudgetItem[];
  goals: Goal[];
  goal_contributions: GoalContribution[];
  notifications: Notification[];
  push_subscriptions: PushSubscriptionModel[];
  recurring_items: RecurringItem[];
  ai_conversations: AiConversation[];
  ai_messages: AiMessage[];
  sync_operations: SyncOperation[];
  audit_logs: AuditLog[];
}
