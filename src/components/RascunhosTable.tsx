"use client";

import { useState, useMemo } from "react";

type Instalacao = {
  id: string; cpe: string; tipoInstalacao: string; consumoAnual: number | null;
};
type Nota = {
  id: string; texto: string; createdAt: string; user: { nome: string };
};
type Empresa = {
  nif: string; nome: string; telefone: string | null; email: string | null;
  responsavel: string | null; quemAtende: string | null;
  distrito: string | null; localidade: string | null;
  rascunho: boolean; importProblemas: string | null;
  instalacoes: Instalacao[]; notas: Nota[];
};

type Props = { empresas: Empresa[]; distritos: string[] };

function parseProblem(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw).problemas ?? []; } catch { return [raw]; }
}

export default function RascunhosTable({ empresas: initial, distritos }: Props) {
  const [empresas, setEmpresas] = useState(initial);
  const [filter, setFilter] = useState<"all" | "clean" | "problems">("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Empresa>>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = empresas;
    if (filter === "clean")    list = list.filter(e => !e.importProblemas);
    if (filter === "problems") list = list.filter(e => !!e.importProblemas);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.nome.toLowerCase().includes(q) || e.nif.toLowerCase().includes(q) ||
        (e.distrito ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [empresas, filter, search]);

  const cleanCount    = empresas.filter(e => !e.importProblemas).length;
  const problemCount  = empresas.filter(e => !!e.importProblemas).length;

  function startEdit(e: Empresa) {
    setEditing(e.nif);
    setEditData({ nome: e.nome, nif: e.nif, telefone: e.telefone, email: e.email,
      responsavel: e.responsavel, quemAtende: e.quemAtende, distrito: e.distrito, localidade: e.localidade });
  }

  async function saveEdit(oldNif: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rascunhos/${encodeURIComponent(oldNif)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editData),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Erro ao guardar"); return; }
      const updated: Empresa = await res.json();
      setEmpresas(prev => prev.map(e => e.nif === oldNif ? { ...e, ...updated } : e));
      setEditing(null);
    } finally { setSaving(false); }
  }

  async function confirmar(nif: string) {
    setConfirming(nif);
    try {
      const res = await fetch(`/api/admin/rascunhos/${encodeURIComponent(nif)}/confirmar`, { method: "POST" });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Erro ao confirmar"); return; }
      setEmpresas(prev => prev.filter(e => e.nif !== nif));
    } finally { setConfirming(null); }
  }

  async function eliminar(nif: string) {
    if (!confirm(`Eliminar rascunho "${nif}"?`)) return;
    const res = await fetch(`/api/admin/rascunhos/${encodeURIComponent(nif)}`, { method: "DELETE" });
    if (!res.ok) { alert("Erro ao eliminar"); return; }
    setEmpresas(prev => prev.filter(e => e.nif !== nif));
  }

  async function confirmarTodos() {
    if (!confirm(`Confirmar todas as ${cleanCount} empresas sem problemas (e com NIF válido)?`)) return;
    const res = await fetch("/api/admin/rascunhos/confirmar-todos", { method: "POST" });
    if (!res.ok) { alert("Erro"); return; }
    const { confirmadas } = await res.json();
    setEmpresas(prev => prev.filter(e => e.importProblemas || e.nif.startsWith("RASCUNHO_")));
    alert(`${confirmadas} empresas confirmadas.`);
  }

  if (empresas.length === 0) {
    return <p className="text-gray-500 text-sm">Sem rascunhos. Todos os dados foram confirmados.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text" placeholder="Pesquisar nome / NIF / distrito..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm w-64"
        />
        <div className="flex rounded border border-gray-300 overflow-hidden text-sm">
          {(["all", "clean", "problems"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 ${filter === f ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              {f === "all" ? `Todos (${empresas.length})` : f === "clean" ? `Limpos (${cleanCount})` : `Problemas (${problemCount})`}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={confirmarTodos}
            className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-1.5 rounded">
            Confirmar todos os limpos ({cleanCount})
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        A mostrar {filtered.length} de {empresas.length} · Confirmar move a empresa para a base principal
      </p>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">NIF</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Distrito</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Tipo</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Problemas</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-48">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(e => {
              const isEditing = editing === e.nif;
              const problems = parseProblem(e.importProblemas);
              const isPlaceholder = e.nif.startsWith("RASCUNHO_");
              const canConfirm = !isPlaceholder && problems.length === 0;

              return (
                <>
                  <tr key={e.nif} className={`${isEditing ? "bg-blue-50" : "hover:bg-gray-50"} transition-colors`}>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {isPlaceholder
                        ? <span className="text-orange-500 font-semibold">{e.nif}</span>
                        : e.nif}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{e.nome}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{e.distrito ?? "—"}{e.localidade ? ` · ${e.localidade}` : ""}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {e.instalacoes.map(i => (
                        <span key={i.id} className="inline-block bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs mr-1">
                          {i.tipoInstalacao}
                        </span>
                      ))}
                      {e.instalacoes.length === 0 && <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {problems.length > 0
                        ? <ul className="text-xs text-orange-600 space-y-0.5">{problems.map((p, i) => <li key={i}>⚠ {p}</li>)}</ul>
                        : <span className="text-xs text-green-600">✓ Limpo</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex gap-2 justify-end">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(e.nif)} disabled={saving}
                              className="text-xs bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-50">
                              {saving ? "..." : "Guardar"}
                            </button>
                            <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(e)} className="text-xs text-blue-600 hover:underline">Editar</button>
                            {canConfirm && (
                              <button onClick={() => confirmar(e.nif)} disabled={confirming === e.nif}
                                className="text-xs text-green-600 hover:underline disabled:opacity-50">
                                {confirming === e.nif ? "..." : "Confirmar"}
                              </button>
                            )}
                            <button onClick={() => eliminar(e.nif)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit form */}
                  {isEditing && (
                    <tr key={`${e.nif}-edit`} className="bg-blue-50 border-b border-blue-100">
                      <td colSpan={6} className="px-4 pb-4">
                        <div className="grid grid-cols-2 gap-3 pt-2 max-w-2xl">
                          <Field label="NIF" value={editData.nif ?? ""} onChange={v => setEditData(d => ({ ...d, nif: v }))} />
                          <Field label="Nome" value={editData.nome ?? ""} onChange={v => setEditData(d => ({ ...d, nome: v }))} />
                          <Field label="Telefone" value={editData.telefone ?? ""} onChange={v => setEditData(d => ({ ...d, telefone: v }))} />
                          <Field label="Email" value={editData.email ?? ""} onChange={v => setEditData(d => ({ ...d, email: v }))} />
                          <Field label="Responsável" value={editData.responsavel ?? ""} onChange={v => setEditData(d => ({ ...d, responsavel: v }))} />
                          <Field label="Quem atende" value={editData.quemAtende ?? ""} onChange={v => setEditData(d => ({ ...d, quemAtende: v }))} />
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Distrito</label>
                            <select value={editData.distrito ?? ""} onChange={e2 => setEditData(d => ({ ...d, distrito: e2.target.value }))}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-full">
                              <option value="">—</option>
                              {distritos.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <Field label="Localidade" value={editData.localidade ?? ""} onChange={v => setEditData(d => ({ ...d, localidade: v }))} />
                        </div>
                        {/* Notas preview */}
                        {e.notas.length > 0 && (
                          <div className="mt-3 max-w-2xl">
                            <p className="text-xs font-semibold text-gray-500 mb-1">Notas importadas:</p>
                            {e.notas.map(n => (
                              <div key={n.id} className="text-xs text-gray-600 bg-white border border-gray-200 rounded p-2 mb-1 whitespace-pre-wrap">
                                {n.texto}
                              </div>
                            ))}
                          </div>
                        )}
                        {/* After fixing NIF, show confirm button */}
                        {editData.nif && !editData.nif.startsWith("RASCUNHO_") && problems.length === 0 && (
                          <p className="text-xs text-green-600 mt-2">
                            Após guardar, poderá confirmar esta empresa.
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-sm w-full" />
    </div>
  );
}
