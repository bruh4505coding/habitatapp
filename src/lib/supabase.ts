import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://aougfzqhtxlcxujmkuen.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWdmenFodHhsY3h1am1rdWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMTQyNDksImV4cCI6MjA5MzY5MDI0OX0.RX58r_Xg060HVRG1hM3-jO2z1Xgn801eh5BIMEKfWAM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
