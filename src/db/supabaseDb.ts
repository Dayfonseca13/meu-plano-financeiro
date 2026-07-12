import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  User, 
  Category, 
  Income, 
  Expense, 
  MonthlyBudget, 
  BudgetItem, 
  Goal, 
  GoalContribution, 
  Notification, 
  AuditLog, 
  AiConversation, 
  AiMessage 
} from '../types/finance.ts';

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return str.startsWith('http://') || str.startsWith('https://');
  } catch (_) {
    return false;
  }
}

export const isSupabaseConfigured = (): boolean => {
  const url = process.env.SUPABASE_URL?.trim() || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || '';
  
  return (
    !!url && 
    url !== 'SUA_SUPABASE_URL' && 
    !url.includes('SUA_') && 
    isValidUrl(url) && 
    !!key && 
    key !== 'SUA_SUPABASE_ANON_KEY' &&
    !key.includes('SUA_')
  );
};

let supabaseClient: any = null;

export const getSupabase = () => {
  if (supabaseClient) return supabaseClient;

  if (!isSupabaseConfigured()) {
    return null;
  }

  const url = process.env.SUPABASE_URL?.trim() || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || '';

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
};

export const supabase = new Proxy({}, { 
  get(target, prop) { 
    const client = getSupabase(); 
    if (!client) return undefined;
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  } 
}) as SupabaseClient | any;

// Helper to log errors or throw them
async function handleSupabaseResult<T>(promise: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    console.error('Supabase Query Error:', error);
    throw new Error(`Supabase Error: ${error.message || JSON.stringify(error)}`);
  }
  return data as T;
}

// Default fallback categories
import { defaultCategories } from './constants.js';

