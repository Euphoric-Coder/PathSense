import { useEffect, useState } from 'react';
import {
  Pressable,
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  ChevronDown,
  ArrowUpDown,
  Navigation,
  X,
  Check,
  AlertTriangle,
  Clock,
  Ruler,
  Zap,
  Scale,
  ShieldCheck,
} from 'lucide-react-native';
import { ProfileId, RouteMode, RouteResult } from '@/src/types/pathsense';
import { landmarks } from '@/src/data/landmarks';
import { pathSegments } from '@/src/data/pathSegments';
import { profileLabelMap, getColorForLevel, getAccessibilityLevel } from '@/src/utils/accessibility';
import { calculateAllRoutes, ROUTE_MODE_LABELS, areRoutesEqual } from '@/src/services/routing';
import { theme } from '@/src/constants/theme';
import LandmarkPicker from '@/src/components/LandmarkPicker';

interface Props {
  activeProfile: ProfileId;
  selectedRouteMode: RouteMode | null;
  onSelectRouteMode: (mode: RouteMode | null) => void;
  routeSegmentIds: Set<string>;
  onRouteChange: (segmentIds: Set<string>, nodeIds: string[]) => void;
  onOriginDestinationChange: (originId: string | null, destId: string | null) => void;
  barrierReports?: import('../types/pathsense').BarrierReport[];
}

type PickerType = 'from' | 'to' | null;

function landmarkName(id: string | null): string {
  if (!id) return 'Select landmark';
  const lm = landmarks.find((l) => l.id === id);
  return lm ? lm.name : 'Unknown';
}

function landmarkShortName(id: string | null, max: number = 20): string {
  if (!id) return 'Select';
  const lm = landmarks.find((l) => l.id === id);
  if (!lm) return 'Unknown';
  return lm.name.length > max ? lm.name.slice(0, max - 1) + '…' : lm.name;
}

const routeModeIcon: Record<RouteMode, typeof Zap> = {
  shortest: Zap,
  balanced: Scale,
  accessible: ShieldCheck,
};

const routeModeColor: Record<RouteMode, string> = {
  shortest: theme.colors.primary,
  balanced: theme.colors.warning,
  accessible: theme.colors.success,
};

