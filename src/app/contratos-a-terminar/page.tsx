import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function formatMes(mesTermino: string): string {
  const [ano, mes] = mesTermino.split("-");
  return `${MESES[parseInt(mes) - 1]} ${ano}`;
}

function urgencyClass(mesTermino: string): string {
  const [ano, mes] = mesTermino.split("-").map(Number);
  const termino = new Date(ano, mes - 1, 1);
  const hoje = new Date();
  const diffMs = termino.getTime() - hoje.getTime();
  const diffMeses = diffMs / (1000 * 60 * 60 * 24 * 30.44);

  if (diffMeses < 0) return "bg-red-100 text-red-800 border-red-200";
  if (diffMeses <= 3) return "bg-orange-100 text-orange-800 border-orange-200";
  if (diffMeses <= 6) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-green-100 text-green-700 border-green-200";
}

export default async function ContratosATerminarPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const instalacoes = await prisma.instalacao.findMany({
    where: { mesTermino: { not: null } },
    orderBy: { mesTermino: "asc" },
    include: {
      empresa: {
        select: { nif: true, nome: true, distrito: true, localidade: true, telefone: true },
      },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Dashboard
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Contratos a Terminar</h1>
        <span className="ml-auto text-sm text-gray-400">{instalacoes.length} instalações</span>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {instalacoes.length === 0 ? (
          <p className="text-gray-500 text-sm mt-8 text-center">
            Nenhuma instalação com data de término registada.
          </p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium">Localidade</th>
                  <th className="text-left px-4 py-3 font-medium">CPE</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">Fornecedor</th>
                  <th className="text-left px-4 py-3 font-medium">Término</th>
                </tr>
              </thead>
              <tbody>
                {instalacoes.map((inst) => (
                  <tr
                    key={inst.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/empresas/${inst.empresa.nif}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {inst.empresa.nome}
                      </Link>
                      <div className="text-xs text-gray-400">{inst.empresa.nif}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {[inst.empresa.localidade, inst.empresa.distrito]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{inst.cpe}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{inst.tipoInstalacao}</td>
                    <td className="px-4 py-3 text-gray-600">{inst.fornecedor || "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-xs font-semibold ${urgencyClass(inst.mesTermino!)}`}
                      >
                        {formatMes(inst.mesTermino!)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-red-200 border border-red-300" /> Expirado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-orange-200 border border-orange-300" /> Até 3 meses
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-yellow-200 border border-yellow-300" /> Até 6 meses
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-green-200 border border-green-300" /> Mais de 6 meses
          </span>
        </div>
      </main>
    </div>
  );
}
