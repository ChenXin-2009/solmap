/**
 * Property Tests for Planet Rotation System
 * 
 * These tests validate universal properties for planet self-rotation,
 * rotation continuity, and scientific accuracy.
 */

import * as THREE from 'three';
import { Planet } from '@/lib/3d/Planet';
import { CelestialBodyConfig } from '@/lib/types/celestialTypes';

describe('Planet Rotation Properties', () => {
  
  const createTestPlanet = (
    name: string, 
    rotationPeriod: number, 
    radius: number = 0.01
  ): { planet: Planet; config: CelestialBodyConfig } => {
    const config: CelestialBodyConfig = {
      name,
      radius,
      color: '#FFFFFF',
      semiMajorAxis: 1.0,
      eccentricity: 0.0,
      inclination: 0,
      longitudeOfAscendingNode: 0,
      argumentOfPeriapsis: 0,
      meanAnomalyAtEpoch: 0,
      orbitalPeriod: 365.25,
      rotationPeriod
    };
    
    const planet = new Planet(config);
    return { planet, config };
  };

  /**
   * Property 6: Rotation Continuity
   * Validates: Requirements 3.2, 3.4
   * 
   * Universal Property: Planet rotation should be continuous and smooth
   * across time updates, without sudden jumps or discontinuities.
   */
  describe('Property 6: Rotation Continuity', () => {
    
    test('should maintain continuous rotation across time steps', () => {
      const { planet } = createTestPlanet('test-planet', 24); // 24-hour rotation
      
      const rotations: number[] = [];
      let currentTime = 0;
      const timeStep = 0.1; // 0.1 day steps
      
      // Record rotation over multiple time steps
      for (let i = 0; i < 100; i++) {
        planet.updateRotation(currentTime, 1.0); // Normal time speed
        
        // Get rotation from planet mesh
        const mesh = planet.getMesh();
        if (mesh) {
          rotations.push(mesh.rotation.y);
        }
        
        currentTime += timeStep;
      }
      
      // Property: Rotation should increase monotonically (for positive rotation)
      for (let i = 1; i < rotations.length; i++) {
        const rotationDiff = rotations[i] - rotations[i - 1];
        
        // Should be positive (rotating forward) and consistent
        expect(rotationDiff).toBeGreaterThan(0);
        
        // Should not have sudden jumps (within reasonable bounds)
        // For a rotation period of 24 hours and timeStep in days:
        // Expected rotation = (2π * timeStep) radians
        const expectedDiff = (2 * Math.PI * timeStep); // Expected rotation for time step
        expect(Math.abs(rotationDiff - expectedDiff)).toBeLessThan(expectedDiff * 0.1); // 10% tolerance
      }
    });

    test('should handle time speed changes smoothly', () => {
      const { planet } = createTestPlanet('speed-test-planet', 12); // 12-hour rotation
      
      const timeSpeeds = [0.5, 1.0, 2.0, 5.0, 10.0]; // Various speeds
      const timeStep = 0.05; // 0.05 days
      const numSteps = 10;
      
      const rotationRates: number[] = [];
      
      timeSpeeds.forEach((speed, index) => {
        // Use separate time ranges for each speed to avoid interference
        const startTime = index * 1.0; // Start each test at a different time
        let testTime = startTime;
        
        // Measure initial rotation
        planet.updateRotation(testTime, speed);
        const initialRotation = planet.getMesh()?.rotation.y || 0;
        
        // Update with this speed for several steps
        for (let i = 0; i < numSteps; i++) {
          testTime += timeStep;
          planet.updateRotation(testTime, speed);
        }
        
        const finalRotation = planet.getMesh()?.rotation.y || 0;
        const rotationRate = (finalRotation - initialRotation) / (timeStep * numSteps);
        rotationRates.push(rotationRate);
      });
      
      // Property: Rotation rate should be proportional to time speed
      for (let i = 1; i < rotationRates.length; i++) {
        const expectedRatio = timeSpeeds[i] / timeSpeeds[0];
        const actualRatio = rotationRates[i] / rotationRates[0];
        
        expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(0.2); // 20% tolerance
      }
    });

    test('should handle pause and resume correctly', () => {
      const { planet } = createTestPlanet('pause-test-planet', 6); // 6-hour rotation
      
      let currentTime = 0;
      const timeStep = 0.1;
      
      // Normal rotation
      planet.updateRotation(currentTime, 1.0);
      const rotationBeforePause = planet.getMesh()?.rotation.y || 0;
      currentTime += timeStep;
      
      // Paused (speed = 0)
      for (let i = 0; i < 10; i++) {
        planet.updateRotation(currentTime, 0);
        currentTime += timeStep;
      }
      const rotationDuringPause = planet.getMesh()?.rotation.y || 0;
      
      // Resume normal rotation
      planet.updateRotation(currentTime, 1.0);
      const rotationAfterResume = planet.getMesh()?.rotation.y || 0;
      currentTime += timeStep;
      
      // Property: Rotation should not change during pause
      expect(rotationDuringPause).toBeCloseTo(rotationBeforePause, 5);
      
      // Property: Rotation should resume smoothly after pause
      const resumeRotationDiff = rotationAfterResume - rotationDuringPause;
      // For 6-hour rotation period and timeStep in days:
      // Expected rotation = (2π * timeStep) / (rotationPeriod / 24)
      const rotationPeriodInDays = 6 / 24; // 6 hours = 0.25 days
      const expectedDiff = (2 * Math.PI * timeStep) / rotationPeriodInDays;
      expect(Math.abs(resumeRotationDiff - expectedDiff)).toBeLessThan(expectedDiff * 0.1);
    });
  });

  /**
   * Property 7: Rotation Speed Accuracy
   * Validates: Requirements 3.1, 3.3
   * 
   * Universal Property: Planet rotation speeds should be scientifically
   * accurate relative to their specified rotation periods.
   */
  describe('Property 7: Rotation Speed Accuracy', () => {
    
    test('should rotate at correct speed for various rotation periods', () => {
      const testPeriods = [1, 6, 12, 24, 48, 100]; // Various rotation periods in hours
      
      testPeriods.forEach(periodHours => {
        const { planet } = createTestPlanet(`planet-${periodHours}h`, periodHours);
        
        const initialRotation = planet.getMesh()?.rotation.y || 0;
        
        // Simulate one full rotation period
        const timeStep = periodHours / 100; // 100 steps per rotation
        let currentTime = 0;
        
        for (let i = 0; i < 100; i++) {
          planet.updateRotation(currentTime, 1.0);
          currentTime += timeStep / 24; // Convert hours to days
        }
        
        const finalRotation = planet.getMesh()?.rotation.y || 0;
        const totalRotation = finalRotation - initialRotation;
        
        // Property: Should complete approximately one full rotation (2π radians)
        const expectedRotation = 2 * Math.PI;
        expect(Math.abs(totalRotation - expectedRotation)).toBeLessThan(0.1); // Small tolerance
      });
    });

    test('should handle retrograde rotation correctly', () => {
      // Venus has retrograde rotation (negative period)
      const { planet } = createTestPlanet('venus-like', -243 * 24); // Venus rotation period in hours
      
      const initialRotation = planet.getMesh()?.rotation.y || 0;
      
      // Simulate time passage
      const timeStep = 1; // 1 day
      let currentTime = 0;
      
      for (let i = 0; i < 10; i++) {
        planet.updateRotation(currentTime, 1.0);
        currentTime += timeStep;
      }
      
      const finalRotation = planet.getMesh()?.rotation.y || 0;
      const rotationChange = finalRotation - initialRotation;
      
      // Property: Retrograde rotation should result in negative rotation change
      expect(rotationChange).toBeLessThan(0);
      
      // Property: Magnitude should be proportional to time passed
      const expectedMagnitude = (2 * Math.PI * 10) / (243); // 10 days / 243 day period
      expect(Math.abs(Math.abs(rotationChange) - expectedMagnitude)).toBeLessThan(0.1);
    });

    test('should maintain accuracy across different time scales', () => {
      const { planet } = createTestPlanet('accuracy-test', 24); // 24-hour rotation
      
      // Test different time step sizes
      const timeSteps = [0.01, 0.1, 1.0]; // Days (removed 10.0 as it's too large for accurate testing)
      
      timeSteps.forEach(timeStep => {
        // Reset for each test
        let currentTime = 0;
        const initialRotation = 0;
        
        // Simulate 1 day of rotation with this time step
        const steps = Math.ceil(1.0 / timeStep);
        let finalTime = 0;
        for (let i = 0; i < steps; i++) {
          finalTime = i * timeStep;
          planet.updateRotation(finalTime, 1.0);
        }
        
        // Get final rotation after exactly 1 day
        planet.updateRotation(1.0, 1.0); // Exactly 1 day
        const mesh = planet.getMesh();
        const finalRotation = mesh?.rotation.y || 0;
        const totalRotation = finalRotation - initialRotation;
        
        // Property: Should complete one full rotation regardless of time step size
        const expectedRotation = 2 * Math.PI;
        expect(Math.abs(totalRotation - expectedRotation)).toBeLessThan(0.1); // Reasonable tolerance
      });
    });
  });

  /**
   * Property Test: Venus Retrograde Rotation
   * Validates: Requirements 3.5
   * 
   * Specific test for Venus retrograde rotation behavior.
   */
  describe('Venus Retrograde Rotation Test', () => {
    
    test('should rotate Venus in opposite direction with negative speed', () => {
      // Create Venus-like planet with retrograde rotation
      const venusRotationPeriod = -243 * 24; // Negative for retrograde, in hours
      const { planet: venus } = createTestPlanet('venus', venusRotationPeriod);
      
      // Create normal planet for comparison
      const { planet: normalPlanet } = createTestPlanet('normal', 24);
      
      // Reset both rotations
      const venusMesh = venus.getMesh();
      const normalMesh = normalPlanet.getMesh();
      
      if (venusMesh) venusMesh.rotation.y = 0;
      if (normalMesh) normalMesh.rotation.y = 0;
      
      const venusInitialRotation = venusMesh?.rotation.y || 0;
      const normalInitialRotation = normalMesh?.rotation.y || 0;
      
      // Simulate same time passage for both
      const timeStep = 1; // 1 day
      let currentTime = 0;
      
      for (let i = 0; i < 5; i++) {
        venus.updateRotation(currentTime, 1.0);
        normalPlanet.updateRotation(currentTime, 1.0);
        currentTime += timeStep;
      }
      
      const venusFinalRotation = venusMesh?.rotation.y || 0;
      const normalFinalRotation = normalMesh?.rotation.y || 0;
      
      const venusRotationChange = venusFinalRotation - venusInitialRotation;
      const normalRotationChange = normalFinalRotation - normalInitialRotation;
      
      // Property: Venus should rotate in opposite direction
      expect(venusRotationChange).toBeLessThan(0); // Negative rotation
      expect(normalRotationChange).toBeGreaterThan(0); // Positive rotation
      
      // Property: Venus rotation should be much slower due to long period
      expect(Math.abs(venusRotationChange)).toBeLessThan(Math.abs(normalRotationChange));
      
      // Property: Rotation directions should be opposite
      expect(Math.sign(venusRotationChange)).toBe(-Math.sign(normalRotationChange));
    });
  });
});