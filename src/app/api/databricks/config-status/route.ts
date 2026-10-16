import { NextResponse } from "next/server";
import { getConfigStatus } from "@/lib/databricks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = getConfigStatus();
  return NextResponse.json(status);
}
