import {
  AccessibilityLevel,
  ProfileId,
} from '@/src/types/pathsense';

export const COLOR_ACCESSIBLE = '#1B9E5B';
export const COLOR_MODERATE = '#E08A1E';
export const COLOR_DIFFICULT = '#D43A2F';

export function getAccessibilityLevel(score: number): AccessibilityLevel {
  if (score >= 80) return 'Accessible';
  if (score >= 50) return 'Moderate';
  return 'Difficult';
}

export function getColorForLevel(level: AccessibilityLevel): string {
  switch (level) {
    case 'Accessible':
      return COLOR_ACCESSIBLE;
    case 'Moderate':
      return COLOR_MODERATE;
    case 'Difficult':
      return COLOR_DIFFICULT;
  }
}

export function getColorForScore(score: number): string {
  return getColorForLevel(getAccessibilityLevel(score));
}

export const profileLabelMap: Record<ProfileId, string> = {
  wheelchair: 'Wheelchair',
  crutches: 'Crutches / Temporary Injury',
  elderly: 'Reduced Mobility',
  stroller: 'Stroller',
  general: 'General Mobility',
};

export const compactProfileLabelMap: Record<ProfileId, string> = {
  wheelchair: 'Wheelchair',
  crutches: 'Crutches',
  elderly: 'Reduced Mobility',
  stroller: 'Stroller',
  general: 'General',
};