export default function RoutePlanner({
  activeProfile,
  selectedRouteMode,
  onSelectRouteMode,
  routeSegmentIds,
  onRouteChange,
  onOriginDestinationChange,
  barrierReports = [],
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [pickerType, setPickerType] = useState<PickerType>(null);
  const [routes, setRoutes] = useState<{
    shortest: RouteResult | null;
    balanced: RouteResult | null;
    accessible: RouteResult | null;
  }>({ shortest: null, balanced: null, accessible: null });
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSearch = fromId !== null && toId !== null && fromId !== toId;

  const doSearch = (from: string, to: string, profile: ProfileId, currentBarriers = barrierReports) => {
    const results = calculateAllRoutes(pathSegments, from, to, profile, currentBarriers);
    
    setRoutes(results);
    setHasSearched(true);
    setError(null);

    const allNull = !results.shortest && !results.balanced && !results.accessible;
    if (allNull) {
      setError('No route found between these landmarks.');
      onRouteChange(new Set(), []);
      onSelectRouteMode(null);
      return;
    }

    let modeToSelect = selectedRouteMode;
    if (!modeToSelect || !results[modeToSelect]) {
      modeToSelect = results.accessible ? 'accessible' : results.balanced ? 'balanced' : 'shortest';
    }

    const routeToSelect = results[modeToSelect as RouteMode];
    if (routeToSelect) {
      onRouteChange(new Set(routeToSelect.segmentIds), routeToSelect.nodeIds);
      onSelectRouteMode(routeToSelect.mode);
    }
  };

  const handleFindRoutes = () => {
    if (!fromId || !toId) return;
    if (fromId === toId) {
      setError('Start and destination must be different.');
      return;
    }
    doSearch(fromId, toId, activeProfile);
  };

  // Auto-recalculate when profile or barriers change after a search
  useEffect(() => {
    if (hasSearched && fromId && toId && fromId !== toId) {
      doSearch(fromId, toId, activeProfile, barrierReports);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile, barrierReports]);

  const handleClearRoute = () => {
    setFromId(null);
    setToId(null);
    setRoutes({ shortest: null, balanced: null, accessible: null });
    setHasSearched(false);
    setError(null);
    onSelectRouteMode(null);
    onRouteChange(new Set(), []);
    onOriginDestinationChange(null, null);
    setExpanded(true);
  };

  const handleSelectRouteCard = (mode: RouteMode) => {
    const route = routes[mode];
    if (!route) return;
    onSelectRouteMode(mode);
    onRouteChange(new Set(route.segmentIds), route.nodeIds);
    setExpanded(false);
  };

  const handleSwap = () => {
    const newFrom = toId;
    const newTo = fromId;
    setFromId(newFrom);
    setToId(newTo);
    onOriginDestinationChange(newFrom, newTo);
    if (newFrom && newTo && hasSearched) {
      doSearch(newFrom, newTo, activeProfile);
    }
  };

  const handlePickerSelect = (id: string) => {
    let newFrom = fromId;
    let newTo = toId;
    if (pickerType === 'from') {
      newFrom = id;
      if (id === toId) newTo = null;
    } else if (pickerType === 'to') {
      newTo = id;
      if (id === fromId) newFrom = null;
    }
    setFromId(newFrom);
    setToId(newTo);
    onOriginDestinationChange(newFrom, newTo);
    setPickerType(null);
  };

  const routeOrder: RouteMode[] = ['accessible', 'balanced', 'shortest'];
  const hasAnyRoute = routes.shortest || routes.balanced || routes.accessible;

  // Detect identical routes
  const accessibleBalancedSame = areRoutesEqual(routes.accessible, routes.balanced);
  const accessibleShortestSame = areRoutesEqual(routes.accessible, routes.shortest);
  const balancedShortestSame = areRoutesEqual(routes.balanced, routes.shortest);

  const selectedRoute = selectedRouteMode ? routes[selectedRouteMode] : null;

  return (
    <>
      <View style={styles.container}>
        <Pressable
          style={styles.header}
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse route planner' : 'Expand route planner'}
        >
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Navigation color="#FFFFFF" size={15} strokeWidth={2.5} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>Route Planner</Text>
              {expanded ? (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {fromId && toId
                    ? 'Tap to collapse'
                    : 'Select start and destination'}
                </Text>
              ) : fromId && toId ? (
                <View style={styles.collapsedRouteInfo}>
                  <Text style={styles.collapsedRoute} numberOfLines={1} ellipsizeMode="tail">
                    {landmarkShortName(fromId)} → {landmarkShortName(toId)}
                  </Text>
                  {selectedRoute && (
                    <Text
                      style={[styles.collapsedSelected, { color: routeModeColor[selectedRoute.mode] }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {ROUTE_MODE_LABELS[selectedRoute.mode]} • {selectedRoute.totalDistanceMeters} m • {selectedRoute.averageAccessibilityScore}/100
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  Select start and destination
                </Text>
              )}
            </View>
          </View>
          <ChevronDown
            color={theme.colors.textSecondary}
            size={18}
            strokeWidth={2.5}
            style={{ transform: [{ rotate: expanded ? '0deg' : '180deg' }] }}
          />
        </Pressable>

        {expanded && (
          <View style={styles.body}>
            <View style={styles.endpointRow}>
              <EndpointSelector
                label="FROM"
                value={fromId}
                onPress={() => setPickerType('from')}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.swapBtn,
                  pressed && styles.swapBtnPressed,
                ]}
                onPress={handleSwap}
                disabled={!fromId && !toId}
                accessibilityRole="button"
                accessibilityLabel="Swap origin and destination"
                accessibilityHint="Reverses the route direction"
              >
                <ArrowUpDown color={theme.colors.textSecondary} size={14} strokeWidth={2.5} />
              </Pressable>
              <EndpointSelector
                label="TO"
                value={toId}
                onPress={() => setPickerType('to')}
              />
            </View>

            <View style={styles.profileRow}>
              <Text style={styles.profileCaption}>PROFILE</Text>
              <View style={styles.profilePill}>
                <Text style={styles.profilePillText} numberOfLines={1}>
                  {profileLabelMap[activeProfile]}
                </Text>
              </View>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <AlertTriangle color={theme.colors.error} size={13} strokeWidth={2.5} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.findBtn,
                  !canSearch && styles.findBtnDisabled,
                  pressed && canSearch && styles.findBtnPressed,
                ]}
                onPress={handleFindRoutes}
                disabled={!canSearch}
                accessibilityRole="button"
                accessibilityLabel="Find routes"
                accessibilityHint="Calculates shortest, balanced, and most accessible routes"
              >
                <Navigation color="#FFFFFF" size={15} strokeWidth={2.5} />
                <Text style={styles.findBtnText}>Find Routes</Text>
              </Pressable>

              {(hasAnyRoute || hasSearched) && (
                <Pressable
                  style={({ pressed }) => [
                    styles.clearBtn,
                    pressed && styles.clearBtnPressed,
                  ]}
                  onPress={handleClearRoute}
                  accessibilityRole="button"
                  accessibilityLabel="Clear route"
                  accessibilityHint="Resets origin, destination, and route results"
                >
                  <X color={theme.colors.textSecondary} size={15} strokeWidth={2.5} />
                  <Text style={styles.clearBtnText}>Clear</Text>
                </Pressable>
              )}
            </View>

            {hasSearched && hasAnyRoute && (
              <ScrollView
                style={styles.resultsScroll}
                contentContainerStyle={styles.resultsContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {routeOrder.map((mode) => {
                  const route = routes[mode];
                  if (!route) return null;
                  let sameAsLabel: string | null = null;
                  if (mode === 'balanced' && accessibleBalancedSame) {
                    sameAsLabel = 'Same path as Most Accessible';
                  } else if (mode === 'shortest' && accessibleShortestSame) {
                    sameAsLabel = 'Same path as Most Accessible';
                  } else if (mode === 'shortest' && balancedShortestSame && !accessibleShortestSame) {
                    sameAsLabel = 'Same path as Balanced';
                  }
                  return (
                    <RouteCard
                      key={mode}
                      route={route}
                      isSelected={selectedRouteMode === mode}
                      onSelect={() => handleSelectRouteCard(mode)}
                      sameAsLabel={sameAsLabel}
                    />
                  );
                })}
                <Text style={styles.demoNote}>
                  Mock accessibility conditions — not field verified.
                </Text>
              </ScrollView>
            )}
          </View>
        )}
      </View>

      <LandmarkPicker
        visible={pickerType !== null}
        title={pickerType === 'from' ? 'Select Start Landmark' : 'Select Destination Landmark'}
        landmarks={landmarks}
        selectedId={pickerType === 'from' ? fromId : toId}
        excludeId={pickerType === 'from' ? toId : fromId}
        onSelect={handlePickerSelect}
        onClose={() => setPickerType(null)}
      />
    </>
  );
}

function EndpointSelector({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.endpointBtn,
        !value && styles.endpointBtnEmpty,
        pressed && styles.endpointBtnPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${landmarkName(value)}. Tap to change.`}
    >
      <Text style={styles.endpointLabel}>{label}</Text>
      <View style={styles.endpointValueRow}>
        <Text
          style={[
            styles.endpointValue,
            !value && styles.endpointValueEmpty,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {landmarkName(value)}
        </Text>
        <ChevronDown color={theme.colors.textMuted} size={13} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

function RouteCard({
  route,
  isSelected,
  onSelect,
  sameAsLabel,
}: {
  route: RouteResult;
  isSelected: boolean;
  onSelect: () => void;
  sameAsLabel: string | null;
}) {
  const Icon = routeModeIcon[route.mode];
  const accentColor = routeModeColor[route.mode];
  const avgLevel = getAccessibilityLevel(route.averageAccessibilityScore);
  const avgColor = getColorForLevel(avgLevel);
  const minLevel = getAccessibilityLevel(route.minimumAccessibilityScore);
  const minColor = getColorForLevel(minLevel);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.routeCard,
        isSelected && { borderColor: accentColor, backgroundColor: `${accentColor}0D` },
        pressed && styles.routeCardPressed,
      ]}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${ROUTE_MODE_LABELS[route.mode]} route. ${route.totalDistanceMeters} meters. Average accessibility ${route.averageAccessibilityScore} out of 100. Estimated ${route.metrics.estimatedWalkingMinutes} minutes.`}
    >
      <View style={styles.routeCardHeader}>
        <View style={styles.routeCardHeaderLeft}>
          <View style={[styles.routeModeIcon, { backgroundColor: accentColor }]}>
            <Icon color="#FFFFFF" size={12} strokeWidth={2.5} />
          </View>
          <Text style={styles.routeModeLabel}>
            {ROUTE_MODE_LABELS[route.mode]}
          </Text>
        </View>
        {isSelected && (
          <View style={[styles.selectedBadge, { backgroundColor: accentColor }]}>
            <Check color="#FFFFFF" size={11} strokeWidth={3} />
          </View>
        )}
      </View>

      <View style={styles.routeStatsRow}>
        <View style={styles.routeStat}>
          <Ruler color={theme.colors.textMuted} size={12} strokeWidth={2.5} />
          <Text style={styles.routeStatValue}>{route.totalDistanceMeters} m</Text>
        </View>
        <View style={styles.routeStat}>
          <ShieldCheck color={avgColor} size={12} strokeWidth={2.5} />
          <Text style={[styles.routeStatValue, { color: avgColor }]}>
            {route.averageAccessibilityScore}/100
          </Text>
        </View>
        <View style={styles.routeStat}>
          <Clock color={theme.colors.textMuted} size={12} strokeWidth={2.5} />
          <Text style={styles.routeStatValue}>~{route.metrics.estimatedWalkingMinutes} min</Text>
        </View>
      </View>

      <Text style={styles.routeExplanation} numberOfLines={2}>{route.explanation}</Text>

      {sameAsLabel && (
        <View style={styles.sameAsRow}>
          <Text style={styles.sameAsText}>{sameAsLabel}</Text>
        </View>
      )}

      {route.warnings.length > 0 ? (
        <View style={styles.warningsRow}>
          {route.warnings.slice(0, 3).map((w, idx) => (
            <View key={idx} style={styles.warningItem}>
              <AlertTriangle color={theme.colors.warning} size={10} strokeWidth={2.5} />
              <Text style={styles.warningText}>{w}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.positiveRow}>
          <Check color={theme.colors.success} size={11} strokeWidth={3} />
          <Text style={styles.positiveText}>No accessibility warnings</Text>
        </View>
      )}

      <View style={styles.minScoreRow}>
        <Text style={styles.minScoreLabel}>Min segment</Text>
        <View style={[styles.minScorePill, { backgroundColor: minColor }]}>
          <Text style={styles.minScorePillText}>{route.minimumAccessibilityScore}/100</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 14,
    ...theme.shadows.elevated,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  headerIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  collapsedRouteInfo: {
    marginTop: 1,
  },
  collapsedRoute: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text,
  },
  collapsedSelected: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  swapBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapBtnPressed: {
    backgroundColor: theme.colors.border,
  },
  endpointBtn: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  endpointBtnEmpty: {
    borderColor: theme.colors.borderStrong,
    borderStyle: 'dashed',
  },
  endpointBtnPressed: {
    backgroundColor: theme.colors.border,
  },
  endpointLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  endpointValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 1,
  },
  endpointValue: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  endpointValueEmpty: {
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
  },
  profileCaption: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  profilePill: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 7,
    maxWidth: 180,
  },
  profilePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212, 58, 47, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginTop: 7,
  },
  errorText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.error,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 8,
  },
  findBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 9,
  },
  findBtnDisabled: {
    backgroundColor: theme.colors.borderStrong,
  },
  findBtnPressed: {
    backgroundColor: theme.colors.primaryDark,
  },
  findBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  clearBtnPressed: {
    backgroundColor: theme.colors.border,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  resultsScroll: {
    marginTop: 8,
    maxHeight: 260,
  },
  resultsContent: {
    paddingBottom: 4,
  },
  routeCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  routeCardPressed: {
    backgroundColor: theme.colors.border,
  },
  routeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  routeModeIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeModeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  selectedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 7,
  },
  routeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  routeStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  routeExplanation: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 6,
    lineHeight: 15,
  },
  sameAsRow: {
    marginTop: 5,
  },
  sameAsText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  warningsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  warningText: {
    fontSize: 10,
    fontWeight: '500',
    color: theme.colors.warning,
  },
  positiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  positiveText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.success,
  },
  minScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  minScoreLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  minScorePill: {
    borderRadius: 999,
    paddingVertical: 1,
    paddingHorizontal: 6,
  },
  minScorePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  demoNote: {
    fontSize: 9,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
