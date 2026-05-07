import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import NabaliaWizard from "@/components/importar/NabaliaWizard";

export default async function NabaliaCpePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MASTER") redirect("/empresas");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "65px", width: "auto" }} className="flex-shrink-0" />
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
          &larr; Dashboard
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900">Importar CPE — Nabalia</h1>
          <p className="text-xs text-gray-400">Pesquisa, revisão e criação de rascunhos por código postal</p>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <NabaliaWizard />
      </main>
    </div>
  );
}
