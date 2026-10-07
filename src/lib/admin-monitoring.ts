import type { User } from '@supabase/supabase-js';
import { createStripeClient } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  price_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminSessionSummary = {
  sessionId: string;
  userId: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  refreshedAt: string | null;
  notAfter: string | null;
  userAgent: string | null;
  ip: string | null;
  active: boolean;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  manualVerified: boolean;
  subscriptionStatus: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
  activeSessions: number;
  lastSessionAt: string | null;
  analyses30d: number;
};

export type AdminUsageSummary = {
  id: number;
  userId: string | null;
  email: string | null;
  repository: string | null;
  state: string;
  durationMs: number | null;
  criteriaCount: number | null;
  createdAt: string;
};

export type AdminPaymentSummary = {
  id: string;
  number: string | null;
  email: string | null;
  amountPaid: number;
  currency: string;
  status: string | null;
  createdAt: string;
  hostedInvoiceUrl: string | null;
};

export type AdminMonitoringData = {
  users: AdminUserSummary[];
  sessions: AdminSessionSummary[];
  usage: AdminUsageSummary[];
  payments: AdminPaymentSummary[];
  paymentsAvailable: boolean;
  metrics: {
    totalUsers: number;
    confirmedUsers: number;
    activeSessions: number;
    activeSubscriptions: number;
    usageTotal: number;
    usage24h: number;
    usage7d: number;
    usage30d: number;
    revenue30d: number;
    revenueCurrency: string;
  };
};

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function sessionActivity(session: AdminSessionSummary) {
  return session.refreshedAt ?? session.updatedAt ?? session.createdAt;
}

function isAdmin(user: User) {
  return user.app_metadata?.role === 'admin' || user.app_metadata?.billing_exempt === true;
}

