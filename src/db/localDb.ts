import fs from 'fs';
import path from 'path';
import { DbSchema, User, Category, Income, Expense, MonthlyBudget, BudgetItem, Goal, GoalContribution, Notification, PushSubscriptionModel, RecurringItem, AiConversation, AiMessage, SyncOperation, AuditLog } from '../types/finance.ts';
import { supabaseDbManager, isSupabaseConfigured } from './supabaseDb.ts';


let DB_DIR = process.env.VERCEL
  ? '/tmp'
  : path.join(process.cwd(), 'data');
let DB_FILE = path.join(DB_DIR, 'database.json');

// Ensure the directory and file exist with initial schema
function initializeDb() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
  } catch (err: any) {
    console.error(`Failed to create DB_DIR at ${DB_DIR}:`, err);
    // If it's a read-only filesystem error or other write error, fall back to /tmp
    if (DB_DIR !== '/tmp') {
      console.warn("Falling back to /tmp for writeable database directory.");
      DB_DIR = '/tmp';
      DB_FILE = path.join(DB_DIR, 'database.json');
      try {
        if (!fs.existsSync(DB_DIR)) {
          fs.mkdirSync(DB_DIR, { recursive: true });
        }
      } catch (innerErr) {
        console.error("Critical: Failed to create fallback database directory in /tmp:", innerErr);
      }
    }
  }

  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialSchema: DbSchema = {
        users: [],
        categories: [],
        incomes: [],
        expenses: [],
        monthly_budgets: [],
        budget_items: [],
        goals: [],
        goal_contributions: [],
        notifications: [],
        push_subscriptions: [],
        recurring_items: [],
        ai_conversations: [],
        ai_messages: [],
        sync_operations: [],
        audit_logs: []
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialSchema, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error(`Failed to write DB_FILE at ${DB_FILE}:`, err);
    // If fallback is needed
    if (DB_DIR !== '/tmp') {
      DB_DIR = '/tmp';
      DB_FILE = path.join(DB_DIR, 'database.json');
      initializeDb(); // retry with /tmp
    }
  }
}

// Queue for serializing write operations to prevent file corruption
let writeQueue: Promise<void> = Promise.resolve();

async function readDb(): Promise<DbSchema> {
  try {
    initializeDb();
    const data = await fs.promises.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data) as DbSchema;
  } catch (error) {
    console.error("Failed to read database, returning empty schema:", error);
    return {
      users: [],
      categories: [],
      incomes: [],
      expenses: [],
      monthly_budgets: [],
      budget_items: [],
      goals: [],
      goal_contributions: [],
      notifications: [],
      push_subscriptions: [],
      recurring_items: [],
      ai_conversations: [],
      ai_messages: [],
      sync_operations: [],
      audit_logs: []
    };
  }
}

async function writeDb(schema: DbSchema): Promise<void> {
  // We utilize a promise chain queue to ensure writes are synchronous and serialize-safe
  writeQueue = writeQueue.then(async () => {
    try {
      initializeDb();
      const tempFile = `${DB_FILE}.tmp`;
      await fs.promises.writeFile(tempFile, JSON.stringify(schema, null, 2), 'utf-8');
      await fs.promises.rename(tempFile, DB_FILE);
    } catch (error) {
      console.error("Atomic database write failed:", error);
    }
  }).catch((err) => {
    console.error("Unhandleable error in writeQueue chain:", err);
  });
  return writeQueue;
}

