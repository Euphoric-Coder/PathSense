import {
  AccessibilityResult,
  Obstruction,
  ProfileId,
  Surface,
  SurfaceCondition,
  PathSegment,
} from '@/src/types/pathsense';
import { getAccessibilityLevel } from '@/src/utils/accessibility';
import { calculateCombinedBarrierPenalty } from './barrierImpact';

interface ProfileWeights {
  stairs: number;
  gradient: number;
  surface: number;
  width: number;
  obstruction: number;
}

const profileWeights: Record<ProfileId, ProfileWeights> = {
  wheelchair: { stairs: 1.0, gradient: 0.9, surface: 0.8, width: 0.9, obstruction: 0.9 },
  crutches: { stairs: 0.7, gradient: 0.8, surface: 0.85, width: 0.5, obstruction: 0.7 },
  elderly: { stairs: 0.75, gradient: 0.85, surface: 0.7, width: 0.55, obstruction: 0.65 },
  stroller: { stairs: 0.95, gradient: 0.65, surface: 0.75, width: 0.8, obstruction: 0.75 },
  general: { stairs: 0.2, gradient: 0.4, surface: 0.5, width: 0.35, obstruction: 0.5 },
};

const stairsBasePenalty: Record<ProfileId, number> = {
  wheelchair: 95,
  stroller: 90,
  crutches: 55,
  elderly: 60,
  general: 15,
};

type ObstructionSeverity = 'none' | 'minor' | 'moderate' | 'severe';

const obstructionSeverityMap: Record<Obstruction, ObstructionSeverity> = {
  none: 'none',
  'parked-two-wheeler': 'minor',
  'parked-vehicle': 'moderate',
  vendor: 'moderate',
  debris: 'moderate',
  'pedestrian-congestion': 'minor',
  construction: 'severe',
};

const obstructionBasePenalty: Record<ObstructionSeverity, number> = {
  none: 0,
  minor: 8,
  moderate: 18,
  severe: 35,
};

type ConditionTier = 'good' | 'moderate' | 'poor';

const conditionTierMap: Record<SurfaceCondition, ConditionTier> = {
  smooth: 'good',
  'minor-wear': 'good',
  uneven: 'moderate',
  damaged: 'poor',
  waterlogged: 'poor',
};

const conditionBasePenalty: Record<ConditionTier, number> = {
  good: 0,
  moderate: 15,
  poor: 30,
};

const surfaceTypeAdjustment: Record<Surface, number> = {
  asphalt: 0,
  concrete: 0,
  pavers: 2,
  gravel: 8,
  mixed: 4,
};

interface GradientBand {
  base: number;
  label: string;
}

function gradientBand(g: number): GradientBand {
  if (g <= 2) return { base: 0, label: '0–2% gradient' };
  if (g <= 5) return { base: 10, label: `${g.toFixed(1)}% gradient` };
  if (g <= 8) return { base: 22, label: `${g.toFixed(1)}% gradient` };
  return { base: 38, label: `${g.toFixed(1)}% gradient` };
}

const gradientProfileMultiplier: Record<ProfileId, number> = {
  wheelchair: 1.0,
  elderly: 0.9,
  crutches: 0.85,
  stroller: 0.7,
  general: 0.4,
};

interface WidthBand {
  base: number;
  label: string;
}

function widthBandWheelchair(w: number): WidthBand {
  if (w >= 1.5) return { base: 0, label: `${w.toFixed(1)} m clear width` };
  if (w >= 1.2) return { base: 8, label: `${w.toFixed(1)} m clear width` };
  if (w >= 0.9) return { base: 22, label: `${w.toFixed(1)} m narrow width` };
  return { base: 40, label: `${w.toFixed(1)} m very narrow width` };
}

function widthBandStroller(w: number): WidthBand {
  if (w >= 1.5) return { base: 0, label: `${w.toFixed(1)} m clear width` };
  if (w >= 1.2) return { base: 6, label: `${w.toFixed(1)} m clear width` };
  if (w >= 0.9) return { base: 16, label: `${w.toFixed(1)} m narrow width` };
  return { base: 32, label: `${w.toFixed(1)} m very narrow width` };
}

function widthBandDefault(w: number): WidthBand {
  if (w >= 1.2) return { base: 0, label: `${w.toFixed(1)} m clear width` };
  if (w >= 0.9) return { base: 8, label: `${w.toFixed(1)} m narrow width` };
  return { base: 18, label: `${w.toFixed(1)} m very narrow width` };
}

