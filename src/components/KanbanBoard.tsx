"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EmpresaPickerModal from "./EmpresaPickerModal";
import KanbanCardDrawer, { type DrawerCard } from "./KanbanCardDrawer";

type Coluna = "EM_REVISAO" | "PRIMEIRO_CONTACTO" | "ENVIAR_EMAIL" | "EM_CONTACTO" | "PROPOSTA" | "CLIENTE";

const COLUNAS: { key: Coluna; label: string; headerColor: string }[] = [
  { key: "EM_REVISAO",        label: "Em Revisão",  headerColor: "border-gray-400" },
  { key: "PRIMEIRO_CONTACTO", label: "1º Contacto",  headerColor: "border-blue-400" },
  { key: "ENVIAR_EMAIL",      label: "Enviar Email", headerColor: "border-purple-400" },
  { key: "EM_CONTACTO",       label: "Em Contacto",  headerColor: "border-yellow-400" },
  { key: "PROPOSTA",          label: "Proposta",     headerColor: "border-orange-400" },
  { key: "CLIENTE",           label: "Cliente",      headerColor: "border-green-400" },
];

type Card = DrawerCard & {
  empresa: DrawerCard["empresa"] & { lastContactAt: string | null };
};

// ── Sorting ──────────────────────────────────────────────────
// Order: 1) active alerts (agenda <= today), 2) never contacted, 3) oldest contact first
function sortCards(cards: Card[]): Card[] {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return [...cards].sort((a, b) => {
    const aAlert = !!a.agendamentoData && new Date(a.agendamentoData) <= new Date();
    const bAlert = !!b.agendamentoData && new Date(b.agendamentoData) <= new Date();

    // Active alerts have priority
    if (aAlert && !bAlert) return -1;
    if (!aAlert && bAlert) return 1;
    if (aAlert && bAlert) {
      return new Date(a.agendamentoData!).getTime() - new Date(b.agendamentoData!).getTime();
    }

    // No contact yet → comes before cards with contact
    const aDate = a.empresa.lastContactAt;
    const bDate = b.empresa.lastContactAt;
    if (!aDate && !bDate) return 0;
    if (!aDate) return -1;
    if (!bDate) return 1;

    // Both contacted → oldest first (ascending)
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });
}

function formatContactDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formatAgendaTooltip(iso: string) {
  return `Agendado: ${new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "long", year: "numeric",
  })}`;
}

function isAlertaAtivo(card: Card): boolean {
  if (!card.agendamentoData) return false;
  return new Date(card.agendamentoData) <= new Date();
}

