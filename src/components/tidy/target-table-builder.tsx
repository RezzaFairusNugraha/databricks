"use client";

import * as React from "react";
import {
  TableProperties,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  Layers,
  Database,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TargetColumn, ColumnMappingItem, WriteMode } from "@/lib/cleaning/schema";
import { CsvSniffResult } from "@/lib/detector/csv-sniffer";
import { findBestColumnMatch } from "@/lib/detector/similarity";

interface TargetTableBuilderProps {
  sniffResult: CsvSniffResult | null;
  targetTableName: string;
  setTargetTableName: (name: string) => void;
  targetCatalog: string;
  setTargetCatalog: (catalog: string) => void;
  targetSchema: string;
  setTargetSchema: (schema: string) => void;
  writeMode: WriteMode;
  setWriteMode: (mode: WriteMode) => void;
  mergeKeyColumns: string[];
  setMergeKeyColumns: (keys: string[]) => void;
  targetColumns: TargetColumn[];
  setTargetColumns: React.Dispatch<React.SetStateAction<TargetColumn[]>>;
  columnMappings: ColumnMappingItem[];
  setColumnMappings: React.Dispatch<React.SetStateAction<ColumnMappingItem[]>>;
}

const DATA_TYPES = [
  "STRING",
  "INT",
  "BIGINT",
  "DECIMAL",
  "DOUBLE",
  "BOOLEAN",
  "DATE",
  "TIMESTAMP",
] as const;

