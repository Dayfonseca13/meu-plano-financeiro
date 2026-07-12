-- ==========================================
-- SQL Schema for Meu Plano Financeiro Supabase Integration
-- ==========================================
-- IMPORTANTE: DESATIVE O TRADUTOR AUTOMÁTICO DO SEU NAVEGADOR ANTES DE COPIAR E EXECUTAR ESTE SCRIPT!
-- Se o navegador traduzir o código (ex: "CREATE TABLE" virar "CRIAR TABELA"), o Supabase vai retornar erros de sintaxe!

-- Remover tabelas antigas para evitar conflitos de colunas em minúsculas/maiúsculas (camelCase)
DROP TABLE IF EXISTS ai_messages CASCADE;
DROP TABLE IF EXISTS ai_conversations CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS goal_contributions CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS budget_items CASCADE;
DROP TABLE IF EXISTS monthly_budgets CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS incomes CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  telefone TEXT,
  moeda TEXT DEFAULT 'BRL',
  "fusoHorario" TEXT DEFAULT 'America/Sao_Paulo',
  "diaRecebimentoSalario" INTEGER,
  "inicioCicloMensal" INTEGER DEFAULT 1,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  preferencias JSONB DEFAULT '{"modoEscuro": "sistema", "notificarContasVencendo": true, "notificarOrcamento70": true, "notificarOrcamento90": true}'::jsonb,
  "dataCriacao" TIMESTAMPTZ DEFAULT NOW(),
  "dataAtualizacao" TIMESTAMPTZ DEFAULT NOW(),
  "ultimoAcesso" TIMESTAMPTZ
);

-- 2. Categories Table
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  icone TEXT,
  subcategorias JSONB DEFAULT '[]'::jsonb,
  "categoriaPaiId" TEXT REFERENCES categories(id) ON DELETE SET NULL,
  "limiteMensal" NUMERIC,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'arquivado')),
  ordem INTEGER
);

-- 3. Incomes Table (Receitas)
CREATE TABLE incomes (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  "categoriaId" TEXT REFERENCES categories(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  "dataPrevista" TEXT NOT NULL,
  "dataRecebimento" TEXT,
  status TEXT NOT NULL CHECK (status IN ('prevista', 'recebida', 'atrasada', 'cancelada')),
  recorrencia TEXT DEFAULT 'unica',
  "grupoRecorrencia" TEXT,
  observacao TEXT,
  "formaRecebimento" TEXT,
  "criadoEm" TEXT,
  "atualizadoEm" TEXT,
  versao INTEGER DEFAULT 1
);

-- 4. Expenses Table (Despesas)
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  "categoriaId" TEXT REFERENCES categories(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  "dataCompra" TEXT NOT NULL,
  "dataVencimento" TEXT NOT NULL,
  "dataPagamento" TEXT,
  status TEXT NOT NULL CHECK (status IN ('prevista', 'pendente', 'paga', 'atrasada', 'cancelada')),
  "formaPagamento" TEXT,
  estabelecimento TEXT,
  observacao TEXT,
  recorrencia TEXT DEFAULT 'unica' CHECK (recorrencia IN ('unica', 'recorrente_fixa', 'recorrente_variavel', 'parcelada')),
  "grupoRecorrencia" TEXT,
  "quantidadeParcelas" INTEGER,
  "numeroParcela" INTEGER,
  "criadoEm" TEXT,
  "atualizadoEm" TEXT,
  versao INTEGER DEFAULT 1
);

-- 5. Monthly Budgets Table (Planejamentos Mensais)
CREATE TABLE monthly_budgets (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  "rendaPlanejada" NUMERIC NOT NULL,
  "totalPlanejado" NUMERIC NOT NULL,
  "reservaPlanejada" NUMERIC DEFAULT 0,
  "margemImprevistos" NUMERIC DEFAULT 0,
  observacao TEXT,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('rascunho', 'ativo', 'fechado')),
  UNIQUE ("userId", mes, ano)
);

-- 6. Budget Items Table (Itens do Planejamento)
CREATE TABLE budget_items (
  id TEXT PRIMARY KEY,
  "monthlyBudgetId" TEXT REFERENCES monthly_budgets(id) ON DELETE CASCADE,
  "categoriaId" TEXT REFERENCES categories(id) ON DELETE CASCADE,
  "valorPlanejado" NUMERIC NOT NULL,
  percentual NUMERIC DEFAULT 0,
  prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  "alertaConfigurado" BOOLEAN DEFAULT TRUE
);

-- 7. Goals Table (Metas Financeiras)
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  "valorDesejado" NUMERIC NOT NULL,
  "valorAcumulado" NUMERIC DEFAULT 0,
  "dataInicial" TEXT NOT NULL,
  "dataPretendida" TEXT NOT NULL,
  "contribuicaoMensalPlanejada" NUMERIC DEFAULT 0,
  prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  status TEXT DEFAULT 'em_andamento' CHECK (status IN ('nao_iniciada', 'em_andamento', 'concluida', 'pausada', 'cancelada')),
  icone TEXT
);

-- 8. Goal Contributions Table (Aportes em Metas)
CREATE TABLE goal_contributions (
  id TEXT PRIMARY KEY,
  "goalId" TEXT REFERENCES goals(id) ON DELETE CASCADE,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL,
  data TEXT NOT NULL,
  origem TEXT,
  observacao TEXT,
  "criadoEm" TEXT
);

-- 9. Notifications Table (Notificações)
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'informacao' CHECK (tipo IN ('vencimento', 'orcamento', 'meta', 'receita', 'sincronizacao', 'seguranca', 'lembrete', 'informacao')),
  prioridade TEXT DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  lida BOOLEAN DEFAULT FALSE,
  "linkRelacionado" TEXT,
  "data" TEXT NOT NULL
);

-- 10. Audit Logs Table (Logs de Auditoria)
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  "entidadeId" TEXT NOT NULL,
  data TEXT NOT NULL,
  dispositivo TEXT,
  "descricaoResumida" TEXT
);

-- 11. AI Conversations Table
CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  "criadoEm" TEXT NOT NULL,
  "atualizadoEm" TEXT NOT NULL,
  status TEXT DEFAULT 'ativa'
);

-- 12. AI Messages Table
CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY,
  "conversationId" TEXT REFERENCES ai_conversations(id) ON DELETE CASCADE,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN ('user', 'assistant')),
  conteudo TEXT NOT NULL,
  "criadoEm" TEXT NOT NULL,
  "tokensEstimados" INTEGER DEFAULT 0
);

-- Disable Row Level Security (RLS) for all tables so they are accessible via the public API client
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE incomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages DISABLE ROW LEVEL SECURITY;
