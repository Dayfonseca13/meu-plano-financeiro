import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, Server, Database } from 'lucide-react';

interface DiagnosticsProps {
  onBack: () => void;
}

export function Diagnostics({ onBack }: DiagnosticsProps) {
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');

  const runHealthCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      const text = await res.text();
      setLastCheckTime(new Date().toLocaleTimeString());
      try {
        const data = JSON.parse(text);
        setHealthData(data);
        if (!res.ok) {
          setError(data.message || 'O servidor retornou um status de erro.');
        }
      } catch (_) {
        setError(`Resposta inválida do servidor (HTTP ${res.status}): ${text.substring(0, 150)}`);
      }
    } catch (err: any) {
      setError(`Erro de rede / conexão: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center font-sans">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 font-sans">
            <Server size={20} className="text-sky-400" /> Diagnóstico do Sistema
          </h1>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm text-slate-400 bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div>
            <span className="block text-xs uppercase tracking-wider text-slate-500 font-semibold">URL Atual</span>
            <span className="font-mono text-xs truncate block">{window.location.href}</span>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-slate-500 font-semibold">Ambiente</span>
            <span className="font-mono text-xs block text-sky-400">
              {healthData?.environment || 'detectando...'} (runtime: {healthData?.runtime || 'detectando...'})
            </span>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="space-y-4 mb-6">
          <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">Checks de Configuração</h2>
          
          <div className="space-y-3">
            {/* Server Online */}
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Server size={16} className="text-slate-400" /> Servidor Web (API)
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono">
                {loading ? (
                  <span className="text-slate-400">testando...</span>
                ) : healthData?.checks?.server ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> Ativo</span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1"><XCircle size={14} /> Inativo</span>
                )}
              </div>
            </div>

            {/* Supabase Configured */}
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Database size={16} className="text-slate-400" /> Variáveis de URL e Anon Key
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono">
                {loading ? (
                  <span className="text-slate-400">testando...</span>
                ) : (healthData?.checks?.supabaseUrlConfigured && healthData?.checks?.supabaseKeyConfigured) ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> Configurado</span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1"><XCircle size={14} /> Não Configurado</span>
                )}
              </div>
            </div>

            {/* JWT Secret */}
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Server size={16} className="text-slate-400" /> JWT Secret Key
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono">
                {loading ? (
                  <span className="text-slate-400">testando...</span>
                ) : healthData?.checks?.jwtSecretConfigured ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> Configurado</span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1"><XCircle size={14} /> Default Fallback</span>
                )}
              </div>
            </div>

            {/* Supabase Connection */}
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Database size={16} className="text-slate-400" /> Conexão Real com Banco Supabase
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono">
                {loading ? (
                  <span className="text-slate-400">testando...</span>
                ) : healthData?.checks?.supabaseConnection ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={14} /> Conectado</span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1"><XCircle size={14} /> Falhou</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Output */}
        {error && (
          <div className="bg-rose-950/40 border border-rose-900/50 p-4 rounded-xl text-rose-200 text-xs font-mono whitespace-pre-wrap mb-6 max-h-48 overflow-y-auto">
            <span className="font-bold block text-rose-400 uppercase tracking-wide text-[10px] mb-1">Log de Erro Capturado</span>
            {error}
          </div>
        )}

        {/* Diagnostics Actions */}
        <div className="flex gap-3 justify-end items-center mt-6 border-t border-slate-800 pt-4">
          <span className="text-[10px] font-mono text-slate-500 mr-auto">
            Último teste: {lastCheckTime || 'N/A'}
          </span>
          
          <button
            onClick={runHealthCheck}
            disabled={loading}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Testar Conexões
          </button>
        </div>

      </div>
    </div>
  );
}
