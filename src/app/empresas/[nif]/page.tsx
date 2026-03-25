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

  // Serialize dates for client components
  const notasSerialized = empresa.notas.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <img src="/logo-b2p.png" alt="B2P Energy" style={{height:"65px",width:"auto"}} className="flex-shrink-0" />
        <Link href="/empresas" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Empresas
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 truncate">{empresa.nome}</h1>
          <p className="text-xs text-gray-400 font-mono">{empresa.nif}</p>
        </div>
        {empresa.kanbanCard && (
          <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full flex-shrink-0">
            Kanban · {empresa.kanbanCard.user.nome}
          </span>
        )}
      </header>

      <main className="p-6">
        <div className="grid grid-cols-[3fr_2fr] gap-6 items-start">
          {/* Left 60%: dados + instalações */}
          <div className="min-w-0 space-y-5">
            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Dados da empresa
              </h2>
              <EmpresaForm
                distritos={DISTRITOS}
                distritosLocalidades={DISTRITOS_LOCALIDADES}
                empresa={empresa}
              />
            </section>

            <section>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Instalações ({empresa.instalacoes.length})
              </h2>
              <InstalacoesSection empresaNif={nif} instalacoes={empresa.instalacoes} />
            </section>
          </div>

          {/* Right 40%: notas */}
          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Notas ({empresa.notas.length})
            </h2>
            <NotasSection empresaNif={nif} notas={notasSerialized} />
          </div>
        </div>
      </main>
    </div>
  );
}
