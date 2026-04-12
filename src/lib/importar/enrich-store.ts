import { EnrichData } from "./racius";

export type EnrichResult = EnrichData & { nipc: string };

export type EnrichJob = {
  id: string;
  status: "idle" | "running" | "paused" | "done" | "error";
  total: number;
  processed: number;
  found: number;
  results: Record<string, EnrichData>; // nipc → dados
  error?: string;
  createdAt: number;
  aborted: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __enrichJobs: Map<string, EnrichJob> | undefined;
}
if (!globalThis.__enrichJobs) globalThis.__enrichJobs = new Map();
const jobs = globalThis.__enrichJobs;

export function createEnrichJob(id: string, total: number): EnrichJob {
  const job: EnrichJob = {
    id, status: "idle", total, processed: 0, found: 0,
    results: {}, createdAt: Date.now(), aborted: false,
  };
  jobs.set(id, job);
  return job;
}

export function getEnrichJob(id: string): EnrichJob | undefined {
  return jobs.get(id);
}

export function patchEnrichJob(id: string, patch: Partial<EnrichJob>): void {
  const job = jobs.get(id);
  if (job) jobs.set(id, { ...job, ...patch });
}

export function abortEnrichJob(id: string): void {
  const job = jobs.get(id);
  if (job) jobs.set(id, { ...job, aborted: true, status: "paused" });
}
