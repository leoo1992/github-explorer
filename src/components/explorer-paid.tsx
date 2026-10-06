'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_QUALITY_CRITERIA_IDS,
  QUALITY_CRITERIA,
  QUALITY_PRESETS,
  calculateQualityScore,
  qualityCriterionLabels,
} from '@/lib/quality-criteria';
import type {
  ArchitectureLayer,
  DependencyItem,
  OwnerQualitySummary,
  RepositoryAnalysis,
  TreeEntry,
} from '@/types/repository';

type SearchMode = 'repository' | 'owner' | 'project';
type Tab = 'overview' | 'architecture' | 'files' | 'dependencies';
type OwnerRepositoryScore = { name: string; score: number; offset?: number };
type AnalysisState = 'idle' | 'running' | 'waiting' | 'complete' | 'empty';

type OwnerBatch = {
  state?: 'waiting' | 'not_found' | 'input';
  retryAfterMs?: number;
  totalRepositories?: number;
  repositories?: OwnerRepositoryScore[];
  pendingOffsets?: number[];
  nextOffset?: number;
  scanComplete?: boolean;
  complete?: boolean;
};

type AnalysisControl = {
  state?: 'waiting' | 'not_found' | 'input';
  retryAfterMs?: number;
};

const modes: Record<SearchMode, { label: string; placeholder: string; hint: string; examples: string[] }> = {
  repository: {
    label: 'Repositório',
    placeholder: 'owner/repository ou URL completa do GitHub',
    hint: 'Arquitetura, stack, dependências e sinais de qualidade.',
    examples: ['vercel/next.js', 'facebook/react'],
  },
  owner: {
    label: 'Owner / organização',
    placeholder: 'owner ou https://github.com/owner',
    hint: 'Analisa em lote os repositórios públicos do owner informado.',
    examples: ['vercel', 'facebook'],
  },
  project: {
    label: 'Nome do projeto',
    placeholder: 'nome do projeto, ex.: django',
    hint: 'Busca a correspondência pública mais relevante antes de analisar.',
    examples: ['django', 'next.js'],
  },
};

