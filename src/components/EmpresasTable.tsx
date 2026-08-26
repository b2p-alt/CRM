"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Empresa = {
  nif: string;
  nome: string;
  distrito: string | null;
  localidade: string | null;
  empresaPublica: boolean;
  _count: { instalacoes: number };
  kanbanCard: { userId: string; user: { nome: string } } | null;
};

type Props = {
  empresas: Empresa[];
  total: number;
  page: number;
  pageSize: number;
  pageSizes: number[];
  hasFilter: boolean;
};

export default function EmpresasTable({ empresas, total, page, pageSize, pageSizes, hasFilter }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function goTo(nextPage: number, nextPageSize?: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    if (nextPageSize) params.set("pageSize", String(nextPageSize));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (!hasFilter) {
    return (
      <div className="mt-4 bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
        <p>Use os filtros acima para pesquisar entre as <strong>{total}</strong> empresas da base.</p>
        <p className="text-xs text-gray-400 mt-1">A lista só aparece depois de aplicar pelo menos um filtro.</p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const allSelected = empresas.length > 0 && empresas.every((e) => selected.has(e.nif));
  const someSelected = empresas.some((e) => selected.has(e.nif));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(empresas.map((e) => e.nif)));
  }

  function toggleRow(nif: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(nif) ? n.delete(nif) : n.add(nif);
      return n;
    });
  }

  async function marcar(publica: boolean) {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await fetch("/api/empresas/marcar-publica", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nifs: [...selected], publica }),
      });
      setSelected(new Set());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm text-gray-500">
          {total} empresa{total !== 1 ? "s" : ""} encontrada{total !== 1 ? "s" : ""}
          {someSelected && <> · {selected.size} selecionada{selected.size !== 1 ? "s" : ""}</>}
        </span>
        {someSelected && (
          <div className="flex gap-2">
            <button
              onClick={() => marcar(true)}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-40"
            >
              {saving ? "A gravar..." : `Marcar ${selected.size} como pública`}
            </button>
            <button
              onClick={() => marcar(false)}
              disabled={saving}
              className="text-gray-600 hover:text-gray-900 text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
            >
              Desmarcar
            </button>
          </div>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            <th className="px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                onChange={toggleAll}
                className="cursor-pointer"
              />
            </th>
            <th className="px-4 py-3 text-left">NIF</th>
            <th className="px-4 py-3 text-left">Nome</th>
            <th className="px-4 py-3 text-left">Distrito</th>
            <th className="px-4 py-3 text-left">Localidade</th>
            <th className="px-4 py-3 text-center">Instalações</th>
            <th className="px-4 py-3 text-center">Pública</th>
            <th className="px-4 py-3 text-left">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {empresas.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                Nenhuma empresa encontrada
              </td>
            </tr>
          ) : (
            empresas.map((e) => (
              <tr key={e.nif} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(e.nif)}
                    onChange={() => toggleRow(e.nif)}
                    className="cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.nif}</td>
                <td className="px-4 py-3">
                  <Link href={`/empresas/${e.nif}`} className="font-medium text-blue-600 hover:underline">
                    {e.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{e.distrito || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{e.localidade || "—"}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                    {e._count.instalacoes}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {e.empresaPublica && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                      Pública
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {e.kanbanCard ? (
                    <span className="text-xs text-orange-600 font-medium">
                      Atribuída a {e.kanbanCard.user.nome}
                    </span>
                  ) : (
                    <span className="text-xs text-green-600 font-medium">Livre</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Por página:</span>
          <select
            value={pageSize}
            onChange={(e) => goTo(1, Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pageSizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>
          <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
          <button
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Seguinte →
          </button>
        </div>
      </div>
    </div>
  );
}
