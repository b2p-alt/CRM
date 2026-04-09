import { ParsedRecord } from "./types";
import { prisma } from "@/lib/prisma";
import { cleanNipc, cleanCpe, cleanNivel, cleanNome, cleanLocalidade } from "./parser";

export type ImportResult = {
  empresasInseridas: number;
  instalacoesinseridas: number;
  empresasIgnoradas: number;
  instalacoesIgnoradas: number;
  errors: string[];
};

export async function importRecords(
  records: ParsedRecord[],
  distrito: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    empresasInseridas: 0,
    instalacoesinseridas: 0,
    empresasIgnoradas: 0,
    instalacoesIgnoradas: 0,
    errors: [],
  };

  // Deduplicate by NIF for empresa inserts
  const seenNif = new Set<string>();
  const empresaUpserts: { nif: string; nome: string; localidade: string | null; distrito: string }[] = [];
  const instalInserts: {
    cpe: string;
    nivel: string;
    cma: number | null;
    dataInicio: Date | null;
    empresaNif: string;
  }[] = [];

  for (const r of records) {
    const nif   = cleanNipc(r.nipc);
    const cpe   = cleanCpe(r.cpe);
    const nivel = cleanNivel(r.nivelTensao);

    if (!nif || !cpe || !nivel) {
      result.errors.push(`Registo inválido ignorado: CPE=${r.cpe} NIF=${r.nipc}`);
      continue;
    }

    if (!seenNif.has(nif)) {
      seenNif.add(nif);
      empresaUpserts.push({
        nif,
        nome: cleanNome(r.nome) || "Sem nome",
        localidade: cleanLocalidade(r.descPostal),
        distrito,
      });
    }

    const cmaNum = r.cma && !isNaN(parseFloat(r.cma)) ? parseFloat(r.cma) : null;
    let dataInicio: Date | null = null;
    if (r.dataInicio && /^\d{4}-\d{2}-\d{2}$/.test(r.dataInicio)) {
      dataInicio = new Date(r.dataInicio);
    }

    instalInserts.push({ cpe, nivel, cma: cmaNum, dataInicio, empresaNif: nif });
  }

  // Insert empresas (skip existing)
  for (const e of empresaUpserts) {
    try {
      await prisma.empresa.upsert({
        where: { nif: e.nif },
        create: { nif: e.nif, nome: e.nome, localidade: e.localidade, distrito: e.distrito },
        update: {}, // don't overwrite existing empresa data
      });
      result.empresasInseridas++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.empresasIgnoradas++;
      result.errors.push(`Empresa ${e.nif}: ${msg}`);
    }
  }

  // Insert instalações (skip existing CPE)
  for (const i of instalInserts) {
    try {
      const existing = await prisma.instalacao.findUnique({ where: { cpe: i.cpe } });
      if (existing) {
        result.instalacoesIgnoradas++;
        continue;
      }
      await prisma.instalacao.create({
        data: {
          cpe: i.cpe,
          tipoInstalacao: i.nivel as "MAT" | "MT" | "BTE" | "BTN" | "AT",
          consumoAnual: i.cma,
          dataInicioContrato: i.dataInicio,
          empresaNif: i.empresaNif,
        },
      });
      result.instalacoesinseridas++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.instalacoesIgnoradas++;
      result.errors.push(`Instalação ${i.cpe}: ${msg}`);
    }
  }

  return result;
}
