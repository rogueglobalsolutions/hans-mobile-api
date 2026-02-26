/**
 * Training enum ↔ display label mapping utility
 *
 * The frontend sends and receives human-readable labels (e.g. "MINT Lift® PDO Threads").
 * Internally the API stores Prisma enum values (e.g. MINT_LIFT_PDO_THREADS).
 * These maps handle bidirectional conversion so neither the DB schema nor the UI
 * needs to expose raw enum identifiers.
 */

import { TrainingType, TrainingBrand, TrainingLevel } from "../generated/prisma/enums";

// ─── TrainingType ─────────────────────────────────────────────────────────────

export const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  [TrainingType.ONLINE]:   "Online Training",
  [TrainingType.HANDS_ON]: "Hands on Training",
};

export const TRAINING_TYPE_FROM_LABEL: Record<string, TrainingType> = {
  "Online Training":    TrainingType.ONLINE,
  "Hands on Training":  TrainingType.HANDS_ON,
};

// ─── TrainingBrand ────────────────────────────────────────────────────────────

export const TRAINING_BRAND_LABELS: Record<TrainingBrand, string> = {
  [TrainingBrand.MINT_LIFT_PDO_THREADS]: "MINT Lift® PDO Threads",
  [TrainingBrand.MINT_MICROCANNULA]:     "MINT™ Microcannula",
  [TrainingBrand.KLARDIE]:               "klárdie",
  [TrainingBrand.TARGETCOOL]:            "TargetCool",
  [TrainingBrand.EZ_TCON]:              "EZ-Tcon",
};

export const TRAINING_BRAND_FROM_LABEL: Record<string, TrainingBrand> = {
  "MINT Lift® PDO Threads": TrainingBrand.MINT_LIFT_PDO_THREADS,
  "MINT™ Microcannula":     TrainingBrand.MINT_MICROCANNULA,
  "klárdie":                TrainingBrand.KLARDIE,
  "TargetCool":             TrainingBrand.TARGETCOOL,
  "EZ-Tcon":                TrainingBrand.EZ_TCON,
};

// ─── TrainingLevel ────────────────────────────────────────────────────────────

export const TRAINING_LEVEL_LABELS: Record<TrainingLevel, string> = {
  [TrainingLevel.MINT_LIFT_GROUP_TRAINING]: "Mint Lift Group Training",
  [TrainingLevel.SUPPLEMENTAL]:             "Supplemental",
  [TrainingLevel.ADVANCED]:                 "Advanced",
  [TrainingLevel.PACKAGE_BUNDLE_1]:         "Package Bundle 1",
  [TrainingLevel.PACKAGE_BUNDLE_2]:         "Package Bundle 2",
};

export const TRAINING_LEVEL_FROM_LABEL: Record<string, TrainingLevel> = {
  "Mint Lift Group Training": TrainingLevel.MINT_LIFT_GROUP_TRAINING,
  "Supplemental":             TrainingLevel.SUPPLEMENTAL,
  "Advanced":                 TrainingLevel.ADVANCED,
  "Package Bundle 1":         TrainingLevel.PACKAGE_BUNDLE_1,
  "Package Bundle 2":         TrainingLevel.PACKAGE_BUNDLE_2,
};

// ─── LearningFormat (JSON array values) ──────────────────────────────────────

export const VALID_LEARNING_FORMATS = ["DEMO", "DIDACTIC", "DISCUSSION"] as const;
export type LearningFormat = (typeof VALID_LEARNING_FORMATS)[number];

export const LEARNING_FORMAT_LABELS: Record<LearningFormat, string> = {
  DEMO:       "Demo",
  DIDACTIC:   "Didactic",
  DISCUSSION: "Discussion",
};

export const LEARNING_FORMAT_FROM_LABEL: Record<string, LearningFormat> = {
  Demo:       "DEMO",
  Didactic:   "DIDACTIC",
  Discussion: "DISCUSSION",
};

// ─── Level Pricing ────────────────────────────────────────────────────────────

export interface LevelPricing {
  /** USD price for the training */
  price: number;
  /** In-house credit score awarded to the MED user on purchase/enrollment */
  creditScore: number;
}

/**
 * Fixed pricing per training level.
 * Price and creditScore are auto-populated at training creation — admins do not
 * set these manually.
 */
export const TRAINING_LEVEL_PRICING: Record<TrainingLevel, LevelPricing> = {
  [TrainingLevel.MINT_LIFT_GROUP_TRAINING]: { price: 3000, creditScore: 1500 },
  [TrainingLevel.SUPPLEMENTAL]:             { price: 1500, creditScore: 0    },
  [TrainingLevel.ADVANCED]:                 { price: 6000, creditScore: 3000 },
  [TrainingLevel.PACKAGE_BUNDLE_1]:         { price: 5000, creditScore: 2500 },
  [TrainingLevel.PACKAGE_BUNDLE_2]:         { price: 8000, creditScore: 4500 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert an array of display labels (e.g. ["Demo", "Didactic"]) to
 * internal format values (e.g. ["DEMO", "DIDACTIC"]).
 * Returns null if any label is invalid.
 */
export function learningFormatsFromLabels(labels: string[]): LearningFormat[] | null {
  const result: LearningFormat[] = [];
  for (const label of labels) {
    const value = LEARNING_FORMAT_FROM_LABEL[label];
    if (!value) return null;
    result.push(value);
  }
  return result;
}

/**
 * Convert an array of internal format values back to display labels.
 */
export function learningFormatsToLabels(values: LearningFormat[]): string[] {
  return values.map((v) => LEARNING_FORMAT_LABELS[v] ?? v);
}
