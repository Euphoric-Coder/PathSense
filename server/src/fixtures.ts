import { AIBarrierAnalysis, BarrierType, BarrierSeverity } from './types';

export interface TestFixtureDefinition {
  id: string;
  name: string;
  className: string;
  description: string;
  expectedBarrierFamily: BarrierType[];
  expectedSeverityRange: BarrierSeverity[];
  expectedStairs: boolean | null;
  expectedRamp: boolean | null;
  expectedObstruction: boolean | null;
  expectedConfidenceRange: [number, number];
  simulatedAnalysis: AIBarrierAnalysis;
}

export const TEST_FIXTURES: Record<string, TestFixtureDefinition> = {
  'case-a-construction': {
    id: 'case-a-construction',
    name: 'Test Case A: Construction Barricade',
    className: 'A. Construction',
    description: 'Temporary construction barricades and roadwork cones blocking pedestrian walkway',
    expectedBarrierFamily: ['construction', 'obstruction'],
    expectedSeverityRange: ['high', 'critical'],
    expectedStairs: false,
    expectedRamp: null,
    expectedObstruction: true,
    expectedConfidenceRange: [0.85, 0.98],
    simulatedAnalysis: {
      barrierType: 'construction',
      severity: 'high',
      surfaceCondition: 'blocked',
      stairsDetected: false,
      rampDetected: null,
      obstructionDetected: true,
      obstructionType: 'construction barricades and warning tape',
      estimatedPassability: 'likely_impassable',
      confidence: 0.92,
      reasoningSummary: 'Temporary barricades and construction work completely block the designated pedestrian path.',
    },
  },

  'case-b-stairs': {
    id: 'case-b-stairs',
    name: 'Test Case B: Stairs Without Ramp',
    className: 'B. Stairs',
    description: 'Outdoor flight of concrete stairs with no visible wheelchair ramp or lift',
    expectedBarrierFamily: ['stairs', 'missing_ramp'],
    expectedSeverityRange: ['high', 'critical'],
    expectedStairs: true,
    expectedRamp: false,
    expectedObstruction: false,
    expectedConfidenceRange: [0.85, 0.99],
    simulatedAnalysis: {
      barrierType: 'stairs',
      severity: 'critical',
      surfaceCondition: 'good',
      stairsDetected: true,
      rampDetected: false,
      obstructionDetected: false,
      obstructionType: null,
      estimatedPassability: 'likely_impassable',
      confidence: 0.95,
      reasoningSummary: 'Concrete stairs detected with multiple steps. No bypass ramp or wheelchair ramp is visible.',
    },
  },

  'case-c-broken-surface': {
    id: 'case-c-broken-surface',
    name: 'Test Case C: Broken/Uneven Pavement',
    className: 'C. Broken Surface',
    description: 'Cracked, broken sidewalk slabs with exposed soil and uneven height offsets',
    expectedBarrierFamily: ['broken_surface'],
    expectedSeverityRange: ['moderate', 'high'],
    expectedStairs: false,
    expectedRamp: null,
    expectedObstruction: false,
    expectedConfidenceRange: [0.80, 0.95],
    simulatedAnalysis: {
      barrierType: 'broken_surface',
      severity: 'high',
      surfaceCondition: 'damaged',
      stairsDetected: false,
      rampDetected: null,
      obstructionDetected: false,
      obstructionType: null,
      estimatedPassability: 'difficult',
      confidence: 0.88,
      reasoningSummary: 'Severely cracked and displaced sidewalk pavers with uneven height differential exceeding 5 cm.',
    },
  },

  'case-d-obstruction': {
    id: 'case-d-obstruction',
    name: 'Test Case D: Parked Vehicle Obstruction',
    className: 'D. Parked Vehicle',
    description: 'Two-wheelers / scooter parked across the sidewalk footpath',
    expectedBarrierFamily: ['obstruction'],
    expectedSeverityRange: ['moderate', 'high'],
    expectedStairs: false,
    expectedRamp: null,
    expectedObstruction: true,
    expectedConfidenceRange: [0.80, 0.95],
    simulatedAnalysis: {
      barrierType: 'obstruction',
      severity: 'moderate',
      surfaceCondition: 'uneven',
      stairsDetected: false,
      rampDetected: null,
      obstructionDetected: true,
      obstructionType: 'parked two-wheeler vehicle',
      estimatedPassability: 'difficult',
      confidence: 0.89,
      reasoningSummary: 'Motorcycle parked horizontally across pedestrian path, leaving insufficient clearance for wheelchairs.',
    },
  },

  'case-e-narrow-path': {
    id: 'case-e-narrow-path',
    name: 'Test Case E: Narrow Pathway',
    className: 'E. Narrow Pathway',
    description: 'Path restricted between wall and utility poles to under 70cm width',
    expectedBarrierFamily: ['narrow_path', 'obstruction'],
    expectedSeverityRange: ['moderate', 'high'],
    expectedStairs: false,
    expectedRamp: null,
    expectedObstruction: true,
    expectedConfidenceRange: [0.75, 0.92],
    simulatedAnalysis: {
      barrierType: 'narrow_path',
      severity: 'high',
      surfaceCondition: 'uneven',
      stairsDetected: false,
      rampDetected: null,
      obstructionDetected: true,
      obstructionType: 'utility pole encroachment',
      estimatedPassability: 'difficult',
      confidence: 0.84,
      reasoningSummary: 'Pathway width narrows significantly due to pole placement, preventing standard wheelchair transit.',
    },
  },

  'case-f-ambiguous': {
    id: 'case-f-ambiguous',
    name: 'Test Case F: Ambiguous / No Clear Barrier',
    className: 'F. Ambiguous / Clear',
    description: 'Ordinary sidewalk in acceptable condition with minor shadows and no clear barrier',
    expectedBarrierFamily: ['other'],
    expectedSeverityRange: ['low'],
    expectedStairs: false,
    expectedRamp: null,
    expectedObstruction: false,
    expectedConfidenceRange: [0.40, 0.64],
    simulatedAnalysis: {
      barrierType: 'other',
      severity: 'low',
      surfaceCondition: 'good',
      stairsDetected: false,
      rampDetected: null,
      obstructionDetected: false,
      obstructionType: null,
      estimatedPassability: 'passable',
      confidence: 0.52, // Low confidence (< 0.65) triggers low confidence warning
      reasoningSummary: 'Clear pedestrian walkway with no significant physical mobility barrier detected. Ordinary pavement.',
    },
  },
};