export const defaultCategories = [
  { nome: 'Alimentação', icone: 'Utensils', tipo: 'despesa', ordem: 1 },
  { nome: 'Moradia', icone: 'Home', tipo: 'despesa', ordem: 2 },
  { nome: 'Transporte', icone: 'Car', tipo: 'despesa', ordem: 3 },
  { nome: 'Saúde', icone: 'HeartPulse', tipo: 'despesa', ordem: 4 },
  { nome: 'Educação', icone: 'GraduationCap', tipo: 'despesa', ordem: 5 },
  { nome: 'Lazer', icone: 'Gamepad2', tipo: 'despesa', ordem: 6 },
  { nome: 'Vestuário', icone: 'Shirt', tipo: 'despesa', ordem: 7 },
  { nome: 'Cuidados Pessoais', icone: 'Sparkles', tipo: 'despesa', ordem: 8 },
  { nome: 'Dívidas', icone: 'CreditCard', tipo: 'despesa', ordem: 9 },
  { nome: 'Assinaturas', icone: 'Tv', tipo: 'despesa', ordem: 10 },
  { nome: 'Impostos', icone: 'FileText', tipo: 'despesa', ordem: 11 },
  { nome: 'Filhos', icone: 'Baby', tipo: 'despesa', ordem: 12 },
  { nome: 'Animais', icone: 'PawPrint', tipo: 'despesa', ordem: 13 },
  { nome: 'Doações', icone: 'Gift', tipo: 'despesa', ordem: 14 },
  { nome: 'Viagens', icone: 'Plane', tipo: 'despesa', ordem: 15 },
  { nome: 'Investimentos', icone: 'TrendingUp', tipo: 'despesa', ordem: 16 },
  { nome: 'Reserva', icone: 'PiggyBank', tipo: 'despesa', ordem: 17 },
  { nome: 'Compras', icone: 'ShoppingBag', tipo: 'despesa', ordem: 18 },
  { nome: 'Serviços', icone: 'Wrench', tipo: 'despesa', ordem: 19 },
  { nome: 'Outros', icone: 'HelpCircle', tipo: 'despesa', ordem: 20 },
  // Receitas default
  { nome: 'Salário', icone: 'Briefcase', tipo: 'receita', ordem: 1 },
  { nome: 'Renda Extra', icone: 'DollarSign', tipo: 'receita', ordem: 2 },
  { nome: 'Investimentos', icone: 'Percent', tipo: 'receita', ordem: 3 },
  { nome: 'Presente', icone: 'Gift', tipo: 'receita', ordem: 4 }
];

