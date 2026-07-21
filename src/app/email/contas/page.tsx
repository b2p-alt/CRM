"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import RichTextEditor from "@/components/RichTextEditor";

type Conta = {
  id: string;
  nome: string;
  host: string;
  porta: number;
  usuario: string;
  assinaturaHtml: string | null;
  limiteDiario: number;
  ativo: boolean;
  createdAt: string;
};

type FormData = {
  nome: string;
  host: string;
  porta: string;
  usuario: string;
  password: string;
  assinaturaHtml: string;
  limiteDiario: string;
  ativo: boolean;
};

const EMPTY_FORM: FormData = {
  nome: "", host: "", porta: "587", usuario: "", password: "",
  assinaturaHtml: "", limiteDiario: "950", ativo: true,
};

export default function ContasEmailPage() {
  const [contas, setContas]     = useState<Conta[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editConta, setEditConta] = useState<Conta | null>(null);
  const [form, setForm]         = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => { loadContas(); }, []);

  async function loadContas() {
    setLoading(true);
    const res = await fetch("/api/email/contas");
    if (res.ok) setContas(await res.json());
    setLoading(false);
  }

  function openCreate() {
    setEditConta(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(c: Conta) {
    setEditConta(c);
    setForm({
      nome: c.nome, host: c.host, porta: String(c.porta), usuario: c.usuario,
      password: "", assinaturaHtml: c.assinaturaHtml ?? "",
      limiteDiario: String(c.limiteDiario), ativo: c.ativo,
    });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const url = editConta ? `/api/email/contas/${editConta.id}` : "/api/email/contas";
    const method = editConta ? "PUT" : "POST";

    const body: Partial<FormData> = { ...form };
    if (editConta && !form.password) delete body.password;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Erro ao guardar");
    } else {
      setShowForm(false);
      loadContas();
    }
    setSaving(false);
  }

  async function handleDelete(c: Conta) {
    if (!confirm(`Apagar a conta "${c.nome}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/email/contas/${c.id}`, { method: "DELETE" });
    if (res.ok) loadContas();
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
          <h1 className="text-lg font-semibold text-gray-900">Contas de Email (SMTP)</h1>
        </div>
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + Nova Conta
        </button>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="text-sm text-gray-400 p-6">A carregar...</p>
          ) : contas.length === 0 ? (
            <p className="text-sm text-gray-400 p-6">Sem contas configuradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Host</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilizador</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Limite/24h</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contas.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{c.host}:{c.porta}</td>
                    <td className="px-4 py-3 text-gray-500">{c.usuario}</td>
                    <td className="px-4 py-3 text-gray-500">{c.limiteDiario}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                        c.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {c.ativo ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(c)}
                        className="text-xs text-blue-600 hover:underline mr-3">Editar</button>
                      <button onClick={() => handleDelete(c)}
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-8">
              <h2 className="text-base font-semibold text-gray-900 mb-5">
                {editConta ? "Editar conta" : "Nova conta de email"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Nome *" value={form.nome}
                  onChange={(v) => setForm((f) => ({ ...f, nome: v }))} />

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Field label="Host SMTP *" value={form.host}
                      onChange={(v) => setForm((f) => ({ ...f, host: v }))} />
                  </div>
                  <Field label="Porta *" type="number" value={form.porta}
                    onChange={(v) => setForm((f) => ({ ...f, porta: v }))} />
                </div>

                <Field label="Utilizador (email) *" value={form.usuario}
                  onChange={(v) => setForm((f) => ({ ...f, usuario: v }))} />

                <Field
                  label={editConta ? "Nova password (deixe em branco para não alterar)" : "Password *"}
                  type="password"
                  value={form.password}
                  onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                />

                <Field label="Limite de envios em 24h" type="number" value={form.limiteDiario}
                  onChange={(v) => setForm((f) => ({ ...f, limiteDiario: v }))} />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assinatura de email</label>
                  <RichTextEditor value={form.assinaturaHtml}
                    onChange={(v) => setForm((f) => ({ ...f, assinaturaHtml: v }))} />
                  <p className="text-xs text-gray-400 mt-1">Aplicada automaticamente a todos os emails enviados a partir desta conta.</p>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.ativo}
                    onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
                  Conta ativa
                </label>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
                    {saving ? "A guardar..." : editConta ? "Guardar alterações" : "Criar conta"}
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

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}
