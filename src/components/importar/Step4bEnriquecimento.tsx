"use client";

import { useState, useEffect, useRef } from "react";
import { ParsedRecord } from "@/lib/importar/types";
import { EnrichData } from "@/lib/importar/racius";

type EnrichResults = Record<string, EnrichData>; // nipc → dados

type StreamEvent = {
  status: string;
  total: number;
  processed: number;
  found: number;
  results?: EnrichResults;
};

const DELAY_OPTIONS = [
  { label: "Cauteloso (8s) — recomendado", value: 8000 },
  { label: "Normal (5s)", value: 5000 },
  { label: "Rápido (3s) — risco de bloqueio", value: 3000 },
];

export default function Step4bEnriquecimento({ records, onDone, onSkip, onBack }: {
  records: ParsedRecord[];
  onDone: (results: EnrichResults) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [started, setStarted]     = useState(false);
  const [delayMs, setDelayMs]     = useState(8000);
  const [evt, setEvt]             = useState<StreamEvent | null>(null);
  const [results, setResults]     = useState<EnrichResults>({});
  const [editOverrides, setEdits] = useState<EnrichResults>({});
  const [done, setDone]           = useState(false);
  const [paused, setPaused]       = useState(false);
  const [error, setError]         = useState("");
  const jobIdRef                  = useRef<string>(crypto.randomUUID());

  // Count unique NIPs
  const uniqueNifs = [...new Set(records.map(r => r.nipc).filter(Boolean))];
  const estimatedMin = Math.ceil((uniqueNifs.length * delayMs) / 1000 / 60);

  async function handleStart() {
    setStarted(true);
    setError("");

    const res = await fetch("/api/importar/enriquecer/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records, jobId: jobIdRef.current, delayMs }),
    });

    if (!res.ok) {
      setError("Erro ao iniciar enriquecimento");
      setStarted(false);
      return;
    }

    // Open SSE stream
    const es = new EventSource(`/api/importar/enriquecer/stream?jobId=${jobIdRef.current}`);

    es.onmessage = (e) => {
      const data: StreamEvent = JSON.parse(e.data);
      setEvt(data);

      if (data.results) {
        setResults(data.results);
      }

      if (data.status === "done") {
        es.close();
        setDone(true);
      } else if (data.status === "paused") {
        es.close();
        setPaused(true);
      } else if (data.status === "error") {
        es.close();
        setError("Erro durante o enriquecimento");
      }
    };

    es.onerror = () => {
      es.close();
      setError("Ligação SSE interrompida");
    };
  }

  async function handlePause() {
    await fetch("/api/importar/enriquecer/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: jobIdRef.current }),
    });
  }

  function mergedResults(): EnrichResults {
    return { ...results, ...editOverrides };
  }

  function patchEdit(nipc: string, patch: Partial<EnrichData>) {
    setEdits(e => ({ ...e, [nipc]: { ...results[nipc], ...e[nipc], ...patch, found: true } }));
  }

  const merged = mergedResults();
  const foundCount = Object.values(merged).filter(r => r.telefone || r.website).length;
  const progress = evt ? Math.round((evt.processed / evt.total) * 100) : 0;

  // ── Pre-start screen ─────────────────────────────────────────
  if (!started) {
    return (
      <div className="max-w-lg mx-auto">
        <h2 className="text-base font-semibold text-gray-900 mb-1">4b. Enriquecimento de contactos</h2>
        <p className="text-sm text-gray-500 mb-6">
          Pesquisa automática de telefones e websites no Racius.com para as empresas deste lote.
          Este passo é opcional.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Empresas a pesquisar</span>
            <span className="font-semibold">{uniqueNifs.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Tempo estimado</span>
            <span className="font-semibold">~{estimatedMin} min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Taxa de sucesso esperada</span>
            <span className="font-semibold">~50–65%</span>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Velocidade de pesquisa</label>
          <select
            value={delayMs}
            onChange={e => setDelayMs(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DELAY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Delay entre cada pesquisa. Valores baixos aumentam o risco de bloqueio temporário pelo Racius.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-xs text-amber-700">
          Mantenha esta página aberta durante o processo. Pode pausar a qualquer momento e continuar com os resultados parciais.
        </div>

        <div className="flex gap-3">
          <button onClick={onBack}
            className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50">
            ← Voltar
          </button>
          <button onClick={onSkip}
            className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50">
            Saltar
          </button>
          <button onClick={handleStart}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm">
            Iniciar pesquisa
          </button>
        </div>
      </div>
    );
  }

  // ── Progress screen ───────────────────────────────────────────
  if (!done && !paused) {
    return (
      <div className="max-w-lg mx-auto">
        <h2 className="text-base font-semibold text-gray-900 mb-1">4b. Enriquecimento de contactos</h2>
        <p className="text-sm text-gray-500 mb-8">A pesquisar no Racius.com...</p>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">
                {evt ? `${evt.processed} / ${evt.total} empresas` : "A iniciar..."}
              </span>
              <span className="text-sm font-semibold">{progress}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }} />
            </div>
            <div className="flex gap-6 text-sm">
              <span className="text-green-600 font-medium">
                ✓ {evt?.found ?? 0} contactos encontrados
              </span>
              <span className="text-gray-400">
                ✗ {(evt?.processed ?? 0) - (evt?.found ?? 0)} sem resultado
              </span>
            </div>
          </div>
        )}

        <button onClick={handlePause}
          className="w-full border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50">
          Pausar e continuar com resultados parciais
        </button>
      </div>
    );
  }

  // ── Results review screen ─────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">4b. Resultados do enriquecimento</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {paused ? "Pausado —" : "Concluído —"} {foundCount} de {Object.keys(merged).length} com dados encontrados.
            Pode editar antes de importar.
          </p>
        </div>
        <button
          onClick={() => onDone(merged)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-sm"
        >
          Continuar →
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide w-32">NIF</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Telefone</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Website</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide w-16">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Object.entries(merged).map(([nipc, data]) => (
              <tr key={nipc} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-gray-600">{nipc}</td>
                <td className="px-3 py-2">
                  <input
                    className="w-full border-0 bg-transparent focus:outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded px-1"
                    value={editOverrides[nipc]?.telefone ?? data.telefone ?? ""}
                    placeholder="—"
                    onChange={e => patchEdit(nipc, { telefone: e.target.value || null })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    className="w-full border-0 bg-transparent focus:outline-none focus:bg-white focus:border focus:border-blue-300 focus:rounded px-1"
                    value={editOverrides[nipc]?.website ?? data.website ?? ""}
                    placeholder="—"
                    onChange={e => patchEdit(nipc, { website: e.target.value || null })}
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  {(data.telefone || data.website)
                    ? <span className="text-green-600">✓</span>
                    : <span className="text-gray-300">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {Object.keys(merged).length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400">Sem resultados ainda</div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button onClick={onSkip}
          className="text-sm text-gray-500 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">
          Ignorar enriquecimento
        </button>
        <button onClick={() => onDone(merged)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-sm">
          Continuar com {foundCount} contactos →
        </button>
      </div>
    </div>
  );
}
