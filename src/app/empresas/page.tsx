import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { DISTRITOS, DISTRITOS_LOCALIDADES } from "@/lib/data/portugal";
import EmpresasFilters from "@/components/EmpresasFilters";

type SearchParams = {
  distrito?: string;
  localidade?: string;
  nif?: string;
  nome?: string;
  tipoInstalacao?: string;
  mesInicio?: string;
  q?: string;
};

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const filters = await searchParams;

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

  const empresas = await prisma.empresa.findMany({
    where: {
      rascunho: false,
      ...(filters.distrito && { distrito: filters.distrito }),
      ...(filters.localidade && { localidade: filters.localidade }),
      ...(filters.nif && { nif: { contains: filters.nif, mode: "insensitive" } }),
      ...(filters.nome && { nome: { contains: filters.nome, mode: "insensitive" } }),
      ...(filters.tipoInstalacao && {
        instalacoes: { some: { tipoInstalacao: filters.tipoInstalacao as never } },
      }),
      ...(nifsComMesInicio !== null && { nif: { in: nifsComMesInicio } }),
      ...(filters.q && { OR: [
        { nome:      { contains: filters.q, mode: "insensitive" } },
        { nif:       { contains: filters.q, mode: "insensitive" } },
        { telefone:  { contains: filters.q, mode: "insensitive" } },
        { email:     { contains: filters.q, mode: "insensitive" } },
        { website:   { contains: filters.q, mode: "insensitive" } },
        { morada:    { contains: filters.q, mode: "insensitive" } },
        { notas: { some: { texto: { contains: filters.q, mode: "insensitive" } } } },
      ]}),
    },
    include: { _count: { select: { instalacoes: true } }, kanbanCard: { select: { userId: true, user: { select: { nome: true } } } } },
    orderBy: { nome: "asc" },
  });

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

        <div className="mt-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-sm text-gray-500">
            {empresas.length} empresa{empresas.length !== 1 ? "s" : ""} encontrada{empresas.length !== 1 ? "s" : ""}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">NIF</th>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Distrito</th>
                <th className="px-4 py-3 text-left">Localidade</th>
                <th className="px-4 py-3 text-center">Instalações</th>
                <th className="px-4 py-3 text-left">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {empresas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma empresa encontrada
                  </td>
                </tr>
              ) : (
                empresas.map((e) => (
                  <tr key={e.nif} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.nif}</td>
                    <td className="px-4 py-3">
                      <Link href={`/empresas/${e.nif}`} className="font-medium text-blue-600 hover:underline">
                        {e.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.distrito || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{e.localidade || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                        {e._count.instalacoes}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {e.kanbanCard ? (
                        <span className="text-xs text-orange-600 font-medium">
                          Atribuída a {e.kanbanCard.user.nome}
                        </span>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">Livre</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
