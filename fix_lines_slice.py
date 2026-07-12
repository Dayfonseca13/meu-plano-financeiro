with open('server.ts', 'r') as f:
    lines = f.readlines()

health_code = """app.get('/api/health', (req: Request, res: Response) => {
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
"""

register_code = """app.post('/api/users/register', async (req: Request, res: Response) => {
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
"""

login_code = """app.post('/api/users/login', async (req: Request, res: Response) => {
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
"""

# Replace backwards
lines[1665:1673] = [health_code]
lines[1036:1141] = [register_code]
lines[962:1015] = [login_code]

with open('server.ts', 'w') as f:
    f.writelines(lines)

