'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BrandIcon } from '@/components/brand-icon';
import {
  DEFAULT_QUALITY_CRITERIA_IDS,
  QUALITY_CRITERIA,
  QUALITY_LANGUAGES,
  QUALITY_PRESETS,
  calculateQualityScore,
  qualityCriteriaForLanguage,
  qualityCriterionLabels,
  type QualityLanguage,
} from '@/lib/quality-criteria';
import type { RecentAnalysis } from '@/lib/usage';
import type {
  ArchitectureLayer,
  DependencyItem,
  RepositoryAnalysis,
  TreeEntry,
} from '@/types/repository';

type Tab = 'overview' | 'architecture' | 'files' | 'dependencies';
type AnalysisState = 'idle' | 'running' | 'waiting' | 'complete' | 'empty';

type AnalysisControl = {
  state?: 'waiting' | 'not_found' | 'input';
  retryAfterMs?: number;
};

type CustomQualityPreset = {
  id: string;
  name: string;
  language: QualityLanguage | null;
  criteriaIds: string[];
  createdAt: string;
  updatedAt: string;
};

const repositoryInput = {
  hint: 'Arquitetura, stack, dependências e sinais de qualidade.',
  examples: [
    { owner: 'leoo1992', repository: 'github-explorer' },
    { owner: 'vercel', repository: 'next.js' },
  ],
} as const;

function isGitHubSegmentValid(value: string) {
  return /^[A-Za-z0-9_.-]+$/.test(value.trim());
}

function compact(value: number) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function parseRecentRepository(value: string) {
  try {
    const url = new URL(value);
    const [owner, repository] = url.pathname.split('/').filter(Boolean);
    return owner && repository ? { owner, repository } : null;
  } catch {
    const [owner, repository] = value.split('/').filter(Boolean);
    return owner && repository ? { owner, repository } : null;
  }
}

function formatRecentDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
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

