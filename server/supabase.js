const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test connection on startup
async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('count');

        if (error) {
            console.error('xxxxxxx Supabase connection failed:', error.message);
        } else {
            console.log('Connected to Supabase successfully!');
        }
    } catch (err) {
        console.error('xxxxxxxx Error connecting to Supabase:', err.message);
    }
}

testConnection();

module.exports = { supabase };
