import { redirect } from 'next/navigation';
import {
  PresetManagerPage,
  type CustomQualityPreset,
} from '@/components/preset-manager-page';
import { getAccessState } from '@/lib/access';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function PresetsPage() {
  const access = await getAccessState();

  if (!access.user) redirect('/login?mode=login&next=/presets');
  if (!access.paid && !access.admin) redirect('/pricing');

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('quality_presets')
    .select('id, name, language, criteria_ids, created_at, updated_at')
    .eq('user_id', access.user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Não foi possível carregar os presets: ${error.message}`);
  }

  const initialPresets: CustomQualityPreset[] = (data ?? []).map((preset) => ({
    id: preset.id as string,
    name: preset.name as string,
    language: preset.language as CustomQualityPreset['language'],
    criteriaIds: (preset.criteria_ids ?? []) as string[],
    createdAt: preset.created_at as string,
    updatedAt: preset.updated_at as string,
  }));

  return <PresetManagerPage initialPresets={initialPresets} admin={access.admin} />;
}
