const fs = require('fs');
let content = fs.readFileSync('src/db/supabaseDb.ts', 'utf8');

const replacement = `import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { 
  User, 
  Category, 
  Income, 
  Expense, 
  MonthlyBudget, 
  BudgetItem, 
  Goal, 
  GoalContribution, 
  Notification, 
  AuditLog, 
  AiConversation, 
  AiMessage 
} from '../types/finance.ts';

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return str.startsWith('http://') || str.startsWith('https://');
  } catch (_) {
    return false;
  }
}

export const isSupabaseConfigured = (): boolean => {
  const url = process.env.SUPABASE_URL?.trim() || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || '';
  
  return (
    !!url && 
    url !== 'SUA_SUPABASE_URL' && 
    !url.includes('SUA_') && 
    isValidUrl(url) && 
    !!key && 
    key !== 'SUA_SUPABASE_ANON_KEY' &&
    !key.includes('SUA_')
  );
};

let supabaseClient: any = null;

export const getSupabase = () => {
  if (supabaseClient) return supabaseClient;

  if (!isSupabaseConfigured()) {
    return null;
  }

  const url = process.env.SUPABASE_URL?.trim() || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || '';

  try {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
};

export const supabase = new Proxy({}, { 
  get(target, prop) { 
    const client = getSupabase(); 
    if (!client) return undefined;
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  } 
}) as SupabaseClient | any;

// Helper to log errors or throw them`;

const regex = /import \{ createClient \} from '@supabase\/supabase-js';[\s\S]*?\/\/ Helper to log errors or throw them/;
content = content.replace(regex, replacement);
fs.writeFileSync('src/db/supabaseDb.ts', content, 'utf8');
