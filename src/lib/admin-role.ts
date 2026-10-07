import type { User } from '@supabase/supabase-js';

export const ADMIN_EMAIL = 'adm@adm.com';

export function isCanonicalAdmin(user: Pick<User, 'email'> | null | undefined) {
  return user?.email?.trim().toLowerCase() === ADMIN_EMAIL;
}
