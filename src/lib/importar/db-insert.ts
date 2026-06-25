import { ParsedRecord } from "./types";
import { EnrichData } from "./racius";
import { prisma } from "@/lib/prisma";
import { CicloTarifario } from "@prisma/client";
import { cleanNipc, cleanCpe, cleanNivel, cleanNome, cleanLocalidade } from "./parser";

export type ImportResult = {
  empresasInseridas: number;
  instalacoesinseridas: number;
  empresasIgnoradas: number;
  instalacoesIgnoradas: number;
  errors: string[];
};

const CICLO_MAP: Record<string, CicloTarifario> = {
  SIMPLES:          CicloTarifario.SIMPLES,
  BI:               CicloTarifario.BI_HORARIO,
  "BI-HORARIO":     CicloTarifario.BI_HORARIO,
  BI_HORARIO:       CicloTarifario.BI_HORARIO,
  TRI:              CicloTarifario.TRI_HORARIO,
  "TRI-HORARIO":    CicloTarifario.TRI_HORARIO,
  TRI_HORARIO:      CicloTarifario.TRI_HORARIO,
  TETRA:            CicloTarifario.TRI_HORARIO, // 4 períodos, mapeado para o mais próximo
  DIARIO:           CicloTarifario.DIARIO,
  SEMANAL:          CicloTarifario.SEMANAL,
  SEMANAL_OPCIONAL: CicloTarifario.SEMANAL_OPCIONAL,
};

function parseCiclo(raw?: string): CicloTarifario | undefined {
  if (!raw) return undefined;
  return CICLO_MAP[raw.trim().toUpperCase()];
}

function parseNum(raw?: string): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(",", "."));
  return isNaN(n) ? null : n;
}

function parseDate(raw?: string): Date | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return new Date(raw);
  return null;
}

function buildMorada(rua?: string, porta?: string): string | null {
  const parts = [rua, porta].map(s => s?.trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export async function importRecords(
  records: ParsedRecord[],
  distrito: string,
  enrichResults: Record<string, EnrichData> = {},
  rascunho = false,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = {
    empresasInseridas: 0,
    instalacoesinseridas: 0,
    empresasIgnoradas: 0,
    instalacoesIgnoradas: 0,
    errors: [],
  };

  const seenNif = new Set<string>();
  const empresaUpserts: {
    nif: string; nome: string; morada: string | null;
    localidade: string | null; distrito: string;
    telefone: string | null; email: string | null; website: string | null;
  }[] = [];
  const instalInserts: {
    cpe: string; nivel: string; morada: string | null;
    cma: number | null; dataInicio: Date | null;
    cicloTarifario: CicloTarifario | undefined;
    p1: number | null; p2: number | null;
    p3: number | null; p4: number | null;
    empresaNif: string;
  }[] = [];

  for (const r of records) {
    const nif   = cleanNipc(r.nipc);
    const cpe   = cleanCpe(r.cpe);
    const nivel = cleanNivel(r.nivelTensao);

    if (!nif || !cpe || !nivel) {
      const motivo = !nif   ? `NIF inválido "${r.nipc}"`
                   : !cpe   ? `CPE inválido "${r.cpe}"`
                   :          `Nível inválido "${r.nivelTensao}"`;
      result.errors.push(`Ignorado (${motivo}) — CPE=${r.cpe} NIF=${r.nipc}`);
      continue;
    }

    if (!seenNif.has(nif)) {
      seenNif.add(nif);
      const enrich = enrichResults[nif];
      empresaUpserts.push({
        nif,
        nome:       cleanNome(r.nome) || "Sem nome",
        morada:     buildMorada(r.rua, r.porta),
        localidade: cleanLocalidade(r.descPostal),
        distrito,
        telefone:   enrich?.telefone ?? null,
        email:      enrich?.email    ?? null,
        website:    enrich?.website  ?? null,
      });
    }

    instalInserts.push({
      cpe,
      nivel,
      morada:         buildMorada(r.rua, r.porta),
      cma:            parseNum(r.cma),
      dataInicio:     parseDate(r.dataInicio),
      cicloTarifario: parseCiclo(r.cicloTarifario),
      p1:             parseNum(r.p1),
      p2:             parseNum(r.p2),
      p3:             parseNum(r.p3),
      p4:             parseNum(r.p4),
      empresaNif:     nif,
    });
  }

  const totalOps = empresaUpserts.length + instalInserts.length;
  let doneOps = 0;

  // Insert empresas
  for (const e of empresaUpserts) {
    try {
      await prisma.empresa.upsert({
        where:  { nif: e.nif },
        create: {
          nif: e.nif, nome: e.nome, morada: e.morada,
          localidade: e.localidade, distrito: e.distrito,
          telefone: e.telefone, email: e.email, website: e.website,
          rascunho,
        },
        update: {}, // nunca sobrescreve dados introduzidos manualmente
      });
      result.empresasInseridas++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.empresasIgnoradas++;
      result.errors.push(`Empresa ${e.nif}: ${msg}`);
    }
    onProgress?.(++doneOps, totalOps);
  }

  // Insert instalações
  for (const i of instalInserts) {
    try {
      const existing = await prisma.instalacao.findUnique({ where: { cpe: i.cpe } });
      if (existing) { result.instalacoesIgnoradas++; }
      else {
        await prisma.instalacao.create({
          data: {
            cpe:                i.cpe,
            empresaNif:         i.empresaNif,
            tipoInstalacao:     i.nivel as "MAT" | "MT" | "BTE" | "BTN" | "AT",
            morada:             i.morada,
            cicloTarifario:     i.cicloTarifario,
            consumoAnual:       i.cma,
            consumoPonta:       i.p1,
            consumoCheia:       i.p2,
            consumoVazio:       i.p3,
            consumoSVazio:      i.p4,
            dataInicioContrato: i.dataInicio,
          },
        });
        result.instalacoesinseridas++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.instalacoesIgnoradas++;
      result.errors.push(`Instalação ${i.cpe}: ${msg}`);
    }
    onProgress?.(++doneOps, totalOps);
  }

  return result;
}
