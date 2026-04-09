"use client";

import { useState } from "react";
import { ParsedRecord } from "@/lib/importar/types";

type ImportResult = {
  empresasInseridas: number;
  instalacoesinseridas: number;
  empresasIgnoradas: number;
  instalacoesIgnoradas: number;
  errors: string[];
};

export default function Step5Confirmar({ records, distrito, existingNifs, existingCpes, onBack }: {
  records: ParsedRecord[];
  distrito: string;
  existingNifs: string[];
  existingCpes: string[];
  onBack: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState<ImportResult | null>(null);
  const [error, setError]         = useState("");

  const newEmpresas    = new Set(records.map(r => r.nipc).filter(Boolean));
  const existSet       = new Set(existingNifs);
  const newCount       = [...newEmpresas].filter(n => !existSet.has(n)).length;
  const existCpeSet    = new Set(existingCpes);
  const newInstal      = records.filter(r => !existCpeSet.has(r.cpe)).length;

  async function handleImport() {
    if (!confirm(`Importar ${records.length} registos para o distrito de ${distrito}?\nEsta ação irá adicionar dados à base de dados.`)) return;

    setImporting(true);
    setError("");

    const res = await fetch("/api/importar/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records, distrito }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erro na importação");
      setImporting(false);
      return;
    }

    const data = await res.json();
    setResult(data);
    setImporting(false);
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Importação concluída!</h2>
        <p className="text-sm text-gray-500 mb-8">Distrito: {distrito}</p>

        <div className="grid grid-cols-2 gap-4 mb-6 text-left">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs font-medium text-green-700 mb-1">Empresas adicionadas</p>
            <p className="text-3xl font-bold text-green-800">{result.empresasInseridas}</p>
            <p className="text-xs text-green-600 mt-1">{result.empresasIgnoradas} ignoradas</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs font-medium text-green-700 mb-1">Instalações adicionadas</p>
            <p className="text-3xl font-bold text-green-800">{result.instalacoesinseridas}</p>
            <p className="text-xs text-green-600 mt-1">{result.instalacoesIgnoradas} ignoradas</p>
          </div>
        </div>

        {result.errors.length > 0 && (
          <details className="text-left text-xs text-gray-500 mb-6">
            <summary className="cursor-pointer hover:text-gray-700">
              {result.errors.length} aviso{result.errors.length !== 1 ? "s" : ""}
            </summary>
            <div className="mt-2 bg-gray-50 rounded p-3 max-h-40 overflow-y-auto space-y-1">
              {result.errors.map((e, i) => <div key={i} className="text-amber-600">{e}</div>)}
            </div>
          </details>
        )}

        <div className="flex gap-3">
          <a
            href="/empresas"
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm text-center"
          >
            Ver Empresas
          </a>
          <a
            href="/admin/importar"
            className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg text-sm text-center hover:bg-gray-50"
          >
            Nova importação
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-base font-semibold text-gray-900 mb-1">5. Confirmar importação</h2>
      <p className="text-sm text-gray-500 mb-6">
        Revise o resumo antes de gravar na base de dados.
      </p>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6 space-y-3 text-sm">
        <Row label="Distrito" value={distrito} />
        <Row label="Total de registos" value={records.length} />
        <Row label="Empresas novas" value={newCount} highlight />
        <Row label="Instalações novas" value={newInstal} highlight />
        <Row label="Empresas já existentes" value={existingNifs.length} dim />
        <Row label="Instalações já existentes" value={existingCpes.length} dim />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-xs text-amber-700">
        Registos duplicados (NIF ou CPE já na BD) serão <strong>ignorados</strong>. Empresas existentes não serão alteradas.
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={importing}
          className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          ← Voltar
        </button>
        <button
          onClick={handleImport}
          disabled={importing || newCount === 0 && newInstal === 0}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50"
        >
          {importing ? "A importar..." : `Importar agora`}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, dim }: {
  label: string; value: string | number; highlight?: boolean; dim?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={dim ? "text-gray-400" : "text-gray-600"}>{label}</span>
      <span className={`font-semibold ${highlight ? "text-blue-700" : dim ? "text-gray-400" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}
