import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!request.body) {
      return NextResponse.json(
        {
          success: false,
          error: "Stream body kosong.",
          suggestion: "Pilih berkas Excel yang valid.",
        },
        { status: 400 }
      );
    }

    const nodeStream = Readable.fromWeb(
      request.body as unknown as import("node:stream/web").ReadableStream
    );

    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(nodeStream, {
      entries: "emit",
      worksheets: "emit",
    });

    const sheets: string[] = [];
    for await (const ws of workbookReader) {
      const worksheet = ws as unknown as { name?: string };
      if (worksheet.name) {
        sheets.push(worksheet.name);
      }
    }

    return NextResponse.json({
      success: true,
      sheets,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Gagal membaca struktur sheet Excel.",
        suggestion: "Pastikan berkas Excel (.xlsx) tidak rusak atau terproteksi kata sandi.",
      },
      { status: 422 }
    );
  }
}
