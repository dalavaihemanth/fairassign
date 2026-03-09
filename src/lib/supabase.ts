import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iioujtossfpjhpgamdds.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpb3VqdG9zc2ZwamhwZ2FtZGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjAyOTAsImV4cCI6MjA4ODYzNjI5MH0.dgn321mYCz4LNXPnq_9FnwUiNRUayoURxH0dSlXdk-w';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables. Please check your .env.local file.");
}

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey
);
