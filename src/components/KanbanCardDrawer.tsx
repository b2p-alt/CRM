"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ─── Constants ────────────────────────────────────────────────
const COLUNAS = [
  { key: "EM_REVISAO",        label: "Em Revisão" },
  { key: "PRIMEIRO_CONTACTO", label: "1º Contacto" },
  { key: "ENVIAR_EMAIL",      label: "Enviar Email" },
  { key: "EM_CONTACTO",       label: "Em Contacto" },
  { key: "PROPOSTA",          label: "Proposta" },
  { key: "CLIENTE",           label: "Cliente" },
] as const;
type Coluna = (typeof COLUNAS)[number]["key"];

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_FULL  = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const CICLO_LABEL: Record<string, string> = {
  SIMPLES: "Simples", BI_HORARIO: "Bi-horário", TRI_HORARIO: "Tri-horário",
  DIARIO: "Diário", SEMANAL: "Semanal", SEMANAL_OPCIONAL: "Semanal Opcional",
};

const ANO_ATUAL = new Date().getFullYear();
const ANOS = Array.from({ length: 16 }, (_, i) => ANO_ATUAL - 2 + i);

// ─── Helpers ──────────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
  );
}

function formatKwh(val: number | null) {
  if (val === null) return null;
  return val >= 1000
    ? `${(val / 1000).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} MWh`
    : `${val.toLocaleString("pt-PT")} kWh`;
}

function terminoInfo(mesTermino: string | null) {
  if (!mesTermino) return null;
  const [y, m] = mesTermino.split("-").map(Number);
  const diff = (y - ANO_ATUAL) * 12 + (m - (new Date().getMonth() + 1));
  const label = `${MESES_ABREV[m - 1]}/${y}`;
  if (diff < 0)  return { label: `${label} (expirado)`, color: "text-red-600 font-bold" };
  if (diff <= 3) return { label,                         color: "text-red-500 font-semibold" };
  if (diff <= 6) return { label,                         color: "text-amber-600 font-medium" };
  return           { label,                              color: "text-green-600" };
}

// ─── Types ────────────────────────────────────────────────────
type Nota = { id: string; texto: string; createdAt: string; user: { nome: string } };
type Instalacao = {
  id: string; cpe: string; tipoInstalacao: string; cicloTarifario: string;
  fornecedor: string | null; mesTermino: string | null; consumoAnual: number | null;
  dataInicioContrato: string | null; morada: string | null;
};
export type DrawerCard = {
  id: string; coluna: Coluna; agendamentoData: string | null; agendamentoNota: string | null;
  empresaNif: string;
  empresa: {
    nome: string; telefone: string | null; email: string | null; morada: string | null;
    distrito: string | null; localidade: string | null; quemAtende: string | null;
    responsavel: string | null; _count: { instalacoes: number };
    lastContactAt: string | null;
  };
  user: { nome: string }; userId: string;
};

