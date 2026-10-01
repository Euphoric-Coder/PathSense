import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  LatLng,
  Region,
  Callout,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Navigation, Flag } from 'lucide-react-native';

import { landmarks } from '@/src/data/landmarks';
import { pathSegments } from '@/src/data/pathSegments';
import { Landmark, PathSegment, ProfileId, BarrierReport } from '@/src/types/pathsense';
import { getColorForScore } from '@/src/utils/accessibility';
import { calculateAccessibilityScore } from '@/src/services/accessibilityScoring';
import { MAP_INITIAL_REGION, theme } from '@/src/constants/theme';

import AccessibilityLegend from '@/src/components/AccessibilityLegend';
import ZoomControls from '@/src/components/ZoomControls';
import PathDetailsModal from '@/src/components/PathDetailsModal';
import ProfileSelector from '@/src/components/ProfileSelector';

const ZOOM_MIN = 8;
const ZOOM_MAX = 20;
const ROUTE_COLOR = '#0B5FFF';
const ROUTE_OUTLINE_COLOR = '#FFFFFF';

interface Props {
  routeSegmentIds: Set<string>;
  routeNodeIds: string[];
  originId: string | null;
  destinationId: string | null;
  activeProfile: ProfileId;
  onProfileChange: (profile: ProfileId) => void;
  barrierReports?: BarrierReport[];
  onResolveBarrier?: (reportId: string) => void;
}

