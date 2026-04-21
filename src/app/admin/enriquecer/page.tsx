import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import EnriquecerWizard from "@/components/EnriquecerWizard";
import CreditosNifPt from "@/components/CreditosNifPt";
import { DISTRITOS } from "@/lib/data/portugal";

export default async function EnriquecerPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MASTER") redirect("/empresas");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "65px", width: "auto" }} className="flex-shrink-0" />
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900">Enriquecimento de Contactos</h1>
          <p className="text-xs text-gray-400">Via API NIF.pt · apenas empresas sem telefone e/ou email</p>
        </div>
        <Link href="/admin/enriquecer/relatorio"
          className="ml-auto text-sm text-blue-600 hover:underline flex-shrink-0">
          Ver relatório de erros →
        </Link>
      </header>
      <main className="p-6 max-w-5xl mx-auto">
        <CreditosNifPt />
        <EnriquecerWizard distritos={DISTRITOS} />
      </main>
    </div>
  );
}
