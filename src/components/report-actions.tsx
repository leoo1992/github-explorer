'use client';

import { Download, FileJson, FileText, Share2 } from 'lucide-react';
import { useState } from 'react';
import { calculateQualityScore } from '@/lib/quality-criteria';
import type { RepositoryAnalysis } from '@/types/repository';

function downloadBlob(filename: string, type: string, content: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function analysisCsv(analysis: RepositoryAnalysis) {
  const lines = [
    ['criterio', 'status', 'detalhe', 'evidencia', 'caminho', 'url'],
  ];
  for (const signal of analysis.qualitySignals) {
    const evidences = signal.evidence?.length ? signal.evidence : [undefined];
    for (const evidence of evidences) {
      lines.push([
        signal.label,
        signal.status ?? (signal.found ? 'pass' : 'fail'),
        signal.detail,
        evidence?.label ?? '',
        evidence?.path ?? '',
        evidence?.url ?? '',
      ]);
    }
  }
  return lines.map((line) => line.map(csvCell).join(',')).join('\n');
}

export function ReportActions({ analysis }: { analysis: RepositoryAnalysis }) {
  const [shareUrl, setShareUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const baseName = `${analysis.repository.owner}-${analysis.repository.name}-reposcope`;

  async function ensureShare() {
    if (shareUrl) return shareUrl;
    setBusy(true);
    setMessage('');
    try {
      const quality = calculateQualityScore(
        analysis.qualitySignals,
        analysis.appliedCriteriaIds,
        analysis.languages.map((language) => language.name),
      );
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ analysis, qualityScore: quality.score }),
      });
      const body = await response.json() as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? 'Não foi possível criar o relatório.');
      setShareUrl(body.url);
      return body.url;
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    try {
      const url = await ensureShare();
      await navigator.clipboard.writeText(url);
      setMessage('Link somente leitura copiado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível compartilhar.');
    }
  }

  async function exportPdf() {
    const popup = window.open('', '_blank');
    try {
      const url = await ensureShare();
      if (popup) popup.location.href = `${url}?print=1`;
      else window.location.href = `${url}?print=1`;
      setMessage('Relatório aberto para impressão/salvamento em PDF.');
    } catch (error) {
      popup?.close();
      setMessage(error instanceof Error ? error.message : 'Não foi possível abrir o PDF.');
    }
  }

  function exportJson() {
    downloadBlob(
      `${baseName}.json`,
      'application/json;charset=utf-8',
      JSON.stringify(analysis, null, 2),
    );
    setMessage('JSON exportado.');
  }

  function exportCsv() {
    downloadBlob(
      `${baseName}.csv`,
      'text/csv;charset=utf-8',
      '\uFEFF' + analysisCsv(analysis),
    );
    setMessage('CSV exportado.');
  }

  return (
    <div className="report-actions">
      <div className="dropdown dropdown-end">
        <button className="btn btn-ghost btn-sm" type="button" tabIndex={0} disabled={busy}>
          <FileText aria-hidden="true" />
          {busy ? 'Gerando…' : 'Relatório'}
        </button>
        <ul className="menu dropdown-content bg-base-100 rounded-box z-50 w-56 p-2 shadow-lg" tabIndex={0}>
          <li><button type="button" onClick={() => void share()}><Share2 aria-hidden="true" />Compartilhar link</button></li>
          <li><button type="button" onClick={() => void exportPdf()}><Download aria-hidden="true" />PDF</button></li>
          <li><button type="button" onClick={exportJson}><FileJson aria-hidden="true" />JSON</button></li>
          <li><button type="button" onClick={exportCsv}><FileText aria-hidden="true" />CSV</button></li>
        </ul>
      </div>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
