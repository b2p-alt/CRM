import { PrismaClient, UserRole, TipoInstalacao, CicloTarifario } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 A criar dados de teste...");

  // ─── USERS ───────────────────────────────────────────
  const passwordHash = await bcrypt.hash("admin123", 12);
  const agenteHash = await bcrypt.hash("agente123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@crm.pt" },
    update: {},
    create: { nome: "Administrador", email: "admin@crm.pt", password: passwordHash, role: UserRole.MASTER },
  });

  const agente1 = await prisma.user.upsert({
    where: { email: "joao.silva@crm.pt" },
    update: {},
    create: { nome: "João Silva", email: "joao.silva@crm.pt", password: agenteHash, role: UserRole.AGENTE },
  });

  const agente2 = await prisma.user.upsert({
    where: { email: "ana.costa@crm.pt" },
    update: {},
    create: { nome: "Ana Costa", email: "ana.costa@crm.pt", password: agenteHash, role: UserRole.AGENTE },
  });

  console.log("✓ Users criados");

  // ─── EMPRESAS ─────────────────────────────────────────
  const empresasData = [
    { nif: "PT500123456", nome: "Metalúrgica do Tejo Lda", telefone: "212345678", email: "geral@metalurgicatejo.pt", morada: "Rua Industrial 45", distrito: "Lisboa", localidade: "Vila Franca de Xira", quemAtende: "Carla Mendes", responsavel: "Paulo Ferreira" },
    { nif: "PT501234567", nome: "Cerâmicas do Norte SA", telefone: "222345678", email: "comercial@ceramicasnorte.pt", morada: "Av. da Fábrica 12", distrito: "Porto", localidade: "Maia", quemAtende: "Ricardo Alves", responsavel: "Sofia Rodrigues" },
    { nif: "PT502345678", nome: "Agro-Setúbal Cooperativa", telefone: "265345678", email: "info@agroset.pt", morada: "Quinta do Vale Verde", distrito: "Setúbal", localidade: "Almada", quemAtende: "Teresa Lima", responsavel: "António Cardoso" },
    { nif: "PT503456789", nome: "Frigoríficos do Alentejo Lda", telefone: "286345678", email: "geral@frigorifico-alentejo.pt", morada: "Zona Industrial Norte, Lote 8", distrito: "Beja", localidade: "Beja", quemAtende: "Marta Santos", responsavel: "Jorge Pinto" },
    { nif: "PT504567890", nome: "Têxteis do Minho SA", telefone: "253345678", email: "admin@texteis-minho.pt", morada: "Rua do Tear 78", distrito: "Braga", localidade: "Guimarães", quemAtende: "Luísa Pereira", responsavel: "Carlos Oliveira" },
    { nif: "PT505678901", nome: "Hotelaria Algarve SA", telefone: "289345678", email: "financeiro@hotelalgarve.pt", morada: "Av. Beira-Mar 200", distrito: "Faro", localidade: "Albufeira", quemAtende: "Nuno Marques", responsavel: "Cristina Sousa" },
    { nif: "PT506789012", nome: "Panificadora Central Lda", telefone: "239345678", email: "geral@panificadoracentral.pt", morada: "Rua da Padaria 5", distrito: "Coimbra", localidade: "Coimbra", quemAtende: "Helena Fonseca", responsavel: "Miguel Correia" },
    { nif: "PT507890123", nome: "Granitos do Alentejo SA", telefone: "268345678", email: "comercial@granitos-alentejo.pt", morada: "Estrada Nacional 18, Km 45", distrito: "Évora", localidade: "Évora", quemAtende: "Francisco Serra", responsavel: "Beatriz Nunes" },
    { nif: "PT508901234", nome: "Papel & Cartão do Douro Lda", telefone: "254345678", email: "geral@papeldouro.pt", morada: "Av. do Rio 33", distrito: "Viseu", localidade: "Lamego", quemAtende: "Inês Barbosa", responsavel: "Rui Teixeira" },
    { nif: "PT509012345", nome: "Construções Aveirenses SA", telefone: "234345678", email: "obra@constraveiro.pt", morada: "Rua dos Engenheiros 99", distrito: "Aveiro", localidade: "Aveiro", quemAtende: "Pedro Gomes", responsavel: "Sandra Lopes" },
    { nif: "PT510123456", nome: "Logística Nacional Lda", telefone: "219345678", email: "operacoes@lognacional.pt", morada: "Zona Logística, Lote 22", distrito: "Lisboa", localidade: "Sintra", quemAtende: "Vítor Monteiro", responsavel: "Filipa Cunha" },
    { nif: "PT511234567", nome: "Serralharia do Sul SA", telefone: "269345678", email: "info@serralhariasul.pt", morada: "Rua do Metal 14", distrito: "Setúbal", localidade: "Setúbal", quemAtende: "Bruno Pires", responsavel: "Catarina Melo" },
  ];

  for (const e of empresasData) {
    await prisma.empresa.upsert({ where: { nif: e.nif }, update: {}, create: e });
  }
  console.log(`✓ ${empresasData.length} empresas criadas`);

  // ─── INSTALAÇÕES ──────────────────────────────────────
  const instalacoes = [
    // Metalúrgica do Tejo — 2 instalações
    { cpe: "PT0001000001234567TA", morada: "Rua Industrial 45", tipoInstalacao: TipoInstalacao.MT, cicloTarifario: CicloTarifario.TRI_HORARIO, dataInicioContrato: new Date("2021-03-01"), mesTermino: "2025-03", fornecedor: "EDP Comercial", consumoPonta: 12500, consumoCheia: 45000, consumoVazio: 22000, consumoSVazio: 8000, consumoAnual: 87500, empresaNif: "PT500123456" },
    { cpe: "PT0001000001234568TA", morada: "Rua Industrial 45 - Armazém", tipoInstalacao: TipoInstalacao.BTE, cicloTarifario: CicloTarifario.BI_HORARIO, dataInicioContrato: new Date("2022-01-01"), mesTermino: "2025-12", fornecedor: "Endesa", consumoPonta: 3200, consumoCheia: 8900, consumoVazio: 4100, consumoSVazio: null, consumoAnual: 16200, empresaNif: "PT500123456" },
    // Cerâmicas do Norte — 1 instalação
    { cpe: "PT0002000002345678TA", morada: "Av. da Fábrica 12", tipoInstalacao: TipoInstalacao.AT, cicloTarifario: CicloTarifario.TRI_HORARIO, dataInicioContrato: new Date("2020-06-01"), mesTermino: "2025-06", fornecedor: "Galp Energia", consumoPonta: 28000, consumoCheia: 95000, consumoVazio: 41000, consumoSVazio: 15000, consumoAnual: 179000, empresaNif: "PT501234567" },
    // Agro-Setúbal — 2 instalações
    { cpe: "PT0003000003456789TA", morada: "Quinta do Vale Verde - Produção", tipoInstalacao: TipoInstalacao.MT, cicloTarifario: CicloTarifario.SEMANAL, dataInicioContrato: new Date("2023-01-01"), mesTermino: "2026-01", fornecedor: "EDP Comercial", consumoPonta: 8500, consumoCheia: 31000, consumoVazio: 18000, consumoSVazio: 6000, consumoAnual: 63500, empresaNif: "PT502345678" },
    { cpe: "PT0003000003456790TA", morada: "Quinta do Vale Verde - Escritórios", tipoInstalacao: TipoInstalacao.BTN, cicloTarifario: CicloTarifario.SIMPLES, dataInicioContrato: new Date("2023-01-01"), mesTermino: "2026-01", fornecedor: "EDP Comercial", consumoPonta: null, consumoCheia: null, consumoVazio: null, consumoSVazio: null, consumoAnual: 4200, empresaNif: "PT502345678" },
    // Frigoríficos do Alentejo — 1 instalação
    { cpe: "PT0004000004567890TA", morada: "Zona Industrial Norte, Lote 8", tipoInstalacao: TipoInstalacao.MT, cicloTarifario: CicloTarifario.BI_HORARIO, dataInicioContrato: new Date("2019-09-01"), mesTermino: "2024-09", fornecedor: "Iberdrola", consumoPonta: 52000, consumoCheia: 130000, consumoVazio: 68000, consumoSVazio: null, consumoAnual: 250000, empresaNif: "PT503456789" },
    // Têxteis do Minho — 2 instalações
    { cpe: "PT0005000005678901TA", morada: "Rua do Tear 78 - Nave A", tipoInstalacao: TipoInstalacao.MT, cicloTarifario: CicloTarifario.TRI_HORARIO, dataInicioContrato: new Date("2022-04-01"), mesTermino: "2025-04", fornecedor: "Galp Energia", consumoPonta: 19000, consumoCheia: 62000, consumoVazio: 28000, consumoSVazio: 9000, consumoAnual: 118000, empresaNif: "PT504567890" },
    { cpe: "PT0005000005678902TA", morada: "Rua do Tear 78 - Nave B", tipoInstalacao: TipoInstalacao.BTE, cicloTarifario: CicloTarifario.BI_HORARIO, dataInicioContrato: new Date("2022-04-01"), mesTermino: "2025-04", fornecedor: "Galp Energia", consumoPonta: 7500, consumoCheia: 22000, consumoVazio: 11000, consumoSVazio: null, consumoAnual: 40500, empresaNif: "PT504567890" },
    // Hotelaria Algarve — 1 instalação
    { cpe: "PT0006000006789012TA", morada: "Av. Beira-Mar 200", tipoInstalacao: TipoInstalacao.BTE, cicloTarifario: CicloTarifario.SEMANAL_OPCIONAL, dataInicioContrato: new Date("2021-11-01"), mesTermino: "2024-11", fornecedor: "Endesa", consumoPonta: 15000, consumoCheia: 48000, consumoVazio: 21000, consumoSVazio: null, consumoAnual: 84000, empresaNif: "PT505678901" },
    // Panificadora Central — 1 instalação
    { cpe: "PT0007000007890123TA", morada: "Rua da Padaria 5", tipoInstalacao: TipoInstalacao.BTN, cicloTarifario: CicloTarifario.SIMPLES, dataInicioContrato: new Date("2020-02-01"), mesTermino: "2025-02", fornecedor: "EDP Comercial", consumoPonta: null, consumoCheia: null, consumoVazio: null, consumoSVazio: null, consumoAnual: 38000, empresaNif: "PT506789012" },
    // Granitos do Alentejo — 1 instalação
    { cpe: "PT0008000008901234TA", morada: "Estrada Nacional 18, Km 45", tipoInstalacao: TipoInstalacao.AT, cicloTarifario: CicloTarifario.TRI_HORARIO, dataInicioContrato: new Date("2018-05-01"), mesTermino: "2025-05", fornecedor: "Iberdrola", consumoPonta: 41000, consumoCheia: 118000, consumoVazio: 55000, consumoSVazio: 20000, consumoAnual: 234000, empresaNif: "PT507890123" },
    // Logística Nacional — 2 instalações
    { cpe: "PT0011000011234567TA", morada: "Zona Logística, Lote 22 - Nave 1", tipoInstalacao: TipoInstalacao.MT, cicloTarifario: CicloTarifario.BI_HORARIO, dataInicioContrato: new Date("2023-06-01"), mesTermino: "2026-06", fornecedor: "EDP Comercial", consumoPonta: 22000, consumoCheia: 71000, consumoVazio: 34000, consumoSVazio: null, consumoAnual: 127000, empresaNif: "PT510123456" },
    { cpe: "PT0011000011234568TA", morada: "Zona Logística, Lote 22 - Nave 2", tipoInstalacao: TipoInstalacao.BTE, cicloTarifario: CicloTarifario.BI_HORARIO, dataInicioContrato: new Date("2023-06-01"), mesTermino: "2026-06", fornecedor: "EDP Comercial", consumoPonta: 9000, consumoCheia: 27000, consumoVazio: 13000, consumoSVazio: null, consumoAnual: 49000, empresaNif: "PT510123456" },
  ];

  for (const inst of instalacoes) {
    await prisma.instalacao.upsert({ where: { cpe: inst.cpe }, update: {}, create: inst });
  }
  console.log(`✓ ${instalacoes.length} instalações criadas`);

  // ─── NOTAS ────────────────────────────────────────────
  await prisma.nota.createMany({
    skipDuplicates: true,
    data: [
      { texto: "Contacto inicial realizado. Empresa interessada em rever contrato em Março.", empresaNif: "PT500123456", userId: admin.id },
      { texto: "Responsável em reunião até final do mês. Ligar dia 28.", empresaNif: "PT500123456", userId: agente1.id },
      { texto: "Enviada proposta por email. Aguardar resposta até sexta.", empresaNif: "PT501234567", userId: agente1.id },
      { texto: "Contrato atual termina em Junho. Bom momento para abordar.", empresaNif: "PT501234567", userId: admin.id },
      { texto: "Cooperativa tem reunião de direção em Abril. Pedir para colocar na agenda.", empresaNif: "PT502345678", userId: agente2.id },
      { texto: "Frigorífico com contrato a expirar em Setembro — prioridade alta.", empresaNif: "PT503456789", userId: admin.id },
    ],
  });
  console.log("✓ Notas criadas");

  console.log("\n✅ Dados de teste criados com sucesso!");
  console.log("─────────────────────────────────────────");
  console.log("👤 Master:  admin@crm.pt       / admin123");
  console.log("👤 Agente:  joao.silva@crm.pt  / agente123");
  console.log("👤 Agente:  ana.costa@crm.pt   / agente123");
  console.log(`🏢 ${empresasData.length} empresas | 📦 ${instalacoes.length} instalações`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
