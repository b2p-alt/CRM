"use client";

import { useState, useRef } from "react";

const DISTRITOS = [
  "Aveiro","Beja","Braga","Bragança","Castelo Branco","Coimbra","Évora",
  "Faro","Guarda","Leiria","Lisboa","Portalegre","Porto","Santarém",
  "Setúbal","Viana do Castelo","Vila Real","Viseu","Açores","Madeira",
];

function guessDistrito(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").toLowerCase();
  for (const d of DISTRITOS) {
    if (base.includes(d.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""))) return d;
    if (base.includes(d.toLowerCase())) return d;
  }
  return "";
}

export default function Step1Upload({ onDone }: {
  onDone: (jobId: string, distrito: string) => void;
}) {
  const [file, setFile]         = useState<File | null>(null);
  const [distrito, setDistrito] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState("");
  const inputRef                = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setError("");
    const guess = guessDistrito(f.name);
    if (guess) setDistrito(guess);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") handleFile(f);
  }

  async function handleSubmit() {
    if (!file || !distrito) return;
    setUploading(true);
    setError("");

    const fd = new FormData();
    fd.append("pdf", file);
    fd.append("distrito", distrito);

    const res = await fetch("/api/importar/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erro no upload");
      setUploading(false);
      return;
    }

    const { jobId } = await res.json();
    onDone(jobId, distrito);
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-base font-semibold text-gray-900 mb-1">1. Selecionar PDF</h2>
      <p className="text-sm text-gray-500 mb-6">
        Carregue um PDF de instalações elétricas para iniciar o processo de OCR e importação.
      </p>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-10 text-center cursor-pointer transition mb-5"
      >
        {file ? (
          <div>
            <p className="text-sm font-medium text-gray-800">{file.name}</p>
            <p className="text-xs text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <div>
            <p className="text-2xl mb-2">📄</p>
            <p className="text-sm text-gray-500">Arraste um PDF aqui ou clique para selecionar</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {/* Distrito */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Distrito *</label>
        <select
          value={distrito}
          onChange={(e) => setDistrito(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— Selecionar distrito —</option>
          {DISTRITOS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!file || !distrito || uploading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? "A enviar..." : "Iniciar OCR →"}
      </button>
    </div>
  );
}
