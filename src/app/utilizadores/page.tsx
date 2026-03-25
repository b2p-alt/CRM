"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type User = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  role: "MASTER" | "AGENTE";
  mustChangePassword: boolean;
  createdAt: string;
};

type FormData = {
  nome: string;
  email: string;
  telefone: string;
  password: string;
  role: "MASTER" | "AGENTE";
};

const EMPTY_FORM: FormData = { nome: "", email: "", telefone: "", password: "", role: "AGENTE" };

export default function UtilizadoresPage() {
  const [users, setUsers]         = useState<User[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editUser, setEditUser]   = useState<User | null>(null);
  const [form, setForm]           = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/utilizadores");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }

  function openCreate() {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(u: User) {
    setEditUser(u);
    setForm({ nome: u.nome, email: u.email, telefone: u.telefone ?? "", password: "", role: u.role });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const url = editUser ? `/api/utilizadores/${editUser.id}` : "/api/utilizadores";
    const method = editUser ? "PUT" : "POST";

    const body: Partial<FormData> = { ...form };
    if (editUser && !form.password) delete body.password; // don't update password if blank

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
      loadUsers();
    }
    setSaving(false);
  }

  async function handleDelete(u: User) {
    if (!confirm(`Apagar utilizador "${u.nome}"? Esta ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/utilizadores/${u.id}`, { method: "DELETE" });
    if (res.ok) loadUsers();
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
          <h1 className="text-lg font-semibold text-gray-900">Utilizadores</h1>
        </div>
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + Novo Utilizador
        </button>
      </header>

      <main className="p-6 max-w-4xl mx-auto">

        {/* User list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="text-sm text-gray-400 p-6">A carregar...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-gray-400 p-6">Sem utilizadores registados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Telefone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nível</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-gray-500">{u.telefone ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                          u.role === "MASTER"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {u.role === "MASTER" ? "Master" : "Agente"}
                        </span>
                        {u.mustChangePassword && (
                          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            Pendente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(u)}
                        className="text-xs text-blue-600 hover:underline mr-3">Editar</button>
                      <button onClick={() => handleDelete(u)}
                        className="text-xs text-red-500 hover:underline">Apagar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Modal */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-5">
                {editUser ? "Editar utilizador" : "Novo utilizador"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Nome *" value={form.nome}
                  onChange={(v) => setForm((f) => ({ ...f, nome: v }))} />
                <Field label="Email *" type="email" value={form.email}
                  onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
                <Field label="Telefone" value={form.telefone}
                  onChange={(v) => setForm((f) => ({ ...f, telefone: v }))} />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nível de acesso</label>
                  <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "MASTER" | "AGENTE" }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="AGENTE">Agente</option>
                    <option value="MASTER">Master</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Master tem acesso total, incluindo gestão de utilizadores.</p>
                </div>

                <Field
                  label={editUser ? "Nova password (deixe em branco para não alterar)" : "Password (opcional)"}
                  type="password"
                  value={form.password}
                  onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                />
                {!editUser && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Se deixar em branco, o utilizador será notificado para criar a password no primeiro acesso.
                  </p>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
                    {saving ? "A guardar..." : editUser ? "Guardar alterações" : "Criar utilizador"}
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
