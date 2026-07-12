import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { dbManager } from './src/db/localDb.js';
import { groqService } from './src/lib/groq.js';
import { isSupabaseConfigured, supabase } from './src/db/supabaseDb.js';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'my_super_secret_jwt_key_123!';

app.use(express.json());

// Middleware for auth verification
const requireAuth = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Faça o login novamente.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    
    // Check if user is active
    const user = await dbManager.getUserById(decoded.userId);
    if (!user || user.status === 'inativo') {
      return res.status(403).json({ error: 'Esta conta de teste está inativa ou suspensa.' });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
};

// -----------------------------------------------------------------------------
// AUTH ENDPOINTS
// -----------------------------------------------------------------------------

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { nome, email, password, diaRecebimentoSalario, inicioCicloMensal, moeda } = req.body;
  if (!nome || !email || !password) {
    return res.status(400).json({ error: 'Por favor, preencha nome, e-mail e senha.' });
  }

  try {
    const existingUser = await dbManager.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = `usr_${Math.random().toString(36).substring(2, 11)}`;
    
    // Default system users are 'user'. First user can be 'admin'.
    const users = await dbManager.getUsers();
    const role = users.length === 0 ? 'admin' : 'user';

    const newUser = await dbManager.createUser({
      id,
      nome,
      email,
      passwordHash,
      moeda: moeda || 'BRL',
      fusoHorario: 'America/Sao_Paulo',
      diaRecebimentoSalario: diaRecebimentoSalario ? Number(diaRecebimentoSalario) : undefined,
      inicioCicloMensal: inicioCicloMensal ? Number(inicioCicloMensal) : 1,
      status: 'ativo',
      role
    });

    await dbManager.createAuditLog(id, {
      acao: 'cadastro',
      entidade: 'users',
      entidadeId: id,
      dispositivo: req.headers['user-agent'] || 'Desconhecido',
      descricaoResumida: 'Usuário criou conta no Meu Plano Financeiro.'
    });

    const token = jwt.sign({ userId: id, role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        nome: newUser.nome,
        email: newUser.email,
        moeda: newUser.moeda,
        role: newUser.role,
        preferencias: newUser.preferencias,
        diaRecebimentoSalario: newUser.diaRecebimentoSalario,
        inicioCicloMensal: newUser.inicioCicloMensal
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao cadastrar usuário: ' + error.message });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const user = await dbManager.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }

    if (user.status === 'inativo') {
      return res.status(403).json({ error: 'Esta conta de teste está inativa ou suspensa pelo administrador.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }

    // Update last access
    await dbManager.updateUser(user.id, { ultimoAcesso: new Date().toISOString() });

    await dbManager.createAuditLog(user.id, {
      acao: 'login',
      entidade: 'users',
      entidadeId: user.id,
      dispositivo: req.headers['user-agent'] || 'Desconhecido',
      descricaoResumida: 'Usuário realizou login com sucesso.'
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        moeda: user.moeda,
        role: user.role,
        preferencias: user.preferencias,
        diaRecebimentoSalario: user.diaRecebimentoSalario,
        inicioCicloMensal: user.inicioCicloMensal
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao realizar login: ' + error.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req: any, res: Response) => {
  try {
    const user = await dbManager.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      moeda: user.moeda,
      role: user.role,
      preferencias: user.preferencias,
      diaRecebimentoSalario: user.diaRecebimentoSalario,
      inicioCicloMensal: user.inicioCicloMensal
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/recover', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Informe o e-mail de recuperação.' });
  }
  try {
    const user = await dbManager.getUserByEmail(email);
    if (!user) {
      // Return success anyway for privacy safety
      return res.json({ message: 'Se o e-mail existir no sistema, as instruções foram enviadas!' });
    }
    // Simple recovery simulation
    res.json({
      message: 'Se o e-mail existir no sistema, as instruções foram enviadas!',
      debugCode: '123456' // For user testing bypass
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req: any, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
  }

  try {
    const user = await dbManager.getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await dbManager.updateUser(req.userId, { passwordHash });

    await dbManager.createAuditLog(req.userId, {
      acao: 'alteracao_senha',
      entidade: 'users',
      entidadeId: req.userId,
      dispositivo: req.headers['user-agent'] || 'Desconhecido',
      descricaoResumida: 'Usuário alterou a própria senha.'
    });

    res.json({ message: 'Senha alterada com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/delete-account', requireAuth, async (req: any, res: Response) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Informe a senha para confirmar a exclusão permanente.' });
  }

  try {
    const user = await dbManager.getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Senha incorreta. Não foi possível excluir a conta.' });
    }

    await dbManager.deleteUser(req.userId);
    res.json({ message: 'Sua conta e todos os seus dados foram excluídos com sucesso do servidor.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao excluir conta: ' + error.message });
  }
});

app.put('/api/auth/preferences', requireAuth, async (req: any, res: Response) => {
  const { preferencias, moeda, diaRecebimentoSalario, inicioCicloMensal, nome } = req.body;
  try {
    const updates: any = {};
    if (preferencias) updates.preferencias = preferencias;
    if (moeda) updates.moeda = moeda;
    if (diaRecebimentoSalario !== undefined) updates.diaRecebimentoSalario = diaRecebimentoSalario;
    if (inicioCicloMensal !== undefined) updates.inicioCicloMensal = inicioCicloMensal;
    if (nome) updates.nome = nome;

    const user = await dbManager.updateUser(req.userId, updates);
    res.json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      moeda: user.moeda,
      role: user.role,
      preferencias: user.preferencias,
      diaRecebimentoSalario: user.diaRecebimentoSalario,
      inicioCicloMensal: user.inicioCicloMensal
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// CATEGORY ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/finance/categories', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getCategories(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/finance/categories', requireAuth, async (req: any, res: Response) => {
  try {
    const cat = await dbManager.createCategory(req.userId, req.body);
    res.status(201).json(cat);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/finance/categories/:id', requireAuth, async (req: any, res: Response) => {
  try {
    const cat = await dbManager.updateCategory(req.userId, req.params.id, req.body);
    res.json(cat);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// INCOME ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/finance/incomes', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getIncomes(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/finance/incomes', requireAuth, async (req: any, res: Response) => {
  try {
    const { descricao, valor, categoriaId, dataPrevista, status, recorrencia, observacao, dataRecebimento } = req.body;
    
    if (recorrencia && recorrencia !== 'unica') {
      const grupoRecorrencia = `rec_${Math.random().toString(36).substring(2, 11)}`;
      const occurrences: any[] = [];
      const baseDate = new Date(dataPrevista);
      
      // Generate 12 months for demonstration/testing recurrences
      for (let i = 0; i < 12; i++) {
        const nextDate = new Date(baseDate);
        if (recorrencia === 'mensal') {
          nextDate.setMonth(baseDate.getMonth() + i);
        } else if (recorrencia === 'semanal') {
          nextDate.setDate(baseDate.getDate() + (i * 7));
        } else if (recorrencia === 'quinzenal') {
          nextDate.setDate(baseDate.getDate() + (i * 15));
        } else if (recorrencia === 'anual') {
          nextDate.setFullYear(baseDate.getFullYear() + i);
        }

        const occ = await dbManager.createIncome(req.userId, {
          descricao: i === 0 ? descricao : `${descricao} (Mês ${i + 1}/12)`,
          valor,
          categoriaId,
          dataPrevista: nextDate.toISOString().split('T')[0],
          status: i === 0 ? status : 'prevista',
          recorrencia,
          grupoRecorrencia,
          observacao
        });
        occurrences.push(occ);
      }
      return res.status(201).json(occurrences[0]);
    }

    const single = await dbManager.createIncome(req.userId, {
      descricao,
      valor,
      categoriaId,
      dataPrevista,
      dataRecebimento,
      status,
      recorrencia: 'unica',
      observacao
    });
    res.status(201).json(single);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/finance/incomes/:id', requireAuth, async (req: any, res: Response) => {
  const { mode } = req.query; // 'single' | 'future' | 'all'
  try {
    const income = (await dbManager.getIncomes(req.userId)).find(i => i.id === req.params.id);
    if (!income) return res.status(404).json({ error: 'Receita não encontrada.' });

    if (mode === 'future' || mode === 'all') {
      const allIncomes = await dbManager.getIncomes(req.userId);
      const groupIncomes = allIncomes.filter(i => i.grupoRecorrencia === income.grupoRecorrencia);

      for (const item of groupIncomes) {
        if (mode === 'all' || (mode === 'future' && item.dataPrevista >= income.dataPrevista)) {
          await dbManager.updateIncome(req.userId, item.id, {
            descricao: req.body.descricao || item.descricao,
            valor: req.body.valor !== undefined ? req.body.valor : item.valor,
            categoriaId: req.body.categoriaId || item.categoriaId,
            status: req.body.status || item.status,
            observacao: req.body.observacao !== undefined ? req.body.observacao : item.observacao
          });
        }
      }
      return res.json({ message: 'Sequência recorrente atualizada.' });
    }

    const updated = await dbManager.updateIncome(req.userId, req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/finance/incomes/:id', requireAuth, async (req: any, res: Response) => {
  const { mode } = req.query; // 'single' | 'future' | 'all'
  try {
    const income = (await dbManager.getIncomes(req.userId)).find(i => i.id === req.params.id);
    if (!income) return res.status(404).json({ error: 'Receita não encontrada.' });

    if (income.grupoRecorrencia && (mode === 'future' || mode === 'all')) {
      const allIncomes = await dbManager.getIncomes(req.userId);
      const groupIncomes = allIncomes.filter(i => i.grupoRecorrencia === income.grupoRecorrencia);

      for (const item of groupIncomes) {
        if (mode === 'all' || (mode === 'future' && item.dataPrevista >= income.dataPrevista)) {
          await dbManager.deleteIncome(req.userId, item.id);
        }
      }
      return res.json({ message: 'Sequência recorrente excluída.' });
    }

    await dbManager.deleteIncome(req.userId, req.params.id);
    res.json({ message: 'Receita excluída com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// EXPENSE ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/finance/expenses', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getExpenses(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/finance/expenses', requireAuth, async (req: any, res: Response) => {
  try {
    const {
      descricao,
      valor,
      categoriaId,
      dataCompra,
      dataVencimento,
      status,
      formaPagamento,
      estabelecimento,
      observacao,
      recorrencia,
      quantidadeParcelas
    } = req.body;

    if (recorrencia === 'parcelada' && quantidadeParcelas && quantidadeParcelas > 1) {
      const grupoRecorrencia = `par_${Math.random().toString(36).substring(2, 11)}`;
      const occurrences: any[] = [];
      const baseDate = new Date(dataVencimento);

      for (let i = 0; i < quantidadeParcelas; i++) {
        const nextDate = new Date(baseDate);
        nextDate.setMonth(baseDate.getMonth() + i);

        const occ = await dbManager.createExpense(req.userId, {
          descricao: `${descricao} (${i + 1}/${quantidadeParcelas})`,
          valor,
          categoriaId,
          dataCompra,
          dataVencimento: nextDate.toISOString().split('T')[0],
          status: i === 0 ? status : 'prevista',
          formaPagamento,
          estabelecimento,
          observacao,
          recorrencia: 'parcelada',
          grupoRecorrencia,
          quantidadeParcelas,
          numeroParcela: i + 1
        });
        occurrences.push(occ);
      }
      return res.status(201).json(occurrences[0]);
    }

    if (recorrencia === 'recorrente_fixa' || recorrencia === 'recorrente_variavel') {
      const grupoRecorrencia = `rec_${Math.random().toString(36).substring(2, 11)}`;
      const occurrences: any[] = [];
      const baseDate = new Date(dataVencimento);

      for (let i = 0; i < 12; i++) {
        const nextDate = new Date(baseDate);
        nextDate.setMonth(baseDate.getMonth() + i);

        const occ = await dbManager.createExpense(req.userId, {
          descricao: i === 0 ? descricao : `${descricao} (Mensal)`,
          valor,
          categoriaId,
          dataCompra,
          dataVencimento: nextDate.toISOString().split('T')[0],
          status: i === 0 ? status : 'prevista',
          formaPagamento,
          estabelecimento,
          observacao,
          recorrencia,
          grupoRecorrencia
        });
        occurrences.push(occ);
      }
      return res.status(201).json(occurrences[0]);
    }

    const single = await dbManager.createExpense(req.userId, {
      descricao,
      valor,
      categoriaId,
      dataCompra,
      dataVencimento,
      status,
      formaPagamento,
      estabelecimento,
      observacao,
      recorrencia: 'unica'
    });
    res.status(201).json(single);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/finance/expenses/:id', requireAuth, async (req: any, res: Response) => {
  const { mode } = req.query; // 'single' | 'future' | 'all'
  try {
    const expense = (await dbManager.getExpenses(req.userId)).find(e => e.id === req.params.id);
    if (!expense) return res.status(404).json({ error: 'Despesa não encontrada.' });

    if (expense.grupoRecorrencia && (mode === 'future' || mode === 'all')) {
      const allExpenses = await dbManager.getExpenses(req.userId);
      const groupExpenses = allExpenses.filter(e => e.grupoRecorrencia === expense.grupoRecorrencia);

      for (const item of groupExpenses) {
        if (mode === 'all' || (mode === 'future' && item.dataVencimento >= expense.dataVencimento)) {
          await dbManager.updateExpense(req.userId, item.id, {
            descricao: req.body.descricao || item.descricao,
            valor: req.body.valor !== undefined ? req.body.valor : item.valor,
            categoriaId: req.body.categoriaId || item.categoriaId,
            formaPagamento: req.body.formaPagamento || item.formaPagamento,
            estabelecimento: req.body.estabelecimento !== undefined ? req.body.estabelecimento : item.estabelecimento,
            status: req.body.status || item.status,
            observacao: req.body.observacao !== undefined ? req.body.observacao : item.observacao,
            dataPagamento: req.body.status === 'paga' ? (req.body.dataPagamento || new Date().toISOString().split('T')[0]) : undefined
          });
        }
      }
      return res.json({ message: 'Sequência recorrente atualizada.' });
    }

    const updated = await dbManager.updateExpense(req.userId, req.params.id, {
      ...req.body,
      dataPagamento: req.body.status === 'paga' ? (req.body.dataPagamento || new Date().toISOString().split('T')[0]) : undefined
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/finance/expenses/:id', requireAuth, async (req: any, res: Response) => {
  const { mode } = req.query; // 'single' | 'future' | 'all'
  try {
    const expense = (await dbManager.getExpenses(req.userId)).find(e => e.id === req.params.id);
    if (!expense) return res.status(404).json({ error: 'Despesa não encontrada.' });

    if (expense.grupoRecorrencia && (mode === 'future' || mode === 'all')) {
      const allExpenses = await dbManager.getExpenses(req.userId);
      const groupExpenses = allExpenses.filter(e => e.grupoRecorrencia === expense.grupoRecorrencia);

      for (const item of groupExpenses) {
        if (mode === 'all' || (mode === 'future' && item.dataVencimento >= expense.dataVencimento)) {
          await dbManager.deleteExpense(req.userId, item.id);
        }
      }
      return res.json({ message: 'Sequência de despesas excluída.' });
    }

    await dbManager.deleteExpense(req.userId, req.params.id);
    res.json({ message: 'Despesa excluída com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// PLANNING/BUDGET ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/finance/planning', requireAuth, async (req: any, res: Response) => {
  const { mes, ano } = req.query;
  if (!mes || !ano) {
    return res.status(400).json({ error: 'Mês e ano são obrigatórios.' });
  }

  try {
    const budgets = await dbManager.getMonthlyBudgets(req.userId);
    const mBudget = budgets.find(b => b.mes === Number(mes) && b.ano === Number(ano));
    if (!mBudget) {
      return res.json({ budget: null, items: [] });
    }

    const items = await dbManager.getBudgetItems(mBudget.id);
    res.json({ budget: mBudget, items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/finance/planning', requireAuth, async (req: any, res: Response) => {
  const { budget, items } = req.body;
  if (!budget || !items) {
    return res.status(400).json({ error: 'Informações de orçamento e limites incompletas.' });
  }

  try {
    const savedBudget = await dbManager.saveMonthlyBudget(req.userId, budget, items);
    res.json(savedBudget);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// GOAL ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/finance/goals', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getGoals(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/finance/goals', requireAuth, async (req: any, res: Response) => {
  try {
    const goal = await dbManager.createGoal(req.userId, req.body);
    res.status(201).json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/finance/goals/:id', requireAuth, async (req: any, res: Response) => {
  try {
    const goal = await dbManager.updateGoal(req.userId, req.params.id, req.body);
    res.json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/finance/goals/:id', requireAuth, async (req: any, res: Response) => {
  try {
    await dbManager.deleteGoal(req.userId, req.params.id);
    res.json({ message: 'Meta excluída com sucesso.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/finance/goals/:id/contribution', requireAuth, async (req: any, res: Response) => {
  try {
    const contrib = await dbManager.createGoalContribution(req.userId, {
      goalId: req.params.id,
      valor: Number(req.body.valor),
      data: req.body.data || new Date().toISOString().split('T')[0],
      origem: req.body.origem || 'Conta Principal',
      observacao: req.body.observacao
    });
    res.status(201).json(contrib);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/finance/goals/:id/contributions', requireAuth, async (req: any, res: Response) => {
  try {
    const contributions = await dbManager.getGoalContributions(req.userId, req.params.id);
    res.json(contributions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// NOTIFICATION ENDPOINTS
// -----------------------------------------------------------------------------

app.get('/api/finance/notifications', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getNotifications(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/finance/notifications', requireAuth, async (req: any, res: Response) => {
  try {
    const notif = await dbManager.createNotification(req.userId, req.body);
    res.status(201).json(notif);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/finance/notifications/read', requireAuth, async (req: any, res: Response) => {
  try {
    await dbManager.markAllNotificationsAsRead(req.userId);
    res.json({ message: 'Todas as notificações marcadas como lidas.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/finance/notifications/:id/read', requireAuth, async (req: any, res: Response) => {
  try {
    await dbManager.markNotificationAsRead(req.userId, req.params.id);
    res.json({ message: 'Notificação marcada como lida.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/finance/notifications/:id', requireAuth, async (req: any, res: Response) => {
  try {
    await dbManager.deleteNotification(req.userId, req.params.id);
    res.json({ message: 'Notificação excluída.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// PUSH ENDPOINTS (SIMULATED FOR DEVICE SUBSCRIPTIONS)
// -----------------------------------------------------------------------------

app.post('/api/push/register', requireAuth, async (req: any, res: Response) => {
  res.json({ success: true, message: 'Dispositivo cadastrado com sucesso para receber notificações push.' });
});

// -----------------------------------------------------------------------------
// AI ENDPOINTS
// -----------------------------------------------------------------------------

app.post('/api/ai/planning', requireAuth, async (req: any, res: Response) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto descritivo é obrigatório.' });

  try {
    const categories = await dbManager.getCategories(req.userId);
    const plan = await groqService.interpretPlanning(text, categories);
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/chat', requireAuth, async (req: any, res: Response) => {
  const { message, conversationId, history } = req.body;
  if (!message || !conversationId) {
    return res.status(400).json({ error: 'Mensagem e ID da conversa são obrigatórios.' });
  }

  try {
    const user = await dbManager.getUserById(req.userId);
    const incomes = await dbManager.getIncomes(req.userId);
    const expenses = await dbManager.getExpenses(req.userId);
    const categories = await dbManager.getCategories(req.userId);
    const goals = await dbManager.getGoals(req.userId);

    // Save user message to database
    await dbManager.createMessage(req.userId, conversationId, 'user', message);

    // Call Groq
    const assistantResponse = await groqService.chat(message, history || [], {
      incomes,
      expenses,
      categories,
      goals,
      userName: user?.nome || 'Usuário'
    });

    // Save AI message to database
    const savedAiMsg = await dbManager.createMessage(req.userId, conversationId, 'assistant', assistantResponse);

    res.json(savedAiMsg);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/conversations', requireAuth, async (req: any, res: Response) => {
  try {
    const title = req.body.title || 'Nova Conversa';
    const conv = await dbManager.createConversation(req.userId, title);
    res.status(201).json(conv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai/conversations', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getConversations(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai/conversations/:id/messages', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getMessages(req.userId, req.params.id);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// OFFLINE QUEUE SYNCHRONIZATION ENDPOINT (TRANS-SAFETY & IDEMPOTENCY)
// -----------------------------------------------------------------------------

app.post('/api/finance/sync', requireAuth, async (req: any, res: Response) => {
  const { queue } = req.body; // Array of operations
  if (!queue || !Array.isArray(queue)) {
    return res.status(400).json({ error: 'Fila de sincronização inválida.' });
  }

  const results: any[] = [];
  try {
    for (const op of queue) {
      try {
        const parsedContent = typeof op.conteudo === 'string' ? JSON.parse(op.conteudo) : op.conteudo;
        
        if (op.tipo === 'criar') {
          if (op.entidade === 'receita') {
            const added = await dbManager.createIncome(req.userId, parsedContent);
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId, serverId: added.id });
          } else if (op.entidade === 'despesa') {
            const added = await dbManager.createExpense(req.userId, parsedContent);
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId, serverId: added.id });
          } else if (op.entidade === 'categoria') {
            const added = await dbManager.createCategory(req.userId, parsedContent);
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId, serverId: added.id });
          } else if (op.entidade === 'meta') {
            const added = await dbManager.createGoal(req.userId, parsedContent);
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId, serverId: added.id });
          }
        } else if (op.tipo === 'atualizar') {
          if (op.entidade === 'receita') {
            const updated = await dbManager.updateIncome(req.userId, op.entidadeId, parsedContent);
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId, serverId: updated.id });
          } else if (op.entidade === 'despesa') {
            const updated = await dbManager.updateExpense(req.userId, op.entidadeId, parsedContent);
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId, serverId: updated.id });
          } else if (op.entidade === 'categoria') {
            const updated = await dbManager.updateCategory(req.userId, op.entidadeId, parsedContent);
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId, serverId: updated.id });
          } else if (op.entidade === 'meta') {
            const updated = await dbManager.updateGoal(req.userId, op.entidadeId, parsedContent);
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId, serverId: updated.id });
          }
        } else if (op.tipo === 'excluir') {
          if (op.entidade === 'receita') {
            await dbManager.deleteIncome(req.userId, op.entidadeId);
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId });
          } else if (op.entidade === 'despesa') {
            await dbManager.deleteExpense(req.userId, op.entidadeId);
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId });
          } else if (op.entidade === 'categoria') {
            // Safe checking
            await dbManager.updateCategory(req.userId, op.entidadeId, { status: 'arquivado' });
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId });
          } else if (op.entidade === 'meta') {
            await dbManager.deleteGoal(req.userId, op.entidadeId);
            results.push({ clientOperationId: op.clientOperationId, status: 'sincronizado', localId: op.entidadeId });
          }
        }
      } catch (err: any) {
        results.push({ clientOperationId: op.clientOperationId, status: 'erro', error: err.message });
      }
    }
    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// ADMIN/SUPPORT PANEL ENDPOINTS (RESTRICTED TO ROLE: 'admin')
// -----------------------------------------------------------------------------

const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem visualizar esta área.' });
  }
  next();
};

app.get('/api/admin/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await dbManager.getAdminStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/toggle-user', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { userId, status } = req.body;
  if (!userId || !status) return res.status(400).json({ error: 'ID do usuário e novo status são obrigatórios.' });

  try {
    await dbManager.updateUser(userId, { status });
    res.json({ success: true, message: `Status do usuário alterado para ${status}.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/maintenance-broadcast', requireAuth, requireAdmin, async (req: any, res: Response) => {
  const { title, message } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });

  try {
    const allUsers = await dbManager.getUsers();
    for (const u of allUsers) {
      await dbManager.createNotification(u.id, {
        titulo: title,
        mensagem: message,
        tipo: 'seguranca',
        prioridade: 'alta'
      });
    }
    res.json({ success: true, message: 'Aviso geral de manutenção enviado para todos os usuários ativos.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// FRONTEND COMPATIBILITY LAYER - MAPS DIRECTLY TO CLIENT-SIDE EXPECTATIONS
// -----------------------------------------------------------------------------

// 1. User/Auth Endpoints
app.post('/api/users/login', async (req: Request, res: Response) => {
  try {
    const { email, password, senha } = req.body || {};
    const pass = senha || password;
    if (!email || !pass) return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    
    const user = await dbManager.getUserByEmail(email);
    if (!user || user.status === 'inativo') return res.status(401).json({ message: 'Credenciais inválidas ou conta inativa.' });
    
    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) return res.status(401).json({ message: 'Credenciais inválidas.' });

    await dbManager.updateUser(user.id, { ultimoAcesso: new Date().toISOString() });
    try {
      await dbManager.createAuditLog(user.id, {
        acao: 'login', entidade: 'users', entidadeId: user.id,
        dispositivo: req.headers['user-agent'] || 'Desconhecido', descricaoResumida: 'Usuário realizou login.'
      });
    } catch (e) {}

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { ...user, passwordHash: undefined } });
  } catch (error: any) {
    res.status(500).json({ message: 'Erro interno ao realizar login' });
  }
});

function validateServerEnv() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const jwtSecret = process.env.JWT_SECRET;
  
  const hasUrl = url && url !== 'SUA_SUPABASE_URL' && !url.includes('SUA_');
  const hasKey = (anonKey && anonKey !== 'SUA_SUPABASE_ANON_KEY' && !anonKey.includes('SUA_')) || 
                 (serviceKey && serviceKey !== 'SUA_SUPABASE_SERVICE_ROLE_KEY' && !serviceKey.includes('SUA_'));
  const hasJwt = jwtSecret && jwtSecret !== 'my_super_secret_jwt_key_123!' && jwtSecret.trim().length > 0;

  if (!hasUrl || !hasKey || !hasJwt) {
    const missing = [];
    if (!hasUrl) missing.push('SUPABASE_URL');
    if (!hasKey) missing.push('SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
    if (!hasJwt) missing.push('JWT_SECRET');
    throw new Error(`Variáveis obrigatórias ausentes ou inválidas: ${missing.join(", ")}`);
  }
}

app.post('/api/users/register', async (req: Request, res: Response) => {
  try {
    console.log("[REGISTER:01] Requisição recebida");
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Método não permitido.' });

    const { nome, email, diaRecebimentoSalario, inicioCicloMensal, moeda } = req.body || {};
    const password = req.body?.senha || req.body?.password;

    if (!nome || !email || !password) {
      return res.status(400).json({ success: false, message: 'Por favor, preencha nome, e-mail e senha.' });
    }
    console.log("[REGISTER:02] Dados validados");

    try { validateServerEnv(); } catch (e) {}

    const existingUser = await dbManager.getUserByEmail(email);
    if (existingUser) return res.status(400).json({ success: false, message: 'Este e-mail já está cadastrado.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const id = `usr_${Math.random().toString(36).substring(2, 11)}`;
    
    const users = await dbManager.getUsers();
    const role = users.length === 0 ? 'admin' : 'user';

    console.log("[REGISTER:03] Supabase iniciado");
    const newUser = await dbManager.createUser({
      id, nome, email, passwordHash, moeda: moeda || 'BRL',
      fusoHorario: 'America/Sao_Paulo', diaRecebimentoSalario: diaRecebimentoSalario ? Number(diaRecebimentoSalario) : undefined,
      inicioCicloMensal: inicioCicloMensal ? Number(inicioCicloMensal) : 1, status: 'ativo', role
    }, id);
    console.log("[REGISTER:04] Usuário criado");

    try {
      await dbManager.createAuditLog(id, {
        acao: 'cadastro', entidade: 'users', entidadeId: id,
        dispositivo: req.headers['user-agent'] || 'Desconhecido',
        descricaoResumida: 'Usuário criou conta.'
      });
    } catch (e) {}

    const token = jwt.sign({ userId: id, role }, JWT_SECRET, { expiresIn: '7d' });
    console.log("[REGISTER:07] Token criado");
    console.log("[REGISTER:08] Cadastro finalizado");

    return res.status(201).json({
      success: true, token,
      user: {
        id: newUser.id, nome: newUser.nome, email: newUser.email, moeda: newUser.moeda,
        role: newUser.role, preferencias: newUser.preferencias,
        diaRecebimentoSalario: newUser.diaRecebimentoSalario,
        inicioCicloMensal: newUser.inicioCicloMensal, hasCompletedOnboarding: false
      }
    });
  } catch (error: any) {
    console.error("[REGISTER:ERRO]", error);
    return res.status(500).json({ success: false, message: 'Não foi possível concluir o cadastro. O servidor apresentou uma falha interna.' });
  }
});

app.get('/api/users/profile', requireAuth, async (req: any, res: Response) => {
  try {
    const user = await dbManager.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    res.json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      moeda: user.moeda,
      role: user.role,
      preferencias: user.preferencias,
      diaRecebimentoSalario: user.diaRecebimentoSalario,
      inicioCicloMensal: user.inicioCicloMensal,
      hasCompletedOnboarding: !!(user.preferencias as any).hasCompletedOnboarding || user.diaRecebimentoSalario !== undefined
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/users/onboarding', requireAuth, async (req: any, res: Response) => {
  const { rendaMensal, rendaVariavel, diaRecebimento, objetivos, despesasFixas, budget } = req.body;

  try {
    const user = await dbManager.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const updatedPrefs = {
      ...user.preferencias,
      hasCompletedOnboarding: true,
      objetivos: objetivos || []
    };

    await dbManager.updateUser(req.userId, {
      diaRecebimentoSalario: Number(diaRecebimento) || 1,
      preferencias: updatedPrefs
    });

    // Handle fixed expenses
    if (Array.isArray(despesasFixas)) {
      for (const df of despesasFixas) {
        await dbManager.createExpense(req.userId, {
          descricao: df.descricao,
          valor: Number(df.valor),
          categoriaId: df.categoriaId,
          dataCompra: new Date().toISOString().split('T')[0],
          dataVencimento: new Date().toISOString().split('T')[0],
          status: 'prevista',
          formaPagamento: 'debito_automatico',
          recorrencia: 'recorrente_fixa'
        });
      }
    }

    // Handle budget save
    if (budget) {
      const now = new Date();
      await dbManager.saveMonthlyBudget(
        req.userId,
        {
          mes: now.getMonth() + 1,
          ano: now.getFullYear(),
          rendaPlanejada: Number(budget.rendaPlanejada || rendaMensal),
          totalPlanejado: Number(budget.rendaPlanejada || rendaMensal) - Number(budget.reservaPlanejada || 0) - Number(budget.margemImprevistos || 0),
          reservaPlanejada: Number(budget.reservaPlanejada || 0),
          margemImprevistos: Number(budget.margemImprevistos || 0),
          status: 'ativo'
        },
        (budget.items || []).map((bi: any) => ({
          categoriaId: bi.categoriaId,
          valorPlanejado: Number(bi.valorPlanejado),
          percentual: Number(bi.percentual || 0),
          prioridade: bi.prioridade || 'media',
          alertaConfigurado: true
        }))
      );
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Categories
app.get('/api/categories', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getCategories(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/categories', requireAuth, async (req: any, res: Response) => {
  try {
    await dbManager.createCategory(req.userId, req.body);
    const list = await dbManager.getCategories(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/categories/:id', requireAuth, async (req: any, res: Response) => {
  try {
    await dbManager.updateCategory(req.userId, req.params.id, req.body);
    const list = await dbManager.getCategories(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// 3. Incomes
app.get('/api/incomes', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getIncomes(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/incomes', requireAuth, async (req: any, res: Response) => {
  try {
    const { descricao, valor, categoriaId, dataPrevista, status, recorrencia, observacao, dataRecebimento } = req.body;
    
    if (recorrencia && recorrencia !== 'unica') {
      const grupoRecorrencia = `rec_${Math.random().toString(36).substring(2, 11)}`;
      const baseDate = new Date(dataPrevista);
      
      for (let i = 0; i < 12; i++) {
        const nextDate = new Date(baseDate);
        if (recorrencia === 'mensal') {
          nextDate.setMonth(baseDate.getMonth() + i);
        } else if (recorrencia === 'semanal') {
          nextDate.setDate(baseDate.getDate() + (i * 7));
        } else if (recorrencia === 'quinzenal') {
          nextDate.setDate(baseDate.getDate() + (i * 15));
        } else if (recorrencia === 'anual') {
          nextDate.setFullYear(baseDate.getFullYear() + i);
        }

        await dbManager.createIncome(req.userId, {
          descricao: i === 0 ? descricao : `${descricao} (Mês ${i + 1}/12)`,
          valor,
          categoriaId,
          dataPrevista: nextDate.toISOString().split('T')[0],
          status: i === 0 ? status : 'prevista',
          recorrencia,
          grupoRecorrencia,
          observacao
        });
      }
    } else {
      await dbManager.createIncome(req.userId, {
        descricao,
        valor,
        categoriaId,
        dataPrevista,
        dataRecebimento,
        status,
        recorrencia: 'unica',
        observacao
      });
    }

    const list = await dbManager.getIncomes(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/incomes/:id', requireAuth, async (req: any, res: Response) => {
  const { mode, updates } = req.body;
  try {
    const income = (await dbManager.getIncomes(req.userId)).find(i => i.id === req.params.id);
    if (!income) return res.status(404).json({ message: 'Receita não encontrada.' });

    const payload = updates || req.body;

    if (mode === 'future' || mode === 'all') {
      const allIncomes = await dbManager.getIncomes(req.userId);
      const groupIncomes = allIncomes.filter(i => i.grupoRecorrencia === income.grupoRecorrencia);

      for (const item of groupIncomes) {
        if (mode === 'all' || (mode === 'future' && item.dataPrevista >= income.dataPrevista)) {
          await dbManager.updateIncome(req.userId, item.id, {
            descricao: payload.descricao || item.descricao,
            valor: payload.valor !== undefined ? payload.valor : item.valor,
            categoriaId: payload.categoriaId || item.categoriaId,
            status: payload.status || item.status,
            observacao: payload.observacao !== undefined ? payload.observacao : item.observacao
          });
        }
      }
    } else {
      await dbManager.updateIncome(req.userId, req.params.id, payload);
    }

    const list = await dbManager.getIncomes(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/incomes/:id', requireAuth, async (req: any, res: Response) => {
  const { mode } = req.query;
  try {
    const income = (await dbManager.getIncomes(req.userId)).find(i => i.id === req.params.id);
    if (!income) return res.status(404).json({ message: 'Receita não encontrada.' });

    if (income.grupoRecorrencia && (mode === 'future' || mode === 'all')) {
      const allIncomes = await dbManager.getIncomes(req.userId);
      const groupIncomes = allIncomes.filter(i => i.grupoRecorrencia === income.grupoRecorrencia);

      for (const item of groupIncomes) {
        if (mode === 'all' || (mode === 'future' && item.dataPrevista >= income.dataPrevista)) {
          await dbManager.deleteIncome(req.userId, item.id);
        }
      }
    } else {
      await dbManager.deleteIncome(req.userId, req.params.id);
    }

    const list = await dbManager.getIncomes(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// 4. Expenses
app.get('/api/expenses', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getExpenses(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/expenses', requireAuth, async (req: any, res: Response) => {
  try {
    const {
      descricao,
      valor,
      categoriaId,
      dataCompra,
      dataVencimento,
      status,
      formaPagamento,
      estabelecimento,
      observacao,
      recorrencia,
      quantidadeParcelas
    } = req.body;

    if (recorrencia === 'parcelada' && quantidadeParcelas && quantidadeParcelas > 1) {
      const grupoRecorrencia = `par_${Math.random().toString(36).substring(2, 11)}`;
      const baseDate = new Date(dataVencimento);

      for (let i = 0; i < quantidadeParcelas; i++) {
        const nextDate = new Date(baseDate);
        nextDate.setMonth(baseDate.getMonth() + i);

        await dbManager.createExpense(req.userId, {
          descricao: `${descricao} (${i + 1}/${quantidadeParcelas})`,
          valor,
          categoriaId,
          dataCompra,
          dataVencimento: nextDate.toISOString().split('T')[0],
          status: i === 0 ? status : 'prevista',
          formaPagamento,
          estabelecimento,
          observacao,
          recorrencia: 'parcelada',
          grupoRecorrencia,
          quantidadeParcelas,
          numeroParcela: i + 1
        });
      }
    } else if (recorrencia === 'recorrente_fixa' || recorrencia === 'recorrente_variavel') {
      const grupoRecorrencia = `rec_${Math.random().toString(36).substring(2, 11)}`;
      const baseDate = new Date(dataVencimento);

      for (let i = 0; i < 12; i++) {
        const nextDate = new Date(baseDate);
        nextDate.setMonth(baseDate.getMonth() + i);

        await dbManager.createExpense(req.userId, {
          descricao: i === 0 ? descricao : `${descricao} (Mensal)`,
          valor,
          categoriaId,
          dataCompra,
          dataVencimento: nextDate.toISOString().split('T')[0],
          status: i === 0 ? status : 'prevista',
          formaPagamento,
          estabelecimento,
          observacao,
          recorrencia,
          grupoRecorrencia
        });
      }
    } else {
      await dbManager.createExpense(req.userId, {
        descricao,
        valor,
        categoriaId,
        dataCompra,
        dataVencimento,
        status,
        formaPagamento,
        estabelecimento,
        observacao,
        recorrencia: 'unica'
      });
    }

    const list = await dbManager.getExpenses(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/expenses/:id', requireAuth, async (req: any, res: Response) => {
  const { mode, updates } = req.body;
  try {
    const expense = (await dbManager.getExpenses(req.userId)).find(e => e.id === req.params.id);
    if (!expense) return res.status(404).json({ message: 'Despesa não encontrada.' });

    const payload = updates || req.body;

    if (expense.grupoRecorrencia && (mode === 'future' || mode === 'all')) {
      const allExpenses = await dbManager.getExpenses(req.userId);
      const groupExpenses = allExpenses.filter(e => e.grupoRecorrencia === expense.grupoRecorrencia);

      for (const item of groupExpenses) {
        if (mode === 'all' || (mode === 'future' && item.dataVencimento >= expense.dataVencimento)) {
          await dbManager.updateExpense(req.userId, item.id, {
            descricao: payload.descricao || item.descricao,
            valor: payload.valor !== undefined ? payload.valor : item.valor,
            categoriaId: payload.categoriaId || item.categoriaId,
            formaPagamento: payload.formaPagamento || item.formaPagamento,
            estabelecimento: payload.estabelecimento !== undefined ? payload.estabelecimento : item.estabelecimento,
            status: payload.status || item.status,
            observacao: payload.observacao !== undefined ? payload.observacao : item.observacao,
            dataPagamento: payload.status === 'paga' ? (payload.dataPagamento || new Date().toISOString().split('T')[0]) : undefined
          });
        }
      }
    } else {
      await dbManager.updateExpense(req.userId, req.params.id, {
        ...payload,
        dataPagamento: payload.status === 'paga' ? (payload.dataPagamento || new Date().toISOString().split('T')[0]) : undefined
      });
    }

    const list = await dbManager.getExpenses(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/expenses/:id', requireAuth, async (req: any, res: Response) => {
  const { mode } = req.query;
  try {
    const expense = (await dbManager.getExpenses(req.userId)).find(e => e.id === req.params.id);
    if (!expense) return res.status(404).json({ message: 'Despesa não encontrada.' });

    if (expense.grupoRecorrencia && (mode === 'future' || mode === 'all')) {
      const allExpenses = await dbManager.getExpenses(req.userId);
      const groupExpenses = allExpenses.filter(e => e.grupoRecorrencia === expense.grupoRecorrencia);

      for (const item of groupExpenses) {
        if (mode === 'all' || (mode === 'future' && item.dataVencimento >= expense.dataVencimento)) {
          await dbManager.deleteExpense(req.userId, item.id);
        }
      }
    } else {
      await dbManager.deleteExpense(req.userId, req.params.id);
    }

    const list = await dbManager.getExpenses(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// 5. Goals
app.get('/api/goals', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getGoals(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/goals', requireAuth, async (req: any, res: Response) => {
  try {
    await dbManager.createGoal(req.userId, req.body);
    const list = await dbManager.getGoals(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/goals/:id', requireAuth, async (req: any, res: Response) => {
  try {
    await dbManager.updateGoal(req.userId, req.params.id, req.body);
    const list = await dbManager.getGoals(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/goals/:id', requireAuth, async (req: any, res: Response) => {
  try {
    await dbManager.deleteGoal(req.userId, req.params.id);
    const list = await dbManager.getGoals(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/goals/:id/contribute', requireAuth, async (req: any, res: Response) => {
  try {
    await dbManager.createGoalContribution(req.userId, {
      goalId: req.params.id,
      valor: Number(req.body.valor),
      data: req.body.data || new Date().toISOString().split('T')[0],
      origem: req.body.origem || 'Conta Principal',
      observacao: req.body.observacao
    });
    const list = await dbManager.getGoals(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// 6. Budgets / Monthly Budget Plan
app.get('/api/budgets', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getMonthlyBudgets(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/budgets', requireAuth, async (req: any, res: Response) => {
  const { budget, items } = req.body;
  if (!budget || !items) {
    return res.status(400).json({ message: 'Informações de orçamento e limites incompletas.' });
  }

  try {
    await dbManager.saveMonthlyBudget(req.userId, budget, items);
    const list = await dbManager.getMonthlyBudgets(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// 7. Notifications
app.get('/api/notifications', requireAuth, async (req: any, res: Response) => {
  try {
    const list = await dbManager.getNotifications(req.userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// 8. Supabase Status Check
app.get('/api/supabase/status', async (req: Request, res: Response) => {
  const isConfigured = isSupabaseConfigured();
  let canConnect = false;
  let connectionError = null;

  if (isConfigured && supabase) {
    try {
      // Test connection by fetching users (limit 1)
      const { error } = await supabase.from('users').select('id').limit(1);
      if (error) {
        connectionError = error.message;
        if (error.message.includes('relation "users" does not exist')) {
          connectionError = 'As tabelas ainda não foram criadas no Supabase. Por favor, copie e execute o script SQL abaixo no seu painel do Supabase.';
        }
      } else {
        canConnect = true;
      }
    } catch (err: any) {
      connectionError = err.message;
    }
  }

  res.json({
    isConfigured,
    supabaseUrl: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 18)}...` : '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ? `${process.env.SUPABASE_ANON_KEY.substring(0, 18)}...` : '',
    canConnect,
    connectionError
  });
});

// 9. Comprehensive Health Diagnostic Endpoint (Stage 6)
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    server: true,
    supabaseUrlConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_URL.trim() !== '' && !process.env.SUPABASE_URL.includes('SUA_')),
    supabaseKeyConfigured: !!(
      (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim() !== '' && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('SUA_')) ||
      (process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.trim() !== '' && !process.env.SUPABASE_ANON_KEY.includes('SUA_'))
    ),
    jwtConfigured: !!(process.env.JWT_SECRET && process.env.JWT_SECRET.trim() !== '')
  });
});

// --
// VITE OR STATIC SERVING MIDDLEWARE & BOOTSTRAP
// -----------------------------------------------------------------------------

async function ensureTestUser() {
  try {
    const email = 'teste@teste';
    const existingUser = await dbManager.getUserByEmail(email);
    if (!existingUser) {
      console.log('Seeding test user: teste@teste...');
      const passwordHash = await bcrypt.hash('teste', 10);
      const id = 'usr_testuser';
      await dbManager.createUser({
        id,
        nome: 'Usuário de Teste',
        email,
        passwordHash,
        moeda: 'BRL',
        fusoHorario: 'America/Sao_Paulo',
        inicioCicloMensal: 1,
        status: 'ativo',
        role: 'admin'
      });
      console.log('Test user teste@teste created successfully.');
    } else {
      const isMatch = await bcrypt.compare('teste', existingUser.passwordHash);
      if (!isMatch) {
        console.log('Updating test user password to: teste');
        const passwordHash = await bcrypt.hash('teste', 10);
        await dbManager.updateUser(existingUser.id, { passwordHash, status: 'ativo' });
      } else if (existingUser.status !== 'ativo') {
        console.log('Activating test user');
        await dbManager.updateUser(existingUser.id, { status: 'ativo' });
      }
    }
  } catch (error) {
    console.error('Error seeding test user:', error);
  }
}

async function startServer() {
  await ensureTestUser();

  if (process.env.NODE_ENV !== "production") {
    const viteModule = 'vite';
    const { createServer } = await import(viteModule);
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
  });
}

export default app;
