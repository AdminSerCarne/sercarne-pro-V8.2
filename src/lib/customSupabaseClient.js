// src/lib/customSupabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dwnxvilbdxdqsuhfexuq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3bnh2aWxiZHhkcXN1aGZleHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTUwMjcsImV4cCI6MjA4NDU5MTAyN30.BTU1GVBslFFZwBPPNriwzYWSLvSKeOJfDJWLM0MJnKA';

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
