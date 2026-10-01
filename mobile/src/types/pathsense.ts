export type LandmarkType =
  | 'junction'
  | 'pharmacy'
  | 'park'
  | 'market'
  | 'transit'
  | 'clinic'
  | 'community'
  | 'school';

export interface Landmark {
  id: string;
  name: string;
  type: LandmarkType;
  latitude: number;
  longitude: number;
  isMock: true;
}

export type Surface =
  | 'asphalt'
  | 'concrete'
  | 'pavers'
  | 'gravel'
  | 'mixed';

export type SurfaceCondition =
  | 'smooth'
  | 'minor-wear'
  | 'uneven'
  | 'damaged'
  | 'waterlogged';

export type Obstruction =
  | 'none'
  | 'parked-two-wheeler'
  | 'parked-vehicle'
  | 'vendor'
  | 'construction'
  | 'debris'
  | 'pedestrian-congestion';

export type Lighting = 'good' | 'moderate' | 'poor';

export type DataStatus = 'synthetic_mock';

export interface AccessibilityScores {
  wheelchair: number;
  crutches: number;
  elderly: number;
  stroller: number;
  general: number;
}

export type ProfileId =
  | 'wheelchair'
  | 'crutches'
  | 'elderly'
  | 'stroller'
  | 'general';

export interface PathSegment {
  id: string;
  startNodeId: string;
  endNodeId: string;
  distanceMeters: number;
  surface: Surface;
  surfaceCondition: SurfaceCondition;
  clearWidthM: number;
  gradientPercent: number;
  stairs: boolean;
  rampAvailable: boolean;
  obstruction: Obstruction;
  lighting: Lighting;
  scores: AccessibilityScores;
  dataStatus: DataStatus;
  notes: string;
}

export type BarrierType =
  | 'stairs'
  | 'missing_ramp'
  | 'broken_surface'
  | 'construction'
  | 'obstruction'
  | 'narrow_path'
  | 'drain_issue'
  | 'waterlogging'
  | 'steep_gradient'
  | 'other'
  | 'uneven-surface' // keep for backward compatibility
  | 'drain-cover-gap'
  | 'encroachment';

export type BarrierSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type BarrierStatus = 'active' | 'resolved' | 'dismissed' | 'open' | 'reported' | 'verified';

export interface Barrier {
  id: string;
  segmentId: string;
  type: BarrierType;
  severity: BarrierSeverity;
  description: string;
  aiConfidence: number;
  verificationCount: number;
  status: BarrierStatus;
  isMock: true;
}

export interface BarrierReport {
  id: string;
  segmentId: string;
  latitude: number;
  longitude: number;
  barrierType: BarrierType;
  severity: BarrierSeverity;
  description?: string;
  imageUri?: string;
  source: 'manual' | 'ai_assisted';
  status: BarrierStatus;
  createdAt: string;
  updatedAt?: string;
  isMock?: boolean;
}

export interface MobilityProfile {
  id: ProfileId;
  label: string;
  description: string;
}

export type AccessibilityLevel = 'Accessible' | 'Moderate' | 'Difficult';

export interface Penalty {
  factor: string;
  reason: string;
  deduction: number;
}

export interface AccessibilityResult {
  score: number;
  level: AccessibilityLevel;
  penalties: Penalty[];
  positives: string[];
}

export type RouteMode = 'shortest' | 'balanced' | 'accessible';

export interface RouteMetrics {
  totalDistanceMeters: number;
  averageAccessibilityScore: number;
  minimumAccessibilityScore: number;
  difficultSegmentCount: number;
  moderateSegmentCount: number;
  stairsWithoutRampCount: number;
  constructionCount: number;
  estimatedWalkingMinutes: number;
}

export interface RouteResult {
  mode: RouteMode;
  nodeIds: string[];
  segmentIds: string[];
  totalDistanceMeters: number;
  averageAccessibilityScore: number;
  minimumAccessibilityScore: number;
  totalCost: number;
  warnings: string[];
  metrics: RouteMetrics;
  explanation: string;
}
