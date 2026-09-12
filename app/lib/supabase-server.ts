import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const PRIMARY_ADMIN = 'ibrahimbkkari51@gmail.com';

export async function getAdminSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  if (user.email.toLowerCase() === PRIMARY_ADMIN) return user;

  // V18.1: allow additional admins from the protected admin_users table.
  try {
    const service = getServiceClient();
    const { data } = await service.from('admin_users').select('email,is_active').eq('email', user.email.toLowerCase()).maybeSingle();
    if (data?.is_active !== false) return user;
  } catch {
    // Keep the primary admin working even before the optional V18.1 SQL is run.
  }
  return null;
}

export function getServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY أو SUPABASE_SERVICE_ROLE_KEY غير موجود بمتغيرات البيئة');
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
