import { Landmark, PathSegment } from '../types/pathsense';

// Haversine formula to calculate distance between two coordinates in meters
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Calculate distance from point P to line segment AB
const pointToSegmentDistance = (
  p: { latitude: number; longitude: number },
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number => {
  // Use equirectangular approximation for small distances
  const R = 6371e3;
  const latP = (p.latitude * Math.PI) / 180;
  const lonP = (p.longitude * Math.PI) / 180;
  const latA = (a.latitude * Math.PI) / 180;
  const lonA = (a.longitude * Math.PI) / 180;
  const latB = (b.latitude * Math.PI) / 180;
  const lonB = (b.longitude * Math.PI) / 180;

  const x0 = lonP * Math.cos(latP);
  const y0 = latP;
  const x1 = lonA * Math.cos(latA);
  const y1 = latA;
  const x2 = lonB * Math.cos(latB);
  const y2 = latB;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    // A and B are the same point
    return calculateDistance(p.latitude, p.longitude, a.latitude, a.longitude);
  }

  const t = ((x0 - x1) * dx + (y0 - y1) * dy) / (dx * dx + dy * dy);
  
  // Clamp t to [0, 1] to stay on the segment
  const tClamped = Math.max(0, Math.min(1, t));

  const projX = x1 + tClamped * dx;
  const projY = y1 + tClamped * dy;

  // Convert projected point back to lat/lon for distance calculation
  const projLat = (projY * 180) / Math.PI;
  const projLon = (projX / Math.cos(projY)) * 180 / Math.PI;

  return calculateDistance(p.latitude, p.longitude, projLat, projLon);
};

export const findNearestSegment = (
  latitude: number,
  longitude: number,
  segments: PathSegment[],
  landmarks: Landmark[]
): { nearestSegment: PathSegment | null; distanceMeters: number } => {
  const landmarkMap = new Map(landmarks.map((l) => [l.id, l]));

  let minDistance = Infinity;
  let nearestSegment: PathSegment | null = null;

  for (const segment of segments) {
    const startNode = landmarkMap.get(segment.startNodeId);
    const endNode = landmarkMap.get(segment.endNodeId);

    if (startNode && endNode) {
      const dist = pointToSegmentDistance(
        { latitude, longitude },
        { latitude: startNode.latitude, longitude: startNode.longitude },
        { latitude: endNode.latitude, longitude: endNode.longitude }
      );

      if (dist < minDistance) {
        minDistance = dist;
        nearestSegment = segment;
      }
    }
  }

  return { nearestSegment, distanceMeters: minDistance };
};
