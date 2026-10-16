import fs from "fs";
import path from "path";

export interface JobRecord {
  jobId: string;
  fileName: string;
  fileSize: number;
  volumeFilePath: string;
  fullVolumePath: string;
  catalog: string;
  schema: string;
  volume: string;
  createdAt: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  rowCount?: number;
  errorMessage?: string;
}

const memoryJobs: JobRecord[] = [
  {
    jobId: "demo-sample-001",
    fileName: "customer_churn_q3.csv",
    fileSize: 18452000,
    volumeFilePath:
      "/Volumes/main/csv_tidy/raw_uploads/demo-sample-001/customer_churn_q3.csv",
    fullVolumePath:
      "dbfs:/Volumes/main/csv_tidy/raw_uploads/demo-sample-001/customer_churn_q3.csv",
    catalog: "main",
    schema: "csv_tidy",
    volume: "raw_uploads",
    createdAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    status: "ready",
    rowCount: 25420,
  },
  {
    jobId: "demo-sample-002",
    fileName: "telco_transactions_2025.csv",
    fileSize: 42150000,
    volumeFilePath:
      "/Volumes/main/csv_tidy/raw_uploads/demo-sample-002/telco_transactions_2025.csv",
    fullVolumePath:
      "dbfs:/Volumes/main/csv_tidy/raw_uploads/demo-sample-002/telco_transactions_2025.csv",
    catalog: "main",
    schema: "csv_tidy",
    volume: "raw_uploads",
    createdAt: new Date(Date.now() - 3600 * 1000 * 14).toISOString(),
    status: "ready",
    rowCount: 89310,
  },
];

const DATA_DIR = path.join(process.cwd(), ".data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");

function ensureDirectory() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Ignore in read-only environments
  }
}

export function getAllJobs(): JobRecord[] {
  try {
    ensureDirectory();
    if (fs.existsSync(JOBS_FILE)) {
      const content = fs.readFileSync(JOBS_FILE, "utf-8");
      const list = JSON.parse(content) as JobRecord[];
      return list;
    }
  } catch {}
  return memoryJobs;
}

export function addJob(job: JobRecord): void {
  const current = getAllJobs();
  const updated = [job, ...current.filter((j) => j.jobId !== job.jobId)];
  try {
    ensureDirectory();
    fs.writeFileSync(JOBS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch {}
  memoryJobs.unshift(job);
}

export function getJobById(jobId: string): JobRecord | undefined {
  const jobs = getAllJobs();
  return jobs.find((j) => j.jobId === jobId);
}
