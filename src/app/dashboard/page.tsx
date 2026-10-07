import { redirect } from 'next/navigation';
import { Explorer } from '@/components/explorer';
import { getAccessState } from '@/lib/access';
import { getRecentUserAnalyses } from '@/lib/usage';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const access = await getAccessState();

  if (!access.user) redirect('/login?mode=login&next=/dashboard');
  if (!access.canAnalyze) redirect('/pricing');

  const recentAnalyses = access.historyEnabled
    ? await getRecentUserAnalyses(access.user.id, 30)
    : [];

  return (
    <Explorer
      admin={access.admin}
      paid={access.paid}
      freeGrantDaysRemaining={access.freeGrantDaysRemaining}
      freeAnalysisAvailable={access.freeAnalysisAvailable}
      recentAnalyses={recentAnalyses}
    />
  );
}
