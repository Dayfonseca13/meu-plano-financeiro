const fs = require('fs');

let content = fs.readFileSync('src/db/supabaseDb.ts', 'utf8');

// We want to replace everything down to `let supabaseClient: any = null;`
// Wait, it's easier to use sed or just replace the top part.
