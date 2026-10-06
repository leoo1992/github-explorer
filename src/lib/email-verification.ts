import type { User } from '@supabase/supabase-js';

export function isAdminUser(user: Pick<User, 'app_metadata'>) {
  return user.app_metadata?.role === 'admin' || user.app_metadata?.billing_exempt === true;
}

export function isEmailPasswordUser(user: Pick<User, 'app_metadata'>) {
  return user.app_metadata?.provider === 'email';
}

export function isEmailVerifiedForAccess(user: Pick<User, 'app_metadata'>) {
  if (isAdminUser(user)) return true;
  if (!isEmailPasswordUser(user)) return true;
  return user.app_metadata?.email_verified_manually === true;
}
