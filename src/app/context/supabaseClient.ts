import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const SUPABASE_URL = `https://${projectId}.supabase.co`;

// Singleton Supabase client for Realtime and other client-side operations
export const supabase = createClient(SUPABASE_URL, publicAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});