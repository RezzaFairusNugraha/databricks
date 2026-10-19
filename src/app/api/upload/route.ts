import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getDatabricksConfig, mapDatabricksError, uploadToVolume } from "@/lib/databricks";
import { addJob } from "@/lib/jobs";
import { normalizeFileStream, NormalizationError } from "@/lib/detector/stream-normalizer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const config = getDatabricksConfig();

    const url = new URL(request.url);
    const filenameHeader =
      request.headers.get("x-filename") ||
      url.searchParams.get("filename") ||
      "data.csv";
    const filename = decodeURIComponent(filenameHeader);
    const sheet =
      request.headers.get("x-sheet") ||
      url.searchParams.get("sheet") ||
      undefined;

    const ext = filename.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "tsv", "xlsx"].includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: "Format berkas tidak didukung. Harap unggah berkas .csv, .tsv, atau .xlsx.",
          suggestion: "Gunakan berkas dengan ekstensi .csv, .tsv, atau .xlsx.",
          code: "ERR_UNSUPPORTED_FORMAT",
        },
        { status: 400 }
      );
    }

    const catalog =
      request.headers.get("x-catalog") ||
      url.searchParams.get("catalog") ||
      config.defaultCatalog;
    const schema =
      request.headers.get("x-schema") ||
      url.searchParams.get("schema") ||
      config.defaultSchema;
    const volume =
      request.headers.get("x-volume") ||
      url.searchParams.get("volume") ||
      config.defaultVolume;

    const contentLength = request.headers.get("content-length");
    const maxSizeBytes = config.maxUploadSizeMb * 1024 * 1024;
    const reportedSize = contentLength ? parseInt(contentLength, 10) : 0;

    if (reportedSize > maxSizeBytes) {
      return NextResponse.json(
        {
          success: false,
          error: `Ukuran berkas melebihi batas maksimum (${config.maxUploadSizeMb} MB).`,
          suggestion: "Perkecil ukuran berkas atau naikkan batas upload pada halaman Pengaturan.",
          code: "ERR_FILE_TOO_LARGE",
        },
        { status: 413 }
      );
    }

    if (!request.body) {
      return NextResponse.json(
        {
          success: false,
          error: "Berkas kosong atau tidak berisi baris data.",
          suggestion: "Pastikan berkas CSV/TSV/XLSX memiliki baris data.",
          code: "ERR_EMPTY_BODY",
        },
        { status: 400 }
      );
    }

    const rawNodeStream = Readable.fromWeb(
      request.body as unknown as import("node:stream/web").ReadableStream
    );

    const { outputStream, getMetadata } = await normalizeFileStream(
      rawNodeStream,
      filename,
      { targetSheet: sheet }
    );

    const targetFilename = filename.toLowerCase().endsWith(".xlsx")
      ? `${filename.replace(/\.xlsx$/i, "")}.csv`
      : filename;

    const webStream = Readable.toWeb(outputStream) as unknown as ReadableStream;

    const result = await uploadToVolume(webStream, targetFilename, {
      catalog,
      schema,
      volume,
    });

    const detection = getMetadata();

    addJob({
      jobId: result.jobId,
      fileName: result.fileName,
      fileSize: reportedSize,
      volumeFilePath: result.volumeFilePath,
      fullVolumePath: result.fullVolumePath,
      catalog: result.catalog,
      schema: result.schema,
      volume: result.volume,
      createdAt: result.uploadedAt,
      status: "uploaded",
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      fileName: result.fileName,
      fileSize: reportedSize,
      volumeFilePath: result.volumeFilePath,
      fullVolumePath: result.fullVolumePath,
      catalog: result.catalog,
      schema: result.schema,
      volume: result.volume,
      uploadedAt: result.uploadedAt,
      detection,
      message: "Berkas berhasil dinormalisasi dan dialirkan ke Databricks Unity Catalog Volume.",
    });
  } catch (error) {
    if (error instanceof NormalizationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          suggestion: error.suggestion,
          code: error.code,
        },
        { status: 422 }
      );
    }

    const mapped = mapDatabricksError(error);
    return NextResponse.json(
      {
        success: false,
        error: mapped.friendlyMessageId,
        details: mapped.message,
        code: mapped.code,
        suggestion: mapped.suggestion,
      },
      { status: mapped.statusCode || 500 }
    );
  }
}
