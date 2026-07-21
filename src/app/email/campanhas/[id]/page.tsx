"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";

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
  status: "RASCUNHO" | "A_ENVIAR" | "PAUSADA_LIMITE" | "CONCLUIDA";
  contaEmail: { nome: string };
  modeloEmail: { nome: string };
  criadoPor: { nome: string };
  envios: Envio[];
};

const STATUS_LABEL: Record<Campanha["status"], string> = {
  RASCUNHO: "Rascunho",
  A_ENVIAR: "A enviar",
  PAUSADA_LIMITE: "Pausada (limite diário)",
  CONCLUIDA: "Concluída",
};

const NOME_MES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function CampanhaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [campanha, setCampanha] = useState<Campanha | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [iniciando, setIniciando] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [msg, setMsg] = useState("");

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
  const falhados = campanha.envios.filter((e) => e.status === "FALHOU").length;

  function toggle(nif: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(nif)) next.delete(nif); else next.add(nif);
      return next;
    });
  }

  async function handleIniciar() {
    setIniciando(true);
    const res = await fetch(`/api/email/campanhas/${id}/iniciar`, { method: "POST" });
    setIniciando(false);
    if (res.ok) load();
    else { const d = await res.json(); alert(d.error ?? "Erro ao iniciar"); }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "65px", width: "auto" }} />
        <Link href="/email/campanhas" className="text-gray-400 hover:text-gray-600 text-sm">← Campanhas</Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900">{campanha.nome}</h1>
          <p className="text-xs text-gray-400">
            {campanha.teste ? "Campanha de teste" : `Mês ${NOME_MES[campanha.mesFiltro!]}`} · Conta {campanha.contaEmail.nome} · Modelo {campanha.modeloEmail.nome} · Criada por {campanha.criadoPor.nome}
          </p>
        </div>
        {campanha.status === "RASCUNHO" && (
          <button onClick={handleIniciar} disabled={iniciando}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {iniciando ? "A iniciar..." : "Iniciar envio"}
          </button>
        )}
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <Stat label="Estado" value={STATUS_LABEL[campanha.status]} />
          <Stat label="Enviados" value={`${enviados} / ${total}`} />
          <Stat label="Abertos" value={`${abertos}`} />
          <Stat label="Falhados" value={`${falhados}`} />
        </div>

        {msg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Selecione empresas para follow-up e adicione ao Kanban.</p>
          <button onClick={handleAdicionarKanban} disabled={adicionando || selecionados.size === 0}
            className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {adicionando ? "A adicionar..." : `Adicionar ao Kanban (${selecionados.size})`}
          </button>
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
              {campanha.envios.map((e) => (
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
