"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Envio = {
  id: string;
  status: "PENDENTE" | "ENVIANDO" | "ENVIADO" | "FALHOU";
  enviadoEm: string | null;
  abertoEm: string | null;
  erro: string | null;
  emailAvulso: string | null;
  empresa: { nif: string; nome: string; email: string; kanbanCard: { id: string } | null } | null;
};

type Campanha = {
  id: string;
  nome: string;
  mesFiltro: number | null;
  teste: boolean;
  status: "RASCUNHO" | "A_ENVIAR" | "PAUSADA_LIMITE" | "PAUSADA_MANUAL" | "CONCLUIDA";
  contaEmail: { id: string; nome: string };
  modeloEmail: { id: string; nome: string };
  criadoPor: { nome: string };
  envios: Envio[];
};

type Opcao = { id: string; nome: string };

type Filtro = "todos" | "abertos" | "naoAbertos" | "falhados";

const FILTRO_LABEL: Record<Filtro, string> = {
  todos: "Todos",
  abertos: "Abertos",
  naoAbertos: "Não abertos",
  falhados: "Falhados",
};

const STATUS_LABEL: Record<Campanha["status"], string> = {
  RASCUNHO: "Rascunho",
  A_ENVIAR: "A enviar",
  PAUSADA_LIMITE: "Pausada (limite diário)",
  PAUSADA_MANUAL: "Pausada",
  CONCLUIDA: "Concluída",
};

