'use client';

import Link from 'next/link';
import {
  FormEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ArchitectureLayer,
  DependencyItem,
  OwnerQualitySummary,
  RepositoryAnalysis,
  StackItem,
  TreeEntry,
} from '@/types/repository';
import styles from './explorer-product.module.css';

type Tab = 'overview' | 'architecture' | 'files' | 'dependencies';
type SearchMode = 'repository' | 'owner' | 'project';

const modeConfig: Record<SearchMode, { label: string; placeholder: string; hint: string; examples: string[] }> = {
  repository: {
    label: 'Repositório',
    placeholder: 'owner/repository ou URL completa do GitHub',
    hint: 'Analisa arquitetura, stack, dependências e sinais de qualidade.',
    examples: ['leoo1992/pulsebi', 'vercel/next.js'],
  },
  owner: {
    label: 'Owner / profissional',
    placeholder: 'owner ou https://github.com/owner',
    hint: 'Analisa em lote os repositórios públicos de um profissional ou organização.',
    examples: ['leoo1992', 'vercel'],
  },
  project: {
    label: 'Só o projeto',
    placeholder: 'nome do projeto, ex.: next.js',
    hint: 'Busca o projeto público mais relevante pelo nome e inicia a análise.',
    examples: ['next.js', 'django'],
  },
};

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    search: 'M21 21l-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    github: 'M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 6.84a9.6 9.6 0 0 1 2.5.34c1.9-1.3 2.74-1.03 2.74-1.03.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z',
    branch: 'M6 3v12m0-8h7a3 3 0 0 0 3-3V3m0 0-3 3m3-3 3 3M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    layers: 'm12 2 9 5-9 5-9-5 9-5Zm9 10-9 5-9-5m18 5-9 5-9-5',
    check: 'm5 12 4 4L19 6',
    copy: 'M9 9h11v11H9V9ZM4 4h11v3M4 4v11h3',
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={icons[name] ?? icons.search} />
    </svg>
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function repositoryQualityPercent(data: RepositoryAnalysis) {
  const scoredSignals = data.qualitySignals.filter((item) => item.label !== 'TypeScript');
  const passed = scoredSignals.filter((item) => item.found).length;
  return Math.round((passed / Math.max(scoredSignals.length, 1)) * 100);
}

function categoryClass(category: StackItem['category']) {
  return `stack-chip stack-${category.toLowerCase()}`;
}

