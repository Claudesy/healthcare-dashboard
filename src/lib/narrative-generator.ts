/**
 * AI Narrative Generator
 *
 * Generates clinical narrative from symptoms with smart duration logic
 * Real-time updates as user types
 *
 * @module lib/emergency-detector/narrative-generator
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SymptomInput {
  text: string;
  severity?: 'ringan' | 'sedang' | 'berat';
  onset?: 'mendadak' | 'bertahap';
  pattern?: 'terus-menerus' | 'hilang-timbul';
}

/**
 * NarrativeOptions interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-02-04
 */

export interface NarrativeOptions {
  includeAssociatedSymptoms?: boolean;
  includeDuration?: boolean;
  formalTone?: boolean;
  context?: string;
}

/**
 * GeneratedNarrative interface
 *
 * @remarks
 * TODO: Add type description and property documentation
 * Auto-generated on 2026-02-04
 */

export interface GeneratedNarrative {
  keluhan_utama: string;
  lama_sakit: string;
  is_akut: boolean;
  confidence: number;
}

// ============================================================================
// TYPO CORRECTION DICTIONARY
// ============================================================================

/**
 * Common typos and their corrections for medical terms in Bahasa Indonesia
 * Format: { typo: correctWord }
 */
const TYPO_CORRECTIONS: Record<string, string> = {
  // Demam variants
  deman: 'demam',
  dmam: 'demam',
  denam: 'demam',
  demem: 'demam',
  dema: 'demam',

  // Batuk variants
  btuk: 'batuk',
  batu: 'batuk',
  bauk: 'batuk',
  batk: 'batuk',

  // Pilek variants
  pile: 'pilek',
  plek: 'pilek',
  pilk: 'pilek',

  // Pusing variants
  pusiing: 'pusing',
  pusin: 'pusing',
  pusng: 'pusing',
  pusig: 'pusing',

  // Mual variants
  muaal: 'mual',
  mua: 'mual',
  muak: 'mual',

  // Muntah variants
  munta: 'muntah',
  munth: 'muntah',
  mutah: 'muntah',

  // Diare variants
  diarre: 'diare',
  daire: 'diare',
  dirae: 'diare',
  mencret: 'diare',

  // Nyeri variants
  nyer: 'nyeri',
  nyri: 'nyeri',
  neri: 'nyeri',
  nyrei: 'nyeri',
  nyerii: 'nyeri',
  nyeeri: 'nyeri',
  sakit: 'nyeri',

  // Sesak variants
  sesa: 'sesak',
  ssak: 'sesak',
  sesek: 'sesak',
  seak: 'sesak',

  // Lemas variants
  lmes: 'lemas',
  lema: 'lemas',
  lemah: 'lemas',
  lemmas: 'lemas',

  // Kepala variants
  kepla: 'kepala',
  kpala: 'kepala',
  kepal: 'kepala',

  // Perut variants
  pertu: 'perut',
  prut: 'perut',
  peru: 'perut',

  // Tenggorokan variants
  tenggorok: 'tenggorokan',
  tengorokan: 'tenggorokan',
  tenggoroakn: 'tenggorokan',

  // Gatal variants
  gatl: 'gatal',
  gatall: 'gatal',

  // Bengkak variants
  bengka: 'bengkak',
  bngkak: 'bengkak',
  bengkakk: 'bengkak',

  // Common body parts
  dada: 'dada',
  ddaa: 'dada',
  kaki: 'kaki',
  kakki: 'kaki',
  tangan: 'tangan',
  tangn: 'tangan',

  // Medical conditions
  hipertensii: 'hipertensi',
  hipertensu: 'hipertensi',
  'darah tinggi': 'hipertensi',
  diabtes: 'diabetes',
  diabetess: 'diabetes',
  'gula darah': 'gula darah',
  'kencing manis': 'diabetes',
  gukam: 'gula',
  gula: 'gula',
  gulaa: 'gula',
  kontrol: 'kontrol',
  konrtol: 'kontrol',
  kontroll: 'kontrol',
  disertai: 'disertai',
  diserrtai: 'disertai',
  disertaii: 'disertai',

  // Others
  'nafsu makan': 'nafsu makan',
  'napsu makan': 'nafsu makan',
  tidur: 'tidur',
  tidr: 'tidur',
  insomnia: 'sulit tidur',
  'susah tidur': 'sulit tidur',
};

/**
 * Correct typos in symptom text
 * Uses dictionary-based correction + fuzzy matching
 *
 * @param text - Raw input text with potential typos
 * @returns Corrected text
 */
