import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Supabase client dùng cho frontend (viewer, seller, admin)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
