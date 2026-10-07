import { createAdminClient } from '@/lib/supabase/admin';

type UsageEventInput = {
  userId: string;
  repository?: string | null;
  state: 'complete' | 'waiting' | 'not_found' | 'input' | 'error';
  durationMs?: number | null;
  criteriaCount?: number | null;
};

export type RecentAnalysis = {
  id: number;
  repository: string;
  createdAt: string;
  durationMs: number | null;
  criteriaCount: number | null;
};

export async function recordRepositoryUsage(input: UsageEventInput) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('usage_events').insert({
      user_id: input.userId,
      event_type: 'repository_analysis',
      repository: input.repository ?? null,
      state: input.state,
      duration_ms: input.durationMs ?? null,
      criteria_count: input.criteriaCount ?? null,
    });

    if (error) {
      console.error('[usage] failed to persist event', error.message);
    }
  } catch (error) {
    console.error('[usage] unavailable', error instanceof Error ? error.message : 'unknown');
  }
}

export async function getRecentUserAnalyses(userId: string, days = 30): Promise<RecentAnalysis[]> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('usage_events')
    .select('id,repository,created_at,duration_ms,criteria_count')
    .eq('user_id', userId)
    .eq('event_type', 'repository_analysis')
    .eq('state', 'complete')
    .not('repository', 'is', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(`Não foi possível carregar as análises recentes: ${error.message}`);

  return (data ?? []).map((event) => ({
    id: event.id as number,
    repository: event.repository as string,
    createdAt: event.created_at as string,
    durationMs: event.duration_ms as number | null,
    criteriaCount: event.criteria_count as number | null,
  }));
}
