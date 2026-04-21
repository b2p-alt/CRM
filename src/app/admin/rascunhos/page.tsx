import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import RascunhosTable from "@/components/RascunhosTable";
import { DISTRITOS } from "@/lib/data/portugal";

export default async function RascunhosPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MASTER") redirect("/empresas");

  const empresas = await prisma.empresa.findMany({
    where: { rascunho: true },
    include: {
      instalacoes: true,
      notas: { include: { user: { select: { nome: true } } }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { nome: "asc" },
  });

  const semProblemas = empresas.filter(e => !e.importProblemas).length;
  const comProblemas = empresas.filter(e => !!e.importProblemas).length;
  const placeholder  = empresas.filter(e => e.nif.startsWith("RASCUNHO_")).length;

  const serialized = empresas.map(e => ({
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    instalacoes: e.instalacoes.map(i => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      dataInicioContrato: i.dataInicioContrato?.toISOString() ?? null,
    })),
    notas: e.notas.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{ height: "65px", width: "auto" }} className="flex-shrink-0" />
        <Link href="/empresas" className="text-gray-400 hover:text-gray-600 text-sm">← Empresas</Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Rascunhos de Importação</h1>
          <p className="text-xs text-gray-400">
            {empresas.length} empresas em rascunho · {semProblemas} limpas · {comProblemas} com problemas · {placeholder} com NIF provisório
          </p>
        </div>
      </header>

      <main className="p-6">
        <RascunhosTable empresas={serialized} distritos={DISTRITOS} />
      </main>
    </div>
  );
}
