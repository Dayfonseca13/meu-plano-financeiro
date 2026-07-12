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

fs.writeFileSync('server.ts', content, 'utf8');
