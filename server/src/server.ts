import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyzeBarrierWithGemini } from './geminiProvider';
import { TEST_FIXTURES } from './fixtures';
import { AnalyzeBarrierRequest } from './types';

// Load server-side environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Body parser configuration: support up to 20MB for image data
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const isKeyConfigured = apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey.length > 10;
  
  res.json({
    status: 'healthy',
    service: 'PathSense V0.5 AI Barrier Analysis Server',
    provider: 'Google Gemini',
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    geminiKeyConfigured: Boolean(isKeyConfigured),
    timestamp: new Date().toISOString(),
  });
});

// List available test fixtures
app.get('/api/fixtures', (_req: Request, res: Response) => {
  const fixtures = Object.values(TEST_FIXTURES).map(f => ({
    id: f.id,
    name: f.name,
    className: f.className,
    description: f.description,
    expectedBarrierFamily: f.expectedBarrierFamily,
    expectedSeverityRange: f.expectedSeverityRange,
  }));
  res.json({ fixtures });
});

// Primary AI analysis endpoint
app.post('/api/analyze-barrier', async (req: Request, res: Response) => {
  const requestId = 'req_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  const startTime = Date.now();
  const provider = 'google_gemini';
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  const body: AnalyzeBarrierRequest = req.body || {};
  
  // Observability: Log start without sensitive data
  console.log(`[AI_ANALYSIS_START] requestId=${requestId} provider=${provider} model=${model} hasImage=${Boolean(body.image)} fixtureId=${body.fixtureId || 'none'}`);

  // Special test failure simulation for Test Case F
  if (req.headers['x-simulate-failure'] === 'true' || body.fixtureId === 'simulate-failure') {
    const duration = Date.now() - startTime;
    console.error(`[AI_ANALYSIS_FAILED] requestId=${requestId} durationMs=${duration} provider=${provider} error=Simulated failure`);
    return res.status(503).json({
      error: 'Simulated AI service failure for evaluation testing',
      requestId,
    });
  }

  if (!body.image && !body.fixtureId) {
    const duration = Date.now() - startTime;
    console.error(`[AI_ANALYSIS_FAILED] requestId=${requestId} durationMs=${duration} provider=${provider} error=Missing image`);
    return res.status(400).json({
      error: 'Image is required for barrier analysis',
      requestId,
    });
  }

  try {
    const result = await analyzeBarrierWithGemini({
      base64Image: body.image,
      fixtureId: body.fixtureId,
    });

    const duration = Date.now() - startTime;
    console.log(
      `[AI_ANALYSIS_SUCCESS] requestId=${requestId} durationMs=${duration} provider=${result.metadata.provider} model=${result.metadata.model} barrierType=${result.analysis.barrierType} severity=${result.analysis.severity} confidence=${result.analysis.confidence}`
    );

    return res.json({
      analysis: result.analysis,
      metadata: {
        ...result.metadata,
        processingTimeMs: duration,
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const safeErrorMessage = error?.message || 'An unexpected error occurred during AI analysis';
    console.error(`[AI_ANALYSIS_FAILED] requestId=${requestId} durationMs=${duration} provider=${provider} error=${safeErrorMessage}`);

    return res.status(500).json({
      error: 'AI analysis could not be completed.',
      details: safeErrorMessage,
      requestId,
    });
  }
});

app.listen(PORT, () => {
  console.log(`[PathSense AI Server] running on http://0.0.0.0:${PORT}`);
  console.log(`[PathSense AI Server] Health check: http://localhost:${PORT}/health`);
});
