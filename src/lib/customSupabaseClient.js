import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dwnxvilbdxdqsuhfexuq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3bnh2aWxiZHhkcXN1aGZleHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTUwMjcsImV4cCI6MjA4NDU5MTAyN30.BTU1GVBslFFZwBPPNriwzYWSLvSKeOJfDJWLM0MJnKA';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
