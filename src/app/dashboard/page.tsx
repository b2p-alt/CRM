import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">CRM</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user?.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-sm text-gray-500 hover:text-gray-900">
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="p-6">
        <p className="text-gray-500 text-sm">Dashboard Kanban — em construção</p>
      </main>
    </div>
  );
}
