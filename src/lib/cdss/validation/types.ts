/**
 * Iskandar Diagnosis Engine V1 — Validation Types
 */

import type { AIDiagnosisSuggestion, VitalSigns } from '../types';
import type { RedFlag } from '../red-flags';

export interface ValidationResult {
  valid: boolean;
  layer_passed: 1 | 2 | 3 | 4 | 5;
  filtered_suggestions: ValidatedSuggestion[];
  unverified_codes: string[];
  red_flags: RedFlag[];
  warnings: string[];
  layer_results: LayerResult[];
}

export interface ValidatedSuggestion extends AIDiagnosisSuggestion {
  rag_verified: boolean;
  confidence_adjusted: boolean;
  original_confidence?: number;
  validation_flags: ValidationFlag[];
}

export interface ValidationFlag {
  type: 'warning' | 'info' | 'error';
  code: string;
  message: string;
}

export interface LayerResult {
  layer: 1 | 2 | 3 | 4 | 5;
  name: string;
  passed: boolean;
  affected_count: number;
  details: string[];
}

export interface ValidationContext {
  patient_age: number;
  patient_gender: 'L' | 'P';
  is_pregnant: boolean;
  keluhan_utama: string;
  existing_red_flags: RedFlag[];
  vital_signs?: VitalSigns;
}