export function correctTypos(text: string): string {
  if (!text.trim()) return text;

  let correctedText = text.toLowerCase();

  // Sort corrections by length (longer first) to avoid partial replacements
  const sortedCorrections = Object.entries(TYPO_CORRECTIONS).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [typo, correction] of sortedCorrections) {
    // Use word boundary regex to avoid partial word replacements
    const regex = new RegExp(`\\b${typo}\\b`, 'gi');
    correctedText = correctedText.replace(regex, correction);
  }

  // Capitalize first letter of sentences
  correctedText = correctedText.replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase());

  return correctedText;
}

/**
 * Find similar word from dictionary using Levenshtein distance
 * For words not in direct typo map
 *
 * @param word - Word to check
 * @param maxDistance - Maximum edit distance (default: 2)
 * @returns Corrected word or original if no match
 */
function findSimilarWord(word: string, maxDistance = 2): string {
  const lowerWord = word.toLowerCase();

  // Check direct typo corrections
  if (TYPO_CORRECTIONS[lowerWord]) {
    return TYPO_CORRECTIONS[lowerWord];
  }

  // Check if word is in common symptoms (no correction needed)
  const allKnownWords = [
    ...ACUTE_SYMPTOMS,
    ...CHRONIC_SYMPTOMS,
    ...Object.values(TYPO_CORRECTIONS),
  ];

  if (allKnownWords.includes(lowerWord)) {
    return word; // Word is correct
  }

  // Simple Levenshtein distance check for short words
  let bestMatch = word;
  let bestDistance = maxDistance + 1;

  for (const knownWord of allKnownWords) {
    const distance = levenshteinDistance(lowerWord, knownWord);
    if (distance <= maxDistance && distance < bestDistance) {
      bestDistance = distance;
      bestMatch = knownWord;
    }
  }

  return bestMatch;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ============================================================================
// SYMPTOM CLASSIFICATION
// ============================================================================

/**
 * Common acute symptoms (typically <2 weeks)
 */
const ACUTE_SYMPTOMS = [
  'demam',
  'fever',
  'batuk',
  'cough',
  'pilek',
  'flu',
  'mual',
  'nausea',
  'muntah',
  'vomiting',
  'diare',
  'diarrhea',
  'nyeri perut akut',
  'sakit kepala mendadak',
  'lemas mendadak',
];

/**
 * Chronic symptoms (typically ≥1 month)
 */
const CHRONIC_SYMPTOMS = [
  'hipertensi',
  'hypertension',
  'diabetes',
  'dm',
  'asma',
  'asthma',
  'nyeri sendi kronik',
  'batuk kronik',
  'sesak napas kronik',
  'kelelahan kronik',
];

// ============================================================================
// DURATION LOGIC
// ============================================================================

/**
 * Determine if symptoms are acute or chronic
 *
 * @param symptomText - Symptom description
 * @returns True if acute
 */
export function isAcuteSymptom(symptomText: string): boolean {
  const lowerText = symptomText.toLowerCase();

  // Check for explicit chronic indicators
  if (lowerText.includes('kronik') || lowerText.includes('chronic')) {
    return false;
  }

  // Check for explicit acute indicators
  if (lowerText.includes('akut') || lowerText.includes('mendadak')) {
    return true;
  }

  // Check against known symptom lists
  const hasAcuteSymptom = ACUTE_SYMPTOMS.some((s) => lowerText.includes(s));
  const hasChronicSymptom = CHRONIC_SYMPTOMS.some((s) => lowerText.includes(s));

  if (hasChronicSymptom) return false;
  if (hasAcuteSymptom) return true;

  // Default: assume acute for safety
  return true;
}

/**
 * Generate smart duration based on symptom type
 *
 * Akut: 3-7 hari (random)
 * Kronik: 1-3 tahun (random)
 *
 * @param isAkut - Whether symptoms are acute
 * @returns Duration string
 */
export function generateDuration(isAkut: boolean): string {
  if (isAkut) {
    // Acute: 3-7 days
    const days = Math.floor(Math.random() * 5) + 3; // 3-7
    return `${days} hari`;
  } else {
    // Chronic: 1-3 years
    const years = Math.floor(Math.random() * 3) + 1; // 1-3
    const months = Math.floor(Math.random() * 12); // 0-11

    if (months === 0) {
      return `${years} tahun`;
    } else {
      return `${years} tahun ${months} bulan`;
    }
  }
}

// ============================================================================
// NARRATIVE GENERATION
// ============================================================================

/**
 * Parse symptom text into structured format
 * Includes auto-correction for typos
 *
 * @param text - Raw symptom text
 * @returns Parsed and corrected symptoms
 */
function parseSymptoms(text: string): string[] {
  // First, correct any typos
  const correctedText = correctTypos(text);

  // Split by common separators
  const separators = /[,;.\n]/g;
  const symptoms = correctedText
    .split(separators)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => findSimilarWord(s)); // Additional fuzzy correction per symptom

  return symptoms;
}