export async function getAdminMonitoringData(): Promise<AdminMonitoringData> {
  const supabase = createAdminClient();
  const since24h = isoDaysAgo(1);
  const since7d = isoDaysAgo(7);
  const since30d = isoDaysAgo(30);

  const [
    usersResult,
    subscriptionsResult,
    sessionsResult,
    usageResult,
    usageTotalResult,
    usage24hResult,
    usage7dResult,
    usage30dResult,
  ] = await Promise.all([
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from('subscriptions').select('*').order('updated_at', { ascending: false }),
    supabase.rpc('admin_session_snapshot'),
    supabase
      .from('usage_events')
      .select('id,user_id,repository,state,duration_ms,criteria_count,created_at')
      .gte('created_at', since30d)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('usage_events').select('*', { count: 'exact', head: true }),
    supabase.from('usage_events').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
    supabase.from('usage_events').select('*', { count: 'exact', head: true }).gte('created_at', since7d),
    supabase.from('usage_events').select('*', { count: 'exact', head: true }).gte('created_at', since30d),
  ]);

  if (usersResult.error) throw new Error(`Falha ao carregar usuários: ${usersResult.error.message}`);
  if (subscriptionsResult.error) throw new Error(`Falha ao carregar assinaturas: ${subscriptionsResult.error.message}`);
  if (sessionsResult.error) throw new Error(`Falha ao carregar sessões: ${sessionsResult.error.message}`);
  if (usageResult.error) throw new Error(`Falha ao carregar consumo: ${usageResult.error.message}`);

  const rawUsers = usersResult.data.users;
  const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
  const rawSessions = (sessionsResult.data ?? []) as Array<{
    session_id: string;
    user_id: string;
    email: string | null;
    created_at: string;
    updated_at: string;
    refreshed_at: string | null;
    not_after: string | null;
    user_agent: string | null;
    ip: string | null;
    active: boolean;
  }>;
  const rawUsage = (usageResult.data ?? []) as Array<{
    id: number;
    user_id: string | null;
    repository: string | null;
    state: string;
    duration_ms: number | null;
    criteria_count: number | null;
    created_at: string;
  }>;

  const emailByUserId = new Map(rawUsers.map((user) => [user.id, user.email ?? 'Sem e-mail']));
  const subscriptionByUserId = new Map(subscriptions.map((subscription) => [subscription.user_id, subscription]));
  const userIdByCustomer = new Map(
    subscriptions
      .filter((subscription) => subscription.stripe_customer_id)
      .map((subscription) => [subscription.stripe_customer_id as string, subscription.user_id]),
  );

  const sessions: AdminSessionSummary[] = rawSessions.map((session) => ({
    sessionId: session.session_id,
    userId: session.user_id,
    email: session.email,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    refreshedAt: session.refreshed_at,
    notAfter: session.not_after,
    userAgent: session.user_agent,
    ip: session.ip,
    active: session.active,
  }));

  const usage: AdminUsageSummary[] = rawUsage.map((event) => ({
    id: event.id,
    userId: event.user_id,
    email: event.user_id ? emailByUserId.get(event.user_id) ?? null : null,
    repository: event.repository,
    state: event.state,
    durationMs: event.duration_ms,
    criteriaCount: event.criteria_count,
    createdAt: event.created_at,
  }));

  const sessionStatsByUser = new Map<string, { active: number; last: string | null }>();
  for (const session of sessions) {
    const current = sessionStatsByUser.get(session.userId) ?? { active: 0, last: null };
    if (session.active) current.active += 1;
    const activity = sessionActivity(session);
    if (!current.last || new Date(activity).getTime() > new Date(current.last).getTime()) current.last = activity;
    sessionStatsByUser.set(session.userId, current);
  }

  const usageByUser = new Map<string, number>();
  for (const event of usage) {
    if (!event.userId) continue;
    usageByUser.set(event.userId, (usageByUser.get(event.userId) ?? 0) + 1);
  }

  const users: AdminUserSummary[] = rawUsers
    .map((user) => {
      const subscription = subscriptionByUserId.get(user.id);
      const sessionStats = sessionStatsByUser.get(user.id);
      return {
        id: user.id,
        email: user.email ?? 'Sem e-mail',
        role: isAdmin(user) ? 'admin' : 'user',
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        emailConfirmed: Boolean(user.email_confirmed_at),
        manualVerified: user.app_metadata?.email_verified_manually === true || isAdmin(user),
        subscriptionStatus: subscription?.status ?? null,
        priceId: subscription?.price_id ?? null,
        currentPeriodEnd: subscription?.current_period_end ?? null,
        activeSessions: sessionStats?.active ?? 0,
        lastSessionAt: sessionStats?.last ?? null,
        analyses30d: usageByUser.get(user.id) ?? 0,
      } satisfies AdminUserSummary;
    })
    .sort((a, b) => new Date(b.lastSignInAt ?? b.createdAt).getTime() - new Date(a.lastSignInAt ?? a.createdAt).getTime());

  let payments: AdminPaymentSummary[] = [];
  let paymentsAvailable = true;
  let revenue30d = 0;
  let revenueCurrency = 'BRL';

  try {
    const stripe = createStripeClient();
    const invoices = await stripe.invoices.list({ limit: 50 });

    payments = invoices.data.map((invoice) => {
      const customerId =
        typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id ?? null;
      const userId = customerId ? userIdByCustomer.get(customerId) ?? null : null;
      const createdAt = new Date(invoice.created * 1000).toISOString();

      if (invoice.status === 'paid' && createdAt >= since30d) {
        revenue30d += invoice.amount_paid / 100;
        revenueCurrency = invoice.currency.toUpperCase();
      }

      return {
        id: invoice.id,
        number: invoice.number,
        email: invoice.customer_email ?? (userId ? emailByUserId.get(userId) ?? null : null),
        amountPaid: invoice.amount_paid / 100,
        currency: invoice.currency.toUpperCase(),
        status: invoice.status,
        createdAt,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
      };
    });
  } catch (error) {
    paymentsAvailable = false;
    console.error('[admin] Stripe invoices unavailable', error instanceof Error ? error.message : 'unknown');
  }

  return {
    users,
    sessions,
    usage,
    payments,
    paymentsAvailable,
    metrics: {
      totalUsers: users.length,
      confirmedUsers: users.filter((user) => user.emailConfirmed && user.manualVerified).length,
      activeSessions: sessions.filter((session) => session.active).length,
      activeSubscriptions: subscriptions.filter((subscription) => ['active', 'trialing'].includes(subscription.status)).length,
      usageTotal: usageTotalResult.count ?? 0,
      usage24h: usage24hResult.count ?? 0,
      usage7d: usage7dResult.count ?? 0,
      usage30d: usage30dResult.count ?? 0,
      revenue30d,
      revenueCurrency,
    },
  };
}
