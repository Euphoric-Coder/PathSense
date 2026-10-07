import {
  PathSegment,
  ProfileId,
  RouteMode,
  RouteResult,
  RouteMetrics,
} from '@/src/types/pathsense';
import { calculateAccessibilityScore } from '@/src/services/accessibilityScoring';
import { getAccessibilityLevel } from '@/src/utils/accessibility';

export const ROUTE_MODE_WEIGHTS: Record<RouteMode, { distance: number; accessibility: number }> = {
  shortest: { distance: 1.0, accessibility: 0.0 },
  balanced: { distance: 0.5, accessibility: 0.5 },
  accessible: { distance: 0.2, accessibility: 0.8 },
};

export const ROUTE_MODE_LABELS: Record<RouteMode, string> = {
  shortest: 'Shortest',
  balanced: 'Balanced',
  accessible: 'Most Accessible',
};

const MAX_REASONABLE_SEGMENT_DISTANCE = 200;
const HARD_BARRIER_PENALTY = 10000;
const WALKING_SPEED_MPS = 1.3;
const ACCESSIBILITY_WALKING_SPEED: Record<ProfileId, number> = {
  wheelchair: 1.1,
  crutches: 1.0,
  elderly: 0.9,
  stroller: 1.1,
  general: 1.3,
};

export interface GraphEdge {
  segment: PathSegment;
  toNodeId: string;
  accessibilityScore: number;
  accessibilityPenalty: number;
  normalizedDistance: number;
  isHardBarrier: boolean;
  activeBarrierCount: number;
  criticalBarrierCount: number;
}

export type AdjacencyList = Map<string, GraphEdge[]>;

export function buildAdjacencyList(
  segments: PathSegment[],
  profile: ProfileId,
  barrierReports?: import('../types/pathsense').BarrierReport[]
): AdjacencyList {
  const adj: AdjacencyList = new Map();

  const barriersBySegment = new Map<string, import('../types/pathsense').BarrierReport[]>();
  if (barrierReports) {
    for (const report of barrierReports) {
      const existing = barriersBySegment.get(report.segmentId) ?? [];
      existing.push(report);
      barriersBySegment.set(report.segmentId, existing);
    }
  }

  for (const seg of segments) {
    const reportsForSeg = barriersBySegment.get(seg.id) ?? [];
    const result = calculateAccessibilityScore(seg, profile, reportsForSeg);
    const accessibilityScore = result.score;
    const accessibilityPenalty = 100 - accessibilityScore;
    const normalizedDistance = Math.min(
      1,
      seg.distanceMeters / MAX_REASONABLE_SEGMENT_DISTANCE,
    );
    const isHardBarrier =
      (profile === 'wheelchair' || profile === 'stroller') &&
      seg.stairs &&
      !seg.rampAvailable;
    
    let activeBarrierCount = 0;
    let criticalBarrierCount = 0;
    for (const report of reportsForSeg) {
      if (['active', 'open', 'reported'].includes(report.status)) {
        activeBarrierCount++;
        if (report.severity === 'critical' || report.severity === 'high') {
          criticalBarrierCount++;
        }
      }
    }

    const forwardEdge: GraphEdge = {
      segment: seg,
      toNodeId: seg.endNodeId,
      accessibilityScore,
      accessibilityPenalty,
      normalizedDistance,
      isHardBarrier,
      activeBarrierCount,
      criticalBarrierCount,
    };
    const reverseEdge: GraphEdge = {
      segment: seg,
      toNodeId: seg.startNodeId,
      accessibilityScore,
      accessibilityPenalty,
      normalizedDistance,
      isHardBarrier,
      activeBarrierCount,
      criticalBarrierCount,
    };

    const forwardList = adj.get(seg.startNodeId) ?? [];
    forwardList.push(forwardEdge);
    adj.set(seg.startNodeId, forwardList);

    const reverseList = adj.get(seg.endNodeId) ?? [];
    reverseList.push(reverseEdge);
    adj.set(seg.endNodeId, reverseList);
  }

  return adj;
}

function computeEdgeCost(
  edge: GraphEdge,
  mode: RouteMode,
): number {
  const weights = ROUTE_MODE_WEIGHTS[mode];
  const baseCost =
    weights.distance * edge.normalizedDistance +
    weights.accessibility * (edge.accessibilityPenalty / 100);

  if (edge.isHardBarrier) {
    return baseCost + HARD_BARRIER_PENALTY;
  }

  return baseCost;
}

