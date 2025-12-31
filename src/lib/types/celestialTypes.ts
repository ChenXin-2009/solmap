/**
 * Celestial body type definitions
 * 
 * This file defines the interfaces and types used for celestial body configuration
 * including orbital parameters, physical properties, and rendering settings.
 */

export interface CelestialBodyConfig {
  name: string;
  radius: number; // Physical radius in AU
  color: string;
  
  // Orbital parameters
  semiMajorAxis: number; // Semi-major axis in AU
  eccentricity: number; // Orbital eccentricity (0-1)
  inclination: number; // Orbital inclination in degrees
  longitudeOfAscendingNode: number; // Longitude of ascending node in degrees
  argumentOfPeriapsis: number; // Argument of periapsis in degrees
  meanAnomalyAtEpoch: number; // Mean anomaly at epoch in degrees
  orbitalPeriod: number; // Orbital period in days
  
  // Rotation parameters
  rotationPeriod: number; // Rotation period in hours (negative for retrograde)
  
  // Satellite properties
  isSatellite?: boolean;
  parentBody?: string; // Parent body name for satellites
}

export interface RotationConfig {
  rotationPeriod: number; // Rotation period in hours
  rotationSpeed: number; // Calculated rotation speed in radians per second
}

/**
 * Convert rotation period (hours) to rotation speed (radians per second)
 */
export function rotationPeriodToSpeed(rotationPeriodHours: number): number {
  if (rotationPeriodHours === 0) return 0;
  
  // Convert hours to seconds, then calculate radians per second
  const rotationPeriodSeconds = Math.abs(rotationPeriodHours) * 3600;
  const rotationSpeed = (2 * Math.PI) / rotationPeriodSeconds;
  
  // Return negative for retrograde rotation
  return rotationPeriodHours < 0 ? -rotationSpeed : rotationSpeed;
}

/**
 * Celestial body configurations with rotation periods
 */
