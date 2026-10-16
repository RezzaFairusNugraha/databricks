import { NextRequest, NextResponse } from "next/server";
import { listSchemas, mapDatabricksError } from "@/lib/databricks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const catalog = searchParams.get("catalog") || "";

  if (!catalog) {
    return NextResponse.json(
      { success: false, error: "Parameter 'catalog' is required" },
      { status: 400 }
    );
  }

  try {
    const schemas = await listSchemas(catalog);
    return NextResponse.json({ success: true, schemas });
  } catch (error) {
    const mapped = mapDatabricksError(error);
    return NextResponse.json(
      {
        success: false,
        error: mapped.friendlyMessageId,
        details: mapped.message,
        code: mapped.code,
      },
      { status: mapped.statusCode || 500 }
    );
  }
}
