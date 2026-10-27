import { BarrierSeverity, BarrierType } from '@/src/types/pathsense';

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
  confidence: number; // 0.0 -> 1.0
  reasoningSummary: string;
}

export interface AIAnalysisMetadata {
  provider: string;
  model: string;
  analyzedAt: string;
  processingTimeMs?: number;
}

export interface AnalyzeImageResult {
  analysis: AIBarrierAnalysis;
  metadata: AIAnalysisMetadata;
}
