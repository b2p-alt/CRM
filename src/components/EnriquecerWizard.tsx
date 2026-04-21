"use client";

import { useState, useRef } from "react";

type Filtro = "ambos" | "sem_telefone" | "sem_email";
type NifStatus = "encontrado" | "sem_contactos" | "sem_dados" | "nif_invalido";

type Empresa = { nif: string; nome: string; telefone: string | null; email: string | null };

type EnrichRecord = {
  nif: string; nome: string;
  telefoneAtual: string | null; emailAtual: string | null;
  telefoneEncontrado: string | null; emailEncontrado: string | null;
  websiteEncontrado: string | null;
  found: boolean; error?: string;
  nifStatus: NifStatus;
  raw: unknown;
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

const STATUS_LABEL: Record<NifStatus, string> = {
  encontrado:     "Dados encontrados",
  sem_contactos:  "NIF existe mas sem contactos",
  sem_dados:      "Sem dados",
  nif_invalido:   "NIF inválido / inexistente",
};

function classifyStatus(data: Record<string, unknown>): NifStatus {
  if (data.found) {
    if (data.telefone || data.email || data.website) return "encontrado";
    return "sem_contactos";
  }
  const raw = data.raw as Record<string, unknown> | null | undefined;
  if (raw?.nif_validation === false) return "nif_invalido";
  return "sem_dados";
}

export default function EnriquecerWizard({ distritos }: { distritos: string[] }) {
  const [step, setStep]       = useState<Step>("config");
  const [distrito, setDistrito] = useState("");
  const [filtro, setFiltro]   = useState<Filtro>("ambos");
  const [delayMs, setDelayMs] = useState(300);
  const [incluirJaPesquisados, setIncluirJaPesquisados] = useState(false);
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
  const [eliminando, setEliminando] = useState(false);

  const stopRef = useRef(false);

  async function fetchCount(d: string, f: Filtro, ijp: boolean) {
    if (!d) { setCount(null); return; }
    setLoadingCount(true);
    const p = new URLSearchParams({ distrito: d, filtro: f });
    if (ijp) p.set("incluirJaPesquisados", "1");
    const res = await fetch(`/api/admin/enriquecer/count?${p}`);
    const data = await res.json();
    setCount(data.count ?? 0);
    setLoadingCount(false);
  }

  async function handleCarregarLista() {
    setLoadingLista(true);
    const p = new URLSearchParams({ filtro });
    if (distrito) p.set("distrito", distrito);
    if (incluirJaPesquisados) p.set("incluirJaPesquisados", "1");
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
        const data = await r.json() as Record<string, unknown>;
        collected.push({
          nif: e.nif, nome: e.nome,
          telefoneAtual: e.telefone, emailAtual: e.email,
          telefoneEncontrado: (data.telefone as string) ?? null,
          emailEncontrado:    (data.email    as string) ?? null,
          websiteEncontrado:  (data.website  as string) ?? null,
          found: (data.found as boolean) ?? false,
          error: data.error as string | undefined,
          nifStatus: classifyStatus(data),
          raw: data.raw ?? data,
        });
      } catch (err) {
        collected.push({
          nif: e.nif, nome: e.nome,
          telefoneAtual: e.telefone, emailAtual: e.email,
          telefoneEncontrado: null, emailEncontrado: null, websiteEncontrado: null,
          found: false, error: String(err),
          nifStatus: "sem_dados",
          raw: null,
        });
      }

      setResults([...collected]);
      if (delayMs > 0 && i < empresas.length - 1) await sleep(delayMs);
    }

    setProgress(p => ({ ...p, done: p.total, nome: "" }));
    const autoSelect = new Set(
      collected.filter(r => r.nifStatus === "encontrado").map(r => r.nif)
    );
    setSelected(autoSelect);
    setStep("review");
  }

  async function handleAplicar() {
    setApplying(true);
    const selecionados = results.filter(r => selected.has(r.nif) && r.nifStatus === "encontrado");
    const todos = results.map(r => ({ nif: r.nif, nifStatus: r.nifStatus, raw: r.raw }));
    try {
      const res = await fetch("/api/admin/enriquecer/aplicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selecionados, todos }),
      });
      const data = await res.json();
      setAtualizadas(data.atualizadas ?? 0);
      setStep("done");
    } finally { setApplying(false); }
  }

  async function handleEliminar(nifs: string[]) {
    if (!nifs.length) return;
    const ok = confirm(`Eliminar ${nifs.length} empresa${nifs.length !== 1 ? "s" : ""} da base de dados?\nEsta ação não pode ser desfeita.`);
    if (!ok) return;
    setEliminando(true);
    try {
      await fetch("/api/admin/enriquecer/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nifs }),
      });
      // Remove from results
      setResults(prev => prev.filter(r => !nifs.includes(r.nif)));
    } finally { setEliminando(false); }
  }

  function reset() {
    setStep("config"); setLista([]); setParaEnriquecer(new Set());
    setResults([]); setSelected(new Set()); setAtualizadas(0); setCount(null);
  }

  const foundCount = results.filter(r => r.nifStatus === "encontrado").length;
  const selectedWithData = [...selected].filter(nif => {
    const r = results.find(x => x.nif === nif);
    return r?.nifStatus === "encontrado";
  }).length;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // ── Config ────────────────────────────────────────────────────────────────
  if (step === "config") return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl space-y-5">
      <h2 className="font-semibold text-gray-900">1. Configurar enriquecimento</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Distrito</label>
        <select value={distrito} onChange={e => { setDistrito(e.target.value); fetchCount(e.target.value, filtro, incluirJaPesquisados); }}
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
                onChange={() => { setFiltro(f); fetchCount(distrito, f, incluirJaPesquisados); }} />
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

      <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-600">
        <input type="checkbox" checked={incluirJaPesquisados}
          onChange={e => { setIncluirJaPesquisados(e.target.checked); fetchCount(distrito, filtro, e.target.checked); }} />
        Incluir NIFs já pesquisados sem resultado
      </label>

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
          <button onClick={() => setStep("config")} className="text-xs text-gray-400 hover:text-gray-600">← Voltar</button>
        </div>

        <BtnIniciar count={paraEnriquecer.size} onClick={handleIniciarEnriquecimento} />

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
                  <td className="px-4 py-2 text-xs text-gray-400">{e.telefone ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-gray-400">{e.email ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <BtnIniciar count={paraEnriquecer.size} onClick={handleIniciarEnriquecimento} />
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
        <span>{progress.done} / {progress.total} · {results.filter(r => r.nifStatus === "encontrado").length} encontrados</span>
        <span>{pct}%</span>
      </div>
      {progress.nome && <p className="text-sm text-gray-600 truncate">A pesquisar: <strong>{progress.nome}</strong></p>}
      <button onClick={() => { stopRef.current = true; }} className="text-sm text-red-500 hover:text-red-700 hover:underline">
        Parar
      </button>
    </div>
  );

  // ── Review ────────────────────────────────────────────────────────────────
  if (step === "review") {
    const withData    = results.filter(r => r.nifStatus === "encontrado");
    const semContact  = results.filter(r => r.nifStatus === "sem_contactos");
    const semDados    = results.filter(r => r.nifStatus === "sem_dados");
    const nifInvalido = results.filter(r => r.nifStatus === "nif_invalido");

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold text-gray-900">3. Revisão dos resultados</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {foundCount} de {results.length} com dados · {selectedWithData} selecionadas para atualizar
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSelected(new Set(withData.map(r => r.nif)))}
              className="text-xs text-blue-600 hover:underline">Selecionar todas com dados</button>
            <button onClick={() => setSelected(new Set())}
              className="text-xs text-gray-400 hover:underline">Limpar seleção</button>
          </div>
        </div>

        <BtnAplicar count={selectedWithData} applying={applying} onClick={handleAplicar} onReset={reset} />

        {/* Results with data */}
        {withData.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Empresa</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-36">Telefone</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-48">Email</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-40">Website</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {withData.map(r => (
                  <tr key={r.nif} className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelected(prev => { const n = new Set(prev); n.has(r.nif) ? n.delete(r.nif) : n.add(r.nif); return n; })}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={selected.has(r.nif)} readOnly className="pointer-events-none" />
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <BtnAplicar count={selectedWithData} applying={applying} onClick={handleAplicar} onReset={reset} />

        {/* Error report */}
        {(nifInvalido.length > 0 || semDados.length > 0 || semContact.length > 0) && (
          <div className="border border-orange-200 rounded-xl overflow-hidden">
            <div className="bg-orange-50 px-4 py-3 border-b border-orange-200">
              <h3 className="font-semibold text-orange-900 text-sm">Relatório de erros</h3>
              <p className="text-xs text-orange-700 mt-0.5">
                {nifInvalido.length} NIF inválido · {semDados.length} sem dados · {semContact.length} sem contactos
                {" · "}O estado será guardado na BD ao aplicar.
              </p>
            </div>

            {/* NIF inválido */}
            {nifInvalido.length > 0 && (
              <ErrorGroup
                title="NIF inválido / empresa inexistente"
                records={nifInvalido}
                color="red"
                onEliminar={() => handleEliminar(nifInvalido.map(r => r.nif))}
                eliminando={eliminando}
              />
            )}

            {/* Sem dados */}
            {semDados.length > 0 && (
              <ErrorGroup
                title="Sem dados no NIF.pt"
                records={semDados}
                color="yellow"
              />
            )}

            {/* Sem contactos */}
            {semContact.length > 0 && (
              <ErrorGroup
                title="Encontrado mas sem contactos"
                records={semContact}
                color="gray"
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 max-w-xl text-center space-y-4">
      <div className="text-4xl">✓</div>
      <h2 className="font-semibold text-gray-900">Enriquecimento concluído</h2>
      <p className="text-gray-600">{atualizadas} empresa{atualizadas !== 1 ? "s" : ""} atualizadas na base de dados.</p>
      <p className="text-xs text-gray-400">O estado de pesquisa de todos os NIFs foi guardado — NIFs sem resultado serão excluídos automaticamente das próximas pesquisas.</p>
      <button onClick={reset} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded">
        Novo enriquecimento
      </button>
    </div>
  );
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function BtnIniciar({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={count === 0}
      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded disabled:opacity-40">
      Iniciar enriquecimento ({count} empresa{count !== 1 ? "s" : ""})
    </button>
  );
}

function BtnAplicar({ count, applying, onClick, onReset }: { count: number; applying: boolean; onClick: () => void; onReset: () => void }) {
  return (
    <div className="flex gap-3">
      <button onClick={onClick} disabled={applying || count === 0}
        className="bg-green-600 hover:bg-green-700 text-white text-sm px-5 py-2 rounded disabled:opacity-40">
        {applying ? "A aplicar..." : `Aplicar ${count} atualização${count !== 1 ? "s" : ""}`}
      </button>
      <button onClick={onReset} className="text-sm text-gray-500 hover:text-gray-700">Recomeçar</button>
    </div>
  );
}

type EnrichRecordLike = { nif: string; nome: string; error?: string };

function ErrorGroup({
  title, records, color, onEliminar, eliminando,
}: {
  title: string;
  records: EnrichRecordLike[];
  color: "red" | "yellow" | "gray";
  onEliminar?: () => void;
  eliminando?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const colorMap = {
    red:    { badge: "bg-red-100 text-red-800",    dot: "bg-red-400" },
    yellow: { badge: "bg-yellow-100 text-yellow-800", dot: "bg-yellow-400" },
    gray:   { badge: "bg-gray-100 text-gray-700",  dot: "bg-gray-300" },
  };
  const c = colorMap[color];

  return (
    <div className="border-t border-orange-100">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-50 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
          <span className="text-sm font-medium text-gray-800">{title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>{records.length}</span>
        </div>
        <span className="text-xs text-gray-400">{open ? "▲ fechar" : "▼ ver lista"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {onEliminar && (
            <button
              onClick={onEliminar}
              disabled={eliminando}
              className="bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-1.5 rounded disabled:opacity-40"
            >
              {eliminando ? "A eliminar..." : `Eliminar ${records.length} empresa${records.length !== 1 ? "s" : ""} da base`}
            </button>
          )}
          <div className="border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-500 uppercase">Empresa</th>
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-500 uppercase w-40">NIF</th>
                  <th className="text-left px-3 py-1.5 font-semibold text-gray-500 uppercase">Erro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(r => (
                  <tr key={r.nif}>
                    <td className="px-3 py-1.5 text-gray-800">{r.nome}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-500">{r.nif}</td>
                    <td className="px-3 py-1.5 text-gray-400">{r.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