/**
 * Add severity modifiers to symptoms
 *
 * @param symptom - Base symptom
 * @returns Symptom with severity
 */
function addSeverityModifier(symptom: string): string {
  const lowerSymptom = symptom.toLowerCase();

  // Already has modifier
  if (
    lowerSymptom.includes('ringan') ||
    lowerSymptom.includes('sedang') ||
    lowerSymptom.includes('berat') ||
    lowerSymptom.includes('hebat')
  ) {
    return symptom;
  }

  // Add contextual modifiers
  if (lowerSymptom.includes('demam')) {
    return Math.random() > 0.5 ? `${symptom} tinggi` : symptom;
  }

  if (lowerSymptom.includes('batuk')) {
    return Math.random() > 0.5 ? `${symptom} berdahak` : `${symptom} kering`;
  }

  if (lowerSymptom.includes('nyeri')) {
    return Math.random() > 0.5 ? `${symptom} hebat` : symptom;
  }

  return symptom;
}

/**
 * Generate clinical narrative from symptom text
 * Enhanced version with longer, more detailed narrative (minimum 3 lines)
 *
 * @param symptomText - User input symptoms
 * @param options - Generation options
 * @returns Generated narrative
 */
export function generateNarrative(
  symptomText: string,
  _options: NarrativeOptions = {}
): GeneratedNarrative {
  if (!symptomText.trim()) {
    return {
      keluhan_utama: '',
      lama_sakit: '',
      is_akut: true,
      confidence: 0,
    };
  }

  // Parse symptoms
  const symptoms = parseSymptoms(symptomText);

  if (symptoms.length === 0) {
    return {
      keluhan_utama: '',
      lama_sakit: '',
      is_akut: true,
      confidence: 0,
    };
  }

  // Determine if acute or chronic
  const isAkut = isAcuteSymptom(symptomText);

  // Generate duration
  const duration = generateDuration(isAkut);

  // Generate pattern and quality
  const patterns = [
    'terus-menerus',
    'hilang-timbul',
    'memberat saat malam hari',
    'memberat saat aktivitas',
  ];
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];

  const qualities = isAkut
    ? [
        'Pasien tampak lemah.',
        'Nafsu makan menurun.',
        'Aktivitas harian terganggu.',
        'Pasien sulit beristirahat.',
      ]
    : [
        'Pasien masih dapat beraktivitas.',
        'Keluhan mempengaruhi kualitas hidup.',
        'Riwayat pengobatan sebelumnya tidak membaik.',
      ];
  const quality = qualities[Math.floor(Math.random() * qualities.length)];

  const contexts = isAkut
    ? [
        'Tidak ada riwayat keluhan serupa sebelumnya.',
        'Riwayat kontak dengan orang sakit disangkal.',
        'Riwayat perjalanan dalam 14 hari terakhir disangkal.',
      ]
    : [
        'Pasien memiliki riwayat keluhan serupa.',
        'Riwayat pengobatan rutin.',
        'Kontrol terakhir lebih dari 1 bulan yang lalu.',
      ];
  const context = contexts[Math.floor(Math.random() * contexts.length)];

  // Build narrative - minimum 3 lines/sentences
  let narrative = 'Pasien datang dengan keluhan ';

  if (symptoms.length === 1) {
    const symptom = addSeverityModifier(symptoms[0]);
    narrative += `${symptom} sejak ${duration} yang lalu. Keluhan dirasakan ${pattern}. ${quality} ${context}`;
  } else if (symptoms.length === 2) {
    const s1 = addSeverityModifier(symptoms[0]);
    const s2 = addSeverityModifier(symptoms[1]);
    narrative += `${s1} sejak ${duration} yang lalu, disertai ${s2}. Keluhan utama dirasakan ${pattern}. ${quality} ${context}`;
  } else {
    const primary = addSeverityModifier(symptoms[0]);
    const secondary = symptoms.slice(1, -1).map(addSeverityModifier);
    const last = addSeverityModifier(symptoms[symptoms.length - 1]);

    narrative += `${primary} sejak ${duration} yang lalu, disertai ${secondary.join(', ')}`;

    if (secondary.length > 0) {
      narrative += `, dan ${last}`;
    } else {
      narrative += ` dan ${last}`;
    }

    narrative += `. Keluhan ${pattern}. ${quality} ${context}`;
  }

  // Inject additional context if provided (Auto-Recall)
  if (_options.context) {
    narrative += `\n\n[Clinical Context Recall]:\n${_options.context}`;
  }

  return {
    keluhan_utama: narrative,
    lama_sakit: duration,
    is_akut: isAkut,
    confidence: symptoms.length >= 2 ? 0.92 : 0.75,
  };
}

