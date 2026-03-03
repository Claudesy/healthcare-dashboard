/**
 * CDSS Diagnose API — Iskandar Diagnosis Engine V1
 * POST /api/cdss/diagnose
 * Server-side only (nodejs runtime).
 */

import { NextResponse } from 'next/server';
import { runDiagnosisEngine, DEFAULT_ENGINE_CONFIG } from '@/lib/cdss/engine';
import type { CDSSEngineInput } from '@/lib/cdss/engine';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  if (!b.keluhan_utama || typeof b.keluhan_utama !== 'string' || !b.keluhan_utama.trim()) {
    return NextResponse.json({ error: 'keluhan_utama wajib diisi' }, { status: 400 });
  }

  const input: CDSSEngineInput = {
    keluhan_utama: b.keluhan_utama as string,
    keluhan_tambahan: typeof b.keluhan_tambahan === 'string' ? b.keluhan_tambahan : undefined,
    usia: typeof b.usia === 'number' ? b.usia : 30,
    jenis_kelamin: b.jenis_kelamin === 'P' ? 'P' : 'L',
    vital_signs: b.vital_signs as CDSSEngineInput['vital_signs'] ?? undefined,
    allergies: Array.isArray(b.allergies) ? b.allergies as string[] : undefined,
    chronic_diseases: Array.isArray(b.chronic_diseases) ? b.chronic_diseases as string[] : undefined,
    is_pregnant: b.is_pregnant === true,
    session_id: typeof b.session_id === 'string' ? b.session_id : undefined,
  };

  try {
    const result = await runDiagnosisEngine(input, DEFAULT_ENGINE_CONFIG);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal error';
    console.error('[CDSS API] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
