import React, { useState, useEffect } from 'react';
import { Database, CheckCircle, AlertTriangle, Copy, Check, RefreshCw, HelpCircle, Code, Shield } from 'lucide-react';

interface SupabaseStatus {
  isConfigured: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  canConnect: boolean;
  connectionError: string | null;
}

export default function SupabaseIntegration() {
  const [status, setStatus] = useState<SupabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/supabase/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Erro ao buscar status do Supabase:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const sqlSchema = `-- SQL Schema for Meu Plano Financeiro Supabase Integration
-- Execute este script no SQL Editor do seu projeto Supabase

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  moeda TEXT DEFAULT 'BRL',
  "fusoHorario" TEXT DEFAULT 'America/Sao_Paulo',
  "diaRecebimentoSalario" INTEGER,
  "inicioCicloMensal" INTEGER DEFAULT 1,
  status TEXT DEFAULT 'ativo',
  role TEXT DEFAULT 'user',
  preferencias JSONB DEFAULT '{}'::jsonb,
  "dataCriacao" TIMESTAMPTZ DEFAULT NOW(),
  "dataAtualizacao" TIMESTAMPTZ DEFAULT NOW(),
  "ultimoAcesso" TIMESTAMPTZ
);

-- 2. Tabela de Categorias
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  icone TEXT,
  subcategorias JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'ativo',
  ordem INTEGER
);

-- 3. Tabela de Receitas (Incomes)
CREATE TABLE IF NOT EXISTS incomes (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  "categoriaId" TEXT REFERENCES categories(id) ON DELETE SET NULL,
  "dataPrevista" TEXT NOT NULL,
  "dataRecebimento" TEXT,
  status TEXT NOT NULL CHECK (status IN ('paga', 'prevista', 'atrasada', 'recebida')),
  recorrencia TEXT DEFAULT 'unica',
  "grupoRecorrencia" TEXT,
  observacao TEXT,
  "criadoEm" TEXT,
  "atualizadoEm" TEXT,
  versao INTEGER DEFAULT 1
);

-- 4. Tabela de Despesas (Expenses)
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  "categoriaId" TEXT REFERENCES categories(id) ON DELETE SET NULL,
  "dataCompra" TEXT NOT NULL,
  "dataVencimento" TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paga', 'prevista', 'atrasada', 'recebida')),
  "formaPagamento" TEXT,
  estabelecimento TEXT,
  observacao TEXT,
  recorrencia TEXT DEFAULT 'unica',
  "grupoRecorrencia" TEXT,
  "quantidadeParcelas" INTEGER,
  "numeroParcela" INTEGER,
  "dataPagamento" TEXT,
  "criadoEm" TEXT,
  "atualizadoEm" TEXT,
  versao INTEGER DEFAULT 1
);

-- 5. Tabela de Orçamentos Mensais
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  "rendaPlanejada" NUMERIC NOT NULL,
  "totalPlanejado" NUMERIC NOT NULL,
  "reservaPlanejada" NUMERIC DEFAULT 0,
  "margemImprevistos" NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'ativo',
  UNIQUE ("userId", mes, ano)
);

-- 6. Itens de Orçamento
CREATE TABLE IF NOT EXISTS budget_items (
  id TEXT PRIMARY KEY,
  "monthlyBudgetId" TEXT REFERENCES monthly_budgets(id) ON DELETE CASCADE,
  "categoriaId" TEXT REFERENCES categories(id) ON DELETE CASCADE,
  "valorPlanejado" NUMERIC NOT NULL,
  percentual NUMERIC DEFAULT 0,
  prioridade TEXT DEFAULT 'media',
  "alertaConfigurado" BOOLEAN DEFAULT TRUE
);

-- 7. Metas (Goals)
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  "valorDesejado" NUMERIC NOT NULL,
  "valorAcumulado" NUMERIC DEFAULT 0,
  "dataPrazo" TEXT,
  "categoriaId" TEXT REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'ativa',
  icone TEXT,
  cor TEXT,
  "criadoEm" TEXT,
  "atualizadoEm" TEXT
);

-- 8. Contribuições de Metas
CREATE TABLE IF NOT EXISTS goal_contributions (
  id TEXT PRIMARY KEY,
  "goalId" TEXT REFERENCES goals(id) ON DELETE CASCADE,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL,
  data TEXT NOT NULL,
  origem TEXT,
  observacao TEXT,
  "criadoEm" TEXT
);

-- 9. Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT DEFAULT 'info',
  lida BOOLEAN DEFAULT FALSE,
  link TEXT,
  "criadoEm" TEXT
);

-- 10. Logs de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  "entidadeId" TEXT,
  dispositivo TEXT,
  ip TEXT,
  timestamp TEXT NOT NULL,
  "descricaoResumida" TEXT,
  "dadosAdicionais" JSONB DEFAULT '{}'::jsonb
);

-- 11. Conversas do Assistente IA
CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  "criadoEm" TEXT NOT NULL,
  "atualizadoEm" TEXT NOT NULL,
  status TEXT DEFAULT 'ativa'
);

-- 12. Mensagens do Assistente IA
CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  "conversationId" TEXT REFERENCES ai_conversations(id) ON DELETE CASCADE,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  papel TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  "criadoEm" TEXT NOT NULL,
  "tokensUso" INTEGER DEFAULT 0,
  metadados JSONB DEFAULT '{}'::jsonb
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
ALTER TABLE ai_messages DISABLE ROW LEVEL SECURITY;`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 text-slate-100" id="supabase-integration-tab">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-900 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shadow-inner">
            <Database size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Integração Supabase</h1>
            <p className="text-slate-400 text-xs mt-1 max-w-xl">
              Conecte sua plataforma de planejamento financeiro a um banco de dados na nuvem seguro no Supabase com tolerância a falhas e sincronização automática.
            </p>
          </div>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-white transition disabled:opacity-50 self-start md:self-center"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Atualizar Conexão</span>
        </button>
      </div>

      {/* STATUS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CONNECTION STATUS */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-900 flex flex-col justify-between">
          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-2">Conectividade</span>
          <div className="flex items-center gap-2.5 my-2">
            {status?.canConnect ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                <span className="text-white text-sm font-bold">Totalmente Conectado</span>
              </>
            ) : status?.isConfigured ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.5)]"></div>
                <span className="text-white text-sm font-bold">Configurado (Pendente)</span>
              </>
            ) : (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                <span className="text-slate-400 text-sm font-bold">Banco Local Ativo</span>
              </>
            )}
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed mt-2">
            {status?.canConnect
              ? 'Todas as operações estão sincronizadas diretamente com seu banco Supabase.'
              : 'O aplicativo está operando em modo local seguro utilizando SQLite/JSON local.'}
          </p>
        </div>

        {/* SECURITY STATUS */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-900 flex flex-col justify-between">
          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-2">Segurança & Autonomia</span>
          <div className="flex items-center gap-2.5 my-2">
            <Shield size={18} className="text-teal-400" />
            <span className="text-white text-sm font-bold">Fallback Automático</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Se a sua conexão com o Supabase falhar, o sistema reverte automaticamente para o armazenamento local para que você nunca perca dados.
          </p>
        </div>

        {/* DETAILS CARD */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-900 flex flex-col justify-between">
          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block mb-2">Chaves do Projeto</span>
          <div className="space-y-1.5 mt-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">SUPABASE_URL:</span>
              <span className="font-mono text-white text-right">{status?.supabaseUrl || 'Não configurado'}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">SUPABASE_ANON_KEY:</span>
              <span className="font-mono text-white text-right">{status?.supabaseAnonKey || 'Não configurado'}</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-500 mt-2 block leading-snug">
            Configure estas variáveis nas Configurações do seu projeto ou arquivo `.env`.
          </span>
        </div>
      </div>

      {/* ERROR CARD IF EXISTS */}
      {status?.isConfigured && !status?.canConnect && (
        <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-4 flex gap-3 text-amber-300">
          <AlertTriangle className="shrink-0" size={20} />
          <div className="text-xs space-y-1.5">
            <h4 className="font-bold">Aviso de Configuração</h4>
            <p className="leading-relaxed">
              O Supabase está com as credenciais declaradas, mas a conexão falhou:
            </p>
            <p className="font-mono bg-amber-950/40 p-2 rounded border border-amber-900/30 text-white max-w-full overflow-x-auto">
              {status.connectionError}
            </p>
          </div>
        </div>
      )}

      {/* CONFIGURATION GUIDE */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-900 space-y-4">
            <h3 className="text-white text-sm font-bold flex items-center gap-2">
              <HelpCircle size={16} className="text-teal-400" />
              Como Conectar?
            </h3>
            <ol className="space-y-3 text-xs text-slate-400 list-decimal pl-4 leading-relaxed">
              <li>
                Crie uma conta gratuita no <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-semibold underline hover:text-emerald-300">Supabase</a>.
              </li>
              <li>
                Inicie um novo projeto PostgreSQL no Supabase.
              </li>
              <li>
                Vá no <strong>SQL Editor</strong> do seu painel e clique em <strong>New Query</strong>.
              </li>
              <li>
                Copie o script SQL ao lado e execute-o clicando em <strong>Run</strong>. Isso criará toda a estrutura de tabelas.
              </li>
              <li>
                No Supabase, acesse <strong>Project Settings</strong> &gt; <strong>API</strong> para obter o <code className="text-slate-200">Project URL</code> e a <code className="text-slate-200">anon public key</code>.
              </li>
              <li>
                Declare as seguintes variáveis no menu <strong>Settings &gt; Secrets</strong> deste assistente ou em seu arquivo <code className="text-slate-200">.env</code>:
                <div className="bg-slate-900 p-2 rounded mt-1.5 font-mono text-[10px] space-y-1 text-teal-300">
                  <p>SUPABASE_URL=seu_url</p>
                  <p>SUPABASE_ANON_KEY=sua_chave_anonima</p>
                </div>
              </li>
            </ol>
          </div>
        </div>

        {/* SQL SCRIPT COPIER */}
        <div className="lg:col-span-3 bg-slate-950 rounded-xl border border-slate-900 overflow-hidden flex flex-col h-[520px]">
          <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-900 flex justify-between items-center shrink-0">
            <span className="text-white text-xs font-bold flex items-center gap-2">
              <Code size={14} className="text-teal-400" />
              Script SQL de Migração (migration.sql)
            </span>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-slate-300 hover:text-white rounded text-[10px] font-bold transition border border-slate-700 hover:border-slate-600 active:scale-95"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copiar Código</span>
                </>
              )}
            </button>
          </div>

          <div className="p-4 overflow-y-auto font-mono text-[11px] leading-relaxed text-slate-300 bg-slate-950 grow select-text selection:bg-teal-500/20 selection:text-white scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            <pre>{sqlSchema}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