const localDbManager = {
  // USER METHODS
  async getUsers(): Promise<User[]> {
    const db = await readDb();
    return db.users;
  },

  async getUserById(id: string): Promise<User | undefined> {
    const db = await readDb();
    return db.users.find(u => u.id === id);
  },

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = await readDb();
    return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  async createUser(user: Omit<User, 'dataCriacao' | 'dataAtualizacao' | 'preferencias'>): Promise<User> {
    const db = await readDb();
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
    db.users.push(newUser);

    // Seed default categories for this user
    defaultCategories.forEach((cat, index) => {
      const newCat: Category = {
        id: `cat_${Math.random().toString(36).substring(2, 11)}`,
        userId: newUser.id,
        nome: cat.nome,
        tipo: cat.tipo as 'receita' | 'despesa',
        icone: cat.icone,
        subcategorias: [],
        status: 'ativo',
        ordem: cat.ordem
      };
      db.categories.push(newCat);
    });

    await writeDb(db);
    return newUser;
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const db = await readDb();
    const index = db.users.findIndex(u => u.id === id);
    if (index === -1) throw new Error("Usuário não encontrado");

    const updatedUser = {
      ...db.users[index],
      ...updates,
      dataAtualizacao: new Date().toISOString()
    };
    db.users[index] = updatedUser;
    await writeDb(db);
    return updatedUser;
  },

  async deleteUser(id: string): Promise<void> {
    const db = await readDb();
    db.users = db.users.filter(u => u.id !== id);
    db.categories = db.categories.filter(c => c.userId !== id);
    db.incomes = db.incomes.filter(i => i.userId !== id);
    db.expenses = db.expenses.filter(e => e.userId !== id);
    db.monthly_budgets = db.monthly_budgets.filter(b => b.userId !== id);
    db.goals = db.goals.filter(g => g.userId !== id);
    db.goal_contributions = db.goal_contributions.filter(c => c.userId !== id);
    db.notifications = db.notifications.filter(n => n.userId !== id);
    db.push_subscriptions = db.push_subscriptions.filter(p => p.userId !== id);
    db.recurring_items = db.recurring_items.filter(r => r.userId !== id);
    db.ai_conversations = db.ai_conversations.filter(c => c.userId !== id);
    db.ai_messages = db.ai_messages.filter(m => m.userId !== id);
    db.sync_operations = db.sync_operations.filter(s => s.userId !== id);
    db.audit_logs = db.audit_logs.filter(a => a.userId !== id);
    await writeDb(db);
  },

  // CATEGORY METHODS
  async getCategories(userId: string): Promise<Category[]> {
    const db = await readDb();
    return db.categories.filter(c => c.userId === userId);
  },

  async createCategory(userId: string, cat: Omit<Category, 'id' | 'userId'>): Promise<Category> {
    const db = await readDb();
    const newCat: Category = {
      ...cat,
      id: `cat_${Math.random().toString(36).substring(2, 11)}`,
      userId
    };
    db.categories.push(newCat);
    await writeDb(db);
    return newCat;
  },

  async updateCategory(userId: string, id: string, updates: Partial<Category>): Promise<Category> {
    const db = await readDb();
    const index = db.categories.findIndex(c => c.id === id && c.userId === userId);
    if (index === -1) throw new Error("Categoria não encontrada");

    db.categories[index] = { ...db.categories[index], ...updates };
    await writeDb(db);
    return db.categories[index];
  },

  // INCOME METHODS
  async getIncomes(userId: string): Promise<Income[]> {
    const db = await readDb();
    return db.incomes.filter(i => i.userId === userId);
  },

  async createIncome(userId: string, inc: Omit<Income, 'id' | 'userId' | 'criadoEm' | 'atualizadoEm' | 'versao'>): Promise<Income> {
    const db = await readDb();
    const newInc: Income = {
      ...inc,
      id: inc.grupoRecorrencia && (inc as any).id ? (inc as any).id : `inc_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      versao: 1
    };
    db.incomes.push(newInc);
    await writeDb(db);
    return newInc;
  },

  async updateIncome(userId: string, id: string, updates: Partial<Income>): Promise<Income> {
    const db = await readDb();
    const index = db.incomes.findIndex(i => i.id === id && i.userId === userId);
    if (index === -1) throw new Error("Receita não encontrada");

    db.incomes[index] = {
      ...db.incomes[index],
      ...updates,
      atualizadoEm: new Date().toISOString(),
      versao: db.incomes[index].versao + 1
    };
    await writeDb(db);
    return db.incomes[index];
  },

  async deleteIncome(userId: string, id: string): Promise<void> {
    const db = await readDb();
    db.incomes = db.incomes.filter(i => !(i.id === id && i.userId === userId));
    await writeDb(db);
  },

  // EXPENSE METHODS
  async getExpenses(userId: string): Promise<Expense[]> {
    const db = await readDb();
    return db.expenses.filter(e => e.userId === userId);
  },

  async createExpense(userId: string, exp: Omit<Expense, 'id' | 'userId' | 'criadoEm' | 'atualizadoEm' | 'versao'>): Promise<Expense> {
    const db = await readDb();
    const newExp: Expense = {
      ...exp,
      id: exp.grupoRecorrencia && (exp as any).id ? (exp as any).id : `exp_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      versao: 1
    };
    db.expenses.push(newExp);
    await writeDb(db);
    return newExp;
  },

  async updateExpense(userId: string, id: string, updates: Partial<Expense>): Promise<Expense> {
    const db = await readDb();
    const index = db.expenses.findIndex(e => e.id === id && e.userId === userId);
    if (index === -1) throw new Error("Despesa não encontrada");

    db.expenses[index] = {
      ...db.expenses[index],
      ...updates,
      atualizadoEm: new Date().toISOString(),
      versao: db.expenses[index].versao + 1
    };
    await writeDb(db);
    return db.expenses[index];
  },

  async deleteExpense(userId: string, id: string): Promise<void> {
    const db = await readDb();
    db.expenses = db.expenses.filter(e => !(e.id === id && e.userId === userId));
    await writeDb(db);
  },

  // BUDGET METHODS
  async getMonthlyBudgets(userId: string): Promise<MonthlyBudget[]> {
    const db = await readDb();
    return db.monthly_budgets.filter(b => b.userId === userId);
  },

  async saveMonthlyBudget(userId: string, budget: Omit<MonthlyBudget, 'id' | 'userId'>, items: Omit<BudgetItem, 'id' | 'monthlyBudgetId'>[]): Promise<MonthlyBudget> {
    const db = await readDb();
    
    // Find or create monthly budget
    let mBudget = db.monthly_budgets.find(b => b.userId === userId && b.mes === budget.mes && b.ano === budget.ano);
    if (!mBudget) {
      mBudget = {
        ...budget,
        id: `bud_${Math.random().toString(36).substring(2, 11)}`,
        userId
      };
      db.monthly_budgets.push(mBudget);
    } else {
      mBudget.rendaPlanejada = budget.rendaPlanejada;
      mBudget.totalPlanejado = budget.totalPlanejado;
      mBudget.reservaPlanejada = budget.reservaPlanejada;
      mBudget.margemImprevistos = budget.margemImprevistos;
      mBudget.status = budget.status;
    }

    // Overwrite budget items for this budget
    db.budget_items = db.budget_items.filter(item => item.monthlyBudgetId !== mBudget!.id);
    
    items.forEach(item => {
      const newItem: BudgetItem = {
        ...item,
        id: `bi_${Math.random().toString(36).substring(2, 11)}`,
        monthlyBudgetId: mBudget!.id
      };
      db.budget_items.push(newItem);
    });

    await writeDb(db);
    return mBudget;
  },

  async getBudgetItems(monthlyBudgetId: string): Promise<BudgetItem[]> {
    const db = await readDb();
    return db.budget_items.filter(bi => bi.monthlyBudgetId === monthlyBudgetId);
  },

  // GOAL METHODS
  async getGoals(userId: string): Promise<Goal[]> {
    const db = await readDb();
    return db.goals.filter(g => g.userId === userId);
  },

  async createGoal(userId: string, goal: Omit<Goal, 'id' | 'userId'>): Promise<Goal> {
    const db = await readDb();
    const newGoal: Goal = {
      ...goal,
      id: `goal_${Math.random().toString(36).substring(2, 11)}`,
      userId
    };
    db.goals.push(newGoal);
    await writeDb(db);
    return newGoal;
  },

  async updateGoal(userId: string, id: string, updates: Partial<Goal>): Promise<Goal> {
    const db = await readDb();
    const index = db.goals.findIndex(g => g.id === id && g.userId === userId);
    if (index === -1) throw new Error("Meta não encontrada");

    db.goals[index] = { ...db.goals[index], ...updates };
    await writeDb(db);
    return db.goals[index];
  },

  async deleteGoal(userId: string, id: string): Promise<void> {
    const db = await readDb();
    db.goals = db.goals.filter(g => !(g.id === id && g.userId === userId));
    db.goal_contributions = db.goal_contributions.filter(c => c.goalId !== id);
    await writeDb(db);
  },

  async createGoalContribution(userId: string, contrib: Omit<GoalContribution, 'id' | 'userId'>): Promise<GoalContribution> {
    const db = await readDb();
    const newContrib: GoalContribution = {
      ...contrib,
      id: `con_${Math.random().toString(36).substring(2, 11)}`,
      userId
    };
    db.goal_contributions.push(newContrib);

    // Update goal accumulated value
    const goalIndex = db.goals.findIndex(g => g.id === contrib.goalId && g.userId === userId);
    if (goalIndex !== -1) {
      db.goals[goalIndex].valorAcumulado += contrib.valor;
      if (db.goals[goalIndex].valorAcumulado >= db.goals[goalIndex].valorDesejado) {
        db.goals[goalIndex].status = 'concluida';
      }
    }

    await writeDb(db);
    return newContrib;
  },

  async getGoalContributions(userId: string, goalId: string): Promise<GoalContribution[]> {
    const db = await readDb();
    return db.goal_contributions.filter(c => c.userId === userId && c.goalId === goalId);
  },

  // NOTIFICATION METHODS
  async getNotifications(userId: string): Promise<Notification[]> {
    const db = await readDb();
    return db.notifications.filter(n => n.userId === userId);
  },

  async createNotification(userId: string, notif: Omit<Notification, 'id' | 'userId' | 'data' | 'lida'>): Promise<Notification> {
    const db = await readDb();
    const newNotif: Notification = {
      ...notif,
      id: `not_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      data: new Date().toISOString(),
      lida: false
    };
    db.notifications.push(newNotif);
    await writeDb(db);
    return newNotif;
  },

  async markNotificationAsRead(userId: string, id: string): Promise<void> {
    const db = await readDb();
    const notif = db.notifications.find(n => n.id === id && n.userId === userId);
    if (notif) {
      notif.lida = true;
      await writeDb(db);
    }
  },

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    const db = await readDb();
    db.notifications.forEach(n => {
      if (n.userId === userId) n.lida = true;
    });
    await writeDb(db);
  },

  async deleteNotification(userId: string, id: string): Promise<void> {
    const db = await readDb();
    db.notifications = db.notifications.filter(n => !(n.id === id && n.userId === userId));
    await writeDb(db);
  },

  // AI CONVERSATION METHODS
  async getConversations(userId: string): Promise<AiConversation[]> {
    const db = await readDb();
    return db.ai_conversations.filter(c => c.userId === userId);
  },

  async createConversation(userId: string, title: string): Promise<AiConversation> {
    const db = await readDb();
    const newConv: AiConversation = {
      id: `conv_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      titulo: title,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    db.ai_conversations.push(newConv);
    await writeDb(db);
    return newConv;
  },

  async getMessages(userId: string, conversationId: string): Promise<AiMessage[]> {
    const db = await readDb();
    return db.ai_messages.filter(m => m.userId === userId && m.conversationId === conversationId);
  },

  async createMessage(userId: string, conversationId: string, papel: 'user' | 'assistant', content: string): Promise<AiMessage> {
    const db = await readDb();
    const newMessage: AiMessage = {
      id: `msg_${Math.random().toString(36).substring(2, 11)}`,
      conversationId,
      userId,
      papel,
      conteudo: content,
      criadoEm: new Date().toISOString()
    };
    db.ai_messages.push(newMessage);

    // Update conversation's atualizadoEm
    const conv = db.ai_conversations.find(c => c.id === conversationId && c.userId === userId);
    if (conv) {
      conv.atualizadoEm = new Date().toISOString();
    }

    await writeDb(db);
    return newMessage;
  },

  // SYNC OPERATIONS METHODS
  async addSyncOperations(userId: string, operations: Omit<SyncOperation, 'id' | 'userId' | 'criadoEm'>[]): Promise<void> {
    const db = await readDb();
    operations.forEach(op => {
      const newOp: SyncOperation = {
        ...op,
        id: `sync_${Math.random().toString(36).substring(2, 11)}`,
        userId,
        criadoEm: new Date().toISOString()
      };
      db.sync_operations.push(newOp);
    });
    await writeDb(db);
  },

  async getPendingSyncOperations(userId: string): Promise<SyncOperation[]> {
    const db = await readDb();
    return db.sync_operations.filter(s => s.userId === userId && s.status === 'pendente');
  },

  // AUDIT LOG METHODS
  async createAuditLog(userId: string, log: Omit<AuditLog, 'id' | 'userId' | 'data'>): Promise<AuditLog> {
    const db = await readDb();
    const newLog: AuditLog = {
      ...log,
      id: `aud_${Math.random().toString(36).substring(2, 11)}`,
      userId,
      data: new Date().toISOString()
    };
    db.audit_logs.push(newLog);
    await writeDb(db);
    return newLog;
  },

  // ADMIN METHODS
  async getAdminStats(): Promise<{
    usuariosTotais: number;
    usuariosAtivos: number;
    falhasSincronizacao: number;
    totalNotificacoes: number;
    mensagensIaEnviadas: number;
    logsRecentes: AuditLog[];
    usersList: { id: string; nome: string; email: string; dataCriacao: string; status: string; ultimoAcesso?: string }[];
  }> {
    const db = await readDb();
    const uniqueActiveUserIds = new Set(db.audit_logs.map(log => log.userId));
    
    return {
      usuariosTotais: db.users.length,
      usuariosAtivos: uniqueActiveUserIds.size,
      falhasSincronizacao: db.sync_operations.filter(s => s.status === 'erro').length,
      totalNotificacoes: db.notifications.length,
      mensagensIaEnviadas: db.ai_messages.filter(m => m.papel === 'assistant').length,
      logsRecentes: db.audit_logs.slice(-20).reverse(),
      usersList: db.users.map(u => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        dataCriacao: u.dataCriacao,
        status: u.status,
        ultimoAcesso: u.ultimoAcesso
      }))
    };
  }
};

