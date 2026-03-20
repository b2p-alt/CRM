"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const TIPOS = ["MAT", "AT", "MT", "BTE", "BTN"];

type Props = {
  distritos: string[];
  distritosLocalidades: Record<string, string[]>;
  filters: Record<string, string | undefined>;
};

export default function EmpresasFilters({ distritos, distritosLocalidades, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [distrito, setDistrito] = useState(filters.distrito || "");
  const [localidade, setLocalidade] = useState(filters.localidade || "");
  const [nif, setNif] = useState(filters.nif || "");
  const [nome, setNome] = useState(filters.nome || "");
  const [tipoInstalacao, setTipoInstalacao] = useState(filters.tipoInstalacao || "");

  const localidades = distrito ? distritosLocalidades[distrito] || [] : [];

  useEffect(() => {
    if (!localidades.includes(localidade)) setLocalidade("");
  }, [distrito]);

  function applyFilters() {
    const params = new URLSearchParams();
    if (distrito) params.set("distrito", distrito);
    if (localidade) params.set("localidade", localidade);
    if (nif) params.set("nif", nif);
    if (nome) params.set("nome", nome);
    if (tipoInstalacao) params.set("tipoInstalacao", tipoInstalacao);
    router.push(`${pathname}?${params.toString()}`);
  }

  function clearFilters() {
    setDistrito(""); setLocalidade(""); setNif(""); setNome(""); setTipoInstalacao("");
    router.push(pathname);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <input
          placeholder="NIF"
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          placeholder="Nome da empresa"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={distrito}
          onChange={(e) => setDistrito(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os distritos</option>
          {distritos.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={localidade}
          onChange={(e) => setLocalidade(e.target.value)}
          disabled={!distrito}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="">Todas as localidades</option>
          {localidades.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select
          value={tipoInstalacao}
          onChange={(e) => setTipoInstalacao(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tipo de instalação</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={applyFilters}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          Filtrar
        </button>
        <button
          onClick={clearFilters}
          className="text-gray-600 hover:text-gray-900 text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}