function Overview({ data, criteriaIds }: { data: RepositoryAnalysis; criteriaIds: string[] }) {
  const repositoryLanguages = data.languages.map((language) => language.name);
  const score = calculateQualityScore(data.qualitySignals, criteriaIds, repositoryLanguages);
  const labels = qualityCriterionLabels(criteriaIds, repositoryLanguages);
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
          <div className="panel-head"><div><p>Engineering signals</p><h2>Critérios considerados na nota</h2></div><span className="criteria-count">{visibleSignals.length} aplicáveis · {criteriaIds.length} selecionados</span></div>
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

function CriteriaSelector({
  selected,
  setSelected,
  disabled,
  presetAccess,
}: {
  selected: string[];
  setSelected: (ids: string[]) => void;
  disabled: boolean;
  presetAccess: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [languageFilter, setLanguageFilter] = useState<'all' | 'global' | QualityLanguage>('all');
  const [customPresets, setCustomPresets] = useState<CustomQualityPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [presetLanguage, setPresetLanguage] = useState<QualityLanguage | ''>('');
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetMessage, setPresetMessage] = useState('');

  useEffect(() => {
    if (!presetAccess) return;
    let active = true;

    void fetch('/api/quality-presets', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as { presets: CustomQualityPreset[] };
      })
      .then((body) => {
        if (active && body?.presets) setCustomPresets(body.presets);
      })
      .catch(() => {
        if (active) setPresetMessage('Não foi possível carregar seus presets agora.');
      });

    return () => {
      active = false;
    };
  }, [presetAccess]);

  const visibleCriteria = QUALITY_CRITERIA.filter((criterion) => {
    if (languageFilter === 'all') return true;
    if (languageFilter === 'global') return !criterion.languages?.length;
    return !criterion.languages?.length || criterion.languages.includes(languageFilter);
  });
  const groups = [...new Set(visibleCriteria.map((criterion) => criterion.group))];

  function toggle(id: string) {
    if (disabled) return;
    if (selected.includes(id)) {
      if (selected.length === 1) return;
      setSelected(selected.filter((item) => item !== id));
    } else {
      setSelected([...selected, id]);
    }
  }

  function applyCustomPreset(preset: CustomQualityPreset) {
    if (disabled) return;
    setSelected([...preset.criteriaIds]);
    setLanguageFilter(preset.language ?? 'all');
    setPresetMessage(`Preset "${preset.name}" aplicado.`);
  }

  async function savePreset() {
    const name = presetName.trim();
    if (!name || disabled || presetBusy) return;

    setPresetBusy(true);
    setPresetMessage('');

    try {
      const response = await fetch('/api/quality-presets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          language: presetLanguage || null,
          criteriaIds: selected,
        }),
      });
      const body = await response.json() as { preset?: CustomQualityPreset; error?: string };

      if (!response.ok || !body.preset) {
        setPresetMessage(body.error ?? 'Não foi possível salvar o preset.');
        return;
      }

      setCustomPresets((current) => [
        body.preset!,
        ...current.filter((item) => item.id !== body.preset!.id),
      ]);
      setSelected([...body.preset.criteriaIds]);
      setPresetName('');
      setPresetMessage('Preset salvo e pronto para uso.');
    } catch {
      setPresetMessage('Não foi possível salvar o preset agora.');
    } finally {
      setPresetBusy(false);
    }
  }

  async function deletePreset(id: string) {
    if (disabled || presetBusy) return;
    setPresetBusy(true);
    setPresetMessage('');

    try {
      const response = await fetch(`/api/quality-presets?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        setPresetMessage(body?.error ?? 'Não foi possível remover o preset.');
        return;
      }
      setCustomPresets((current) => current.filter((item) => item.id !== id));
      setPresetMessage('Preset removido.');
    } catch {
      setPresetMessage('Não foi possível remover o preset agora.');
    } finally {
      setPresetBusy(false);
    }
  }

  return (
    <div className="criteria-selector">
      <button className="criteria-trigger" type="button" onClick={() => setOpen((value) => !value)} disabled={disabled} aria-expanded={open}>
        <span><strong>Critérios da nota</strong><small>{selected.length} selecionados · {QUALITY_CRITERIA.length} disponíveis</small></span>
        <b>{open ? '−' : '+'}</b>
      </button>
      {open ? <div className="criteria-panel">
        <div className="criteria-presets">
          <span>Cenários rápidos</span>
          {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
            <button key={key} type="button" disabled={disabled} onClick={() => setSelected([...preset.ids])}>{preset.label}</button>
          ))}
        </div>

        <div className="criteria-toolbar">
          <label>
            <span>Exibir critérios</span>
            <select
              value={languageFilter}
              disabled={disabled}
              onChange={(event) => setLanguageFilter(event.target.value as 'all' | 'global' | QualityLanguage)}
            >
              <option value="all">Todas as linguagens</option>
              <option value="global">Somente globais</option>
              {QUALITY_LANGUAGES.map((language) => <option value={language} key={language}>{language}</option>)}
            </select>
          </label>
          {languageFilter !== 'all' && languageFilter !== 'global' ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setSelected(qualityCriteriaForLanguage(languageFilter))}
            >
              Selecionar globais + {languageFilter}
            </button>
          ) : null}
        </div>

        {presetAccess ? <div className="preset-manager">
          <div className="preset-head">
            <div><strong>Meus presets</strong><small>Exclusivo do plano ativo · até 20 presets</small></div>
            <span>{customPresets.length}/20</span>
          </div>

          {customPresets.length ? <div className="custom-preset-list">
            {customPresets.map((preset) => (
              <div className="custom-preset-row" key={preset.id}>
                <button type="button" disabled={disabled || presetBusy} onClick={() => applyCustomPreset(preset)}>
                  <strong>{preset.name}</strong>
                  <small>{preset.language ?? 'Geral'} · {preset.criteriaIds.length} critérios</small>
                </button>
                <button
                  className="preset-delete"
                  type="button"
                  aria-label={`Remover preset ${preset.name}`}
                  disabled={disabled || presetBusy}
                  onClick={() => void deletePreset(preset.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div> : <small className="preset-empty">Você ainda não criou presets personalizados.</small>}

          <div className="preset-editor">
            <input
              value={presetName}
              maxLength={60}
              placeholder="Nome do preset"
              disabled={disabled || presetBusy}
              onChange={(event) => setPresetName(event.target.value)}
            />
            <select
              value={presetLanguage}
              disabled={disabled || presetBusy}
              onChange={(event) => setPresetLanguage(event.target.value as QualityLanguage | '')}
            >
              <option value="">Geral / multilíngue</option>
              {QUALITY_LANGUAGES.map((language) => <option value={language} key={language}>{language}</option>)}
            </select>
            {presetLanguage ? (
              <button
                type="button"
                disabled={disabled || presetBusy}
                onClick={() => {
                  setSelected(qualityCriteriaForLanguage(presetLanguage));
                  setLanguageFilter(presetLanguage);
                }}
              >
                Montar por linguagem
              </button>
            ) : null}
            <button
              className="preset-save"
              type="button"
              disabled={disabled || presetBusy || !presetName.trim()}
              onClick={() => void savePreset()}
            >
              {presetBusy ? 'Salvando…' : 'Salvar seleção como preset'}
            </button>
          </div>
          {presetMessage ? <small className="preset-message">{presetMessage}</small> : null}
        </div> : null}

        {groups.map((group) => <div className="criteria-group" key={group}>
          <strong>{group}</strong>
          <div className="criteria-grid">
            {visibleCriteria.filter((criterion) => criterion.group === group).map((criterion) => (
              <label className={selected.includes(criterion.id) ? 'criterion checked' : 'criterion'} key={criterion.id}>
                <input type="checkbox" checked={selected.includes(criterion.id)} disabled={disabled} onChange={() => toggle(criterion.id)} />
                <span>
                  <b>{criterion.label}</b>
                  <small>{criterion.description} · {criterion.languages?.length ? criterion.languages.join(', ') : 'Global'}</small>
                </span>
              </label>
            ))}
          </div>
        </div>)}
      </div> : null}
    </div>
  );
}

export function ExplorerPaid({
  admin = false,
  paid = false,
  freeGrantDaysRemaining = 0,
  freeAnalysisAvailable = false,
  recentAnalyses = [],
}: {
  admin?: boolean;
  paid?: boolean;
  freeGrantDaysRemaining?: number;
  freeAnalysisAvailable?: boolean;
  recentAnalyses?: RecentAnalysis[];
}) {
  const router = useRouter();
  const [owner, setOwner] = useState('');
  const [repository, setRepository] = useState('');
  const [analysis, setAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [freeAnalysisRemaining, setFreeAnalysisRemaining] = useState(freeAnalysisAvailable);
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
      router.push('/login?next=/dashboard');
      return true;
    }
    if (status === 402) {
      router.push('/pricing');
      return true;
    }
    return false;
  }

  async function analyzeRepository(value: string, criteriaIds: string[]) {
    const controller = startController();
    setLoading(true);
    setAnalysis(null);
    setAnalysisState('running');
    setStatusMessage('Coletando evidências públicas do repositório');
    let waitMs = 2_000;

    while (!controller.signal.aborted) {
      try {
        const criteria = encodeURIComponent(criteriaIds.join(','));
        const response = await fetch(
          `/api/analyze?repo=${encodeURIComponent(value)}&criteria=${criteria}`,
          { cache: 'no-store', signal: controller.signal },
        );
        if (handleAccessStatus(response.status)) return;

        const body = await response.json() as RepositoryAnalysis | AnalysisControl;

        if (response.ok && 'repository' in body) {
          setStatusMessage('Consolidando resultado');
          setAnalysis(body);
          setOwner(body.repository.owner);
          setRepository(body.repository.name);
          setTab('overview');
          setAnalysisState('complete');
          if (freeAnalysisRemaining && !paid && freeGrantDaysRemaining === 0 && !admin) {
            setFreeAnalysisRemaining(false);
          }
          setLoading(false);
          return;
        }

        if ('state' in body && (body.state === 'not_found' || body.state === 'input')) {
          setAnalysisState('empty');
          setStatusMessage(
            body.state === 'not_found'
              ? 'Repositório público não encontrado.'
              : 'Preencha owner e repositório corretamente.',
          );
          setLoading(false);
          return;
        }

        const retry = 'retryAfterMs' in body && body.retryAfterMs ? body.retryAfterMs : waitMs;
        setAnalysisState('waiting');
        setStatusMessage('Aguardando disponibilidade dos dados · retomada automática');
        await delay(Math.min(Math.max(retry, 2_000), 60 * 60 * 1_000), controller.signal);
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

  function run(selectedOwner = owner, selectedRepository = repository) {
    const normalizedOwner = selectedOwner.trim();
    const normalizedRepository = selectedRepository.trim();
    if (
      loading ||
      !isGitHubSegmentValid(normalizedOwner) ||
      !isGitHubSegmentValid(normalizedRepository)
    ) return;

    const criteriaSnapshot = [...selectedCriteria];
    setAppliedCriteria(criteriaSnapshot);
    setOwner(normalizedOwner);
    setRepository(normalizedRepository);
    setStatusMessage('');
    void analyzeRepository(
      `https://github.com/${normalizedOwner}/${normalizedRepository}`,
      criteriaSnapshot,
    );
  }

  function runRecent(item: RecentAnalysis) {
    const parsed = parseRecentRepository(item.repository);
    if (!parsed) return;
    run(parsed.owner, parsed.repository);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    run();
  }

  const repositoryReady =
    isGitHubSegmentValid(owner) && isGitHubSegmentValid(repository);

  const accessLabel = admin
    ? 'ACESSO ADMINISTRATIVO'
    : freeGrantDaysRemaining > 0
      ? `ACESSO GRÁTIS · ${freeGrantDaysRemaining} DIAS RESTANTES`
      : paid
        ? 'PLANO ATIVO'
        : freeAnalysisRemaining
          ? '1 ANÁLISE GRATUITA DISPONÍVEL'
          : 'ANÁLISE GRATUITA UTILIZADA';

  return (
    <main>
      <section className="hero">
        <div className="topbar shell">
          <Link className="brand" href="/"><BrandIcon className="brand-mark" /><span><strong>RepoScope</strong><small>Engineering Intelligence</small></span></Link>
          <div className="repo-actions">{admin ? <Link className="secondary-action" href="/admin">Admin</Link> : null}<Link className="secondary-action" href="/account">Conta</Link><form action="/auth/signout" method="post"><button className="secondary-action" type="submit">Sair</button></form></div>
        </div>
        <div className="hero-content shell">
          <div className="hero-copy"><p className="eyebrow">{accessLabel}</p><h1>Avalie repositórios públicos com evidências técnicas.</h1><p>Informe um repositório público do GitHub e escolha quais sinais entram no cálculo. Etapas temporariamente indisponíveis são retomadas automaticamente.</p></div>
          <form className="repo-form" onSubmit={submit}>
            <div className="repo-input">
              <div className="repository-address" aria-label="Endereço do repositório no GitHub">
                <span className="repository-prefix">https://github.com/</span>
                <input
                  aria-label="Owner do GitHub"
                  value={owner}
                  onChange={(event) => setOwner(event.target.value.replace(/\//g, ''))}
                  placeholder="owner"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={loading}
                />
                <span className="repository-slash">/</span>
                <input
                  aria-label="Nome do repositório"
                  value={repository}
                  onChange={(event) => setRepository(event.target.value.replace(/\//g, ''))}
                  placeholder="repositorio"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={loading}
                />
              </div>
              <button type="submit" disabled={loading || !repositoryReady}>
                {loading ? 'Processando…' : 'Analisar repositório'}
              </button>
            </div>
            <CriteriaSelector selected={selectedCriteria} setSelected={setSelectedCriteria} disabled={loading} presetAccess={paid || admin} />
            <div className="examples">
              <span>{repositoryInput.hint} Exemplos:</span>
              {repositoryInput.examples.map((example) => (
                <button
                  key={`${example.owner}/${example.repository}`}
                  type="button"
                  disabled={loading}
                  onClick={() => run(example.owner, example.repository)}
                >
                  {example.owner}/{example.repository}
                </button>
              ))}
            </div>
          </form>
        </div>
      </section>

      {recentAnalyses.length > 0 ? (
        <section className="shell recent-analyses">
          <div className="recent-head">
            <div><p>HISTÓRICO</p><h2>Suas análises dos últimos 30 dias</h2></div>
            <span>{recentAnalyses.length} análises</span>
          </div>
          <div className="recent-list">
            {recentAnalyses.slice(0, 12).map((item) => {
              const parsed = parseRecentRepository(item.repository);
              const label = parsed ? `${parsed.owner}/${parsed.repository}` : item.repository;
              return (
                <button type="button" key={item.id} onClick={() => runRecent(item)} disabled={loading}>
                  <span><strong>{label}</strong><small>{formatRecentDate(item.createdAt)} · {item.criteriaCount ?? '—'} critérios</small></span>
                  <b>Analisar novamente</b>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="shell workspace">
        {loading ? <div className="loading-layout"><div className="analysis-status"><span className={analysisState === 'waiting' ? 'status-dot waiting' : 'status-dot'} /><div><strong>{statusMessage || 'Preparando análise'}</strong><small>A análise é retomada automaticamente sempre que uma etapa precisa aguardar.</small></div></div><div className="indeterminate-progress"><span /></div><div className="skeleton-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton" key={index} />)}</div></div> : null}
        {!analysis && !loading && analysisState === 'idle' ? <div className="empty-landing"><h2>Informe um repositório para iniciar.</h2><p>{selectedCriteria.length} critérios estão selecionados para o próximo cálculo.</p></div> : null}
        {!analysis && !loading && analysisState === 'empty' ? <div className="empty-landing"><h2>{statusMessage}</h2><p>Preencha owner e repositório para formar uma URL completa do GitHub.</p></div> : null}
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
