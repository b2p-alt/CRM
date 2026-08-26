import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { DISTRITOS, DISTRITOS_LOCALIDADES } from "@/lib/data/portugal";
import EmpresasFilters from "@/components/EmpresasFilters";
import EmpresasTable from "@/components/EmpresasTable";

const PAGE_SIZES = [50, 100, 200, 500];
const DEFAULT_PAGE_SIZE = 100;

type SearchParams = {
  distrito?: string;
  localidade?: string;
  nif?: string;
  nome?: string;
  tipoInstalacao?: string;
  mesInicio?: string;
  publica?: string;
  q?: string;
  page?: string;
  pageSize?: string;
};

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const filters = await searchParams;

  const hasFilter = Boolean(
    filters.distrito || filters.localidade || filters.nif || filters.nome ||
    filters.tipoInstalacao || filters.mesInicio || filters.publica || filters.q
  );

  const pageSize = PAGE_SIZES.includes(Number(filters.pageSize)) ? Number(filters.pageSize) : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, parseInt(filters.page || "1") || 1);

  // Raw SQL for month-of-contract-start filter
  let nifsComMesInicio: string[] | null = null;
  if (filters.mesInicio && /^([1-9]|1[0-2])$/.test(filters.mesInicio)) {
    const rows = await prisma.$queryRaw<{ empresaNif: string }[]>`
      SELECT DISTINCT "empresaNif"
      FROM "Instalacao"
      WHERE EXTRACT(MONTH FROM "dataInicioContrato") = ${parseInt(filters.mesInicio)}
    `;
    nifsComMesInicio = rows.map((r) => r.empresaNif);
  }

  const where = {
    rascunho: false,
    ...(filters.distrito && { distrito: filters.distrito }),
    ...(filters.localidade && { localidade: filters.localidade }),
    ...(filters.nif && { nif: { contains: filters.nif, mode: "insensitive" as const } }),
    ...(filters.nome && { nome: { contains: filters.nome, mode: "insensitive" as const } }),
    ...(filters.tipoInstalacao && {
      instalacoes: { some: { tipoInstalacao: filters.tipoInstalacao as never } },
    }),
    ...(nifsComMesInicio !== null && { nif: { in: nifsComMesInicio } }),
    ...(filters.publica === "sim" && { empresaPublica: true }),
    ...(filters.publica === "nao" && { empresaPublica: false }),
    ...(filters.q && { OR: [
      { nome:      { contains: filters.q, mode: "insensitive" as const } },
      { nif:       { contains: filters.q, mode: "insensitive" as const } },
      { telefone:  { contains: filters.q, mode: "insensitive" as const } },
      { email:     { contains: filters.q, mode: "insensitive" as const } },
      { website:   { contains: filters.q, mode: "insensitive" as const } },
      { morada:    { contains: filters.q, mode: "insensitive" as const } },
      { notas: { some: { texto: { contains: filters.q, mode: "insensitive" as const } } } },
    ]}),
  };

  const [empresas, total] = hasFilter
    ? await prisma.$transaction([
        prisma.empresa.findMany({
          where,
          include: { _count: { select: { instalacoes: true } }, kanbanCard: { select: { userId: true, user: { select: { nome: true } } } } },
          orderBy: { nome: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.empresa.count({ where }),
      ])
    : [[], await prisma.empresa.count({ where: { rascunho: false } })];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/logo-b2p.png" alt="B2P Energy" style={{height:"65px",width:"auto"}} />
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <h1 className="text-lg font-semibold text-gray-900">Empresas</h1>
        </div>
        <Link
          href="/empresas/nova"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Nova Empresa
        </Link>
      </header>

      <main className="p-6">
        <EmpresasFilters
          distritos={DISTRITOS}
          distritosLocalidades={DISTRITOS_LOCALIDADES}
          filters={filters}
        />

        <EmpresasTable
          empresas={empresas}
          total={total}
          page={page}
          pageSize={pageSize}
          pageSizes={PAGE_SIZES}
          hasFilter={hasFilter}
        />
      </main>
    </div>
  );
}