function normalizeOwnerInput(value: string) {
  const normalized = value.trim().replace(/\/+$/, '');
  const urlMatch = normalized.match(/^(?:https?:\/\/)?github\.com\/([^/?#]+)(?:[/?#].*)?$/i);
  const owner = (urlMatch?.[1] ?? normalized.replace(/^@/, '')).trim();
  if (!owner || !/^[A-Za-z0-9_.-]+$/.test(owner)) {
    throw new Error('Informe um owner do GitHub válido, como "vercel" ou https://github.com/vercel.');
  }
  return owner;
}

function Overview({
  data,
  ownerQuality,
  ownerQualityLoading,
  ownerQualityProgress,
  ownerQualityStatus,
  onStartOwnerQuality,
}: {
  data: RepositoryAnalysis;
  ownerQuality: OwnerQualitySummary | null;
  ownerQualityLoading: boolean;
  ownerQualityProgress: { analyzed: number; total: number } | null;
  ownerQualityStatus: string;
  onStartOwnerQuality: () => void;
}) {
  const scoredSignals = data.qualitySignals.filter((item) => item.label !== 'TypeScript');
  const passed = scoredSignals.filter((item) => item.found).length;
  const qualityPercent = repositoryQualityPercent(data);

  return (
    <div className="tab-content">
      <section className="metric-grid">
        <article><span>Arquivos</span><strong>{compactNumber(data.totals.files)}</strong><small>{data.totals.directories} diretórios</small></article>
        <article><span>Stack detectada</span><strong>{data.stack.length}</strong><small>tecnologias e ferramentas</small></article>
        <article><span>Qualidade</span><strong>{qualityPercent}%</strong><small>{passed}/{scoredSignals.length} critérios universais</small></article>
        <article>
          <span>Média do owner</span>
          <strong className="owner-quality-value">
            {ownerQualityLoading ? <span className="owner-spinner" aria-hidden="true" /> : null}
            {ownerQuality?.average !== null && ownerQuality?.average !== undefined
              ? `${ownerQuality.average}%`
              : ownerQualityLoading
                ? 'Analisando…'
                : '—'}
          </strong>
          <small>
            {ownerQualityLoading
              ? ownerQualityProgress?.total
                ? `${ownerQualityProgress.analyzed}/${ownerQualityProgress.total} · ${ownerQualityStatus}`
                : 'Preparando análise do portfólio público'
              : ownerQuality?.complete
                ? `${ownerQuality.analyzedRepositories}/${ownerQuality.totalRepositories} repositórios analisados`
                : 'Análise opcional do portfólio público'}
          </small>
          <button className="owner-quality-start" type="button" onClick={onStartOwnerQuality} disabled={ownerQualityLoading}>
            {ownerQualityLoading ? 'Verificação em andamento…' : `Avaliar owner ${data.repository.owner}`}
          </button>
        </article>
        <article><span>Manifestos</span><strong>{data.totals.manifests}</strong><small>package.json analisados</small></article>
      </section>

      <section className="overview-grid">
        <article className="panel">
          <div className="panel-head"><div><p>Composição</p><h2>Linguagens</h2></div></div>
          <div className="language-list">
            {data.languages.length ? data.languages.slice(0, 8).map((item, index) => (
              <div key={item.name} className="language-row">
                <div><span className={`language-dot language-dot-${(index % 5) + 1}`} /><strong>{item.name}</strong><small>{item.percentage.toFixed(1)}%</small></div>
                <div className="language-track"><span style={{ width: `${Math.max(item.percentage, 2)}%` }} /></div>
              </div>
            )) : <p className="muted">O GitHub não retornou dados de linguagem.</p>}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head"><div><p>Detecção</p><h2>Stack tecnológica</h2></div></div>
          <div className="stack-cloud">
            {data.stack.length ? data.stack.map((item) => (
              <span className={categoryClass(item.category)} key={`${item.category}-${item.name}`}>
                <strong>{item.name}</strong><small>{item.category}</small>
              </span>
            )) : <p className="muted">Nenhuma tecnologia conhecida foi detectada automaticamente.</p>}
          </div>
        </article>

        <article className="panel wide">
          <div className="panel-head"><div><p>Engineering signals</p><h2>Qualidade do repositório</h2></div></div>
          <div className="quality-grid">
            {data.qualitySignals.map((signal) => (
              <div className={signal.found ? 'quality-card quality-ok' : 'quality-card'} key={signal.label}>
                <span>{signal.found ? '✓' : '—'}</span>
                <div>
                  <strong>{signal.label}</strong>
                  <small>{signal.label === 'TypeScript' ? `${signal.detail} · informativo, não altera o score` : signal.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function Architecture({ layers, stack }: { layers: ArchitectureLayer[]; stack: StackItem[] }) {
  return (
    <div className="tab-content">
      <section className="architecture-map">
        {layers.map((layer, index) => (
          <div className="architecture-node-wrap" key={layer.name}>
            <article className="architecture-node">
              <span className="node-index">0{index + 1}</span>
              <p>{layer.name}</p><h3>{layer.role}</h3>
              <div>{layer.technologies.map((technology) => <span key={technology}>{technology}</span>)}</div>
            </article>
            {index < layers.length - 1 ? <div className="architecture-arrow">↓</div> : null}
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-head"><div><p>Evidências</p><h2>Como a stack foi detectada</h2></div></div>
        <div className="evidence-list">
          {stack.map((item) => (
            <div key={`${item.category}-${item.name}`}><span>{item.category}</span><strong>{item.name}</strong><small>{item.evidence}</small></div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Files({ entries, truncated }: { entries: TreeEntry[]; truncated: boolean }) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return normalized ? entries.filter((entry) => entry.path.toLowerCase().includes(normalized)) : entries;
  }, [entries, deferredQuery]);

  return (
    <div className="tab-content">
      <section className="panel">
        <div className="panel-head file-panel-head">
          <div><p>Repository tree</p><h2>Estrutura de arquivos</h2></div>
          <label className="file-search"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar arquivo ou pasta" /></label>
        </div>
        {truncated ? <p className="tree-note">Exibição resumida para manter a análise rápida em repositórios grandes.</p> : null}
        <div className="tree-list">
          {filtered.slice(0, 350).map((entry) => {
            const depth = Math.max(0, entry.path.split('/').length - 1);
            return (
              <div className="tree-row" key={`${entry.type}-${entry.path}`}>
                <span className="tree-indent" style={{ width: `${Math.min(depth, 5) * 17}px` }} />
                <span className={entry.type === 'tree' ? 'tree-type tree-folder' : 'tree-type'}>{entry.type === 'tree' ? '▰' : '▱'}</span>
                <span>{entry.path}</span>{entry.size !== null ? <small>{compactNumber(entry.size)} B</small> : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Dependencies({ items }: { items: DependencyItem[] }) {
  const [scope, setScope] = useState<'all' | DependencyItem['scope']>('all');
  const filtered = useMemo(() => items.filter((item) => scope === 'all' || item.scope === scope), [items, scope]);

  return (
    <div className="tab-content">
      <section className="panel">
        <div className="panel-head dependencies-head">
          <div><p>Package manifests</p><h2>Dependências</h2></div>
          <div className="segmented">
            {(['all', 'runtime', 'development'] as const).map((item) => (
              <button className={scope === item ? 'active' : ''} key={item} onClick={() => setScope(item)} type="button">
                {item === 'all' ? 'Todas' : item === 'runtime' ? 'Runtime' : 'Dev'}
              </button>
            ))}
          </div>
        </div>
        {filtered.length ? (
          <div className="dependency-table-wrap"><table className="dependency-table">
            <thead><tr><th>Pacote</th><th>Versão</th><th>Escopo</th><th>Manifesto</th></tr></thead>
            <tbody>{filtered.map((item, index) => (
              <tr key={`${item.manifest}-${item.scope}-${item.name}-${index}`}><td><strong>{item.name}</strong></td><td>{item.version}</td><td><span className="scope-pill">{item.scope}</span></td><td>{item.manifest}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">Nenhuma dependência encontrada nos manifestos analisados.</p>}
      </section>
    </div>
  );
}

function OwnerPortfolio({
  owner,
  summary,
  scores,
  loading,
  progress,
  status,
  onOpen,
  onRetry,
}: {
  owner: string;
  summary: OwnerQualitySummary | null;
  scores: Array<{ name: string; score: number }>;
  loading: boolean;
  progress: { analyzed: number; total: number } | null;
  status: string;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const total = progress?.total ?? summary?.totalRepositories ?? 0;
  const analyzed = progress?.analyzed ?? summary?.analyzedRepositories ?? scores.length;
  const below100 = scores.filter((item) => item.score < 100).length;
  const percentage = total ? Math.min(100, Math.round((analyzed / total) * 100)) : loading ? 8 : 100;

  return (
    <section className={styles.ownerPortfolio}>
      <div className={styles.ownerHero}>
        <div>
          <p className={styles.ownerEyebrow}>Portfolio engineering scan</p>
          <h2>@{owner}</h2>
          <p>Visão agregada da qualidade dos repositórios públicos. Útil para triagem técnica, due diligence de portfólio e revisão de engenharia.</p>
        </div>
        <div className={styles.ownerScore}>
          <strong>{summary?.average !== null && summary?.average !== undefined ? `${summary.average}%` : loading ? '…' : '—'}</strong>
          <span>média pública</span>
        </div>
      </div>

      <div className={styles.ownerMetrics}>
        <div className={styles.ownerMetric}><span>Repositórios</span><strong>{total || '—'}</strong><small>públicos encontrados</small></div>
        <div className={styles.ownerMetric}><span>Analisados</span><strong>{analyzed}</strong><small>com evidências verificadas</small></div>
        <div className={styles.ownerMetric}><span>Abaixo de 100%</span><strong>{scores.length ? below100 : '—'}</strong><small>oportunidades de melhoria</small></div>
      </div>

      <div className={styles.progressWrap}>
        <div className={styles.progressMeta}><span>{status || (summary?.complete ? 'Análise concluída' : 'Preparando análise')}</span><strong>{percentage}%</strong></div>
        <div className={styles.progressTrack}><div className={styles.progressBar} style={{ width: `${percentage}%` }} /></div>
      </div>

      <div className={styles.ownerActions}>
        {summary?.complete ? <button type="button" onClick={onOpen}>Ver repositórios que exigem atenção</button> : null}
        {!loading && !summary?.complete ? <button type="button" onClick={onRetry}>Tentar novamente</button> : null}
      </div>
      <p className={styles.trustNote}>O score mede sinais observáveis do repositório e não substitui entrevista técnica, contexto de projeto ou avaliação humana.</p>
    </section>
  );
}

export function ExplorerV2() {
  const [mode, setMode] = useState<SearchMode>('repository');
  const [input, setInput] = useState('leoo1992/pulsebi');
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [ownerTarget, setOwnerTarget] = useState<string | null>(null);
  const [ownerQuality, setOwnerQuality] = useState<OwnerQualitySummary | null>(null);
  const [ownerQualityLoading, setOwnerQualityLoading] = useState(false);
  const [ownerQualityProgress, setOwnerQualityProgress] = useState<{ analyzed: number; total: number } | null>(null);
  const [ownerQualityStatus, setOwnerQualityStatus] = useState('');
  const [ownerRepositoryScores, setOwnerRepositoryScores] = useState<Array<{ name: string; score: number }>>([]);
  const [ownerQualityModalOpen, setOwnerQualityModalOpen] = useState(false);
  const ownerQualityRequestRef = useRef(0);
  const analysisRequestRef = useRef(0);
  const analysisAbortRef = useRef<AbortController | null>(null);

  const resetOwnerQuality = () => {
    ownerQualityRequestRef.current += 1;
    setOwnerQuality(null);
    setOwnerQualityProgress(null);
    setOwnerQualityStatus('');
    setOwnerRepositoryScores([]);
    setOwnerQualityModalOpen(false);
    setOwnerQualityLoading(false);
  };

  const analyzeRepositoryInput = async (value = input, selectedMode: SearchMode = mode) => {
    const repo = value.trim();
    if (!repo) return;

    resetOwnerQuality();
    setOwnerTarget(null);
    setLoading(true);
    setError('');
    setInput(repo);
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    const requestId = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestId;

    try {
      const apiMode = selectedMode === 'project' ? 'project' : 'repository';
      const response = await fetch(`/api/analyze?repo=${encodeURIComponent(repo)}&mode=${apiMode}`, { signal: controller.signal });
      const body = (await response.json()) as RepositoryAnalysis | { error?: string };
      if (!response.ok) throw new Error('error' in body ? body.error : 'Falha ao analisar repositório.');
      if (requestId !== analysisRequestRef.current) return;

      const result = body as RepositoryAnalysis;
      setAnalysis(result);
      setTab('overview');
      setInput(result.repository.fullName);
      setMode('repository');
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('repo', result.repository.fullName);
      window.history.replaceState(null, '', url);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      if (requestId !== analysisRequestRef.current) return;
      setAnalysis(null);
      setError(caught instanceof Error ? caught.message : 'Falha ao analisar repositório.');
    } finally {
      if (requestId === analysisRequestRef.current) setLoading(false);
    }
  };

  const startOwnerQuality = (value: string, standalone: boolean) => {
    let owner: string;
    try {
      owner = normalizeOwnerInput(value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Owner inválido.');
      return;
    }

    analysisAbortRef.current?.abort();
    analysisRequestRef.current += 1;
    setLoading(false);
    setError('');
    setOwnerTarget(owner);
    setOwnerQuality(null);
    setOwnerQualityProgress(null);
    setOwnerRepositoryScores([]);
    setOwnerQualityModalOpen(false);
    setOwnerQualityLoading(true);
    setOwnerQualityStatus('Preparando análise em lotes paralelos');
    if (standalone) {
      setAnalysis(null);
      setInput(owner);
      setMode('owner');
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('owner', owner);
      window.history.replaceState(null, '', url);
    }

    const requestId = ownerQualityRequestRef.current + 1;
    ownerQualityRequestRef.current = requestId;

    void (async () => {
      let offset = 0;
      let total = 0;
      const scores: number[] = [];
      let failures = 0;

      try {
        while (requestId === ownerQualityRequestRef.current) {
          try {
            const response = await fetch(
              `/api/owner-quality?owner=${encodeURIComponent(owner)}&offset=${offset}&limit=6&quality_v=20261006perf1`,
              { cache: 'no-store' },
            );
            const batch = (await response.json()) as {
              totalRepositories?: number;
              scores?: number[];
              repositories?: Array<{ name: string; score: number }>;
              nextOffset?: number;
              complete?: boolean;
              error?: string;
            };
            if (!response.ok || !batch.scores || batch.totalRepositories === undefined) {
              throw new Error(batch.error ?? 'Falha ao analisar o owner.');
            }

            failures = 0;
            total = batch.totalRepositories;
            scores.push(...batch.scores);
            if (batch.repositories?.length) {
              setOwnerRepositoryScores((current) => [...current, ...batch.repositories!]);
            }
            offset = batch.nextOffset ?? scores.length;
            setOwnerQualityProgress({ analyzed: scores.length, total });

            const average = scores.length
              ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
              : null;
            const summary: OwnerQualitySummary = {
              owner,
              average,
              totalRepositories: total,
              analyzedRepositories: scores.length,
              complete: Boolean(batch.complete),
              scope: 'public',
              analyzedAt: new Date().toISOString(),
            };
            setOwnerQuality(summary);
            setOwnerQualityStatus(batch.complete ? 'Análise concluída' : `Analisando ${scores.length}/${total} repositórios`);

            if (batch.complete) {
              if (!standalone) setOwnerQualityModalOpen(true);
              break;
            }
          } catch (caught) {
            failures += 1;
            if (failures >= 4) throw caught;
            const waitMs = Math.min(750 * 2 ** failures, 6000);
            setOwnerQualityStatus(`API ocupada · nova tentativa automática`);
            await new Promise((resolve) => window.setTimeout(resolve, waitMs));
          }
        }
      } catch (caught) {
        if (requestId === ownerQualityRequestRef.current) {
          setError(caught instanceof Error ? caught.message : 'Não foi possível analisar o owner.');
          setOwnerQualityStatus('Análise interrompida');
        }
      } finally {
        if (requestId === ownerQualityRequestRef.current) setOwnerQualityLoading(false);
      }
    })();
  };

  const runSearch = (value = input, selectedMode: SearchMode = mode) => {
    setMode(selectedMode);
    if (selectedMode === 'owner') {
      startOwnerQuality(value, true);
    } else {
      void analyzeRepositoryInput(value, selectedMode);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const owner = params.get('owner');
    const repo = params.get('repo');
    const timer = window.setTimeout(() => {
      if (owner) {
        setMode('owner');
        setInput(owner);
        startOwnerQuality(owner, true);
      } else if (repo) {
        setMode('repository');
        setInput(repo);
        void analyzeRepositoryInput(repo, 'repository');
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // Carrega links compartilháveis apenas uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    runSearch();
  };

  const copyOwnerQualityTable = async () => {
    const below100 = ownerRepositoryScores.filter((item) => item.score < 100).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
    const table = ['| Repositório | Qualidade |', '| --- | ---: |', ...below100.map((item) => `| ${item.name.replace(/\|/g, '\\|')} | ${item.score}% |`)].join('\n');
    await navigator.clipboard.writeText(table);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const activeMode = modeConfig[mode];

  return (
    <main>
      <section className="hero">
        <div className="topbar shell">
          <Link className="brand" href="/" aria-label="RepoScope home">
            <span className="brand-mark"><Icon name="layers" /></span>
            <span><strong>RepoScope</strong><small>Engineering Intelligence</small></span>
          </Link>
          <a className="github-link" href="https://github.com/leoo1992/github-explorer" target="_blank" rel="noreferrer"><Icon name="github" /> GitHub</a>
        </div>

        <div className="hero-content shell">
          <div className="hero-copy">
            <p className="eyebrow">Hiring & engineering intelligence</p>
            <h1>Avalie engenharia por evidências, não apenas por currículo.</h1>
            <p>Transforme repositórios públicos em sinais objetivos de arquitetura, stack, qualidade e maturidade de engenharia para recrutamento, liderança técnica e revisão de software.</p>
          </div>

          <form className="repo-form" onSubmit={submit}>
            <div className={styles.modeSwitch} role="tablist" aria-label="Tipo de análise">
              {(Object.keys(modeConfig) as SearchMode[]).map((item) => (
                <button
                  className={`${styles.modeButton} ${mode === item ? styles.modeButtonActive : ''}`}
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={mode === item}
                  onClick={() => { setMode(item); setError(''); }}
                >
                  {modeConfig[item].label}
                </button>
              ))}
            </div>
            <div className="repo-input">
              <Icon name="search" />
              <input aria-label="Entrada do GitHub" value={input} onChange={(event) => setInput(event.target.value)} placeholder={activeMode.placeholder} spellCheck={false} />
              <button type="submit" disabled={loading || ownerQualityLoading}>{loading || ownerQualityLoading ? 'Analisando…' : 'Analisar'}</button>
            </div>
            <div className={styles.inputHint}><span>{activeMode.hint}</span><strong>GitHub público · sem login obrigatório</strong></div>
            <div className="examples"><span>Exemplos:</span>{activeMode.examples.map((example) => <button type="button" onClick={() => runSearch(example, mode)} key={example}>{example}</button>)}</div>
          </form>
        </div>
      </section>

      <section className="shell workspace">
        {error ? <div className="error-box"><strong>Não foi possível concluir a análise.</strong><span>{error}</span></div> : null}

        {!analysis && !loading && !ownerTarget && !error ? (
          <>
            <div className="empty-landing">
              <span className="empty-icon"><Icon name="branch" /></span>
              <h2>Uma entrada, três formas de avaliar</h2>
              <p>Use um repositório completo, apenas um owner ou somente o nome de um projeto público.</p>
            </div>
            <div className={styles.productGrid}>
              <article className={styles.productCard}><span className={styles.productTag}>Recrutamento</span><h3>Triagem técnica com evidências</h3><p>Revise portfólios públicos de candidatos sem abrir dezenas de repositórios manualmente.</p></article>
              <article className={styles.productCard}><span className={styles.productTag}>Tech Leads</span><h3>Leitura arquitetural rápida</h3><p>Entenda stack, camadas, CI, testes e organização antes de aprofundar a revisão de código.</p></article>
              <article className={styles.productCard}><span className={styles.productTag}>Empresas</span><h3>Critério padronizado</h3><p>Use os mesmos sinais de engenharia para comparar projetos e reduzir avaliações subjetivas.</p></article>
            </div>
          </>
        ) : null}

        {loading ? <div className="loading-layout"><div className="skeleton skeleton-title" /><div className="skeleton-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton" key={index} />)}</div><div className="skeleton skeleton-panel" /></div> : null}

        {ownerTarget && !analysis ? (
          <OwnerPortfolio
            owner={ownerTarget}
            summary={ownerQuality}
            scores={ownerRepositoryScores}
            loading={ownerQualityLoading}
            progress={ownerQualityProgress}
            status={ownerQualityStatus}
            onOpen={() => setOwnerQualityModalOpen(true)}
            onRetry={() => startOwnerQuality(ownerTarget, true)}
          />
        ) : null}

        {analysis && !loading ? (
          <>
            <header className="repo-header">
              <div className="repo-identity"><div className="repo-icon"><Icon name="github" /></div><div><p>{analysis.repository.owner}</p><h2>{analysis.repository.name}</h2><span>{analysis.repository.description ?? 'Sem descrição cadastrada no GitHub.'}</span></div></div>
              <div className="repo-actions"><button className="secondary-action" type="button" onClick={() => void copyShareLink()}><Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Copiado' : 'Compartilhar'}</button><a className="primary-action" href={analysis.repository.htmlUrl} target="_blank" rel="noreferrer"><Icon name="github" /> Abrir GitHub</a></div>
              <div className="repo-meta"><span><strong>{compactNumber(analysis.repository.stars)}</strong> stars</span><span><strong>{compactNumber(analysis.repository.forks)}</strong> forks</span><span><strong>{analysis.repository.defaultBranch}</strong> branch</span><span><strong>{formatDate(analysis.repository.updatedAt)}</strong> atualizado</span></div>
            </header>

            <nav className="tabs" aria-label="Visões da análise">
              {([['overview', 'Visão geral'], ['architecture', 'Arquitetura'], ['files', 'Arquivos'], ['dependencies', 'Dependências']] as const).map(([value, label]) => <button className={tab === value ? 'active' : ''} key={value} type="button" onClick={() => setTab(value)}>{label}</button>)}
            </nav>

            {tab === 'overview' ? <Overview data={analysis} ownerQuality={ownerQuality} ownerQualityLoading={ownerQualityLoading} ownerQualityProgress={ownerQualityProgress} ownerQualityStatus={ownerQualityStatus} onStartOwnerQuality={() => startOwnerQuality(analysis.repository.owner, false)} /> : null}
            {tab === 'architecture' ? <Architecture layers={analysis.layers} stack={analysis.stack} /> : null}
            {tab === 'files' ? <Files entries={analysis.tree} truncated={analysis.treeTruncated} /> : null}
            {tab === 'dependencies' ? <Dependencies items={analysis.dependencies} /> : null}

            <footer className="analysis-footer"><span>Analisado em {new Date(analysis.analyzedAt).toLocaleString('pt-BR')}</span><span>{analysis.rateLimitRemaining !== null ? `API GitHub: ${analysis.rateLimitRemaining} requisições restantes` : 'API GitHub'}</span></footer>
          </>
        ) : null}
      </section>

      {ownerQualityModalOpen && ownerQuality?.complete ? (
        <div className="quality-modal-backdrop" role="presentation" onClick={() => setOwnerQualityModalOpen(false)}>
          <section className="quality-modal" role="dialog" aria-modal="true" aria-labelledby="owner-quality-title" onClick={(event) => event.stopPropagation()}>
            <div className="quality-modal-head"><div><small>ANÁLISE CONCLUÍDA</small><h2 id="owner-quality-title">Qualidade dos repositórios</h2><p>{ownerRepositoryScores.length}/{ownerQuality.totalRepositories} públicos · média {ownerQuality.average}%</p></div><button type="button" onClick={() => setOwnerQualityModalOpen(false)} aria-label="Fechar">×</button></div>
            <div className="quality-modal-actions"><button type="button" onClick={() => void copyOwnerQualityTable()}><Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Tabela copiada' : 'Copiar tabela'}</button></div>
            <div className="quality-modal-list">
              {ownerRepositoryScores.some((item) => item.score < 100) ? (
                <div className="quality-modal-table-wrap"><table className="quality-modal-table"><thead><tr><th>Repositório</th><th>Qualidade</th></tr></thead><tbody>{[...ownerRepositoryScores].filter((item) => item.score < 100).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).map((item) => <tr key={item.name}><td>{item.name}</td><td><strong>{item.score}%</strong></td></tr>)}</tbody></table></div>
              ) : <p className="quality-modal-perfect">Todos os repositórios públicos atingiram 100%.</p>}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
