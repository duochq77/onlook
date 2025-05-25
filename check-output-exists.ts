import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
    const { data, error } = await supabase
        .storage
        .from('uploads')
        .list('outputs', { limit: 100 })

    if (error) {
        console.error('❌ Lỗi Supabase:', error)
    } else {
        console.log('📂 File trong uploads/outputs:', data)
    }
}

main()
