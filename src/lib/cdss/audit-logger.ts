/**
 * Iskandar Diagnosis Engine V1 — CDSS Audit Logger
 * Adapted for Next.js: no browser.storage, uses in-memory log + console.
 * Append-only logging for clinical decision support audit trail.
 * All CDSS interactions MUST be logged for governance accountability.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'diagnosis_requested'
  | 'suggestion_displayed'
  | 'suggestion_selected'
  | 'suggestion_rejected'
  | 'red_flag_shown'
  | 'red_flag_acknowledged'
  | 'engine_error'
  | 'api_timeout'
  | 'fallback_used';

export interface AuditEntry {
  id: string;
  timestamp: string;
  session_hash: string;
  action: AuditAction;
  input_hash: string;
  output_summary: {
    suggestion_count: number;
    top_icd_codes: string[];
    red_flag_count: number;
    confidence_range: [number, number] | null;
  };
  model_version: string;
  latency_ms: number;
  validation_status: 'PASS' | 'WARN' | 'FAIL';
  metadata?: Record<string, string | number | boolean>;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ── Audit Logger (in-memory, adapted for Next.js server-side) ────────────────

const MAX_ENTRIES = 1000;

class CDSSAuditLogger {
  private cache: AuditEntry[] = [];

  async init(): Promise<void> {
    // No-op in Next.js context — in-memory only
  }

  async log(
    action: AuditAction,
    data: {
      session_id: string;
      input_context?: string;
      suggestions?: Array<{ icd10_code: string; confidence: number }>;
      red_flag_count?: number;
      model_version?: string;
      latency_ms?: number;
      validation_status?: 'PASS' | 'WARN' | 'FAIL';
      metadata?: Record<string, string | number | boolean>;
    }
  ): Promise<void> {
    const entry: AuditEntry = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      session_hash: simpleHash(data.session_id),
      action,
      input_hash: data.input_context ? simpleHash(data.input_context) : '',
      output_summary: {
        suggestion_count: data.suggestions?.length ?? 0,
        top_icd_codes: data.suggestions?.slice(0, 5).map(s => s.icd10_code) ?? [],
        red_flag_count: data.red_flag_count ?? 0,
        confidence_range: data.suggestions && data.suggestions.length > 0
          ? [
              Math.min(...data.suggestions.map(s => s.confidence)),
              Math.max(...data.suggestions.map(s => s.confidence)),
            ]
          : null,
      },
      model_version: data.model_version ?? 'unknown',
      latency_ms: data.latency_ms ?? 0,
      validation_status: data.validation_status ?? 'PASS',
      metadata: data.metadata,
    };

    this.cache.push(entry);
    if (this.cache.length > MAX_ENTRIES) this.cache = this.cache.slice(-MAX_ENTRIES);

    // In Next.js server context: log to console for observability
    console.log(`[CDSS Audit] ${entry.timestamp} | ${action} | session:${entry.session_hash} | model:${entry.model_version} | latency:${entry.latency_ms}ms`);
  }

  async getRecentEntries(count = 50): Promise<AuditEntry[]> {
    return this.cache.slice(-count).reverse();
  }

  async getEntryCount(): Promise<number> {
    return this.cache.length;
  }

  async getStats(): Promise<{
    total_entries: number;
    actions_breakdown: Record<AuditAction, number>;
    validation_breakdown: Record<string, number>;
    avg_latency_ms: number;
    date_range: { oldest: string; newest: string } | null;
  }> {
    const actionsBreakdown: Record<string, number> = {};
    const validationBreakdown: Record<string, number> = {};
    let totalLatency = 0;

    for (const entry of this.cache) {
      actionsBreakdown[entry.action] = (actionsBreakdown[entry.action] ?? 0) + 1;
      validationBreakdown[entry.validation_status] = (validationBreakdown[entry.validation_status] ?? 0) + 1;
      totalLatency += entry.latency_ms;
    }

    return {
      total_entries: this.cache.length,
      actions_breakdown: actionsBreakdown as Record<AuditAction, number>,
      validation_breakdown: validationBreakdown,
      avg_latency_ms: this.cache.length > 0 ? Math.round(totalLatency / this.cache.length) : 0,
      date_range: this.cache.length > 0
        ? { oldest: this.cache[0].timestamp, newest: this.cache[this.cache.length - 1].timestamp }
        : null,
    };
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const auditLogger = new CDSSAuditLogger();

// ── Convenience Functions ─────────────────────────────────────────────────────

export async function logDiagnosisRequest(data: {
  session_id: string;
  input_context: string;
  model_version: string;
}): Promise<void> {
  await auditLogger.log('diagnosis_requested', data);
}

export async function logSuggestionDisplayed(data: {
  session_id: string;
  suggestions: Array<{ icd10_code: string; confidence: number }>;
  red_flag_count: number;
  model_version: string;
  latency_ms: number;
  validation_status: 'PASS' | 'WARN' | 'FAIL';
}): Promise<void> {
  await auditLogger.log('suggestion_displayed', data);
}

export async function logSuggestionSelected(data: {
  session_id: string;
  selected_icd: string;
  selected_confidence: number;
}): Promise<void> {
  await auditLogger.log('suggestion_selected', {
    session_id: data.session_id,
    suggestions: [{ icd10_code: data.selected_icd, confidence: data.selected_confidence }],
    metadata: { selected_icd: data.selected_icd },
  });
}

export async function logRedFlagShown(data: {
  session_id: string;
  red_flag_id: string;
  red_flag_condition: string;
}): Promise<void> {
  await auditLogger.log('red_flag_shown', {
    session_id: data.session_id,
    red_flag_count: 1,
    metadata: { red_flag_id: data.red_flag_id, condition: data.red_flag_condition },
  });
}

export async function logEngineError(data: {
  session_id: string;
  error_message: string;
  error_code?: string;
}): Promise<void> {
  await auditLogger.log('engine_error', {
    session_id: data.session_id,
    validation_status: 'FAIL',
    metadata: { error: data.error_message, code: data.error_code ?? 'UNKNOWN' },
  });
}

export async function logFallbackUsed(data: {
  session_id: string;
  reason: string;
}): Promise<void> {
  await auditLogger.log('fallback_used', {
    session_id: data.session_id,
    model_version: 'local-fallback',
    metadata: { reason: data.reason },
  });
}
