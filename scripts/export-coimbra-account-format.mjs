import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
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
    select: { nome: true, website: true },
    orderBy: { nome: "asc" },
  });

  const header = ["Account Name", "Account Stage", "Account Website"];
  const rows = empresas.map((e) => [
    e.nome,
    "Cold",
    e.website.includes("null") ? "" : e.website,
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
  const outPath = "empresas-coimbra-account-format.csv";
  writeFileSync(outPath, csv, "utf-8");

  console.log(`Total empresas (com website real): ${empresas.length}`);
  console.log(`Ficheiro exportado para: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
