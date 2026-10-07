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

/**
 * Get current GPS coordinates with high accuracy
 */
export function getCurrentCoordinates(timeout = 10000): Promise<GeoLocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new GeoLocationError('Geolocation is not supported by your browser', 0));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        let msg = 'Failed to obtain GPS coordinates';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Permission to access location was denied';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is unavailable';
        } else if (err.code === err.TIMEOUT) {
          msg = 'The request to get user location timed out';
        }
        reject(new GeoLocationError(msg, err.code));
      },
      {
        enableHighAccuracy: true,
        timeout,
        maximumAge: 10000,
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
