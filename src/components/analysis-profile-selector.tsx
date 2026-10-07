'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_QUALITY_CRITERIA_IDS,
  QUALITY_CRITERIA,
  QUALITY_LANGUAGES,
  QUALITY_PRESETS,
  STANDARD_QUALITY_PRESETS,
  type QualityLanguage,
} from '@/lib/quality-criteria';

export type AnalysisProfileSelection = {
  mode: 'auto' | 'selected';
  criteriaIds: string[];
  label: string;
};

type CustomQualityPreset = {
  id: string;
  name: string;
  language: QualityLanguage | null;
  criteriaIds: string[];
  createdAt: string;
  updatedAt: string;
};

export function AnalysisProfileSelector({
  disabled,
  presetAccess,
  onChange,
}: {
  disabled: boolean;
  presetAccess: boolean;
  onChange: (selection: AnalysisProfileSelection) => void;
}) {
  const [value, setValue] = useState('auto');
  const [customPresets, setCustomPresets] = useState<CustomQualityPreset[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualIds, setManualIds] = useState<string[]>([...DEFAULT_QUALITY_CRITERIA_IDS]);
  const [languageFilter, setLanguageFilter] = useState<'all' | 'global' | QualityLanguage>('all');

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
      .catch(() => null);

    return () => {
      active = false;
    };
  }, [presetAccess]);

  const selectedStandard = value.startsWith('standard:')
    ? STANDARD_QUALITY_PRESETS.find((preset) => preset.id === value.slice('standard:'.length)) ?? null
    : null;
  const selectedCustom = value.startsWith('custom:')
    ? customPresets.find((preset) => preset.id === value.slice('custom:'.length)) ?? null
    : null;

  const visibleCriteria = useMemo(() => QUALITY_CRITERIA.filter((criterion) => {
    if (languageFilter === 'all') return true;
    if (languageFilter === 'global') return !criterion.languages?.length;
    return !criterion.languages?.length || criterion.languages.includes(languageFilter);
  }), [languageFilter]);

  function choose(nextValue: string) {
    setValue(nextValue);
    setManualOpen(nextValue === 'manual');

    if (nextValue === 'auto') {
      onChange({ mode: 'auto', criteriaIds: [], label: 'Automático' });
      return;
    }

    if (nextValue === 'manual') {
      onChange({ mode: 'selected', criteriaIds: manualIds, label: 'Seleção manual' });
      return;
    }

    if (nextValue.startsWith('standard:')) {
      const preset = STANDARD_QUALITY_PRESETS.find(
        (item) => item.id === nextValue.slice('standard:'.length),
      );
      if (preset) {
        onChange({ mode: 'selected', criteriaIds: [...preset.ids], label: preset.label });
      }
      return;
    }

    if (nextValue.startsWith('custom:')) {
      const preset = customPresets.find(
        (item) => item.id === nextValue.slice('custom:'.length),
      );
      if (preset) {
        onChange({ mode: 'selected', criteriaIds: [...preset.criteriaIds], label: preset.name });
      }
    }
  }

  function toggleManual(id: string) {
    const next = manualIds.includes(id)
      ? manualIds.length === 1
        ? manualIds
        : manualIds.filter((item) => item !== id)
      : [...manualIds, id];
    setManualIds(next);
    onChange({ mode: 'selected', criteriaIds: next, label: 'Seleção manual' });
  }

  const summary = value === 'auto'
    ? 'Detecta linguagem e stack no repositório e aplica somente os padrões compatíveis.'
    : selectedStandard
      ? selectedStandard.description
      : selectedCustom
        ? `${selectedCustom.language ?? 'Multilíngue'} · ${selectedCustom.criteriaIds.length} critérios personalizados.`
        : `${manualIds.length} critérios escolhidos manualmente.`;

  return (
    <div className="analysis-profile-selector">
      <div className="analysis-profile-head">
        <label>
          <span>Perfil de avaliação</span>
          <select className="select select-bordered w-full" value={value} disabled={disabled} onChange={(event) => choose(event.target.value)}>
            <option value="auto">Automático — recomendado</option>
            <optgroup label="Presets padrão">
              {STANDARD_QUALITY_PRESETS.map((preset) => (
                <option value={`standard:${preset.id}`} key={preset.id}>
                  {preset.label}
                </option>
              ))}
            </optgroup>
            {customPresets.length ? <optgroup label="Meus presets">
              {customPresets.map((preset) => (
                <option value={`custom:${preset.id}`} key={preset.id}>
                  {preset.name}
                </option>
              ))}
            </optgroup> : null}
            <option value="manual">Seleção manual</option>
          </select>
        </label>
        {presetAccess ? <Link className="btn btn-ghost btn-sm manage-presets-link" href="/presets">Gerenciar presets</Link> : null}
      </div>

      <div className={value === 'auto' ? 'analysis-profile-summary auto' : 'analysis-profile-summary'}>
        <strong>{value === 'auto' ? 'Modo automático' : selectedStandard?.label ?? selectedCustom?.name ?? 'Manual'}</strong>
        <small>{summary}</small>
      </div>

      {manualOpen ? <div className="manual-criteria">
        <div className="criteria-presets">
          <span>Seleções rápidas</span>
          {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
            <button className="btn btn-ghost btn-sm"
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => {
                setManualIds([...preset.ids]);
                onChange({ mode: 'selected', criteriaIds: [...preset.ids], label: `Manual · ${preset.label}` });
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <label className="manual-language-filter">
          <span>Filtrar critérios</span>
          <select className="select select-bordered w-full"
            value={languageFilter}
            disabled={disabled}
            onChange={(event) => setLanguageFilter(event.target.value as 'all' | 'global' | QualityLanguage)}
          >
            <option value="all">Todos</option>
            <option value="global">Globais</option>
            {QUALITY_LANGUAGES.map((language) => <option value={language} key={language}>{language}</option>)}
          </select>
        </label>

        <div className="criteria-grid">
          {visibleCriteria.map((criterion) => (
            <label className={manualIds.includes(criterion.id) ? 'criterion checked' : 'criterion'} key={criterion.id}>
              <input className="checkbox checkbox-primary checkbox-sm"
                type="checkbox"
                checked={manualIds.includes(criterion.id)}
                disabled={disabled}
                onChange={() => toggleManual(criterion.id)}
              />
              <span>
                <b>{criterion.label}</b>
                <small>{criterion.description} · {criterion.languages?.length ? criterion.languages.join(', ') : 'Global'}</small>
              </span>
            </label>
          ))}
        </div>
      </div> : null}
    </div>
  );
}
