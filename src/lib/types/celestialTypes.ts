/**
 * Celestial body type definitions
 * 
 * This file defines the interfaces and types used for celestial body configuration
 * including orbital parameters, physical properties, and rendering settings.
 */

/**
 * Rotation sense (prograde or retrograde).
 * 
 * - "prograde": rotation in same direction as orbital motion (most planets)
 * - "retrograde": rotation opposite to orbital motion (Venus, Uranus)
 * 
 * @requirements 2.6
 */
export type RotationSense = "prograde" | "retrograde";

/**
 * Configuration for a celestial body's orientation.
 * 
 * This is the input configuration that can be provided in two ways:
 * 1. Direct spinAxis vector (preferred)
 * 2. obliquityDegrees (legacy, will be converted to spinAxis)
 * 
 * @requirements 2.1, 2.2, 7.1, 7.4
 */
export interface CelestialBodyOrientationConfig {
  /**
   * Spin axis vector in ICRF/J2000 ecliptic frame.
   * If provided, this is the authoritative source.
   * Must be a unit vector (magnitude = 1 ± 0.0001).
   */
  spinAxis?: readonly [number, number, number];

  /**
   * Obliquity in degrees (legacy support).
   * Used to compute spinAxis if spinAxis not provided.
   * Range: [0, 90] for prograde, (90, 180] for retrograde.
   * 
   * NOTE: For retrograde rotators, obliquity encodes BOTH
   * geometric tilt AND rotation sense. See rotationSense for
   * explicit control.
   */
  obliquityDegrees?: number;

  /**
   * Rotation sense (prograde or retrograde).
   * 
   * If not specified:
   * - obliquity <= 90°: assumed prograde
   * - obliquity > 90°: assumed retrograde
   */
  rotationSense?: RotationSense;

  /**
   * Model north axis (which local axis points to north pole).
   * Default: [0, 1, 0] for +Y
   */
  modelNorthAxis?: readonly [number, number, number];

