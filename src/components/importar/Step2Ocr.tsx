"use client";

import { useEffect, useState } from "react";
import { ParsedRecord } from "@/lib/importar/types";

type OcrEvent = {
  status: string;
  progress: number;
  currentPage: number;
  totalPages: number;
  error?: string;
};

export default function Step2Ocr({ jobId, onDone, onBack }: {
  jobId: string;
  onDone: (records: ParsedRecord[]) => void;
  onBack: () => void;
}) {
  const [evt, setEvt]   = useState<OcrEvent>({ status: "ocr", progress: 0, currentPage: 0, totalPages: 0 });
  const [done, setDone] = useState(false);
  const [err, setErr]   = useState("");

  useEffect(() => {
    const es = new EventSource(`/api/importar/stream?jobId=${jobId}`);

    es.onmessage = (e) => {
      const data: OcrEvent = JSON.parse(e.data);
      setEvt(data);

      if (data.status === "done") {
        es.close();
        setDone(true);
        // Fetch records
        fetch(`/api/importar/records?jobId=${jobId}`)
          .then(r => r.json())
          .then(({ records }) => onDone(records))
          .catch(() => setErr("Erro ao carregar registos"));
      } else if (data.status === "error") {
        es.close();
        setErr(data.error || "Erro desconhecido no OCR");
      }
    };

    es.onerror = () => {
      es.close();
      setErr("Ligação SSE interrompida");
    };

    return () => es.close();
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusLabel: Record<string, string> = {
    idle: "A preparar...",
    ocr: `OCR: página ${evt.currentPage} de ${evt.totalPages || "?"}`,
    parsing: "A analisar texto...",
    done: "Concluído!",
    error: "Erro",
  };

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-base font-semibold text-gray-900 mb-1">2. OCR em curso</h2>
      <p className="text-sm text-gray-500 mb-8">
        O sistema está a extrair texto das páginas do PDF. Este processo pode demorar alguns minutos.
      </p>

      {err ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <p className="text-sm font-medium text-red-700 mb-1">Erro no OCR</p>
          <p className="text-xs text-red-600">{err}</p>
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{statusLabel[evt.status] || evt.status}</span>
            <span className="text-sm font-semibold text-gray-900">{evt.progress}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${evt.progress}%` }}
            />
          </div>
          {evt.totalPages > 0 && (
            <p className="text-xs text-gray-400 mt-2 text-right">
              {evt.currentPage}/{evt.totalPages} páginas
            </p>
          )}
        </div>
      )}

      {done && (
        <p className="text-sm text-green-600 text-center mb-4 font-medium">
          OCR concluído! A carregar registos...
        </p>
      )}

      {err && (
        <button
          onClick={onBack}
          className="w-full border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50"
        >
          ← Tentar novamente
        </button>
      )}
    </div>
  );
}
