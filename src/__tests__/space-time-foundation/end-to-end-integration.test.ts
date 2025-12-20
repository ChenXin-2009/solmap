/**
 * End-to-End System Integration Tests
 * 
 * Tests for Task 11.1: End-to-end system integration
 * Validates complete system functionality with all components wired together.
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
  ERROR_CODES
} from '../../lib/space-time-foundation';

describe('End-to-End System Integration Tests', () => {
  let timeAuthority: TimeAuthorityImpl;
  let spaceTimeCore: SpaceTimeCoreImpl;
  let renderInterface: RenderLayerInterfaceImpl;
  let renderingAdapter: RenderingIntegrationAdapter;
  let vsop87Provider: VSOP87Provider;

  beforeEach(() => {
    // Clear any previous violations
    ArchitecturalValidator.clearViolations();
    
    // Initialize all components
    timeAuthority = new TimeAuthorityImpl();
    spaceTimeCore = new SpaceTimeCoreImpl();
    renderInterface = new RenderLayerInterfaceImpl();
    renderingAdapter = new RenderingIntegrationAdapter();
    vsop87Provider = new VSOP87Provider();
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

  describe('Task 11.1: Complete System Integration', () => {
    test('should initialize complete system with all components', () => {
      // Step 1: Initialize Space-Time Core
      const coreInitResult = spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(coreInitResult.success).toBe(true);

      // Step 2: Register ephemeris provider
      const providerResult = spaceTimeCore.registerEphemerisProvider(vsop87Provider);
      expect(providerResult.success).toBe(true);

      // Step 3: Initialize render layer interface
      const renderInitResult = renderInterface.initialize(spaceTimeCore, timeAuthority);
      expect(renderInitResult.success).toBe(true);

      // Step 4: Initialize rendering adapter
      const adapterResult = renderingAdapter.initialize(spaceTimeCore, timeAuthority);
      expect(adapterResult.success).toBe(true);

      // Verify all components are ready
      expect(spaceTimeCore.isReady()).toBe(true);
      expect(renderInterface.isReady()).toBe(true);
      expect(renderingAdapter.isReady()).toBe(true);
      expect(spaceTimeCore.getProviderCount()).toBeGreaterThan(0);
    });

    test('should provide end-to-end celestial body data flow', () => {
      // Initialize system
      spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      spaceTimeCore.registerEphemerisProvider(vsop87Provider);
      renderInterface.initialize(spaceTimeCore, timeAuthority);
      renderingAdapter.initialize(spaceTimeCore, timeAuthority);

      // Test data flow: Physical Layer -> Render Layer -> Legacy Interface
      const currentTime = timeAuthority.getCurrentJulianDate();

      // 1. Direct access through Space-Time Core (Physical Layer)
      const earthStateResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, currentTime);
      expect(earthStateResult.success).toBe(true);
      expect(earthStateResult.data.position).toBeDefined();
      expect(earthStateResult.data.velocity).toBeDefined();
      expect(earthStateResult.data.radius).toBeGreaterThan(0);

      // 2. Access through Render Layer Interface
      const renderCore = renderInterface.getSpaceTimeCore();
      const earthRenderResult = renderCore.getBodyState(STANDARD_BODY_IDS.EARTH);
      expect(earthRenderResult.success).toBe(true);
      expect(earthRenderResult.data.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);

      // 3. Access through Legacy Rendering Adapter
      const legacyEarth = renderingAdapter.getCelestialBody('earth');
      expect(legacyEarth).not.toBeNull();
      expect(legacyEarth!.name).toBe('Earth');
      expect(legacyEarth!.x).toBeDefined();
      expect(legacyEarth!.y).toBeDefined();
      expect(legacyEarth!.z).toBeDefined();
      expect(legacyEarth!.radius).toBeGreaterThan(0);

      // Verify data consistency across layers
      const physicalPosition = earthStateResult.data.position;
      const auConversion = 1.0 / 149597870.7; // km to AU
      const expectedX = physicalPosition.x * auConversion;
      
      expect(Math.abs(legacyEarth!.x - expectedX)).toBeLessThan(0.001); // Allow small floating point differences
    });

    test('should handle time progression across all components', () => {
      // Initialize system
      spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      spaceTimeCore.registerEphemerisProvider(vsop87Provider);
      renderInterface.initialize(spaceTimeCore, timeAuthority);
      renderingAdapter.initialize(spaceTimeCore, timeAuthority);

      const initialTime = timeAuthority.getCurrentJulianDate();
      
      // Set up time subscription tracking
      let timeUpdateCount = 0;
      const unsubscribe = renderingAdapter.subscribeToTime((julianDate) => {
        timeUpdateCount++;
        expect(julianDate).toBeGreaterThan(initialTime);
      });

      // Progress time
      const newTime = initialTime + 1.0; // 1 day forward
      const setTimeResult = timeAuthority.setTime(newTime);
      expect(setTimeResult.success).toBe(true);

      // Verify time propagation
      expect(timeAuthority.getCurrentJulianDate()).toBe(newTime);
      expect(renderInterface.getCurrentTime()).toBe(newTime);
      expect(timeUpdateCount).toBeGreaterThan(0);

      // Verify celestial body positions updated
      const earthAfterResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, newTime);
      expect(earthAfterResult.success).toBe(true);
      expect(earthAfterResult.data.metadata.julianDate).toBe(newTime);

      unsubscribe();
    });

    test('should enforce layer separation throughout system', () => {
      // Initialize system
      spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      spaceTimeCore.registerEphemerisProvider(vsop87Provider);
      renderInterface.initialize(spaceTimeCore, timeAuthority);
      renderingAdapter.initialize(spaceTimeCore, timeAuthority);

      // Test that render layer cannot access write operations
      const renderCore = renderInterface.getSpaceTimeCore();
      
      // These should work (read operations)
      expect(() => renderCore.getAvailableBodies()).not.toThrow();
      expect(() => renderCore.getReferenceFrameInfo()).not.toThrow();
      
      // Verify render layer doesn't have access to write methods
      expect((renderCore as any).registerEphemerisProvider).toBeUndefined();
      expect((renderCore as any).setProviderPriority).toBeUndefined();

      // Verify architectural compliance
      const systemValidation = ArchitecturalValidator.validateSystem(
        spaceTimeCore,
        timeAuthority,
        PRIMARY_REFERENCE_FRAME
      );
      expect(systemValidation.isValid).toBe(true);
    });

    test('should handle multiple celestial bodies simultaneously', () => {
      // Initialize system
      spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      spaceTimeCore.registerEphemerisProvider(vsop87Provider);
      renderInterface.initialize(spaceTimeCore, timeAuthority);
      renderingAdapter.initialize(spaceTimeCore, timeAuthority);

      const currentTime = timeAuthority.getCurrentJulianDate();
      const testBodies = [
        STANDARD_BODY_IDS.EARTH,
        STANDARD_BODY_IDS.MARS,
        STANDARD_BODY_IDS.JUPITER,
        STANDARD_BODY_IDS.VENUS
      ];

      // Test bulk query through Space-Time Core
      const bulkResult = spaceTimeCore.getBodiesState(testBodies, currentTime);
      expect(bulkResult.success).toBe(true);
      expect(bulkResult.data.size).toBe(testBodies.length);

      // Test individual queries through render layer
      const renderCore = renderInterface.getSpaceTimeCore();
      for (const bodyId of testBodies) {
        const bodyResult = renderCore.getBodyState(bodyId);
        expect(bodyResult.success).toBe(true);
        expect(bodyResult.data.metadata.provider).toBe('vsop87');
        expect(bodyResult.data.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);
      }

      // Test legacy interface
      const legacyBodies = renderingAdapter.getCelestialBodies();
      expect(legacyBodies.length).toBeGreaterThan(0);
      
      for (const body of legacyBodies) {
        expect(body.name).toBeDefined();
        expect(body.x).toBeDefined();
        expect(body.y).toBeDefined();
        expect(body.z).toBeDefined();
        expect(body.radius).toBeGreaterThan(0);
        expect(body.color).toBeDefined();
      }
    });

    test('should maintain system integrity under error conditions', () => {
      // Initialize system
      spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      spaceTimeCore.registerEphemerisProvider(vsop87Provider);
      renderInterface.initialize(spaceTimeCore, timeAuthority);
      renderingAdapter.initialize(spaceTimeCore, timeAuthority);

      // Test invalid body ID
      const invalidBodyResult = spaceTimeCore.getBodyState('invalid-body', timeAuthority.getCurrentJulianDate());
      expect(invalidBodyResult.success).toBe(false);
      expect(invalidBodyResult.error.code).toBe(ERROR_CODES.PROVIDER_UNAVAILABLE);

      // Test invalid time
      const invalidTimeResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, NaN);
      expect(invalidTimeResult.success).toBe(false);
      expect(invalidTimeResult.error.code).toBe(ERROR_CODES.INVALID_JULIAN_DATE);

      // Verify system remains functional after errors
      const validResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, timeAuthority.getCurrentJulianDate());
      expect(validResult.success).toBe(true);

      // Verify legacy interface handles errors gracefully
      const invalidLegacyBody = renderingAdapter.getCelestialBody('invalid-body');
      expect(invalidLegacyBody).toBeNull();

      // System should still work for valid requests
      const validLegacyBody = renderingAdapter.getCelestialBody('earth');
      expect(validLegacyBody).not.toBeNull();
    });

    test('should validate Phase 1 scope limitations are enforced', () => {
      // Initialize system
      spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      spaceTimeCore.registerEphemerisProvider(vsop87Provider);
      renderInterface.initialize(spaceTimeCore, timeAuthority);
      renderingAdapter.initialize(spaceTimeCore, timeAuthority);

      // Verify single authoritative reference frame
      const referenceFrame = spaceTimeCore.getReferenceFrameInfo();
      expect(referenceFrame.type).toBe('AUTHORITATIVE');
      expect(referenceFrame.frameId).toBe(PRIMARY_REFERENCE_FRAME.frameId);

      // Verify no relativistic corrections (positions should be Newtonian)
      const earthResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.EARTH, timeAuthority.getCurrentJulianDate());
      expect(earthResult.success).toBe(true);
      
      // Position should be reasonable for Newtonian mechanics (not relativistic)
      const position = earthResult.data.position;
      const distanceFromSun = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
      expect(distanceFromSun).toBeGreaterThan(140000000); // > 0.9 AU in km
      expect(distanceFromSun).toBeLessThan(160000000);    // < 1.1 AU in km

      // Verify no attitude or spacecraft dynamics
      expect(earthResult.data).not.toHaveProperty('attitude');
      expect(earthResult.data).not.toHaveProperty('angularVelocity');
      expect(earthResult.data).not.toHaveProperty('thrust');

      // Verify architectural compliance
      const phaseValidation = ArchitecturalValidator.validatePhase1Scope('SystemIntegration', 'position-calculation');
      expect(phaseValidation.isValid).toBe(true);
    });

    test('should demonstrate complete data flow traceability', () => {
      // Initialize system
      spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      spaceTimeCore.registerEphemerisProvider(vsop87Provider);
      renderInterface.initialize(spaceTimeCore, timeAuthority);
      renderingAdapter.initialize(spaceTimeCore, timeAuthority);

      const currentTime = timeAuthority.getCurrentJulianDate();

      // Trace data flow from VSOP87 -> Space-Time Core -> Render Layer -> Legacy Interface
      
      // 1. Direct provider access (for verification only)
      const directVsop87Result = vsop87Provider.getState(STANDARD_BODY_IDS.MARS, currentTime);
      expect(directVsop87Result.success).toBe(true);

      // 2. Through Space-Time Core
      const coreResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.MARS, currentTime);
      expect(coreResult.success).toBe(true);
      expect(coreResult.data.metadata.provider).toBe('vsop87');

      // 3. Through Render Layer Interface
      const renderCore = renderInterface.getSpaceTimeCore();
      const renderResult = renderCore.getBodyState(STANDARD_BODY_IDS.MARS);
      expect(renderResult.success).toBe(true);

      // 4. Through Legacy Adapter
      const legacyMars = renderingAdapter.getCelestialBody('mars');
      expect(legacyMars).not.toBeNull();
      expect(legacyMars!.name).toBe('Mars');

      // Verify data consistency across the entire chain
      expect(coreResult.data.position.x).toBe(directVsop87Result.data.position.x);
      expect(renderResult.data.position.x).toBe(coreResult.data.position.x);
      
      // Legacy format should be converted but consistent
      const auConversion = 1.0 / 149597870.7;
      const expectedLegacyX = coreResult.data.position.x * auConversion;
      expect(Math.abs(legacyMars!.x - expectedLegacyX)).toBeLessThan(0.001);

      // Verify metadata traceability
      expect(coreResult.data.metadata.julianDate).toBe(currentTime);
      expect(coreResult.data.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);
      expect(renderResult.data.metadata.julianDate).toBe(currentTime);
      expect(renderResult.data.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);
    });
  });

  describe('Property 13: End-to-End System Integrity', () => {
    test('complete system must maintain architectural boundaries', () => {
      // Initialize complete system
      spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      spaceTimeCore.registerEphemerisProvider(vsop87Provider);
      renderInterface.initialize(spaceTimeCore, timeAuthority);
      renderingAdapter.initialize(spaceTimeCore, timeAuthority);

      // Test that all components respect layer boundaries
      const layerValidation = ArchitecturalValidator.validateLayerBoundary('Render', 'getBodyState');
      expect(layerValidation.isValid).toBe(true);

      const forbiddenValidation = ArchitecturalValidator.validateLayerBoundary('Render', 'registerEphemerisProvider');
      expect(forbiddenValidation.isValid).toBe(false);

      // Verify system-wide architectural compliance
      const systemValidation = ArchitecturalValidator.validateSystem(
        spaceTimeCore,
        timeAuthority,
        PRIMARY_REFERENCE_FRAME
      );
      expect(systemValidation.isValid).toBe(true);
      expect(systemValidation.summary.errorCount).toBe(0);
    });

    test('system must handle concurrent operations safely', () => {
      // Initialize system
      spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      spaceTimeCore.registerEphemerisProvider(vsop87Provider);
      renderInterface.initialize(spaceTimeCore, timeAuthority);
      renderingAdapter.initialize(spaceTimeCore, timeAuthority);

      const currentTime = timeAuthority.getCurrentJulianDate();
      const testBodies = [STANDARD_BODY_IDS.EARTH, STANDARD_BODY_IDS.MARS, STANDARD_BODY_IDS.JUPITER];

      // Simulate concurrent access from multiple render components
      const promises = testBodies.map(async (bodyId) => {
        const renderCore = renderInterface.getSpaceTimeCore();
        const result = renderCore.getBodyState(bodyId);
        expect(result.success).toBe(true);
        return result.data;
      });

      return Promise.all(promises).then((results) => {
        expect(results).toHaveLength(testBodies.length);
        results.forEach((stateVector) => {
          expect(stateVector.metadata.julianDate).toBe(currentTime);
          expect(stateVector.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);
        });
      });
    });

    test('system must maintain data integrity across all interfaces', () => {
      // Initialize system
      spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      spaceTimeCore.registerEphemerisProvider(vsop87Provider);
      renderInterface.initialize(spaceTimeCore, timeAuthority);
      renderingAdapter.initialize(spaceTimeCore, timeAuthority);

      const currentTime = timeAuthority.getCurrentJulianDate();

      // Get the same data through different interfaces
      const coreResult = spaceTimeCore.getBodyState(STANDARD_BODY_IDS.VENUS, currentTime);
      const renderCore = renderInterface.getSpaceTimeCore();
      const renderResult = renderCore.getBodyState(STANDARD_BODY_IDS.VENUS);
      const legacyVenus = renderingAdapter.getCelestialBody('venus');

      // All should succeed
      expect(coreResult.success).toBe(true);
      expect(renderResult.success).toBe(true);
      expect(legacyVenus).not.toBeNull();

      // Data should be consistent
      expect(renderResult.data.position.x).toBe(coreResult.data.position.x);
      expect(renderResult.data.velocity.y).toBe(coreResult.data.velocity.y);
      expect(renderResult.data.radius).toBe(coreResult.data.radius);

      // Legacy format should be properly converted
      const auConversion = 1.0 / 149597870.7;
      expect(Math.abs(legacyVenus!.x - coreResult.data.position.x * auConversion)).toBeLessThan(0.001);
      expect(Math.abs(legacyVenus!.radius - coreResult.data.radius * auConversion)).toBeLessThan(0.001);

      // Metadata should be preserved
      expect(coreResult.data.metadata.provider).toBe('vsop87');
      expect(renderResult.data.metadata.provider).toBe('vsop87');
      expect(coreResult.data.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);
      expect(renderResult.data.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);
    });
  });
});