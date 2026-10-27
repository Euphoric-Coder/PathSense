import { TEST_FIXTURES, TestFixtureDefinition } from '../src/fixtures';
import { validateAndNormalizeAIAnalysis } from '../src/validator';

interface EvaluationResult {
  caseId: string;
  name: string;
  expectedFamily: string[];
  predictedType: string;
  familyMatch: boolean;
  expectedSeverity: string[];
  predictedSeverity: string;
  severityMatch: boolean;
  confidence: number;
  confidenceInRange: boolean;
  validSchema: boolean;
  reasoning: string;
}

async function runEvaluation() {
  console.log('========================================================================');
  console.log('PathSense V0.5: AI Barrier Analysis Evaluation Harness');
  console.log('Evaluating 6 Representative Test Classes (A through F)');
  console.log('========================================================================\n');

  const results: EvaluationResult[] = [];

  for (const [key, fixture] of Object.entries(TEST_FIXTURES)) {
    const rawAnalysis = fixture.simulatedAnalysis;
    const validation = validateAndNormalizeAIAnalysis(rawAnalysis);

    const validSchema = validation.isValid;
    const predicted = validation.normalized || rawAnalysis;

    const familyMatch = fixture.expectedBarrierFamily.includes(predicted.barrierType);
    const severityMatch = fixture.expectedSeverityRange.includes(predicted.severity);
    const confidenceInRange =
      predicted.confidence >= fixture.expectedConfidenceRange[0] &&
      predicted.confidence <= fixture.expectedConfidenceRange[1];

    results.push({
      caseId: key,
      name: fixture.name,
      expectedFamily: fixture.expectedBarrierFamily,
      predictedType: predicted.barrierType,
      familyMatch,
      expectedSeverity: fixture.expectedSeverityRange,
      predictedSeverity: predicted.severity,
      severityMatch,
      confidence: predicted.confidence,
      confidenceInRange,
      validSchema,
      reasoning: predicted.reasoningSummary,
    });
  }

  // Print results table
  console.table(
    results.map(r => ({
      'Test Case': r.name.split(':')[0],
      'Predicted Type': r.predictedType,
      'Type Match': r.familyMatch ? 'PASS' : 'FAIL',
      'Severity': r.predictedSeverity,
      'Sev Match': r.severityMatch ? 'PASS' : 'FAIL',
      'Confidence': `${Math.round(r.confidence * 100)}%`,
      'Conf Valid': r.confidenceInRange ? 'PASS' : 'FAIL',
      'Schema': r.validSchema ? 'VALID' : 'INVALID',
    }))
  );

  console.log('\n--- DETAILED CASE OBSERVATIONS ---');
  results.forEach(r => {
    console.log(`\n[${r.name}]`);
    console.log(`  Expected Type: [${r.expectedFamily.join(', ')}] -> Predicted: ${r.predictedType} (${r.familyMatch ? 'PASS' : 'FAIL'})`);
    console.log(`  Expected Severity: [${r.expectedSeverity.join(', ')}] -> Predicted: ${r.predictedSeverity} (${r.severityMatch ? 'PASS' : 'FAIL'})`);
    console.log(`  Confidence: ${r.confidence} (${r.confidence < 0.65 ? 'LOW CONFIDENCE WARNING TRIGGER' : 'HIGH/MODERATE'})`);
    console.log(`  Reasoning: "${r.reasoning}"`);
    console.log(`  Schema Valid: ${r.validSchema}`);
  });

  const allPassed = results.every(r => r.familyMatch && r.severityMatch && r.validSchema);
  console.log('\n========================================================================');
  console.log(`EVALUATION RESULT: ${allPassed ? 'ALL TEST FIXTURES PASSED' : 'SOME CHECKS FAILED'}`);
  console.log('========================================================================\n');
}

runEvaluation().catch(err => {
  console.error('Evaluation run failed:', err);
  process.exit(1);
});
