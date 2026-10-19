import { NextRequest, NextResponse } from "next/server";
import { getSafeSettings, writeSettings, SettingsInputSchema } from "@/lib/databricks/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = getSafeSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal memuat pengaturan.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SettingsInputSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Input tidak valid";
      return NextResponse.json(
        {
          success: false,
          error: firstError,
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const saved = writeSettings(parsed.data);
    return NextResponse.json({ success: true, settings: saved });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal menyimpan pengaturan.",
      },
      { status: 500 }
    );
  }
}
