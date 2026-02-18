// src/lib/customSupabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase env vars ausentes: verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel.");
}

// ✅ Singleton único do app inteiro
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // garante persistência no browser
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

// compatibilidade com imports antigos
export default supabase;
