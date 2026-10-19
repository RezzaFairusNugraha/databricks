import { NextResponse } from "next/server";
import { testConnection } from "@/lib/databricks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await testConnection();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        latencyMs: 0,
        message: error instanceof Error ? error.message : "Test failed",
        diagnostics: [],
        error: String(error),
      },
      { status: 200 }
    );
  }
}

export async function GET() {
  try {
    const result = await testConnection();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        latencyMs: 0,
        message: error instanceof Error ? error.message : "Test failed",
        diagnostics: [],
        error: String(error),
      },
      { status: 200 }
    );
  }
}
