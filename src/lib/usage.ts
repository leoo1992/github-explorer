import { createAdminClient } from '@/lib/supabase/admin';

type UsageEventInput = {
  userId: string;
  repository?: string | null;
  state: 'complete' | 'waiting' | 'not_found' | 'input' | 'error';
  durationMs?: number | null;
  criteriaCount?: number | null;
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
