const { createClient } = require('@supabase/supabase-js');

let rawUrl = process.env.SUPABASE_URL || 'https://ozzwvzxugfaveggeznfa.supabase.co';
if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = `https://${rawUrl}`;
}
const SUPABASE_URL = rawUrl.replace(/\/+$/, '').trim();
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96end2enh1Z2ZhdmVnZ2V6bmZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjQzODAsImV4cCI6MjEwMDI0MDM4MH0.EjNb197lvdhbhcsYjBOsS-yDRp2wVFun-zjd2no6yh4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

module.exports = { supabase, SUPABASE_URL, SUPABASE_KEY };

