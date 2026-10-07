const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates Great-Circle distance between two coordinates using the Haversine formula.
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c * 100) / 100;
}

/**
 * Checks if coordinates are within geofence radius.
 */
export function checkGeofence(
  workerLat: number,
  workerLng: number,
  fenceLat: number,
  fenceLng: number,
  radiusMeters: number
): { isInside: boolean; distanceMeters: number } {
  const distanceMeters = calculateHaversineDistance(workerLat, workerLng, fenceLat, fenceLng);
  return {
    isInside: distanceMeters <= radiusMeters,
    distanceMeters,
  };
}

export interface GeofenceStatus {
  isInside: boolean;
  distanceMeters: number;
  allowedRadius: number;
  targetLat: number;
  targetLng: number;
  targetName?: string;
}

export interface WorkerGeofenceProfile {
  isMobile?: boolean;
  geofence?: {
    lat: number;
    lng: number;
    radius: number;
    address?: string | null;
  } | null;
  sites?: Array<{
    id?: string;
    name: string;
    address?: string | null;
    lat: number;
    lng: number;
    radius: number;
  }>;
}

/**
 * Evaluates whether an employee is within any assigned site or fallback personal geofence.
 */
export function evaluateWorkerGeofence(
  currentLat: number,
  currentLng: number,
  profile: WorkerGeofenceProfile
): GeofenceStatus | null {
  if (profile.isMobile) return null;

  // 1. Check assigned sites first
  if (profile.sites && profile.sites.length > 0) {
    let closestSite: { name: string; lat: number; lng: number; radius: number } | null = null;
    let minDistance = Infinity;

    for (const site of profile.sites) {
      const sLat = Number(site.lat);
      const sLng = Number(site.lng);
      const sRadius = Number(site.radius);
      if (!sLat || !sLng || !sRadius) continue;

      const dist = Math.round(calculateHaversineDistance(currentLat, currentLng, sLat, sLng));
      if (dist <= sRadius) {
        return {
          isInside: true,
          distanceMeters: dist,
          allowedRadius: sRadius,
          targetLat: sLat,
          targetLng: sLng,
          targetName: site.name,
        };
      }
      if (dist < minDistance) {
        minDistance = dist;
        closestSite = { name: site.name, lat: sLat, lng: sLng, radius: sRadius };
      }
    }

    if (closestSite) {
      return {
        isInside: false,
        distanceMeters: minDistance,
        allowedRadius: closestSite.radius,
        targetLat: closestSite.lat,
        targetLng: closestSite.lng,
        targetName: closestSite.name,
      };
    }
  }

  // 2. Fallback to individual personal geofence
  if (profile.geofence?.lat && profile.geofence?.lng && profile.geofence?.radius) {
    const gLat = Number(profile.geofence.lat);
    const gLng = Number(profile.geofence.lng);
    const gRadius = Number(profile.geofence.radius);
    const dist = Math.round(calculateHaversineDistance(currentLat, currentLng, gLat, gLng));
    return {
      isInside: dist <= gRadius,
      distanceMeters: dist,
      allowedRadius: gRadius,
      targetLat: gLat,
      targetLng: gLng,
      targetName: profile.geofence.address || undefined,
    };
  }

  return null;
}
