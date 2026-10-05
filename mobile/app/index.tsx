
import { View, Text, StyleSheet, Pressable, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, MapPin } from 'lucide-react-native';

import PathSenseMap from '@/src/components/PathSenseMap';
import RoutePlanner from '@/src/components/RoutePlanner';
import ReportBarrierModal from '@/src/components/ReportBarrierModal';
import { landmarks } from '@/src/data/landmarks';
import { pathSegments } from '@/src/data/pathSegments';
import { barriers } from '@/src/data/barriers';
import { ProfileId, RouteMode, BarrierReport } from '@/src/types/pathsense';
import { DEFAULT_PROFILE } from '@/src/data/mobilityProfiles';
import { theme } from '@/src/constants/theme';
import { getBarrierReports, saveBarrierReport, updateBarrierReport, deleteBarrierReport } from '@/src/services/barrierStorage';
import { useEffect, useMemo, useState } from 'react';
import ActiveBarriersModal from '@/src/components/ActiveBarriersModal';
import BarrierDetailsModal from '@/src/components/BarrierDetailsModal';

const DEBUG_V04 = false;

export default function HomeScreen() {
  const landmarkCount = landmarks.length;
  const pathCount = pathSegments.length;
  const barrierCount = barriers.length;

  const [activeProfile, setActiveProfile] = useState<ProfileId>(DEFAULT_PROFILE);
  const [routeSegmentIds, setRouteSegmentIds] = useState<Set<string>>(new Set());
  const [routeNodeIds, setRouteNodeIds] = useState<string[]>([]);
  const [selectedRouteMode, setSelectedRouteMode] = useState<RouteMode | null>(null);
  const [originId, setOriginId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);

  const [barrierReports, setBarrierReports] = useState<BarrierReport[]>([]);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isActiveBarriersVisible, setIsActiveBarriersVisible] = useState(false);
  const [selectedBarrierReport, setSelectedBarrierReport] = useState<BarrierReport | null>(null);

  useEffect(() => {
    const loadReports = async () => {
      const reports = await getBarrierReports();
      
      if (DEBUG_V04) {
        // ONE-TIME CLEANUP (can be enabled if needed)
        const cleanReports = reports.filter(r => !r.id.startsWith('mock-debug-barrier'));
        if (cleanReports.length !== reports.length) {
          for (const r of reports) {
             if (r.id.startsWith('mock-debug-barrier')) {
               await deleteBarrierReport(r.id);
             }
          }
        }
        setBarrierReports(cleanReports);
      } else {
        setBarrierReports(reports);
      }
    };
    loadReports();
  }, []);

  const activeBarrierReports = useMemo(
    () => barrierReports.filter(report => report.status === 'active'),
    [barrierReports]
  );

  const finalizeBarrierSubmit = async (report: BarrierReport) => {
    const overlap = routeSegmentIds.has(report.segmentId);

    await saveBarrierReport(report);
    setBarrierReports(prev => [...prev, report]);
    setIsReportModalVisible(false);
    
    if (overlap) {
      Alert.alert('Route Conditions Updated', 'Accessibility conditions changed on your route.');
    }
  };

  const handleBarrierSubmit = async (report: BarrierReport) => {
    const isDuplicate = activeBarrierReports.some(
      (r) => r.segmentId === report.segmentId && 
             r.barrierType === report.barrierType && 
             r.severity === report.severity
    );

    if (isDuplicate) {
      Alert.alert(
        'Duplicate Barrier',
        'A similar active barrier already exists on this path. Submit anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit Anyway', style: 'destructive', onPress: () => finalizeBarrierSubmit(report) }
        ]
      );
      return;
    }
    await finalizeBarrierSubmit(report);
  };

  const handleResolveBarrier = async (id: string) => {
    const report = barrierReports.find((r) => r.id === id);
    if (report) {
      const updated = { ...report, status: 'resolved' as const, updatedAt: new Date().toISOString() };
      await updateBarrierReport(updated);
      setBarrierReports(prev => prev.map(r => r.id === id ? updated : r));
      
      if (routeSegmentIds.size > 0) {
        Alert.alert('Route Updated', 'Route updated after barrier resolution.');
      }
    }
  };

  const handleDeleteBarrier = async (id: string) => {
    await deleteBarrierReport(id);
    setBarrierReports(prev => prev.filter(r => r.id !== id));
    
    if (routeSegmentIds.size > 0) {
      // Just a small toast or nothing, we'll just let the route recalculate.
    }
  };

  const handleRouteChange = (segmentIds: Set<string>, nodeIds: string[]) => {
    if (routeSegmentIds.size > 0 && segmentIds.size > 0) {
      const oldArr = Array.from(routeSegmentIds);
      const newArr = Array.from(segmentIds);
      const isDifferent = oldArr.length !== newArr.length || !oldArr.every((v, i) => v === newArr[i]);
      if (isDifferent) {
        Alert.alert('Route Updated', 'Route updated due to a new accessibility barrier.');
      }
    }
    setRouteSegmentIds(segmentIds);
    setRouteNodeIds(nodeIds);
  };

  const handleOriginDestinationChange = (org: string | null, dest: string | null) => {
    setOriginId(org);
    setDestinationId(dest);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.root}>
        <Header
          landmarkCount={landmarkCount}
          pathCount={pathCount}
          barrierCount={barrierCount}
        />
        <View style={styles.mapContainer}>
          <PathSenseMap
            routeSegmentIds={routeSegmentIds}
            routeNodeIds={routeNodeIds}
            originId={originId}
            destinationId={destinationId}
            activeProfile={activeProfile}
            onProfileChange={setActiveProfile}
            barrierReports={activeBarrierReports}
            onBarrierTap={setSelectedBarrierReport}
          />
          <View style={styles.routePlannerOverlay} pointerEvents="box-none">
            <RoutePlanner
              activeProfile={activeProfile}
              selectedRouteMode={selectedRouteMode}
              onSelectRouteMode={setSelectedRouteMode}
              routeSegmentIds={routeSegmentIds}
              onRouteChange={handleRouteChange}
              onOriginDestinationChange={handleOriginDestinationChange}
              barrierReports={activeBarrierReports}
            />
          </View>
          <View style={styles.fabContainer} pointerEvents="box-none">
            {activeBarrierReports.length > 0 && (
              <Pressable
                style={styles.activeBarriersFab}
                onPress={() => setIsActiveBarriersVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Open active barriers"
              >
                <AlertTriangle color={theme.colors.warning} size={20} />
                <Text style={styles.activeBarriersFabText}>
                  Active Barriers ({activeBarrierReports.length})
                </Text>
              </Pressable>
            )}
            <Pressable
              style={styles.fab}
              onPress={() => setIsReportModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Report Barrier"
            >
              <AlertTriangle color="#FFFFFF" size={24} />
              <Text style={styles.fabText}>Report Barrier</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ReportBarrierModal
        visible={isReportModalVisible}
        onClose={() => setIsReportModalVisible(false)}
        onSubmit={handleBarrierSubmit}
        routeSegmentIds={routeSegmentIds}
      />

      <ActiveBarriersModal
        visible={isActiveBarriersVisible}
        onClose={() => setIsActiveBarriersVisible(false)}
        reports={barrierReports}
        onSelectBarrier={setSelectedBarrierReport}
      />

      <BarrierDetailsModal
        visible={selectedBarrierReport !== null}
        onClose={() => setSelectedBarrierReport(null)}
        report={selectedBarrierReport}
        onResolve={handleResolveBarrier}
        onDelete={handleDeleteBarrier}
        routeSegmentIds={routeSegmentIds}
      />
    </SafeAreaView>
  );
}

