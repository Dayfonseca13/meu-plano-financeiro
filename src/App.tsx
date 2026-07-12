import React, { useState, useEffect } from 'react';
import { 
  PiggyBank, LayoutDashboard, ArrowRightLeft, Target, 
  Sparkles, Bell, Wifi, WifiOff, LogOut, Menu, X, Landmark, RefreshCw, Database
} from 'lucide-react';

import LandingPage from './components/LandingPage.tsx';
import Onboarding from './components/Onboarding.tsx';
import Dashboard from './components/Dashboard.tsx';
import Transactions from './components/Transactions.tsx';
import Planning from './components/Planning.tsx';
import Goals from './components/Goals.tsx';
import AiAssistant from './components/AiAssistant.tsx';
import SupabaseIntegration from './components/SupabaseIntegration.tsx';
import { Diagnostics } from './components/Diagnostics.tsx';


import { 
  Category, Income, Expense, Goal, MonthlyBudget, 
  Notification, User 
} from './types/finance.ts';

import { OfflineDb } from './lib/offlineDb.ts';

export default function App() {
  // Authentication & Session
  const [token, setToken] = useState<string>(localStorage.getItem('user_token') || '');
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'register' | 'onboarding' | 'main' | 'diagnostico'>('landing');
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Form states for login/register
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState('');

  // Core Finance states
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // UI state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Shortcut preset parameters
  const [quickFormPreset, setQuickFormPreset] = useState<'income' | 'expense' | null>(null);

  // Connection Event Listeners
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await triggerOfflineQueueSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token]);

  // Sync cache records to local state on initial startup
  useEffect(() => {
    const loadCachedLocalData = async () => {
      try {
        const cachedIncomes = await OfflineDb.getCache<Income[]>('incomes');
        const cachedExpenses = await OfflineDb.getCache<Expense[]>('expenses');
        const cachedCategories = await OfflineDb.getCache<Category[]>('categories');
        const cachedGoals = await OfflineDb.getCache<Goal[]>('goals');

        if (cachedIncomes) setIncomes(cachedIncomes);
        if (cachedExpenses) setExpenses(cachedExpenses);
        if (cachedCategories) setCategories(cachedCategories);
        if (cachedGoals) setGoals(cachedGoals);
      } catch (e) {
        console.error("Failed to load local DB cache:", e);
      }
    };
    loadCachedLocalData();
  }, []);

  // Sync user core entities from backend when authenticated
  useEffect(() => {
    if (token) {
      fetchCoreFinanceEntities();
    } else {
      // Direct unauthorized user to landing
      setCurrentView('landing');
    }
  }, [token]);

  const fetchCoreFinanceEntities = async () => {
    if (!token) return;
    try {
      // 1. Fetch Profile
      const profileRes = await fetch('/api/users/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setUserProfile(profile);
        if (!profile.hasCompletedOnboarding) {
          setCurrentView('onboarding');
        } else {
          setCurrentView('main');
        }
      } else {
        // Stale token, clear it
        handleLogout();
        return;
      }

      // 2. Fetch categories
      const catRes = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (catRes.ok) {
        const cats = await catRes.json();
        setCategories(cats);
        await OfflineDb.setCache('categories', cats);
      }

      // 3. Fetch Incomes
      const incRes = await fetch('/api/incomes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (incRes.ok) {
        const incs = await incRes.json();
        setIncomes(incs);
        await OfflineDb.setCache('incomes', incs);
      }

      // 4. Fetch Expenses
      const expRes = await fetch('/api/expenses', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (expRes.ok) {
        const exps = await expRes.json();
        setExpenses(exps);
        await OfflineDb.setCache('expenses', exps);
      }

      // 5. Fetch Goals
      const goalsRes = await fetch('/api/goals', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (goalsRes.ok) {
        const gls = await goalsRes.json();
        setGoals(gls);
        await OfflineDb.setCache('goals', gls);
      }

      // 6. Fetch Budgets
      const budgetsRes = await fetch('/api/budgets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (budgetsRes.ok) {
        const bdgs = await budgetsRes.json();
        setBudgets(bdgs);
      }

      // 7. Fetch Notifications
      const notifsRes = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (notifsRes.ok) {
        const notifs = await notifsRes.json();
        setNotifications(notifs);
      }

    } catch (e) {
      console.error("Server synchronization failed, running on cached offline mode", e);
    }
  };

  // Synchronization with server when connection returns
  const triggerOfflineQueueSync = async () => {
    if (!token) return;
    const queue = await OfflineDb.getSyncQueue();
    if (queue.length === 0) return;

    setSyncing(true);
    try {
      for (const item of queue) {
        let res;
        if (item.entidade === 'despesa') {
          res = await fetch('/api/expenses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item.conteudo)
          });
        } else if (item.entidade === 'receita') {
          res = await fetch('/api/incomes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(item.conteudo)
          });
        }

        if (res && res.ok) {
          await OfflineDb.removeFromSyncQueue(item.clientOperationId);
        }
      }
      
      // Refresh after syncing
      await fetchCoreFinanceEntities();
    } catch (err) {
      console.error("Error running queue sync:", err);
    } finally {
      setSyncing(false);
    }
  };

    const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha: password })
      });

      const contentType = res.headers.get("content-type") || "";
      let result;

      if (contentType.includes("application/json")) {
        result = await res.json();
      } else {
        const responseText = await res.text();
        console.error("[LOGIN] Resposta não JSON:", { status: res.status, preview: responseText.slice(0, 200) });
        throw new Error(`O servidor apresentou uma falha interna. Status: ${res.status} - ${responseText.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(result?.message || result?.error || "Erro ao efetuar login");
      }

      localStorage.setItem('user_token', result.token);
      setToken(result.token);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || "Não foi possível efetuar o login. O servidor apresentou uma falha interna.");
    }
  };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha: password, nome: fullName })
      });

      const contentType = res.headers.get("content-type") || "";
      let result;

      if (contentType.includes("application/json")) {
        result = await res.json();
      } else {
        const responseText = await res.text();
        console.error("[CADASTRO] Resposta não JSON:", { status: res.status, preview: responseText.slice(0, 200) });
        throw new Error(`O servidor apresentou uma falha interna. Status: ${res.status} - ${responseText.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(result?.message || result?.error || "Não foi possível concluir o cadastro.");
      }

      localStorage.setItem('user_token', result.token);
      setToken(result.token);
      setEmail('');
      setPassword('');
      setFullName('');
    } catch (err: any) {
      setAuthError(err.message || "Não foi possível concluir o cadastro. O servidor apresentou uma falha interna.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_token');
    setToken('');
    setUserProfile(null);
    setCurrentView('landing');
  };

  // Complete Onboarding sequence
  const handleOnboardingComplete = async (onboardingData: any) => {
    try {
      const res = await fetch('/api/users/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(onboardingData)
      });

      if (!res.ok) throw new Error("Falha ao salvar preferências de integração.");
      
      // Reload finance states
      await fetchCoreFinanceEntities();
      setCurrentView('main');
      setActiveTab('dashboard');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // API operations proxies (supporting immediate optimistic offline updates)
  const handleAddExpense = async (expPayload: any) => {
    if (isOnline) {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(expPayload)
      });
      if (res.ok) {
        const newExps = await res.json();
        // Server sends back all expenses list
        setExpenses(newExps);
        await OfflineDb.setCache('expenses', newExps);
      }
    } else {
      // Offline fallback
      const offlineItem = {
        id: `offline_${Date.now()}`,
        ...expPayload,
        status: 'pendente'
      };
      const updatedList = [offlineItem, ...expenses];
      setExpenses(updatedList);
      await OfflineDb.setCache('expenses', updatedList);
      await OfflineDb.addToSyncQueue('criar', 'despesa', offlineItem.id, expPayload);
    }
  };

  const handleAddIncome = async (incPayload: any) => {
    if (isOnline) {
      const res = await fetch('/api/incomes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(incPayload)
      });
      if (res.ok) {
        const newIncs = await res.json();
        setIncomes(newIncs);
        await OfflineDb.setCache('incomes', newIncs);
      }
    } else {
      // Offline fallback
      const offlineItem = {
        id: `offline_${Date.now()}`,
        ...incPayload,
        status: 'prevista'
      };
      const updatedList = [offlineItem, ...incomes];
      setIncomes(updatedList);
      await OfflineDb.setCache('incomes', updatedList);
      await OfflineDb.addToSyncQueue('criar', 'receita', offlineItem.id, incPayload);
    }
  };

  const handleUpdateExpense = async (id: string, updates: any, mode: 'single' | 'future' | 'all') => {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ updates, mode })
    });
    if (res.ok) {
      const newList = await res.json();
      setExpenses(newList);
      await OfflineDb.setCache('expenses', newList);
    }
  };

  const handleDeleteExpense = async (id: string, mode: 'single' | 'future' | 'all') => {
    const res = await fetch(`/api/expenses/${id}?mode=${mode}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const newList = await res.json();
      setExpenses(newList);
      await OfflineDb.setCache('expenses', newList);
    }
  };

  const handleUpdateIncome = async (id: string, updates: any, mode: 'single' | 'future' | 'all') => {
    const res = await fetch(`/api/incomes/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ updates, mode })
    });
    if (res.ok) {
      const newList = await res.json();
      setIncomes(newList);
      await OfflineDb.setCache('incomes', newList);
    }
  };

  const handleDeleteIncome = async (id: string, mode: 'single' | 'future' | 'all') => {
    const res = await fetch(`/api/incomes/${id}?mode=${mode}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const newList = await res.json();
      setIncomes(newList);
      await OfflineDb.setCache('incomes', newList);
    }
  };

  const handleSaveBudget = async (budget: any, items: any[]) => {
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ budget, items })
    });
    if (res.ok) {
      const updatedBudgets = await res.json();
      setBudgets(updatedBudgets);
    }
  };

  const handleCreateCategory = async (cat: any) => {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(cat)
    });
    if (res.ok) {
      const updatedCats = await res.json();
      setCategories(updatedCats);
      await OfflineDb.setCache('categories', updatedCats);
    }
  };

  const handleUpdateCategory = async (id: string, updates: any) => {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      const updatedCats = await res.json();
      setCategories(updatedCats);
      await OfflineDb.setCache('categories', updatedCats);
    }
  };

  const handleCreateGoal = async (goal: any) => {
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(goal)
    });
    if (res.ok) {
      const updatedGoals = await res.json();
      setGoals(updatedGoals);
      await OfflineDb.setCache('goals', updatedGoals);
    }
  };

  const handleUpdateGoal = async (id: string, updates: any) => {
    const res = await fetch(`/api/goals/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      const updatedGoals = await res.json();
      setGoals(updatedGoals);
      await OfflineDb.setCache('goals', updatedGoals);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    const res = await fetch(`/api/goals/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const updatedGoals = await res.json();
      setGoals(updatedGoals);
      await OfflineDb.setCache('goals', updatedGoals);
    }
  };

  const handleCreateGoalContribution = async (goalId: string, contribution: any) => {
    const res = await fetch(`/api/goals/${goalId}/contribute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(contribution)
    });
    if (res.ok) {
      const updatedGoals = await res.json();
      setGoals(updatedGoals);
      await OfflineDb.setCache('goals', updatedGoals);
    }
  };

  // Direct Shortcut Navigation Trigger
  const triggerQuickShortcut = (type: 'income' | 'expense' | 'pay' | 'goal') => {
    if (type === 'income' || type === 'expense') {
      setActiveTab('transactions');
    } else if (type === 'pay') {
      setActiveTab('transactions');
    } else if (type === 'goal') {
      setActiveTab('goals');
    }
  };

  return (
    <div className="min-h-screen bg-[#070913] text-slate-100 flex flex-col font-sans" id="app-root-shell">
      {/* DIAGNOSTICS VIEW */}
      {currentView === 'diagnostico' && (
        <Diagnostics onBack={() => setCurrentView('landing')} />
      )}

      {/* PUBLIC VIEWS: LANDING, LOGIN, REGISTER */}
      {currentView === 'landing' && (
        <LandingPage onNavigate={(view) => setCurrentView(view)} />
      )}

      {(currentView === 'login' || currentView === 'register') && (
        <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden" id="auth-screen">
          <div className="absolute -left-20 -top-20 w-44 h-44 bg-teal-500/10 rounded-full blur-3xl"></div>
          
          <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-2xl relative z-10 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-6 justify-center">
              <div className="p-2.5 bg-teal-500 text-slate-950 rounded-xl">
                <PiggyBank size={22} />
              </div>
              <span className="font-black text-lg text-white">Meu Plano Financeiro</span>
            </div>

            <h2 className="text-xl font-bold text-center text-white mb-2">
              {currentView === 'login' ? 'Boas-vindas de volta!' : 'Crie sua conta'}
            </h2>
            <p className="text-xs text-center text-slate-400 mb-6">
              {currentView === 'login' ? 'Insira suas credenciais para acessar seus dados.' : 'Comece a poupar e planejar hoje mesmo.'}
            </p>

            <form onSubmit={currentView === 'login' ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4">
              {authError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs">{authError}</div>}
              {currentView === 'register' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome Completo</label>
                  <input 
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="João da Silva"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-400"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">E-mail</label>
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Senha</label>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="******"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-teal-400"
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition duration-200 shadow-lg shadow-teal-500/10 mt-2"
                id="btn-auth-submit"
              >
                {currentView === 'login' ? 'Entrar' : 'Cadastrar e Entrar'}
              </button>
            </form>

            <div className="text-xs text-center text-slate-400 mt-6 pt-4 border-t border-slate-850/60">
              {currentView === 'login' ? (
                <p>Não tem uma conta? <button onClick={() => setCurrentView('register')} className="text-teal-400 font-bold hover:underline">Cadastre-se</button></p>
              ) : (
                <p>Já possui uma conta? <button onClick={() => setCurrentView('login')} className="text-teal-400 font-bold hover:underline">Entrar</button></p>
              )}
              <button onClick={() => setCurrentView('landing')} className="mt-4 text-slate-500 hover:text-white font-medium block mx-auto underline">
                Voltar à página inicial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRIVATE STEP-BY-STEP ONBOARDING */}
      {currentView === 'onboarding' && (
        <Onboarding 
          categories={categories} 
          token={token} 
          onComplete={handleOnboardingComplete} 
        />
      )}

      {/* CORE SECURE DASHBOARD VIEWS APP SHELL */}
      {currentView === 'main' && (
        <div className="min-h-screen flex flex-col md:flex-row" id="app-workspace-layout">
          {/* DESKTOP PERMANENT LEFT SIDEBAR */}
          <aside className="hidden md:flex flex-col w-64 bg-slate-950 border-r border-slate-900 justify-between p-6 shrink-0" id="desktop-sidebar">
            <div className="space-y-8">
              {/* App branding title */}
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-teal-500 text-slate-950 rounded-xl">
                  <PiggyBank size={18} />
                </div>
                <span className="font-black text-sm text-white tracking-wide">Meu Plano</span>
              </div>

              {/* Navigation Menu Links */}
              <nav className="space-y-1.5" id="nav-desktop-links">
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'dashboard' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:bg-slate-900/50 hover:text-white'}`}
                >
                  <LayoutDashboard size={16} /> Painel Principal
                </button>
                <button 
                  onClick={() => setActiveTab('transactions')}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'transactions' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:bg-slate-900/50 hover:text-white'}`}
                >
                  <ArrowRightLeft size={16} /> Lançamentos
                </button>
                <button 
                  onClick={() => setActiveTab('planning')}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'planning' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:bg-slate-900/50 hover:text-white'}`}
                >
                  <PiggyBank size={16} /> Meu Planejamento
                </button>
                <button 
                  onClick={() => setActiveTab('goals')}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'goals' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:bg-slate-900/50 hover:text-white'}`}
                >
                  <Target size={16} /> Poupança Metas
                </button>
                <button 
                  onClick={() => setActiveTab('ai_assistant')}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'ai_assistant' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:bg-slate-900/50 hover:text-white'}`}
                >
                  <Sparkles size={16} /> Assistente IA
                </button>
                <button 
                  onClick={() => setActiveTab('supabase')}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'supabase' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:bg-slate-900/50 hover:text-white'}`}
                >
                  <Database size={16} /> Integração Supabase
                </button>

              </nav>
            </div>

            {/* Logout/Profile row */}
            <div className="space-y-4 pt-4 border-t border-slate-900">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white shrink-0">
                  {userProfile?.nome?.[0] || 'U'}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-200 block truncate">{userProfile?.nome || 'Usuário'}</span>
                  <span className="text-[9px] text-slate-500 block truncate">{userProfile?.email}</span>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full py-2 px-3 hover:bg-rose-500/15 rounded-xl text-xs text-rose-400 font-bold flex items-center gap-2 transition"
              >
                <LogOut size={14} /> Sair da conta
              </button>
            </div>
          </aside>

          {/* MAIN PAGE BODY (HEADER + CONTENT FRAME) */}
          <div className="flex-1 flex flex-col min-w-0" id="main-content-scroller">
            {/* WORKSPACE APP HEADER */}
            <header className="bg-slate-950/60 border-b border-slate-900 p-4 px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md" id="app-header-workspace">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 hover:bg-slate-900 rounded-xl md:hidden text-slate-300"
                >
                  {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
                <h2 className="font-bold text-sm text-white uppercase tracking-wider md:block hidden">
                  {activeTab === 'dashboard' && 'Painel Consolidado'}
                  {activeTab === 'transactions' && 'Livro de Lançamentos'}
                  {activeTab === 'planning' && 'Meu Planejamento de Limites'}
                  {activeTab === 'goals' && 'Minhas Metas de Poupança'}
                  {activeTab === 'ai_assistant' && 'Assistente Inteligente Groq'}
                  {activeTab === 'supabase' && 'Integração Supabase Cloud'}
                </h2>
                {/* Compact branding title for mobile screens */}
                <span className="font-bold text-sm text-white md:hidden block">Meu Plano</span>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center gap-3">
                {/* SYNC INDICATOR */}
                {syncing && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-teal-500/10 text-teal-400 text-[10px] font-bold rounded-lg border border-teal-500/10 animate-pulse">
                    <RefreshCw size={11} className="animate-spin" />
                    Sincronizando...
                  </div>
                )}

                {/* ONLINE/OFFLINE CHIP */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${isOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                  {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
                  <span>{isOnline ? 'Conectado' : 'Modo Offline'}</span>
                </div>

                {/* NOTIFICATIONS TRAY TRIGGER */}
                <div className="relative">
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 hover:bg-slate-900 rounded-xl text-slate-300 relative"
                  >
                    <Bell size={18} />
                    {notifications.filter(n => !n.lida).length > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"></span>
                    )}
                  </button>

                  {/* NOTIFICATION FLUTTER PANEL */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-slate-950 border border-slate-900 rounded-2xl shadow-2xl p-4 z-50 space-y-3">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-200 pb-2 border-b border-slate-900">Notificações</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-4 font-medium">Nenhum aviso novo.</p>
                        ) : (
                          notifications.map(notif => (
                            <div key={notif.id} className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/40 text-[10px] space-y-1">
                              <span className="font-bold text-white block">{notif.titulo}</span>
                              <span className="text-slate-300 block leading-relaxed">{notif.mensagem}</span>
                              <span className="text-slate-500 block">{notif.criadoEm.split('T')[0].split('-').reverse().join('/')}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* MOBILE DROPDOWN HAMBURGER LINKS */}
            {mobileMenuOpen && (
              <div className="md:hidden bg-slate-950 border-b border-slate-900 p-4 space-y-2 z-30" id="nav-mobile-dropdown">
                <button 
                  onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'dashboard' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400'}`}
                >
                  <LayoutDashboard size={16} /> Painel Principal
                </button>
                <button 
                  onClick={() => { setActiveTab('transactions'); setMobileMenuOpen(false); }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'transactions' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400'}`}
                >
                  <ArrowRightLeft size={16} /> Lançamentos
                </button>
                <button 
                  onClick={() => { setActiveTab('planning'); setMobileMenuOpen(false); }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'planning' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400'}`}
                >
                  <PiggyBank size={16} /> Meu Planejamento
                </button>
                <button 
                  onClick={() => { setActiveTab('goals'); setMobileMenuOpen(false); }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'goals' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400'}`}
                >
                  <Target size={16} /> Poupança Metas
                </button>
                <button 
                  onClick={() => { setActiveTab('ai_assistant'); setMobileMenuOpen(false); }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'ai_assistant' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400'}`}
                >
                  <Sparkles size={16} /> Assistente IA
                </button>
                <button 
                  onClick={() => { setActiveTab('supabase'); setMobileMenuOpen(false); }}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center gap-3 transition ${activeTab === 'supabase' ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400'}`}
                >
                  <Database size={16} /> Integração Supabase
                </button>
                <button 
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full py-2.5 px-4 text-xs font-bold text-rose-400 flex items-center gap-3 border-t border-slate-900 mt-2"
                >
                  <LogOut size={16} /> Sair da conta
                </button>
              </div>
            )}

            {/* TAB SCREENS ROUTING BODY */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6" id="app-workspace-body">
              {activeTab === 'dashboard' && (
                <Dashboard 
                  incomes={incomes}
                  expenses={expenses}
                  categories={categories}
                  goals={goals}
                  budgets={budgets}
                  userCurrency={userProfile?.preferencias?.moeda || 'BRL'}
                  onQuickAction={triggerQuickShortcut}
                  onNavigateToView={(view) => setActiveTab(view)}
                />
              )}

              {activeTab === 'transactions' && (
                <Transactions 
                  incomes={incomes}
                  expenses={expenses}
                  categories={categories}
                  token={token}
                  onAddIncome={handleAddIncome}
                  onUpdateIncome={handleUpdateIncome}
                  onDeleteIncome={handleDeleteIncome}
                  onAddExpense={handleAddExpense}
                  onUpdateExpense={handleUpdateExpense}
                  onDeleteExpense={handleDeleteExpense}
                />
              )}

              {activeTab === 'planning' && (
                <Planning 
                  categories={categories}
                  expenses={expenses}
                  budgets={budgets}
                  token={token}
                  onSaveBudget={handleSaveBudget}
                  onCreateCategory={handleCreateCategory}
                  onUpdateCategory={handleUpdateCategory}
                />
              )}

              {activeTab === 'goals' && (
                <Goals 
                  goals={goals}
                  token={token}
                  onCreateGoal={handleCreateGoal}
                  onUpdateGoal={handleUpdateGoal}
                  onDeleteGoal={handleDeleteGoal}
                  onCreateGoalContribution={handleCreateGoalContribution}
                />
              )}

              {activeTab === 'ai_assistant' && (
                <AiAssistant 
                  token={token}
                  categories={categories}
                  goals={goals}
                  isOnline={isOnline}
                  onAddExpense={handleAddExpense}
                  onAddIncome={handleAddIncome}
                  onUpdateCategory={handleUpdateCategory}
                  onCreateGoalContribution={handleCreateGoalContribution}
                />
              )}

              {activeTab === 'supabase' && (
                <SupabaseIntegration />
              )}
            </div>

            {/* FLOATING NAVIGATION BAR FOR SMARTPHONES */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-900 flex justify-around p-2.5 z-40 backdrop-blur-md" id="mobile-bottom-tabs">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`flex flex-col items-center gap-1 text-[9px] font-bold ${activeTab === 'dashboard' ? 'text-teal-400' : 'text-slate-500'}`}
              >
                <LayoutDashboard size={16} />
                <span>Painel</span>
              </button>
              <button 
                onClick={() => setActiveTab('transactions')}
                className={`flex flex-col items-center gap-1 text-[9px] font-bold ${activeTab === 'transactions' ? 'text-teal-400' : 'text-slate-500'}`}
              >
                <ArrowRightLeft size={16} />
                <span>Extrato</span>
              </button>
              <button 
                onClick={() => setActiveTab('planning')}
                className={`flex flex-col items-center gap-1 text-[9px] font-bold ${activeTab === 'planning' ? 'text-teal-400' : 'text-slate-500'}`}
              >
                <PiggyBank size={16} />
                <span>Limites</span>
              </button>
              <button 
                onClick={() => setActiveTab('goals')}
                className={`flex flex-col items-center gap-1 text-[9px] font-bold ${activeTab === 'goals' ? 'text-teal-400' : 'text-slate-500'}`}
              >
                <Target size={16} />
                <span>Metas</span>
              </button>
              <button 
                onClick={() => setActiveTab('ai_assistant')}
                className={`flex flex-col items-center gap-1 text-[9px] font-bold ${activeTab === 'ai_assistant' ? 'text-teal-400' : 'text-slate-500'}`}
              >
                <Sparkles size={16} />
                <span>IA Chat</span>
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
