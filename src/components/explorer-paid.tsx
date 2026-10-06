'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import type {
  ArchitectureLayer,
  DependencyItem,
  OwnerQualitySummary,
  RepositoryAnalysis,
  TreeEntry,
} from '@/types/repository';

type SearchMode = 'repository' | 'owner' | 'project';
type Tab = 'overview' | 'architecture' | 'files' | 'dependencies';

type OwnerRepositoryScore = { name: string; score: number };

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

function qualityPercent(data: RepositoryAnalysis) {
  const scored = data.qualitySignals.filter((item) => item.label !== 'TypeScript');
  if (!scored.length) return 0;
  return Math.round((scored.filter((item) => item.found).length / scored.length) * 100);
}

function compact(value: number) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function normalizeOwner(value: string) {
  const normalized = value.trim().replace(/\/+$/, '');
  const match = normalized.match(/^(?:https?:\/\/)?github\.com\/([^/?#]+)(?:[/?#].*)?$/i);
  const owner = (match?.[1] ?? normalized.replace(/^@/, '')).trim();
  if (!owner || !/^[A-Za-z0-9_.-]+$/.test(owner)) throw new Error('Informe um owner válido do GitHub.');
  return owner;
}

function Overview({ data }: { data: RepositoryAnalysis }) {
  const score = qualityPercent(data);
  return (
    <div className="tab-content">
      <section className="metric-grid">
        <article><span>Qualidade</span><strong>{score}%</strong><small>sinais observáveis</small></article>
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
          <div className="panel-head"><div><p>Engineering signals</p><h2>Evidências de qualidade</h2></div></div>
          <div className="quality-grid">
            {data.qualitySignals.map((signal) => (
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

function OwnerResult({ summary, repositories, status }: { summary: OwnerQualitySummary | null; repositories: OwnerRepositoryScore[]; status: string }) {
  const attention = repositories.filter((item) => item.score < 100).sort((a, b) => a.score - b.score);
  return (
    <section className="panel">
      <div className="panel-head"><div><p>Portfolio engineering scan</p><h2>@{summary?.owner ?? 'owner'}</h2></div></div>
      <section className="metric-grid">
        <article><span>Média pública</span><strong>{summary?.average ?? '—'}{summary?.average !== null && summary?.average !== undefined ? '%' : ''}</strong><small>sinais técnicos agregados</small></article>
        <article><span>Repositórios</span><strong>{summary?.totalRepositories ?? '—'}</strong><small>públicos encontrados</small></article>
        <article><span>Analisados</span><strong>{summary?.analyzedRepositories ?? repositories.length}</strong><small>{status || 'em processamento'}</small></article>
        <article><span>Com atenção</span><strong>{attention.length}</strong><small>score abaixo de 100%</small></article>
      </section>
      {attention.length ? <div className="dependency-table-wrap"><table className="dependency-table"><thead><tr><th>Repositório</th><th>Qualidade</th></tr></thead><tbody>{attention.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.score}%</td></tr>)}</tbody></table></div> : null}
      <p className="tree-note">O score mede sinais observáveis do repositório. Não representa competência profissional e não deve ser usado como decisão automática de contratação.</p>
    </section>
  );
}

export function ExplorerPaid() {
  const [mode, setMode] = useState<SearchMode>('repository');
  const [input, setInput] = useState('vercel/next.js');
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [ownerSummary, setOwnerSummary] = useState<OwnerQualitySummary | null>(null);
  const [ownerScores, setOwnerScores] = useState<OwnerRepositoryScore[]>([]);
  const [ownerStatus, setOwnerStatus] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function analyzeRepository(value: string, selectedMode: SearchMode) {
    setLoading(true); setError(''); setAnalysis(null); setOwnerSummary(null); setOwnerScores([]);
    try {
      const response = await fetch(`/api/analyze?repo=${encodeURIComponent(value)}&mode=${selectedMode === 'project' ? 'project' : 'repository'}`, { cache: 'no-store' });
      const body = (await response.json()) as RepositoryAnalysis | { error?: string };
      if (!response.ok) throw new Error('error' in body ? body.error : 'Falha ao analisar repositório.');
      const result = body as RepositoryAnalysis;
      setAnalysis(result); setInput(result.repository.fullName); setMode('repository'); setTab('overview');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao analisar repositório.');
    } finally { setLoading(false); }
  }

  async function analyzeOwner(value: string) {
    let owner: string;
    try { owner = normalizeOwner(value); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Owner inválido.'); return; }
    setLoading(true); setError(''); setAnalysis(null); setOwnerSummary(null); setOwnerScores([]); setOwnerStatus('Iniciando análise');
    let offset = 0; const scores: number[] = [];
    try {
      while (true) {
        const response = await fetch(`/api/owner-quality?owner=${encodeURIComponent(owner)}&offset=${offset}&limit=6`, { cache: 'no-store' });
        const batch = await response.json() as { totalRepositories?: number; scores?: number[]; repositories?: OwnerRepositoryScore[]; nextOffset?: number; complete?: boolean; error?: string };
        if (!response.ok || !batch.scores || batch.totalRepositories === undefined) throw new Error(batch.error ?? 'Falha ao analisar owner.');
        scores.push(...batch.scores); setOwnerScores((current) => [...current, ...(batch.repositories ?? [])]);
        offset = batch.nextOffset ?? scores.length;
        const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
        setOwnerSummary({ owner, average, totalRepositories: batch.totalRepositories, analyzedRepositories: scores.length, complete: Boolean(batch.complete), scope: 'public', analyzedAt: new Date().toISOString() });
        setOwnerStatus(batch.complete ? 'Análise concluída' : `${scores.length}/${batch.totalRepositories} analisados`);
        if (batch.complete) break;
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha ao analisar owner.'); }
    finally { setLoading(false); }
  }

  function run(value = input, selectedMode = mode) {
    const normalized = value.trim();
    if (!normalized) return;
    setInput(normalized); setMode(selectedMode);
    if (selectedMode === 'owner') void analyzeOwner(normalized); else void analyzeRepository(normalized, selectedMode);
  }

  function submit(event: FormEvent) { event.preventDefault(); run(); }
  const active = modes[mode];

  return (
    <main>
      <section className="hero">
        <div className="topbar shell">
          <Link className="brand" href="/"><span className="brand-mark">RS</span><span><strong>RepoScope</strong><small>Engineering Intelligence</small></span></Link>
          <div className="repo-actions"><Link className="secondary-action" href="/pricing">Plano Pro</Link><form action="/auth/signout" method="post"><button className="secondary-action" type="submit">Sair</button></form></div>
        </div>
        <div className="hero-content shell">
          <div className="hero-copy"><p className="eyebrow">ASSINATURA ATIVA</p><h1>Avalie projetos públicos com evidências técnicas.</h1><p>Use URL de repositório, owner ou nome de projeto. O motor analisa sinais observáveis do GitHub e apresenta o contexto técnico de forma estruturada.</p></div>
          <form className="repo-form" onSubmit={submit}>
            <div className="segmented">{(Object.keys(modes) as SearchMode[]).map((item) => <button key={item} className={mode === item ? 'active' : ''} type="button" onClick={() => { setMode(item); setError(''); }}>{modes[item].label}</button>)}</div>
            <div className="repo-input"><input aria-label="Entrada do GitHub" value={input} onChange={(event) => setInput(event.target.value)} placeholder={active.placeholder} spellCheck={false} /><button type="submit" disabled={loading}>{loading ? 'Analisando…' : 'Analisar'}</button></div>
            <div className="examples"><span>{active.hint} Exemplos:</span>{active.examples.map((example) => <button key={example} type="button" onClick={() => run(example, mode)}>{example}</button>)}</div>
          </form>
        </div>
      </section>

      <section className="shell workspace">
        {error ? <div className="error-box"><strong>Não foi possível concluir.</strong><span>{error}</span></div> : null}
        {loading && !ownerSummary ? <div className="loading-layout"><div className="skeleton skeleton-title" /><div className="skeleton-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton" key={index} />)}</div><div className="skeleton skeleton-panel" /></div> : null}
        {!analysis && !ownerSummary && !loading && !error ? <div className="empty-landing"><h2>Escolha o tipo de análise acima.</h2><p>O acesso está liberado pela sua assinatura ativa.</p></div> : null}
        {ownerSummary ? <OwnerResult summary={ownerSummary} repositories={ownerScores} status={ownerStatus} /> : null}
        {analysis ? <>
          <header className="repo-header"><div className="repo-identity"><div className="repo-icon">◆</div><div><p>{analysis.repository.owner}</p><h2>{analysis.repository.name}</h2><span>{analysis.repository.description ?? 'Sem descrição cadastrada no GitHub.'}</span></div></div><div className="repo-actions"><a className="primary-action" href={analysis.repository.htmlUrl} target="_blank" rel="noreferrer">Abrir GitHub</a></div><div className="repo-meta"><span><strong>{compact(analysis.repository.stars)}</strong> stars</span><span><strong>{compact(analysis.repository.forks)}</strong> forks</span><span><strong>{analysis.repository.defaultBranch}</strong> branch</span></div></header>
          <nav className="tabs">{([['overview','Visão geral'],['architecture','Arquitetura'],['files','Arquivos'],['dependencies','Dependências']] as const).map(([value,label]) => <button key={value} type="button" className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}</nav>
          {tab === 'overview' ? <Overview data={analysis} /> : null}
          {tab === 'architecture' ? <Architecture layers={analysis.layers} /> : null}
          {tab === 'files' ? <Files entries={analysis.tree} truncated={analysis.treeTruncated} /> : null}
          {tab === 'dependencies' ? <Dependencies items={analysis.dependencies} /> : null}
        </> : null}
      </section>
    </main>
  );
}
