import Constants from 'expo-constants';
import { AIBarrierAnalysis, AIAnalysisMetadata, AnalyzeImageResult } from './types';
import { BarrierSeverity, BarrierType } from '@/src/types/pathsense';

export function getAIEndpointUrl(): string {
  if (process.env.EXPO_PUBLIC_AI_API_URL) {
    return process.env.EXPO_PUBLIC_AI_API_URL;
  }

  // Extract host IP from Expo hostUri (works on physical Android device with Expo Go)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host.length > 0) {
      return `http://${host}:3001/api/analyze-barrier`;
    }
  }

  return 'http://localhost:3001/api/analyze-barrier';
}

const ALLOWED_TYPES = new Set<BarrierType>([
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
]);

const ALLOWED_SEVERITIES = new Set<BarrierSeverity>([
  'low',
  'moderate',
  'high',
  'critical',
]);

export function validateClientAIAnalysis(data: any): AIBarrierAnalysis {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid AI response format.');
  }

  const rawType = String(data.barrierType || '').toLowerCase() as BarrierType;
  const barrierType: BarrierType = ALLOWED_TYPES.has(rawType) ? rawType : 'other';

  const rawSeverity = String(data.severity || '').toLowerCase() as BarrierSeverity;
  const severity: BarrierSeverity = ALLOWED_SEVERITIES.has(rawSeverity) ? rawSeverity : 'moderate';

  const surfaceCondition = ['good', 'uneven', 'damaged', 'blocked', 'wet', 'unknown'].includes(data.surfaceCondition)
    ? data.surfaceCondition
    : 'unknown';

  const estimatedPassability = ['passable', 'difficult', 'likely_impassable', 'unknown'].includes(data.estimatedPassability)
    ? data.estimatedPassability
    : 'unknown';

  let confidence = Number(data.confidence);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    confidence = 0.5;
  } else {
    confidence = Math.round(confidence * 100) / 100;
  }

  const reasoningSummary = typeof data.reasoningSummary === 'string' && data.reasoningSummary.trim().length > 0
    ? data.reasoningSummary.trim()
    : 'Accessibility barrier analyzed from photo.';

  return {
    barrierType,
    severity,
    surfaceCondition,
    stairsDetected: typeof data.stairsDetected === 'boolean' ? data.stairsDetected : null,
    rampDetected: typeof data.rampDetected === 'boolean' ? data.rampDetected : null,
    obstructionDetected: typeof data.obstructionDetected === 'boolean' ? data.obstructionDetected : null,
    obstructionType: typeof data.obstructionType === 'string' ? data.obstructionType : null,
    estimatedPassability,
    confidence,
    reasoningSummary,
  };
}

export async function callAIEndpoint(payload: {
  image?: string;
  latitude?: number;
  longitude?: number;
  mobilityProfile?: string;
  fixtureId?: string;
}): Promise<AnalyzeImageResult> {
  const endpoint = getAIEndpointUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let errMsg = 'AI analysis could not be completed.';
      try {
        const errJson = await res.json();
        if (errJson && errJson.error) {
          errMsg = errJson.error;
        }
      } catch (_) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    const validatedAnalysis = validateClientAIAnalysis(data.analysis);

    const metadata: AIAnalysisMetadata = {
      provider: data.metadata?.provider || 'gemini',
      model: data.metadata?.model || 'gemini-1.5-flash',
      analyzedAt: data.metadata?.analyzedAt || new Date().toISOString(),
      processingTimeMs: data.metadata?.processingTimeMs,
    };

    return {
      analysis: validatedAnalysis,
      metadata,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('AI analysis request timed out. Please try again.');
    }
    const msg = err.message || '';
    if (msg.includes('Network request failed') || msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED')) {
      throw new Error('Cannot connect to PathSense AI server. Please verify the AI endpoint is accessible.');
    }
    throw new Error(msg || 'AI analysis could not be completed.');
  }
}
