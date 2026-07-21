import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ksmatokqxzbllomruvct.supabase.co'
const supabaseAnonKey = 'sb_publishable_mVbetsaZrxyPfLvcJ0CJ-g_CZtZikXo'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
