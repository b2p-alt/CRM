"use client";

import { useState } from "react";

type Saldo = {
  monthly?: number; daily?: number; hourly?: number; minute?: number; credits?: number;
};
type MbRef = { entity: string; reference: string; amount: string };

export default function CreditosNifPt() {
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  const [showComprar, setShowComprar] = useState(false);
  const [amount, setAmount] = useState("1000");
  const [invoiceName, setInvoiceName] = useState("");
  const [invoiceNif, setInvoiceNif] = useState("");
  const [loading, setLoading] = useState(false);
  const [mbRef, setMbRef] = useState<MbRef | null>(null);
  const [error, setError] = useState("");

  async function loadSaldo() {
    setLoadingSaldo(true);
    setSaldo(null);
    try {
      const res = await fetch("/api/admin/enriquecer/creditos");
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setSaldo(data);
    } finally { setLoadingSaldo(false); }
  }

  async function handleComprar() {
    setLoading(true);
    setMbRef(null);
    setError("");
    try {
      const res = await fetch("/api/admin/enriquecer/creditos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), invoiceName, invoiceNif }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setMbRef(data.mb);
    } finally { setLoading(false); }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Créditos NIF.pt</span>
          {saldo !== null && (
            <div className="flex gap-3 text-xs text-gray-500">
              {saldo.credits !== undefined && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                  {saldo.credits} créditos pagos
                </span>
              )}
              {saldo.monthly  !== undefined && <span>Mensal: {saldo.monthly}</span>}
              {saldo.daily    !== undefined && <span>Diário: {saldo.daily}</span>}
              {saldo.hourly   !== undefined && <span>Hora: {saldo.hourly}</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={loadSaldo} disabled={loadingSaldo}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 disabled:opacity-50">
            {loadingSaldo ? "..." : "Ver saldo"}
          </button>
          <button onClick={() => { setShowComprar(s => !s); setMbRef(null); setError(""); }}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded">
            {showComprar ? "Cancelar" : "Comprar créditos"}
          </button>
        </div>
      </div>

      {showComprar && !mbRef && (
        <div className="mt-4 border-t border-gray-100 pt-4 grid grid-cols-2 gap-3 max-w-lg">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Créditos a comprar</label>
            <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nome fatura (opcional)</label>
            <input type="text" value={invoiceName} onChange={e => setInvoiceName(e.target.value)}
              placeholder="Ex: B2P Energy Lda"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">NIF fatura (opcional)</label>
            <input type="text" value={invoiceNif} onChange={e => setInvoiceNif(e.target.value)}
              placeholder="Ex: 123456789"
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full" />
          </div>
          <div className="flex items-end">
            <button onClick={handleComprar} disabled={loading || !amount}
              className="bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-1.5 rounded w-full disabled:opacity-40">
              {loading ? "A gerar referência..." : "Gerar referência MB"}
            </button>
          </div>
          {error && <p className="col-span-2 text-xs text-red-500">{error}</p>}
        </div>
      )}

      {mbRef && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Referência Multibanco gerada:</p>
          <div className="flex gap-6 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm max-w-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Entidade</p>
              <p className="font-mono font-bold text-lg text-gray-900">{mbRef.entity}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Referência</p>
              <p className="font-mono font-bold text-lg text-gray-900">{mbRef.reference}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Valor</p>
              <p className="font-mono font-bold text-lg text-gray-900">{mbRef.amount} €</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Após o pagamento, os créditos ficam disponíveis automaticamente.
          </p>
          <button onClick={() => { setMbRef(null); setShowComprar(false); }}
            className="text-xs text-gray-500 hover:underline mt-2">
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
