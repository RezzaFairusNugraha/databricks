import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import ExcelJS from "exceljs";
import { normalizeFileStream } from "../stream-normalizer";

async function streamToString(readable: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("Stream Normalizer for Messy Files", () => {
  it("normalizes samples/09_06-Data.csv with quote stripping, header resolving, and flat streaming", async () => {
    let filePath = path.join(process.cwd(), "samples", "09_06-Data.csv");
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), "samples", "09.06-Data.csv");
    }

    const fileStream = fs.createReadStream(filePath);
    const { outputStream, getMetadata } = await normalizeFileStream(
      fileStream,
      "09_06-Data.csv"
    );

    let lineCount = 0;
    let headerLine = "";
    let buffer = "";

    for await (const chunk of outputStream) {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        if (lineCount === 0) {
          headerLine = line;
        }
        lineCount++;
      }
    }

    if (buffer.trim()) {
      lineCount++;
    }

    const metadata = getMetadata();
    const dataRows = lineCount - 1;

    expect(metadata.columnCount).toBe(26);
    expect(metadata.columns[0]).toBe("id");
    expect(metadata.columns[metadata.columns.length - 1]).toBe("state");
    expect(dataRows).toBe(30000);
    expect(metadata.rowCount).toBe(30000);
    expect(metadata.fixesApplied.length).toBeGreaterThan(0);

    const headersFromStream = headerLine.split(",");
    expect(headersFromStream[0]).toBe("id");
    expect(headersFromStream[headersFromStream.length - 1]).toBe("state");
  });

  it("normalizes semicolon separated Indonesian sales file skipping junk and totals", async () => {
    const filePath = path.join(
      process.cwd(),
      "samples",
      "indonesian_sales_messy.csv"
    );
    const fileStream = fs.createReadStream(filePath);
    const { outputStream, getMetadata } = await normalizeFileStream(
      fileStream,
      "indonesian_sales_messy.csv"
    );

    const resultCsv = await streamToString(outputStream);
    const lines = resultCsv.split("\n").filter((l) => l.trim().length > 0);
    const metadata = getMetadata();

    expect(metadata.delimiter).toBe(";");
    expect(lines[0]).toContain("id_transaksi,nama_pelanggan,tanggal_transaksi");
    expect(lines.length).toBe(13);
    expect(metadata.rowCount).toBe(12);

    for (let i = 1; i < lines.length; i++) {
      expect(lines[i]).not.toContain("LAPORAN PENJUALAN");
      expect(lines[i]).not.toContain("TOTAL KESELURUHAN");
    }
  });

  it("normalizes Latin-1 ecommerce file and decodes special characters to clean UTF-8", async () => {
    const filePath = path.join(
      process.cwd(),
      "samples",
      "ecommerce_orders_latin1.csv"
    );
    const fileStream = fs.createReadStream(filePath);
    const { outputStream, getMetadata } = await normalizeFileStream(
      fileStream,
      "ecommerce_orders_latin1.csv"
    );

    const resultCsv = await streamToString(outputStream);
    const lines = resultCsv.split("\n").filter((l) => l.trim().length > 0);
    const metadata = getMetadata();

    expect(["Latin-1", "Windows-1252"]).toContain(metadata.encoding);
    expect(resultCsv).toContain("François Dupont");
    expect(resultCsv).toContain("München");
    expect(resultCsv).toContain("Bogotá");
    expect(resultCsv).toContain("São Paulo");
    expect(resultCsv).toContain("Zoë Martin");
    expect(lines.length).toBe(8);
    expect(metadata.rowCount).toBe(7);
  });

  it("normalizes XLSX workbook on the fly to clean CSV stream", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Data Penjualan");

    ws.addRow(["Report Title Generated Automatically"]);
    ws.addRow(["ID Pelanggan", "Nama Lengkap", "Nilai Transaksi", "Status"]);
    ws.addRow([101, "Budi Santoso", 250000, "SUKSES"]);
    ws.addRow([102, "Dewi Sartika", 750000, "SUKSES"]);
    ws.addRow([103, "Ahmad Yani", 120000, "PENDING"]);
    ws.addRow(["Total Transaksi", "", 1120000, ""]);

    const xlsxBuffer = await wb.xlsx.writeBuffer();
    const xlsxStream = Readable.from(Buffer.from(xlsxBuffer));

    const { outputStream, getMetadata } = await normalizeFileStream(
      xlsxStream,
      "penjualan.xlsx"
    );

    const resultCsv = await streamToString(outputStream);
    const lines = resultCsv.split("\n").filter((l) => l.trim().length > 0);
    const metadata = getMetadata();

    expect(metadata.columnCount).toBe(4);
    expect(metadata.columns).toEqual([
      "id_pelanggan",
      "nama_lengkap",
      "nilai_transaksi",
      "status",
    ]);
    expect(metadata.rowCount).toBe(3);
    expect(lines[0]).toBe("id_pelanggan,nama_lengkap,nilai_transaksi,status");
    expect(lines[1]).toContain("101,Budi Santoso,250000,SUKSES");
  });
});
