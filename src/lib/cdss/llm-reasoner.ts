/**
 * Iskandar Diagnosis Engine V1 — LLM Reasoner
 * LLM is COPILOT, not PILOT. Ranks/enriches KB candidates only.
 * Adapted for Next.js: uses Gemini (GEMINI_API_KEY) instead of DeepSeek.
 */

import type { MatchedCandidate } from './symptom-matcher';
import type { AIDiagnosisSuggestion } from './types';

export interface ReasonerInput {
  candidates: MatchedCandidate[];
  keluhanUtama: string;
  keluhanTambahan?: string;
  usia?: number;
  jenisKelamin?: 'L' | 'P';
  epiContext?: string;
}

export interface ReasonerOutput {
  suggestions: AIDiagnosisSuggestion[];
  source: 'ai' | 'local';
  modelVersion: string;
  latencyMs: number;
  dataQualityWarnings: string[];
}

function buildSystemPrompt(epiContext: string): string {
  return `Anda adalah Iskandar Diagnosis Engine V1 (IDE) — CDSS klinis untuk Puskesmas Indonesia.

PERAN: Menerima kandidat diagnosis dari knowledge base (KB) dan MERANKING ulang berdasarkan klinis.

ATURAN:
1. HANYA pilih dari kandidat yang diberikan — JANGAN buat diagnosis baru
2. Berikan reasoning klinis dalam Bahasa Indonesia
3. Identifikasi red flags dan recommended actions
4. Confidence 0.0–1.0 berdasarkan kesesuaian klinis
5. JANGAN fabrikasi obat, dosis, atau referensi

${epiContext}

OUTPUT FORMAT (JSON KETAT, tanpa markdown):
{
  "suggestions": [
    {
      "rank": 1,
      "diagnosis_name": "Nama diagnosis Bahasa Indonesia",
      "icd10_code": "ICD-10",
      "confidence": 0.85,
      "reasoning": "Alasan klinis",
      "red_flags": ["red flag 1"],
      "recommended_actions": ["tindakan 1"]
    }
  ]
}`;
}

function buildUserPrompt(input: ReasonerInput): string {
  const candidateList = input.candidates.slice(0, 10).map((c, i) =>
    `${i + 1}. [${c.icd10}] ${c.nama} (match: ${(c.matchScore * 100).toFixed(1)}%, gejala: ${c.matchedSymptoms.join(', ')})`
  ).join('\n');

  return `PASIEN:
- Keluhan utama: ${input.keluhanUtama}
${input.keluhanTambahan ? `- Keluhan tambahan: ${input.keluhanTambahan}` : ''}
${input.usia ? `- Usia: ${input.usia} tahun` : ''}
${input.jenisKelamin ? `- Jenis kelamin: ${input.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}` : ''}

KANDIDAT DARI KB (pilih dan ranking dari daftar ini):
${candidateList}

Berikan ranking ulang dengan reasoning klinis. Output JSON saja.`;
}

function buildKBOnlySuggestions(candidates: MatchedCandidate[]): AIDiagnosisSuggestion[] {
  return candidates.slice(0, 5).map((c, i) => ({
    rank: i + 1,
    diagnosis_name: c.nama,
    icd10_code: c.icd10,
    confidence: c.matchScore,
    reasoning: c.definisi
      ? `${c.definisi.substring(0, 200)}${c.definisi.length > 200 ? '...' : ''}`
      : `Kesesuaian gejala: ${c.matchedSymptoms.slice(0, 3).join(', ')}. Match score: ${(c.matchScore * 100).toFixed(0)}%.`,
    red_flags: c.redFlags.slice(0, 3),
    recommended_actions: buildRecommendedActions(c),
  }));
}

function buildRecommendedActions(c: MatchedCandidate): string[] {
  const actions: string[] = ['Lakukan pemeriksaan fisik terarah dan monitoring TTV serial'];
  if (c.kriteria_rujukan) actions.push(`Pertimbangkan rujukan: ${c.kriteria_rujukan.substring(0, 120)}`);
  if (c.diagnosisBanding.length > 0) actions.push(`Diagnosis banding: ${c.diagnosisBanding.slice(0, 3).join(', ')}`);
  return actions.slice(0, 3);
}

async function callGemini(systemPrompt: string, userPrompt: string): Promise<{
  success: boolean;
  data?: { suggestions: AIDiagnosisSuggestion[] };
  error?: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: 'GEMINI_API_KEY not configured' };

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    const text = result.response.text().trim();
    const jsonStr = text.startsWith('{') ? text : text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr) as { suggestions: AIDiagnosisSuggestion[] };
    if (parsed.suggestions && parsed.suggestions.length > 0) {
      return { success: true, data: { suggestions: parsed.suggestions } };
    }
    return { success: false, error: 'No suggestions from Gemini' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Gemini error' };
  }
}

export async function runLLMReasoning(input: ReasonerInput): Promise<ReasonerOutput> {
  const startTime = Date.now();

  if (input.candidates.length === 0) {
    return { suggestions: [], source: 'local', modelVersion: 'IDE-V1-KB', latencyMs: Date.now() - startTime, dataQualityWarnings: ['No candidates'] };
  }

  const systemPrompt = buildSystemPrompt(input.epiContext ?? '');
  const userPrompt = buildUserPrompt(input);
  const llmResult = await callGemini(systemPrompt, userPrompt);

  if (llmResult.success && llmResult.data) {
    const enriched = llmResult.data.suggestions.map((s, i) => {
      const kbMatch = input.candidates.find(c => c.icd10 === s.icd10_code || c.icd10.startsWith(s.icd10_code.split('.')[0]));
      return {
        ...s,
        rank: i + 1,
        confidence: kbMatch ? Math.min(s.confidence, 0.95) : Math.min(s.confidence, 0.15),
        red_flags: s.red_flags ?? kbMatch?.redFlags?.slice(0, 3) ?? [],
        recommended_actions: s.recommended_actions ?? (kbMatch ? buildRecommendedActions(kbMatch) : []),
      };
    });
    return { suggestions: enriched.slice(0, 5), source: 'ai', modelVersion: 'IDE-V1-GEMINI', latencyMs: Date.now() - startTime, dataQualityWarnings: [] };
  }

  return {
    suggestions: buildKBOnlySuggestions(input.candidates),
    source: 'local',
    modelVersion: 'IDE-V1-KB',
    latencyMs: Date.now() - startTime,
    dataQualityWarnings: llmResult.error ? [`LLM unavailable: ${llmResult.error}`] : [],
  };
}


