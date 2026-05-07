export type NivelTensao = "MAT" | "MT" | "BTE" | "BTN" | "AT";

export type ParsedRecord = {
  id: string; // ephemeral uuid for UI keying
  cpe: string;
  nipc: string;
  nome: string;
  rua: string;
  porta?: string;
  codPostal: string;
  descPostal: string;  // nome da localidade (Postal_Desc)
  dataInicio: string;
  nivelTensao: string;
  cma: string;
  // Campos adicionais (Nabalia e futuras fontes)
  cicloTarifario?: string;  // Period_Type: TETRA, SIMPLES, etc.
  p1?: string;              // consumoPonta
  p2?: string;              // consumoCheia
  p3?: string;              // consumoVazio
  p4?: string;              // consumoSVazio
  cae?: string;
  // UI state
  error?: string;
};

export type DuplicateInfo = {
  nipc: string;
  existsEmpresa: boolean;
  existsCpe: boolean;
  cpe?: string;
};

export type JobStatus = "idle" | "uploading" | "ocr" | "parsing" | "done" | "error";

export type Job = {
  id: string;
  status: JobStatus;
  distrito: string;
  totalPages: number;
  currentPage: number;
  progress: number; // 0-100
  ocrText?: string;
  records?: ParsedRecord[];
  error?: string;
  createdAt: number;
};
