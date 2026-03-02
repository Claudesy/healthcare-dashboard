import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

// ── Types ────────────────────────────────────────────────────────────────────

interface Encounter {
  keluhanUtama: string;
  keluhanTambahan?: string;
  usia?: number;
  jenisKelamin?: "L" | "P";
  vitals?: {
    sbp?: number; dbp?: number; hr?: number; rr?: number;
    temp?: number; spo2?: number; gcs?: number; glucose?: number;
  };
  chronic_diseases?: string[];
  allergies?: string[];
}

interface Disease {
  id: string;
  nama: string;
  icd10: string;
  gejala?: string[];
  gejala_klinis?: string[];
  pemeriksaan_fisik?: string[];
  diagnosis_banding?: string[];
  red_flags?: string[];
  terapi?: Array<{ obat: string; dosis: string; frek: string }>;
  kriteria_rujukan?: string[];
  kompetensi?: string;
}

interface CDSSResult {
  suggestions: Array<{
    rank: number;
    icd10: string;
    nama: string;
    confidence: number;
    rationale: string;
    red_flags: string[];
    recommended_actions: string[];
  }>;
  red_flags: Array<{
    severity: "emergency" | "urgent" | "warning";
    condition: string;
    action: string;
    criteria_met: string[];
  }>;
  traffic_light: "GREEN" | "YELLOW" | "RED";
  traffic_light_reason: string;
  processing_time_ms: number;
  source: "ai" | "local";
}

// ── Data Loading ──────────────────────────────────────────────────────────────

let penyakitData: Disease[] | null = null;

function loadPenyakit(): Disease[] {
  if (penyakitData) return penyakitData;
  const filePath = path.join(process.cwd(), "public", "data", "penyakit.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { penyakit?: Disease[] } | Disease[];
  penyakitData = Array.isArray(parsed) ? parsed : (parsed as { penyakit?: Disease[] }).penyakit ?? [];
  return penyakitData;
}

// ── Symptom Matching (IDF-based) ──────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(s => s.length > 2);
}

function getDiseaseSymptoms(disease: Disease): string[] {
  return [
    ...(disease.gejala_klinis ?? []),
    ...(disease.gejala ?? []),
    ...(disease.pemeriksaan_fisik ?? []),
  ];
}

