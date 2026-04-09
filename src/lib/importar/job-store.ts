import { Job } from "./types";

// Anchored to globalThis so the same Map is shared across all Next.js
// route module instances (dev hot-reload creates separate module scopes).
declare global {
  // eslint-disable-next-line no-var
  var __importJobs: Map<string, Job> | undefined;
}
if (!globalThis.__importJobs) globalThis.__importJobs = new Map();
const jobs = globalThis.__importJobs;

export function createJob(id: string, distrito: string): Job {
  const job: Job = {
    id,
    status: "idle",
    distrito,
    totalPages: 0,
    currentPage: 0,
    progress: 0,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function patchJob(id: string, patch: Partial<Job>): void {
  const job = jobs.get(id);
  if (job) jobs.set(id, { ...job, ...patch });
}

export function deleteJob(id: string): void {
  jobs.delete(id);
}

// Clean up jobs older than 1 hour
export function cleanOldJobs(): void {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}