const NOME_MES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function CampanhaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [campanha, setCampanha] = useState<Campanha | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [iniciando, setIniciando] = useState(false);
  const [pausando, setPausando] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [msg, setMsg] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const [contas, setContas] = useState<Opcao[]>([]);
  const [modelos, setModelos] = useState<Opcao[]>([]);
  const [mostrarReenvio, setMostrarReenvio] = useState(false);
  const [nomeReenvio, setNomeReenvio] = useState("");
  const [contaReenvioId, setContaReenvioId] = useState("");
  const [modeloReenvioId, setModeloReenvioId] = useState("");
  const [criandoReenvio, setCriandoReenvio] = useState(false);
  const [erroReenvio, setErroReenvio] = useState("");

  const [mostrarEditar, setMostrarEditar] = useState(false);
  const [nomeEditar, setNomeEditar] = useState("");
  const [contaEditarId, setContaEditarId] = useState("");
  const [modeloEditarId, setModeloEditarId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [erroEditar, setErroEditar] = useState("");
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    fetch("/api/email/contas").then((r) => r.json()).then((cs: Array<Opcao & { ativo: boolean }>) =>
      setContas(cs.filter((c) => c.ativo)));
    fetch("/api/email/modelos").then((r) => r.json()).then(setModelos);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/email/campanhas/${id}`);
    if (res.ok) setCampanha(await res.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (campanha?.status !== "A_ENVIAR") return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [campanha?.status, load]);

  if (!campanha) return <div className="p-6 text-sm text-gray-400">A carregar...</div>;

  const total = campanha.envios.length;
  const enviados = campanha.envios.filter((e) => e.status === "ENVIADO").length;
  const abertos = campanha.envios.filter((e) => e.abertoEm).length;
  const naoAbertos = campanha.envios.filter((e) => e.status === "ENVIADO" && !e.abertoEm).length;
  const falhados = campanha.envios.filter((e) => e.status === "FALHOU").length;

  const enviosFiltrados = campanha.envios.filter((e) => {
    if (filtro === "abertos") return !!e.abertoEm;
    if (filtro === "naoAbertos") return e.status === "ENVIADO" && !e.abertoEm;
    if (filtro === "falhados") return e.status === "FALHOU";
    return true;
  });

  function toggle(nif: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(nif)) next.delete(nif); else next.add(nif);
      return next;
    });
  }

  function selecionarFiltrados() {
    const nifs = enviosFiltrados.map((e) => e.empresa?.nif).filter((n): n is string => !!n);
    setSelecionados(new Set(nifs));
  }

  async function handleIniciar() {
    setIniciando(true);
    const res = await fetch(`/api/email/campanhas/${id}/iniciar`, { method: "POST" });
    setIniciando(false);
    if (res.ok) load();
    else { const d = await res.json(); alert(d.error ?? "Erro ao iniciar"); }
  }

  async function handlePausar() {
    setPausando(true);
    const res = await fetch(`/api/email/campanhas/${id}/pausar`, { method: "POST" });
    setPausando(false);
    if (res.ok) load();
    else { const d = await res.json(); alert(d.error ?? "Erro ao pausar"); }
  }

  async function handleAdicionarKanban() {
    if (selecionados.size === 0) return;
    setAdicionando(true);
    const res = await fetch(`/api/email/campanhas/${id}/kanban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nifs: Array.from(selecionados) }),
    });
    const data = await res.json();
    setAdicionando(false);
    if (res.ok) {
      setMsg(`${data.criados} empresa(s) adicionada(s) ao Kanban.`);
      setSelecionados(new Set());
      load();
    } else {
      alert(data.error ?? "Erro ao adicionar ao Kanban");
    }
  }

  function abrirReenvio() {
    setNomeReenvio(`${campanha!.nome} - Reenvio`);
    setContaReenvioId(campanha!.contaEmail.id);
    setModeloReenvioId("");
    setErroReenvio("");
    setMostrarReenvio(true);
  }

  async function handleCriarReenvio() {
    setErroReenvio("");
    if (!nomeReenvio.trim() || !contaReenvioId || !modeloReenvioId) {
      setErroReenvio("Preencha o nome, a conta e o modelo.");
      return;
    }
    setCriandoReenvio(true);
    const res = await fetch("/api/email/campanhas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: nomeReenvio,
        contaEmailId: contaReenvioId,
        modeloEmailId: modeloReenvioId,
        nifsExplicitos: Array.from(selecionados),
      }),
    });
    const data = await res.json();
    setCriandoReenvio(false);
    if (!res.ok) { setErroReenvio(data.error ?? "Erro ao criar campanha de reenvio"); return; }
    router.push(`/email/campanhas/${data.id}`);
  }

  function abrirEditar() {
    setNomeEditar(campanha!.nome);
    setContaEditarId(campanha!.contaEmail.id);
    setModeloEditarId(campanha!.modeloEmail.id);
    setErroEditar("");
    setMostrarEditar(true);
  }

  async function handleGuardarEdicao() {
    setErroEditar("");
    if (!nomeEditar.trim() || !contaEditarId || !modeloEditarId) {
      setErroEditar("Preencha o nome, a conta e o modelo.");
      return;
    }
    setGuardando(true);
    const res = await fetch(`/api/email/campanhas/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nomeEditar, contaEmailId: contaEditarId, modeloEmailId: modeloEditarId }),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) { setErroEditar(data.error ?? "Erro ao guardar"); return; }
    setMostrarEditar(false);
    load();
  }

  async function handleEliminar() {
    if (!confirm(`Eliminar a campanha "${campanha!.nome}"? Esta ação não pode ser desfeita.`)) return;
    setEliminando(true);
    const res = await fetch(`/api/email/campanhas/${id}`, { method: "DELETE" });
    setEliminando(false);
    if (res.ok) { router.push("/email/campanhas"); }
    else { const d = await res.json(); alert(d.error ?? "Erro ao eliminar"); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "65px", width: "auto" }} />
        <Link href="/email/campanhas" className="text-gray-400 hover:text-gray-600 text-sm">← Campanhas</Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900">{campanha.nome}</h1>
          <p className="text-xs text-gray-400">
            {campanha.teste ? "Campanha de teste" : campanha.mesFiltro ? `Mês ${NOME_MES[campanha.mesFiltro]}` : "Lista personalizada"} · Conta {campanha.contaEmail.nome} · Modelo {campanha.modeloEmail.nome} · Criada por {campanha.criadoPor.nome}
          </p>
        </div>
        {campanha.status === "RASCUNHO" && (
          <>
            <button onClick={handleEliminar} disabled={eliminando}
              className="text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {eliminando ? "A eliminar..." : "Eliminar"}
            </button>
            <button onClick={abrirEditar}
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg">
              Editar
            </button>
            <button onClick={handleIniciar} disabled={iniciando}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {iniciando ? "A iniciar..." : "Iniciar envio"}
            </button>
          </>
        )}
        {campanha.status === "A_ENVIAR" && (
          <button onClick={handlePausar} disabled={pausando}
            className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {pausando ? "A pausar..." : "Pausar envio"}
          </button>
        )}
        {(campanha.status === "PAUSADA_LIMITE" || campanha.status === "PAUSADA_MANUAL") && (
          <button onClick={handleIniciar} disabled={iniciando}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {iniciando ? "A retomar..." : "Retomar envio"}
          </button>
        )}
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="grid grid-cols-5 gap-4">
          <Stat label="Estado" value={STATUS_LABEL[campanha.status]} />
          <Stat label="Enviados" value={`${enviados} / ${total}`} />
          <Stat label="Abertos" value={`${abertos}`} />
          <Stat label="Não abertos" value={`${naoAbertos}`} />
          <Stat label="Falhados" value={`${falhados}`} />
        </div>

        {msg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            {(Object.keys(FILTRO_LABEL) as Filtro[]).map((f) => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                  filtro === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                {FILTRO_LABEL[f]}
              </button>
            ))}
            <button onClick={selecionarFiltrados}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5">
              Selecionar {enviosFiltrados.length} da lista atual
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={abrirReenvio} disabled={selecionados.size === 0}
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              Criar campanha de reenvio ({selecionados.size})
            </button>
            <button onClick={handleAdicionarKanban} disabled={adicionando || selecionados.size === 0}
              className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {adicionando ? "A adicionar..." : `Adicionar ao Kanban (${selecionados.size})`}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Enviado em</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Aberto em</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Kanban</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enviosFiltrados.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {e.empresa && (
                      <input type="checkbox" checked={selecionados.has(e.empresa.nif)}
                        onChange={() => toggle(e.empresa!.nif)} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.empresa ? (
                      <>
                        <div className="font-medium text-gray-900">{e.empresa.nome}</div>
                        <div className="text-xs text-gray-500">{e.empresa.email}</div>
                      </>
                    ) : (
                      <div className="font-medium text-gray-900">
                        {e.emailAvulso} <span className="text-xs text-gray-400 font-normal">(teste)</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <EnvioStatusBadge status={e.status} erro={e.erro} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{e.enviadoEm ? new Date(e.enviadoEm).toLocaleString("pt-PT") : "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{e.abertoEm ? new Date(e.abertoEm).toLocaleString("pt-PT") : "—"}</td>
                  <td className="px-4 py-3">
                    {!e.empresa ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : e.empresa.kanbanCard ? (
                      <span className="text-xs text-green-700">No Kanban</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {mostrarEditar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 w-full max-w-md space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Editar campanha</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da campanha</label>
              <input value={nomeEditar} onChange={(e) => setNomeEditar(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta de envio</label>
              <select value={contaEditarId} onChange={(e) => setContaEditarId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione...</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo de email</label>
              <select value={modeloEditarId} onChange={(e) => setModeloEditarId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione...</option>
                {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            {erroEditar && <p className="text-sm text-red-600">{erroEditar}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setMostrarEditar(false)}
                className="text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg">
                Cancelar
              </button>
              <button onClick={handleGuardarEdicao} disabled={guardando}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                {guardando ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarReenvio && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 w-full max-w-md space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Criar campanha de reenvio</h2>
            <p className="text-xs text-gray-500">
              Cria uma nova campanha (em rascunho) apenas para as {selecionados.size} empresa(s) selecionada(s). Não é enviada automaticamente — reveja e clique em &quot;Iniciar envio&quot; na página da nova campanha.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da campanha</label>
              <input value={nomeReenvio} onChange={(e) => setNomeReenvio(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta de envio</label>
              <select value={contaReenvioId} onChange={(e) => setContaReenvioId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione...</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modelo de email</label>
              <select value={modeloReenvioId} onChange={(e) => setModeloReenvioId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione...</option>
                {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            {erroReenvio && <p className="text-sm text-red-600">{erroReenvio}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setMostrarReenvio(false)}
                className="text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg">
                Cancelar
              </button>
              <button onClick={handleCriarReenvio} disabled={criandoReenvio}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                {criandoReenvio ? "A criar..." : "Criar campanha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function EnvioStatusBadge({ status, erro }: { status: Envio["status"]; erro: string | null }) {
  const cor = status === "ENVIADO" ? "bg-green-100 text-green-700"
    : status === "FALHOU" ? "bg-red-100 text-red-700"
    : status === "ENVIANDO" ? "bg-blue-100 text-blue-700"
    : "bg-gray-100 text-gray-500";
  const label = status === "ENVIADO" ? "Enviado" : status === "FALHOU" ? "Falhou"
    : status === "ENVIANDO" ? "A enviar" : "Pendente";
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${cor}`} title={erro ?? undefined}>
      {label}
    </span>
  );
}
