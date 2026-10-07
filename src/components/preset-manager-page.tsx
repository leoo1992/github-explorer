'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  QUALITY_CRITERIA,
  QUALITY_LANGUAGES,
  STANDARD_QUALITY_PRESETS,
  qualityCriteriaForLanguage,
  type QualityLanguage,
} from '@/lib/quality-criteria';
import styles from '@/app/presets/page.module.css';

export type CustomQualityPreset = {
  id: string;
  name: string;
  language: QualityLanguage | null;
  criteriaIds: string[];
  createdAt: string;
  updatedAt: string;
};

export function PresetManagerPage({ initialPresets }: { initialPresets: CustomQualityPreset[] }) {
  const [presets, setPresets] = useState<CustomQualityPreset[]>(initialPresets);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<QualityLanguage | ''>('');
  const [criteriaIds, setCriteriaIds] = useState<string[]>([]);
  const [languageFilter, setLanguageFilter] = useState<'all' | 'global' | QualityLanguage>('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const visibleCriteria = useMemo(() => QUALITY_CRITERIA.filter((criterion) => {
    if (languageFilter === 'all') return true;
    if (languageFilter === 'global') return !criterion.languages?.length;
    return !criterion.languages?.length || criterion.languages.includes(languageFilter);
  }), [languageFilter]);

  const groups = [...new Set(visibleCriteria.map((criterion) => criterion.group))];

  function clearEditor() {
    setSelectedId(null);
    setName('');
    setLanguage('');
    setCriteriaIds([]);
    setLanguageFilter('all');
    setMessage('');
  }

  function editPreset(preset: CustomQualityPreset) {
    setSelectedId(preset.id);
    setName(preset.name);
    setLanguage(preset.language ?? '');
    setCriteriaIds([...preset.criteriaIds]);
    setLanguageFilter(preset.language ?? 'all');
    setMessage('');
  }

  function toggleCriterion(id: string) {
    setCriteriaIds((current) => current.includes(id)
      ? current.length === 1
        ? current
        : current.filter((item) => item !== id)
      : [...current, id]);
  }

  function buildFromLanguage(nextLanguage: QualityLanguage) {
    setLanguage(nextLanguage);
    setLanguageFilter(nextLanguage);
    setCriteriaIds(qualityCriteriaForLanguage(nextLanguage));
  }

  async function savePreset() {
    if (!name.trim() || !criteriaIds.length || busy) return;
    setBusy(true);
    setMessage('');

    try {
      const response = await fetch('/api/quality-presets', {
        method: selectedId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: selectedId ?? undefined,
          name: name.trim(),
          language: language || null,
          criteriaIds,
        }),
      });
      const body = await response.json() as { preset?: CustomQualityPreset; error?: string };
      if (!response.ok || !body.preset) {
        setMessage(body.error ?? 'Não foi possível salvar o preset.');
        return;
      }

      setPresets((current) => [
        body.preset!,
        ...current.filter((preset) => preset.id !== body.preset!.id),
      ]);
      setSelectedId(body.preset.id);
      setName(body.preset.name);
      setLanguage(body.preset.language ?? '');
      setCriteriaIds([...body.preset.criteriaIds]);
      setMessage(selectedId ? 'Preset atualizado.' : 'Preset criado.');
    } catch {
      setMessage('Não foi possível salvar o preset.');
    } finally {
      setBusy(false);
    }
  }

  async function deletePreset(id: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/quality-presets?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setMessage(body?.error ?? 'Não foi possível excluir o preset.');
        return;
      }
      setPresets((current) => current.filter((preset) => preset.id !== id));
      if (selectedId === id) clearEditor();
      setMessage('Preset excluído.');
    } catch {
      setMessage('Não foi possível excluir o preset.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brand}>RepoScope</Link>
        <nav>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/account">Conta</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div>
          <p>PERFIS DE QUALIDADE</p>
          <h1>Presets de avaliação</h1>
          <span>
            Os presets padrão definem critérios coerentes por linguagem e stack. Eles fazem parte do sistema
            e não podem ser excluídos. Seus presets personalizados podem ser criados, editados e removidos.
          </span>
        </div>
        <button type="button" onClick={clearEditor}>Novo preset</button>
      </section>

      <section className={styles.systemSection}>
        <div className={styles.sectionHead}>
          <div>
            <p>PADRÕES DO SISTEMA</p>
            <h2>Presets padrão não excluíveis</h2>
          </div>
          <span>{STANDARD_QUALITY_PRESETS.length} presets</span>
        </div>
        <div className={styles.systemGrid}>
          {STANDARD_QUALITY_PRESETS.map((preset) => (
            <article className={styles.systemCard} key={preset.id}>
              <div className={styles.cardTop}>
                <strong>{preset.label}</strong>
                <span>PADRÃO</span>
              </div>
              <p>{preset.description}</p>
              <div className={styles.tags}>
                {(preset.stacks ?? preset.languages ?? []).map((item) => <span key={item}>{item}</span>)}
              </div>
              <small>{preset.ids.length} critérios pré-selecionados</small>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.customLayout}>
        <aside className={styles.customList}>
          <div className={styles.sectionHead}>
            <div>
              <p>MEUS PRESETS</p>
              <h2>Personalizados</h2>
            </div>
            <span>{presets.length}/20</span>
          </div>

          {!presets.length ? <div className={styles.empty}>Nenhum preset personalizado criado.</div> : null}

          {presets.map((preset) => (
            <article
              key={preset.id}
              className={selectedId === preset.id ? styles.customCardActive : styles.customCard}
            >
              <button type="button" onClick={() => editPreset(preset)}>
                <strong>{preset.name}</strong>
                <small>{preset.language ?? 'Geral / multilíngue'} · {preset.criteriaIds.length} critérios</small>
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                disabled={busy}
                onClick={() => void deletePreset(preset.id)}
                aria-label={`Excluir preset ${preset.name}`}
              >
                Excluir
              </button>
            </article>
          ))}
        </aside>

        <section className={styles.editor}>
          <div className={styles.editorHead}>
            <div>
              <p>{selectedId ? 'EDITAR PRESET' : 'NOVO PRESET'}</p>
              <h2>{selectedId ? name || 'Preset personalizado' : 'Cadastre um novo padrão'}</h2>
            </div>
            <span>{criteriaIds.length} critérios</span>
          </div>

          <div className={styles.formGrid}>
            <label>
              <span>Nome</span>
              <input
                value={name}
                maxLength={60}
                placeholder="Ex.: Backend Python rigoroso"
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label>
              <span>Linguagem base</span>
              <select
                value={language}
                onChange={(event) => {
                  const next = event.target.value as QualityLanguage | '';
                  setLanguage(next);
                  if (next) buildFromLanguage(next);
                }}
              >
                <option value="">Geral / multilíngue</option>
                {QUALITY_LANGUAGES.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
          </div>

          <div className={styles.filterRow}>
            <label>
              <span>Filtrar critérios exibidos</span>
              <select
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value as 'all' | 'global' | QualityLanguage)}
              >
                <option value="all">Todos</option>
                <option value="global">Somente globais</option>
                {QUALITY_LANGUAGES.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            {language ? (
              <button type="button" onClick={() => buildFromLanguage(language)}>
                Restaurar padrão da linguagem
              </button>
            ) : null}
          </div>

          <div className={styles.criteriaGroups}>
            {groups.map((group) => (
              <div className={styles.criteriaGroup} key={group}>
                <h3>{group}</h3>
                <div className={styles.criteriaGrid}>
                  {visibleCriteria.filter((criterion) => criterion.group === group).map((criterion) => (
                    <label
                      className={criteriaIds.includes(criterion.id) ? styles.criterionActive : styles.criterion}
                      key={criterion.id}
                    >
                      <input
                        type="checkbox"
                        checked={criteriaIds.includes(criterion.id)}
                        onChange={() => toggleCriterion(criterion.id)}
                      />
                      <span>
                        <strong>{criterion.label}</strong>
                        <small>{criterion.description}</small>
                        <em>{criterion.languages?.length ? criterion.languages.join(', ') : 'Global'}</em>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.editorActions}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || !name.trim() || !criteriaIds.length}
              onClick={() => void savePreset()}
            >
              {busy ? 'Salvando…' : selectedId ? 'Salvar alterações' : 'Criar preset'}
            </button>
            <button type="button" className={styles.secondary} onClick={clearEditor}>Limpar</button>
            {message ? <span role="status">{message}</span> : null}
          </div>
        </section>
      </section>
    </main>
  );
}
