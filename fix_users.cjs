const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const healthOld = /app\.get\('\/api\/health', async \(req: Request, res: Response\) => \{[\s\S]*?\}\);/m;
const healthNew = `app.get('/api/health', (req: Request, res: Response) => {
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
});`;
content = content.replace(healthOld, healthNew);

const registerOld = /app\.post\('\/api\/users\/register', async \(req: Request, res: Response\) => \{[\s\S]*?\}\);/m;
const registerNew = `app.post('/api/users/register', async (req: Request, res: Response) => {
  try {
    console.log("[REGISTER:01] Requisição recebida");
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Método não permitido.' });

    const { nome, email, diaRecebimentoSalario, inicioCicloMensal, moeda } = req.body || {};
    const password = req.body?.senha || req.body?.password;

    if (!nome || !email || !password) {
      return res.status(400).json({ success: false, message: 'Por favor, preencha nome, e-mail e senha.' });
    }
    console.log("[REGISTER:02] Dados validados");

    try { validateServerEnv(); } catch (e) {} // best effort validation

    const existingUser = await dbManager.getUserByEmail(email);
    if (existingUser) return res.status(400).json({ success: false, message: 'Este e-mail já está cadastrado.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const id = \`usr_\${Math.random().toString(36).substring(2, 11)}\`;
    
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
});`;

// Because the old regex using [\s\S]*? won't correctly match if there are nested functions with `});`, 
// let's do a replace based on actual content since we know what it looks like, or just slice by lines!