function compact(value: number) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function normalizeOwner(value: string) {
  const normalized = value.trim().replace(/\/+$/, '');
  const match = normalized.match(/^(?:https?:\/\/)?github\.com\/([^/?#]+)(?:[/?#].*)?$/i);
  const owner = (match?.[1] ?? normalized.replace(/^@/, '')).trim();
  return owner && /^[A-Za-z0-9_.-]+$/.test(owner) ? owner : null;
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

function averageScore(repositories: OwnerRepositoryScore[]) {
  if (!repositories.length) return null;
  return Math.round(repositories.reduce((sum, item) => sum + item.score, 0) / repositories.length);
}

function Overview({ data, criteriaIds }: { data: RepositoryAnalysis; criteriaIds: string[] }) {
  const score = calculateQualityScore(data.qualitySignals, criteriaIds);
  const labels = qualityCriterionLabels(criteriaIds);
  const visibleSignals = data.qualitySignals.filter((signal) => labels.has(signal.label));

  return (
    <div className="tab-content">
      <section className="metric-grid">
        <article><span>Qualidade</span><strong>{score.score}%</strong><small>{score.passed}/{score.total} critérios atendidos</small></article>
        <article><span>Arquivos</span><strong>{compact(data.totals.files)}</strong><small>{data.totals.directories} diretórios</small></article>
        <article><span>Stack</span><strong>{data.stack.length}</strong><small>tecnologias detectadas</small></article>
        <article><span>Manifestos</span><strong>{data.totals.manifests}</strong><small>arquivos de dependência</small></article>
      </section>

      <section className="overview-grid">
        <article className="panel">
          <div className="panel-head"><div><p>Composição</p><h2>Linguagens</h2></div></div>
          <div className="language-list">
            {data.languages.slice(0, 8).map((item, index) => (
              <div className="language-row" key={item.name}>
                <div><span className={`language-dot language-dot-${(index % 5) + 1}`} /><strong>{item.name}</strong><small>{item.percentage.toFixed(1)}%</small></div>
                <div className="language-track"><span style={{ width: `${Math.max(2, item.percentage)}%` }} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head"><div><p>Detecção</p><h2>Stack tecnológica</h2></div></div>
          <div className="stack-cloud">
            {data.stack.map((item) => (
              <span className={`stack-chip stack-${item.category.toLowerCase()}`} key={`${item.category}-${item.name}`}>
                <strong>{item.name}</strong><small>{item.category}</small>
              </span>
            ))}
          </div>
        </article>

        <article className="panel wide">
          <div className="panel-head"><div><p>Engineering signals</p><h2>Critérios considerados na nota</h2></div><span className="criteria-count">{criteriaIds.length} selecionados</span></div>
          <div className="quality-grid">
            {visibleSignals.map((signal) => (
              <div className={signal.found ? 'quality-card quality-ok' : 'quality-card'} key={signal.label}>
                <span>{signal.found ? '✓' : '—'}</span>
                <div><strong>{signal.label}</strong><small>{signal.detail}</small></div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function Architecture({ layers }: { layers: ArchitectureLayer[] }) {
  return (
    <div className="tab-content">
      <section className="architecture-map">
        {layers.map((layer, index) => (
          <div className="architecture-node-wrap" key={`${layer.name}-${index}`}>
            <article className="architecture-node">
              <span className="node-index">{String(index + 1).padStart(2, '0')}</span>
              <p>{layer.name}</p><h3>{layer.role}</h3>
              <div>{layer.technologies.map((item) => <span key={item}>{item}</span>)}</div>
            </article>
            {index < layers.length - 1 ? <div className="architecture-arrow">↓</div> : null}
          </div>
        ))}
      </section>
    </div>
  );
}

function Files({ entries, truncated }: { entries: TreeEntry[]; truncated: boolean }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? entries.filter((entry) => entry.path.toLowerCase().includes(normalized)) : entries;
  }, [entries, query]);

  return (
    <div className="tab-content">
      <section className="panel">
        <div className="panel-head file-panel-head"><div><p>Repository tree</p><h2>Estrutura de arquivos</h2></div><label className="file-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar arquivo ou pasta" /></label></div>
        {truncated ? <p className="tree-note">Exibição resumida para manter a análise rápida.</p> : null}
        <div className="tree-list">
          {filtered.slice(0, 300).map((entry) => <div className="tree-row" key={`${entry.type}-${entry.path}`}><span className={entry.type === 'tree' ? 'tree-type tree-folder' : 'tree-type'}>{entry.type === 'tree' ? '▰' : '▱'}</span><span>{entry.path}</span>{entry.size !== null ? <small>{compact(entry.size)} B</small> : null}</div>)}
        </div>
      </section>
    </div>
  );
}

function Dependencies({ items }: { items: DependencyItem[] }) {
  return (
    <div className="tab-content">
      <section className="panel">
        <div className="panel-head"><div><p>Package manifests</p><h2>Dependências</h2></div></div>
        <div className="dependency-table-wrap"><table className="dependency-table"><thead><tr><th>Pacote</th><th>Versão</th><th>Escopo</th><th>Manifesto</th></tr></thead><tbody>{items.map((item, index) => <tr key={`${item.name}-${index}`}><td><strong>{item.name}</strong></td><td>{item.version}</td><td><span className="scope-pill">{item.scope}</span></td><td>{item.manifest}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

function Progress({ current, total, status, waiting }: { current: number; total: number; status: string; waiting: boolean }) {
  const percentage = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="analysis-progress" aria-live="polite">
      <div className="analysis-progress-head"><div><strong>{status}</strong><span>{current} de {total} repositórios validados</span></div><b>{percentage}%</b></div>
      <div className="analysis-progress-track"><span className={waiting ? 'waiting' : ''} style={{ width: `${percentage}%` }} /></div>
      <small>O processamento continua automaticamente até validar todos os repositórios públicos.</small>
    </div>
  );
}

function OwnerResult({ summary, repositories, status, state, criteriaCount }: {
  summary: OwnerQualitySummary;
  repositories: OwnerRepositoryScore[];
  status: string;
  state: AnalysisState;
  criteriaCount: number;
}) {
  const attention = repositories.filter((item) => item.score < 100).sort((a, b) => a.score - b.score);
  return (
    <section className="panel">
      <div className="panel-head"><div><p>Portfolio engineering scan</p><h2>@{summary.owner}</h2></div><span className="criteria-count">{criteriaCount} critérios</span></div>
      {!summary.complete ? <Progress current={summary.analyzedRepositories} total={summary.totalRepositories} status={status} waiting={state === 'waiting'} /> : null}
      <section className="metric-grid">
        <article><span>{summary.complete ? 'Média final' : 'Média parcial'}</span><strong>{summary.average ?? '—'}{summary.average !== null ? '%' : ''}</strong><small>sinais técnicos validados</small></article>
        <article><span>Repositórios</span><strong>{summary.totalRepositories}</strong><small>públicos encontrados</small></article>
        <article><span>Validados</span><strong>{summary.analyzedRepositories}</strong><small>{summary.complete ? 'análise concluída' : 'processamento em andamento'}</small></article>
        <article><span>Com atenção</span><strong>{attention.length}</strong><small>score abaixo de 100%</small></article>
      </section>
      {attention.length ? <div className="dependency-table-wrap"><table className="dependency-table"><thead><tr><th>Repositório</th><th>Qualidade</th></tr></thead><tbody>{attention.map((item) => <tr key={`${item.offset ?? item.name}-${item.name}`}><td><strong>{item.name}</strong></td><td>{item.score}%</td></tr>)}</tbody></table></div> : null}
      <p className="tree-note">O score mede sinais observáveis do repositório. Não representa competência profissional e não deve ser usado como decisão automática de contratação.</p>
    </section>
  );
}

function CriteriaSelector({ selected, setSelected, disabled }: {
  selected: string[];
  setSelected: (ids: string[]) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const groups = [...new Set(QUALITY_CRITERIA.map((criterion) => criterion.group))];

  function toggle(id: string) {
    if (disabled) return;
    if (selected.includes(id)) {
      if (selected.length === 1) return;
      setSelected(selected.filter((item) => item !== id));
    } else {
      setSelected([...selected, id]);
    }
  }

  return (
    <div className="criteria-selector">
      <button className="criteria-trigger" type="button" onClick={() => setOpen((value) => !value)} disabled={disabled} aria-expanded={open}>
        <span><strong>Critérios da nota</strong><small>{selected.length} de {QUALITY_CRITERIA.length} entram no cálculo</small></span>
        <b>{open ? '−' : '+'}</b>
      </button>
      {open ? <div className="criteria-panel">
        <div className="criteria-presets">
          <span>Cenários rápidos</span>
          {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
            <button key={key} type="button" disabled={disabled} onClick={() => setSelected([...preset.ids])}>{preset.label}</button>
          ))}
        </div>
        {groups.map((group) => <div className="criteria-group" key={group}>
          <strong>{group}</strong>
          <div className="criteria-grid">
            {QUALITY_CRITERIA.filter((criterion) => criterion.group === group).map((criterion) => (
              <label className={selected.includes(criterion.id) ? 'criterion checked' : 'criterion'} key={criterion.id}>
                <input type="checkbox" checked={selected.includes(criterion.id)} disabled={disabled} onChange={() => toggle(criterion.id)} />
                <span><b>{criterion.label}</b><small>{criterion.description}</small></span>
              </label>
            ))}
          </div>
        </div>)}
      </div> : null}
    </div>
  );
}

export function ExplorerPaid() {
  const [mode, setMode] = useState<SearchMode>('repository');
  const [input, setInput] = useState('vercel/next.js');
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [ownerSummary, setOwnerSummary] = useState<OwnerQualitySummary | null>(null);
  const [ownerScores, setOwnerScores] = useState<OwnerRepositoryScore[]>([]);
  const [ownerStatus, setOwnerStatus] = useState('');
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([...DEFAULT_QUALITY_CRITERIA_IDS]);
  const [appliedCriteria, setAppliedCriteria] = useState<string[]>([...DEFAULT_QUALITY_CRITERIA_IDS]);
  const activeController = useRef<AbortController | null>(null);

  function startController() {
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    return controller;
  }

  function handleAccessStatus(status: number) {
    if (status === 401) {
      window.location.assign('/login?next=/dashboard');
      return true;
    }
    if (status === 402) {
      window.location.assign('/pricing');
      return true;
    }
    return false;
  }

  async function analyzeRepository(value: string, selectedMode: SearchMode, criteriaIds: string[]) {
    const controller = startController();
    setLoading(true); setAnalysis(null); setOwnerSummary(null); setOwnerScores([]);
    setAnalysisState('running'); setStatusMessage('Coletando evidências públicas do GitHub');
    let waitMs = 2_000;

    while (!controller.signal.aborted) {
      try {
        const response = await fetch(`/api/analyze?repo=${encodeURIComponent(value)}&mode=${selectedMode === 'project' ? 'project' : 'repository'}`, { cache: 'no-store', signal: controller.signal });
        if (handleAccessStatus(response.status)) return;
        const body = await response.json() as RepositoryAnalysis | AnalysisControl;

        if (response.ok && 'repository' in body) {
          setStatusMessage('Consolidando resultado');
          setAnalysis(body); setInput(body.repository.fullName); setMode('repository'); setTab('overview');
          setAnalysisState('complete'); setLoading(false);
          return;
        }

        if ('state' in body && (body.state === 'not_found' || body.state === 'input')) {
          setAnalysisState('empty');
          setStatusMessage(body.state === 'not_found' ? 'Nenhum repositório público correspondente foi encontrado.' : 'Informe um repositório, URL ou projeto público válido.');
          setLoading(false);
          return;
        }

        const retry = 'retryAfterMs' in body && body.retryAfterMs ? body.retryAfterMs : waitMs;
        setAnalysisState('waiting');
        setStatusMessage('Aguardando disponibilidade dos dados · retomada automática');
        await delay(Math.min(Math.max(retry, 2_000), 60_000), controller.signal);
        waitMs = Math.min(waitMs * 2, 30_000);
      } catch {
        if (controller.signal.aborted) return;
        setAnalysisState('waiting');
        setStatusMessage('Sincronizando novamente com a fonte pública · retomada automática');
        await delay(waitMs, controller.signal);
        waitMs = Math.min(waitMs * 2, 30_000);
      }
    }
  }

  async function requestOwnerBatch(owner: string, offset: number, limit: number, criteriaIds: string[], signal: AbortSignal) {
    const criteria = encodeURIComponent(criteriaIds.join(','));
    const response = await fetch(`/api/owner-quality?owner=${encodeURIComponent(owner)}&offset=${offset}&limit=${limit}&criteria=${criteria}`, { cache: 'no-store', signal });
    if (handleAccessStatus(response.status)) return null;
    return await response.json() as OwnerBatch;
  }

  async function analyzeOwner(value: string, criteriaIds: string[]) {
    const owner = normalizeOwner(value);
    if (!owner) {
      setAnalysisState('empty');
      setStatusMessage('Informe um owner ou uma URL pública válida do GitHub.');
      return;
    }

    const controller = startController();
    setLoading(true); setAnalysis(null); setOwnerSummary(null); setOwnerScores([]);
    setOwnerStatus('Preparando portfólio público'); setAnalysisState('running'); setStatusMessage('');

    const scoresByOffset = new Map<number, OwnerRepositoryScore>();
    const pendingOffsets = new Set<number>();
    let offset = 0;
    let total = 0;
    let transientWait = 2_000;

    const publish = (complete = false) => {
      const repositories = [...scoresByOffset.values()].sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));
      setOwnerScores(repositories);
      setOwnerSummary({
        owner,
        average: averageScore(repositories),
        totalRepositories: total,
        analyzedRepositories: repositories.length,
        complete,
        scope: 'public',
        analyzedAt: new Date().toISOString(),
      });
    };

    while (!controller.signal.aborted && (!total || offset < total)) {
      try {
        const batch = await requestOwnerBatch(owner, offset, 6, criteriaIds, controller.signal);
        if (!batch || controller.signal.aborted) return;

        if (batch.state === 'not_found' || batch.state === 'input') {
          setAnalysisState('empty'); setStatusMessage('Nenhum portfólio público correspondente foi encontrado.'); setLoading(false); return;
        }
        if (batch.state === 'waiting' || batch.totalRepositories === undefined) {
          setAnalysisState('waiting'); setOwnerStatus('Aguardando dados do GitHub · retomada automática');
          await delay(Math.min(Math.max(batch.retryAfterMs ?? transientWait, 2_000), 60_000), controller.signal);
          transientWait = Math.min(transientWait * 2, 30_000);
          continue;
        }

        transientWait = 2_000;
        total = batch.totalRepositories;
        for (const repository of batch.repositories ?? []) {
          const repositoryOffset = repository.offset;
          if (typeof repositoryOffset === 'number') {
            scoresByOffset.set(repositoryOffset, repository);
            pendingOffsets.delete(repositoryOffset);
          }
        }
        for (const pending of batch.pendingOffsets ?? []) pendingOffsets.add(pending);
        offset = batch.nextOffset ?? Math.min(total, offset + 6);
        setAnalysisState('running');
        setOwnerStatus(`${scoresByOffset.size}/${total} repositórios validados`);
        publish(false);
      } catch {
        if (controller.signal.aborted) return;
        setAnalysisState('waiting'); setOwnerStatus('Sincronizando novamente · retomada automática');
        await delay(transientWait, controller.signal);
        transientWait = Math.min(transientWait * 2, 30_000);
      }
    }

    while (!controller.signal.aborted && pendingOffsets.size > 0) {
      const pendingOffset = [...pendingOffsets][0]!;
      try {
        const batch = await requestOwnerBatch(owner, pendingOffset, 1, criteriaIds, controller.signal);
        if (!batch || controller.signal.aborted) return;
        if (batch.state === 'waiting' || batch.totalRepositories === undefined) {
          setAnalysisState('waiting'); setOwnerStatus('Aguardando nova janela de consulta · retomada automática');
          await delay(Math.min(Math.max(batch.retryAfterMs ?? transientWait, 2_000), 60_000), controller.signal);
          transientWait = Math.min(transientWait * 2, 30_000);
          continue;
        }

        transientWait = 2_000;
        total = batch.totalRepositories;
        const repository = batch.repositories?.[0];
        if (repository && typeof repository.offset === 'number') {
          scoresByOffset.set(repository.offset, repository);
          pendingOffsets.delete(repository.offset);
          setAnalysisState('running');
          setOwnerStatus(`${scoresByOffset.size}/${total} repositórios validados`);
          publish(false);
          continue;
        }

        setAnalysisState('waiting'); setOwnerStatus('Revalidando item pendente · retomada automática');
        await delay(Math.min(Math.max(batch.retryAfterMs ?? 4_000, 2_000), 60_000), controller.signal);
      } catch {
        if (controller.signal.aborted) return;
        setAnalysisState('waiting'); setOwnerStatus('Sincronizando item pendente · retomada automática');
        await delay(transientWait, controller.signal);
        transientWait = Math.min(transientWait * 2, 30_000);
      }
    }

    if (!controller.signal.aborted) {
      publish(true);
      setOwnerStatus('Análise concluída'); setAnalysisState('complete'); setLoading(false);
    }
  }

  function run(value = input, selectedMode = mode) {
    const normalized = value.trim();
    if (!normalized || loading) return;
    const criteriaSnapshot = [...selectedCriteria];
    setAppliedCriteria(criteriaSnapshot);
    setInput(normalized); setMode(selectedMode); setStatusMessage('');
    if (selectedMode === 'owner') void analyzeOwner(normalized, criteriaSnapshot);
    else void analyzeRepository(normalized, selectedMode, criteriaSnapshot);
  }

  function submit(event: FormEvent) { event.preventDefault(); run(); }
  const active = modes[mode];

  return (
    <main>
      <section className="hero">
        <div className="topbar shell">
          <Link className="brand" href="/"><span className="brand-mark">RS</span><span><strong>RepoScope</strong><small>Engineering Intelligence</small></span></Link>
          <div className="repo-actions"><Link className="secondary-action" href="/account">Conta</Link><form action="/auth/signout" method="post"><button className="secondary-action" type="submit">Sair</button></form></div>
        </div>
        <div className="hero-content shell">
          <div className="hero-copy"><p className="eyebrow">ASSINATURA ATIVA</p><h1>Avalie projetos públicos com evidências técnicas.</h1><p>Escolha o escopo e quais sinais entram no cálculo. O progresso é exibido durante toda a análise e etapas temporariamente indisponíveis são retomadas automaticamente.</p></div>
          <form className="repo-form" onSubmit={submit}>
            <div className="segmented">{(Object.keys(modes) as SearchMode[]).map((item) => <button key={item} className={mode === item ? 'active' : ''} type="button" disabled={loading} onClick={() => { setMode(item); setStatusMessage(''); setAnalysisState('idle'); }}>{modes[item].label}</button>)}</div>
            <div className="repo-input"><input aria-label="Entrada do GitHub" value={input} onChange={(event) => setInput(event.target.value)} placeholder={active.placeholder} spellCheck={false} disabled={loading} /><button type="submit" disabled={loading || !input.trim()}>{loading ? 'Processando…' : 'Analisar'}</button></div>
            <CriteriaSelector selected={selectedCriteria} setSelected={setSelectedCriteria} disabled={loading} />
            <div className="examples"><span>{active.hint} Exemplos:</span>{active.examples.map((example) => <button key={example} type="button" disabled={loading} onClick={() => run(example, mode)}>{example}</button>)}</div>
          </form>
        </div>
      </section>

      <section className="shell workspace">
        {loading && !ownerSummary ? <div className="loading-layout"><div className="analysis-status"><span className={analysisState === 'waiting' ? 'status-dot waiting' : 'status-dot'} /><div><strong>{statusMessage || 'Preparando análise'}</strong><small>Nenhum detalhe técnico de falha é exposto nesta tela.</small></div></div><div className="indeterminate-progress"><span /></div><div className="skeleton-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton" key={index} />)}</div></div> : null}
        {!analysis && !ownerSummary && !loading && analysisState === 'idle' ? <div className="empty-landing"><h2>Escolha o tipo e os critérios da análise.</h2><p>{selectedCriteria.length} critérios estão selecionados para o próximo cálculo.</p></div> : null}
        {!analysis && !ownerSummary && !loading && analysisState === 'empty' ? <div className="empty-landing"><h2>{statusMessage}</h2><p>Ajuste a entrada e execute novamente quando quiser.</p></div> : null}
        {ownerSummary ? <OwnerResult summary={ownerSummary} repositories={ownerScores} status={ownerStatus} state={analysisState} criteriaCount={appliedCriteria.length} /> : null}
        {analysis ? <>
          <header className="repo-header"><div className="repo-identity"><div className="repo-icon">◆</div><div><p>{analysis.repository.owner}</p><h2>{analysis.repository.name}</h2><span>{analysis.repository.description ?? 'Sem descrição cadastrada no GitHub.'}</span></div></div><div className="repo-actions"><a className="primary-action" href={analysis.repository.htmlUrl} target="_blank" rel="noreferrer">Abrir GitHub</a></div><div className="repo-meta"><span><strong>{compact(analysis.repository.stars)}</strong> stars</span><span><strong>{compact(analysis.repository.forks)}</strong> forks</span><span><strong>{analysis.repository.defaultBranch}</strong> branch</span></div></header>
          <nav className="tabs">{([['overview','Visão geral'],['architecture','Arquitetura'],['files','Arquivos'],['dependencies','Dependências']] as const).map(([value,label]) => <button key={value} type="button" className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}</nav>
          {tab === 'overview' ? <Overview data={analysis} criteriaIds={appliedCriteria} /> : null}
          {tab === 'architecture' ? <Architecture layers={analysis.layers} /> : null}
          {tab === 'files' ? <Files entries={analysis.tree} truncated={analysis.treeTruncated} /> : null}
          {tab === 'dependencies' ? <Dependencies items={analysis.dependencies} /> : null}
        </> : null}
      </section>
    </main>
  );
}