// ─── Component ────────────────────────────────────────────────
export default function KanbanCardDrawer({
  card, userRole, userId, onClose, onMove, onRemove, onAgendaChange, onNoteAdded, onContactSaved,
}: {
  card: DrawerCard; userRole: string; userId: string;
  onClose: () => void;
  onMove: (cardId: string, coluna: Coluna) => void;
  onRemove: (card: DrawerCard) => void;
  onAgendaChange: (cardId: string, agendamentoData: string | null) => void;
  onNoteAdded?: (cardId: string, createdAt: string) => void;
  onContactSaved?: (cardId: string, patch: { telefone: string; email: string; quemAtende: string; responsavel: string }) => void;
}) {
  const [notas, setNotas]           = useState<Nota[]>([]);
  const [instalacoes, setInstalacoes] = useState<Instalacao[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Contact
  const [contact, setContact] = useState({
    telefone:   card.empresa.telefone   ?? "",
    email:      card.empresa.email      ?? "",
    quemAtende: card.empresa.quemAtende ?? "",
    responsavel:card.empresa.responsavel?? "",
  });
  const [contactDirty, setContactDirty] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);

  // New note + agenda
  const [novaNota, setNovaNota]   = useState("");
  const [showAgenda, setShowAgenda] = useState(false);
  const [agendaDate, setAgendaDate] = useState("");
  const [savingNota, setSavingNota] = useState(false);

  // Bulk renewal (no note field)
  const [renovacaoMesNum, setRenovacaoMesNum]   = useState("");
  const [renovacaoAno, setRenovacaoAno]         = useState(String(ANO_ATUAL));
  const [renovacaoFornecedor, setRenovacaoFornecedor] = useState("");
  const [renovacaoDirty, setRenovacaoDirty]     = useState(false);
  const [savingRenovacao, setSavingRenovacao]   = useState(false);

  const isMaster = userRole === "MASTER";
  const canEdit  = isMaster || card.userId === userId;
  const hasAgenda = !!card.agendamentoData;

  // ── Edit nome ─────────────────────────────────────────────
  const [editingNome, setEditingNome] = useState(false);
  const [nomeValue, setNomeValue]     = useState(card.empresa.nome);
  const [savingNome, setSavingNome]   = useState(false);

  const saveNome = async () => {
    const trimmed = nomeValue.trim();
    if (!trimmed || trimmed === card.empresa.nome) { setEditingNome(false); return; }
    setSavingNome(true);
    await fetch(`/api/empresas/${card.empresaNif}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: trimmed }),
    });
    card.empresa.nome = trimmed;
    setSavingNome(false);
    setEditingNome(false);
  };

  useEffect(() => {
    setLoadingData(true);
    fetch(`/api/empresas/${card.empresaNif}`)
      .then((r) => r.json())
      .then((data) => {
        const fetchedNotas: Nota[] = Array.isArray(data.notas) ? data.notas : [];
        setNotas(fetchedNotas);
        setInstalacoes(Array.isArray(data.instalacoes) ? data.instalacoes : []);
        setLoadingData(false);

        // If agenda is set but there are no notes, clear the stale agenda
        if (card.agendamentoData && fetchedNotas.length === 0) {
          fetch(`/api/kanban/${card.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agendamentoData: null, agendamentoNota: null }),
          }).then(() => onAgendaChange(card.id, null));
        }
      })
      .catch(() => setLoadingData(false));
  }, [card.empresaNif]);

  // ── Contact save ──────────────────────────────────────────
  const saveContact = async () => {
    setContactSaving(true);
    const res = await fetch(`/api/empresas/${card.empresaNif}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contact),
    });
    if (res.ok) {
      onContactSaved?.(card.id, contact);
    }
    setContactSaving(false);
    setContactDirty(false);
  };

  // ── Note save ─────────────────────────────────────────────
  const saveNota = async () => {
    if (!novaNota.trim() || savingNota) return;
    setSavingNota(true);

    const res = await fetch(`/api/empresas/${card.empresaNif}/notas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: novaNota }),
    });

    if (res.ok) {
      const nova = await res.json();
      setNotas((prev) => [nova, ...prev]);
      setNovaNota("");
      onNoteAdded?.(card.id, nova.createdAt);

      if (agendaDate) {
        await fetch(`/api/kanban/${card.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agendamentoData: agendaDate, agendamentoNota: novaNota }),
        });
        onAgendaChange(card.id, agendaDate);
        setAgendaDate("");
        setShowAgenda(false);
      } else if (card.agendamentoData) {
        await fetch(`/api/kanban/${card.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agendamentoData: null, agendamentoNota: null }),
        });
        onAgendaChange(card.id, null);
      }
    }
    setSavingNota(false);
  };

  const handleNotaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    saveNota();
  };

  // ── Note delete ───────────────────────────────────────────
  const deleteNota = async (notaId: string) => {
    if (!confirm("Apagar esta nota?")) return;
    const res = await fetch(`/api/empresas/${card.empresaNif}/notas/${notaId}`, { method: "DELETE" });
    if (!res.ok) return;

    const isLastNota = notas[0]?.id === notaId;
    setNotas((prev) => prev.filter((n) => n.id !== notaId));

    // If deleting the most recent note and agenda was set, clear it
    if (isLastNota && card.agendamentoData) {
      await fetch(`/api/kanban/${card.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agendamentoData: null, agendamentoNota: null }),
      });
      onAgendaChange(card.id, null);
    }
  };

  // ── Bulk renewal save ─────────────────────────────────────
  const saveRenovacao = async () => {
    setSavingRenovacao(true);
    const mesTermino =
      renovacaoMesNum && renovacaoAno
        ? `${renovacaoAno}-${String(renovacaoMesNum).padStart(2, "0")}`
        : undefined;

    const res = await fetch(`/api/empresas/${card.empresaNif}/instalacoes/renovacao`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mesTermino, fornecedor: renovacaoFornecedor || undefined }),
    });

    if (res.ok) {
      const data = await res.json();
      setInstalacoes(data.instalacoes ?? instalacoes);
      setRenovacaoDirty(false);
    }
    setSavingRenovacao(false);
  };

  // ── Agenda tooltip label ──────────────────────────────────
  const agendaTooltip = card.agendamentoData
    ? `Alerta agendado: ${new Date(card.agendamentoData).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" })}`
    : "";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[760px] bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div className="flex-1 min-w-0 mr-4">
            {editingNome ? (
              <input
                autoFocus
                value={nomeValue}
                onChange={(e) => setNomeValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); saveNome(); }
                  if (e.key === "Escape") { setEditingNome(false); setNomeValue(card.empresa.nome); }
                }}
                onBlur={saveNome}
                disabled={savingNome}
                className="w-full font-semibold text-gray-900 text-base border-b border-blue-400 outline-none bg-transparent pb-0.5"
              />
            ) : (
              <div className="flex items-center gap-1.5 group">
                <h2 className="font-semibold text-gray-900 text-base leading-tight">{nomeValue}</h2>
                <button
                  onClick={() => setEditingNome(true)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
                  title="Editar nome"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              <span className="font-mono">{card.empresaNif}</span>
              {(card.empresa.localidade || card.empresa.distrito) && (
                <span className="ml-2 text-gray-500">
                  · {[card.empresa.localidade, card.empresa.distrito].filter(Boolean).join(", ")}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Contact + Notes ───────────────────────────── */}
          <div className="flex border-b border-gray-100" style={{ minHeight: "240px" }}>

            {/* LEFT: contact */}
            <div className="w-[40%] border-r border-gray-100 px-5 py-4 space-y-2.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contacto</p>
              <EditField label="Telefone"    value={contact.telefone}    onChange={(v) => { setContact((c) => ({ ...c, telefone: v }));    setContactDirty(true); }} />
              <EditField label="Email"       value={contact.email}       onChange={(v) => { setContact((c) => ({ ...c, email: v }));       setContactDirty(true); }} />
              <EditField label="Quem atende" value={contact.quemAtende}  onChange={(v) => { setContact((c) => ({ ...c, quemAtende: v }));  setContactDirty(true); }} />
              <EditField label="Responsável" value={contact.responsavel} onChange={(v) => { setContact((c) => ({ ...c, responsavel: v })); setContactDirty(true); }} />
              {contactDirty && (
                <button onClick={saveContact} disabled={contactSaving}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {contactSaving ? "A guardar..." : "Guardar alterações"}
                </button>
              )}
            </div>

            {/* RIGHT: notes */}
            <div className="w-[60%] px-4 py-4 flex flex-col gap-2 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-shrink-0">Notas</p>

              {/* Input */}
              <div className="flex-shrink-0 space-y-1.5">
                <div className="flex gap-1.5">
                  <textarea
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    onKeyDown={handleNotaKeyDown}
                    disabled={savingNota}
                    placeholder="Nova nota..."
                    rows={2}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={saveNota}
                      disabled={!novaNota.trim() || savingNota}
                      title="Guardar nota"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >↵</button>
                    <button
                      onClick={() => setShowAgenda((v) => !v)}
                      title="Agendar alerta"
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition ${
                        showAgenda || agendaDate ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-400 hover:text-gray-600"
                      }`}
                    >📅</button>
                  </div>
                </div>
                {showAgenda && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-amber-700 flex-shrink-0">Alerta em:</span>
                    <input
                      type="date"
                      value={agendaDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setAgendaDate(e.target.value)}
                      className="flex-1 text-xs border border-amber-300 rounded px-2 py-1 bg-white focus:outline-none"
                    />
                    {agendaDate && (
                      <button onClick={() => { setAgendaDate(""); setShowAgenda(false); }} className="text-amber-400 hover:text-amber-600 text-xs">✕</button>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-400">Enter para guardar · Shift+Enter nova linha</p>
              </div>

              {/* Notes list */}
              {loadingData ? (
                <p className="text-xs text-gray-400">A carregar...</p>
              ) : notas.length === 0 ? (
                <p className="text-xs text-gray-400">Sem notas ainda</p>
              ) : (
                <div className="space-y-2 overflow-y-auto">
                  {/* Last note */}
                  <div className={`border rounded-xl p-3 relative group ${
                    hasAgenda
                      ? "bg-amber-50 border-amber-300"
                      : "bg-blue-50 border-blue-200"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-bold ${hasAgenda ? "text-amber-800" : "text-blue-800"}`}>
                        🕐 {formatDate(notas[0].createdAt)}
                      </p>
                      {hasAgenda && (
                        <span title={agendaTooltip} className="cursor-help text-sm leading-none">
                          📅
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap mt-1">{notas[0].texto}</p>
                    <p className={`text-xs mt-1 ${hasAgenda ? "text-amber-500" : "text-blue-400"}`}>
                      {notas[0].user.nome}
                    </p>
                    <button
                      onClick={() => deleteNota(notas[0].id)}
                      className="absolute top-2 right-2 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-xs"
                      title="Apagar nota"
                    >✕</button>
                  </div>

                  {/* Other notes */}
                  {notas.slice(1).map((nota) => (
                    <div key={nota.id} className="border-l-2 border-gray-200 pl-3 relative group">
                      <p className="text-xs font-semibold text-gray-600">{formatDate(nota.createdAt)}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap mt-0.5">{nota.texto}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{nota.user.nome}</p>
                      <button
                        onClick={() => deleteNota(nota.id)}
                        className="absolute top-0 right-0 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-xs"
                        title="Apagar nota"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Installations ─────────────────────────────── */}
          <div className="px-6 py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Instalações ({instalacoes.length})
            </p>

            {/* Bulk renewal */}
            <div className="flex items-end gap-2 mb-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Mês Término</p>
                <div className="flex gap-1">
                  <select value={renovacaoMesNum} onChange={(e) => { setRenovacaoMesNum(e.target.value); setRenovacaoDirty(true); }}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Mês</option>
                    {MESES_FULL.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                  <select value={renovacaoAno} onChange={(e) => { setRenovacaoAno(e.target.value); setRenovacaoDirty(true); }}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Fornecedor</p>
                <input type="text" value={renovacaoFornecedor}
                  onChange={(e) => { setRenovacaoFornecedor(e.target.value); setRenovacaoDirty(true); }}
                  placeholder="Ex: EDP Comercial"
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button onClick={saveRenovacao} disabled={!renovacaoDirty || savingRenovacao}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 flex-shrink-0">
                {savingRenovacao ? "A guardar..." : "Aplicar a todas"}
              </button>
            </div>

            {/* Installation cards — scrollable */}
            {loadingData ? (
              <p className="text-sm text-gray-400">A carregar...</p>
            ) : instalacoes.length === 0 ? (
              <p className="text-sm text-gray-400">Sem instalações registadas</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
                {instalacoes.map((inst) => {
                  const tc = terminoInfo(inst.mesTermino);
                  const dataInicio = inst.dataInicioContrato
                    ? new Date(inst.dataInicioContrato).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })
                    : null;

                  return (
                    <div key={inst.id} className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
                      {/* Line 1: [TIPO] · Ciclo · Contrato de DD/MM/AAAA até Mmm/AAAA */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-700 flex-wrap">
                        <span className="font-bold bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-xs flex-shrink-0">
                          {inst.tipoInstalacao}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span>{CICLO_LABEL[inst.cicloTarifario] ?? inst.cicloTarifario}</span>
                        {dataInicio && (
                          <>
                            <span className="text-gray-400">·</span>
                            <span className="text-gray-700">
                              Contrato: de {dataInicio}
                              {tc && <> até <span className={tc.color}>{tc.label}</span></>}
                            </span>
                          </>
                        )}
                      </div>
                      {/* Line 2: CPE · consumo · fornecedor */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5 flex-wrap">
                        <span className="font-mono truncate max-w-[180px]">{inst.cpe}</span>
                        {inst.consumoAnual !== null && (
                          <>
                            <span>·</span>
                            <span className="text-gray-500">{formatKwh(inst.consumoAnual)}/ano</span>
                          </>
                        )}
                        {inst.fornecedor && (
                          <>
                            <span>·</span>
                            <span className="text-gray-500">{inst.fornecedor}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex-shrink-0 bg-white space-y-3">
          {canEdit && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Mover para coluna:</p>
              <div className="flex gap-2">
                {COLUNAS.map((col) => (
                  <button key={col.key}
                    onClick={() => col.key !== card.coluna && onMove(card.id, col.key)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition font-medium flex-1 ${
                      col.key === card.coluna
                        ? "bg-blue-600 text-white cursor-default"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {col.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <Link href={`/empresas/${card.empresaNif}`} className="text-sm text-blue-600 hover:underline">
              Ver empresa completa →
            </Link>
            {canEdit && (
              <button onClick={() => { onClose(); onRemove(card); }} className="text-sm text-red-500 hover:text-red-700">
                Remover do Kanban
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 hover:border-gray-300 bg-white" />
    </div>
  );
}
