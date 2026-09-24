// Utilizadores que partilham entre si as colunas abaixo no Kanban (só leitura).
// Quem não está nesta lista só vê os seus próprios cartões, independentemente da role.
export const KANBAN_PARTILHA_EMAILS = [
  "rubens.vaz@b2p.pt",
  "fernanda.bueno@b2p.pt",
];

export const KANBAN_PARTILHA_COLUNAS = ["PROPOSTA", "CLIENTE"] as const;