function Header({
  landmarkCount,
  pathCount,
  barrierCount,
}: {
  landmarkCount: number;
  pathCount: number;
  barrierCount: number;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <MapPin color="#FFFFFF" size={18} strokeWidth={2.5} />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.appName}>PathSense</Text>
            <Text style={styles.tagline}>
              Accessibility intelligence for the real world
            </Text>
          </View>
        </View>

        <View style={styles.pilotRow}>
          <View style={styles.pilotPill}>
            <Text style={styles.pilotText}>Gholeshapur–Behala Mock Pilot</Text>
          </View>
          <View style={styles.demoPill}>
            <Text style={styles.demoText}>DEMO DATA</Text>
          </View>
        </View>

        <Text style={styles.countsText}>
          {landmarkCount} Landmarks • {pathCount} Paths • {barrierCount} Demo Barriers
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  root: {
    flex: 1,
  },
  header: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.card,
    zIndex: 10,
  },
  headerTop: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.elevated,
  },
  brandText: {
    flex: 1,
  },
  appName: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  pilotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  pilotPill: {
    backgroundColor: theme.colors.background,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  pilotText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  demoPill: {
    backgroundColor: theme.colors.warning,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  demoText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  countsText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 10,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
  },
  routePlannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    alignItems: 'flex-end',
    zIndex: 20,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.error,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    ...theme.shadows.card,
  },
  fabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  activeBarriersFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.warning,
    ...theme.shadows.card,
  },
  activeBarriersFabText: {
    color: theme.colors.warning,
    fontWeight: '800',
    fontSize: 14,
  }
});
