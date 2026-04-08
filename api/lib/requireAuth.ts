import { createClient } from '@supabase/supabase-js';

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Returns the user id if valid, or null if missing / invalid.
 *
 * Usage in a handler:
 *   const userId = await requireAuth(req);
 *   if (!userId) return res.status(401).json({ error: 'Unauthorized' });
 */
export async function requireAuth(req: any): Promise<string | null> {
  const authHeader: string | undefined = req.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !serviceKey) return null;

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;

  return data.user.id;
}
