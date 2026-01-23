import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;


let supabase;
if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
    console.error("Supabase URL or Anon Key is missing! Check Vercel Environment Variables.");
    // Provide a dummy client for graceful failure
    supabase = {
        auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }), signInWithPassword: () => { throw new Error('Supabase client not configured') }, signUp: () => { throw new Error('Supabase client not configured') }, signOut: () => { throw new Error('Supabase client not configured') } },
        channel: () => ({ on: () => ({ subscribe: () => { } }), subscribe: () => { console.warn("Realtime disabled: Supabase client not configured.") } }),
        removeChannel: () => Promise.resolve(),
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: new Error('Supabase client not configured') }) }) }) }),
        storage: { from: () => ({ upload: () => { throw new Error('Supabase storage not configured') }, getPublicUrl: () => ({ data: { publicUrl: null } }) }) }
    };
}

export { supabase };