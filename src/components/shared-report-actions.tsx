'use client';

import { Copy, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import type { RepositoryAnalysis } from '@/types/repository';

function download(filename: string, type: string, content: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function cell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function csv(analysis: RepositoryAnalysis) {
  const rows: unknown[][] = [['criterio', 'status', 'detalhe', 'evidencia', 'arquivo', 'url']];
  for (const signal of analysis.qualitySignals) {
    const evidences = signal.evidence?.length ? signal.evidence : [undefined];
    for (const evidence of evidences) {
      rows.push([
        signal.label,
        signal.status ?? (signal.found ? 'pass' : 'fail'),
        signal.detail,
        evidence?.label ?? '',
        evidence?.path ?? '',
        evidence?.url ?? '',
      ]);
    }
  }
  return rows.map((row) => row.map(cell).join(',')).join('\n');
}

export function SharedReportActions({ analysis }: { analysis: RepositoryAnalysis }) {
  const [message, setMessage] = useState('');
  const filename = `${analysis.repository.owner}-${analysis.repository.name}-reposcope`;

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href.replace(/\?print=1$/, ''));
    setMessage('Link copiado.');
  }

  function printPdf() {
    window.print();
  }

  return (
    <div className="shared-report-actions">
      <button className="btn btn-primary btn-sm" type="button" onClick={() => void copyLink()}>
        <Copy aria-hidden="true" /> Copiar link
      </button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={printPdf}>
        <Download aria-hidden="true" /> PDF
      </button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => download(`${filename}.json`, 'application/json;charset=utf-8', JSON.stringify(analysis, null, 2))}>
        <FileJson aria-hidden="true" /> JSON
      </button>
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => download(`${filename}.csv`, 'text/csv;charset=utf-8', '\uFEFF' + csv(analysis))}>
        <FileSpreadsheet aria-hidden="true" /> CSV
      </button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
