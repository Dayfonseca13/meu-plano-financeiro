const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const authRegisterOld = /app\.post\('\/api\/auth\/register', async \(req: Request, res: Response\) => \{[\s\S]*?\}\);/m;
content = content.replace(authRegisterOld, `app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { nome, email, password, diaRecebimentoSalario, inicioCicloMensal, moeda } = req.body || {};
    if (!nome || !email || !password) {
      return res.status(400).json({ error: 'Por favor, preencha nome, e-mail e senha.' });
    }
    const existingUser = await dbManager.getUserByEmail(email);
    if (existingUser) return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    const passwordHash = await bcrypt.hash(password, 10);
    const id = \`usr_\${Math.random().toString(36).substring(2, 11)}\`;
    const users = await dbManager.getUsers();
    const role = users.length === 0 ? 'admin' : 'user';
    const newUser = await dbManager.createUser({
      id, nome, email, passwordHash, moeda: moeda || 'BRL',
      fusoHorario: 'America/Sao_Paulo', diaRecebimentoSalario: diaRecebimentoSalario ? Number(diaRecebimentoSalario) : undefined,
      inicioCicloMensal: inicioCicloMensal ? Number(inicioCicloMensal) : 1, status: 'ativo', role
    });
    const token = jwt.sign({ userId: id, role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: newUser });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});`);

const authLoginOld = /app\.post\('\/api\/auth\/login', async \(req: Request, res: Response\) => \{[\s\S]*?\}\);/m;
content = content.replace(authLoginOld, `app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    const user = await dbManager.getUserByEmail(email);
    if (!user || user.status === 'inativo') return res.status(401).json({ error: 'Credenciais inválidas ou inativas.' });
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ error: 'Credenciais inválidas.' });
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro interno' });
  }
});`);

fs.writeFileSync('server.ts', content, 'utf8');
