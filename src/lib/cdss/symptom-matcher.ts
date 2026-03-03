/**
 * Iskandar Diagnosis Engine V1 — Symptom Matcher
 * IDF-weighted + Coverage + Jaccard + Bigram. Pure function, <100ms.
 * Adapted for Next.js: uses fs.readFileSync instead of fetch.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface MatcherInput {
  keluhanUtama: string;
  keluhanTambahan?: string;
  usia?: number;
  jenisKelamin?: 'L' | 'P';
}

export interface MatchedCandidate {
  diseaseId: string;
  nama: string;
  icd10: string;
  kompetensi: string;
  bodySystem: string;
  matchScore: number;
  rawMatchScore: number;
  matchedSymptoms: string[];
  totalSymptoms: number;
  redFlags: string[];
  terpiData: Array<{ obat: string; dosis: string; frek: string }>;
  kriteria_rujukan: string;
  definisi: string;
  diagnosisBanding: string[];
}

interface PenyakitEntry {
  id: string;
  nama: string;
  icd10: string;
  kompetensi: string;
  body_system: string;
  definisi: string;
  gejala_klinis: string[];
  pemeriksaan_fisik: string[];
  diagnosis_banding: string[];
  komplikasi: string[];
  red_flags: string[];
  terapi: Array<{ obat: string; dosis: string; frek: string }>;
  kriteria_rujukan: string;
}

interface PenyakitDatabase {
  _metadata?: { total_diseases: number };
  penyakit: PenyakitEntry[];
}

let cachedDB: PenyakitDatabase | null = null;
let cachedIDF: Map<string, number> | null = null;

const INDONESIAN_STOPWORDS = new Set([
  "yang", "dan", "di", "ke", "dari", "pada", "untuk", "dengan", "adalah",
  "ini", "itu", "atau", "juga", "tidak", "ada", "akan", "bisa", "sudah",
  "telah", "sedang", "masih", "belum", "hanya", "saja", "lebih", "sangat",
  "seperti", "oleh", "karena", "sering", "dapat", "dalam", "secara",
  "antara", "tanpa", "melalui", "tentang", "setelah", "sebelum", "selama",
  "hingga", "sampai", "sejak", "mungkin", "biasanya", "kadang", "pernah",
  "dimulai", "riwayat", "pasien", "penting", "ditanyakan", "datang",
  "keluhan", "utama", "tambahan", "anamnesis", "pemeriksaan", "fisik",
  "laboratorium", "klinis", "gejala", "tanda", "disertai", "merasa",
  "hari", "minggu", "bulan", "tahun", "usia", "jenis", "kelamin",
  "laki-laki", "perempuan", "dahulu", "keluarga", "sosial", "ekonomi",
  "perjalanan", "umumnya", "khususnya", "beberapa", "macam", "terdiri",
  "atas", "lain", "adanya", "terjadi", "dialami", "mengalami", "dirasakan",
  "tampak", "terlihat", "didapatkan", "ditemukan", "berlangsung", "saat",
  "sebelumnya", "terkait", "akibat", "berhubungan", "kondisi", "medis",
  "paling", "seringkali", "biasa", "muncul", "timbul", "menunjukkan",
  "penyakit", "merupakan", "salah", "satu", "berupa", "maupun",
]);

function loadPenyakitDB(): PenyakitDatabase {
  if (cachedDB) return cachedDB;
  const filePath = path.join(process.cwd(), 'public', 'data', 'penyakit.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as PenyakitDatabase | PenyakitEntry[];
  if (Array.isArray(parsed)) {
    cachedDB = { penyakit: parsed };
  } else {
    cachedDB = parsed;
  }
  return cachedDB;
}

function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !INDONESIAN_STOPWORDS.has(t));

  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`~~${words[i]}_${words[i + 1]}`);
  }
  return [...words, ...bigrams];
}

function buildIDF(diseases: PenyakitEntry[]): Map<string, number> {
  if (cachedIDF) return cachedIDF;
  const docFreq = new Map<string, number>();
  const N = diseases.length;
  for (const p of diseases) {
    const tokens = new Set(p.gejala_klinis.flatMap(g => tokenize(g)));
    for (const t of tokens) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  }
  cachedIDF = new Map<string, number>();
  for (const [token, df] of docFreq) {
    cachedIDF.set(token, Math.log((N + 1) / (df + 1)) + 1);
  }
  return cachedIDF;
}

function scoreDisease(
  inputTokens: Set<string>,
  disease: PenyakitEntry,
  idf: Map<string, number>,
): { combined: number; matched: string[] } {
  const diseaseTokens = new Set(disease.gejala_klinis.flatMap(g => tokenize(g)));
  if (diseaseTokens.size === 0) return { combined: 0, matched: [] };

  const intersection = new Set([...inputTokens].filter(t => diseaseTokens.has(t)));
  if (intersection.size === 0) return { combined: 0, matched: [] };

  const matched = [...intersection].filter(t => !t.startsWith('~~'));

  let inputWeight = 0;
  let matchWeight = 0;
  for (const t of inputTokens) inputWeight += idf.get(t) ?? 1;
  for (const t of intersection) matchWeight += idf.get(t) ?? 1;
  const idfScore = inputWeight > 0 ? matchWeight / inputWeight : 0;

  const inputCoverage = intersection.size / Math.max(1, inputTokens.size);
  const diseaseCoverage = intersection.size / Math.max(1, diseaseTokens.size);
  const coverageScore = inputCoverage + diseaseCoverage > 0
    ? (2 * inputCoverage * diseaseCoverage) / (inputCoverage + diseaseCoverage)
    : 0;

  const union = new Set([...inputTokens, ...diseaseTokens]);
  const jaccardScore = intersection.size / union.size;

  const combined = idfScore * 0.5 + coverageScore * 0.3 + jaccardScore * 0.2;
  return { combined: Math.min(1, combined), matched };
}

export async function matchSymptoms(input: MatcherInput, topN = 10): Promise<MatchedCandidate[]> {
  const db = loadPenyakitDB();
  const idf = buildIDF(db.penyakit);

  const text = `${input.keluhanUtama} ${input.keluhanTambahan ?? ''}`;
  const inputTokens = new Set(tokenize(text));
  if (inputTokens.size === 0) return [];

  const candidates: MatchedCandidate[] = [];
  for (const p of db.penyakit) {
    const { combined, matched } = scoreDisease(inputTokens, p, idf);
    if (combined < 0.05) continue;
    candidates.push({
      diseaseId: p.id,
      nama: p.nama,
      icd10: p.icd10,
      kompetensi: p.kompetensi,
      bodySystem: p.body_system,
      matchScore: combined,
      rawMatchScore: combined,
      matchedSymptoms: matched,
      totalSymptoms: p.gejala_klinis.length,
      redFlags: p.red_flags ?? [],
      terpiData: p.terapi ?? [],
      kriteria_rujukan: p.kriteria_rujukan ?? '',
      definisi: p.definisi ?? '',
      diagnosisBanding: p.diagnosis_banding ?? [],
    });
  }

  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return candidates.slice(0, topN);
}

export async function getKBDiseaseCount(): Promise<number> {
  const db = loadPenyakitDB();
  return db.penyakit.length;
}

export function clearMatcherCache(): void {
  cachedDB = null;
  cachedIDF = null;
}



