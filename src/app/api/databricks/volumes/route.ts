import { NextRequest, NextResponse } from "next/server";
import { listVolumes, mapDatabricksError } from "@/lib/databricks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const catalog = searchParams.get("catalog") || "";
  const schema = searchParams.get("schema") || "";

  if (!catalog || !schema) {
    return NextResponse.json(
      { success: false, error: "Parameter 'catalog' dan 'schema' wajib diisi." },
      { status: 400 }
    );
  }

  try {
    const volumes = await listVolumes(catalog, schema);
    return NextResponse.json({ success: true, volumes });
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
