import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase URL loaded:', supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING')
console.log('Supabase Key loaded:', supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'MISSING')

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
