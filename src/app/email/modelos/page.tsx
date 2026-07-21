"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import RichTextEditor from "@/components/RichTextEditor";

type Modelo = {
  id: string;
  nome: string;
  assunto: string;
  corpoHtml: string;
  updatedAt: string;
};

type FormData = { nome: string; assunto: string; corpoHtml: string };
const EMPTY_FORM: FormData = { nome: "", assunto: "", corpoHtml: "" };

export default function ModelosEmailPage() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editModelo, setEditModelo] = useState<Modelo | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadModelos(); }, []);

  async function loadModelos() {
    setLoading(true);
    const res = await fetch("/api/email/modelos");
    if (res.ok) setModelos(await res.json());
    setLoading(false);
  }

  function openCreate() {
    setEditModelo(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(m: Modelo) {
    setEditModelo(m);
    setForm({ nome: m.nome, assunto: m.assunto, corpoHtml: m.corpoHtml });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const url = editModelo ? `/api/email/modelos/${editModelo.id}` : "/api/email/modelos";
    const method = editModelo ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Erro ao guardar");
    } else {
      setShowForm(false);
      loadModelos();
    }
    setSaving(false);
  }

  async function handleDelete(m: Modelo) {
    if (!confirm(`Apagar o modelo "${m.nome}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/email/modelos/${m.id}`, { method: "DELETE" });
    if (res.ok) loadModelos();
    else {
      const data = await res.json();
      alert(data.error ?? "Erro ao apagar");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "65px", width: "auto" }} />
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900">Modelos de Email</h1>
        </div>
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + Novo Modelo
        </button>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="text-sm text-gray-400 p-6">A carregar...</p>
          ) : modelos.length === 0 ? (
            <p className="text-sm text-gray-400 p-6">Sem modelos criados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assunto</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {modelos.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{m.assunto}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(m)}
                        className="text-xs text-blue-600 hover:underline mr-3">Editar</button>
                      <button onClick={() => handleDelete(m)}
                        className="text-xs text-red-500 hover:underline">Apagar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {showForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 my-8">
              <h2 className="text-base font-semibold text-gray-900 mb-5">
                {editModelo ? "Editar modelo" : "Novo modelo de email"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome (interno) *</label>
                  <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assunto *</label>
                  <input value={form.assunto} onChange={(e) => setForm((f) => ({ ...f, assunto: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Corpo do email *</label>
                  <RichTextEditor value={form.corpoHtml}
                    onChange={(v) => setForm((f) => ({ ...f, corpoHtml: v }))} />
                  <p className="text-xs text-gray-400 mt-1">A assinatura é adicionada automaticamente com base na conta de envio escolhida na campanha.</p>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
                    {saving ? "A guardar..." : editModelo ? "Guardar alterações" : "Criar modelo"}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
