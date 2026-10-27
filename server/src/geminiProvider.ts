import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIBarrierAnalysis, AIAnalysisMetadata } from './types';
import { validateAndNormalizeAIAnalysis } from './validator';
import { TEST_FIXTURES } from './fixtures';

const SYSTEM_PROMPT = `You are an expert pedestrian accessibility barrier analyst.
Evaluate ONLY visible physical accessibility conditions from pedestrian walkway/pathway images.
Do not infer medical conditions or identities. Do not identify people, faces, or vehicle license plates.

You must return a valid JSON object with the following fields:
1. "barrierType": Strictly one of: "stairs", "missing_ramp", "broken_surface", "construction", "obstruction", "narrow_path", "drain_issue", "waterlogging", "steep_gradient", "other".
2. "severity": Strictly one of: "low", "moderate", "high", "critical".
   - low: Minor inconvenience, easily passable with care.
   - moderate: Noticeable accessibility impact.
   - high: Major difficulty for wheelchair/crutches/strollers.
   - critical: Route is completely blocked or impassable.
3. "surfaceCondition": Strictly one of: "good", "uneven", "damaged", "blocked", "wet", "unknown".
4. "stairsDetected": boolean (true/false) or null.
5. "rampDetected": boolean (true/false) or null.
6. "obstructionDetected": boolean (true/false) or null.
7. "obstructionType": short string description of visible obstruction (e.g. "parked vehicle", "barricades"), or null.
8. "estimatedPassability": Strictly one of: "passable", "difficult", "likely_impassable", "unknown".
9. "confidence": float between 0.0 and 1.0 representing physical observation certainty.
10. "reasoningSummary": short, neutral 1-2 sentence observational summary of visible conditions (max 150 chars). Do not use absolute claims.

If the image shows an ordinary sidewalk with no clear barrier, set "barrierType" to "other", "severity" to "low", "estimatedPassability" to "passable", and "confidence" below 0.65.
Return JSON ONLY. No markdown fences, no explanatory chat outside JSON.`;

export interface AnalyzeImageOptions {
  base64Image?: string;
  mimeType?: string;
  fixtureId?: string;
  timeoutMs?: number;
}

export async function analyzeBarrierWithGemini(
  options: AnalyzeImageOptions
): Promise<{ analysis: AIBarrierAnalysis; metadata: AIAnalysisMetadata }> {
  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const isKeyConfigured = apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey.length > 10;
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  // 1. Check if an explicit test fixture is requested
  if (options.fixtureId && TEST_FIXTURES[options.fixtureId]) {
    const fixture = TEST_FIXTURES[options.fixtureId];
    const duration = Date.now() - startTime;
    return {
      analysis: fixture.simulatedAnalysis,
      metadata: {
        provider: 'fixture_simulation',
        model: fixture.id,
        analyzedAt: new Date().toISOString(),
        processingTimeMs: duration,
      },
    };
  }

  // 2. If Gemini API key is missing or placeholder, provide graceful fallback
  if (!isKeyConfigured) {
    // Check if the image matches any known test case heuristics or return default
    // We check options.fixtureId or fallback to construction simulation as default demo fixture
    console.warn('[GeminiProvider] GEMINI_API_KEY is not configured in server/.env. Using default test fixture simulation.');
    const fallbackFixture = TEST_FIXTURES['case-a-construction'];
    const duration = Date.now() - startTime;
    return {
      analysis: fallbackFixture.simulatedAnalysis,
      metadata: {
        provider: 'gemini_simulated_fixture',
        model: 'gemini-1.5-flash (offline-fixture)',
        analyzedAt: new Date().toISOString(),
        processingTimeMs: duration,
      },
    };
  }

  // 3. Make real Gemini 1.5 Flash call
  if (!options.base64Image) {
    throw new Error('No image data provided for barrier analysis');
  }

  // Clean base64 data if it contains data URI prefix
  let cleanBase64 = options.base64Image;
  let detectedMime = options.mimeType || 'image/jpeg';
  if (cleanBase64.startsWith('data:')) {
    const matches = cleanBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      detectedMime = matches[1];
      cleanBase64 = matches[2];
    } else {
      const commaIdx = cleanBase64.indexOf(',');
      if (commaIdx !== -1) {
        cleanBase64 = cleanBase64.slice(commaIdx + 1);
      }
    }
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
    systemInstruction: SYSTEM_PROMPT,
  });

  const timeoutMs = options.timeoutMs || Number(process.env.AI_TIMEOUT_MS) || 15000;

  // Execute with timeout race
  const apiCallPromise = (async () => {
    const result = await model.generateContent([
      {
        text: 'Analyze the pedestrian accessibility barrier visible in this image. Return structured JSON.',
      },
      {
        inlineData: {
          mimeType: detectedMime,
          data: cleanBase64,
        },
      },
    ]);

    const responseText = result.response.text();
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      // Attempt to clean code blocks if present
      const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const validation = validateAndNormalizeAIAnalysis(parsed);
    if (!validation.isValid || !validation.normalized) {
      throw new Error(`Malformed AI response: ${validation.errors.join('; ')}`);
    }

    return validation.normalized;
  })();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`AI analysis timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const normalized = await Promise.race([apiCallPromise, timeoutPromise]);
  const processingTimeMs = Date.now() - startTime;

  return {
    analysis: normalized,
    metadata: {
      provider: 'google_gemini',
      model: modelName,
      analyzedAt: new Date().toISOString(),
      processingTimeMs,
    },
  };
}
