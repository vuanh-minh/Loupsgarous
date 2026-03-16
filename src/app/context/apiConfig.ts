import { projectId, publicAnonKey } from '../../../utils/supabase/info';

export const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-2c00868b`;

/** Default headers for authenticated API requests */
export const authHeaders = () => ({
  'Authorization': `Bearer ${publicAnonKey}`,
});

/** Default headers for authenticated JSON requests */
export const jsonAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${publicAnonKey}`,
});

export { projectId, publicAnonKey };