export function TargetTableBuilder({
  sniffResult,
  targetTableName,
  setTargetTableName,
  targetCatalog,
  setTargetCatalog,
  targetSchema,
  setTargetSchema,
  writeMode,
  setWriteMode,
  mergeKeyColumns,
  setMergeKeyColumns,
  targetColumns,
  setTargetColumns,
  columnMappings,
  setColumnMappings,
}: TargetTableBuilderProps) {
  const [catalogsList, setCatalogsList] = React.useState<string[]>([]);
  const [schemasList, setSchemasList] = React.useState<string[]>([]);

  React.useEffect(() => {
    async function loadCatalogs() {
      try {
        const res = await fetch("/api/databricks/catalogs");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.catalogs)) {
            setCatalogsList(data.catalogs.map((c: { name: string }) => c.name));
          }
        }
      } catch {}
    }
    loadCatalogs();
  }, []);

  React.useEffect(() => {
    async function loadSchemas() {
      if (!targetCatalog) return;
      try {
        const res = await fetch(`/api/databricks/schemas?catalog=${encodeURIComponent(targetCatalog)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.schemas)) {
            setSchemasList(data.schemas.map((s: { name: string }) => s.name));
          }
        }
      } catch {}
    }
    loadSchemas();
  }, [targetCatalog]);

  const availableSourceCols = React.useMemo(() => {
    if (!sniffResult) return [];
    return sniffResult.columns.map((c) => c.rawHeader);
  }, [sniffResult]);

  const handleUseDetectedAsIs = () => {
    if (!sniffResult) return;

    const newTargetCols: TargetColumn[] = sniffResult.columns.map((c, idx) => ({
      id: `col_${idx}_${Date.now()}`,
      name: c.normalizedName,
      type: c.inferredType === "DECIMAL" ? "DECIMAL" : c.inferredType,
      nullable: c.nullCount > 0,
      description: `Imported from CSV column: ${c.rawHeader}`,
      precision: 18,
      scale: 2,
    }));

    const newMappings: ColumnMappingItem[] = sniffResult.columns.map((c) => ({
      targetColumnName: c.normalizedName,
      mapping: {
        type: "csv_column",
        sourceColumn: c.rawHeader,
      },
    }));

    setTargetColumns(newTargetCols);
    setColumnMappings(newMappings);
  };

  const handleAddColumn = () => {
    const colId = `col_${Date.now()}`;
    const defaultName = `kolom_${targetColumns.length + 1}`;

    const newCol: TargetColumn = {
      id: colId,
      name: defaultName,
      type: "STRING",
      nullable: true,
      description: "",
    };

    setTargetColumns((prev) => [...prev, newCol]);

    const match = findBestColumnMatch(defaultName, availableSourceCols);
    setColumnMappings((prev) => [
      ...prev,
      {
        targetColumnName: defaultName,
        mapping: match
          ? { type: "csv_column", sourceColumn: match.bestMatch }
          : { type: "empty" },
      },
    ]);
  };

  const handleRemoveColumn = (id: string, name: string) => {
    setTargetColumns((prev) => prev.filter((c) => c.id !== id));
    setColumnMappings((prev) => prev.filter((m) => m.targetColumnName !== name));
    setMergeKeyColumns(mergeKeyColumns.filter((k) => k !== name));
  };

  const handleMoveColumn = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= targetColumns.length) return;

    const updated = [...targetColumns];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setTargetColumns(updated);
  };

  const handleUpdateColumn = (id: string, updates: Partial<TargetColumn>) => {
    setTargetColumns((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const oldName = c.name;
          const updated = { ...c, ...updates };

          if (updates.name && updates.name !== oldName) {
            setColumnMappings((prevMaps) =>
              prevMaps.map((m) =>
                m.targetColumnName === oldName
                  ? { ...m, targetColumnName: updates.name! }
                  : m
              )
            );
            setMergeKeyColumns(
              mergeKeyColumns.map((k) => (k === oldName ? updates.name! : k))
            );
          }
          return updated;
        }
        return c;
      })
    );
  };

  const getMappingForColumn = (targetName: string): ColumnMappingItem => {
    const found = columnMappings.find((m) => m.targetColumnName === targetName);
    if (found) return found;
    return {
      targetColumnName: targetName,
      mapping: { type: "empty" },
    };
  };

  const updateMappingForColumn = (
    targetName: string,
    mappingUpdate: ColumnMappingItem["mapping"]
  ) => {
    setColumnMappings((prev) => {
      const idx = prev.findIndex((m) => m.targetColumnName === targetName);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { targetColumnName: targetName, mapping: mappingUpdate };
        return copy;
      }
      return [...prev, { targetColumnName: targetName, mapping: mappingUpdate }];
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 text-indigo-600 font-medium text-xs uppercase tracking-wider">
            <Database className="h-4 w-4" />
            Builder Tabel Target
          </div>
          <CardTitle className="text-base font-semibold text-zinc-900">
            Tujuan Penyimpanan Databricks Unity Catalog
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Katalog</Label>
              <Input
                list="tidy-catalogs-list"
                value={targetCatalog}
                onChange={(e) => setTargetCatalog(e.target.value)}
                placeholder="Pilih atau ketik katalog..."
                className="font-mono text-xs"
              />
              {catalogsList.length > 0 && (
                <datalist id="tidy-catalogs-list">
                  {catalogsList.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Skema</Label>
              <Input
                list="tidy-schemas-list"
                value={targetSchema}
                onChange={(e) => setTargetSchema(e.target.value)}
                placeholder="Pilih atau ketik skema..."
                className="font-mono text-xs"
              />
              {schemasList.length > 0 && (
                <datalist id="tidy-schemas-list">
                  {schemasList.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-indigo-600">
                Nama Tabel Target *
              </Label>
              <Input
                value={targetTableName}
                onChange={(e) => setTargetTableName(e.target.value)}
                placeholder="cleaned_sales"
                className="font-mono text-xs border-indigo-200 focus-visible:ring-indigo-600"
              />
            </div>
          </div>

          <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-200">
            <div className="space-y-1.5">
              <Label className="text-xs">Mode Penulisan</Label>
              <Select
                value={writeMode}
                onValueChange={(val) => setWriteMode(val as WriteMode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create">Buat Baru (CREATE TABLE)</SelectItem>
                  <SelectItem value="append">Tambahkan Baris (APPEND)</SelectItem>
                  <SelectItem value="overwrite">Timpa Tabel (OVERWRITE)</SelectItem>
                  <SelectItem value="merge">Gabungkan / Upsert (MERGE INTO)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {writeMode === "merge" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-amber-600">
                  Kunci Penggabungan (Merge Keys) *
                </Label>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-zinc-200 bg-zinc-50 min-h-[38px]">
                  {targetColumns.map((col) => {
                    const isKey = mergeKeyColumns.includes(col.name);
                    return (
                      <Badge
                        key={col.id}
                        variant={isKey ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => {
                          if (isKey) {
                            setMergeKeyColumns(
                              mergeKeyColumns.filter((k) => k !== col.name)
                            );
                          } else {
                            setMergeKeyColumns([...mergeKeyColumns, col.name]);
                          }
                        }}
                      >
                        {col.name}
                      </Badge>
                    );
                  })}
                  {mergeKeyColumns.length === 0 && (
                    <span className="text-xs text-zinc-400 italic">
                      Klik kolom di atas untuk dijadikan merge key
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-sm text-zinc-900 flex items-center gap-2">
            <TableProperties className="h-4 w-4 text-indigo-600" />
            Kolom Target & Pemetaan ({targetColumns.length})
          </h3>
          <p className="text-xs text-zinc-500">
            Definisikan skema tabel target dan petakan sumber kolom CSV, nilai tetap, split, atau merge.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseDetectedAsIs}
            className="gap-1.5 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Gunakan Hasil Deteksi As-Is
          </Button>
          <Button size="sm" onClick={handleAddColumn} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Tambah Kolom
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {targetColumns.map((col, idx) => {
          const mappingItem = getMappingForColumn(col.name);
          const isUnmappedRequired =
            !col.nullable &&
            (mappingItem.mapping.type === "empty" ||
              (mappingItem.mapping.type === "csv_column" &&
                !mappingItem.mapping.sourceColumn));

          const suggestion = findBestColumnMatch(col.name, availableSourceCols);

          return (
            <Card
              key={col.id}
              className={`transition-all ${
                isUnmappedRequired
                  ? "border-amber-300 bg-amber-50/20"
                  : "border-zinc-200"
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400 hover:text-zinc-700"
                      disabled={idx === 0}
                      onClick={() => handleMoveColumn(idx, "up")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400 hover:text-zinc-700"
                      disabled={idx === targetColumns.length - 1}
                      onClick={() => handleMoveColumn(idx, "down")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex-1 min-w-[160px]">
                    <Input
                      value={col.name}
                      onChange={(e) =>
                        handleUpdateColumn(col.id, { name: e.target.value })
                      }
                      placeholder="nama_kolom"
                      className="h-8 font-mono text-xs font-semibold"
                    />
                  </div>

                  <div className="w-[130px]">
                    <Select
                      value={col.type}
                      onValueChange={(val) =>
                        handleUpdateColumn(col.id, {
                          type: val as TargetColumn["type"],
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATA_TYPES.map((dt) => (
                          <SelectItem key={dt} value={dt} className="text-xs font-mono">
                            {dt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {col.type === "DECIMAL" && (
                    <div className="flex items-center gap-1 text-xs">
                      <Input
                        type="number"
                        min={1}
                        max={38}
                        value={col.precision || 18}
                        onChange={(e) =>
                          handleUpdateColumn(col.id, {
                            precision: parseInt(e.target.value, 10) || 18,
                          })
                        }
                        className="h-8 w-14 text-xs font-mono"
                        title="Precision"
                      />
                      <span>,</span>
                      <Input
                        type="number"
                        min={0}
                        max={38}
                        value={col.scale || 2}
                        onChange={(e) =>
                          handleUpdateColumn(col.id, {
                            scale: parseInt(e.target.value, 10) || 2,
                          })
                        }
                        className="h-8 w-14 text-xs font-mono"
                        title="Scale"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pl-2">
                    <Switch
                      checked={col.nullable}
                      onCheckedChange={(checked) =>
                        handleUpdateColumn(col.id, { nullable: checked })
                      }
                      id={`null_${col.id}`}
                    />
                    <Label
                      htmlFor={`null_${col.id}`}
                      className="text-xs cursor-pointer select-none text-zinc-500"
                    >
                      {col.nullable ? "Nullable" : "Wajib (NOT NULL)"}
                    </Label>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 ml-auto"
                    onClick={() => handleRemoveColumn(col.id, col.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5 flex flex-wrap items-center gap-3">
                  <span className="text-xs font-medium text-zinc-600 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                    Sumber Pemetaan:
                  </span>

                  <div className="w-[160px]">
                    <Select
                      value={mappingItem.mapping.type}
                      onValueChange={(val) => {
                        const mType = val as ColumnMappingItem["mapping"]["type"];
                        if (mType === "csv_column") {
                          const best = suggestion?.bestMatch || availableSourceCols[0] || "";
                          updateMappingForColumn(col.name, {
                            type: "csv_column",
                            sourceColumn: best,
                          });
                        } else if (mType === "constant") {
                          updateMappingForColumn(col.name, {
                            type: "constant",
                            value: "",
                          });
                        } else if (mType === "empty") {
                          updateMappingForColumn(col.name, { type: "empty" });
                        } else if (mType === "split") {
                          updateMappingForColumn(col.name, {
                            type: "split",
                            sourceColumn: availableSourceCols[0] || "",
                            delimiter: " ",
                            partIndex: 1,
                          });
                        } else if (mType === "merge") {
                          updateMappingForColumn(col.name, {
                            type: "merge",
                            sourceColumns: availableSourceCols.slice(0, 2),
                            separator: ", ",
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv_column">Kolom CSV</SelectItem>
                        <SelectItem value="constant">Nilai Tetap (Konstan)</SelectItem>
                        <SelectItem value="split">Pisahkan (Split)</SelectItem>
                        <SelectItem value="merge">Gabungkan (Merge)</SelectItem>
                        <SelectItem value="empty">Kosongkan (NULL)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {mappingItem.mapping.type === "csv_column" && (
                    <div className="flex items-center gap-2 flex-1">
                      <Select
                        value={mappingItem.mapping.sourceColumn}
                        onValueChange={(src) =>
                          updateMappingForColumn(col.name, {
                            type: "csv_column",
                            sourceColumn: src,
                          })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs font-mono max-w-[240px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSourceCols.map((src) => (
                            <SelectItem key={src} value={src} className="text-xs font-mono">
                              {src}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {suggestion && suggestion.bestMatch !== mappingItem.mapping.sourceColumn && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 gap-1"
                          onClick={() =>
                            updateMappingForColumn(col.name, {
                              type: "csv_column",
                              sourceColumn: suggestion.bestMatch,
                            })
                          }
                        >
                          <Sparkles className="h-3 w-3" />
                          Saran: {suggestion.bestMatch} ({Math.round(suggestion.score * 100)}%)
                        </Button>
                      )}
                    </div>
                  )}

                  {mappingItem.mapping.type === "constant" && (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={mappingItem.mapping.value}
                        onChange={(e) =>
                          updateMappingForColumn(col.name, {
                            type: "constant",
                            value: e.target.value,
                          })
                        }
                        placeholder="Contoh: ID, ACTIVE, 0"
                        className="h-7 text-xs font-mono max-w-[240px]"
                      />
                    </div>
                  )}

                  {mappingItem.mapping.type === "split" && (() => {
                    const splitM = mappingItem.mapping;
                    return (
                      <div className="flex items-center gap-2 flex-wrap flex-1 text-xs">
                        <Select
                          value={splitM.sourceColumn}
                          onValueChange={(src) =>
                            updateMappingForColumn(col.name, {
                              type: "split",
                              sourceColumn: src,
                              delimiter: splitM.delimiter,
                              partIndex: splitM.partIndex,
                            })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs font-mono max-w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSourceCols.map((src) => (
                              <SelectItem key={src} value={src} className="text-xs font-mono">
                                {src}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <span className="text-zinc-500">Pemisah:</span>
                        <Input
                          value={splitM.delimiter}
                          onChange={(e) =>
                            updateMappingForColumn(col.name, {
                              type: "split",
                              sourceColumn: splitM.sourceColumn,
                              delimiter: e.target.value || " ",
                              partIndex: splitM.partIndex,
                            })
                          }
                          className="h-7 w-12 text-center text-xs font-mono"
                        />

                        <span className="text-zinc-500">Bagian ke-</span>
                        <Input
                          type="number"
                          min={1}
                          value={splitM.partIndex}
                          onChange={(e) =>
                            updateMappingForColumn(col.name, {
                              type: "split",
                              sourceColumn: splitM.sourceColumn,
                              delimiter: splitM.delimiter,
                              partIndex: parseInt(e.target.value, 10) || 1,
                            })
                          }
                          className="h-7 w-14 text-center text-xs font-mono"
                        />
                      </div>
                    );
                  })()}

                  {mappingItem.mapping.type === "merge" && (() => {
                    const mergeM = mappingItem.mapping;
                    return (
                      <div className="flex items-center gap-2 flex-wrap flex-1 text-xs">
                        <div className="flex flex-wrap gap-1 max-w-[320px]">
                          {availableSourceCols.map((src) => {
                            const isSelected = mergeM.sourceColumns.includes(src);
                            return (
                              <Badge
                                key={src}
                                variant={isSelected ? "default" : "outline"}
                                className="cursor-pointer text-xs font-mono"
                                onClick={() => {
                                  const newCols = isSelected
                                    ? mergeM.sourceColumns.filter((c) => c !== src)
                                    : [...mergeM.sourceColumns, src];
                                  updateMappingForColumn(col.name, {
                                    type: "merge",
                                    sourceColumns: newCols,
                                    separator: mergeM.separator,
                                  });
                                }}
                              >
                                {src}
                              </Badge>
                            );
                          })}
                        </div>

                        <span className="text-zinc-500">Pemisah Teks:</span>
                        <Input
                          value={mergeM.separator}
                          onChange={(e) =>
                            updateMappingForColumn(col.name, {
                              type: "merge",
                              sourceColumns: mergeM.sourceColumns,
                              separator: e.target.value,
                            })
                          }
                          className="h-7 w-16 text-center text-xs font-mono"
                        />
                      </div>
                    );
                  })()}

                  {mappingItem.mapping.type === "empty" && (
                    <Badge variant="secondary" className="text-xs font-mono text-zinc-500">
                      NULL
                    </Badge>
                  )}

                  {isUnmappedRequired && (
                    <Badge
                      variant="destructive"
                      className="ml-auto text-xs font-normal gap-1 bg-amber-100 text-amber-800 border-amber-200"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Kolom wajib ini belum dipetakan!
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
