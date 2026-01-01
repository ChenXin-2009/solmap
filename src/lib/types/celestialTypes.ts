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
  primeMeridianAtJ2000: number; // Prime meridian longitude at J2000.0 epoch in degrees (W longitude)
  
  // Axial tilt parameters (J2000.0 epoch)
  // Reference: NASA Planetary Fact Sheets
  axialTilt: number; // Obliquity to orbit in degrees (angle between rotation axis and orbit normal)
  northPoleRA: number; // North pole right ascension in degrees (J2000.0)
  northPoleDec: number; // North pole declination in degrees (J2000.0)
  
  // Satellite properties
  isSatellite?: boolean;
  parentBody?: string; // Parent body name for satellites
}

export interface RotationConfig {
  rotationPeriod: number; // Rotation period in hours
  rotationSpeed: number; // Calculated rotation speed in radians per second
}

/**
 * Axial tilt configuration for a celestial body
 * Used to orient the rotation axis in 3D space
 */
export interface AxialTiltConfig {
  axialTilt: number; // Obliquity in degrees
  northPoleRA: number; // North pole right ascension in degrees
  northPoleDec: number; // North pole declination in degrees
}

/**
 * Convert equatorial coordinates (RA, Dec) to ecliptic coordinates
 * 
 * @param ra Right ascension in degrees
 * @param dec Declination in degrees
 * @param obliquity Earth's obliquity (23.4393 degrees for J2000.0)
 * @returns Ecliptic longitude and latitude in radians
 */
export function equatorialToEcliptic(ra: number, dec: number, obliquity: number = 23.4393): { lon: number; lat: number } {
  const raRad = ra * Math.PI / 180;
  const decRad = dec * Math.PI / 180;
  const oblRad = obliquity * Math.PI / 180;
  
  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const sinRA = Math.sin(raRad);
  const cosRA = Math.cos(raRad);
  const sinObl = Math.sin(oblRad);
  const cosObl = Math.cos(oblRad);
  
  // Ecliptic latitude (beta)
  const sinLat = sinDec * cosObl - cosDec * sinObl * sinRA;
  const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
  
  // Ecliptic longitude (lambda)
  const y = sinRA * cosObl + Math.tan(decRad) * sinObl;
  const x = cosRA;
  const lon = Math.atan2(y, x);
  
  return { lon, lat };
}

/**
 * Calculate the rotation axis direction vector in scene coordinates
 * 
 * Scene coordinate system (same as orbit calculation output):
 * - X axis: points to vernal equinox (ecliptic longitude 0°)
 * - Y axis: in ecliptic plane, perpendicular to X (ecliptic longitude 90°)
 * - Z axis: points to ecliptic north pole (perpendicular to ecliptic plane)
 * 
 * The rotation axis is a unit vector pointing from planet center to its north pole.
 * 
 * @param northPoleRA North pole right ascension in degrees (J2000.0)
 * @param northPoleDec North pole declination in degrees (J2000.0)
 * @returns Unit vector pointing to north pole in scene coordinates
 */