  /**
   * Precession rate in arcseconds per century.
   * Reserved for future use (Phase 1 does not implement precession).
   * 
   * @requirements 7.4
   */
  precessionRate?: number;
}

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
  
  // Orientation parameters (axial tilt physics system)
  // @requirements 2.1, 7.4
  orientation?: CelestialBodyOrientationConfig;
  
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
    radius: 0.00465, // Sun radius ~696,000 km, converted to AU
    color: '#FDB813',
    semiMajorAxis: 0,
    eccentricity: 0,
    inclination: 0,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 0,
    rotationPeriod: 25.4 * 24, // Sun rotation period ~25.4 days, converted to hours
    orientation: {
      // Sun - NASA/IAU J2000.0 pole coordinates
      // RA: 286.13°, Dec: 63.87°
      spinAxis: [0.122353, -0.423072, 0.897797] as const,
      rotationSense: 'prograde'
    },
    isSatellite: false
  },
  mercury: {
    name: 'Mercury',
    radius: 0.0000163, // Mercury radius ~2,440 km
    color: '#8C7853',
    semiMajorAxis: 0.387,
    eccentricity: 0.206,
    inclination: 7.0,
    longitudeOfAscendingNode: 48.3,
    argumentOfPeriapsis: 29.1,
    meanAnomalyAtEpoch: 174.8,
    orbitalPeriod: 87.97,
    rotationPeriod: 58.6 * 24, // Mercury rotation period ~58.6 days, converted to hours
    orientation: {
      // Mercury - NASA/IAU J2000.0 pole coordinates
      // RA: 281.01°, Dec: 61.41°
      spinAxis: [0.091391, -0.469731, 0.878067] as const,
      rotationSense: 'prograde'
    },
    isSatellite: false
  },
  venus: {
    name: 'Venus',
    radius: 0.0000405, // Venus radius ~6,052 km
    color: '#FFC649',
    semiMajorAxis: 0.723,
    eccentricity: 0.007,
    inclination: 3.4,
    longitudeOfAscendingNode: 76.7,
    argumentOfPeriapsis: 54.9,
    meanAnomalyAtEpoch: 50.1,
    orbitalPeriod: 224.7,
    rotationPeriod: -243 * 24, // Venus retrograde rotation, period ~243 days, negative for retrograde
    orientation: {
      // Venus - NASA/IAU J2000.0 pole coordinates
      // RA: 92.76°, Dec: -67.16°
      spinAxis: [-0.018691, 0.387709, -0.921592] as const,
      rotationSense: 'retrograde' // Explicit retrograde marker per Requirements 3.5
    },
    isSatellite: false
  },
  earth: {
    name: 'Earth',
    radius: 0.0000426, // Earth radius ~6,371 km
    color: '#6B93D6',
    semiMajorAxis: 1.0,
    eccentricity: 0.017,
    inclination: 0.0,
    longitudeOfAscendingNode: 0.0,
    argumentOfPeriapsis: 102.9,
    meanAnomalyAtEpoch: 100.5,
    orbitalPeriod: 365.25,
    rotationPeriod: 24, // Earth rotation period 24 hours
    orientation: {
      // Earth - NASA/IAU J2000.0 pole coordinates
      // RA: 0°, Dec: 90° (by definition)
      spinAxis: [0.000000, 0.000000, 1.000000] as const,
      rotationSense: 'prograde',
      precessionRate: 50.29 // Earth's precession rate in arcseconds/century
    },
    isSatellite: false
  },
  mars: {
    name: 'Mars',
    radius: 0.0000227, // Mars radius ~3,390 km
    color: '#C1440E',
    semiMajorAxis: 1.524,
    eccentricity: 0.094,
    inclination: 1.9,
    longitudeOfAscendingNode: 49.6,
    argumentOfPeriapsis: 286.5,
    meanAnomalyAtEpoch: 19.4,
    orbitalPeriod: 686.98,
    rotationPeriod: 24.6, // Mars rotation period ~24.6 hours
    orientation: {
      // Mars - NASA/IAU J2000.0 pole coordinates
      // RA: 317.68°, Dec: 52.89°
      spinAxis: [0.446113, -0.406216, 0.797479] as const,
      rotationSense: 'prograde'
    },
    isSatellite: false
  },
  jupiter: {
    name: 'Jupiter',
    radius: 0.000477, // Jupiter radius ~71,492 km
    color: '#D8CA9D',
    semiMajorAxis: 5.204,
    eccentricity: 0.049,
    inclination: 1.3,
    longitudeOfAscendingNode: 100.5,
    argumentOfPeriapsis: 273.9,
    meanAnomalyAtEpoch: 20.0,
    orbitalPeriod: 4332.59,
    rotationPeriod: 9.9, // Jupiter rotation period ~9.9 hours
    orientation: {
      // Jupiter - NASA/IAU J2000.0 pole coordinates
      // RA: 268.06°, Dec: 64.5°
      spinAxis: [-0.014574, -0.430264, 0.902585] as const,
      rotationSense: 'prograde'
    },
    isSatellite: false
  },
  saturn: {
    name: 'Saturn',
    radius: 0.000403, // Saturn radius ~60,268 km
    color: '#FAD5A5',
    semiMajorAxis: 9.573,
    eccentricity: 0.057,
    inclination: 2.5,
    longitudeOfAscendingNode: 113.7,
    argumentOfPeriapsis: 339.4,
    meanAnomalyAtEpoch: 317.0,
    orbitalPeriod: 10759.22,
    rotationPeriod: 10.7, // Saturn rotation period ~10.7 hours
    orientation: {
      // Saturn - NASA/IAU J2000.0 pole coordinates
      // RA: 40.59°, Dec: 83.54°
      spinAxis: [0.085438, 0.073203, 0.993651] as const,
      rotationSense: 'prograde'
    },
    isSatellite: false
  },
  uranus: {
    name: 'Uranus',
    radius: 0.000171, // Uranus radius ~25,559 km
    color: '#4FD0E7',
    semiMajorAxis: 19.165,
    eccentricity: 0.046,
    inclination: 0.8,
    longitudeOfAscendingNode: 74.0,
    argumentOfPeriapsis: 96.7,
    meanAnomalyAtEpoch: 142.2,
    orbitalPeriod: 30688.5,
    rotationPeriod: -17.2, // Uranus retrograde rotation, period ~17.2 hours
    orientation: {
      // Uranus - NASA/IAU J2000.0 pole coordinates
      // RA: 257.31°, Dec: -15.18°
      spinAxis: [-0.212011, -0.941533, -0.261852] as const,
      rotationSense: 'retrograde' // Explicit retrograde marker per Requirements 3.5
    },
    isSatellite: false
  },
  neptune: {
    name: 'Neptune',
    radius: 0.000166, // Neptune radius ~24,764 km
    color: '#4B70DD',
    semiMajorAxis: 30.178,
    eccentricity: 0.009,
    inclination: 1.8,
    longitudeOfAscendingNode: 131.8,
    argumentOfPeriapsis: 276.3,
    meanAnomalyAtEpoch: 256.2,
    orbitalPeriod: 60182,
    rotationPeriod: 16.1, // Neptune rotation period ~16.1 hours
    orientation: {
      // Neptune - NASA/IAU J2000.0 pole coordinates
      // RA: 299.33°, Dec: 42.95°
      spinAxis: [0.358537, -0.638122, 0.681360] as const,
      rotationSense: 'prograde'
    },
    isSatellite: false
  },
  
  // Satellites
  moon: {
    name: 'Moon',
    radius: 0.0000116, // Moon radius ~1,737 km
    color: '#C0C0C0',
    semiMajorAxis: 0.00257, // Moon orbital radius ~384,400 km, converted to AU
    eccentricity: 0.055,
    inclination: 5.1,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 27.32,
    rotationPeriod: 27.32 * 24, // Moon is tidally locked, rotation period equals orbital period
    orientation: {
      obliquityDegrees: 6.68, // Moon's obliquity relative to its orbit around Earth
      rotationSense: 'prograde'
    },
    isSatellite: true,
    parentBody: 'earth'
  },
  
  // Jupiter satellites
  io: {
    name: 'Io',
    radius: 0.0000122, // Io radius ~1,822 km
    color: '#FFFF99',
    semiMajorAxis: 0.00282, // Io orbital radius ~421,700 km
    eccentricity: 0.004,
    inclination: 0.04,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 1.77,
    rotationPeriod: 1.77 * 24, // Io is tidally locked
    orientation: {
      obliquityDegrees: 0.0, // Io is tidally locked with minimal obliquity
      rotationSense: 'prograde'
    },
    isSatellite: true,
    parentBody: 'jupiter'
  },
  europa: {
    name: 'Europa',
    radius: 0.0000104, // Europa radius ~1,561 km
    color: '#87CEEB',
    semiMajorAxis: 0.00449, // Europa orbital radius ~671,034 km
    eccentricity: 0.009,
    inclination: 0.47,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 3.55,
    rotationPeriod: 3.55 * 24, // Europa is tidally locked
    orientation: {
      obliquityDegrees: 0.1, // Europa has minimal obliquity
      rotationSense: 'prograde'
    },
    isSatellite: true,
    parentBody: 'jupiter'
  },
  ganymede: {
    name: 'Ganymede',
    radius: 0.0000176, // Ganymede radius ~2,634 km
    color: '#8B7355',
    semiMajorAxis: 0.00716, // Ganymede orbital radius ~1,070,412 km
    eccentricity: 0.001,
    inclination: 0.20,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 7.15,
    rotationPeriod: 7.15 * 24, // Ganymede is tidally locked
    orientation: {
      obliquityDegrees: 0.33, // Ganymede has small obliquity
      rotationSense: 'prograde'
    },
    isSatellite: true,
    parentBody: 'jupiter'
  },
  callisto: {
    name: 'Callisto',
    radius: 0.0000161, // Callisto radius ~2,410 km
    color: '#4A4A4A',
    semiMajorAxis: 0.01259, // Callisto orbital radius ~1,882,709 km
    eccentricity: 0.007,
    inclination: 0.19,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 16.69,
    rotationPeriod: 16.69 * 24, // Callisto is tidally locked
    orientation: {
      obliquityDegrees: 0.0, // Callisto is tidally locked with minimal obliquity
      rotationSense: 'prograde'
    },
    isSatellite: true,
    parentBody: 'jupiter'
  },
  
  // Saturn satellites
  titan: {
    name: 'Titan',
    radius: 0.0000172, // Titan radius ~2,574 km
    color: '#FFA500',
    semiMajorAxis: 0.00817, // Titan orbital radius ~1,221,830 km
    eccentricity: 0.029,
    inclination: 0.35,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 15.95,
    rotationPeriod: 15.95 * 24, // Titan is tidally locked
    orientation: {
      obliquityDegrees: 0.0, // Titan is tidally locked with minimal obliquity
      rotationSense: 'prograde'
    },
    isSatellite: true,
    parentBody: 'saturn'
  },
  enceladus: {
    name: 'Enceladus',
    radius: 0.00000168, // Enceladus radius ~252 km
    color: '#F0F8FF',
    semiMajorAxis: 0.00159, // Enceladus orbital radius ~238,020 km
    eccentricity: 0.005,
    inclination: 0.02,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 1.37,
    rotationPeriod: 1.37 * 24, // Enceladus is tidally locked
    orientation: {
      obliquityDegrees: 0.0, // Enceladus is tidally locked with minimal obliquity
      rotationSense: 'prograde'
    },
    isSatellite: true,
    parentBody: 'saturn'
  },
  
  // Uranus satellites
  miranda: {
    name: 'Miranda',
    radius: 0.00000158, // Miranda radius ~236 km
    color: '#D3D3D3',
    semiMajorAxis: 0.000863, // Miranda orbital radius ~129,390 km
    eccentricity: 0.001,
    inclination: 4.2,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 1.41,
    rotationPeriod: 1.41 * 24, // Miranda is tidally locked
    orientation: {
      obliquityDegrees: 0.0, // Miranda is tidally locked with minimal obliquity
      rotationSense: 'prograde'
    },
    isSatellite: true,
    parentBody: 'uranus'
  },
  ariel: {
    name: 'Ariel',
    radius: 0.00000387, // Ariel radius ~579 km
    color: '#E6E6FA',
    semiMajorAxis: 0.00128, // Ariel orbital radius ~191,020 km
    eccentricity: 0.001,
    inclination: 0.3,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 2.52,
    rotationPeriod: 2.52 * 24, // Ariel is tidally locked
    orientation: {
      obliquityDegrees: 0.0, // Ariel is tidally locked with minimal obliquity
      rotationSense: 'prograde'
    },
    isSatellite: true,
    parentBody: 'uranus'
  },
  umbriel: {
    name: 'Umbriel',
    radius: 0.00000391, // Umbriel radius ~585 km
    color: '#696969',
    semiMajorAxis: 0.00178, // Umbriel orbital radius ~266,300 km
    eccentricity: 0.004,
    inclination: 0.1,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 4.14,
    rotationPeriod: 4.14 * 24, // Umbriel is tidally locked
    orientation: {
      obliquityDegrees: 0.0, // Umbriel is tidally locked with minimal obliquity
      rotationSense: 'prograde'
    },
    isSatellite: true,
    parentBody: 'uranus'
  },
  titania: {
    name: 'Titania',
    radius: 0.00000527, // Titania radius ~789 km
    color: '#B0C4DE',
    semiMajorAxis: 0.00291, // Titania orbital radius ~435,910 km
    eccentricity: 0.001,
    inclination: 0.1,
    longitudeOfAscendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    orbitalPeriod: 8.71,
    rotationPeriod: 8.71 * 24, // Titania is tidally locked
    orientation: {
      obliquityDegrees: 0.0, // Titania is tidally locked with minimal obliquity
      rotationSense: 'prograde'
    },
    isSatellite: true,
    parentBody: 'uranus'
  }
};