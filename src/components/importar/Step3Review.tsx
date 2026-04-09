"use client";

import { useState, useCallback } from "react";
import { ParsedRecord } from "@/lib/importar/types";

const NIVEL_OPTIONS = ["BTE", "BTN", "MT", "AT", "MAT"];

export default function Step3Review({ records: initialRecords, onDone, onBack }: {
  records: ParsedRecord[];
  onDone: (records: ParsedRecord[]) => void;
  onBack: () => void;
}) {
  const [records, setRecords] = useState<ParsedRecord[]>(initialRecords);
  const [filter, setFilter]   = useState("");
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);

  const active = records.filter(r => !deleted.has(r.id));

  const filtered = filter
    ? active.filter(r =>
        r.nipc.includes(filter.toUpperCase()) ||
        r.cpe.includes(filter.toUpperCase()) ||
        r.nome.toLowerCase().includes(filter.toLowerCase())
      )
    : active;

  function patchRecord(id: string, patch: Partial<ParsedRecord>) {
    setRecords(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
  }

  function toggleDelete(id: string) {
    setDeleted(d => { const s = new Set(d); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  // Highlight suspicious NIFs
  function nifWarning(nipc: string): string {
    if (!nipc) return "Sem NIF";
    if (!/^PT\d{9}$/.test(nipc)) return "NIF inválido";
    return "";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">3. Revisão dos registos</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {active.length} registos válidos · {deleted.size} removidos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filtrar NIF / CPE / nome..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => onDone(active)}
            disabled={active.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            Continuar →
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">NIF</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">CPE</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Nível</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">Localidade</th>
              <th className="text-left px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide">CMA (kWh)</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(r => {
              const warn = nifWarning(r.nipc);
              const isEditing = editing === r.id;
              return (
                <tr key={r.id} className={`hover:bg-gray-50 ${deleted.has(r.id) ? "opacity-40 line-through" : ""}`}>
                  {isEditing ? (
                    <>
                      <td className="px-3 py-1.5">
                        <input
                          className="border rounded px-1.5 py-0.5 w-28 font-mono"
                          value={r.nipc}
                          onChange={e => patchRecord(r.id, { nipc: e.target.value.toUpperCase() })}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          className="border rounded px-1.5 py-0.5 w-40"
                          value={r.nome}
                          onChange={e => patchRecord(r.id, { nome: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          className="border rounded px-1.5 py-0.5 w-44 font-mono"
                          value={r.cpe}
                          onChange={e => patchRecord(r.id, { cpe: e.target.value.toUpperCase() })}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          className="border rounded px-1.5 py-0.5"
                          value={r.nivelTensao}
                          onChange={e => patchRecord(r.id, { nivelTensao: e.target.value })}
                        >
                          {NIVEL_OPTIONS.map(n => <option key={n}>{n}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          className="border rounded px-1.5 py-0.5 w-28"
                          value={r.descPostal}
                          onChange={e => patchRecord(r.id, { descPostal: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          className="border rounded px-1.5 py-0.5 w-20"
                          value={r.cma}
                          onChange={e => patchRecord(r.id, { cma: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          onClick={() => setEditing(null)}
                          className="text-green-600 hover:underline mr-2"
                        >
                          OK
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-mono">
                        <span className={warn ? "text-amber-600 font-semibold" : ""}
                          title={warn || undefined}>
                          {r.nipc || "—"}
                          {warn ? " ⚠" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[160px] truncate" title={r.nome}>{r.nome || "—"}</td>
                      <td className="px-3 py-2 font-mono text-gray-500 max-w-[180px] truncate">{r.cpe}</td>
                      <td className="px-3 py-2">
                        <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-medium">
                          {r.nivelTensao || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{r.descPostal || "—"}</td>
                      <td className="px-3 py-2 text-gray-600">{r.cma || "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          onClick={() => setEditing(r.id)}
                          className="text-blue-600 hover:underline mr-2"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleDelete(r.id)}
                          className="text-red-500 hover:underline"
                        >
                          {deleted.has(r.id) ? "Restaurar" : "Remover"}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400">
            Nenhum registo encontrado
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
        >
          ← Voltar
        </button>
        <button
          onClick={() => onDone(active)}
          disabled={active.length === 0}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-sm disabled:opacity-50"
        >
          Continuar com {active.length} registos →
        </button>
      </div>
    </div>
  );
}
