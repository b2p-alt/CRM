export type EnrichRecord = {
  nif: string;
  nome: string;
  telefoneAtual: string | null;
  emailAtual: string | null;
  telefoneEncontrado: string | null;
  emailEncontrado: string | null;
  websiteEncontrado: string | null;
  found: boolean;
  error?: string;
};

export type EnrichJob = {
  id: string;
  status: "running" | "done" | "aborted" | "error";
  total: number;
  done: number;
  currentNome: string;
  results: EnrichRecord[];
  aborted: boolean;
  errorMsg?: string;
};

declare global {
  var __enrichNifPtJobs: Map<string, EnrichJob> | undefined;
}
if (!globalThis.__enrichNifPtJobs) globalThis.__enrichNifPtJobs = new Map();
const jobs = globalThis.__enrichNifPtJobs;

export const jobStore = {
  create(id: string, total: number): EnrichJob {
    const job: EnrichJob = { id, status: "running", total, done: 0, currentNome: "", results: [], aborted: false };
    jobs.set(id, job);
    return job;
  },
  get(id: string) { return jobs.get(id); },
  abort(id: string) { const j = jobs.get(id); if (j) { j.aborted = true; j.status = "aborted"; } },
  delete(id: string) { jobs.delete(id); },
};
