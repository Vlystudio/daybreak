"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { importHealthMetrics, type ImportRow } from "@/actions/health-import";

// Flexible header aliases → health_metrics fields.
const COLUMN_MAP: Record<string, keyof ImportRow> = {
  date: "date", day: "date",
  steps: "steps", step_count: "steps",
  resting_hr: "resting_hr", resting_heart_rate: "resting_hr", rhr: "resting_hr",
  hrv: "hrv_avg", hrv_avg: "hrv_avg", heart_rate_variability: "hrv_avg",
  sleep_minutes: "sleep_duration_min", sleep_duration_min: "sleep_duration_min", asleep_minutes: "sleep_duration_min", time_asleep_min: "sleep_duration_min",
  sleep_score: "sleep_score",
  readiness: "readiness_score", readiness_score: "readiness_score",
  active_calories: "active_calories", active_energy: "active_calories", active_calories_kcal: "active_calories",
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s/()-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/** Minimal CSV line splitter that respects double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => COLUMN_MAP[normHeader(h)]);
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row = {} as Record<string, string | number | null>;
    headers.forEach((field, idx) => {
      if (!field) return;
      const raw = (cells[idx] ?? "").trim();
      if (field === "date") {
        // Accept YYYY-MM-DD or anything Date can parse → normalize.
        const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : isNaN(Date.parse(raw)) ? "" : new Date(raw).toISOString().slice(0, 10);
        if (d) row.date = d;
      } else if (raw !== "") {
        const n = parseFloat(raw);
        if (isFinite(n)) row[field] = n;
      }
    });
    if (row.date) rows.push(row as ImportRow);
  }
  return rows;
}

export function HealthImportCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("Couldn't find a date column and metrics in that CSV.");
        return;
      }
      startTransition(async () => {
        const result = await importHealthMetrics(rows);
        if (result.ok) toast.success(`Imported ${result.imported} day${result.imported === 1 ? "" : "s"} of data.`);
        else toast.error(result.error);
      });
    } catch {
      toast.error("Couldn't read that file.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUp className="h-4 w-4 text-sky" aria-hidden />
          Import health data
        </CardTitle>
        <CardDescription>From Apple Health, Health Connect, Garmin, or any CSV export</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden />
          {pending ? "Importing…" : "Upload CSV"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {fileName ? `Last file: ${fileName}. ` : ""}
          Recognized columns: <span className="font-medium">date</span>, steps, resting_hr, hrv, sleep_minutes,
          sleep_score, readiness, active_calories. A <span className="font-medium">date</span> column is required;
          include whichever metrics you have.
        </p>
      </CardContent>
    </Card>
  );
}