// ─── Component ───────────────────────────────────────────────
export default function KanbanBoard({
  cards: initialCards, userRole, userId,
}: {
  cards: Card[]; userRole: string; userId: string;
}) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [showPicker, setShowPicker] = useState(false);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Coluna | null>(null);

  const isMaster = userRole === "MASTER";

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  const updateCard = (cardId: string, patch: Partial<Card>) =>
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c)));

  // ── Move ─────────────────────────────────────────────────
  const moveCard = async (cardId: string, newColuna: Coluna) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.coluna === newColuna) return;
    updateCard(cardId, { coluna: newColuna });
    if (openCard?.id === cardId) setOpenCard((c) => c ? { ...c, coluna: newColuna } : c);
    const res = await fetch(`/api/kanban/${cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coluna: newColuna }),
    });
    if (!res.ok) updateCard(cardId, { coluna: card.coluna });
  };

  // ── Remove ───────────────────────────────────────────────
  const removeCard = async (card: Card) => {
    if (!confirm(`Remover "${card.empresa.nome}" do Kanban?`)) return;
    const res = await fetch(`/api/kanban/${card.id}`, { method: "DELETE" });
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      if (openCard?.id === card.id) setOpenCard(null);
    }
  };

  // ── Agenda change ────────────────────────────────────────
  const handleAgendaChange = (cardId: string, agendamentoData: string | null) => {
    updateCard(cardId, { agendamentoData });
    if (openCard?.id === cardId) setOpenCard((c) => c ? { ...c, agendamentoData } : c);
  };

  // ── After contact saved: patch empresa fields in state ───
  const handleContactSaved = (
    cardId: string,
    patch: { telefone: string; email: string; quemAtende: string; responsavel: string }
  ) => {
    updateCard(cardId, {
      empresa: {
        ...cards.find((c) => c.id === cardId)!.empresa,
        telefone:    patch.telefone    || null,
        email:       patch.email       || null,
        quemAtende:  patch.quemAtende  || null,
        responsavel: patch.responsavel || null,
      },
    });
    if (openCard?.id === cardId) {
      setOpenCard((c) => c ? {
        ...c,
        empresa: {
          ...c.empresa,
          telefone:    patch.telefone    || null,
          email:       patch.email       || null,
          quemAtende:  patch.quemAtende  || null,
          responsavel: patch.responsavel || null,
        },
      } : c);
    }
  };

  // ── After note added: refresh lastContactAt ──────────────
  const handleNoteAdded = (cardId: string, createdAt: string) => {
    updateCard(cardId, {
      empresa: {
        ...cards.find((c) => c.id === cardId)!.empresa,
        lastContactAt: createdAt,
      },
    });
    if (openCard?.id === cardId) {
      setOpenCard((c) => c ? { ...c, empresa: { ...c.empresa, lastContactAt: createdAt } } : c);
    }
  };

  // ── Add cards ────────────────────────────────────────────
  const handleConfirm = async (nifs: string[]) => {
    setShowPicker(false);
    await Promise.all(
      nifs.map((nif) =>
        fetch("/api/kanban", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empresaNif: nif, coluna: "EM_REVISAO" }),
        })
      )
    );
    router.refresh();
  };

  // ── Drag & Drop ──────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData("cardId", cardId);
    e.dataTransfer.effectAllowed = "move";
    setDragging(cardId);
  };

  const handleDrop = (e: React.DragEvent, newColuna: Coluna) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("cardId");
    setDragOver(null);
    if (!cardId) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    if (isMaster || card.userId === userId) moveCard(cardId, newColuna);
  };

  return (
    <>
      {/* Toolbar */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {cards.length} empresa{cards.length !== 1 ? "s" : ""} em pipeline
        </p>
        <button
          onClick={() => setShowPicker(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Adicionar Empresas
        </button>
      </div>

      {/* Board */}
      <div className="flex gap-4 min-w-max pb-4 items-start">
        {COLUNAS.map((col) => {
          const colCards = sortCards(cards.filter((c) => c.coluna === col.key));
          const isDropTarget = dragOver === col.key;

          return (
            <div
              key={col.key}
              className="w-64 flex-shrink-0"
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className={`bg-white border border-gray-200 border-t-4 ${col.headerColor} rounded-xl px-3 py-2.5 mb-2 flex items-center gap-2`}>
                <span className="font-semibold text-gray-800 text-sm">{col.label}</span>
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                  {colCards.length}
                </span>
              </div>

              {/* Cards */}
              <div className={`min-h-[60px] rounded-xl space-y-1.5 transition-colors ${isDropTarget ? "bg-blue-50 ring-2 ring-blue-300 ring-dashed p-1" : ""}`}>
                {colCards.map((card) => {
                  const canEdit = isMaster || card.userId === userId;
                  const alerta = isAlertaAtivo(card);

                  return (
                    <div
                      key={card.id}
                      draggable={canEdit}
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onDragEnd={() => { setDragging(null); setDragOver(null); }}
                      onClick={() => setOpenCard(card)}
                      className={`border rounded-lg px-3 py-2 transition select-none ${
                        dragging === card.id ? "opacity-40 scale-95 shadow-lg" : ""
                      } ${
                        alerta
                          ? "bg-amber-50 border-amber-300 hover:border-amber-400 shadow-sm"
                          : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
                      } ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                    >
                      {/* Line 1: name + agenda icon */}
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                          {alerta && <span className="mr-1">🔔</span>}
                          {card.empresa.nome}
                        </p>
                        {card.agendamentoData && !alerta && (
                          <span
                            title={formatAgendaTooltip(card.agendamentoData)}
                            className="text-xs cursor-help flex-shrink-0"
                          >
                            📅
                          </span>
                        )}
                      </div>

                      {/* Line 2: installations + last contact */}
                      <p className="text-xs text-gray-400 truncate mt-0.5 leading-tight">
                        {card.empresa._count.instalacoes} inst.
                        {card.empresa.lastContactAt
                          ? ` · Contactado: ${formatContactDate(card.empresa.lastContactAt)}`
                          : " · Sem contacto"}
                      </p>
                    </div>
                  );
                })}

                {colCards.length === 0 && !isDropTarget && (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center text-xs text-gray-300">
                    Sem empresas
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showPicker && (
        <EmpresaPickerModal onConfirm={handleConfirm} onClose={() => setShowPicker(false)} />
      )}

      {openCard && (
        <KanbanCardDrawer
          card={openCard}
          userRole={userRole}
          userId={userId}
          onClose={() => setOpenCard(null)}
          onMove={moveCard}
          onRemove={removeCard}
          onAgendaChange={handleAgendaChange}
          onNoteAdded={handleNoteAdded}
          onContactSaved={handleContactSaved}
        />
      )}
    </>
  );
}
