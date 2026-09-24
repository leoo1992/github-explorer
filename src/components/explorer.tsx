'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  ArchitectureLayer,
  DependencyItem,
  RepositoryAnalysis,
  StackItem,
  TreeEntry,
} from '@/types/repository';

type Tab = 'overview' | 'architecture' | 'files' | 'dependencies';

const examples = [
  'leoo1992/pulsebi',
  'leoo1992/Portfolio_Novo_Leonardo',
  'vercel/next.js',
];

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    search: 'M21 21l-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    github: 'M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 6.84a9.6 9.6 0 0 1 2.5.34c1.9-1.3 2.74-1.03 2.74-1.03.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z',
    branch: 'M6 3v12m0-8h7a3 3 0 0 0 3-3V3m0 0-3 3m3-3 3 3M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    file: 'M6 2h8l4 4v16H6V2Zm8 0v5h5',
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

function normalizeInput(value: string) {
  return value.trim();
}

function categoryClass(category: StackItem['category']) {
  return `stack-chip stack-${category.toLowerCase()}`;
}

function Overview({ data }: { data: RepositoryAnalysis }) {
  const scoredSignals = data.qualitySignals.filter(
    (item) => item.label !== 'TypeScript',
  );
  const passed = scoredSignals.filter((item) => item.found).length;
  const qualityPercent = Math.round(
    (passed / Math.max(scoredSignals.length, 1)) * 100,
  );

  return (
    <div className="tab-content">
      <section className="metric-grid">
        <article><span>Arquivos</span><strong>{compactNumber(data.totals.files)}</strong><small>{data.totals.directories} diretórios</small></article>
        <article><span>Stack detectada</span><strong>{data.stack.length}</strong><small>tecnologias e ferramentas</small></article>
        <article><span>Qualidade</span><strong>{qualityPercent}%</strong><small>{passed}/{scoredSignals.length} critérios universais</small></article>
        <article><span>Manifestos</span><strong>{data.totals.manifests}</strong><small>package.json analisados</small></article>
      </section>

      <section className="overview-grid">
        <article className="panel">
          <div className="panel-head">
            <div><p>Composição</p><h2>Linguagens</h2></div>
          </div>
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
          <div className="panel-head">
            <div><p>Detecção</p><h2>Stack tecnológica</h2></div>
          </div>
          <div className="stack-cloud">
            {data.stack.length ? data.stack.map((item) => (
              <span className={categoryClass(item.category)} key={`${item.category}-${item.name}`}>
                <strong>{item.name}</strong>
                <small>{item.category}</small>
              </span>
            )) : <p className="muted">Nenhuma tecnologia conhecida foi detectada automaticamente.</p>}
          </div>
        </article>

        <article className="panel wide">
          <div className="panel-head">
            <div><p>Engineering signals</p><h2>Qualidade do repositório</h2></div>
          </div>
          <div className="quality-grid">
            {data.qualitySignals.map((signal) => (
              <div className={signal.found ? 'quality-card quality-ok' : 'quality-card'} key={signal.label}>
                <span>{signal.found ? '✓' : '—'}</span>
                <div>
                  <strong>{signal.label}</strong>
                  <small>
                    {signal.label === 'TypeScript'
                      ? `${signal.detail} · informativo, não altera o score`
                      : signal.detail}
                  </small>
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
              <p>{layer.name}</p>
              <h3>{layer.role}</h3>
              <div>
                {layer.technologies.map((technology) => (
                  <span key={technology}>{technology}</span>
                ))}
              </div>
            </article>
            {index < layers.length - 1 ? <div className="architecture-arrow">↓</div> : null}
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div><p>Evidências</p><h2>Como a stack foi detectada</h2></div>
        </div>
        <div className="evidence-list">
          {stack.map((item) => (
            <div key={`${item.category}-${item.name}`}>
              <span>{item.category}</span>
              <strong>{item.name}</strong>
              <small>{item.evidence}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Files({ entries, truncated }: { entries: TreeEntry[]; truncated: boolean }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? entries.filter((entry) => entry.path.toLowerCase().includes(normalized))
      : entries;
  }, [entries, query]);

  return (
    <div className="tab-content">
      <section className="panel">
        <div className="panel-head file-panel-head">
          <div><p>Repository tree</p><h2>Estrutura de arquivos</h2></div>
          <label className="file-search">
            <Icon name="search" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar arquivo ou pasta" />
          </label>
        </div>
        {truncated ? (
          <p className="tree-note">Exibição resumida para manter a análise rápida em repositórios grandes.</p>
        ) : null}
        <div className="tree-list">
          {filtered.slice(0, 350).map((entry) => {
            const depth = Math.max(0, entry.path.split('/').length - 1);
            return (
              <div className="tree-row" key={`${entry.type}-${entry.path}`}>
                <span className="tree-indent" style={{ width: `${Math.min(depth, 5) * 17}px` }} />
                <span className={entry.type === 'tree' ? 'tree-type tree-folder' : 'tree-type'}>{entry.type === 'tree' ? '▰' : '▱'}</span>
                <span>{entry.path}</span>
                {entry.size !== null ? <small>{compactNumber(entry.size)} B</small> : null}
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
  const filtered = items.filter((item) => scope === 'all' || item.scope === scope);

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
          <div className="dependency-table-wrap">
            <table className="dependency-table">
              <thead><tr><th>Pacote</th><th>Versão</th><th>Escopo</th><th>Manifesto</th></tr></thead>
              <tbody>
                {filtered.map((item, index) => (
                  <tr key={`${item.manifest}-${item.scope}-${item.name}-${index}`}>
                    <td><strong>{item.name}</strong></td>
                    <td>{item.version}</td>
                    <td><span className="scope-pill">{item.scope}</span></td>
                    <td>{item.manifest}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">Nenhuma dependência encontrada nos manifestos analisados.</p>}
      </section>
    </div>
  );
}

export function Explorer() {
  const [input, setInput] = useState('leoo1992/pulsebi');
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const analyze = async (value = input) => {
    const repo = normalizeInput(value);
    if (!repo) return;

    setLoading(true);
    setError('');
    setInput(repo);

    try {
      const response = await fetch(`/api/analyze?repo=${encodeURIComponent(repo)}`);
      const body = (await response.json()) as RepositoryAnalysis | { error?: string };
      if (!response.ok) {
        throw new Error('error' in body ? body.error : 'Falha ao analisar repositório.');
      }

      setAnalysis(body as RepositoryAnalysis);
      setTab('overview');
      const url = new URL(window.location.href);
      url.searchParams.set('repo', (body as RepositoryAnalysis).repository.fullName);
      window.history.replaceState(null, '', url);
    } catch (caught) {
      setAnalysis(null);
      setError(caught instanceof Error ? caught.message : 'Falha ao analisar repositório.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const repo = new URLSearchParams(window.location.search).get('repo');
    if (!repo) return;

    const timer = window.setTimeout(() => {
      setInput(repo);
      void analyze(repo);
    }, 0);

    return () => window.clearTimeout(timer);
    // Executar apenas na carga inicial para suportar links compartilháveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void analyze();
  };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <main>
      <section className="hero">
        <div className="topbar shell">
          <Link className="brand" href="/" aria-label="RepoScope home">
            <span className="brand-mark"><Icon name="layers" /></span>
            <span><strong>RepoScope</strong><small>GitHub Architecture Explorer</small></span>
          </Link>
          <a className="github-link" href="https://github.com/leoo1992/github-explorer" target="_blank" rel="noreferrer">
            <Icon name="github" /> Código
          </a>
        </div>

        <div className="hero-content shell">
          <div className="hero-copy">
            <p className="eyebrow">Repository intelligence</p>
            <h1>Entenda a arquitetura de um repositório em segundos.</h1>
            <p>
              Analise stack, camadas arquiteturais, linguagens, dependências, estrutura e sinais de qualidade de qualquer repositório público do GitHub.
            </p>
          </div>

          <form className="repo-form" onSubmit={submit}>
            <div className="repo-input">
              <Icon name="search" />
              <input
                aria-label="Repositório do GitHub"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="owner/repository ou URL do GitHub"
                spellCheck={false}
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Analisando…' : 'Analisar'}
              </button>
            </div>
            <div className="examples">
              <span>Exemplos:</span>
              {examples.map((example) => (
                <button type="button" onClick={() => void analyze(example)} key={example}>{example}</button>
              ))}
            </div>
          </form>
        </div>
      </section>

      <section className="shell workspace">
        {error ? <div className="error-box"><strong>Não foi possível analisar.</strong><span>{error}</span></div> : null}

        {!analysis && !loading && !error ? (
          <div className="empty-landing">
            <span className="empty-icon"><Icon name="branch" /></span>
            <h2>Comece por um repositório público</h2>
            <p>O RepoScope usa a API oficial do GitHub e não precisa de login para analisar projetos públicos.</p>
          </div>
        ) : null}

        {loading ? (
          <div className="loading-layout">
            <div className="skeleton skeleton-title" />
            <div className="skeleton-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton" key={index} />)}</div>
            <div className="skeleton skeleton-panel" />
          </div>
        ) : null}

        {analysis && !loading ? (
          <>
            <header className="repo-header">
              <div className="repo-identity">
                <div className="repo-icon"><Icon name="github" /></div>
                <div>
                  <p>{analysis.repository.owner}</p>
                  <h2>{analysis.repository.name}</h2>
                  <span>{analysis.repository.description ?? 'Sem descrição cadastrada no GitHub.'}</span>
                </div>
              </div>

              <div className="repo-actions">
                <button className="secondary-action" type="button" onClick={() => void copyShareLink()}>
                  <Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Copiado' : 'Compartilhar'}
                </button>
                <a className="primary-action" href={analysis.repository.htmlUrl} target="_blank" rel="noreferrer">
                  <Icon name="github" /> Abrir GitHub
                </a>
              </div>

              <div className="repo-meta">
                <span><strong>{compactNumber(analysis.repository.stars)}</strong> stars</span>
                <span><strong>{compactNumber(analysis.repository.forks)}</strong> forks</span>
                <span><strong>{analysis.repository.defaultBranch}</strong> branch</span>
                <span><strong>{formatDate(analysis.repository.updatedAt)}</strong> atualizado</span>
              </div>
            </header>

            <nav className="tabs" aria-label="Visões da análise">
              {([
                ['overview', 'Visão geral'],
                ['architecture', 'Arquitetura'],
                ['files', 'Arquivos'],
                ['dependencies', 'Dependências'],
              ] as const).map(([value, label]) => (
                <button className={tab === value ? 'active' : ''} key={value} type="button" onClick={() => setTab(value)}>
                  {label}
                </button>
              ))}
            </nav>

            {tab === 'overview' ? <Overview data={analysis} /> : null}
            {tab === 'architecture' ? <Architecture layers={analysis.layers} stack={analysis.stack} /> : null}
            {tab === 'files' ? <Files entries={analysis.tree} truncated={analysis.treeTruncated} /> : null}
            {tab === 'dependencies' ? <Dependencies items={analysis.dependencies} /> : null}

            <footer className="analysis-footer">
              <span>Analisado em {new Date(analysis.analyzedAt).toLocaleString('pt-BR')}</span>
              <span>{analysis.rateLimitRemaining !== null ? `API GitHub: ${analysis.rateLimitRemaining} requisições restantes` : 'API GitHub'}</span>
            </footer>
          </>
        ) : null}
      </section>
    </main>
  );
}