export const supabaseDbManager = {
  // 1. USER METHODS
  async getUsers(): Promise<User[]> {
    if (!getSupabase()) return [];
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
      console.warn('Could not read users from Supabase, make sure schema is created:', error.message);
      throw error;
    }
    return (data || []) as User[];
  },

  async getUserById(id: string): Promise<User | undefined> {
    if (!getSupabase()) return undefined;
    const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as User | undefined;
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!getSupabase()) return undefined;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    if (error) throw error;
    return data as User | undefined;
  },

  async createUser(user: Omit<User, 'dataCriacao' | 'dataAtualizacao' | 'preferencias'>, requestId?: string): Promise<User> {
    const rId = requestId || 'unknown';
    console.log(`[REGISTER:${rId}:09] Início de criação do usuário no banco (Supabase)`);
    if (!getSupabase()) {
      console.error(`[REGISTER:${rId}:09-ERROR] Cliente Supabase não inicializado`);
      throw new Error('Supabase client is not initialized.');
    }
    
    const newUser: User = {
      ...user,
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
      preferencias: {
        modoEscuro: 'sistema',
        notificarContasVencendo: true,
        notificarOrcamento70: true,
        notificarOrcamento90: true
      }
    };

    // Insert user
    try {
      await handleSupabaseResult(
        supabase.from('users').insert([newUser])
      );
      console.log(`[REGISTER:${rId}:10] Usuário criado no banco (Supabase) com id: ${newUser.id}`);
    } catch (err: any) {
      console.error(`[REGISTER:${rId}:10-ERROR] Falha ao inserir usuário no Supabase:`, {
        message: err.message,
        code: err?.code || 'N/A'
      });
      throw err;
    }

    // Seed default categories in Supabase for this new user
    console.log(`[REGISTER:${rId}:11] Seed de categorias iniciado`);
    const catInserts = defaultCategories.map((cat) => ({
      id: `cat_${Math.random().toString(36).substring(2, 11)}`,
      userId: newUser.id,
      nome: cat.nome,
      tipo: cat.tipo,
      icone: cat.icone,
      subcategorias: [],
      status: 'ativo',
      ordem: cat.ordem
    }));

    try {
      await handleSupabaseResult(
        supabase.from('categories').insert(catInserts)
      );
      console.log(`[REGISTER:05] Categorias criadas`);
    } catch (err: any) {
      console.error(`[REGISTER:ERRO] Seed de categorias falhou:`, {
        name: err.name,
        message: err.message,
        stack: err.stack
      });
      // Do not throw, allow user registration to complete without default categories
    }

    return newUser;
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        dataAtualizacao: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as User;
  },

  async deleteUser(id: string): Promise<void> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    await handleSupabaseResult(
      supabase.from('users').delete().eq('id', id)
    );
  },

  // 2. CATEGORIES
  async getCategories(userId: string): Promise<Category[]> {
    if (!getSupabase()) return [];
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('userId', userId)
      .order('ordem', { ascending: true });
    if (error) throw error;
    return (data || []) as Category[];
  },

  async createCategory(userId: string, cat: Omit<Category, 'id' | 'userId'>): Promise<Category> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const newCat = {
      ...cat,
      id: `cat_${Math.random().toString(36).substring(2, 11)}`,
      userId
    };
    await handleSupabaseResult(
      supabase.from('categories').insert([newCat])
    );
    return newCat as Category;
  },

  async updateCategory(userId: string, id: string, updates: Partial<Category>): Promise<Category> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const { data, error } = await supabase
      .from('categories')
      .update(updates)
      .eq('id', id)
      .eq('userId', userId)
      .select()
      .single();
    if (error) throw error;
    return data as Category;
  },

  async deleteCategory(userId: string, id: string): Promise<void> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    await handleSupabaseResult(
      supabase.from('categories').delete().eq('id', id).eq('userId', userId)
    );
  },

  // 3. INCOMES
  async getIncomes(userId: string): Promise<Income[]> {
    if (!getSupabase()) return [];
    const { data, error } = await supabase
      .from('incomes')
      .select('*')
      .eq('userId', userId)
      .order('dataPrevista', { ascending: false });
    if (error) throw error;
    return (data || []) as Income[];
  },

  async createIncome(userId: string, inc: Omit<Income, 'id' | 'userId' | 'criadoEm' | 'atualizadoEm' | 'versao'>): Promise<Income> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const newInc: Income = {
      ...inc,
      id: inc.grupoRecorrencia && (inc as any).id ? (inc as any).id : `inc_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      versao: 1
    };
    await handleSupabaseResult(
      supabase.from('incomes').insert([newInc])
    );
    return newInc;
  },

  async updateIncome(userId: string, id: string, updates: Partial<Income>): Promise<Income> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const { data, error } = await supabase
      .from('incomes')
      .update({
        ...updates,
        atualizadoEm: new Date().toISOString()
      })
      .eq('id', id)
      .eq('userId', userId)
      .select()
      .single();
    if (error) throw error;
    return data as Income;
  },

  async deleteIncome(userId: string, id: string): Promise<void> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    await handleSupabaseResult(
      supabase.from('incomes').delete().eq('id', id).eq('userId', userId)
    );
  },

  // 4. EXPENSES
  async getExpenses(userId: string): Promise<Expense[]> {
    if (!getSupabase()) return [];
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('userId', userId)
      .order('dataVencimento', { ascending: false });
    if (error) throw error;
    return (data || []) as Expense[];
  },

  async createExpense(userId: string, exp: Omit<Expense, 'id' | 'userId' | 'criadoEm' | 'atualizadoEm' | 'versao'>): Promise<Expense> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const newExp: Expense = {
      ...exp,
      id: exp.grupoRecorrencia && (exp as any).id ? (exp as any).id : `exp_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      versao: 1
    };
    await handleSupabaseResult(
      supabase.from('expenses').insert([newExp])
    );
    return newExp;
  },

  async updateExpense(userId: string, id: string, updates: Partial<Expense>): Promise<Expense> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const { data, error } = await supabase
      .from('expenses')
      .update({
        ...updates,
        atualizadoEm: new Date().toISOString()
      })
      .eq('id', id)
      .eq('userId', userId)
      .select()
      .single();
    if (error) throw error;
    return data as Expense;
  },

  async deleteExpense(userId: string, id: string): Promise<void> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    await handleSupabaseResult(
      supabase.from('expenses').delete().eq('id', id).eq('userId', userId)
    );
  },

  // 5. GOALS
  async getGoals(userId: string): Promise<Goal[]> {
    if (!getSupabase()) return [];
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('userId', userId);
    if (error) throw error;
    return (data || []) as Goal[];
  },

  async createGoal(userId: string, goal: Omit<Goal, 'id' | 'userId'>): Promise<Goal> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const newGoal: Goal = {
      ...goal,
      id: `goal_${Math.random().toString(36).substring(2, 11)}`,
      userId
    };
    await handleSupabaseResult(
      supabase.from('goals').insert([newGoal])
    );
    return newGoal;
  },

  async updateGoal(userId: string, id: string, updates: Partial<Goal>): Promise<Goal> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const { data, error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .eq('userId', userId)
      .select()
      .single();
    if (error) throw error;
    return data as Goal;
  },

  async deleteGoal(userId: string, id: string): Promise<void> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    await handleSupabaseResult(
      supabase.from('goals').delete().eq('id', id).eq('userId', userId)
    );
  },

  async createGoalContribution(userId: string, contrib: Omit<GoalContribution, 'id' | 'userId'>): Promise<GoalContribution> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const newContrib: GoalContribution = {
      ...contrib,
      id: `gct_${Math.random().toString(36).substring(2, 11)}`,
      userId
    };

    // Begin transaction-like sequence in app code
    await handleSupabaseResult(
      supabase.from('goal_contributions').insert([newContrib])
    );

    // Increment goal accumulated value
    const { data: goal, error: fetchError } = await supabase
      .from('goals')
      .select('valorAcumulado')
      .eq('id', contrib.goalId)
      .single();

    if (!fetchError && goal) {
      const currentVal = Number(goal.valorAcumulado || 0);
      const newVal = currentVal + Number(contrib.valor);
      await supabase
        .from('goals')
        .update({ valorAcumulado: newVal })
        .eq('id', contrib.goalId);
    }

    return newContrib;
  },

  // 6. MONTHLY BUDGETS & BUDGET ITEMS
  async getMonthlyBudgets(userId: string): Promise<any[]> {
    if (!getSupabase()) return [];
    // Fetch budgets
    const { data: budgets, error: budgetError } = await supabase
      .from('monthly_budgets')
      .select('*')
      .eq('userId', userId);

    if (budgetError) throw budgetError;
    if (!budgets || budgets.length === 0) return [];

    const fullBudgets = [];
    for (const b of budgets) {
      const { data: items, error: itemsError } = await supabase
        .from('budget_items')
        .select('*')
        .eq('monthlyBudgetId', b.id);

      if (!itemsError) {
        fullBudgets.push({
          ...b,
          items: items || []
        });
      } else {
        fullBudgets.push({
          ...b,
          items: []
        });
      }
    }

    return fullBudgets;
  },

  async saveMonthlyBudget(userId: string, budget: Omit<MonthlyBudget, 'id' | 'userId'>, items: Omit<BudgetItem, 'id' | 'monthlyBudgetId'>[]): Promise<any> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    
    // Check if budget exists for this month/year
    const { data: existingBudget } = await supabase
      .from('monthly_budgets')
      .select('id')
      .eq('userId', userId)
      .eq('mes', budget.mes)
      .eq('ano', budget.ano)
      .maybeSingle();

    let budgetId = existingBudget?.id;

    if (budgetId) {
      // Update budget
      await handleSupabaseResult(
        supabase.from('monthly_budgets').update(budget).eq('id', budgetId)
      );
      // Clear previous budget items
      await handleSupabaseResult(
        supabase.from('budget_items').delete().eq('monthlyBudgetId', budgetId)
      );
    } else {
      // Create budget
      budgetId = `bud_${Math.random().toString(36).substring(2, 11)}`;
      await handleSupabaseResult(
        supabase.from('monthly_budgets').insert([{
          ...budget,
          id: budgetId,
          userId
        }])
      );
    }

    // Insert new budget items
    if (items && items.length > 0) {
      const budgetItemsInserts = items.map(item => ({
        ...item,
        id: `bit_${Math.random().toString(36).substring(2, 11)}`,
        monthlyBudgetId: budgetId
      }));
      await handleSupabaseResult(
        supabase.from('budget_items').insert(budgetItemsInserts)
      );
    }

    return {
      ...budget,
      id: budgetId,
      userId,
      items: items || []
    };
  },

  // 7. NOTIFICATIONS
  async getNotifications(userId: string): Promise<Notification[]> {
    if (!getSupabase()) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('userId', userId)
      .order('data', { ascending: false });
    if (error) throw error;
    return (data || []) as Notification[];
  },

  async createNotification(userId: string, notif: Omit<Notification, 'id' | 'userId' | 'data' | 'lida'>): Promise<Notification> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const newNotif: Notification = {
      ...notif,
      id: `not_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      lida: false,
      data: new Date().toISOString()
    };
    await handleSupabaseResult(
      supabase.from('notifications').insert([newNotif])
    );
    return newNotif;
  },

  async updateNotification(userId: string, id: string, updates: Partial<Notification>): Promise<Notification> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const { data, error } = await supabase
      .from('notifications')
      .update(updates)
      .eq('id', id)
      .eq('userId', userId)
      .select()
      .single();
    if (error) throw error;
    return data as Notification;
  },

  async deleteNotification(userId: string, id: string): Promise<void> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    await handleSupabaseResult(
      supabase.from('notifications').delete().eq('id', id).eq('userId', userId)
    );
  },

  // 8. AUDIT LOGS
  async getAuditLogs(userId: string): Promise<AuditLog[]> {
    if (!getSupabase()) return [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('userId', userId)
      .order('data', { ascending: false });
    if (error) throw error;
    return (data || []) as AuditLog[];
  },

  async createAuditLog(userId: string, log: Omit<AuditLog, 'id' | 'userId' | 'data'>): Promise<AuditLog> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const newLog: AuditLog = {
      ...log,
      id: `log_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      data: new Date().toISOString()
    };
    // Fire and forget audit logs so they don't block user flow
    supabase.from('audit_logs').insert([newLog]).then(({ error }) => {
      if (error) console.error('Failed to create audit log in Supabase:', error);
    }).catch((err) => {
      console.error('Unhandled rejection in createAuditLog:', err);
    });
    return newLog;
  },

  // 9. AI CONVERSATIONS
  async getAiConversations(userId: string): Promise<AiConversation[]> {
    if (!getSupabase()) return [];
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('userId', userId)
      .order('atualizadoEm', { ascending: false });
    if (error) throw error;
    return (data || []) as AiConversation[];
  },

  async createAiConversation(userId: string, title: string): Promise<AiConversation> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const now = new Date().toISOString();
    const newConv: AiConversation = {
      id: `con_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      titulo: title,
      criadoEm: now,
      atualizadoEm: now
    };
    await handleSupabaseResult(
      supabase.from('ai_conversations').insert([newConv])
    );
    return newConv;
  },

  async getAiMessages(userId: string, conversationId: string): Promise<AiMessage[]> {
    if (!getSupabase()) return [];
    const { data, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversationId', conversationId)
      .eq('userId', userId)
      .order('criadoEm', { ascending: true });
    if (error) throw error;
    return (data || []) as AiMessage[];
  },

  async createAiMessage(userId: string, msg: Omit<AiMessage, 'id' | 'userId' | 'criadoEm'>): Promise<AiMessage> {
    if (!getSupabase()) throw new Error('Supabase client is not initialized.');
    const newMsg: AiMessage = {
      ...msg,
      id: `msg_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      criadoEm: new Date().toISOString()
    };
    await handleSupabaseResult(
      supabase.from('ai_messages').insert([newMsg])
    );

    // Update conversation timestamp
    await supabase
      .from('ai_conversations')
      .update({ atualizadoEm: new Date().toISOString() })
      .eq('id', msg.conversationId);

    return newMsg;
  }
};