// ============================================================================
// SYMPTOM AUTOCOMPLETE
// ============================================================================

/**
 * Common symptom suggestions for autocomplete
 */
export const COMMON_SYMPTOMS = [
  // Respiratory
  'demam',
  'demam tinggi',
  'batuk',
  'batuk berdahak',
  'batuk kering',
  'batuk berdarah',
  'pilek',
  'hidung tersumbat',
  'sesak napas',
  'napas pendek',
  'nyeri tenggorokan',
  'tenggorokan gatal',
  'suara serak',
  'bersin-bersin',

  // Gastrointestinal
  'mual',
  'muntah',
  'muntah darah',
  'diare',
  'diare berdarah',
  'nyeri perut',
  'nyeri ulu hati',
  'perut kembung',
  'kembung',
  'mulas',
  'heartburn',
  'maag',
  'BAB berdarah',
  'sembelit',
  'susah BAB',
  'nafsu makan menurun',

  // Neurological
  'lemas',
  'pusing',
  'pusing berputar',
  'vertigo',
  'sakit kepala',
  'sakit kepala hebat',
  'migrain',
  'pandangan kabur',
  'pandangan ganda',
  'kesemutan',
  'baal',
  'kejang',
  'pingsan',

  // Musculoskeletal
  'nyeri sendi',
  'nyeri otot',
  'nyeri punggung',
  'nyeri pinggang',
  'nyeri leher',
  'nyeri lutut',
  'kaku sendi',
  'bengkak sendi',

  // Cardiovascular
  'nyeri dada',
  'dada terasa berat',
  'jantung berdebar',
  'keringat dingin',

  // Skin
  'gatal',
  'gatal-gatal',
  'ruam',
  'bentol',
  'bengkak',
  'luka tidak sembuh',
  'kulit kemerahan',

  // Urinary
  'nyeri saat BAK',
  'sering BAK',
  'BAK berdarah',
  'susah BAK',
  'anyang-anyangan',

  // ENT
  'telinga sakit',
  'pendengaran menurun',
  'telinga berdenging',
  'keluar cairan dari telinga',

  // Gynecological
  'nyeri haid',
  'haid tidak teratur',
  'keluar flek',

  // Chronic Conditions
  'hipertensi',
  'darah tinggi',
  'diabetes',
  'gula darah tinggi',
  'asma',
  'kolesterol tinggi',
  'asam urat',
  'rematik',

  // General Symptoms
  'menggigil',
  'keringat malam',
  'berat badan turun',
  'berat badan naik',
  'lelah',
  'lesu',
  'tidak enak badan',
];

/**
 * Get symptom suggestions based on input with smart ranking
 *
 * @param input - User input
 * @param maxResults - Maximum suggestions
 * @returns Matching suggestions sorted by relevance
 */
export function getSuggestions(input: string, maxResults = 5): string[] {
  if (!input.trim() || input.trim().length < 2) return [];

  const lowerInput = input.toLowerCase().trim();

  // Score each matching symptom
  const scoredMatches = COMMON_SYMPTOMS.map((symptom) => {
    const lowerSymptom = symptom.toLowerCase();

    // Exact match
    if (lowerSymptom === lowerInput) return { symptom, score: 100 };

    // Starts with input (highest priority)
    if (lowerSymptom.startsWith(lowerInput)) return { symptom, score: 90 };

    // Contains input at word boundary
    if (lowerSymptom.match(new RegExp(`\\b${lowerInput}`, 'i'))) {
      return { symptom, score: 80 };
    }

    // Contains input anywhere
    if (lowerSymptom.includes(lowerInput)) return { symptom, score: 70 };

    // Fuzzy match (typo tolerance)
    const distance = levenshteinDistance(lowerInput, lowerSymptom.substring(0, lowerInput.length));
    if (distance <= 2) return { symptom, score: 60 - distance * 10 };

    return null;
  }).filter((match): match is { symptom: string; score: number } => match !== null);

  // Sort by score descending
  scoredMatches.sort((a, b) => b.score - a.score);

  return scoredMatches.slice(0, maxResults).map((m) => m.symptom);
}

