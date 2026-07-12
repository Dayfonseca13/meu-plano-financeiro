const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// Replace /api/users/register
const registerOld = /app\.post\('\/api\/users\/register', async \(req: Request, res: Response\) => \{[\s\S]*?\}\);/m;
const registerNew = `app.post('/api/users/register', async (req: Request, res: Response) => {
  try {
    console.log("[REGISTER:01] Requisição recebida");
    
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Método não permitido.' });
    }

    const { nome, email, diaRecebimentoSalario, inicioCicloMensal, moeda } = req.body || {};
    const password = req.body?.senha || req.body?.password;

    if (!nome || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Por favor, preencha nome, e-mail e senha.'
      });
    }

    console.log("[REGISTER:02] Dados validados");

    try {
      validateServerEnv();
    } catch (envErr: any) {
      return res.status(500).json({
        success: false,
        message: 'Falha na configuração do servidor: variáveis de ambiente ausentes.'
      });
    }

    const existingUser = await dbManager.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'Este e-mail já está cadastrado.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = \`usr_\${Math.random().toString(36).substring(2, 11)}\`;
    
    const users = await dbManager.getUsers();
    const role = users.length === 0 ? 'admin' : 'user';

    console.log("[REGISTER:03] Supabase iniciado");

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
    }, id);

    console.log("[REGISTER:04] Usuário criado");

    try {
      await dbManager.createAuditLog(id, {
        acao: 'cadastro',
        entidade: 'users',
        entidadeId: id,
        dispositivo: req.headers['user-agent'] || 'Desconhecido',
        descricaoResumida: 'Usuário criou conta no Meu Plano Financeiro.'
      });
    } catch (auditErr: any) {}

    const token = jwt.sign({ userId: id, role }, JWT_SECRET, { expiresIn: '7d' });

    console.log("[REGISTER:07] Token criado");
    console.log("[REGISTER:08] Cadastro finalizado");

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        nome: newUser.nome,
        email: newUser.email,
        moeda: newUser.moeda,
        role: newUser.role,
        preferencias: newUser.preferencias,
        diaRecebimentoSalario: newUser.diaRecebimentoSalario,
        inicioCicloMensal: newUser.inicioCicloMensal,
        hasCompletedOnboarding: false
      }
    });

  } catch (error: any) {
    console.error("[REGISTER:ERRO]", {
      name: error instanceof Error ? error.name : "Erro desconhecido",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({ 
      success: false,
      message: 'Não foi possível concluir o cadastro. O servidor apresentou uma falha interna.'
    });
  }
});`;

content = content.replace(registerOld, registerNew);

const loginOld = /app\.post\('\/api\/users\/login', async \(req: Request, res: Response\) => \{[\s\S]*?\}\);/m;
const loginNew = `app.post('/api/users/login', async (req: Request, res: Response) => {
  try {
    const { email, senha, password } = req.body || {};
    const pass = senha || password;

    if (!email || !pass) {
      return res.status(400).json({ error: 'Por favor, preencha e-mail e senha.' });
    }

    const user = await dbManager.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (user.status === 'inativo') {
      return res.status(403).json({ error: 'Esta conta de teste está inativa ou suspensa.' });
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        moeda: user.moeda,
        role: user.role,
        preferencias: user.preferencias,
        diaRecebimentoSalario: user.diaRecebimentoSalario,
        inicioCicloMensal: user.inicioCicloMensal,
        hasCompletedOnboarding: user.preferencias?.hasCompletedOnboarding ?? true
      }
    });
  } catch (error: any) {
    console.error("[LOGIN:ERRO]", error);
    return res.status(500).json({ error: 'Falha interna no servidor ao efetuar o login.' });
  }
});`;

content = content.replace(loginOld, loginNew);

fs.writeFileSync('server.ts', content, 'utf8');