export default function PathSenseMap({
  routeSegmentIds,
  routeNodeIds,
  originId,
  destinationId,
  activeProfile,
  onProfileChange,
  barrierReports = [],
  onResolveBarrier,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const [selectedSegment, setSelectedSegment] = useState<PathSegment | null>(null);

  const hasRoute = routeSegmentIds.size > 0;

  const landmarkMap = useMemo(() => {
    const map = new Map<string, Landmark>();
    for (const lm of landmarks) map.set(lm.id, lm);
    return map;
  }, []);

  const barriersBySegment = useMemo(() => {
    const map = new Map<string, BarrierReport[]>();
    for (const report of barrierReports) {
      const existing = map.get(report.segmentId) ?? [];
      existing.push(report);
      map.set(report.segmentId, existing);
    }
    return map;
  }, [barrierReports]);

  const polylineData = useMemo(() => {
    return pathSegments
      .map((seg) => {
        const start = landmarkMap.get(seg.startNodeId);
        const end = landmarkMap.get(seg.endNodeId);
        if (!start || !end) return null;
        const coordinates: LatLng[] = [
          { latitude: start.latitude, longitude: start.longitude },
          { latitude: end.latitude, longitude: end.longitude },
        ];
        const reportsForSeg = barriersBySegment.get(seg.id) ?? [];
        const result = calculateAccessibilityScore(seg, activeProfile, reportsForSeg);
        const color = getColorForScore(result.score);
        const isOnRoute = routeSegmentIds.has(seg.id);
        return { segment: seg, coordinates, color, isOnRoute };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);
  }, [landmarkMap, activeProfile, routeSegmentIds, barriersBySegment]);

  const routeCoordinates = useMemo(() => {
    if (!hasRoute || routeNodeIds.length === 0) return [];
    return routeNodeIds
      .map((id) => landmarkMap.get(id))
      .filter((lm): lm is Landmark => lm !== null)
      .map((lm) => ({ latitude: lm.latitude, longitude: lm.longitude }));
  }, [routeNodeIds, landmarkMap, hasRoute]);

  const fitToLandmarks = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.fitToCoordinates(
        landmarks.map((lm) => ({
          latitude: lm.latitude,
          longitude: lm.longitude,
        })),
        {
          edgePadding: { top: 70, right: 70, bottom: 180, left: 70 },
          animated: false,
        },
      );
    }
  }, []);

  // Fit camera to route when route is selected
  useEffect(() => {
    if (hasRoute && routeCoordinates.length >= 2 && mapRef.current) {
      mapRef.current.fitToCoordinates(routeCoordinates, {
        edgePadding: {
          top: 160,
          right: 60,
          bottom: 200,
          left: 60,
        },
        animated: true,
      });
    }
  }, [routeCoordinates, hasRoute]);

  const handleZoomIn = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const camera = await map.getCamera();
      const currentZoom = camera.zoom ?? 14;
      const next = Math.min(ZOOM_MAX, currentZoom + 1);
      map.animateCamera({ zoom: next }, { duration: 250 });
    } catch {
      // ignore
    }
  }, []);

  const handleZoomOut = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const camera = await map.getCamera();
      const currentZoom = camera.zoom ?? 14;
      const next = Math.max(ZOOM_MIN, currentZoom - 1);
      map.animateCamera({ zoom: next }, { duration: 250 });
    } catch {
      // ignore
    }
  }, []);

  const handlePathTap = useCallback((segment: PathSegment) => {
    setSelectedSegment(segment);
  }, []);

  const closeModal = useCallback(() => setSelectedSegment(null), []);

  const handleProfileSelect = useCallback(
    (profile: ProfileId) => onProfileChange(profile),
    [onProfileChange],
  );

  const initialRegion: Region = MAP_INITIAL_REGION;

  function renderMarker(lm: Landmark) {
    const isOrigin = lm.id === originId;
    const isDestination = lm.id === destinationId;
    if (isOrigin) {
      return (
        <Marker
          key={`origin-${lm.id}`}
          coordinate={{ latitude: lm.latitude, longitude: lm.longitude }}
          title={lm.name}
          description="Route origin"
          pinColor={theme.colors.primary}
        >
          <View style={styles.originMarker}>
            <View style={styles.originMarkerInner}>
              <Navigation color="#FFFFFF" size={14} strokeWidth={2.5} />
            </View>
          </View>
          <Callout tooltip>
            <View style={styles.customCallout}>
              <View style={styles.customCalloutBubble}>
                <Text style={styles.calloutLabel}>FROM</Text>
                <Text style={styles.calloutName}>{lm.name}</Text>
              </View>
              <View style={styles.customCalloutArrow} />
            </View>
          </Callout>
        </Marker>
      );
    }

    if (isDestination) {
      return (
        <Marker
          key={`dest-${lm.id}`}
          coordinate={{ latitude: lm.latitude, longitude: lm.longitude }}
          title={lm.name}
          description="Route destination"
          pinColor={theme.colors.success}
        >
          <View style={styles.destMarker}>
            <View style={styles.destMarkerInner}>
              <Flag color="#FFFFFF" size={14} strokeWidth={2.5} />
            </View>
          </View>
          <Callout tooltip>
            <View style={styles.customCallout}>
              <View style={styles.customCalloutBubble}>
                <Text style={styles.calloutLabel}>TO</Text>
                <Text style={styles.calloutName}>{lm.name}</Text>
              </View>
              <View style={styles.customCalloutArrow} />
            </View>
          </Callout>
        </Marker>
      );
    }

    return (
      <Marker
        key={lm.id}
        coordinate={{ latitude: lm.latitude, longitude: lm.longitude }}
        title={lm.name}
        description={`${lm.type} • Demo Data`}
        flat={false}
        opacity={hasRoute ? 0.5 : 1}
      />
    );
  }

  function renderBarrierMarker(report: BarrierReport) {
    if (report.status !== 'active' && report.status !== 'open' && report.status !== 'reported') return null;

    const barrierName = report.barrierType
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return (
      <Marker
        key={`barrier-${report.id}`}
        coordinate={{ latitude: report.latitude, longitude: report.longitude }}
        pinColor={theme.colors.error}
        zIndex={100}
      >
        <Callout tooltip onPress={() => onResolveBarrier?.(report.id)}>
          <View style={styles.customCallout}>
            <View style={styles.customCalloutBubble}>
              <Text style={styles.calloutLabel}>BARRIER ({report.severity.toUpperCase()})</Text>
              <Text style={styles.calloutName}>{barrierName}</Text>
              <Text style={{ fontSize: 10, color: theme.colors.textMuted }}>{new Date(report.createdAt).toLocaleDateString()}</Text>
              {report.description ? (
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 }}>{report.description}</Text>
              ) : null}
              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 6 }}>
                <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: '700', textAlign: 'center' }}>Tap to resolve</Text>
              </View>
            </View>
            <View style={styles.customCalloutArrow} />
          </View>
        </Callout>
      </Marker>
    );
  }

  return (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion}
        onMapReady={fitToLandmarks}
        showsUserLocation={false}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        pitchEnabled={false}
      >
        {/* Normal graph paths (dimmed when route active) */}
        {polylineData.map(({ segment, coordinates, color, isOnRoute }) => {
          const strokeWidth = hasRoute ? (isOnRoute ? 4 : 3) : 6;
          const strokeColor = hasRoute && !isOnRoute ? '#D1D5DB' : color;
          return (
            <Polyline
              key={`base-${segment.id}-${activeProfile}-${hasRoute}`}
              coordinates={coordinates}
              strokeWidth={strokeWidth}
              strokeColor={strokeColor}
              strokeColors={[strokeColor]}
              lineCap="round"
              tappable
              onPress={() => handlePathTap(segment)}
              accessibilityLabel={`Path ${segment.id}`}
            />
          );
        })}

        {/* Route overlay: white outline + blue route line */}
        {hasRoute && routeCoordinates.length >= 2 && (
          <>
            <Polyline
              key="route-outline"
              coordinates={routeCoordinates}
              strokeWidth={10}
              strokeColor={ROUTE_OUTLINE_COLOR}
              lineCap="round"
              lineJoin="round"
              tappable={false}
            />
            <Polyline
              key="route-highlight"
              coordinates={routeCoordinates}
              strokeWidth={7}
              strokeColor={ROUTE_COLOR}
              lineCap="round"
              lineJoin="round"
              tappable
              onPress={() => {}}
              accessibilityLabel="Selected route"
            />
          </>
        )}

        {landmarks.map(renderMarker)}
        {barrierReports.map(renderBarrierMarker)}
      </MapView>

      <ProfileSelector
        activeProfile={activeProfile}
        onSelect={handleProfileSelect}
      />

      <AccessibilityLegend activeProfile={activeProfile} />

      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        bottomInset={insets.bottom}
      />

      <PathDetailsModal
        segment={selectedSegment}
        visible={selectedSegment !== null}
        onClose={closeModal}
        activeProfile={activeProfile}
        barrierReports={barriersBySegment.get(selectedSegment?.id ?? '') ?? []}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
  },
  originMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  originMarkerInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...theme.shadows.elevated,
  },
  destMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  destMarkerInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    ...theme.shadows.elevated,
  },
  customCallout: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 180,
  },
  customCalloutBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  customCalloutArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -1, // Overlap slightly to prevent subpixel gaps
  },
  calloutLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  calloutName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 2,
  },
});
