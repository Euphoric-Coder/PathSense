import {
  AIBarrierAnalysis,
  BarrierSeverity,
  BarrierType,
  EstimatedPassability,
  SurfaceCondition,
} from './types';

export const VALID_BARRIER_TYPES: readonly BarrierType[] = [
  'stairs',
  'missing_ramp',
  'broken_surface',
  'construction',
  'obstruction',
  'narrow_path',
  'drain_issue',
  'waterlogging',
  'steep_gradient',
  'other',
] as const;

export const VALID_SEVERITIES: readonly BarrierSeverity[] = [
  'low',
  'moderate',
  'high',
  'critical',
] as const;

export const VALID_SURFACE_CONDITIONS: readonly SurfaceCondition[] = [
  'good',
  'uneven',
  'damaged',
  'blocked',
  'wet',
  'unknown',
] as const;

export const VALID_PASSABILITY: readonly EstimatedPassability[] = [
  'passable',
  'difficult',
  'likely_impassable',
  'unknown',
] as const;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  normalized?: AIBarrierAnalysis;
}

export function validateAndNormalizeAIAnalysis(raw: any): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return {
      isValid: false,
      errors: ['AI response is not a valid JSON object'],
    };
  }

  // 1. Barrier Type
  let barrierType: BarrierType = 'other';
  if (typeof raw.barrierType === 'string' && VALID_BARRIER_TYPES.includes(raw.barrierType.toLowerCase() as BarrierType)) {
    barrierType = raw.barrierType.toLowerCase() as BarrierType;
  } else {
    errors.push(`Invalid barrierType: "${raw.barrierType}". Must be one of: ${VALID_BARRIER_TYPES.join(', ')}`);
  }

  // 2. Severity
  let severity: BarrierSeverity = 'moderate';
  if (typeof raw.severity === 'string' && VALID_SEVERITIES.includes(raw.severity.toLowerCase() as BarrierSeverity)) {
    severity = raw.severity.toLowerCase() as BarrierSeverity;
  } else {
    errors.push(`Invalid severity: "${raw.severity}". Must be one of: ${VALID_SEVERITIES.join(', ')}`);
  }

  // 3. Surface Condition
  let surfaceCondition: SurfaceCondition = 'unknown';
  if (typeof raw.surfaceCondition === 'string' && VALID_SURFACE_CONDITIONS.includes(raw.surfaceCondition.toLowerCase() as SurfaceCondition)) {
    surfaceCondition = raw.surfaceCondition.toLowerCase() as SurfaceCondition;
  } else if (raw.surfaceCondition === null || raw.surfaceCondition === undefined) {
    surfaceCondition = 'unknown';
  } else {
    errors.push(`Invalid surfaceCondition: "${raw.surfaceCondition}"`);
  }

  // 4. Boolean or null detections
  const validateBoolOrNull = (val: any, fieldName: string): boolean | null => {
    if (val === true || val === false) return val;
    if (val === null || val === undefined || val === 'unknown') return null;
    errors.push(`Invalid ${fieldName}: must be boolean or null`);
    return null;
  };

  const stairsDetected = validateBoolOrNull(raw.stairsDetected, 'stairsDetected');
  const rampDetected = validateBoolOrNull(raw.rampDetected, 'rampDetected');
  const obstructionDetected = validateBoolOrNull(raw.obstructionDetected, 'obstructionDetected');

  // 5. Obstruction type
  let obstructionType: string | null = null;
  if (typeof raw.obstructionType === 'string') {
    obstructionType = raw.obstructionType.trim().slice(0, 80);
  }

  // 6. Estimated passability
  let estimatedPassability: EstimatedPassability = 'unknown';
  if (typeof raw.estimatedPassability === 'string' && VALID_PASSABILITY.includes(raw.estimatedPassability.toLowerCase() as EstimatedPassability)) {
    estimatedPassability = raw.estimatedPassability.toLowerCase() as EstimatedPassability;
  } else if (raw.estimatedPassability === null || raw.estimatedPassability === undefined) {
    estimatedPassability = 'unknown';
  } else {
    errors.push(`Invalid estimatedPassability: "${raw.estimatedPassability}"`);
  }

  // 7. Confidence (0.0 to 1.0)
  let confidence = 0.5;
  const numConfidence = Number(raw.confidence);
  if (isNaN(numConfidence) || numConfidence < 0 || numConfidence > 1) {
    errors.push(`Invalid confidence: "${raw.confidence}". Must be a number between 0.0 and 1.0`);
  } else {
    confidence = Math.round(numConfidence * 100) / 100;
  }

  // 8. Reasoning Summary
  let reasoningSummary = '';
  if (typeof raw.reasoningSummary === 'string' && raw.reasoningSummary.trim().length > 0) {
    reasoningSummary = raw.reasoningSummary.trim().slice(0, 300);
  } else {
    errors.push('Missing or empty reasoningSummary');
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    normalized: isValid
      ? {
          barrierType,
          severity,
          surfaceCondition,
          stairsDetected,
          rampDetected,
          obstructionDetected,
          obstructionType,
          estimatedPassability,
          confidence,
          reasoningSummary,
        }
      : undefined,
  };
}
