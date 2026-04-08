"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TIPOS = ["MAT", "AT", "MT", "BTE", "BTN"] as const;
const CICLOS = ["SIMPLES", "BI_HORARIO", "TRI_HORARIO", "DIARIO", "SEMANAL", "SEMANAL_OPCIONAL"] as const;
const CICLOS_LABEL: Record<string, string> = {
  SIMPLES: "Simples", BI_HORARIO: "Bi-horário", TRI_HORARIO: "Tri-horário",
  DIARIO: "Diário", SEMANAL: "Semanal", SEMANAL_OPCIONAL: "Semanal Opcional",
};

type Instalacao = {
  id: string; cpe: string; morada?: string | null; tipoInstalacao: string;
  cicloTarifario: string | null; dataInicioContrato?: string | Date | null;
  mesTermino?: string | null; fornecedor?: string | null;
  consumoPonta?: number | null; consumoCheia?: number | null;
  consumoVazio?: number | null; consumoSVazio?: number | null; consumoAnual?: number | null;
};

const emptyForm = {
  cpe: "", morada: "", tipoInstalacao: "MT", cicloTarifario: "SIMPLES",
  dataInicioContrato: "", mesTermino: "", fornecedor: "",
  consumoPonta: "", consumoCheia: "", consumoVazio: "", consumoSVazio: "", consumoAnual: "",
};

export default function InstalacoesSection({ empresaNif, instalacoes: initial }: {
  empresaNif: string;
  instalacoes: Instalacao[];
}) {
  const router = useRouter();
  const [instalacoes, setInstalacoes] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function startEdit(inst: Instalacao) {
    setEditId(inst.id);
    setForm({
      cpe: inst.cpe, morada: inst.morada || "", tipoInstalacao: inst.tipoInstalacao,
      cicloTarifario: inst.cicloTarifario ?? "",
      dataInicioContrato: inst.dataInicioContrato ? new Date(inst.dataInicioContrato).toISOString().split("T")[0] : "",
      mesTermino: inst.mesTermino || "", fornecedor: inst.fornecedor || "",
      consumoPonta: String(inst.consumoPonta ?? ""), consumoCheia: String(inst.consumoCheia ?? ""),
      consumoVazio: String(inst.consumoVazio ?? ""), consumoSVazio: String(inst.consumoSVazio ?? ""),
      consumoAnual: String(inst.consumoAnual ?? ""),
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false); setEditId(null); setForm({ ...emptyForm });
  }

  function parseNum(v: string) { const n = parseFloat(v); return isNaN(n) ? undefined : n; }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const body = {
      ...form,
      dataInicioContrato: form.dataInicioContrato || undefined,
      consumoPonta: parseNum(form.consumoPonta), consumoCheia: parseNum(form.consumoCheia),
      consumoVazio: parseNum(form.consumoVazio), consumoSVazio: parseNum(form.consumoSVazio),
      consumoAnual: parseNum(form.consumoAnual),
    };

    const url = editId ? `/api/instalacoes/${editId}` : `/api/empresas/${empresaNif}/instalacoes`;
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);

    if (res.ok) {
      const saved = await res.json();
      if (editId) {
        setInstalacoes(instalacoes.map((i) => i.id === editId ? saved : i));
      } else {
        setInstalacoes([saved, ...instalacoes]);
      }
      cancelForm();
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar esta instalação?")) return;
    await fetch(`/api/instalacoes/${id}`, { method: "DELETE" });
    setInstalacoes(instalacoes.filter((i) => i.id !== id));
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ ...emptyForm }); }}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          + Adicionar instalação
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">{editId ? "Editar instalação" : "Nova instalação"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 mb-1 block">CPE *</label>
              <input value={form.cpe} onChange={(e) => set("cpe", e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Morada</label>
              <input value={form.morada} onChange={(e) => set("morada", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Tipo *</label>
              <select value={form.tipoInstalacao} onChange={(e) => set("tipoInstalacao", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Ciclo tarifário *</label>
              <select value={form.cicloTarifario} onChange={(e) => set("cicloTarifario", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {CICLOS.map((c) => <option key={c} value={c}>{CICLOS_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Fornecedor</label>
              <input value={form.fornecedor} onChange={(e) => set("fornecedor", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Início contrato</label>
              <input type="date" value={form.dataInicioContrato} onChange={(e) => set("dataInicioContrato", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Mês término (ex: 2025-12)</label>
              <input value={form.mesTermino} onChange={(e) => set("mesTermino", e.target.value)} placeholder="2025-12"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {[["Ponta", "consumoPonta"], ["Cheia", "consumoCheia"], ["Vazio", "consumoVazio"], ["Super Vazio", "consumoSVazio"], ["Anual", "consumoAnual"]].map(([label, key]) => (
              <div key={key}>
                <label className="text-xs text-gray-600 mb-1 block">{label} (kWh)</label>
                <input type="number" step="0.01" value={form[key as keyof typeof form]} onChange={(e) => set(key, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {loading ? "A guardar..." : "Guardar"}
            </button>
            <button type="button" onClick={cancelForm}
              className="text-gray-600 text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {instalacoes.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">Sem instalações registadas</p>
      )}

      <div className="space-y-2">
        {instalacoes.map((inst) => (
          <div key={inst.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-gray-700">{inst.cpe}</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{inst.tipoInstalacao}</span>
                {inst.cicloTarifario && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{CICLOS_LABEL[inst.cicloTarifario]}</span>}
              </div>
              {inst.morada && <p className="text-xs text-gray-500">{inst.morada}</p>}
              {inst.fornecedor && <p className="text-xs text-gray-500">Fornecedor: {inst.fornecedor}</p>}
              {inst.consumoAnual && <p className="text-xs text-gray-500">Consumo anual: {inst.consumoAnual.toLocaleString("pt-PT")} kWh</p>}
            </div>
            <div className="flex gap-2 ml-4 shrink-0">
              <button onClick={() => startEdit(inst)} className="text-xs text-blue-600 hover:underline">Editar</button>
              <button onClick={() => handleDelete(inst.id)} className="text-xs text-red-500 hover:underline">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
