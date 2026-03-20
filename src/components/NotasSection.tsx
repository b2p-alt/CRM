"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Nota = {
  id: string;
  texto: string;
  createdAt: string | Date;
  user: { nome: string };
};

export default function NotasSection({ empresaNif, notas: initialNotas }: {
  empresaNif: string;
  notas: Nota[];
}) {
  const router = useRouter();
  const [notas, setNotas] = useState(initialNotas);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!texto.trim()) return;
      setLoading(true);

      const res = await fetch(`/api/empresas/${empresaNif}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });

      setLoading(false);
      if (res.ok) {
        const nova = await res.json();
        setNotas([nova, ...notas]);
        setTexto("");
        router.refresh();
      }
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        placeholder="Escreva uma nota e pressione Enter para guardar..."
        rows={2}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      <div className="text-xs text-gray-400">Enter para guardar · Shift+Enter para nova linha</div>

      <div className="space-y-3">
        {notas.length === 0 && (
          <p className="text-sm text-gray-400">Sem notas ainda</p>
        )}
        {notas.map((nota) => (
          <div key={nota.id} className="border-l-2 border-blue-200 pl-3">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{nota.texto}</p>
            <p className="text-xs text-gray-400 mt-1">
              {nota.user.nome} · {new Date(nota.createdAt).toLocaleString("pt-PT")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
