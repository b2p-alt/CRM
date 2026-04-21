"use client";

import { useState, useRef } from "react";

type Filtro = "ambos" | "sem_telefone" | "sem_email";

type Empresa = { nif: string; nome: string; telefone: string | null; email: string | null };

type EnrichRecord = {
  nif: string; nome: string;
  telefoneAtual: string | null; emailAtual: string | null;
  telefoneEncontrado: string | null; emailEncontrado: string | null;
  websiteEncontrado: string | null;
  found: boolean; error?: string;
};

type Step = "config" | "selecionar" | "running" | "review" | "done";

const FILTRO_LABELS: Record<Filtro, string> = {
  ambos:        "Sem telefone E sem email",
  sem_telefone: "Sem telefone (independente do email)",
  sem_email:    "Sem email (independente do telefone)",
};

const DELAY_OPTIONS = [
  { value: 100,  label: "100ms (mais rápido)" },
  { value: 300,  label: "300ms (recomendado)" },
  { value: 1000, label: "1s (mais seguro)" },
];

export default function EnriquecerWizard({ distritos }: { distritos: string[] }) {
  const [step, setStep]       = useState<Step>("config");
  const [distrito, setDistrito] = useState("");
  const [filtro, setFiltro]   = useState<Filtro>("ambos");
  const [delayMs, setDelayMs] = useState(300);
  const [count, setCount]     = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  const [lista, setLista]         = useState<Empresa[]>([]);
  const [paraEnriquecer, setParaEnriquecer] = useState<Set<string>>(new Set());
  const [loadingLista, setLoadingLista] = useState(false);
  const [progress, setProgress]   = useState({ done: 0, total: 0, nome: "" });
  const [results, setResults]     = useState<EnrichRecord[]>([]);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [atualizadas, setAtualizadas] = useState(0);
  const [applying, setApplying]   = useState(false);

  const stopRef = useRef(false);

  async function fetchCount(d: string, f: Filtro) {
    if (!d) { setCount(null); return; }
    setLoadingCount(true);
    const p = new URLSearchParams({ distrito: d, filtro: f });
    const res = await fetch(`/api/admin/enriquecer/count?${p}`);
    const data = await res.json();
    setCount(data.count ?? 0);
    setLoadingCount(false);
  }

  async function handleCarregarLista() {
    setLoadingLista(true);
    const p = new URLSearchParams({ filtro });
    if (distrito) p.set("distrito", distrito);
    const res = await fetch(`/api/admin/enriquecer/lista?${p}`);
    const empresas: Empresa[] = await res.json();
    if (!empresas.length) { alert("Nenhuma empresa encontrada."); setLoadingLista(false); return; }
    setLista(empresas);
    setParaEnriquecer(new Set(empresas.map(e => e.nif)));
    setLoadingLista(false);
    setStep("selecionar");
  }

  async function handleIniciarEnriquecimento() {
    stopRef.current = false;
    const empresas = lista.filter(e => paraEnriquecer.has(e.nif));
    if (!empresas.length) return;

    setProgress({ done: 0, total: empresas.length, nome: "" });
    setResults([]);
    setStep("running");

    const collected: EnrichRecord[] = [];

    for (let i = 0; i < empresas.length; i++) {
      if (stopRef.current) break;
      const e = empresas[i];
      setProgress({ done: i, total: empresas.length, nome: e.nome });

      try {
        const r = await fetch(`/api/admin/enriquecer/lookup?nif=${encodeURIComponent(e.nif)}`);
        const data = await r.json();
        collected.push({
          nif: e.nif, nome: e.nome,
          telefoneAtual: e.telefone, emailAtual: e.email,
          telefoneEncontrado: data.telefone ?? null,
          emailEncontrado:    data.email    ?? null,
          websiteEncontrado:  data.website  ?? null,
          found: data.found ?? false,
          error: data.error,
        });
      } catch (err) {
        collected.push({
          nif: e.nif, nome: e.nome,
          telefoneAtual: e.telefone, emailAtual: e.email,
          telefoneEncontrado: null, emailEncontrado: null, websiteEncontrado: null,
          found: false, error: String(err),
        });
      }

      setResults([...collected]);
      if (delayMs > 0 && i < empresas.length - 1) await sleep(delayMs);
    }

    setProgress(p => ({ ...p, done: p.total, nome: "" }));
    const autoSelect = new Set(
      collected.filter(r => r.found && (r.telefoneEncontrado || r.emailEncontrado || r.websiteEncontrado))
               .map(r => r.nif)
    );
    setSelected(autoSelect);
    setStep("review");
  }

  async function handleAplicar() {
    setApplying(true);
    const selecionados = results.filter(r => selected.has(r.nif) && r.found);
    try {
      const res = await fetch("/api/admin/enriquecer/aplicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selecionados }),
      });
      const data = await res.json();
      setAtualizadas(data.atualizadas ?? 0);
      setStep("done");
    } finally { setApplying(false); }
  }

  function reset() { setStep("config"); setLista([]); setParaEnriquecer(new Set()); setResults([]); setSelected(new Set()); setAtualizadas(0); setCount(null); }

  const foundCount = results.filter(r => r.found).length;
  const selectedWithData = [...selected].filter(nif => {
    const r = results.find(x => x.nif === nif);
    return r?.found && (r.telefoneEncontrado || r.emailEncontrado || r.websiteEncontrado);
  }).length;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // ── Config ────────────────────────────────────────────────────────────────
  if (step === "config") return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl space-y-5">
      <h2 className="font-semibold text-gray-900">1. Configurar enriquecimento</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Distrito</label>
        <select value={distrito} onChange={e => { setDistrito(e.target.value); fetchCount(e.target.value, filtro); }}
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
              <input type="radio" name="filtro" value={f} checked={filtro === f}
                onChange={() => { setFiltro(f); fetchCount(distrito, f); }} />
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
          {loadingCount ? "A contar..." : count === null ? "" : count === 0
            ? "Nenhuma empresa encontrada com estes critérios."
            : <><strong>{count}</strong> empresa{count !== 1 ? "s" : ""} · tempo estimado: ~{Math.ceil(count * delayMs / 60000)} min</>}
        </div>
      )}

      <button onClick={handleCarregarLista} disabled={loadingLista || loadingCount || count === 0}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded disabled:opacity-40 w-full">
        {loadingLista ? "A carregar lista..." : `Ver empresas e selecionar${count !== null ? ` (${count})` : ""}`}
      </button>
    </div>
  );

  // ── Selecionar ────────────────────────────────────────────────────────────
  if (step === "selecionar") {
    const allSelected = lista.every(e => paraEnriquecer.has(e.nif));
    const someSelected = lista.some(e => paraEnriquecer.has(e.nif));
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold text-gray-900">2. Selecionar empresas a enriquecer</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {paraEnriquecer.size} de {lista.length} selecionadas · cada pedido consome 1 crédito NIF.pt
            </p>
          </div>
          <button onClick={() => { setStep("config"); }}
            className="text-xs text-gray-400 hover:text-gray-600">← Voltar</button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 w-10">
                  <input type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => setParaEnriquecer(allSelected ? new Set() : new Set(lista.map(e => e.nif)))}
                    className="cursor-pointer" />
                </th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Empresa</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase w-32">Distrito</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase w-28">Telefone atual</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase w-40">Email atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map(e => (
                <tr key={e.nif} onClick={() => setParaEnriquecer(prev => {
                  const n = new Set(prev); n.has(e.nif) ? n.delete(e.nif) : n.add(e.nif); return n;
                })} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-2 text-center">
                    <input type="checkbox" checked={paraEnriquecer.has(e.nif)} readOnly className="pointer-events-none" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">{e.nome}</div>
                    <div className="text-xs text-gray-400 font-mono">{e.nif}</div>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">—</td>
                  <td className="px-4 py-2 text-xs text-gray-400">{e.telefone ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">{e.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={handleIniciarEnriquecimento} disabled={paraEnriquecer.size === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded disabled:opacity-40">
          Iniciar enriquecimento ({paraEnriquecer.size} empresa{paraEnriquecer.size !== 1 ? "s" : ""})
        </button>
      </div>
    );
  }

  // ── Running ───────────────────────────────────────────────────────────────
  if (step === "running") return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl space-y-4">
      <h2 className="font-semibold text-gray-900">2. Enriquecimento em curso</h2>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className="bg-blue-500 h-3 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{progress.done} / {progress.total} · {results.filter(r => r.found).length} encontrados</span>
        <span>{pct}%</span>
      </div>
      {progress.nome && <p className="text-sm text-gray-600 truncate">A pesquisar: <strong>{progress.nome}</strong></p>}
      <button onClick={() => { stopRef.current = true; }}
        className="text-sm text-red-500 hover:text-red-700 hover:underline">
        Parar
      </button>
    </div>
  );

  // ── Review ────────────────────────────────────────────────────────────────
  if (step === "review") return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-900">3. Revisão dos resultados</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {foundCount} de {results.length} com dados · {selectedWithData} selecionadas para atualizar
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setSelected(new Set(results.filter(r => r.found).map(r => r.nif)))}
            className="text-xs text-blue-600 hover:underline">Selecionar todas com dados</button>
          <button onClick={() => setSelected(new Set())}
            className="text-xs text-gray-400 hover:underline">Limpar seleção</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Empresa</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-36">Telefone</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-48">Email</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-40">Website</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map(r => {
              const hasData = r.found && (r.telefoneEncontrado || r.emailEncontrado || r.websiteEncontrado);
              return (
                <tr key={r.nif} className={hasData ? "hover:bg-gray-50" : "opacity-40"}>
                  <td className="px-3 py-2 text-center">
                    {hasData && <input type="checkbox" checked={selected.has(r.nif)} onChange={() => {
                      setSelected(prev => { const n = new Set(prev); n.has(r.nif) ? n.delete(r.nif) : n.add(r.nif); return n; });
                    }} className="cursor-pointer" />}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900 truncate max-w-[180px]">{r.nome}</div>
                    <div className="text-xs text-gray-400 font-mono">{r.nif}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.telefoneEncontrado ? <span className="text-green-700 font-medium">{r.telefoneEncontrado}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.emailEncontrado ? <span className="text-green-700 font-medium">{r.emailEncontrado}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.websiteEncontrado ? <span className="text-blue-600">{r.websiteEncontrado}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.found ? <span className="text-green-600">✓</span>
                      : <span className="text-gray-400">{r.error ? `⚠ ${r.error}` : "—"}</span>}
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
        <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">Recomeçar</button>
      </div>
    </div>
  );

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl text-center space-y-4">
      <div className="text-4xl">✓</div>
      <h2 className="font-semibold text-gray-900">Enriquecimento concluído</h2>
      <p className="text-gray-600">{atualizadas} empresa{atualizadas !== 1 ? "s" : ""} atualizadas na base de dados.</p>
      <button onClick={reset} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded">
        Novo enriquecimento
      </button>
    </div>
  );
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
