import { redirect } from 'next/navigation';
import { PresetManagerPage } from '@/components/preset-manager-page';
import { getAccessState } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function PresetsPage() {
  const access = await getAccessState();

  if (!access.user) redirect('/login?mode=login&next=/presets');
  if (!access.paid) redirect('/pricing');

  return <PresetManagerPage />;
}
