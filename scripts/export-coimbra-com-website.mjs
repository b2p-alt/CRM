import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const empresas = await prisma.empresa.findMany({
    where: {
      distrito: "Coimbra",
      website: { not: null },
      NOT: { website: "" },
    },
    select: {
      nif: true,
      nome: true,
      nomeComercial: true,
      website: true,
      localidade: true,
      telefone: true,
      email: true,
    },
    orderBy: { nome: "asc" },
  });

  const header = ["NIF", "Nome", "Nome Comercial", "Website", "Localidade", "Telefone", "Email"];
  const rows = empresas.map((e) => [
    e.nif,
    e.nome,
    e.nomeComercial ?? "",
    e.website,
    e.localidade ?? "",
    e.telefone ?? "",
    e.email ?? "",
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(";")).join("\n");
  const outPath = "empresas-coimbra-com-website.csv";
  writeFileSync(outPath, "﻿" + csv, "utf-8");

  console.log(`Total empresas encontradas: ${empresas.length}`);
  console.log(`Ficheiro exportado para: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
