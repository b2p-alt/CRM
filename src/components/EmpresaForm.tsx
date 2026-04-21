"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  distritos: string[];
  distritosLocalidades: Record<string, string[]>;
  isMaster?: boolean;
  empresa?: {
    nif: string; nome: string; telefone?: string | null; email?: string | null;
    website?: string | null; morada?: string | null; distrito?: string | null;
    localidade?: string | null; quemAtende?: string | null; responsavel?: string | null;
  };
};

export default function EmpresaForm({ distritos, distritosLocalidades, empresa, isMaster }: Props) {
  const router = useRouter();
  const isEdit = !!empresa;

  const [form, setForm] = useState({
    nif: empresa?.nif || "",
    nome: empresa?.nome || "",
    telefone: empresa?.telefone || "",
    email: empresa?.email || "",
    website: empresa?.website || "",
    morada: empresa?.morada || "",
    distrito: empresa?.distrito || "",
    localidade: empresa?.localidade || "",
    quemAtende: empresa?.quemAtende || "",
    responsavel: empresa?.responsavel || "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const localidades = form.distrito ? distritosLocalidades[form.distrito] || [] : [];

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value, ...(field === "distrito" ? { localidade: "" } : {}) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = isEdit ? `/api/empresas/${empresa.nif}` : "/api/empresas";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.formErrors?.[0] || data.error || "Erro ao guardar");
      return;
    }

    const saved = await res.json();
    const redirectNif = saved?.nif || empresa?.nif;
    router.push(isEdit ? `/empresas/${encodeURIComponent(redirectNif)}` : "/empresas");
    router.refresh();
  }

  const field = (label: string, name: keyof typeof form, type = "text", disabled = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[name]}
        onChange={(e) => set(name, e.target.value)}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          {field("NIF", "nif", "text", isEdit && !isMaster)}
          {isEdit && isMaster && form.nif !== empresa?.nif && (
            <p className="text-xs text-orange-600 mt-1">O NIF será alterado e todos os registos associados migrados.</p>
          )}
        </div>
        {field("Nome da empresa", "nome")}
        {field("Telefone", "telefone")}
        {field("Email (separar múltiplos com ;)", "email")}
      </div>

      {field("Website", "website")}
      {field("Morada", "morada")}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Distrito</label>
          <select
            value={form.distrito}
            onChange={(e) => set("distrito", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecionar distrito</option>
            {distritos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Localidade</label>
          <select
            value={form.localidade}
            onChange={(e) => set("localidade", e.target.value)}
            disabled={!form.distrito}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">Selecionar localidade</option>
            {localidades.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {field("Quem atende o telefone", "quemAtende")}
        {field("Responsável", "responsavel")}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          {loading ? "A guardar..." : isEdit ? "Guardar alterações" : "Criar empresa"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-900 px-6 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
