import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import RelatorioEnriquecimento from "@/components/RelatorioEnriquecimento";

export default async function RelatorioPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MASTER") redirect("/empresas");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "65px", width: "auto" }} className="flex-shrink-0" />
        <Link href="/admin/enriquecer" className="text-gray-400 hover:text-gray-600 text-sm">← Enriquecimento</Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Relatório de Erros de Enriquecimento</h1>
          <p className="text-xs text-gray-400">Empresas pesquisadas no NIF.pt com resultado problemático</p>
        </div>
      </header>
      <main className="p-6 max-w-5xl mx-auto">
        <RelatorioEnriquecimento />
      </main>
    </div>
  );
}
