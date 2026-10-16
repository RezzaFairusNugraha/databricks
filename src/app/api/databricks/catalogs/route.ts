import { NextResponse } from "next/server";
import { listCatalogs, mapDatabricksError } from "@/lib/databricks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const catalogs = await listCatalogs();
    return NextResponse.json({ success: true, catalogs });
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
