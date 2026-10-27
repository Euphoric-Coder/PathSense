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
  | 'other';

export type BarrierSeverity = 'low' | 'moderate' | 'high' | 'critical';

export type SurfaceCondition =
  | 'good'
  | 'uneven'
  | 'damaged'
  | 'blocked'
  | 'wet'
  | 'unknown';

export type EstimatedPassability =
  | 'passable'
  | 'difficult'
  | 'likely_impassable'
  | 'unknown';

export interface AIBarrierAnalysis {
  barrierType: BarrierType;
  severity: BarrierSeverity;
  surfaceCondition: SurfaceCondition;
  stairsDetected: boolean | null;
  rampDetected: boolean | null;
  obstructionDetected: boolean | null;
  obstructionType?: string | null;
  estimatedPassability: EstimatedPassability;
  confidence: number;
  reasoningSummary: string;
}

export interface AIAnalysisMetadata {
  provider: string;
  model: string;
  analyzedAt: string;
  processingTimeMs?: number;
}

export interface AnalyzeBarrierRequest {
  image?: string; // base64 string or data URL
  latitude?: number;
  longitude?: number;
  mobilityProfile?: string;
  fixtureId?: string; // Optional fixture trigger for evaluation & testing
}

export interface AnalyzeBarrierResponse {
  analysis: AIBarrierAnalysis;
  metadata: AIAnalysisMetadata;
}
