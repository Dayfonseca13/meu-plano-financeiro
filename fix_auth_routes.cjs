const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const authRegisterOld = /app\.post\('\/api\/auth\/register', async \(req: Request, res: Response\) => \{[\s\S]*?\}\);/m;
content = content.replace(authRegisterOld, `app.post('/api/auth/register', (req, res) => { res.redirect(307, '/api/users/register'); });`);

const authLoginOld = /app\.post\('\/api\/auth\/login', async \(req: Request, res: Response\) => \{[\s\S]*?\}\);/m;
content = content.replace(authLoginOld, `app.post('/api/auth/login', (req, res) => { res.redirect(307, '/api/users/login'); });`);

fs.writeFileSync('server.ts', content, 'utf8');
