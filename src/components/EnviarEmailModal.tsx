"use client";

import { useState, useEffect } from "react";
import RichTextEditor from "@/components/RichTextEditor";

type Modelo = { id: string; nome: string; assunto: string; corpoHtml: string };
type NotaCriada = { id: string; texto: string; createdAt: string; user: { nome: string } };

export default function EnviarEmailModal({
  empresaNif,
  empresaNome,
  emailField,
  onClose,
  onSent,
}: {
  empresaNif: string;
  empresaNome: string;
  emailField: string;
  onClose: () => void;
  onSent: (nota: NotaCriada) => void;
}) {
  const destinatariosDisponiveis = emailField
    .split(";")
    .map((e) => e.trim())
    .filter(Boolean);

  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loadingModelos, setLoadingModelos] = useState(true);
  const [modeloId, setModeloId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [corpoHtml, setCorpoHtml] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/email/modelos")
      .then((r) => r.json())
      .then((data) => setModelos(Array.isArray(data) ? data : []))
      .finally(() => setLoadingModelos(false));
  }, []);

  function toggleDestinatario(email: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  function selecionarModelo(id: string) {
    setModeloId(id);
    const modelo = modelos.find((m) => m.id === id);
    if (modelo) {
      setAssunto(modelo.assunto);
      setCorpoHtml(modelo.corpoHtml);
    }
  }

  async function handleEnviar() {
    setError("");
    if (selecionados.size === 0) {
      setError("Seleciona pelo menos um destinatário.");
      return;
    }
    if (!assunto.trim() || !corpoHtml.trim()) {
      setError("Assunto e corpo do email são obrigatórios.");
      return;
    }

    setSending(true);
    const res = await fetch(`/api/empresas/${empresaNif}/enviar-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destinatarios: Array.from(selecionados),
        modeloEmailId: modeloId || undefined,
        assunto,
        corpoHtml,
      }),
    });
    const data = await res.json();
    setSending(false);

    if (!res.ok) {
      setError(data.error ?? "Erro ao enviar o email");
      return;
    }
    onSent(data.nota);
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => !sending && onClose()} />
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]">
          <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-base font-semibold text-gray-900">Enviar Email</h2>
            <p className="text-xs text-gray-400 mt-0.5">{empresaNome}</p>
          </div>

          <div className="px-6 py-4 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Destinatários</label>
              {destinatariosDisponiveis.length === 0 ? (
                <p className="text-sm text-gray-400">Esta empresa não tem email registado.</p>
              ) : (
                <div className="space-y-1.5">
                  {destinatariosDisponiveis.map((email) => (
                    <label key={email} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={selecionados.has(email)}
                        onChange={() => toggleDestinatario(email)}
                      />
                      {email}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo</label>
              <select
                value={modeloId}
                onChange={(e) => selecionarModelo(e.target.value)}
                disabled={loadingModelos}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{loadingModelos ? "A carregar..." : "Selecionar modelo..."}</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assunto</label>
              <input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Corpo do email</label>
              <RichTextEditor value={corpoHtml} onChange={setCorpoHtml} />
              <p className="text-xs text-gray-400 mt-1">
                A tua assinatura é adicionada automaticamente. É pedido aviso de entrega ao servidor do destinatário.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex gap-3 flex-shrink-0">
            <button
              onClick={handleEnviar}
              disabled={sending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {sending ? "A enviar..." : "Enviar email"}
            </button>
            <button
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
