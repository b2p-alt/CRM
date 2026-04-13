"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EliminarEmpresaButton({ nif, nome }: { nif: string; nome: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleEliminar() {
    if (!confirm(`Eliminar a empresa "${nome}" (${nif})?\n\nEsta ação é irreversível e remove também todas as instalações associadas.`)) return;

    setLoading(true);
    const res = await fetch(`/api/empresas/${nif}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Erro ao eliminar empresa");
      setLoading(false);
      return;
    }

    router.push("/empresas");
    router.refresh();
  }

  return (
    <button
      onClick={handleEliminar}
      disabled={loading}
      className="text-sm text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
    >
      {loading ? "A eliminar..." : "Eliminar empresa"}
    </button>
  );
}