interface DijkstraResult {
  cost: number;
  nodeIds: string[];
  segmentIds: string[];
  edges: GraphEdge[];
}

function dijkstra(
  adj: AdjacencyList,
  startNodeId: string,
  endNodeId: string,
  mode: RouteMode,
): DijkstraResult | null {
  const distances = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; edge: GraphEdge } | null>();
  const visited = new Set<string>();

  for (const nodeId of adj.keys()) {
    distances.set(nodeId, Infinity);
    previous.set(nodeId, null);
  }
  distances.set(startNodeId, 0);

  const queue: { nodeId: string; cost: number }[] = [{ nodeId: startNodeId, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;

    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);

    if (current.nodeId === endNodeId) break;

    const edges = adj.get(current.nodeId);
    if (!edges) continue;

    for (const edge of edges) {
      if (visited.has(edge.toNodeId)) continue;

      const edgeCost = computeEdgeCost(edge, mode);
      const newCost = current.cost + edgeCost;
      const existingCost = distances.get(edge.toNodeId) ?? Infinity;

      if (newCost < existingCost) {
        distances.set(edge.toNodeId, newCost);
        previous.set(edge.toNodeId, { nodeId: current.nodeId, edge });
        queue.push({ nodeId: edge.toNodeId, cost: newCost });
      }
    }
  }

  const finalCost = distances.get(endNodeId);
  if (finalCost === undefined || finalCost === Infinity) return null;

  const nodeIds: string[] = [];
  const segmentIds: string[] = [];
  const edges: GraphEdge[] = [];
  let current: string | null = endNodeId;

  while (current !== null) {
    nodeIds.unshift(current);
    const prev = previous.get(current);
    if (prev) {
      segmentIds.unshift(prev.edge.segment.id);
      edges.unshift(prev.edge);
      current = prev.nodeId;
    } else {
      current = null;
    }
  }

  return { cost: finalCost, nodeIds, segmentIds, edges };
}

function computeMetrics(
  edges: GraphEdge[],
  profile: ProfileId,
): RouteMetrics {
  let totalDistanceMeters = 0;
  let totalAccessibility = 0;
  let minimumAccessibilityScore = 100;
  let difficultSegmentCount = 0;
  let moderateSegmentCount = 0;
  let stairsWithoutRampCount = 0;
  let constructionCount = 0;
  let activeBarrierCount = 0;
  let criticalBarrierCount = 0;

  for (const edge of edges) {
    totalDistanceMeters += edge.segment.distanceMeters;
    totalAccessibility += edge.accessibilityScore;
    minimumAccessibilityScore = Math.min(minimumAccessibilityScore, edge.accessibilityScore);

    const level = getAccessibilityLevel(edge.accessibilityScore);
    if (level === 'Difficult') difficultSegmentCount++;
    if (level === 'Moderate') moderateSegmentCount++;

    if (edge.segment.stairs && !edge.segment.rampAvailable) {
      stairsWithoutRampCount++;
    }
    if (edge.segment.obstruction === 'construction') {
      constructionCount++;
    }
    activeBarrierCount += edge.activeBarrierCount;
    criticalBarrierCount += edge.criticalBarrierCount;
  }

  const segmentCount = edges.length;
  const averageAccessibilityScore =
    segmentCount > 0 ? Math.round(totalAccessibility / segmentCount) : 0;
  const minimumScore = segmentCount > 0 ? minimumAccessibilityScore : 0;
  const speed = ACCESSIBILITY_WALKING_SPEED[profile];
  const estimatedWalkingMinutes = Math.max(
    1,
    Math.round(totalDistanceMeters / speed / 60),
  );

  return {
    totalDistanceMeters,
    averageAccessibilityScore,
    minimumAccessibilityScore: minimumScore,
    difficultSegmentCount,
    moderateSegmentCount,
    stairsWithoutRampCount,
    constructionCount,
    activeBarrierCount,
    criticalBarrierCount,
    estimatedWalkingMinutes,
  };
}