export const dbManager = new Proxy(localDbManager, {
  get(target, prop, receiver) {
    const isSupabase = isSupabaseConfigured();
    const supabaseMethod = isSupabase ? (supabaseDbManager as any)[prop] : null;
    const localMethod = (target as any)[prop];

    if (typeof localMethod === 'function') {
      return async function (this: any, ...args: any[]) {
        if (isSupabase && typeof supabaseMethod === 'function') {
          try {
            const result = await supabaseMethod.apply(this, args);
            // If looking up a user and they are not found in Supabase (due to previous registration RLS or database mismatch),
            // gracefully look up in localDb so the user is never locked out of their session.
            if ((prop === 'getUserByEmail' || prop === 'getUserById') && (result === null || result === undefined)) {
              console.warn(`[Supabase Lookup Fallback] User not found on Supabase for "${String(prop)}". Checking localDb as backup.`);
              return await localMethod.apply(this, args);
            }
            return result;
          } catch (error: any) {
            console.warn(`[Supabase Fallback] Method "${String(prop)}" defaulted gracefully to localDb. This is expected if Supabase tables have not been initialized yet or credentials are inactive. Error detail: ${error?.message || JSON.stringify(error)}`);
          }
        }
        return localMethod.apply(this, args);
      };
    }
    return Reflect.get(target, prop, receiver);
  }
}) as typeof localDbManager;