function getWidthBand(profile: ProfileId, w: number): WidthBand {
  switch (profile) {
    case 'wheelchair':
      return widthBandWheelchair(w);
    case 'stroller':
      return widthBandStroller(w);
    default:
      return widthBandDefault(w);
  }
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateAccessibilityScore(
  segment: PathSegment,
  profile: ProfileId,
  barrierReports?: import('../types/pathsense').BarrierReport[]
): AccessibilityResult {
  const weights = profileWeights[profile];
  const penalties: { factor: string; reason: string; deduction: number }[] = [];
  const positives: string[] = [];

  if (!segment.stairs) {
    positives.push('Step-free');
  }
  if (segment.rampAvailable && segment.stairs) {
    positives.push('Ramp available alongside stairs');
  }

  const condTier = conditionTierMap[segment.surfaceCondition];
  if (condTier === 'good') {
    positives.push('Good surface condition');
  }
  if (segment.obstruction === 'none') {
    positives.push('No obstructions');
  }
  if (segment.clearWidthM >= 1.5) {
    positives.push('Wide pathway');
  }

  if (segment.stairs) {
    let stairsPenalty = stairsBasePenalty[profile];
    let reason = 'Stairs present';
    if (segment.rampAvailable) {
      stairsPenalty = Math.round(stairsPenalty * 0.15);
      reason = 'Stairs with ramp available';
    } else {
      reason = 'Stairs with no ramp';
    }
    const deduction = Math.round(stairsPenalty * weights.stairs);
    if (deduction > 0) {
      penalties.push({ factor: 'Stairs', reason, deduction });
    }
  }

  const gBand = gradientBand(segment.gradientPercent);
  if (gBand.base > 0) {
    const rawGradient = gBand.base * gradientProfileMultiplier[profile];
    const deduction = Math.round(rawGradient * weights.gradient);
    if (deduction > 0) {
      penalties.push({
        factor: 'Gradient',
        reason: gBand.label,
        deduction,
      });
    }
  }

  const surfAdj = surfaceTypeAdjustment[segment.surface] ?? 0;
  const condBase = conditionBasePenalty[condTier];
  const surfaceTotal = condBase + (condTier !== 'good' ? surfAdj : 0);
  if (surfaceTotal > 0) {
    const deduction = Math.round(surfaceTotal * weights.surface);
    if (deduction > 0) {
      const condLabel =
        condTier === 'moderate'
          ? 'Uneven surface condition'
          : 'Poor surface condition';
      penalties.push({
        factor: 'Surface',
        reason: condLabel,
        deduction,
      });
    }
  }

  const wBand = getWidthBand(profile, segment.clearWidthM);
  if (wBand.base > 0) {
    const deduction = Math.round(wBand.base * weights.width);
    if (deduction > 0) {
      penalties.push({
        factor: 'Width',
        reason: wBand.label,
        deduction,
      });
    }
  }

  const obsSeverity = obstructionSeverityMap[segment.obstruction];
  const obsBase = obstructionBasePenalty[obsSeverity];
  if (obsBase > 0) {
    const deduction = Math.round(obsBase * weights.obstruction);
    if (deduction > 0) {
      penalties.push({
        factor: 'Obstruction',
        reason: titleCase(segment.obstruction),
        deduction,
      });
    }
  }

  const totalDeduction = penalties.reduce((sum, p) => sum + p.deduction, 0);
  let rawScore = 100 - totalDeduction;

  if (barrierReports && barrierReports.length > 0) {
    const { penalty: barrierPenalty, details } = calculateCombinedBarrierPenalty(barrierReports, profile);
    if (barrierPenalty > 0) {
      rawScore -= barrierPenalty;
      details.forEach(d => {
        penalties.push({ factor: 'Barrier Report', reason: d.reason, deduction: d.deduction });
      });
    }
  }

  const score = clampScore(rawScore);
  const level = getAccessibilityLevel(score);

  const sortedPenalties = [...penalties].sort((a, b) => b.deduction - a.deduction);

  return {
    score,
    level,
    penalties: sortedPenalties,
    positives,
  };
}

export function calculateAllProfileScores(segment: PathSegment): {
  profile: ProfileId;
  result: AccessibilityResult;
}[] {
  const profiles: ProfileId[] = ['wheelchair', 'crutches', 'elderly', 'stroller', 'general'];
  return profiles.map((p) => ({
    profile: p,
    result: calculateAccessibilityScore(segment, p),
  }));
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
