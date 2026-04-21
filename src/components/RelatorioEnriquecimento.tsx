"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type EmpresaErro = {
  nif: string;
  nome: string;
  distrito: string | null;
  localidade: string | null;
  telefone: string | null;
  email: string | null;
  enriquecimentoStatus: string;
  enriquecimentoAt: string | null;
  _count: { instalacoes: number };
};

type NifStatus = "nif_invalido" | "sem_dados" | "sem_contactos";

const STATUS_CONFIG: Record<NifStatus, { label: string; dot: string; badge: string }> = {
  nif_invalido:  { label: "NIF inválido / empresa inexistente", dot: "bg-red-400",    badge: "bg-red-100 text-red-800" },
  sem_dados:     { label: "Sem dados no NIF.pt",                dot: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-800" },
  sem_contactos: { label: "Encontrado mas sem contactos",       dot: "bg-gray-300",   badge: "bg-gray-100 text-gray-700" },
};

export default function RelatorioEnriquecimento() {
  const [empresas, setEmpresas] = useState<EmpresaErro[]>([]);
  const [loading, setLoading]   = useState(true);
  const [eliminando, setEliminando] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/enriquecer/relatorio");
    const data = await res.json();
    setEmpresas(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleEliminar(nifs: string[]) {
    if (!nifs.length) return;
    const ok = confirm(`Eliminar ${nifs.length} empresa${nifs.length !== 1 ? "s" : ""} da base de dados?\nEsta ação não pode ser desfeita.`);
    if (!ok) return;
    setEliminando(true);
    await fetch("/api/admin/enriquecer/eliminar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nifs }),
    });
    setEliminando(false);
    await load();
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">A carregar...</div>;

  const byStatus = (status: NifStatus) => empresas.filter(e => e.enriquecimentoStatus === status);
  const erros = empresas.filter(e => e.enriquecimentoStatus !== "encontrado");

  if (!erros.length) return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
      Sem erros registados. Execute um enriquecimento para ver resultados aqui.
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {erros.length} empresa{erros.length !== 1 ? "s" : ""} com resultado problemático
        </p>
        <button onClick={load} className="text-xs text-blue-600 hover:underline">Atualizar</button>
      </div>

      {(["nif_invalido", "sem_dados", "sem_contactos"] as NifStatus[]).map(status => {
        const group = byStatus(status);
        if (!group.length) return null;
        return (
          <ErroGroup
            key={status}
            status={status}
            empresas={group}
            eliminando={eliminando}
            onEliminar={handleEliminar}
          />
        );
      })}
    </div>
  );
}

function ErroGroup({ status, empresas, eliminando, onEliminar }: {
  status: NifStatus;
  empresas: EmpresaErro[];
  eliminando: boolean;
  onEliminar: (nifs: string[]) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const [open, setOpen]       = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set(empresas.map(e => e.nif)));

  const allChecked  = empresas.every(e => checked.has(e.nif));
  const someChecked = empresas.some(e => checked.has(e.nif));

  function toggleRow(nif: string) {
    setChecked(prev => { const n = new Set(prev); n.has(nif) ? n.delete(nif) : n.add(nif); return n; });
  }
  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(empresas.map(e => e.nif)));
  }

  // Group by enrichment date (day)
  const byDate = empresas.reduce<Record<string, EmpresaErro[]>>((acc, e) => {
    const day = e.enriquecimentoAt ? new Date(e.enriquecimentoAt).toLocaleDateString("pt-PT", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    }) : "Data desconhecida";
    (acc[day] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
        onClick={() => setOpen(o => !o)}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className="text-sm font-semibold text-gray-800">{cfg.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{empresas.length}</span>
        </div>
        <span className="text-xs text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Actions */}
          {status === "nif_invalido" && (
            <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-3">
              <button
                onClick={() => onEliminar([...checked])}
                disabled={eliminando || checked.size === 0}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-1.5 rounded disabled:opacity-40"
              >
                {eliminando ? "A eliminar..." : `Eliminar ${checked.size} empresa${checked.size !== 1 ? "s" : ""} da base`}
              </button>
              <span className="text-xs text-red-600">{checked.size} de {empresas.length} selecionadas</span>
            </div>
          )}

          {/* Table grouped by date */}
          {Object.entries(byDate).map(([date, group]) => (
            <div key={date}>
              <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500">
                Pesquisado em {date} · {group.length} empresa{group.length !== 1 ? "s" : ""}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2 w-8">
                      <input type="checkbox" checked={allChecked}
                        ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                        onChange={toggleAll} className="cursor-pointer" />
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Empresa</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase w-36">Distrito</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase w-24">Instalações</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase w-32">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.map(e => (
                    <tr key={e.nif} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(e.nif)}>
                      <td className="px-4 py-2 text-center">
                        <input type="checkbox" checked={checked.has(e.nif)} readOnly className="pointer-events-none" />
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/empresas/${encodeURIComponent(e.nif)}`}
                          onClick={ev => ev.stopPropagation()}
                          className="font-medium text-blue-600 hover:underline">
                          {e.nome}
                        </Link>
                        <div className="text-xs text-gray-400 font-mono">{e.nif}</div>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">{e.distrito ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{e._count.instalacoes}</td>
                      <td className="px-4 py-2" onClick={ev => ev.stopPropagation()}>
                        <Link href={`/empresas/${encodeURIComponent(e.nif)}`}
                          className="text-xs text-blue-600 hover:underline">
                          Ver ficha
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
