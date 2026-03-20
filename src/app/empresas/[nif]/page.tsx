import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DISTRITOS, DISTRITOS_LOCALIDADES } from "@/lib/data/portugal";
import Link from "next/link";
import EmpresaForm from "@/components/EmpresaForm";
import NotasSection from "@/components/NotasSection";
import InstalacoesSection from "@/components/InstalacoesSection";

export default async function EmpresaDetailPage({
  params,
}: {
  params: Promise<{ nif: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { nif } = await params;
  const empresa = await prisma.empresa.findUnique({
    where: { nif },
    include: {
      instalacoes: { orderBy: { createdAt: "desc" } },
      notas: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { nome: true } } },
      },
      kanbanCard: { include: { user: { select: { nome: true } } } },
    },
  });

  if (!empresa) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/empresas" className="text-gray-400 hover:text-gray-600 text-sm">← Empresas</Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{empresa.nome}</h1>
          <p className="text-xs text-gray-400 font-mono">{empresa.nif}</p>
        </div>
        {empresa.kanbanCard && (
          <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
            Kanban: {empresa.kanbanCard.user.nome}
          </span>
        )}
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Dados da empresa */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Dados da empresa</h2>
          <EmpresaForm
            distritos={DISTRITOS}
            distritosLocalidades={DISTRITOS_LOCALIDADES}
            empresa={empresa}
          />
        </section>

        {/* Instalações */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Instalações ({empresa.instalacoes.length})
          </h2>
          <InstalacoesSection empresaNif={nif} instalacoes={empresa.instalacoes} />
        </section>

        {/* Notas */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Notas</h2>
          <NotasSection empresaNif={nif} notas={empresa.notas} />
        </section>
      </main>
    </div>
  );
}
