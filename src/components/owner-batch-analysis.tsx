'use client';

import { useEffect, useRef, useState } from 'react';
import { calculateQualityScore } from '@/lib/quality-criteria';
import type { RepositoryAnalysis } from '@/types/repository';

type Item = { repository: string; status: 'pending' | 'running' | 'complete' | 'waiting' | 'error'; score: number | null; detail?: string };
type Props = { owner: string; enabled: boolean };
type AnalysisControl = { state?: string; retryAfterMs?: number; code?: string; error?: string };
const delay = (ms: number, signal: AbortSignal) => new Promise<void>(resolve => {
  if (signal.aborted) return resolve();
  const timer = window.setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { window.clearTimeout(timer); resolve(); }, { once: true });
});

export function OwnerBatchAnalysis({ owner, enabled }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  const update = (repository: string, patch: Partial<Item>) =>
    setItems(prev => prev.map(item => item.repository === repository ? { ...item, ...patch } : item));

  async function start() {
    if (running || !/^[\w.-]{1,39}$/.test(owner.trim())) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setItems([]);
    setRunning(true);
    setMessage('Carregando repositórios do owner…');
    try {
      const response = await fetch(`/api/owner-repositories?owner=${encodeURIComponent(owner)}`, { signal: controller.signal });
      const data = await response.json() as { repositories?: string[]; error?: string; truncated?: boolean };
      if (!response.ok) throw new Error(data.error || 'Não foi possível obter repositórios.');
      const repos = data.repositories ?? [];
      setItems(repos.map(repository => ({ repository, status: 'pending', score: null })));
      setMessage(data.truncated ? 'Limite de 100 repositórios por lote. Processando os primeiros 100.' : `${repos.length} repositórios encontrados.`);
      let cursor = 0;
      let pauseAll = false;
      async function worker() {
        while (!controller.signal.aborted && !pauseAll && cursor < repos.length) {
          const repository = repos[cursor++];
          update(repository, { status: 'running' });
          for (let attempt=0;attempt<8 && !controller.signal.aborted;attempt++) {
            try {
              const result = await fetch(`/api/analyze?repo=${encodeURIComponent(repository)}&mode=auto`, {
                cache: 'no-store',signal:controller.signal,
              });
              const body = await result.json() as RepositoryAnalysis & AnalysisControl;
              if (result.ok && body.repository) {
                const quality = calculateQualityScore(body.qualitySignals, body.appliedCriteriaIds, body.languages.map(l => l.name));
                update(repository, { status:'complete',score:quality.score,detail:'Avaliação automática concluída' });
                break;
              }
              if (result.status === 202 && body.state === 'waiting') {
                const wait = Math.max(2000,body.retryAfterMs || 8000);
                if (wait > 120000) {
                  pauseAll = true;
                  update(repository,{status:'waiting',detail:'Cota do GitHub indisponível. Retome o lote mais tarde.'});
                  setMessage('A cota do GitHub foi atingida. Resultados concluídos permanecem visíveis.');
                  break;
                }
                update(repository,{status:'waiting',detail:'Na fila compartilhada'});
                await delay(Math.min(wait,30000),controller.signal);
                continue;
              }
              update(repository,{status:'error',detail:body.error || `HTTP ${result.status}`});
              break;
            } catch (error) {
              if (controller.signal.aborted) break;
              if (attempt === 7) update(repository,{status:'error',detail:error instanceof Error ? error.message : 'Falha de rede'});
              else await delay(5000,controller.signal);
            }
          }
        }
      }
      await Promise.all([worker(),worker()]);
      if (!controller.signal.aborted && !pauseAll) setMessage('Lote processado. Verifique os itens pendentes para reexecutar depois.');
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Falha na análise em lote');
    } finally {
      if (!controller.signal.aborted) setRunning(false);
    }
  }
  function stop() {
    abortRef.current?.abort();
    setRunning(false);
    setMessage('Execução interrompida. Resultados concluídos preservados na tela e no cache.');
  }
  if (!enabled) return null;
  const completed = items.filter(item=>item.status==='complete').length;
  return (
    <section className="card panel" aria-label="Análise em lote do owner">
      <h2>Verificação geral do owner</h2>
      <p>Máximo de duas análises simultâneas. Resultados concluídos aparecem enquanto as demais aguardam.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-outline btn-sm" type="button" onClick={start} disabled={running || !owner.trim()}>
          {running ? 'Processando…' : 'Analisar todos os repositórios'}
        </button>
        {running && <button type="button" className="btn btn-ghost btn-sm" onClick={stop}>Interromper</button>}
      </div>
      <p role="status">{message}</p>
      {items.length>0 && <>
        <progress className="progress progress-primary w-full" value={completed} max={items.length} aria-label="Progresso da análise em lote" />
        <p>{completed} de {items.length} repositórios concluídos</p>
        <div className="max-h-80 overflow-y-auto">
          <table className="table table-zebra table-sm w-full">
            <thead><tr><th>Repositório</th><th>Status</th><th>Qualidade</th></tr></thead>
            <tbody>{items.map(item=><tr key={item.repository}>
              <td>{item.repository}</td><td title={item.detail}>{item.status}</td>
              <td>{item.score===null ? '—' : `${item.score}%`}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </section>
  );
}
