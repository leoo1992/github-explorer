import type { User } from '@supabase/supabase-js';
import { isCanonicalAdmin } from '@/lib/admin-role';

export function isAdminUser(user: Pick<User, 'email'>) {
  return isCanonicalAdmin(user);
}

export function isEmailPasswordUser(user: Pick<User, 'app_metadata'>) {
  return user.app_metadata?.provider === 'email';
}

export function isEmailVerifiedForAccess(user: Pick<User, 'email' | 'app_metadata'>) {
  if (isAdminUser(user)) return true;
  if (!isEmailPasswordUser(user)) return true;
  return user.app_metadata?.email_verified_manually === true;
}