function buildWarnings(
  edges: GraphEdge[],
  metrics: RouteMetrics,
): string[] {
  const warnings: string[] = [];

  if (metrics.stairsWithoutRampCount > 0) {
    warnings.push('Stairs without ramp');
  }
  if (metrics.constructionCount > 0) {
    warnings.push('Construction');
  }
  if (metrics.difficultSegmentCount > 0) {
    warnings.push(`${metrics.difficultSegmentCount} difficult segment${metrics.difficultSegmentCount > 1 ? 's' : ''}`);
  }
  if (metrics.moderateSegmentCount > 0 && metrics.difficultSegmentCount === 0) {
    warnings.push(`${metrics.moderateSegmentCount} moderate segment${metrics.moderateSegmentCount > 1 ? 's' : ''}`);
  }

  const hasHardBarrier = edges.some((e) => e.isHardBarrier);
  if (hasHardBarrier) {
    warnings.push('No fully step-free route — includes hard barrier');
  }

  return warnings;
}

function buildExplanation(
  mode: RouteMode,
  metrics: RouteMetrics,
  shortestMetrics: RouteMetrics | null,
): string {
  if (mode === 'shortest') {
    if (metrics.difficultSegmentCount > 0 || metrics.stairsWithoutRampCount > 0) {
      return `Shortest route, but includes ${metrics.difficultSegmentCount} lower-accessibility segment${metrics.difficultSegmentCount !== 1 ? 's' : ''}.`;
    }
    return 'Shortest route with no accessibility issues.';
  }

  if (mode === 'accessible') {
    if (shortestMetrics && shortestMetrics.totalDistanceMeters > 0) {
      const extraM = metrics.totalDistanceMeters - shortestMetrics.totalDistanceMeters;
      if (extraM > 20) {
        if (metrics.stairsWithoutRampCount === 0 && metrics.difficultSegmentCount === 0) {
          return `Adds ${extraM} m to avoid lower-accessibility segments.`;
        }
        return `Adds ${extraM} m for the best accessibility score on this profile.`;
      }
    }
    if (metrics.stairsWithoutRampCount === 0 && metrics.difficultSegmentCount === 0) {
      return 'Step-free route with no difficult segments.';
    }
    return 'Best achievable accessibility for this profile.';
  }

  if (mode === 'balanced') {
    if (shortestMetrics && shortestMetrics.totalDistanceMeters > 0) {
      const extraM = metrics.totalDistanceMeters - shortestMetrics.totalDistanceMeters;
      if (extraM > 20) {
        return `Small detour of ${extraM} m with improved accessibility.`;
      }
    }
    return 'Balances distance and accessibility evenly.';
  }

  return '';
}

function findAllPaths(
  adj: AdjacencyList,
  startNodeId: string,
  endNodeId: string,
): GraphEdge[][] {
  const paths: GraphEdge[][] = [];
  const visited = new Set<string>();

  function dfs(currentId: string, currentPath: GraphEdge[]) {
    if (currentId === endNodeId) {
      paths.push([...currentPath]);
      return;
    }
    visited.add(currentId);
    const edges = adj.get(currentId) || [];
    for (const edge of edges) {
      if (!visited.has(edge.toNodeId)) {
        currentPath.push(edge);
        dfs(edge.toNodeId, currentPath);
        currentPath.pop();
      }
    }
    visited.delete(currentId);
  }

  dfs(startNodeId, []);
  return paths;
}

function compareAccessibleRoutes(a: { edges: GraphEdge[], metrics: RouteMetrics }, b: { edges: GraphEdge[], metrics: RouteMetrics }): number {
  const aHasHardBarrier = a.edges.some(e => e.isHardBarrier);
  const bHasHardBarrier = b.edges.some(e => e.isHardBarrier);
  if (aHasHardBarrier !== bHasHardBarrier) return aHasHardBarrier ? 1 : -1;

  if (a.metrics.minimumAccessibilityScore !== b.metrics.minimumAccessibilityScore) {
    return b.metrics.minimumAccessibilityScore - a.metrics.minimumAccessibilityScore;
  }
  if (a.metrics.averageAccessibilityScore !== b.metrics.averageAccessibilityScore) {
    return b.metrics.averageAccessibilityScore - a.metrics.averageAccessibilityScore;
  }
  if (a.metrics.difficultSegmentCount !== b.metrics.difficultSegmentCount) {
    return a.metrics.difficultSegmentCount - b.metrics.difficultSegmentCount;
  }
  if (a.metrics.criticalBarrierCount !== b.metrics.criticalBarrierCount) {
    return a.metrics.criticalBarrierCount - b.metrics.criticalBarrierCount;
  }
  if (a.metrics.moderateSegmentCount !== b.metrics.moderateSegmentCount) {
    return a.metrics.moderateSegmentCount - b.metrics.moderateSegmentCount;
  }
  return a.metrics.totalDistanceMeters - b.metrics.totalDistanceMeters;
}

