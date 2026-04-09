import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import ImportarWizard from "@/components/importar/ImportarWizard";

export default async function ImportarPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user?.role !== "MASTER") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "65px", width: "auto" }} />
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Importar PDF</h1>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <ImportarWizard />
      </main>
    </div>
  );
}