function matchSymptoms(encounter: Encounter, diseases: Disease[]): Array<{ disease: Disease; score: number; matchedSymptoms: string[] }> {
  const inputTokens = new Set([
    ...tokenize(encounter.keluhanUtama),
    ...tokenize(encounter.keluhanTambahan ?? ""),
  ]);

  // IDF: hitung berapa penyakit yang punya tiap gejala
  const symptomDocFreq = new Map<string, number>();
  for (const d of diseases) {
    const allSymptoms = getDiseaseSymptoms(d);
    const tokens = new Set(allSymptoms.flatMap(g => tokenize(g)));
    for (const t of tokens) {
      symptomDocFreq.set(t, (symptomDocFreq.get(t) ?? 0) + 1);
    }
  }

  const N = diseases.length;
  const idf = (token: string) => 1 + Math.log(N / ((symptomDocFreq.get(token) ?? 0) + 1));

  const scored = diseases.map(disease => {
    const allSymptoms = getDiseaseSymptoms(disease);
    const diseaseTokens = new Set(allSymptoms.flatMap(g => tokenize(g)));
    const matchedTokens = [...inputTokens].filter(t => diseaseTokens.has(t));
    const matchedSymptoms = allSymptoms.filter(g =>
      tokenize(g).some(t => inputTokens.has(t))
    );

    // IDF score
    const idfScore = matchedTokens.reduce((sum, t) => sum + idf(t), 0) /
      Math.max([...inputTokens].reduce((sum, t) => sum + idf(t), 0), 1);

    // Coverage score
    const coverageScore = matchedSymptoms.length / Math.max(allSymptoms.length, 1);

    // Jaccard
    const union = new Set([...inputTokens, ...diseaseTokens]);
    const intersection = [...inputTokens].filter(t => diseaseTokens.has(t));
    const jaccardScore = intersection.length / Math.max(union.size, 1);

    const score = idfScore * 0.5 + coverageScore * 0.3 + jaccardScore * 0.2;

    return { disease, score, matchedSymptoms };
  });

  return scored
    .filter(s => s.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ── Red Flag Detection ────────────────────────────────────────────────────────

function detectRedFlags(encounter: Encounter): CDSSResult["red_flags"] {
  const flags: CDSSResult["red_flags"] = [];
  const v = encounter.vitals ?? {};
  const ku = (encounter.keluhanUtama + " " + (encounter.keluhanTambahan ?? "")).toLowerCase();

  // Sepsis (qSOFA)
  let qsofa = 0;
  const criteria: string[] = [];
  if (v.rr && v.rr >= 22) { qsofa++; criteria.push(`RR=${v.rr} (≥22)`); }
  if (v.sbp && v.sbp <= 100) { qsofa++; criteria.push(`SBP=${v.sbp} (≤100)`); }
  if (ku.includes("bingung") || ku.includes("penurunan kesadaran")) { qsofa++; criteria.push("Penurunan kesadaran"); }
  if (qsofa >= 2) {
    flags.push({ severity: "emergency", condition: "Suspek Sepsis (qSOFA≥2)", action: "Kultur darah, antibiotik empiris segera, pertimbangkan rujuk ICU", criteria_met: criteria });
  }

  // ACS
  const acsKw = ["nyeri dada", "sesak napas", "keringat dingin", "jantung berdebar"];
  const acsMatches = acsKw.filter(k => ku.includes(k));
  if (acsMatches.length >= 2 && (v.hr && v.hr > 100 || v.spo2 && v.spo2 < 95)) {
    flags.push({ severity: "emergency", condition: "Suspek Acute Coronary Syndrome (ACS)", action: "EKG segera, troponin, Aspirin, rujuk RS", criteria_met: [...acsMatches, v.hr ? `HR=${v.hr}` : "", v.spo2 ? `SpO2=${v.spo2}%` : ""].filter(Boolean) });
  }

  // Stroke (FAST)
  const fastKw = ["wajah mencong", "kelemahan lengan", "pelo", "bicara tidak jelas", "sakit kepala hebat"];
  const fastMatches = fastKw.filter(k => ku.includes(k));
  if (fastMatches.length >= 2) {
    flags.push({ severity: "emergency", condition: "Suspek Stroke (kriteria FAST)", action: "CT-scan kepala segera, rujuk RS stroke center", criteria_met: fastMatches });
  }

  // Hipoglikemia
  if (v.glucose && v.glucose < 70) {
    flags.push({ severity: "urgent", condition: `Hipoglikemia (GDS=${v.glucose})`, action: "Dextrose 40% IV bolus, monitor GDS tiap 15 menit", criteria_met: [`GDS=${v.glucose} mg/dL`] });
  }

  // Preeklampsia
  if (encounter.jenisKelamin === "P" && v.sbp && v.sbp >= 140 && ku.includes("hamil")) {
    flags.push({ severity: "emergency", condition: "Suspek Preeklampsia", action: "MgSO4, antihipertensi, rujuk segera", criteria_met: [`SBP=${v.sbp}`, "Riwayat hamil"] });
  }

  return flags;
}

// ── Traffic Light ─────────────────────────────────────────────────────────────

function classifyTrafficLight(
  candidates: Array<{ disease: Disease; score: number }>,
  redFlags: CDSSResult["red_flags"],
  encounter: Encounter
): { level: CDSSResult["traffic_light"]; reason: string } {
  if (redFlags.some(f => f.severity === "emergency")) {
    return { level: "RED", reason: `Red flag emergency: ${redFlags.find(f => f.severity === "emergency")!.condition}` };
  }
  if (redFlags.some(f => f.severity === "urgent")) {
    return { level: "YELLOW", reason: `Red flag urgent: ${redFlags.find(f => f.severity === "urgent")!.condition}` };
  }
  const age = encounter.usia ?? 0;
  if (age < 2 || age > 70) {
    return { level: "YELLOW", reason: `Usia risiko tinggi: ${age} tahun` };
  }
  const topScore = candidates[0]?.score ?? 0;
  if (topScore < 0.15) {
    return { level: "YELLOW", reason: "Confidence rendah — diagnosis tidak pasti" };
  }
  if (candidates[0]?.disease.kriteria_rujukan?.length) {
    return { level: "YELLOW", reason: "Perlu evaluasi kriteria rujukan" };
  }
  return { level: "GREEN", reason: "Klinis stabil, tata laksana di FKTP" };
}

// ── LLM Reasoning via Gemini ──────────────────────────────────────────────────

async function enrichWithGemini(
  encounter: Encounter,
  candidates: Array<{ disease: Disease; score: number; matchedSymptoms: string[] }>
): Promise<{ suggestions: CDSSResult["suggestions"]; source: "ai" | "local" }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || candidates.length === 0) {
    return {
      source: "local",
      suggestions: candidates.map((c, i) => ({
        rank: i + 1,
        icd10: c.disease.icd10,
        nama: c.disease.nama,
        confidence: Math.min(c.score, 0.95),
        rationale: `Matched ${c.matchedSymptoms.length} gejala: ${c.matchedSymptoms.slice(0, 3).join(", ")}`,
        red_flags: c.disease.red_flags ?? [],
        recommended_actions: c.disease.terapi?.slice(0, 2).map(t => `${t.obat} ${t.dosis} ${t.frek}`) ?? [],
      })),
    };
  }

  try {
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });

    const candidateList = candidates.map((c, i) =>
      `${i + 1}. ${c.disease.nama} (${c.disease.icd10}) — score: ${c.score.toFixed(2)}, matched: ${c.matchedSymptoms.slice(0, 3).join(", ")}`
    ).join("\n");

    const prompt = `Kamu adalah sistem CDSS klinis untuk dokter di Puskesmas Indonesia.

Pasien:
- Keluhan utama: ${encounter.keluhanUtama}
- Keluhan tambahan: ${encounter.keluhanTambahan ?? "-"}
- Usia: ${encounter.usia ?? "tidak diketahui"} tahun, Jenis kelamin: ${encounter.jenisKelamin === "L" ? "Laki-laki" : encounter.jenisKelamin === "P" ? "Perempuan" : "tidak diketahui"}
- Vitals: ${JSON.stringify(encounter.vitals ?? {})}
- Komorbid: ${encounter.chronic_diseases?.join(", ") ?? "-"}

5 kandidat diagnosis dari knowledge base:
${candidateList}

Tugas: Ranking ulang kandidat di atas berdasarkan konteks klinis. HANYA pilih dari kandidat yang tersedia, jangan tambah diagnosis baru.

Balas dalam JSON dengan format PERSIS seperti ini (tanpa markdown, langsung JSON):
{
  "suggestions": [
    {
      "rank": 1,
      "icd10": "kode ICD-10",
      "nama": "nama diagnosis",
      "confidence": 0.0-1.0,
      "rationale": "alasan klinis singkat dalam bahasa Indonesia",
      "red_flags": ["red flag jika ada"],
      "recommended_actions": ["tindakan 1", "tindakan 2"]
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonStr = text.startsWith("{") ? text : text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonStr) as { suggestions: CDSSResult["suggestions"] };
    return { suggestions: parsed.suggestions, source: "ai" };
  } catch {
    return {
      source: "local",
      suggestions: candidates.map((c, i) => ({
        rank: i + 1,
        icd10: c.disease.icd10,
        nama: c.disease.nama,
        confidence: Math.min(c.score, 0.95),
        rationale: `Matched ${c.matchedSymptoms.length} gejala: ${c.matchedSymptoms.slice(0, 3).join(", ")}`,
        red_flags: c.disease.red_flags ?? [],
        recommended_actions: c.disease.terapi?.slice(0, 2).map(t => `${t.obat} ${t.dosis} ${t.frek}`) ?? [],
      })),
    };
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const start = Date.now();
  const body = await request.json().catch(() => ({})) as Encounter;

  if (!body.keluhanUtama?.trim()) {
    return NextResponse.json({ error: "keluhanUtama wajib diisi" }, { status: 400 });
  }

  try {
    const diseases = loadPenyakit();
    const candidates = matchSymptoms(body, diseases);
    const redFlags = detectRedFlags(body);
    const { level, reason } = classifyTrafficLight(candidates, redFlags, body);
    const { suggestions, source } = await enrichWithGemini(body, candidates);

    const result: CDSSResult = {
      suggestions,
      red_flags: redFlags,
      traffic_light: level,
      traffic_light_reason: reason,
      processing_time_ms: Date.now() - start,
      source,
    };

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
  }
}
