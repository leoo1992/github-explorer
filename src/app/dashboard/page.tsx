import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Explorer } from '@/components/explorer';
import { getAccessState } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const access = await getAccessState();

  if (!access.user) redirect('/login?next=/dashboard');
  if (!access.paid) redirect('/pricing');

  return (
    <>
      <Link href="/account" className="account-floating-link">Conta</Link>
      <Explorer />
    </>
  );
}
