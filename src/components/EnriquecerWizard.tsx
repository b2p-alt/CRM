"use client";

import { useState, useEffect, useRef } from "react";

type Filtro = "ambos" | "sem_telefone" | "sem_email";

type EnrichRecord = {
  nif: string;
  nome: string;
  telefoneAtual: string | null;
  emailAtual: string | null;
  telefoneEncontrado: string | null;
  emailEncontrado: string | null;
  websiteEncontrado: string | null;
  found: boolean;
  error?: string;
};

type Step = "config" | "running" | "review" | "done";

const FILTRO_LABELS: Record<Filtro, string> = {
  ambos: "Sem telefone E sem email",
  sem_telefone: "Sem telefone (independente do email)",
  sem_email: "Sem email (independente do telefone)",
};

const DELAY_OPTIONS = [
  { value: 200,  label: "200ms (mais rápido)" },
  { value: 500,  label: "500ms (recomendado)" },
  { value: 1000, label: "1s (mais seguro)" },
];

export default function EnriquecerWizard({ distritos }: { distritos: string[] }) {
  const [step, setStep] = useState<Step>("config");

  // Config
  const [distrito, setDistrito] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("ambos");
  const [delayMs, setDelayMs] = useState(500);
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Running
  const [jobId, setJobId] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0, currentNome: "" });
  const [starting, setStarting] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Review
  const [results, setResults] = useState<EnrichRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Done
  const [atualizadas, setAtualizadas] = useState(0);
  const [applying, setApplying] = useState(false);

  // Fetch count when config changes
  useEffect(() => {
    setCount(null);
    if (!distrito) return;
    setLoadingCount(true);
    const params = new URLSearchParams({ distrito, filtro });
    fetch(`/api/admin/enriquecer/count?${params}`)
      .then(r => r.json())
      .then(d => setCount(d.count ?? 0))
      .finally(() => setLoadingCount(false));
  }, [distrito, filtro]);

  async function handleStart() {
    setStarting(true);
    try {
      const res = await fetch("/api/admin/enriquecer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distrito: distrito || null, filtro, delayMs }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Erro ao iniciar"); return; }
      const { jobId: jid, total } = await res.json();
      setJobId(jid);
      setProgress({ done: 0, total, currentNome: "" });
      setStep("running");

      // SSE
      const es = new EventSource(`/api/admin/enriquecer/stream?jobId=${jid}`);
      esRef.current = es;
      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.error) { es.close(); return; }
        setProgress({ done: data.done, total: data.total, currentNome: data.currentNome });
        if (data.status === "done" || data.status === "aborted") {
          es.close();
          fetchResults(jid);
        }
      };
    } finally { setStarting(false); }
  }

  async function fetchResults(jid: string) {
    const res = await fetch(`/api/admin/enriquecer/resultados?jobId=${jid}`);
    if (!res.ok) return;
    const data: EnrichRecord[] = await res.json();
    setResults(data);
    setSelected(new Set(data.filter(r => r.found && (r.telefoneEncontrado || r.emailEncontrado || r.websiteEncontrado)).map(r => r.nif)));
    setStep("review");
  }

  async function handleAbort() {
    await fetch("/api/admin/enriquecer/abort", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }),
    });
    esRef.current?.close();
  }

  async function handleAplicar() {
    setApplying(true);
    try {
      const res = await fetch("/api/admin/enriquecer/aplicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, selecionados: [...selected] }),
      });
      if (!res.ok) { alert("Erro ao aplicar"); return; }
      const { atualizadas: n } = await res.json();
      setAtualizadas(n);
      setStep("done");
    } finally { setApplying(false); }
  }

  function toggleSelect(nif: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(nif) ? next.delete(nif) : next.add(nif);
      return next;
    });
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const foundCount = results.filter(r => r.found).length;
  const selectedWithData = [...selected].filter(nif => {
    const r = results.find(x => x.nif === nif);
    return r?.found && (r.telefoneEncontrado || r.emailEncontrado || r.websiteEncontrado);
  }).length;

  // ── Step: Config ──────────────────────────────────────────────────────────
  if (step === "config") return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl space-y-5">
      <h2 className="font-semibold text-gray-900">1. Configurar enriquecimento</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Distrito</label>
        <select value={distrito} onChange={e => setDistrito(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
          <option value="">Todos os distritos</option>
          {distritos.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Empresas a enriquecer</label>
        <div className="space-y-2">
          {(Object.keys(FILTRO_LABELS) as Filtro[]).map(f => (
            <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="filtro" value={f} checked={filtro === f} onChange={() => setFiltro(f)} />
              {FILTRO_LABELS[f]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo entre pedidos</label>
        <select value={delayMs} onChange={e => setDelayMs(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full">
          {DELAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {distrito && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
          {loadingCount ? "A contar..." : count === null ? "" : (
            count === 0
              ? "Nenhuma empresa encontrada com estes critérios."
              : <>Encontradas <strong>{count}</strong> empresa{count !== 1 ? "s" : ""} para enriquecer.
                {" "}Tempo estimado: ~{Math.ceil(count * delayMs / 1000 / 60)} min.</>
          )}
        </div>
      )}

      {!distrito && (
        <p className="text-xs text-gray-400">Selecione um distrito para ver a contagem antes de iniciar.</p>
      )}

      <button
        onClick={handleStart}
        disabled={starting || count === 0 || loadingCount}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded disabled:opacity-40 w-full"
      >
        {starting ? "A iniciar..." : `Iniciar enriquecimento${count !== null ? ` (${count} empresas)` : ""}`}
      </button>
    </div>
  );

  // ── Step: Running ─────────────────────────────────────────────────────────
  if (step === "running") return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl space-y-4">
      <h2 className="font-semibold text-gray-900">2. Enriquecimento em curso</h2>

      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className="bg-blue-500 h-3 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{progress.done} / {progress.total}</span>
        <span>{pct}%</span>
      </div>

      {progress.currentNome && (
        <p className="text-sm text-gray-600 truncate">A pesquisar: <strong>{progress.currentNome}</strong></p>
      )}

      <button onClick={handleAbort}
        className="text-sm text-red-500 hover:text-red-700 hover:underline">
        Parar
      </button>
    </div>
  );

  // ── Step: Review ──────────────────────────────────────────────────────────
  if (step === "review") return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">3. Revisão dos resultados</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {foundCount} de {results.length} empresas com dados encontrados · {selectedWithData} selecionadas para atualizar
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSelected(new Set(results.filter(r => r.found).map(r => r.nif)))}
            className="text-xs text-blue-600 hover:underline">Selecionar todas com dados</button>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-gray-400 hover:underline">Limpar seleção</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Empresa</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-36">Telefone encontrado</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-48">Email encontrado</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-40">Website encontrado</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-20">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map(r => {
              const hasData = r.found && (r.telefoneEncontrado || r.emailEncontrado || r.websiteEncontrado);
              return (
                <tr key={r.nif} className={`${hasData ? "hover:bg-gray-50" : "opacity-50"}`}>
                  <td className="px-3 py-2 text-center">
                    {hasData && (
                      <input type="checkbox" checked={selected.has(r.nif)} onChange={() => toggleSelect(r.nif)}
                        className="cursor-pointer" />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900 truncate max-w-[200px]">{r.nome}</div>
                    <div className="text-xs text-gray-400 font-mono">{r.nif}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.telefoneEncontrado
                      ? <span className="text-green-700 font-medium">{r.telefoneEncontrado}</span>
                      : <span className="text-gray-300">—</span>}
                    {r.telefoneAtual && <div className="text-gray-400">atual: {r.telefoneAtual}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.emailEncontrado
                      ? <span className="text-green-700 font-medium">{r.emailEncontrado}</span>
                      : <span className="text-gray-300">—</span>}
                    {r.emailAtual && <div className="text-gray-400">atual: {r.emailAtual}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.websiteEncontrado
                      ? <span className="text-blue-600">{r.websiteEncontrado}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.found
                      ? <span className="text-green-600">✓ Encontrado</span>
                      : <span className="text-gray-400">{r.error ? `⚠ ${r.error}` : "Não encontrado"}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <button onClick={handleAplicar} disabled={applying || selectedWithData === 0}
          className="bg-green-600 hover:bg-green-700 text-white text-sm px-5 py-2 rounded disabled:opacity-40">
          {applying ? "A aplicar..." : `Aplicar ${selectedWithData} atualização${selectedWithData !== 1 ? "s" : ""}`}
        </button>
        <button onClick={() => { setStep("config"); setResults([]); setSelected(new Set()); }}
          className="text-sm text-gray-500 hover:text-gray-700">
          Recomeçar
        </button>
      </div>
    </div>
  );

  // ── Step: Done ────────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl space-y-4 text-center">
      <div className="text-4xl">✓</div>
      <h2 className="font-semibold text-gray-900">Enriquecimento concluído</h2>
      <p className="text-gray-600">{atualizadas} empresa{atualizadas !== 1 ? "s" : ""} atualizadas na base de dados.</p>
      <button onClick={() => { setStep("config"); setResults([]); setSelected(new Set()); setAtualizadas(0); }}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded">
        Novo enriquecimento
      </button>
    </div>
  );
}
