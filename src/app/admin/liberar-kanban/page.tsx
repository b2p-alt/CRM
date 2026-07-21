"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Utilizador = { id: string; nome: string };
type Card = { id: string; nif: string; nome: string; createdAt: string };

const COLUNAS = [
  { val: "EM_REVISAO", label: "Em Revisão" },
  { val: "PRIMEIRO_CONTACTO", label: "1º Contacto" },
  { val: "ENVIAR_EMAIL", label: "Enviar Email" },
  { val: "EM_CONTACTO", label: "Em Contacto" },
  { val: "PROPOSTA", label: "Proposta" },
  { val: "CLIENTE", label: "Cliente" },
];

export default function LiberarKanbanPage() {
  const [utilizadores, setUtilizadores] = useState<Utilizador[]>([]);
  const [userId, setUserId] = useState("");
  const [coluna, setColuna] = useState("");

  const [cards, setCards] = useState<Card[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/utilizadores").then((r) => r.json()).then(setUtilizadores);
  }, []);

  async function handlePreview() {
    setErro("");
    setMsg("");
    setCards(null);
    if (!userId || !coluna) {
      setErro("Escolha o utilizador e a coluna.");
      return;
    }
    setLoadingPreview(true);
    const res = await fetch(`/api/admin/kanban-liberar?userId=${userId}&coluna=${coluna}`);
    const data = await res.json();
    setLoadingPreview(false);
    if (!res.ok) { setErro(data.error ?? "Erro ao pré-visualizar"); return; }
    setCards(data.cards);
  }

  async function handleLiberar() {
    if (!cards || cards.length === 0) return;
    const utilizadorNome = utilizadores.find((u) => u.id === userId)?.nome ?? "";
    const colunaLabel = COLUNAS.find((c) => c.val === coluna)?.label ?? "";
    if (!confirm(`Libertar ${cards.length} empresa(s) de "${colunaLabel}" de ${utilizadorNome}? Esta ação não pode ser desfeita.`)) return;

    setLiberando(true);
    const res = await fetch("/api/admin/kanban-liberar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, coluna }),
    });
    const data = await res.json();
    setLiberando(false);
    if (!res.ok) { setErro(data.error ?? "Erro ao libertar"); return; }
    setMsg(`${data.removidos} empresa(s) libertada(s) de volta para a pool.`);
    setCards([]);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "65px", width: "auto" }} />
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
        <h1 className="text-lg font-semibold text-gray-900">Libertar empresas do Kanban em massa</h1>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="text-sm text-gray-500">
            Escolhe um utilizador e uma coluna do Kanban. As empresas encontradas são removidas apenas desse utilizador e dessa coluna — voltam para a pool partilhada (deixam de estar bloqueadas), sem tocar nas restantes colunas.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Utilizador *</label>
              <select value={userId} onChange={(e) => { setUserId(e.target.value); setCards(null); setMsg(""); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione...</option>
                {utilizadores.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Coluna do Kanban *</label>
              <select value={coluna} onChange={(e) => { setColuna(e.target.value); setCards(null); setMsg(""); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Selecione...</option>
                {COLUNAS.map((c) => <option key={c.val} value={c.val}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <button onClick={handlePreview} disabled={loadingPreview || !userId || !coluna}
            className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {loadingPreview ? "A carregar..." : "Pré-visualizar"}
          </button>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {msg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}
        </div>

        {cards && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">{cards.length} empresa(s) encontrada(s)</h3>
              {cards.length > 0 && (
                <button onClick={handleLiberar} disabled={liberando}
                  className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
                  {liberando ? "A libertar..." : `Libertar ${cards.length} empresa(s)`}
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {cards.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-3">Nenhum cartão encontrado para esta combinação.</p>
              ) : cards.map((c) => (
                <div key={c.id} className="px-4 py-2 text-sm">
                  <span className="font-medium text-gray-900">{c.nome}</span>{" "}
                  <span className="text-gray-400 font-mono text-xs">{c.nif}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
