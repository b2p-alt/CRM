"use client";

import { useEffect, useState } from "react";
import { ParsedRecord } from "@/lib/importar/types";

type DupResult = {
  existingNifs: string[];
  existingCpes: string[];
  totalEmpresas: number;
  totalInstalacoes: number;
  duplicateEmpresas: number;
  duplicateInstalacoes: number;
};

export default function Step4Duplicados({ records, onDone, onBack }: {
  records: ParsedRecord[];
  onDone: (existingNifs: string[], existingCpes: string[]) => void;
  onBack: () => void;
}) {
  const [result, setResult]   = useState<DupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    fetch("/api/importar/duplicados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records }),
    })
      .then(r => r.json())
      .then(data => { setResult(data); setLoading(false); })
      .catch(() => { setError("Erro ao verificar duplicados"); setLoading(false); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-base font-semibold text-gray-900 mb-1">4. Verificação de duplicados</h2>
      <p className="text-sm text-gray-500 mb-6">
        A comparar NIFs e CPEs com os dados existentes na base de dados.
      </p>

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin text-2xl mb-3">⟳</div>
          <p className="text-sm text-gray-500">A verificar...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4 mb-8">
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Empresas a importar"
              value={result.totalEmpresas}
              sub={`${result.duplicateEmpresas} já existem (serão ignoradas)`}
              color={result.duplicateEmpresas > 0 ? "amber" : "green"}
            />
            <StatCard
              label="Instalações a importar"
              value={result.totalInstalacoes}
              sub={`${result.duplicateInstalacoes} já existem (serão ignoradas)`}
              color={result.duplicateInstalacoes > 0 ? "amber" : "green"}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            <strong>{result.totalEmpresas - result.duplicateEmpresas}</strong> empresas novas e{" "}
            <strong>{result.totalInstalacoes - result.duplicateInstalacoes}</strong> instalações novas
            serão adicionadas à base de dados.
          </div>

          {result.duplicateEmpresas > 0 && (
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700">
                Ver {result.duplicateEmpresas} NIFs duplicados
              </summary>
              <div className="mt-2 bg-gray-50 rounded p-3 max-h-40 overflow-y-auto font-mono space-y-1">
                {result.existingNifs.map(n => <div key={n}>{n}</div>)}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50"
        >
          ← Voltar
        </button>
        <button
          onClick={() => result && onDone(result.existingNifs, result.existingCpes)}
          disabled={!result || loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: {
  label: string; value: number; sub: string; color: "green" | "amber";
}) {
  const colors = {
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium mb-1 opacity-80">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-70">{sub}</p>
    </div>
  );
}
