"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTE_MODE_LABELS = exports.ROUTE_MODE_WEIGHTS = void 0;
exports.buildAdjacencyList = buildAdjacencyList;
exports.calculateRoute = calculateRoute;
exports.calculateAllRoutes = calculateAllRoutes;
exports.areRoutesEqual = areRoutesEqual;
var accessibilityScoring_1 = require("@/src/services/accessibilityScoring");
var accessibility_1 = require("@/src/utils/accessibility");
exports.ROUTE_MODE_WEIGHTS = {
    shortest: { distance: 1.0, accessibility: 0.0 },
    balanced: { distance: 0.5, accessibility: 0.5 },
    accessible: { distance: 0.2, accessibility: 0.8 },
};
exports.ROUTE_MODE_LABELS = {
    shortest: 'Shortest',
    balanced: 'Balanced',
    accessible: 'Most Accessible',
};
var MAX_REASONABLE_SEGMENT_DISTANCE = 200;
var HARD_BARRIER_PENALTY = 10000;
var WALKING_SPEED_MPS = 1.3;
var ACCESSIBILITY_WALKING_SPEED = {
    wheelchair: 1.1,
    crutches: 1.0,
    elderly: 0.9,
    stroller: 1.1,
    general: 1.3,
};
function buildAdjacencyList(segments, profile, barrierReports) {
    var _a, _b, _c, _d;
    var adj = new Map();
    var barriersBySegment = new Map();
    if (barrierReports) {
        for (var _i = 0, barrierReports_1 = barrierReports; _i < barrierReports_1.length; _i++) {
            var report = barrierReports_1[_i];
            var existing = (_a = barriersBySegment.get(report.segmentId)) !== null && _a !== void 0 ? _a : [];
            existing.push(report);
            barriersBySegment.set(report.segmentId, existing);
        }
    }
    for (var _e = 0, segments_1 = segments; _e < segments_1.length; _e++) {
        var seg = segments_1[_e];
        var reportsForSeg = (_b = barriersBySegment.get(seg.id)) !== null && _b !== void 0 ? _b : [];
        var result = (0, accessibilityScoring_1.calculateAccessibilityScore)(seg, profile, reportsForSeg);
        var accessibilityScore = result.score;
        var accessibilityPenalty = 100 - accessibilityScore;
        var normalizedDistance = Math.min(1, seg.distanceMeters / MAX_REASONABLE_SEGMENT_DISTANCE);
        var isHardBarrier = (profile === 'wheelchair' || profile === 'stroller') &&
            seg.stairs &&
            !seg.rampAvailable;
        var activeBarrierCount = 0;
        var criticalBarrierCount = 0;
        for (var _f = 0, reportsForSeg_1 = reportsForSeg; _f < reportsForSeg_1.length; _f++) {
            var report = reportsForSeg_1[_f];
            if (['active', 'open', 'reported'].includes(report.status)) {
                activeBarrierCount++;
                if (report.severity === 'critical' || report.severity === 'high') {
                    criticalBarrierCount++;
                }
            }
        }
        var forwardEdge = {
            segment: seg,
            toNodeId: seg.endNodeId,
            accessibilityScore: accessibilityScore,
            accessibilityPenalty: accessibilityPenalty,
            normalizedDistance: normalizedDistance,
            isHardBarrier: isHardBarrier,
            activeBarrierCount: activeBarrierCount,
            criticalBarrierCount: criticalBarrierCount,
        };
        var reverseEdge = {
            segment: seg,
            toNodeId: seg.startNodeId,
            accessibilityScore: accessibilityScore,
            accessibilityPenalty: accessibilityPenalty,
            normalizedDistance: normalizedDistance,
            isHardBarrier: isHardBarrier,
            activeBarrierCount: activeBarrierCount,
            criticalBarrierCount: criticalBarrierCount,
        };
        var forwardList = (_c = adj.get(seg.startNodeId)) !== null && _c !== void 0 ? _c : [];
        forwardList.push(forwardEdge);
        adj.set(seg.startNodeId, forwardList);
        var reverseList = (_d = adj.get(seg.endNodeId)) !== null && _d !== void 0 ? _d : [];
        reverseList.push(reverseEdge);
        adj.set(seg.endNodeId, reverseList);
    }
    return adj;
}
function computeEdgeCost(edge, mode) {
    var weights = exports.ROUTE_MODE_WEIGHTS[mode];
    var baseCost = weights.distance * edge.normalizedDistance +
        weights.accessibility * (edge.accessibilityPenalty / 100);
    if (edge.isHardBarrier) {
        return baseCost + HARD_BARRIER_PENALTY;
    }
    return baseCost;
}
function dijkstra(adj, startNodeId, endNodeId, mode) {
    var _a;
    var distances = new Map();
    var previous = new Map();
    var visited = new Set();
    for (var _i = 0, _b = adj.keys(); _i < _b.length; _i++) {
        var nodeId = _b[_i];
        distances.set(nodeId, Infinity);
        previous.set(nodeId, null);
    }
    distances.set(startNodeId, 0);
    var queue = [{ nodeId: startNodeId, cost: 0 }];
    while (queue.length > 0) {
        queue.sort(function (a, b) { return a.cost - b.cost; });
        var current_1 = queue.shift();
        if (visited.has(current_1.nodeId))
            continue;
        visited.add(current_1.nodeId);
        if (current_1.nodeId === endNodeId)
            break;
        var edges_2 = adj.get(current_1.nodeId);
        if (!edges_2)
            continue;
        for (var _c = 0, edges_1 = edges_2; _c < edges_1.length; _c++) {
            var edge = edges_1[_c];
            if (visited.has(edge.toNodeId))
                continue;
            var edgeCost = computeEdgeCost(edge, mode);
            var newCost = current_1.cost + edgeCost;
            var existingCost = (_a = distances.get(edge.toNodeId)) !== null && _a !== void 0 ? _a : Infinity;
            if (newCost < existingCost) {
                distances.set(edge.toNodeId, newCost);
                previous.set(edge.toNodeId, { nodeId: current_1.nodeId, edge: edge });
                queue.push({ nodeId: edge.toNodeId, cost: newCost });
            }
        }
    }
    var finalCost = distances.get(endNodeId);
    if (finalCost === undefined || finalCost === Infinity)
        return null;
    var nodeIds = [];
    var segmentIds = [];
    var edges = [];
    var current = endNodeId;
    while (current !== null) {
        nodeIds.unshift(current);
        var prev = previous.get(current);
        if (prev) {
            segmentIds.unshift(prev.edge.segment.id);
            edges.unshift(prev.edge);
            current = prev.nodeId;
        }
        else {
            current = null;
        }
    }
    return { cost: finalCost, nodeIds: nodeIds, segmentIds: segmentIds, edges: edges };
}
function computeMetrics(edges, profile) {
    var totalDistanceMeters = 0;
    var totalAccessibility = 0;
    var minimumAccessibilityScore = 100;
    var difficultSegmentCount = 0;
    var moderateSegmentCount = 0;
    var stairsWithoutRampCount = 0;
    var constructionCount = 0;
    var activeBarrierCount = 0;
    var criticalBarrierCount = 0;
    for (var _i = 0, edges_3 = edges; _i < edges_3.length; _i++) {
        var edge = edges_3[_i];
        totalDistanceMeters += edge.segment.distanceMeters;
        totalAccessibility += edge.accessibilityScore;
        minimumAccessibilityScore = Math.min(minimumAccessibilityScore, edge.accessibilityScore);
        var level = (0, accessibility_1.getAccessibilityLevel)(edge.accessibilityScore);
        if (level === 'Difficult')
            difficultSegmentCount++;
        if (level === 'Moderate')
            moderateSegmentCount++;
        if (edge.segment.stairs && !edge.segment.rampAvailable) {
            stairsWithoutRampCount++;
        }
        if (edge.segment.obstruction === 'construction') {
            constructionCount++;
        }
        activeBarrierCount += edge.activeBarrierCount;
        criticalBarrierCount += edge.criticalBarrierCount;
    }
    var segmentCount = edges.length;
    var averageAccessibilityScore = segmentCount > 0 ? Math.round(totalAccessibility / segmentCount) : 0;
    var minimumScore = segmentCount > 0 ? minimumAccessibilityScore : 0;
    var speed = ACCESSIBILITY_WALKING_SPEED[profile];
    var estimatedWalkingMinutes = Math.max(1, Math.round(totalDistanceMeters / speed / 60));
    return {
        totalDistanceMeters: totalDistanceMeters,
        averageAccessibilityScore: averageAccessibilityScore,
        minimumAccessibilityScore: minimumScore,
        difficultSegmentCount: difficultSegmentCount,
        moderateSegmentCount: moderateSegmentCount,
        stairsWithoutRampCount: stairsWithoutRampCount,
        constructionCount: constructionCount,
        activeBarrierCount: activeBarrierCount,
        criticalBarrierCount: criticalBarrierCount,
        estimatedWalkingMinutes: estimatedWalkingMinutes,
    };
}
function buildWarnings(edges, metrics) {
    var warnings = [];
    if (metrics.stairsWithoutRampCount > 0) {
        warnings.push('Stairs without ramp');
    }
    if (metrics.constructionCount > 0) {
        warnings.push('Construction');
    }
    if (metrics.difficultSegmentCount > 0) {
        warnings.push("".concat(metrics.difficultSegmentCount, " difficult segment").concat(metrics.difficultSegmentCount > 1 ? 's' : ''));
    }
    if (metrics.moderateSegmentCount > 0 && metrics.difficultSegmentCount === 0) {
        warnings.push("".concat(metrics.moderateSegmentCount, " moderate segment").concat(metrics.moderateSegmentCount > 1 ? 's' : ''));
    }
    var hasHardBarrier = edges.some(function (e) { return e.isHardBarrier; });
    if (hasHardBarrier) {
        warnings.push('No fully step-free route — includes hard barrier');
    }
    return warnings;
}
function buildExplanation(mode, metrics, shortestMetrics) {
    if (mode === 'shortest') {
        if (metrics.difficultSegmentCount > 0 || metrics.stairsWithoutRampCount > 0) {
            return "Shortest route, but includes ".concat(metrics.difficultSegmentCount, " lower-accessibility segment").concat(metrics.difficultSegmentCount !== 1 ? 's' : '', ".");
        }
        return 'Shortest route with no accessibility issues.';
    }
    if (mode === 'accessible') {
        if (shortestMetrics && shortestMetrics.totalDistanceMeters > 0) {
            var extraM = metrics.totalDistanceMeters - shortestMetrics.totalDistanceMeters;
            if (extraM > 20) {
                if (metrics.stairsWithoutRampCount === 0 && metrics.difficultSegmentCount === 0) {
                    return "Adds ".concat(extraM, " m to avoid lower-accessibility segments.");
                }
                return "Adds ".concat(extraM, " m for the best accessibility score on this profile.");
            }
        }
        if (metrics.stairsWithoutRampCount === 0 && metrics.difficultSegmentCount === 0) {
            return 'Step-free route with no difficult segments.';
        }
        return 'Best achievable accessibility for this profile.';
    }
    if (mode === 'balanced') {
        if (shortestMetrics && shortestMetrics.totalDistanceMeters > 0) {
            var extraM = metrics.totalDistanceMeters - shortestMetrics.totalDistanceMeters;
            if (extraM > 20) {
                return "Small detour of ".concat(extraM, " m with improved accessibility.");
            }
        }
        return 'Balances distance and accessibility evenly.';
    }
    return '';
}
function findAllPaths(adj, startNodeId, endNodeId) {
    var paths = [];
    var visited = new Set();
    function dfs(currentId, currentPath) {
        if (currentId === endNodeId) {
            paths.push(__spreadArray([], currentPath, true));
            return;
        }
        visited.add(currentId);
        var edges = adj.get(currentId) || [];
        for (var _i = 0, edges_4 = edges; _i < edges_4.length; _i++) {
            var edge = edges_4[_i];
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
function compareAccessibleRoutes(a, b) {
    var aHasHardBarrier = a.edges.some(function (e) { return e.isHardBarrier; });
    var bHasHardBarrier = b.edges.some(function (e) { return e.isHardBarrier; });
    if (aHasHardBarrier !== bHasHardBarrier)
        return aHasHardBarrier ? 1 : -1;
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
function calculateRoute(segments, startNodeId, endNodeId, profile, mode, shortestMetrics, barrierReports) {
    if (shortestMetrics === void 0) { shortestMetrics = null; }
    if (startNodeId === endNodeId)
        return null;
    var adj = buildAdjacencyList(segments, profile, barrierReports);
    var resultEdges = null;
    var finalCost = 0;
    if (mode === 'accessible') {
        var paths = findAllPaths(adj, startNodeId, endNodeId);
        if (paths.length === 0)
            return null;
        var candidates = paths.map(function (edges) { return ({ edges: edges, metrics: computeMetrics(edges, profile) }); });
        candidates.sort(compareAccessibleRoutes);
        resultEdges = candidates[0].edges;
        finalCost = resultEdges.reduce(function (sum, e) { return sum + computeEdgeCost(e, mode); }, 0);
    }
    else {
        var result = dijkstra(adj, startNodeId, endNodeId, mode);
        if (!result)
            return null;
        resultEdges = result.edges;
        finalCost = result.cost;
    }
    var metrics = computeMetrics(resultEdges, profile);
    var warnings = buildWarnings(resultEdges, metrics);
    var explanation = buildExplanation(mode, metrics, shortestMetrics);
    var nodeIds = __spreadArray([startNodeId], resultEdges.map(function (e) { return e.toNodeId; }), true);
    var segmentIds = resultEdges.map(function (e) { return e.segment.id; });
    return {
        mode: mode,
        nodeIds: nodeIds,
        segmentIds: segmentIds,
        totalDistanceMeters: metrics.totalDistanceMeters,
        averageAccessibilityScore: metrics.averageAccessibilityScore,
        minimumAccessibilityScore: metrics.minimumAccessibilityScore,
        totalCost: Math.round(finalCost * 1000) / 1000,
        warnings: warnings,
        metrics: metrics,
        explanation: explanation,
    };
}
function calculateAllRoutes(segments, startNodeId, endNodeId, profile, barrierReports) {
    if (startNodeId === endNodeId) {
        return { shortest: null, balanced: null, accessible: null };
    }
    var shortest = calculateRoute(segments, startNodeId, endNodeId, profile, 'shortest', null, barrierReports);
    var shortestMetrics = shortest ? shortest.metrics : null;
    var balanced = calculateRoute(segments, startNodeId, endNodeId, profile, 'balanced', shortestMetrics, barrierReports);
    var accessible = calculateRoute(segments, startNodeId, endNodeId, profile, 'accessible', shortestMetrics, barrierReports);
    return { shortest: shortest, balanced: balanced, accessible: accessible };
}
function areRoutesEqual(a, b) {
    if (!a && !b)
        return true;
    if (!a || !b)
        return false;
    if (a.segmentIds.length !== b.segmentIds.length)
        return false;
    return a.segmentIds.every(function (id, i) { return id === b.segmentIds[i]; });
}
