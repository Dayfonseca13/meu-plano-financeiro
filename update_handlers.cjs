const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const loginSubmitReplacement = `  const handleLoginSubmit = async (e: React.FormEvent) => {
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
        throw new Error("O servidor apresentou uma falha interna.");
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
  };`;

const registerSubmitReplacement = `  const handleRegisterSubmit = async (e: React.FormEvent) => {
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
        throw new Error("O servidor apresentou uma falha interna.");
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
  };`;

const loginRegex = /const handleLoginSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?\};/m;
const registerRegex = /const handleRegisterSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?\};/m;

content = content.replace(loginRegex, loginSubmitReplacement);
content = content.replace(registerRegex, registerSubmitReplacement);

fs.writeFileSync('src/App.tsx', content, 'utf8');