export function calculateRotationAxis(northPoleRA: number, northPoleDec: number): { x: number; y: number; z: number } {
  // Convert equatorial to ecliptic coordinates
  const { lon, lat } = equatorialToEcliptic(northPoleRA, northPoleDec);
  
  // Convert ecliptic spherical (lon, lat) to Cartesian
  // lon = ecliptic longitude (0° = vernal equinox, 90° = summer solstice direction)
  // lat = ecliptic latitude (0° = ecliptic plane, 90° = ecliptic north pole)
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosLon = Math.cos(lon);
  const sinLon = Math.sin(lon);
  
  // Scene coordinates (ecliptic):
  // X = cos(lat) * cos(lon)  -> points to vernal equinox when lon=0, lat=0
  // Y = cos(lat) * sin(lon)  -> points to lon=90° direction
  // Z = sin(lat)             -> points to ecliptic north pole when lat=90°
  return {
    x: cosLat * cosLon,
    y: cosLat * sinLon,
    z: sinLat
  };
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
 * Celestial body configurations with rotation periods and axial tilt
 * 
 * Axial tilt data source: NASA Planetary Fact Sheets (J2000.0 epoch)
 * https://nssdc.gsfc.nasa.gov/planetary/factsheet/
 * 
 * Prime meridian (W0) data source: IAU Working Group on Cartographic Coordinates
 * https://astrogeology.usgs.gov/search/map/Docs/WGCCRE/WGCCRE2015reprint
 * 
 * North pole coordinates are in ICRF/J2000.0 equatorial frame
 * - northPoleRA: Right ascension of north pole (degrees)
 * - northPoleDec: Declination of north pole (degrees)
 * - axialTilt: Obliquity to orbit (degrees) - angle between rotation axis and orbit normal
 * - primeMeridianAtJ2000: Prime meridian longitude at J2000.0 (degrees) - W0 in IAU notation
 * 
 * Note on retrograde rotation:
 * - Venus and Uranus have retrograde rotation (spin opposite to orbital motion)
 * - Venus: axialTilt ~177° (nearly upside down)
 * - Uranus: axialTilt ~97.77° (tilted on its side)
 * - Negative rotationPeriod indicates retrograde rotation
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
    rotationPeriod: 25.4 * 24, // ~25.4 days at equator
    primeMeridianAtJ2000: 84.176, // IAU 2015
    axialTilt: 7.25, // Tilt relative to ecliptic
    northPoleRA: 286.13, // J2000.0
    northPoleDec: 63.87, // J2000.0
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
    rotationPeriod: 58.6 * 24, // 58.6 Earth days
    primeMeridianAtJ2000: 329.5469, // IAU 2015
    axialTilt: 0.034, // Nearly no tilt
    northPoleRA: 281.01, // J2000.0
    northPoleDec: 61.45, // J2000.0
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
    rotationPeriod: -243 * 24, // Retrograde rotation, 243 Earth days
    primeMeridianAtJ2000: 160.20, // IAU 2015
    axialTilt: 177.36, // Nearly upside down (retrograde)
    northPoleRA: 272.76, // J2000.0
    northPoleDec: 67.16, // J2000.0
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
    rotationPeriod: 23.9345, // Sidereal day in hours (not solar day of 24h)
    primeMeridianAtJ2000: 190.147, // GMST at J2000.0 converted to prime meridian angle
    axialTilt: 23.44, // Earth's famous obliquity
    northPoleRA: 0.0, // By definition (ICRF aligned with Earth's equator at J2000.0)
    northPoleDec: 90.0, // North celestial pole
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
    rotationPeriod: 24.6229, // Mars sidereal day in hours
    primeMeridianAtJ2000: 176.630, // IAU 2015
    axialTilt: 25.19, // Similar to Earth
    northPoleRA: 317.68, // J2000.0
    northPoleDec: 52.89, // J2000.0
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
    rotationPeriod: 9.9250, // System III rotation period in hours
    primeMeridianAtJ2000: 284.95, // IAU 2015 (System III)
    axialTilt: 3.13, // Small tilt
    northPoleRA: 268.06, // J2000.0
    northPoleDec: 64.50, // J2000.0
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
    rotationPeriod: 10.656, // System III rotation period in hours
    primeMeridianAtJ2000: 38.90, // IAU 2015 (System III)
    axialTilt: 26.73, // Similar to Earth
    northPoleRA: 40.59, // J2000.0
    northPoleDec: 83.54, // J2000.0
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
    rotationPeriod: -17.24, // Retrograde rotation, 17.24 hours
    primeMeridianAtJ2000: 203.81, // IAU 2015
    axialTilt: 97.77, // Tilted on its side!
    northPoleRA: 257.31, // J2000.0
    northPoleDec: -15.18, // J2000.0 (negative declination)
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
    rotationPeriod: 16.11, // 16.11 hours
    primeMeridianAtJ2000: 253.18, // IAU 2015
    axialTilt: 28.32, // Similar to Earth
    northPoleRA: 299.33, // J2000.0 (updated from 299.40)
    northPoleDec: 42.95, // J2000.0
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
    rotationPeriod: 27.32 * 24, // Tidally locked
    primeMeridianAtJ2000: 38.3213, // IAU 2015
    axialTilt: 6.68, // Relative to ecliptic
    northPoleRA: 270.0, // Approximate
    northPoleDec: 66.54, // J2000.0
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
    rotationPeriod: 1.77 * 24, // Tidally locked
    primeMeridianAtJ2000: 200.39, // IAU 2015
    axialTilt: 0.0, // Tidally locked, aligned with Jupiter's equator
    northPoleRA: 268.05,
    northPoleDec: 64.50,
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
    rotationPeriod: 3.55 * 24, // Tidally locked
    primeMeridianAtJ2000: 36.022, // IAU 2015
    axialTilt: 0.1,
    northPoleRA: 268.08,
    northPoleDec: 64.51,
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
    rotationPeriod: 7.15 * 24, // Tidally locked
    primeMeridianAtJ2000: 44.064, // IAU 2015
    axialTilt: 0.2,
    northPoleRA: 268.20,
    northPoleDec: 64.57,
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
    rotationPeriod: 16.69 * 24, // Tidally locked
    primeMeridianAtJ2000: 259.51, // IAU 2015
    axialTilt: 0.0,
    northPoleRA: 268.72,
    northPoleDec: 64.83,
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
    rotationPeriod: 15.95 * 24, // Tidally locked
    primeMeridianAtJ2000: 186.5855, // IAU 2015
    axialTilt: 0.3, // Small tilt relative to Saturn's equator
    northPoleRA: 39.48,
    northPoleDec: 83.43,
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
    rotationPeriod: 1.37 * 24, // Tidally locked
    primeMeridianAtJ2000: 6.32, // IAU 2015
    axialTilt: 0.0,
    northPoleRA: 40.66,
    northPoleDec: 83.52,
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
    rotationPeriod: 1.41 * 24, // Tidally locked
    primeMeridianAtJ2000: 30.70, // IAU 2015
    axialTilt: 0.0, // Aligned with Uranus's equator
    northPoleRA: 257.43,
    northPoleDec: -15.08,
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
    rotationPeriod: 2.52 * 24, // Tidally locked
    primeMeridianAtJ2000: 156.22, // IAU 2015
    axialTilt: 0.0,
    northPoleRA: 257.43,
    northPoleDec: -15.10,
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
    rotationPeriod: 4.14 * 24, // Tidally locked
    primeMeridianAtJ2000: 108.05, // IAU 2015
    axialTilt: 0.0,
    northPoleRA: 257.43,
    northPoleDec: -15.10,
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
    rotationPeriod: 8.71 * 24, // Tidally locked
    primeMeridianAtJ2000: 77.74, // IAU 2015
    axialTilt: 0.0,
    northPoleRA: 257.43,
    northPoleDec: -15.10,
    isSatellite: true,
    parentBody: 'uranus'
  }
};
