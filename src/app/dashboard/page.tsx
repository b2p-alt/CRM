import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{height:"65px",width:"auto"}} />
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user?.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-sm text-gray-500 hover:text-gray-900">Sair</button>
          </form>
        </div>
      </header>

      <main className="p-6">
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <Link
            href="/empresas"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition"
          >
            <div className="text-2xl mb-2">🏢</div>
            <h2 className="font-semibold text-gray-900">Empresas</h2>
            <p className="text-sm text-gray-500 mt-1">Pesquisar e gerir empresas</p>
          </Link>
          <Link
            href="/kanban"
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition"
          >
            <div className="text-2xl mb-2">📋</div>
            <h2 className="font-semibold text-gray-900">Kanban</h2>
            <p className="text-sm text-gray-500 mt-1">Gerir pipeline comercial</p>
          </Link>
          {session.user?.role === "MASTER" && (
            <Link
              href="/utilizadores"
              className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="text-2xl mb-2">👥</div>
              <h2 className="font-semibold text-gray-900">Utilizadores</h2>
              <p className="text-sm text-gray-500 mt-1">Gerir contas e acessos</p>
            </Link>
          )}
          {session.user?.role === "MASTER" && (
            <Link
              href="/admin/importar"
              className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-sm transition"
            >
              <div className="text-2xl mb-2">📥</div>
              <h2 className="font-semibold text-gray-900">Importar PDF</h2>
              <p className="text-sm text-gray-500 mt-1">OCR e importação de dados</p>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
