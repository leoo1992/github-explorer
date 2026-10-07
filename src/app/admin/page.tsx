import { redirect } from 'next/navigation';
import { AdminUserActions } from '@/components/admin-user-actions';
import { AppNavigation } from '@/components/app-navigation';
import { getAccessState } from '@/lib/access';
import { getAdminMonitoringData } from '@/lib/admin-monitoring';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null) {
  if (!value) return 'Nunca';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(value);
}

function subscriptionLabel(status: string | null, role: 'admin' | 'user') {
  if (role === 'admin') return 'Administrador';
  if (!status) return 'Sem assinatura';

  const labels: Record<string, string> = {
    active: 'Ativa',
    trialing: 'Em teste',
    past_due: 'Pagamento pendente',
    canceled: 'Cancelada',
    unpaid: 'Não paga',
    incomplete: 'Incompleta',
    incomplete_expired: 'Expirada',
    paused: 'Pausada',
  };

  return labels[status] ?? status;
}

function usageStateLabel(state: string) {
  const labels: Record<string, string> = {
    complete: 'Concluída',
    waiting: 'Aguardando',
    not_found: 'Não encontrado',
    input: 'Entrada inválida',
    error: 'Erro',
  };
  return labels[state] ?? state;
}

function shortAgent(agent: string | null) {
  if (!agent) return 'Não informado';
  const browser =
    agent.match(/Edg\/([\d.]+)/)?.[0] ??
    agent.match(/Chrome\/([\d.]+)/)?.[0] ??
    agent.match(/Firefox\/([\d.]+)/)?.[0] ??
    agent.match(/Version\/([\d.]+).*Safari/)?.[0] ??
    'Navegador';
  const os = agent.includes('Windows')
    ? 'Windows'
    : agent.includes('Android')
      ? 'Android'
      : agent.includes('iPhone') || agent.includes('iPad')
        ? 'iOS'
        : agent.includes('Mac OS')
          ? 'macOS'
          : agent.includes('Linux')
            ? 'Linux'
            : '';
  return [browser, os].filter(Boolean).join(' · ');
}

