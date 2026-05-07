"use client";

import { useState } from "react";
import { ParsedRecord } from "@/lib/importar/types";
import { DISTRITOS } from "@/lib/data/portugal";
import { normalizeNipc } from "@/lib/nabalia";

type RawRow = Record<string, string | boolean> & {
  _nipc: string;
  _cpe: string;
  _empresaExiste: boolean;
  _cpeExiste: boolean;
};

export default function Step1NabaliaPesquisa({ onDone }: {
  onDone: (records: ParsedRecord[], distrito: string) => void;
}) {
  const [codPostal,    setCodPostal]    = useState("");
  const [codPostalAte, setCodPostalAte] = useState("");
  const [voltageCode,  setVoltageCode]  = useState("");
  const [distrito,    setDistrito]    = useState("");
  const [rows,        setRows]        = useState<RawRow[]>([]);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [searched,    setSearched]    = useState(false);
  const [fieldNames,  setFieldNames]  = useState<string[]>([]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!codPostal && !voltageCode) return;
    setLoading(true);
    setError("");
    setRows([]);
    setSelected(new Set());
    setSearched(false);

    try {
      const res = await fetch("/api/admin/nabalia-cpe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codPostal, codPostalAte, voltageCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido");
      const records: RawRow[] = data.records ?? [];
      setRows(records);
      setFieldNames(data._fieldNames ?? []);
      setSelected(new Set(records.filter((r) => !r._cpeExiste).map((r) => r._cpe)));
      setSearched(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function toggleAll() {
    const importable = rows.filter((r) => !r._cpeExiste).map((r) => r._cpe);
    setSelected(
      selected.size === importable.length ? new Set() : new Set(importable)
    );
  }

  function toggleRow(cpe: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(cpe) ? next.delete(cpe) : next.add(cpe);
      return next;
    });
  }

  function handleContinue() {
    const selectedRows = rows.filter((r) => selected.has(r._cpe));
    const parsed: ParsedRecord[] = selectedRows.map((r) => ({
      id:             crypto.randomUUID(),
      cpe:            (r.CPE ?? r._cpe) as string,
      nipc:           normalizeNipc((r.NIPC ?? "") as string),
      nome:           (r.Nome ?? "") as string,
      rua:            (r.Rua ?? "") as string,
      porta:          (r.Porta ?? "") as string,
      codPostal:      (r.Postal_Cod ?? "") as string,
      descPostal:     (r.Postal_Desc ?? r.Concelho_Desc ?? "") as string,
      dataInicio:     (r.Data_Inicio_Contrato ?? "") as string,
      nivelTensao:    (r.Nivel_Tensao ?? r.Voltage_Code ?? "") as string,
      cma:            (r.CMA ?? "") as string,
      cicloTarifario: (r.Period_Type ?? "") as string,
      p1:             (r.P1 ?? "") as string,
      p2:             (r.P2 ?? "") as string,
      p3:             (r.P3 ?? "") as string,
      p4:             (r.P4 ?? "") as string,
      cae:            (r.CAE ?? "") as string,
    }));
    onDone(parsed, distrito);
  }

  const importable = rows.filter((r) => !r._cpeExiste);
  const allSelected = importable.length > 0 && selected.size === importable.length;
  const canContinue = selected.size > 0 && !!distrito;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">1. Pesquisa CPE — Nabalia</h2>
        <p className="text-sm text-gray-500 mt-0.5">Selecione o distrito e pesquise por código postal e/ou nível de tensão.</p>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Distrito *</label>
          <select
            value={distrito}
            onChange={(e) => setDistrito(e.target.value)}
            required
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Selecionar distrito —</option>
            {DISTRITOS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Código Postal {codPostalAte ? "— De" : ""}
            </label>
            <input
              type="text"
              placeholder="ex: 1000"
              value={codPostal}
              onChange={(e) => setCodPostal(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Até (opcional)</label>
            <input
              type="text"
              placeholder="ex: 1500"
              value={codPostalAte}
              onChange={(e) => setCodPostalAte(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nível de Tensão</label>
          <select
            value={voltageCode}
            onChange={(e) => setVoltageCode(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="MT">MT</option>
            <option value="BTE">BTE</option>
            <option value="AT">AT</option>
            <option value="MAT">MAT</option>
            <option value="BTN">BTN</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="submit"
            disabled={loading || (!codPostal && !voltageCode)}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? "A pesquisar..." : "Pesquisar"}
          </button>
          {codPostal && codPostalAte && (
            <p className="text-xs text-amber-600">
              Intervalo activo — pode devolver muitos registos
            </p>
          )}
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {searched && rows.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum resultado encontrado.</p>
      )}

      {/* Painel de diagnóstico — campos reais do SOAP + valores do 1º registo */}
      {fieldNames.length > 0 && (
        <details className="text-xs border border-dashed border-gray-300 rounded-lg p-3">
          <summary className="cursor-pointer text-gray-400 hover:text-gray-600">
            Diagnóstico — campos disponíveis na API ({fieldNames.filter(f => !f.startsWith("_")).length} campos)
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-2 py-1 border border-gray-200 font-mono">Campo SOAP</th>
                  <th className="text-left px-2 py-1 border border-gray-200">Valor (1º registo)</th>
                </tr>
              </thead>
              <tbody>
                {fieldNames.filter(f => !f.startsWith("_")).map(f => (
                  <tr key={f} className="hover:bg-gray-50">
                    <td className="px-2 py-1 border border-gray-100 font-mono text-blue-700">{f}</td>
                    <td className="px-2 py-1 border border-gray-100 text-gray-600">
                      {String(rows[0]?.[f] ?? "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{rows.length}</span> resultado(s) ·{" "}
              <span className="text-green-600 font-medium">{selected.size} selecionado(s)</span>
              {rows.length - importable.length > 0 && (
                <span className="text-gray-400"> · {rows.length - importable.length} já existem no CRM</span>
              )}
            </p>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">CPE</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">NIF</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Cód. Postal</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Localidade</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Nível</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">CMA</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const cpeExiste = r._cpeExiste as boolean;
                  const isSelected = selected.has(r._cpe);
                  return (
                    <tr
                      key={r._cpe}
                      className={`${cpeExiste ? "opacity-40" : "hover:bg-gray-50"} ${isSelected ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-3 py-2">
                        {!cpeExiste && (
                          <input type="checkbox" checked={isSelected} onChange={() => toggleRow(r._cpe)} className="rounded" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-500">{r._cpe}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate">{(r.Nome ?? "—") as string}</td>
                      <td className="px-3 py-2 font-mono">{r._nipc || "—"}</td>
                      <td className="px-3 py-2">{(r.Postal_Cod ?? "—") as string}</td>
                      <td className="px-3 py-2">{(r.Postal_Desc ?? r.Concelho_Desc ?? "—") as string}</td>
                      <td className="px-3 py-2">
                        <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                          {(r.Voltage_Code ?? "—") as string}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {r.CMA ? Number(r.CMA as string).toLocaleString("pt-PT") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {cpeExiste ? (
                          <span className="text-gray-400">Já existe</span>
                        ) : (r._empresaExiste as boolean) ? (
                          <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Nova instalação</span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Nova empresa</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg text-sm disabled:opacity-50 transition"
          title={!distrito ? "Selecione um distrito primeiro" : !selected.size ? "Selecione pelo menos um registo" : ""}
        >
          Continuar com {selected.size} registo(s) →
        </button>
      </div>
    </div>
  );
}
