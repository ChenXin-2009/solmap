/**
 * Comprehensive System Validation Tests
 * 
 * Tests for Task 11.2: Write comprehensive system validation tests
 * Validates multi-level celestial hierarchy support, time continuity, 
 * and error handling across the complete system.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  SpaceTimeCoreImpl,
  TimeAuthorityImpl,
  RenderLayerInterfaceImpl,
  VSOP87Provider,
  RenderingIntegrationAdapter,
  ArchitecturalValidator,
  PRIMARY_REFERENCE_FRAME,
  STANDARD_BODY_IDS,
  TIME_CONTINUITY_CONSTRAINTS,
  ERROR_CODES,
  BODY_HIERARCHY_DEFINITIONS
} from '../../lib/space-time-foundation';

describe('Comprehensive System Validation Tests', () => {
  let timeAuthority: TimeAuthorityImpl;
  let spaceTimeCore: SpaceTimeCoreImpl;
  let renderInterface: RenderLayerInterfaceImpl;
  let renderingAdapter: RenderingIntegrationAdapter;
  let vsop87Provider: VSOP87Provider;

  beforeEach(() => {
    // Clear any previous violations
    ArchitecturalValidator.clearViolations();
    
    // Initialize complete system
    timeAuthority = new TimeAuthorityImpl();
    spaceTimeCore = new SpaceTimeCoreImpl();
    renderInterface = new RenderLayerInterfaceImpl();
    renderingAdapter = new RenderingIntegrationAdapter();
    vsop87Provider = new VSOP87Provider();

    // Wire system together
    spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
    spaceTimeCore.registerEphemerisProvider(vsop87Provider);
    renderInterface.initialize(spaceTimeCore, timeAuthority);
    renderingAdapter.initialize(spaceTimeCore, timeAuthority);
  });

  afterEach(() => {
    // Clean up resources
    if (renderingAdapter && typeof renderingAdapter.dispose === 'function') {
      renderingAdapter.dispose();
    }
    if (spaceTimeCore && typeof spaceTimeCore.reset === 'function') {
      spaceTimeCore.reset();
    }
    if (renderInterface && typeof renderInterface.reset === 'function') {
      renderInterface.reset();
    }
  });

  describe('Task 11.2: Multi-Level Celestial Hierarchy Support', () => {
    test('should support star → planet → satellite hierarchy', () => {
      // Test hierarchy definitions exist
      expect(BODY_HIERARCHY_DEFINITIONS[STANDARD_BODY_IDS.SUN]).toBeDefined();
      expect(BODY_HIERARCHY_DEFINITIONS[STANDARD_BODY_IDS.EARTH]).toBeDefined();
      expect(BODY_HIERARCHY_DEFINITIONS[STANDARD_BODY_IDS.MOON]).toBeDefined();

      // Verify hierarchy levels
      const sunHierarchy = spaceTimeCore.getBodyHierarchy(STANDARD_BODY_IDS.SUN);
      expect(sunHierarchy.success).toBe(true);
      expect(sunHierarchy.data.hierarchyLevel).toBe(0); // Star level
      expect(sunHierarchy.data.parentId).toBeUndefined();
      expect(sunHierarchy.data.children).toContain(STANDARD_BODY_IDS.EARTH);

      const earthHierarchy = spaceTimeCore.getBodyHierarchy(STANDARD_BODY_IDS.EARTH);
      expect(earthHierarchy.success).toBe(true);
      expect(earthHierarchy.data.hierarchyLevel).toBe(1); // Planet level
      expect(earthHierarchy.data.parentId).toBe(STANDARD_BODY_IDS.SUN);
      expect(earthHierarchy.data.children).toContain(STANDARD_BODY_IDS.MOON);

      const moonHierarchy = spaceTimeCore.getBodyHierarchy(STANDARD_BODY_IDS.MOON);
      expect(moonHierarchy.success).toBe(true);
      expect(moonHierarchy.data.hierarchyLevel).toBe(2); // Satellite level
      expect(moonHierarchy.data.parentId).toBe(STANDARD_BODY_IDS.EARTH);
      expect(moonHierarchy.data.children).toHaveLength(0);
    });

    test('should support Jupiter satellite system', () => {
      // Test Jupiter's major satellites
      const jupiterHierarchy = spaceTimeCore.getBodyHierarchy(STANDARD_BODY_IDS.JUPITER);
      expect(jupiterHierarchy.success).toBe(true);
      expect(jupiterHierarchy.data.hierarchyLevel).toBe(1); // Planet level
      expect(jupiterHierarchy.data.children).toContain(STANDARD_BODY_IDS.IO);
      expect(jupiterHierarchy.data.children).toContain(STANDARD_BODY_IDS.EUROPA);
      expect(jupiterHierarchy.data.children).toContain(STANDARD_BODY_IDS.GANYMEDE);
      expect(jupiterHierarchy.data.children).toContain(STANDARD_BODY_IDS.CALLISTO);

      // Test individual satellites
      const ioHierarchy = spaceTimeCore.getBodyHierarchy(STANDARD_BODY_IDS.IO);
      expect(ioHierarchy.success).toBe(true);
      expect(ioHierarchy.data.hierarchyLevel).toBe(2); // Satellite level
      expect(ioHierarchy.data.parentId).toBe(STANDARD_BODY_IDS.JUPITER);

      const europaHierarchy = spaceTimeCore.getBodyHierarchy(STANDARD_BODY_IDS.EUROPA);
      expect(europaHierarchy.success).toBe(true);
      expect(europaHierarchy.data.parentId).toBe(STANDARD_BODY_IDS.JUPITER);
    });

    test('should support Saturn satellite system', () => {
      const saturnHierarchy = spaceTimeCore.getBodyHierarchy(STANDARD_BODY_IDS.SATURN);
      expect(saturnHierarchy.success).toBe(true);
      expect(saturnHierarchy.data.children).toContain(STANDARD_BODY_IDS.TITAN);
      expect(saturnHierarchy.data.children).toContain(STANDARD_BODY_IDS.ENCELADUS);

      const titanHierarchy = spaceTimeCore.getBodyHierarchy(STANDARD_BODY_IDS.TITAN);
      expect(titanHierarchy.success).toBe(true);
      expect(titanHierarchy.data.parentId).toBe(STANDARD_BODY_IDS.SATURN);
      expect(titanHierarchy.data.hierarchyLevel).toBe(2);
    });

    test('should maintain hierarchy consistency across system', () => {
      // Get all available bodies
      const availableBodies = spaceTimeCore.getAvailableBodies();
      expect(availableBodies.length).toBeGreaterThan(0);

      // Verify each body has consistent hierarchy
      for (const bodyId of availableBodies) {
        const hierarchyResult = spaceTimeCore.getBodyHierarchy(bodyId);
        
        if (hierarchyResult.success) {
          const hierarchy = hierarchyResult.data;
          
          // Verify hierarchy level is valid
          expect(hierarchy.hierarchyLevel).toBeGreaterThanOrEqual(0);
          expect(hierarchy.hierarchyLevel).toBeLessThanOrEqual(3);
          
          // If has parent, verify parent exists and includes this body as child
          if (hierarchy.parentId) {
            const parentResult = spaceTimeCore.getBodyHierarchy(hierarchy.parentId);
            expect(parentResult.success).toBe(true);
            expect(parentResult.data.children).toContain(bodyId);
            expect(parentResult.data.hierarchyLevel).toBeLessThan(hierarchy.hierarchyLevel);
          }
          
          // Verify all children exist and reference this body as parent
          for (const childId of hierarchy.children) {
            const childResult = spaceTimeCore.getBodyHierarchy(childId);
            expect(childResult.success).toBe(true);
            expect(childResult.data.parentId).toBe(bodyId);
            expect(childResult.data.hierarchyLevel).toBeGreaterThan(hierarchy.hierarchyLevel);
          }
        }
      }
    });
  });

  describe('Task 11.2: Time Continuity Validation', () => {
    test('should maintain time continuity across system operations', () => {
      const initialTime = timeAuthority.getCurrentJulianDate();
      
      // Test small time progression
      const smallStep = 0.1; // 2.4 hours
      const setSmallResult = timeAuthority.setTime(initialTime + smallStep);
      expect(setSmallResult.success).toBe(true);
      expect(timeAuthority.getCurrentJulianDate()).toBe(initialTime + smallStep);

      // Test medium time progression
      const mediumStep = 1.0; // 1 day
      const setMediumResult = timeAuthority.setTime(initialTime + mediumStep);
      expect(setMediumResult.success).toBe(true);
      expect(timeAuthority.getCurrentJulianDate()).toBe(initialTime + mediumStep);

      // Test maximum allowed jump
      const maxJump = TIME_CONTINUITY_CONSTRAINTS.maxTimeJumpDays;
      const setMaxResult = timeAuthority.setTime(initialTime + maxJump);
      expect(setMaxResult.success).toBe(true);
      expect(timeAuthority.getCurrentJulianDate()).toBe(initialTime + maxJump);
    });

    test('should reject time discontinuities that exceed limits', () => {
      const initialTime = timeAuthority.getCurrentJulianDate();
      
      // Test jump exceeding maximum
      const excessiveJump = TIME_CONTINUITY_CONSTRAINTS.maxTimeJumpDays + 0.1;
      const setExcessiveResult = timeAuthority.setTime(initialTime + excessiveJump);
      expect(setExcessiveResult.success).toBe(false);
      expect(setExcessiveResult.error.code).toBe(ERROR_CODES.TIME_DISCONTINUITY);
      
      // Verify time didn't change
      expect(timeAuthority.getCurrentJulianDate()).toBe(initialTime);
    });

    test('should maintain calculation stability during rapid time changes', () => {
      const initialTime = timeAuthority.getCurrentJulianDate();
      const testTimes = [
        initialTime + 0.1,
        initialTime + 0.2,
        initialTime + 0.5,
        initialTime + 0.8,
        initialTime + 1.0
      ];

      // Test rapid sequential time changes
      for (const testTime of testTimes) {
        const setResult = timeAuthority.setTime(testTime);
        expect(setResult.success).toBe(true);
        
        // Verify celestial body calculations remain stable
        const earthResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, testTime);
        expect(earthResult.success).toBe(true);
        expect(earthResult.data.metadata.julianDate).toBe(testTime);
        
        // Verify position is reasonable
        const position = earthResult.data.position;
        const distance = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
        expect(distance).toBeGreaterThan(140000000); // > 0.9 AU
        expect(distance).toBeLessThan(160000000);    // < 1.1 AU
      }
    });

    test('should validate time precision requirements', () => {
      const currentTime = timeAuthority.getCurrentJulianDate();
      const precision = TIME_CONTINUITY_CONSTRAINTS.minTimePrecision;
      
      // Test time precision at the limit (small step from current time)
      const preciseTime = currentTime + precision;
      const setPreciseResult = timeAuthority.setTime(preciseTime);
      expect(setPreciseResult.success).toBe(true);
      
      // Verify precision is maintained
      expect(timeAuthority.getCurrentJulianDate()).toBe(preciseTime);
      
      // Test celestial body calculation with precise time
      const marsResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.MARS, preciseTime);
      expect(marsResult.success).toBe(true);
      expect(marsResult.data.metadata.julianDate).toBe(preciseTime);
    });

    test('should handle time range boundaries correctly', () => {
      const constraints = TIME_CONTINUITY_CONSTRAINTS;
      const currentTime = timeAuthority.getCurrentJulianDate();
      
      // Test small steps within valid range
      const smallStep = 0.5; // Half day
      const stepResult = timeAuthority.setTime(currentTime + smallStep);
      expect(stepResult.success).toBe(true);
      
      // Test maximum allowed jump from current position
      const maxJump = TIME_CONTINUITY_CONSTRAINTS.maxTimeJumpDays;
      const maxJumpResult = timeAuthority.setTime(currentTime + maxJump);
      expect(maxJumpResult.success).toBe(true);
      
      // Test below minimum (should fail)
      const belowMinResult = timeAuthority.setTime(constraints.minJulianDate - 1);
      expect(belowMinResult.success).toBe(false);
      expect(belowMinResult.error.code).toBe(ERROR_CODES.INVALID_TIME_RANGE);
      
      // Test above maximum (should fail)
      const aboveMaxResult = timeAuthority.setTime(constraints.maxJulianDate + 1);
      expect(aboveMaxResult.success).toBe(false);
      expect(aboveMaxResult.error.code).toBe(ERROR_CODES.INVALID_TIME_RANGE);
    });
  });

  describe('Task 11.2: Error Handling and Boundary Conditions', () => {
    test('should handle invalid inputs gracefully', () => {
      // Test invalid body IDs
      const invalidBodyResult = spaceTimeCore.getBodyState('nonexistent-body', timeAuthority.getCurrentJulianDate());
      expect(invalidBodyResult.success).toBe(false);
      expect(invalidBodyResult.error.code).toBe(ERROR_CODES.PROVIDER_UNAVAILABLE);

      // Test invalid Julian Dates
      const nanTimeResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, NaN);
      expect(nanTimeResult.success).toBe(false);
      expect(nanTimeResult.error.code).toBe(ERROR_CODES.INVALID_JULIAN_DATE);

      const infiniteTimeResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, Infinity);
      expect(infiniteTimeResult.success).toBe(false);
      expect(infiniteTimeResult.error.code).toBe(ERROR_CODES.INVALID_JULIAN_DATE);

      // Test empty body ID arrays
      const emptyArrayResult = spaceTimeCore.getBodiesState([], timeAuthority.getCurrentJulianDate());
      expect(emptyArrayResult.success).toBe(false);
      expect(emptyArrayResult.error.code).toBe(ERROR_CODES.INVALID_BODY_ID);
    });

    test('should maintain system stability after errors', () => {
      const currentTime = timeAuthority.getCurrentJulianDate();
      
      // Generate several errors
      spaceTimeCore.getBodyState('invalid1', currentTime);
      spaceTimeCore.getBodyState('invalid2', NaN);
      spaceTimeCore.getBodyState('invalid3', Infinity);
      
      // Verify system still works correctly
      const validResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, currentTime);
      expect(validResult.success).toBe(true);
      expect(validResult.data.metadata.julianDate).toBe(currentTime);
      
      // Verify render layer still works
      const renderCore = renderInterface.getSpaceTimeCore();
      const renderResult = renderCore.getBodyState(STANDARD_BODY_IDS.MARS);
      expect(renderResult.success).toBe(true);
      
      // Verify legacy interface still works
      const legacyBody = renderingAdapter.getCelestialBody('venus');
      expect(legacyBody).not.toBeNull();
    });

    test('should handle provider failures gracefully', () => {
      // Test with body outside provider range
      const futureTime = TIME_CONTINUITY_CONSTRAINTS.maxJulianDate - 1;
      const futureResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, futureTime);
      
      // Should either succeed or fail gracefully
      if (!futureResult.success) {
        expect(futureResult.error.code).toMatch(/TIME_OUT_OF_RANGE|CALCULATION_FAILED|PROVIDER_UNAVAILABLE/);
      }
      
      // System should remain functional for valid requests
      const validResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, timeAuthority.getCurrentJulianDate());
      expect(validResult.success).toBe(true);
    });

    test('should validate architectural boundaries under stress', () => {
      // Perform many operations to stress test boundaries
      const operations = 50;
      const currentTime = timeAuthority.getCurrentJulianDate();
      
      for (let i = 0; i < operations; i++) {
        // Mix of valid and invalid operations
        if (i % 3 === 0) {
          spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, currentTime + i * 0.01);
        } else if (i % 3 === 1) {
          spaceTimeCore.getBodyState('invalid-' + i, currentTime);
        } else {
          const renderCore = renderInterface.getSpaceTimeCore();
          renderCore.getBodyState(STANDARD_BODY_IDS.MARS);
        }
      }
      
      // Verify architectural integrity is maintained
      const systemValidation = ArchitecturalValidator.validateSystem(
        spaceTimeCore,
        timeAuthority,
        PRIMARY_REFERENCE_FRAME
      );
      
      // Should be valid (warnings about large radius are acceptable)
      expect(systemValidation.summary.errorCount).toBe(0);
    });

    test('should handle concurrent access patterns', () => {
      const currentTime = timeAuthority.getCurrentJulianDate();
      const testBodies = [
        STANDARD_BODY_IDS.EARTH,
        STANDARD_BODY_IDS.MARS,
        STANDARD_BODY_IDS.JUPITER,
        STANDARD_BODY_IDS.VENUS,
        STANDARD_BODY_IDS.SATURN
      ];

      // Simulate concurrent access from multiple components
      const promises = testBodies.map(async (bodyId, index) => {
        // Stagger requests slightly
        await new Promise(resolve => setTimeout(resolve, index * 10));
        
        // Access through different interfaces
        const coreResult = spaceTimeCore.getBodyState(bodyId, currentTime);
        const renderCore = renderInterface.getSpaceTimeCore();
        const renderResult = renderCore.getBodyState(bodyId);
        const legacyBody = renderingAdapter.getCelestialBody(bodyId);
        
        return { coreResult, renderResult, legacyBody, bodyId };
      });

      return Promise.all(promises).then((results) => {
        // Verify all requests succeeded
        for (const { coreResult, renderResult, legacyBody, bodyId } of results) {
          expect(coreResult.success).toBe(true);
          expect(renderResult.success).toBe(true);
          expect(legacyBody).not.toBeNull();
          
          // Verify data consistency
          expect(renderResult.data.position.x).toBe(coreResult.data.position.x);
          expect(renderResult.data.metadata.julianDate).toBe(coreResult.data.metadata.julianDate);
        }
      });
    });
  });

  describe('Property 14: System Validation Completeness', () => {
    test('system must pass comprehensive validation suite', () => {
      // Test all major system components
      const timeValidation = ArchitecturalValidator.validateTimeAuthority(timeAuthority);
      const frameValidation = ArchitecturalValidator.validateReferenceFrame(PRIMARY_REFERENCE_FRAME);
      const providerValidation = ArchitecturalValidator.validateEphemerisProvider(vsop87Provider);
      const systemValidation = ArchitecturalValidator.validateSystem(spaceTimeCore, timeAuthority, PRIMARY_REFERENCE_FRAME);

      // All should be valid (warnings are acceptable)
      expect(timeValidation.summary.errorCount).toBe(0);
      expect(frameValidation.summary.errorCount).toBe(0);
      expect(providerValidation.summary.errorCount).toBe(0);
      expect(systemValidation.summary.errorCount).toBe(0);
    });

    test('system must maintain data integrity across all access patterns', () => {
      const currentTime = timeAuthority.getCurrentJulianDate();
      const testBody = STANDARD_BODY_IDS.EARTH;

      // Get same data through all interfaces
      const coreResult = spaceTimeCore.getBodyState(testBody, currentTime);
      const renderCore = renderInterface.getSpaceTimeCore();
      const renderResult = renderCore.getBodyState(testBody);
      const legacyBody = renderingAdapter.getCelestialBody(testBody);

      // All should succeed
      expect(coreResult.success).toBe(true);
      expect(renderResult.success).toBe(true);
      expect(legacyBody).not.toBeNull();

      // Data should be identical at the source
      expect(renderResult.data.position.x).toBe(coreResult.data.position.x);
      expect(renderResult.data.position.y).toBe(coreResult.data.position.y);
      expect(renderResult.data.position.z).toBe(coreResult.data.position.z);
      expect(renderResult.data.velocity.x).toBe(coreResult.data.velocity.x);
      expect(renderResult.data.velocity.y).toBe(coreResult.data.velocity.y);
      expect(renderResult.data.velocity.z).toBe(coreResult.data.velocity.z);
      expect(renderResult.data.radius).toBe(coreResult.data.radius);

      // Legacy format should be properly converted
      const auConversion = 1.0 / 149597870.7;
      expect(Math.abs(legacyBody!.x - coreResult.data.position.x * auConversion)).toBeLessThan(0.001);
      expect(Math.abs(legacyBody!.y - coreResult.data.position.y * auConversion)).toBeLessThan(0.001);
      expect(Math.abs(legacyBody!.z - coreResult.data.position.z * auConversion)).toBeLessThan(0.001);
      expect(Math.abs(legacyBody!.radius - coreResult.data.radius * auConversion)).toBeLessThan(0.001);

      // Metadata should be preserved
      expect(renderResult.data.metadata.julianDate).toBe(coreResult.data.metadata.julianDate);
      expect(renderResult.data.metadata.referenceFrame).toBe(coreResult.data.metadata.referenceFrame);
      expect(renderResult.data.metadata.provider).toBe(coreResult.data.metadata.provider);
    });

    test('system must handle edge cases and boundary conditions', () => {
      const currentTime = timeAuthority.getCurrentJulianDate();
      const constraints = TIME_CONTINUITY_CONSTRAINTS;
      
      // Test small time steps
      const smallStep = 0.1;
      const smallResult = timeAuthority.setTime(currentTime + smallStep);
      expect(smallResult.success).toBe(true);
      
      // Test maximum allowed jump
      const maxJump = constraints.maxTimeJumpDays;
      const maxResult = timeAuthority.setTime(currentTime + maxJump);
      expect(maxResult.success).toBe(true);
      
      // Test with all available bodies at current time
      const availableBodies = spaceTimeCore.getAvailableBodies();
      expect(availableBodies.length).toBeGreaterThan(0);
      
      for (const bodyId of availableBodies.slice(0, 3)) { // Test first 3 to avoid timeout
        const bodyResult = spaceTimeCore.getBodyState(bodyId, currentTime);
        // Should either succeed or fail gracefully
        if (!bodyResult.success) {
          expect(bodyResult.error.code).toMatch(/TIME_OUT_OF_RANGE|CALCULATION_FAILED|PROVIDER_UNAVAILABLE/);
        }
      }
    });
  });
});