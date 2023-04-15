import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js'
dotenv.config();
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// store data in supabase

const storeData = async (content, embedding) => {
    const { data: user, error } = await supabase
        .from('documents')
        .insert([
            { content: content, embedding: embedding },
        ])

    if (error) {
        console.log(error)
    }

}

const searchData = async (query) => {
    let { data, error } = await supabase
        .rpc('match_data', {
            match_count: 3,
            query_embedding : query,
        })

    if (error) console.error(error)
    return data
}

export {
    storeData,
    searchData
};