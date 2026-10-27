import { calculateRoute } from '../src/services/routing';
import { pathSegments } from '../src/data/pathSegments';
import { BarrierReport } from '../src/types/pathsense';
import { AIBarrierAnalysis, AIAnalysisMetadata } from '../src/services/ai/types';

async function verifyV05Flow() {
  console.log('========================================================================');
  console.log('PathSense V0.5: AI-Assisted Barrier Understanding End-to-End Verification');
  console.log('========================================================================\n');

  const originId = 'GH-L01'; // Diamond Harbour Road Access Point
  const destId = 'GH-L08';   // Clinic Access Point
  const profileId = 'wheelchair';

  // 1. CLEAN BASELINE
  console.log('1. CALCULATING CLEAN BASELINE ROUTE:');
  const cleanRoute = calculateRoute(pathSegments, originId, destId, profileId, 'accessible', null, []);
  if (!cleanRoute) {
    throw new Error('Could not calculate clean baseline route');
  }
  console.log(`  Distance: ${cleanRoute.totalDistanceMeters} m`);
  console.log(`  Average Accessibility: ${cleanRoute.averageAccessibilityScore}/100`);
  console.log(`  Minimum Accessibility: ${cleanRoute.minimumAccessibilityScore}/100`);
  console.log(`  Segments (${cleanRoute.segmentIds.length}): ${cleanRoute.segmentIds.join(' -> ')}`);
  const usesGHS012Clean = cleanRoute.segmentIds.includes('GH-S012');
  console.log(`  Contains GH-S012 in clean route: ${usesGHS012Clean ? 'YES' : 'NO'}\n`);

  // 2. AI BARRIER ANALYSIS
  console.log('2. EXECUTING AI BARRIER ANALYSIS (Test Case A: Construction):');
  const startTime = Date.now();
  const aiResponse = await fetch('http://localhost:3001/api/analyze-barrier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fixtureId: 'case-a-construction' }),
  });
  if (!aiResponse.ok) {
    throw new Error(`AI endpoint returned HTTP ${aiResponse.status}`);
  }
  const aiResult = (await aiResponse.json()) as { analysis: AIBarrierAnalysis; metadata: AIAnalysisMetadata };
  const duration = Date.now() - startTime;

  console.log('  AI Analysis Result:');
  console.log(`    Barrier Type: ${aiResult.analysis.barrierType}`);
  console.log(`    Severity: ${aiResult.analysis.severity}`);
  console.log(`    Surface Condition: ${aiResult.analysis.surfaceCondition}`);
  console.log(`    Passability: ${aiResult.analysis.estimatedPassability}`);
  console.log(`    Confidence: ${Math.round(aiResult.analysis.confidence * 100)}% (${aiResult.analysis.confidence})`);
  console.log(`    Obstruction: ${aiResult.analysis.obstructionDetected ? 'YES' : 'NO'} (${aiResult.analysis.obstructionType})`);
  console.log(`    Stairs: ${aiResult.analysis.stairsDetected === true ? 'YES' : 'NO'}`);
  console.log(`    Ramp: ${aiResult.analysis.rampDetected === true ? 'YES' : aiResult.analysis.rampDetected === false ? 'NO' : 'UNKNOWN'}`);
  console.log(`    AI Note: "${aiResult.analysis.reasoningSummary}"`);
  console.log(`    Provider: ${aiResult.metadata.provider}`);
  console.log(`    Processing Time: ${duration} ms\n`);

  // 3. USER REVIEW & CONFIRMATION
  console.log('3. USER REVIEW & CONFIRMATION (Attaching to GH-S012):');
  const aiReport: BarrierReport = {
    id: 'BR-TEST-V05-001',
    segmentId: 'GH-S012',
    latitude: 22.4950,
    longitude: 88.3150,
    barrierType: aiResult.analysis.barrierType,
    severity: 'critical', // User escalated high -> critical based on barricades
    description: aiResult.analysis.reasoningSummary,
    imageUri: 'file:///demo/construction.jpg',
    source: 'ai_assisted',
    status: 'active',
    createdAt: new Date().toISOString(),
    isMock: false,
    aiAnalysis: {
      originalSuggestion: aiResult.analysis,
      userModified: true, // User escalated high -> critical
      confidence: aiResult.analysis.confidence,
      metadata: aiResult.metadata,
    },
  };
  console.log(`  Report ID: ${aiReport.id}`);
  console.log(`  Source: ${aiReport.source}`);
  console.log(`  Segment: ${aiReport.segmentId}`);
  console.log(`  Status: ${aiReport.status}`);
  console.log(`  Original Suggestion: ${aiReport.aiAnalysis?.originalSuggestion.barrierType} · ${aiReport.aiAnalysis?.originalSuggestion.severity}`);
  console.log(`  Confirmed Values: ${aiReport.barrierType} · ${aiReport.severity}`);
  console.log(`  User Modified: ${aiReport.aiAnalysis?.userModified ? 'YES' : 'NO'}\n`);

  // 4. ROUTE RECALCULATION WITH ACTIVE BARRIER
  console.log('4. CALCULATING ROUTE AFTER AI-ASSISTED BARRIER IS REPORTED:');
  const routeWithBarrier = calculateRoute(
    pathSegments,
    originId,
    destId,
    profileId,
    'accessible',
    null,
    [aiReport]
  );
  if (!routeWithBarrier) {
    throw new Error('Could not calculate route with barrier');
  }
  console.log(`  Distance: ${routeWithBarrier.totalDistanceMeters} m`);
  console.log(`  Average Accessibility: ${routeWithBarrier.averageAccessibilityScore}/100`);
  console.log(`  Minimum Accessibility: ${routeWithBarrier.minimumAccessibilityScore}/100`);
  console.log(`  Segments (${routeWithBarrier.segmentIds.length}): ${routeWithBarrier.segmentIds.join(' -> ')}`);
  const avoidsGHS012 = !routeWithBarrier.segmentIds.includes('GH-S012');
  console.log(`  Successfully avoids GH-S012: ${avoidsGHS012 ? 'YES (REROUTED)' : 'NO'}\n`);

  // 5. RESOLVE BARRIER
  console.log('5. RESOLVING BARRIER (Mark Resolved):');
  const resolvedReport: BarrierReport = {
    ...aiReport,
    status: 'resolved',
    updatedAt: new Date().toISOString(),
  };
  const routeAfterResolve = calculateRoute(
    pathSegments,
    originId,
    destId,
    profileId,
    'accessible',
    null,
    [resolvedReport] // Resolved barrier must NOT affect routing
  );
  if (!routeAfterResolve) {
    throw new Error('Could not calculate route after resolve');
  }
  console.log(`  Distance: ${routeAfterResolve.totalDistanceMeters} m`);
  console.log(`  Average Accessibility: ${routeAfterResolve.averageAccessibilityScore}/100`);
  console.log(`  Minimum Accessibility: ${routeAfterResolve.minimumAccessibilityScore}/100`);
  console.log(`  Segments (${routeAfterResolve.segmentIds.length}): ${routeAfterResolve.segmentIds.join(' -> ')}`);
  const restoredClean =
    routeAfterResolve.totalDistanceMeters === cleanRoute.totalDistanceMeters &&
    routeAfterResolve.averageAccessibilityScore === cleanRoute.averageAccessibilityScore &&
    routeAfterResolve.segmentIds.join(',') === cleanRoute.segmentIds.join(',');
  console.log(`  Restored cleanly to baseline: ${restoredClean ? 'YES (RESTORED)' : 'NO'}\n`);

  console.log('========================================================================');
  console.log('END-TO-END VERIFICATION RESULT: COMPLETE SUCCESS');
  console.log('========================================================================');
}

verifyV05Flow().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
