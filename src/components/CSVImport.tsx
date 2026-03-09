import { useRef, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileSpreadsheet, X, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { parseCSV, downloadTemplate } from '@/lib/csv';
import { read, utils, WorkBook } from 'xlsx';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface ImportResult {
  success: number;
  errors: string[];
}

interface FieldDef {
  name: string;
  required?: boolean;
  defaultValue?: string;
}

interface CSVImportProps {
  label: string;
  templateFilename: string;
  templateHeaders: string[];
  templateSampleRows: string[][];
  fields: FieldDef[];
  onImport: (rows: string[][]) => ImportResult;
  expectedColumns: string;
  extraOptions?: React.ReactNode;
}

interface ExcelPreview {
  workbook: WorkBook;
  sheetNames: string[];
  selectedSheet: string;
  allRows: string[][];
  startRow: number;
  endRow: number;
  hasHeader: boolean;
  columnMap: (number | -1)[]; // maps each expected field to a file column index (-1 = skip)
}

const SKIP = -1;

export default function CSVImport({ label, templateFilename, templateHeaders, templateSampleRows, fields, onImport, expectedColumns, extraOptions }: CSVImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [show, setShow] = useState(false);
  const [preview, setPreview] = useState<ExcelPreview | null>(null);

  // Auto-detect column mapping by matching header names
  const autoMapColumns = (headerRow: string[], expectedHeaders: string[]): (number | -1)[] => {
    return expectedHeaders.map(expected => {
      const norm = expected.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = headerRow.findIndex(h => {
        const hNorm = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        return hNorm === norm || hNorm.includes(norm) || norm.includes(hNorm);
      });
      return idx >= 0 ? idx : SKIP;
    });
  };

  const loadSheet = (workbook: WorkBook, sheetName: string, prev?: Partial<ExcelPreview>): ExcelPreview => {
    const sheet = workbook.Sheets[sheetName];
    const allRows: string[][] = utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
      .map(row => row.map(cell => String(cell ?? '').trim()));
    const hasHeader = prev?.hasHeader ?? true;
    const columnMap = hasHeader && allRows.length > 0
      ? autoMapColumns(allRows[0], templateHeaders)
      : templateHeaders.map((_, i) => i < (allRows[0]?.length ?? 0) ? i : SKIP);
    return {
      workbook,
      sheetNames: workbook.SheetNames,
      selectedSheet: sheetName,
      allRows,
      startRow: prev?.startRow ?? 1,
      endRow: prev?.endRow ?? allRows.length,
      hasHeader,
      columnMap: prev?.columnMap ?? columnMap,
    };
  };

  // Get file column headers (letters or header text)
  const fileColumns = useMemo(() => {
    if (!preview || preview.allRows.length === 0) return [];
    const firstRow = preview.allRows[Math.max(0, preview.startRow - 1)];
    if (!firstRow) return [];
    if (preview.hasHeader) {
      return firstRow.map((h, i) => h || `Column ${String.fromCharCode(65 + i)}`);
    }
    return firstRow.map((_, i) => `Column ${String.fromCharCode(65 + Math.min(i, 25))}`);
  }, [preview]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    const isExcel = /\.xlsx?$/i.test(file.name);

    if (isExcel) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = read(buffer, { type: 'array' });
        setPreview(loadSheet(workbook, workbook.SheetNames[0]));
      } catch {
        setResult({ success: 0, errors: ['Failed to parse Excel file.'] });
        if (fileRef.current) fileRef.current.value = '';
      }
      return;
    }

    // CSV — import directly
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) {
        setResult({ success: 0, errors: ['File is empty or has no data rows'] });
      } else {
        const dataRows = rows.slice(1).filter(r => r.some(cell => cell.length > 0));
        setResult(onImport(dataRows));
      }
    } catch {
      setResult({ success: 0, errors: ['Failed to parse CSV file.'] });
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSheetChange = (sheetName: string) => {
    if (!preview) return;
    setPreview(loadSheet(preview.workbook, sheetName, { hasHeader: preview.hasHeader }));
  };

  const handleColumnChange = (fieldIndex: number, colIndex: number) => {
    if (!preview) return;
    const newMap = [...preview.columnMap];
    newMap[fieldIndex] = colIndex;
    setPreview({ ...preview, columnMap: newMap });
  };

  const handleImportExcel = () => {
    if (!preview) return;

    const start = Math.max(0, preview.startRow - 1);
    const end = Math.min(preview.allRows.length, preview.endRow);
    let sliced = preview.allRows.slice(start, end);

    if (preview.hasHeader && sliced.length > 0) {
      sliced = sliced.slice(1);
    }

    // Remap columns based on user selection
    const remapped = sliced
      .filter(r => r.some(cell => cell.length > 0))
      .map(row => preview.columnMap.map(ci => (ci === SKIP ? '' : (row[ci] ?? ''))));

    if (remapped.length === 0) {
      setResult({ success: 0, errors: ['No data rows in selected range'] });
      return;
    }

    setResult(onImport(remapped));
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const previewRows = preview
    ? preview.allRows.slice(
        Math.max(0, preview.startRow - 1),
        Math.min(preview.allRows.length, preview.endRow)
      )
    : [];

  const maxCols = preview ? Math.max(...preview.allRows.slice(0, 20).map(r => r.length), 0) : 0;

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => { setShow(!show); setPreview(null); setResult(null); }}>
        <Upload size={14} /> Import
      </Button>

      {show && (
        <div className="glass-card rounded-xl p-4 space-y-3 border border-border">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileSpreadsheet size={16} /> Import {label} from CSV / Excel
            </h4>
            <Button variant="ghost" size="sm" onClick={() => { setShow(false); setResult(null); setPreview(null); }} className="h-7 w-7 p-0">
              <X size={14} />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Supports <span className="font-medium text-foreground/80">.csv</span> and <span className="font-medium text-foreground/80">.xlsx</span> files. Expected columns: <span className="font-mono text-foreground/80">{expectedColumns}</span>
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={handleFile}
              className="block w-full max-w-xs text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
            />
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => downloadTemplate(templateFilename, templateHeaders, templateSampleRows)}>
              <Download size={12} /> Download CSV Template
            </Button>
          </div>

          {extraOptions}

          {/* Excel Import Options */}
          {preview && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-3">
              <h5 className="text-xs font-semibold text-foreground uppercase tracking-wide">Excel Import Options</h5>

              {/* Sheet selector */}
              {preview.sheetNames.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Select Sheet</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.sheetNames.map(name => (
                      <button
                        key={name}
                        onClick={() => handleSheetChange(name)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          preview.selectedSheet === name
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background border border-input hover:bg-muted'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Row range & header */}
              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Start Row</Label>
                  <Input
                    type="number" min={1} max={preview.allRows.length}
                    value={preview.startRow}
                    onChange={e => setPreview({ ...preview, startRow: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-20 h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">End Row</Label>
                  <Input
                    type="number" min={1} max={preview.allRows.length}
                    value={preview.endRow}
                    onChange={e => setPreview({ ...preview, endRow: Math.min(preview.allRows.length, parseInt(e.target.value) || preview.allRows.length) })}
                    className="w-20 h-8 text-xs"
                  />
                </div>
                <p className="text-xs text-muted-foreground pb-1.5">of {preview.allRows.length} total rows</p>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasHeader"
                  checked={preview.hasHeader}
                  onCheckedChange={v => {
                    const hasHeader = !!v;
                    const columnMap = hasHeader && preview.allRows.length > 0
                      ? autoMapColumns(preview.allRows[Math.max(0, preview.startRow - 1)], templateHeaders)
                      : templateHeaders.map((_, i) => i < maxCols ? i : SKIP);
                    setPreview({ ...preview, hasHeader, columnMap });
                  }}
                />
                <label htmlFor="hasHeader" className="text-xs text-muted-foreground cursor-pointer">
                  First row is a header (skip it)
                </label>
              </div>

              {/* Column Mapping */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Column Mapping</Label>
                <p className="text-xs text-muted-foreground">Map fields to columns in your file. Optional fields use defaults when skipped.</p>
                <div className="grid gap-2">
                  {fields.map((field, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground w-28 shrink-0">
                        {field.name}
                        {field.required !== false ? (
                          <span className="text-destructive ml-0.5">*</span>
                        ) : (
                          <span className="text-muted-foreground/60 ml-1 font-normal">(optional)</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <select
                        value={preview.columnMap[fi] ?? SKIP}
                        onChange={e => handleColumnChange(fi, parseInt(e.target.value))}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs flex-1 max-w-[200px]"
                      >
                        <option value={SKIP}>
                          {field.defaultValue ? `— Skip (default: ${field.defaultValue}) —` : '— Skip —'}
                        </option>
                        {Array.from({ length: maxCols }, (_, ci) => (
                          <option key={ci} value={ci}>
                            {preview.hasHeader ? fileColumns[ci] ?? `Col ${ci + 1}` : `Column ${String.fromCharCode(65 + Math.min(ci, 25))}${ci > 25 ? ci - 25 : ''}`}
                          </option>
                        ))}
                      </select>
                      {preview.columnMap[fi] !== SKIP && preview.columnMap[fi] !== undefined && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[120px]">
                          e.g. "{previewRows[preview.hasHeader ? 1 : 0]?.[preview.columnMap[fi]] ?? ''}"
                        </span>
                      )}
                      {preview.columnMap[fi] === SKIP && field.defaultValue && (
                        <span className="text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded">
                          default: {field.defaultValue}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Data preview */}
              {previewRows.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{previewRows.length} rows selected{preview.hasHeader ? ' (first row = header)' : ''}</p>
                  <div className="overflow-auto rounded border border-border bg-background max-h-48">
                    <table className="text-xs w-full">
                      <thead className="sticky top-0 bg-muted/80">
                        <tr>
                          <th className="px-2 py-1 text-right w-8 border-r border-border/50 text-muted-foreground/50">#</th>
                          {preview.columnMap.map((ci, fi) => (
                            <th key={fi} className="px-2 py-1 text-left font-semibold text-primary whitespace-nowrap">
                              {templateHeaders[fi]}
                              {ci === SKIP && <span className="text-destructive ml-1">(skipped)</span>}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(preview.hasHeader ? 1 : 0).map((row, ri) => (
                          <tr key={ri} className="border-b border-border/50">
                            <td className="px-2 py-1 text-muted-foreground/50 text-right w-8 border-r border-border/50">
                              {preview.startRow + ri + (preview.hasHeader ? 1 : 0)}
                            </td>
                            {preview.columnMap.map((ci, fi) => (
                              <td key={fi} className={`px-2 py-1 whitespace-nowrap max-w-[150px] truncate ${ci === SKIP ? 'text-muted-foreground/30' : ''}`}>
                                {ci === SKIP ? '—' : (row[ci] || <span className="text-muted-foreground/30">—</span>)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <Button size="sm" onClick={handleImportExcel} className="gap-2">
                <ChevronRight size={14} /> Import Selected Data
              </Button>
            </div>
          )}

          {result && (
            <div className={`rounded-lg p-3 text-sm ${result.errors.length > 0 ? 'bg-destructive/5 border border-destructive/20' : 'bg-success/5 border border-success/20'}`}>
              {result.success > 0 && (
                <div className="flex items-center gap-2 text-success mb-1">
                  <CheckCircle2 size={14} /> Imported {result.success} {label.toLowerCase()} successfully
                </div>
              )}
              {result.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-destructive text-xs">
                  <AlertTriangle size={12} className="shrink-0" /> {err}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
