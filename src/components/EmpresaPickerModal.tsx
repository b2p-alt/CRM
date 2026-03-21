"use client";

import { useState, useEffect } from "react";

const DISTRITOS = [
  "Aveiro","Beja","Braga","Bragança","Castelo Branco","Coimbra",
  "Évora","Faro","Guarda","Leiria","Lisboa","Portalegre","Porto",
  "Santarém","Setúbal","Viana do Castelo","Vila Real","Viseu",
];
const TIPOS_INSTALACAO = ["MAT","AT","MT","BTE","BTN"];
const MESES = [
  { val: "1",  label: "Janeiro" }, { val: "2",  label: "Fevereiro" },
  { val: "3",  label: "Março" },   { val: "4",  label: "Abril" },
  { val: "5",  label: "Maio" },    { val: "6",  label: "Junho" },
  { val: "7",  label: "Julho" },   { val: "8",  label: "Agosto" },
  { val: "9",  label: "Setembro"},{ val: "10", label: "Outubro" },
  { val: "11", label: "Novembro"},{ val: "12", label: "Dezembro" },
];

type Empresa = {
  nif: string;
  nome: string;
  distrito: string | null;
  localidade: string | null;
  _count: { instalacoes: number };
};

export default function EmpresaPickerModal({
  onConfirm, onClose,
}: {
  onConfirm: (nifs: string[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [distrito, setDistrito] = useState("");
  const [tipoInstalacao, setTipoInstalacao] = useState("");
  const [mesInicio, setMesInicio] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("nome", search);
    if (distrito) params.set("distrito", distrito);
    if (tipoInstalacao) params.set("tipoInstalacao", tipoInstalacao);
    if (mesInicio) params.set("mesInicio", mesInicio);

    fetch(`/api/empresas?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => { setEmpresas(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => {});
    return () => controller.abort();
  }, [search, distrito, tipoInstalacao, mesInicio]);

  const toggle = (nif: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(nif) ? n.delete(nif) : n.add(nif); return n; });

  const toggleAll = () =>
    setSelected(selected.size === empresas.length ? new Set() : new Set(empresas.map((e) => e.nif)));

  const allChecked = empresas.length > 0 && selected.size === empresas.length;
  const someChecked = selected.size > 0 && selected.size < empresas.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Adicionar empresas ao Kanban</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-2">
          <input
            type="text"
            placeholder="Pesquisar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex gap-2">
            <select value={distrito} onChange={(e) => setDistrito(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos os distritos</option>
              {DISTRITOS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={tipoInstalacao} onChange={(e) => setTipoInstalacao(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos os tipos</option>
              {TIPOS_INSTALACAO.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {/* Month filter */}
          <div className="flex items-center gap-2">
            <select value={mesInicio} onChange={(e) => setMesInicio(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Mês de início do contrato (todos)</option>
              {MESES.map((m) => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
            {mesInicio && (
              <button onClick={() => setMesInicio("")} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
            )}
          </div>
          {mesInicio && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
              A mostrar empresas com contratos iniciados em {MESES.find(m => m.val === mesInicio)?.label} — candidatas a renovar este mês
            </p>
          )}
        </div>

        {/* Select all */}
        {!loading && empresas.length > 0 && (
          <div className="px-5 py-2 border-b border-gray-100 flex items-center gap-3 bg-gray-50">
            <input type="checkbox" checked={allChecked}
              ref={(el) => { if (el) el.indeterminate = someChecked; }}
              onChange={toggleAll}
              className="w-4 h-4 accent-blue-600 cursor-pointer" />
            <span className="text-xs text-gray-500">
              {selected.size > 0
                ? `${selected.size} de ${empresas.length} selecionada${selected.size !== 1 ? "s" : ""}`
                : `Selecionar todas (${empresas.length})`}
            </span>
          </div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">A carregar...</div>
          ) : empresas.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nenhuma empresa disponível</div>
          ) : (
            empresas.map((e) => (
              <label key={e.nif} className="flex items-center gap-3 px-5 py-3 hover:bg-blue-50 cursor-pointer transition">
                <input type="checkbox" checked={selected.has(e.nif)} onChange={() => toggle(e.nif)}
                  className="w-4 h-4 accent-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900 truncate">{e.nome}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {[e.localidade, e.distrito].filter(Boolean).join(", ")}
                    {" · "}{e._count.instalacoes} inst.
                    {" · "}<span className="font-mono">{e.nif}</span>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {selected.size > 0
              ? `${selected.size} empresa${selected.size !== 1 ? "s" : ""} selecionada${selected.size !== 1 ? "s" : ""}`
              : "Nenhuma selecionada"}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={() => selected.size > 0 && onConfirm(Array.from(selected))}
              disabled={selected.size === 0}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
              Adicionar ao Kanban →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
