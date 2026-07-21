"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Campanha = {
  id: string;
  nome: string;
  mesFiltro: number | null;
  teste: boolean;
  status: "RASCUNHO" | "A_ENVIAR" | "PAUSADA_LIMITE" | "CONCLUIDA";
  createdAt: string;
  contaEmail: { nome: string };
  modeloEmail: { nome: string };
  criadoPor: { nome: string };
  _count: { envios: number };
};

const NOME_MES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_LABEL: Record<Campanha["status"], string> = {
  RASCUNHO: "Rascunho",
  A_ENVIAR: "A enviar",
  PAUSADA_LIMITE: "Pausada (limite diário)",
  CONCLUIDA: "Concluída",
};

const STATUS_COR: Record<Campanha["status"], string> = {
  RASCUNHO: "bg-gray-100 text-gray-600",
  A_ENVIAR: "bg-blue-100 text-blue-700",
  PAUSADA_LIMITE: "bg-amber-100 text-amber-700",
  CONCLUIDA: "bg-green-100 text-green-700",
};

export default function CampanhasPage() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/email/campanhas").then((r) => r.json()).then((cs) => { setCampanhas(cs); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "65px", width: "auto" }} />
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900">Campanhas de Email</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/email/contas" className="text-sm text-gray-500 hover:text-gray-700">Contas SMTP</Link>
          <Link href="/email/modelos" className="text-sm text-gray-500 hover:text-gray-700">Modelos</Link>
          <Link href="/email/campanhas/nova"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
            + Nova Campanha
          </Link>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="text-sm text-gray-400 p-6">A carregar...</p>
          ) : campanhas.length === 0 ? (
            <p className="text-sm text-gray-400 p-6">Sem campanhas criadas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mês</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empresas</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Criada por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campanhas.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => window.location.assign(`/email/campanhas/${c.id}`)}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.nome}
                      {c.teste && (
                        <span className="ml-2 inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          Teste
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.mesFiltro ? NOME_MES[c.mesFiltro] : "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{c._count.envios}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COR[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.criadoPor.nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
