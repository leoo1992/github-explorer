'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppNavigation } from '@/components/app-navigation';
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

export function PresetManagerPage({ initialPresets, admin = false }: { initialPresets: CustomQualityPreset[]; admin?: boolean }) {
  const [presets, setPresets] = useState<CustomQualityPreset[]>(initialPresets);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<QualityLanguage | ''>('');
  const [criteriaIds, setCriteriaIds] = useState<string[]>([]);
  const [languageFilter, setLanguageFilter] = useState<'all' | 'global' | QualityLanguage>('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sectionTab, setSectionTab] = useState<'system' | 'mine' | 'editor'>('mine');

  const visibleCriteria = useMemo(() => QUALITY_CRITERIA.filter((criterion) => {
    if (languageFilter === 'all') return true;
    if (languageFilter === 'global') return !criterion.languages?.length;
    return !criterion.languages?.length || criterion.languages.includes(languageFilter);
  }), [languageFilter]);

  const groups = [...new Set(visibleCriteria.map((criterion) => criterion.group))];

  function clearEditor(openEditor = false) {
    setSelectedId(null);
    setName('');
    setLanguage('');
    setCriteriaIds([]);
    setLanguageFilter('all');
    setMessage('');
    if (openEditor) setSectionTab('editor');
  }

  function editPreset(preset: CustomQualityPreset) {
    setSelectedId(preset.id);
    setName(preset.name);
    setLanguage(preset.language ?? '');
    setCriteriaIds([...preset.criteriaIds]);
    setLanguageFilter(preset.language ?? 'all');
    setMessage('');
    setSectionTab('editor');
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
      if (selectedId === id) {
        clearEditor();
        setSectionTab('mine');
      }
      setMessage('Preset excluído.');
    } catch {
      setMessage('Não foi possível excluir o preset.');
    } finally {
      setBusy(false);
    }
  }


  return (
    <main className={[styles.page, 'page-with-dock'].join(' ')}>
      <AppNavigation admin={admin} presetAccess />

      <section className={styles.hero}>
        <div>
          <p>PERFIS DE QUALIDADE</p>
          <h1>Presets de avaliação</h1>
          <span>
            Organize os critérios em abas. Os padrões do sistema são somente leitura; seus presets podem ser
            criados, editados e excluídos.
          </span>
        </div>
        <button className="btn btn-primary btn-sm" type="button" onClick={() => clearEditor(true)}>
          Novo preset
        </button>
      </section>

      <nav className={['tabs', 'tabs-box', styles.pageTabs].join(' ')} role="tablist" aria-label="Seções de presets">
        <button
          className={sectionTab === 'system' ? 'tab tab-active' : 'tab'}
          type="button"
          role="tab"
          aria-selected={sectionTab === 'system'}
          onClick={() => setSectionTab('system')}
        >
          Padrões do sistema
          <span className="badge badge-sm badge-ghost">{STANDARD_QUALITY_PRESETS.length}</span>
        </button>
        <button
          className={sectionTab === 'mine' ? 'tab tab-active' : 'tab'}
          type="button"
          role="tab"
          aria-selected={sectionTab === 'mine'}
          onClick={() => setSectionTab('mine')}
        >
          Meus presets
          <span className="badge badge-sm badge-ghost">{presets.length}</span>
        </button>
        <button
          className={sectionTab === 'editor' ? 'tab tab-active' : 'tab'}
          type="button"
          role="tab"
          aria-selected={sectionTab === 'editor'}
          onClick={() => setSectionTab('editor')}
        >
          Editor
        </button>
      </nav>

      {sectionTab === 'system' ? (
        <section className={[styles.systemSection, styles.tabPanel].join(' ')}>
          <div className={styles.sectionHead}>
            <div>
              <p>PADRÕES DO SISTEMA</p>
              <h2>Presets padrão não excluíveis</h2>
            </div>
            <span>{STANDARD_QUALITY_PRESETS.length} presets</span>
          </div>
          <div className={styles.systemGrid}>
            {STANDARD_QUALITY_PRESETS.map((preset) => (
              <article className={['card', styles.systemCard].join(' ')} key={preset.id}>
                <div className={styles.cardTop}>
                  <strong>{preset.label}</strong>
                  <span className="badge badge-soft badge-info">PADRÃO</span>
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
      ) : null}

      {sectionTab === 'mine' ? (
        <section className={['card', styles.customList, styles.tabPanel].join(' ')}>
          <div className={styles.sectionHead}>
            <div>
              <p>MEUS PRESETS</p>
              <h2>Personalizados</h2>
            </div>
            <span>{presets.length}/20</span>
          </div>

          {!presets.length ? (
            <div className={styles.empty}>Nenhum preset personalizado criado.</div>
          ) : (
            <div className={styles.presetGrid}>
              {presets.map((preset) => (
                <article
                  key={preset.id}
                  className={selectedId === preset.id ? styles.customCardActive : styles.customCard}
                >
                  <button className={styles.editButton} type="button" onClick={() => editPreset(preset)}>
                    <span>
                      <strong>{preset.name}</strong>
                      <small>{preset.language ?? 'Geral / multilíngue'} · {preset.criteriaIds.length} critérios</small>
                    </span>
                    <Pencil aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    disabled={busy}
                    onClick={() => void deletePreset(preset.id)}
                    aria-label={'Excluir preset ' + preset.name}
                    title="Excluir preset"
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          )}

          {message ? <span className={styles.listMessage} role="status">{message}</span> : null}
        </section>
      ) : null}

      {sectionTab === 'editor' ? (
        <section className={['card', styles.editor, styles.tabPanel].join(' ')}>
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
                className="input input-bordered w-full"
                value={name}
                maxLength={60}
                placeholder="Ex.: Backend Python rigoroso"
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label>
              <span>Linguagem base</span>
              <select
                className="select select-bordered w-full"
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
                className="select select-bordered w-full"
                value={languageFilter}
                onChange={(event) => setLanguageFilter(event.target.value as 'all' | 'global' | QualityLanguage)}
              >
                <option value="all">Todos</option>
                <option value="global">Somente globais</option>
                {QUALITY_LANGUAGES.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            {language ? (
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => buildFromLanguage(language)}>
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
                        className="checkbox checkbox-primary checkbox-sm"
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
              className={['btn', 'btn-primary', styles.primary].join(' ')}
              disabled={busy || !name.trim() || !criteriaIds.length}
              onClick={() => void savePreset()}
            >
              {busy ? 'Salvando…' : selectedId ? 'Salvar alterações' : 'Criar preset'}
            </button>
            <button type="button" className={['btn', 'btn-ghost', styles.secondary].join(' ')} onClick={() => clearEditor()}>
              Limpar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setSectionTab('mine')}>
              Voltar aos presets
            </button>
            {message ? <span role="status">{message}</span> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
