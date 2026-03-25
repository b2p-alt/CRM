import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import KanbanBoard from "@/components/KanbanBoard";

export default async function KanbanPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isMaster = session.user?.role === "MASTER";

  const cards = await prisma.kanbanCard.findMany({
    where: isMaster ? {} : { userId: session.user!.id! },
    include: {
      empresa: {
        include: {
          _count: { select: { instalacoes: true } },
          notas: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
      user: { select: { nome: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const serialized = cards.map((c) => ({
    ...c,
    agendamentoData: c.agendamentoData ? c.agendamentoData.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    empresa: {
      ...c.empresa,
      createdAt: c.empresa.createdAt.toISOString(),
      updatedAt: c.empresa.updatedAt.toISOString(),
      lastContactAt: c.empresa.notas[0]?.createdAt.toISOString() ?? null,
      notas: undefined, // não precisamos no cliente
    },
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/logo-b2p.png" alt="B2P Energy" style={{height:"65px",width:"auto"}} />
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Kanban</h1>
        </div>
        <span className="text-sm text-gray-500">{session.user?.name}</span>
      </header>

      <main className="p-6 overflow-x-auto">
        <KanbanBoard
          cards={serialized}
          userRole={session.user?.role ?? "AGENTE"}
          userId={session.user?.id ?? ""}
        />
      </main>
    </div>
  );
}
