/**
 * Tests for celestial body axial tilt calculations
 */

import { calculateRotationAxis, equatorialToEcliptic, CELESTIAL_BODIES } from './celestialTypes';

describe('Axial Tilt Calculations', () => {
  describe('equatorialToEcliptic', () => {
    it('should convert Earth north pole correctly', () => {
      // Earth's north pole is at RA=0, Dec=90 (by definition)
      // In ecliptic coordinates, this should be at ecliptic latitude ~66.56° (90° - 23.44°)
      const result = equatorialToEcliptic(0, 90);
      const latDeg = result.lat * 180 / Math.PI;
      
      // Ecliptic latitude should be approximately 90° - 23.44° = 66.56°
      expect(latDeg).toBeCloseTo(66.56, 0);
    });

    it('should handle vernal equinox point', () => {
      // Vernal equinox: RA=0, Dec=0
      // Should be at ecliptic lon=0, lat=0
      const result = equatorialToEcliptic(0, 0);
      expect(result.lon).toBeCloseTo(0, 5);
      expect(result.lat).toBeCloseTo(0, 5);
    });
  });

  describe('calculateRotationAxis', () => {
    it('should return Z-up for ecliptic north pole', () => {
      // Ecliptic north pole in equatorial: RA=270°, Dec=66.56°
      const axis = calculateRotationAxis(270, 66.56);
      
      // Should point mostly in Z direction (ecliptic north)
      expect(axis.z).toBeGreaterThan(0.9);
    });

    it('should handle Earth correctly', () => {
      const earth = CELESTIAL_BODIES.earth;
      const axis = calculateRotationAxis(earth.northPoleRA, earth.northPoleDec);
      
      // Earth's axis should be tilted ~23.44° from ecliptic north (Z axis)
      // So Z component should be cos(23.44°) ≈ 0.917
      // The axis should point mostly in +Z direction with some tilt
      expect(axis.z).toBeCloseTo(0.917, 1);
    });

    it('should handle Uranus extreme tilt', () => {
      const uranus = CELESTIAL_BODIES.uranus;
      const axis = calculateRotationAxis(uranus.northPoleRA, uranus.northPoleDec);
      
      // Uranus is tilted ~97.77°, so its axis is nearly in the ecliptic plane
      // Z component should be small (close to 0 or negative)
      expect(Math.abs(axis.z)).toBeLessThan(0.3);
    });
  });

  describe('CELESTIAL_BODIES data', () => {
    it('should have axial tilt data for all major planets', () => {
      const majorPlanets = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
      
      for (const planet of majorPlanets) {
        const body = CELESTIAL_BODIES[planet];
        expect(body).toBeDefined();
        expect(body.axialTilt).toBeDefined();
        expect(body.northPoleRA).toBeDefined();
        expect(body.northPoleDec).toBeDefined();
      }
    });

    it('should have correct Earth axial tilt', () => {
      expect(CELESTIAL_BODIES.earth.axialTilt).toBeCloseTo(23.44, 1);
    });

    it('should have correct Venus retrograde tilt', () => {
      // Venus is nearly upside down
      expect(CELESTIAL_BODIES.venus.axialTilt).toBeGreaterThan(170);
    });

    it('should have correct Uranus extreme tilt', () => {
      // Uranus is tilted on its side
      expect(CELESTIAL_BODIES.uranus.axialTilt).toBeGreaterThan(90);
      expect(CELESTIAL_BODIES.uranus.axialTilt).toBeLessThan(100);
    });
  });
});