export const CELESTIAL_BODIES: Record<string, CelestialBodyConfig> = {
  sun: {
    name: 'Sun',
    radius: 0.00465,
    color: '#FDB813',
    semiMajorAxis: 0,
    eccentricity: 0,
    inclination: 0,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 0,
    rotationPeriod: 25.4 * 24,
    isSatellite: false
  },
  mercury: {
    name: 'Mercury',
    radius: 0.0000163,
    color: '#8C7853',
    semiMajorAxis: 0.387,
    eccentricity: 0.206,
    inclination: 7.0,
    longitudeOfAscendingNode: 48.3,
    argumentOfPeriapsis: 29.1,
    meanAnomalyAtEpoch: 174.8,
    orbitalPeriod: 87.97,
    rotationPeriod: 58.6 * 24,
    isSatellite: false
  },
  venus: {
    name: 'Venus',
    radius: 0.0000405,
    color: '#FFC649',
    semiMajorAxis: 0.723,
    eccentricity: 0.007,
    inclination: 3.4,
    longitudeOfAscendingNode: 76.7,
    argumentOfPeriapsis: 54.9,
    meanAnomalyAtEpoch: 50.1,
    orbitalPeriod: 224.7,
    rotationPeriod: -243 * 24,
    isSatellite: false
  },
  earth: {
    name: 'Earth',
    radius: 0.0000426,
    color: '#6B93D6',
    semiMajorAxis: 1.0,
    eccentricity: 0.017,
    inclination: 0.0,
    longitudeOfAscendingNode: 0.0,
    argumentOfPeriapsis: 102.9,
    meanAnomalyAtEpoch: 100.5,
    orbitalPeriod: 365.25,
    rotationPeriod: 24,
    isSatellite: false
  },
  mars: {
    name: 'Mars',
    radius: 0.0000227,
    color: '#C1440E',
    semiMajorAxis: 1.524,
    eccentricity: 0.094,
    inclination: 1.9,
    longitudeOfAscendingNode: 49.6,
    argumentOfPeriapsis: 286.5,
    meanAnomalyAtEpoch: 19.4,
    orbitalPeriod: 686.98,
    rotationPeriod: 24.6,
    isSatellite: false
  },
  jupiter: {
    name: 'Jupiter',
    radius: 0.000477,
    color: '#D8CA9D',
    semiMajorAxis: 5.204,
    eccentricity: 0.049,
    inclination: 1.3,
    longitudeOfAscendingNode: 100.5,
    argumentOfPeriapsis: 273.9,
    meanAnomalyAtEpoch: 20.0,
    orbitalPeriod: 4332.59,
    rotationPeriod: 9.9,
    isSatellite: false
  },
  saturn: {
    name: 'Saturn',
    radius: 0.000403,
    color: '#FAD5A5',
    semiMajorAxis: 9.573,
    eccentricity: 0.057,
    inclination: 2.5,
    longitudeOfAscendingNode: 113.7,
    argumentOfPeriapsis: 339.4,
    meanAnomalyAtEpoch: 317.0,
    orbitalPeriod: 10759.22,
    rotationPeriod: 10.7,
    isSatellite: false
  },
  uranus: {
    name: 'Uranus',
    radius: 0.000171,
    color: '#4FD0E7',
    semiMajorAxis: 19.165,
    eccentricity: 0.046,
    inclination: 0.8,
    longitudeOfAscendingNode: 74.0,
    argumentOfPeriapsis: 96.7,
    meanAnomalyAtEpoch: 142.2,
    orbitalPeriod: 30688.5,
    rotationPeriod: -17.2,
    isSatellite: false
  },
  neptune: {
    name: 'Neptune',
    radius: 0.000166,
    color: '#4B70DD',
    semiMajorAxis: 30.178,
    eccentricity: 0.009,
    inclination: 1.8,
    longitudeOfAscendingNode: 131.8,
    argumentOfPeriapsis: 276.3,
    meanAnomalyAtEpoch: 256.2,
    orbitalPeriod: 60182,
    rotationPeriod: 16.1,
    isSatellite: false
  },
  
  // Satellites
  moon: {
    name: 'Moon',
    radius: 0.0000116,
    color: '#C0C0C0',
    semiMajorAxis: 0.00257,
    eccentricity: 0.055,
    inclination: 5.1,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 27.32,
    rotationPeriod: 27.32 * 24,
    isSatellite: true,
    parentBody: 'earth'
  },
  
  // Jupiter satellites
  io: {
    name: 'Io',
    radius: 0.0000122,
    color: '#FFFF99',
    semiMajorAxis: 0.00282,
    eccentricity: 0.004,
    inclination: 0.04,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 1.77,
    rotationPeriod: 1.77 * 24,
    isSatellite: true,
    parentBody: 'jupiter'
  },
  europa: {
    name: 'Europa',
    radius: 0.0000104,
    color: '#87CEEB',
    semiMajorAxis: 0.00449,
    eccentricity: 0.009,
    inclination: 0.47,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 3.55,
    rotationPeriod: 3.55 * 24,
    isSatellite: true,
    parentBody: 'jupiter'
  },
  ganymede: {
    name: 'Ganymede',
    radius: 0.0000176,
    color: '#8B7355',
    semiMajorAxis: 0.00716,
    eccentricity: 0.001,
    inclination: 0.20,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 7.15,
    rotationPeriod: 7.15 * 24,
    isSatellite: true,
    parentBody: 'jupiter'
  },
  callisto: {
    name: 'Callisto',
    radius: 0.0000161,
    color: '#4A4A4A',
    semiMajorAxis: 0.01259,
    eccentricity: 0.007,
    inclination: 0.19,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 16.69,
    rotationPeriod: 16.69 * 24,
    isSatellite: true,
    parentBody: 'jupiter'
  },
  
  // Saturn satellites
  titan: {
    name: 'Titan',
    radius: 0.0000172,
    color: '#FFA500',
    semiMajorAxis: 0.00817,
    eccentricity: 0.029,
    inclination: 0.35,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 15.95,
    rotationPeriod: 15.95 * 24,
    isSatellite: true,
    parentBody: 'saturn'
  },
  enceladus: {
    name: 'Enceladus',
    radius: 0.00000168,
    color: '#F0F8FF',
    semiMajorAxis: 0.00159,
    eccentricity: 0.005,
    inclination: 0.02,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 1.37,
    rotationPeriod: 1.37 * 24,
    isSatellite: true,
    parentBody: 'saturn'
  },
  
  // Uranus satellites
  miranda: {
    name: 'Miranda',
    radius: 0.00000158,
    color: '#D3D3D3',
    semiMajorAxis: 0.000863,
    eccentricity: 0.001,
    inclination: 4.2,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 1.41,
    rotationPeriod: 1.41 * 24,
    isSatellite: true,
    parentBody: 'uranus'
  },
  ariel: {
    name: 'Ariel',
    radius: 0.00000387,
    color: '#E6E6FA',
    semiMajorAxis: 0.00128,
    eccentricity: 0.001,
    inclination: 0.3,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 2.52,
    rotationPeriod: 2.52 * 24,
    isSatellite: true,
    parentBody: 'uranus'
  },
  umbriel: {
    name: 'Umbriel',
    radius: 0.00000391,
    color: '#696969',
    semiMajorAxis: 0.00178,
    eccentricity: 0.004,
    inclination: 0.1,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 4.14,
    rotationPeriod: 4.14 * 24,
    isSatellite: true,
    parentBody: 'uranus'
  },
  titania: {
    name: 'Titania',
    radius: 0.00000527,
    color: '#B0C4DE',
    semiMajorAxis: 0.00291,
    eccentricity: 0.001,
    inclination: 0.1,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 8.71,
    rotationPeriod: 8.71 * 24,
    isSatellite: true,
    parentBody: 'uranus'
  }
};
