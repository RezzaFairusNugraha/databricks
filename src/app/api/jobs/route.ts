import { NextResponse } from "next/server";
import { getAllJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const jobs = getAllJobs();
  return NextResponse.json({ success: true, jobs });
}