export default async function AdminPage() {
  const access = await getAccessState();

  if (!access.user) redirect('/login?mode=login&next=/admin');
  if (!access.admin) redirect('/dashboard');

  const data = await getAdminMonitoringData();
  const mostActiveUsers = [...data.users]
    .sort((a, b) => b.analyses30d - a.analyses30d)
    .slice(0, 10);

  return (
    <main className={[styles.page, 'page-with-dock'].join(' ')}>
      <AppNavigation admin presetAccess />

      <section className={styles.hero}>
        <p>PAINEL ADMINISTRATIVO</p>
        <h1>Operação do RepoScope em um único lugar.</h1>
        <span>
          Usuários, sessões, assinaturas, pagamentos e consumo das análises. Horários exibidos em Brasília.
        </span>
      </section>

      <section className={styles.metrics}>
        <article>
          <span>Usuários</span>
          <strong>{data.metrics.totalUsers}</strong>
          <small>{data.metrics.confirmedUsers} confirmados</small>
        </article>
        <article>
          <span>Sessões ativas</span>
          <strong>{data.metrics.activeSessions}</strong>
          <small>Sessões Auth não expiradas</small>
        </article>
        <article>
          <span>Assinaturas ativas</span>
          <strong>{data.metrics.activeSubscriptions}</strong>
          <small>active + trialing</small>
        </article>
        <article>
          <span>Análises em 24h</span>
          <strong>{data.metrics.usage24h}</strong>
          <small>{data.metrics.usage7d} nos últimos 7 dias</small>
        </article>
        <article>
          <span>Análises em 30 dias</span>
          <strong>{data.metrics.usage30d}</strong>
          <small>{data.metrics.usageTotal} desde o início da telemetria</small>
        </article>
        <article>
          <span>Receita paga · 30 dias</span>
          <strong>{formatMoney(data.metrics.revenue30d, data.metrics.revenueCurrency)}</strong>
          <small>{data.paymentsAvailable ? 'Pagamentos confirmados' : 'Dados de pagamento indisponíveis'}</small>
        </article>
      </section>

      <section className={`card ${styles.section}`}>
        <div className={styles.sectionHead}>
          <div>
            <p>USUÁRIOS</p>
            <h2>Contas e acessos</h2>
          </div>
          <span>{data.users.length} contas</span>
        </div>

        <div className={styles.tableWrap}>
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Tipo</th>
                <th>Confirmação</th>
                <th>Assinatura</th>
                <th>Sessões</th>
                <th>Último login</th>
                <th>Última sessão</th>
                <th>Análises 30d</th>
                <th>Acesso grátis</th>
                <th>Criado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.email}</strong></td>
                  <td><span className={`badge badge-soft ${user.role === 'admin' ? styles.adminBadge : styles.badge}`}>{user.role === 'admin' ? 'Admin' : 'Usuário'}</span></td>
                  <td>
                    <span className={`badge badge-soft ${user.emailConfirmed && user.manualVerified ? styles.okBadge : styles.warnBadge}`}>
                      {user.emailConfirmed && user.manualVerified ? 'Confirmado' : 'Pendente'}
                    </span>
                  </td>
                  <td>{subscriptionLabel(user.subscriptionStatus, user.role)}</td>
                  <td>{user.activeSessions}</td>
                  <td>{formatDateTime(user.lastSignInAt)}</td>
                  <td>{formatDateTime(user.lastSessionAt)}</td>
                  <td>{user.analyses30d}</td>
                  <td>
                    {user.role === 'admin'
                      ? 'Permanente'
                      : user.freeGrantDaysRemaining > 0
                        ? `${user.freeGrantDaysRemaining} dias restantes`
                        : user.freeAnalysisUsed
                          ? 'Análise grátis utilizada'
                          : '1 análise grátis'}
                  </td>
                  <td>{formatDateTime(user.createdAt)}</td>
                  <td>
                    <AdminUserActions
                      userId={user.id}
                      email={user.email}
                      admin={user.role === 'admin'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.twoColumns}>
        <section className={`card ${styles.section}`}>
          <div className={styles.sectionHead}>
            <div>
              <p>CONSUMO</p>
              <h2>Usuários que mais analisam</h2>
            </div>
            <span>30 dias</span>
          </div>
          <div className={styles.rankList}>
            {mostActiveUsers.map((user, index) => (
              <div key={user.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><strong>{user.email}</strong><small>{user.role === 'admin' ? 'Administrador' : subscriptionLabel(user.subscriptionStatus, user.role)}</small></div>
                <b>{user.analyses30d}</b>
              </div>
            ))}
            {mostActiveUsers.length === 0 ? <p className={styles.empty}>Ainda não há consumo registrado.</p> : null}
          </div>
        </section>

        <section className={`card ${styles.section}`}>
          <div className={styles.sectionHead}>
            <div>
              <p>SESSÕES</p>
              <h2>Sessões mais recentes</h2>
            </div>
            <span>{data.sessions.filter((session) => session.active).length} ativas</span>
          </div>
          <div className={styles.sessionList}>
            {data.sessions.slice(0, 12).map((session) => (
              <article key={session.sessionId}>
                <div>
                  <strong>{session.email ?? 'Usuário sem e-mail'}</strong>
                  <small>{shortAgent(session.userAgent)}</small>
                </div>
                <div>
                  <span className={`badge badge-soft ${session.active ? styles.okBadge : styles.badge}`}>{session.active ? 'Ativa' : 'Encerrada'}</span>
                  <small>IP {session.ip ?? '—'} · {formatDateTime(session.refreshedAt ?? session.updatedAt)}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className={`card ${styles.section}`}>
        <div className={styles.sectionHead}>
          <div>
            <p>PAGAMENTOS</p>
            <h2>Pagamentos recentes</h2>
          </div>
          <span>{data.payments.length} carregadas</span>
        </div>

        {!data.paymentsAvailable ? (
          <p className={styles.warning}>Não foi possível consultar os pagamentos neste momento. As assinaturas continuam disponíveis na tabela de usuários.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Fatura</th>
                  <th>Usuário</th>
                  <th>Status</th>
                  <th>Valor pago</th>
                  <th>Data</th>
                  <th>Comprovante</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td><strong>{payment.number ?? payment.id}</strong></td>
                    <td>{payment.email ?? 'Não identificado'}</td>
                    <td><span className={`badge badge-soft ${payment.status === 'paid' ? styles.okBadge : styles.badge}`}>{payment.status ?? '—'}</span></td>
                    <td>{formatMoney(payment.amountPaid, payment.currency)}</td>
                    <td>{formatDateTime(payment.createdAt)}</td>
                    <td>{payment.hostedInvoiceUrl ? <a className={styles.link} href={payment.hostedInvoiceUrl} target="_blank" rel="noreferrer">Abrir</a> : '—'}</td>
                  </tr>
                ))}
                {data.payments.length === 0 ? (
                  <tr><td colSpan={6} className={styles.emptyCell}>Nenhuma fatura encontrada.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`card ${styles.section}`}>
        <div className={styles.sectionHead}>
          <div>
            <p>ATIVIDADE</p>
            <h2>Análises recentes</h2>
          </div>
          <span>Últimos 30 dias</span>
        </div>

        <div className={styles.tableWrap}>
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Repositório</th>
                <th>Estado</th>
                <th>Duração</th>
                <th>Critérios</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {data.usage.slice(0, 100).map((event) => (
                <tr key={event.id}>
                  <td>{event.email ?? 'Usuário removido'}</td>
                  <td><strong>{event.repository ?? '—'}</strong></td>
                  <td><span className={`badge badge-soft ${event.state === 'complete' ? styles.okBadge : event.state === 'waiting' ? styles.warnBadge : styles.badge}`}>{usageStateLabel(event.state)}</span></td>
                  <td>{event.durationMs === null ? '—' : `${(event.durationMs / 1000).toFixed(1)}s`}</td>
                  <td>{event.criteriaCount ?? '—'}</td>
                  <td>{formatDateTime(event.createdAt)}</td>
                </tr>
              ))}
              {data.usage.length === 0 ? (
                <tr><td colSpan={6} className={styles.emptyCell}>A telemetria começa a contar a partir desta versão.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Dados administrativos protegidos por sessão e papel de administrador.</span>
        <form action="/auth/signout" method="post"><button className="btn btn-ghost btn-sm" type="submit">Sair</button></form>
      </footer>
    </main>
  );
}
