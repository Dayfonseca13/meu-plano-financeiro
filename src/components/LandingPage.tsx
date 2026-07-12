import { PiggyBank, ArrowRight, ShieldCheck, TrendingUp, Sparkles, AlertCircle, Smartphone, WifiOff } from 'lucide-react';

interface LandingPageProps {
  onNavigate: (view: 'login' | 'register' | 'diagnostico') => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between" id="landing-container">
      {/* HEADER */}
      <header className="max-w-7xl mx-auto w-full px-6 py-5 flex items-center justify-between border-b border-slate-800/60" id="landing-header">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-xl shadow-lg shadow-teal-500/20 text-slate-950">
            <PiggyBank size={24} />
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Meu Plano Financeiro
          </span>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => onNavigate('login')}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/40 rounded-xl transition duration-200"
            id="btn-nav-login-top"
          >
            Entrar
          </button>
          <button 
            onClick={() => onNavigate('register')}
            className="px-4 py-2 text-sm font-semibold bg-teal-500 text-slate-950 hover:bg-teal-400 rounded-xl transition duration-200 shadow-md shadow-teal-500/10"
            id="btn-nav-register-top"
          >
            Cadastrar
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col lg:flex-row items-center gap-12" id="landing-hero">
        <div className="flex-1 text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 text-teal-400 rounded-full text-xs font-semibold border border-teal-500/20 animate-pulse">
            <Sparkles size={13} />
            Aplicativo Inteligente & PWA Instalável
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
            Seu dinheiro sob controle, <br />
            <span className="bg-gradient-to-r from-teal-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              sem esforço.
            </span>
          </h1>
          <p className="text-base md:text-lg text-slate-300 max-w-xl leading-relaxed">
            Organize suas receitas e despesas, planeje seus limites por categoria, acompanhe metas de poupança, cadastre gastos de onde estiver sem internet, e otimize sua vida financeira com nosso Assistente de IA.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <button 
              onClick={() => onNavigate('register')}
              className="px-8 py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 transition duration-200 shadow-xl shadow-teal-500/20 text-base"
              id="btn-hero-cta"
            >
              Criar minha conta grátis
              <ArrowRight size={18} />
            </button>
            <button 
              onClick={() => onNavigate('login')}
              className="px-8 py-4 bg-slate-800 hover:bg-slate-700/80 text-white font-semibold rounded-xl flex items-center justify-center transition duration-200 border border-slate-700/60"
              id="btn-hero-sec"
            >
              Acessar minha conta
            </button>
          </div>
        </div>

        {/* DEMONSTRATION GRAPHIC */}
        <div className="flex-1 w-full lg:max-w-xl" id="landing-features-demo">
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden backdrop-blur-md">
            <div className="absolute -right-12 -top-12 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl"></div>
            
            <div className="flex justify-between items-center pb-4 border-b border-slate-800/60">
              <span className="font-bold text-sm text-slate-300">Resumo de Julho</span>
              <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20 font-medium">Equilibrado</span>
            </div>

            {/* Simulated Dashboard Widget */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Recebido</span>
                <p className="text-lg font-bold text-teal-400">R$ 5.400,00</p>
              </div>
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total Pago</span>
                <p className="text-lg font-bold text-rose-400">R$ 3.120,00</p>
              </div>
            </div>

            {/* Simulated Category Limits Widget */}
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>Alimentação</span>
                <span className="text-teal-400">75% utilizados (R$ 600 de R$ 800)</span>
              </div>
              <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
                <div className="h-full bg-teal-500 rounded-full" style={{ width: "75%" }}></div>
              </div>
              <p className="text-[11px] text-slate-400 italic">"Você já utilizou 75% do valor reservado para alimentação."</p>
            </div>

            {/* Quick Feature highlights */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="flex flex-col items-center text-center p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/30">
                <Smartphone size={16} className="text-teal-400 mb-1" />
                <span className="text-[10px] font-medium text-slate-300">Formato PWA</span>
              </div>
              <div className="flex flex-col items-center text-center p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/30">
                <WifiOff size={16} className="text-emerald-400 mb-1" />
                <span className="text-[10px] font-medium text-slate-300">Funciona Offline</span>
              </div>
              <div className="flex flex-col items-center text-center p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/30">
                <Sparkles size={16} className="text-purple-400 mb-1" />
                <span className="text-[10px] font-medium text-slate-300">Assistente IA</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* CORE CAPABILITIES GRID */}
      <section className="bg-slate-950/40 py-16 border-t border-b border-slate-900/80" id="landing-value-props">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl w-fit">
              <ShieldCheck size={22} />
            </div>
            <h3 className="font-bold text-lg text-white">Privacidade & Isolamento</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Seus dados financeiros pertencem apenas a você. Cada usuário acessa de forma segura seus próprios lançamentos com total isolamento.
            </p>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl w-fit">
              <TrendingUp size={22} />
            </div>
            <h3 className="font-bold text-lg text-white">Planejamento e Limites</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Defina tetos mensais por categoria de despesas, evite surpresas no final do mês, e organize metas de curto, médio e longo prazo.
            </p>
          </div>
          <div className="space-y-3">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl w-fit">
              <Sparkles size={22} />
            </div>
            <h3 className="font-bold text-lg text-white">Conselhos Financeiros por IA</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Converse com o assistente em tempo real para tirar dúvidas como "Quanto ainda posso gastar com alimentação?" ou para planejar orçamentos complexos.
            </p>
          </div>
        </div>
      </section>

      {/* LEGAL FOOTER DISCLAIMER */}
      <footer className="max-w-7xl mx-auto w-full px-6 py-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-400" id="landing-footer">
        <div className="flex flex-col gap-1 items-start">
          <p>© 2026 Meu Plano Financeiro. Todos os direitos reservados.</p>
          <button 
            onClick={() => onNavigate('diagnostico')}
            className="text-slate-500 hover:text-sky-400 font-medium transition-colors text-[11px] cursor-pointer"
          >
            Diagnóstico do Sistema 🔍
          </button>
        </div>
        <div className="flex items-start gap-2.5 max-w-md bg-slate-900/60 p-3 rounded-xl border border-slate-800/40" id="legal-disclaimer">
          <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px]">
            <span className="font-semibold text-slate-300">Aviso Legal:</span> Este aplicativo é exclusivamente uma ferramenta de organização, simulação e educação financeira pessoal. Ele não realiza transações financeiras reais e não substitui orientação profissional contábil, jurídica ou de investimentos.
          </p>
        </div>
      </footer>
    </div>
  );
}
