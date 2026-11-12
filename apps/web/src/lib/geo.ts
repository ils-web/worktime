import {
  calculateHaversineDistance,
  evaluateWorkerGeofence,
  GeofenceStatus,
  WorkerGeofenceProfile,
} from '@timetracker/shared';

export type { GeofenceStatus, WorkerGeofenceProfile };
export { evaluateWorkerGeofence };

export interface GeoLocationResult {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export class GeoLocationError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.name = 'GeoLocationError';
    this.code = code;
  }
}

const LAST_GEO_CACHE_KEY = 'worktime_last_geo_fix';

export function saveCachedGeoFix(fix: GeoLocationResult): void {
  try {
    localStorage.setItem(LAST_GEO_CACHE_KEY, JSON.stringify(fix));
  } catch {
    // ignore storage errors
  }
}

export function loadCachedGeoFix(maxAgeMs = 45 * 60 * 1000): GeoLocationResult | null {
  try {
    const raw = localStorage.getItem(LAST_GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeoLocationResult;
    if (
      parsed &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lng === 'number' &&
      Date.now() - (parsed.timestamp || 0) <= maxAgeMs
    ) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Get current GPS coordinates with high accuracy, with fast indoor/underground fallback
 */
export function getCurrentCoordinates(timeout = 7000): Promise<GeoLocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const cached = loadCachedGeoFix();
      if (cached) {
        resolve(cached);
        return;
      }
      reject(new GeoLocationError('Geolocation is not supported by your browser', 0));
      return;
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      const res: GeoLocationResult = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: Date.now(),
      };
      saveCachedGeoFix(res);
      resolve(res);
    };

    const handleFinalError = (err: GeolocationPositionError) => {
      // If underground / in concrete parking where GPS & cell triangulation time out,
      // fallback to recent cached GPS fix (within 45 mins) if permission was not denied
      if (err.code !== err.PERMISSION_DENIED) {
        const cached = loadCachedGeoFix(45 * 60 * 1000);
        if (cached) {
          resolve(cached);
          return;
        }
      }

      let msg = 'Failed to obtain GPS coordinates';
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'Permission to access location was denied';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        msg = 'Location information is unavailable';
      } else if (err.code === err.TIMEOUT) {
        msg = 'The request to get user location timed out';
      }
      reject(new GeoLocationError(msg, err.code));
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          handleFinalError(err);
          return;
        }
        // Fallback to network/coarse location if high-accuracy GPS timed out or is unavailable indoors
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          handleFinalError,
          {
            enableHighAccuracy: false,
            timeout: Math.min(3500, timeout),
            maximumAge: 15 * 60 * 1000,
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: Math.min(timeout, 4000),
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Check single geofence boundary (legacy / direct helper)
 */
export function evaluateGeofence(
  currentLat: number,
  currentLng: number,
  targetLat: number,
  targetLng: number,
  radius: number
): GeofenceStatus {
  const distance = Math.round(calculateHaversineDistance(currentLat, currentLng, targetLat, targetLng));
  return {
    isInside: distance <= radius,
    distanceMeters: distance,
    allowedRadius: radius,
    targetLat,
    targetLng,
  };
}
