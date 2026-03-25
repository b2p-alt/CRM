import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DISTRITOS, DISTRITOS_LOCALIDADES } from "@/lib/data/portugal";
import EmpresaForm from "@/components/EmpresaForm";

export default async function NovaEmpresaPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{height:"65px",width:"auto"}} />
        <h1 className="text-lg font-semibold text-gray-900">Nova Empresa</h1>
      </header>
      <main className="p-6 max-w-2xl mx-auto">
        <EmpresaForm
          distritos={DISTRITOS}
          distritosLocalidades={DISTRITOS_LOCALIDADES}
        />
      </main>
    </div>
  );
}