const DEBUG_ROUTING = false;

export function calculateRoute(
  segments: PathSegment[],
  startNodeId: string,
  endNodeId: string,
  profile: ProfileId,
  mode: RouteMode,
  shortestMetrics: RouteMetrics | null = null,
  barrierReports?: import('../types/pathsense').BarrierReport[]
): RouteResult | null {
  if (startNodeId === endNodeId) return null;

  const adj = buildAdjacencyList(segments, profile, barrierReports);
  
  let resultEdges: GraphEdge[] | null = null;
  let finalCost = 0;

  if (mode === 'accessible') {
    const paths = findAllPaths(adj, startNodeId, endNodeId);
    if (paths.length === 0) return null;
    
    const candidates = paths.map(edges => ({ edges, metrics: computeMetrics(edges, profile) }));
    candidates.sort(compareAccessibleRoutes);
    
    if (DEBUG_ROUTING) {
      console.log('ROUTE_MODE_COMPARISON');
      candidates.forEach(c => {
        console.log(`mode: accessible, segmentIds: ${c.edges.map(e => e.segment.id).join(',')}, distance: ${c.metrics.totalDistanceMeters}, average: ${c.metrics.averageAccessibilityScore}, minimum: ${c.metrics.minimumAccessibilityScore}, difficultCount: ${c.metrics.difficultSegmentCount}, moderateCount: ${c.metrics.moderateSegmentCount}, criticalBarrierCount: ${c.metrics.criticalBarrierCount}`);
      });
      console.log('MOST_ACCESSIBLE_SELECTED');
      const win = candidates[0].metrics;
      console.log(`distance: ${win.totalDistanceMeters}, average: ${win.averageAccessibilityScore}, minimum: ${win.minimumAccessibilityScore}`);
    }

    resultEdges = candidates[0].edges;
    finalCost = resultEdges.reduce((sum, e) => sum + computeEdgeCost(e, mode), 0);
  } else {
    const result = dijkstra(adj, startNodeId, endNodeId, mode);
    if (!result) return null;
    resultEdges = result.edges;
    finalCost = result.cost;
  }

  const metrics = computeMetrics(resultEdges, profile);
  const warnings = buildWarnings(resultEdges, metrics);
  const explanation = buildExplanation(mode, metrics, shortestMetrics);

  const nodeIds = [startNodeId, ...resultEdges.map(e => e.toNodeId)];
  const segmentIds = resultEdges.map(e => e.segment.id);

  return {
    mode,
    nodeIds,
    segmentIds,
    totalDistanceMeters: metrics.totalDistanceMeters,
    averageAccessibilityScore: metrics.averageAccessibilityScore,
    minimumAccessibilityScore: metrics.minimumAccessibilityScore,
    totalCost: Math.round(finalCost * 1000) / 1000,
    warnings,
    metrics,
    explanation,
  };
}

export function calculateAllRoutes(
  segments: PathSegment[],
  startNodeId: string,
  endNodeId: string,
  profile: ProfileId,
  barrierReports?: import('../types/pathsense').BarrierReport[]
): { shortest: RouteResult | null; balanced: RouteResult | null; accessible: RouteResult | null } {
  if (startNodeId === endNodeId) {
    return { shortest: null, balanced: null, accessible: null };
  }

  const shortest = calculateRoute(segments, startNodeId, endNodeId, profile, 'shortest', null, barrierReports);
  const shortestMetrics = shortest ? shortest.metrics : null;

  const balanced = calculateRoute(
    segments,
    startNodeId,
    endNodeId,
    profile,
    'balanced',
    shortestMetrics,
    barrierReports
  );
  const accessible = calculateRoute(
    segments,
    startNodeId,
    endNodeId,
    profile,
    'accessible',
    shortestMetrics,
    barrierReports
  );

  return { shortest, balanced, accessible };
}

export function areRoutesEqual(a: RouteResult | null, b: RouteResult | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.segmentIds.length !== b.segmentIds.length) return false;
  return a.segmentIds.every((id, i) => id === b.segmentIds[i]);
}
