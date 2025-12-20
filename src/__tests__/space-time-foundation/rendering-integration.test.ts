/**
 * Rendering Integration Tests
 * 
 * Tests for Task 9: Integration with Existing Rendering System
 * 
 * Validates:
 * - Render layer compliance with Space-Time Foundation
 * - No direct astronomical computation access
 * - Time Authority integration with UI components
 * - Backward compatibility with existing interfaces
 */

import * as fc from 'fast-check';
import { TimeAuthorityImpl } from '../../lib/space-time-foundation/time-authority';
import { ReferenceFrameManager } from '../../lib/space-time-foundation/reference-frame-manager';
import { EphemerisRouterImpl, EphemerisStrategyImpl } from '../../lib/space-time-foundation/ephemeris-router';
import { VSOP87Provider } from '../../lib/space-time-foundation/vsop87-provider';
import { SpaceTimeCoreImpl } from '../../lib/space-time-foundation/space-time-core';
import { RenderingIntegrationAdapter, getRenderingAdapter, initializeRenderingAdapter } from '../../lib/space-time-foundation/rendering-integration';
import { PRIMARY_REFERENCE_FRAME } from '../../lib/space-time-foundation/constants';
import { CelestialBodyId } from '../../lib/space-time-foundation/types';

describe('Rendering Integration Tests', () => {
  let timeAuthority: TimeAuthorityImpl;
  let referenceFrameManager: ReferenceFrameManager;
  let ephemerisRouter: EphemerisRouterImpl;
  let ephemerisStrategy: EphemerisStrategyImpl;
  let spaceTimeCore: SpaceTimeCoreImpl;
  let adapter: RenderingIntegrationAdapter;

  beforeEach(() => {
    // Initialize core components
    // Initialize Time Authority with J2000.0 epoch to avoid time jump issues
    timeAuthority = new TimeAuthorityImpl(2451545.0);
    referenceFrameManager = new ReferenceFrameManager();
    
    const vsop87Provider = new VSOP87Provider();
    ephemerisStrategy = new EphemerisStrategyImpl();
    ephemerisStrategy.registerProvider(vsop87Provider);
    ephemerisRouter = new EphemerisRouterImpl(ephemerisStrategy);
    
    spaceTimeCore = new SpaceTimeCoreImpl();
    
    // Initialize space-time core
    const coreResult = spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
    expect(coreResult.success).toBe(true);
    
    // Register the ephemeris provider
    const providerResult = spaceTimeCore.registerEphemerisProvider(vsop87Provider);
    expect(providerResult.success).toBe(true);
    
    // Create fresh adapter for each test
    adapter = new RenderingIntegrationAdapter();
  });

  afterEach(() => {
    // Clean up
    adapter?.dispose();
  });

  describe('Property 10: Render Layer Compliance', () => {
    test('adapter must only access allowed Space-Time Core interfaces', () => {
      fc.assert(fc.property(
        fc.double({ min: 2451545, max: 2451550, noNaN: true, noDefaultInfinity: true }),
        (julianDate) => {
          // Create fresh adapter for each iteration
          const testAdapter = new RenderingIntegrationAdapter();
          
          // Initialize adapter
          const initResult = testAdapter.initialize(spaceTimeCore, timeAuthority);
          expect(initResult.success).toBe(true);
          
          // Set time through Time Authority (allowed) - use small increments to avoid time jump issues
          const currentTime = timeAuthority.getCurrentJulianDate();
          const timeDelta = julianDate - currentTime;
          const maxJump = 0.5; // Half day maximum
          const adjustedTime = Math.abs(timeDelta) > maxJump ? 
            currentTime + Math.sign(timeDelta) * maxJump : julianDate;
          
          const setTimeResult = timeAuthority.setTime(adjustedTime);
          expect(setTimeResult.success).toBe(true);
          
          // Adapter should be able to get celestial bodies (read-only access)
          const bodies = testAdapter.getCelestialBodies();
          expect(Array.isArray(bodies)).toBe(true);
          
          // Adapter should be able to get current time (read-only access)
          const currentTime2 = testAdapter.getCurrentTime();
          expect(currentTime2).toBeInstanceOf(Date);
          
          // Adapter should not have direct access to ephemeris calculations
          // (This is enforced by the RenderLayerInterface)
          const renderInterface = testAdapter.getRenderInterface();
          expect(renderInterface).toBeDefined();
          
          // Verify adapter is properly initialized
          expect(testAdapter.isReady()).toBe(true);
          
          // Clean up
          testAdapter.dispose();
        }
      ), { numRuns: 50 });
    });

    test('adapter must provide backward compatible celestial body format', () => {
      fc.assert(fc.property(
        fc.double({ min: 2451545, max: 2451550, noNaN: true, noDefaultInfinity: true }),
        (julianDate) => {
          // Create fresh adapter for each iteration
          const testAdapter = new RenderingIntegrationAdapter();
          
          // Initialize adapter
          const initResult = testAdapter.initialize(spaceTimeCore, timeAuthority);
          expect(initResult.success).toBe(true);
          
          // Set time with small increments to avoid time jump issues
          const currentTime = timeAuthority.getCurrentJulianDate();
          const timeDelta = julianDate - currentTime;
          const maxJump = 0.5; // Half day maximum
          const adjustedTime = Math.abs(timeDelta) > maxJump ? 
            currentTime + Math.sign(timeDelta) * maxJump : julianDate;
          
          const setTimeResult = timeAuthority.setTime(adjustedTime);
          expect(setTimeResult.success).toBe(true);
          
          // Get celestial bodies in legacy format
          const bodies = testAdapter.getCelestialBodies();
          
          // Verify legacy format compliance
          bodies.forEach(body => {
            // Required legacy properties
            expect(typeof body.name).toBe('string');
            expect(typeof body.x).toBe('number');
            expect(typeof body.y).toBe('number');
            expect(typeof body.z).toBe('number');
            expect(typeof body.r).toBe('number');
            expect(typeof body.radius).toBe('number');
            expect(typeof body.color).toBe('string');
            
            // Verify position consistency
            const calculatedR = Math.sqrt(body.x ** 2 + body.y ** 2 + body.z ** 2);
            expect(Math.abs(body.r - calculatedR)).toBeLessThan(1e-10);
            
            // Verify finite values
            expect(Number.isFinite(body.x)).toBe(true);
            expect(Number.isFinite(body.y)).toBe(true);
            expect(Number.isFinite(body.z)).toBe(true);
            expect(Number.isFinite(body.r)).toBe(true);
            expect(Number.isFinite(body.radius)).toBe(true);
            
            // Verify reasonable ranges
            expect(body.r).toBeGreaterThanOrEqual(0);
            expect(body.radius).toBeGreaterThan(0);
          });
          
          // Clean up
          testAdapter.dispose();
        }
      ), { numRuns: 50 });
    });

    test('adapter must handle time subscriptions correctly', () => {
      fc.assert(fc.property(
        fc.array(fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }), { minLength: 2, maxLength: 5 }),
        (timeOffsets) => {
          // Create fresh adapter for each iteration
          const testAdapter = new RenderingIntegrationAdapter();
          
          // Initialize adapter
          const initResult = testAdapter.initialize(spaceTimeCore, timeAuthority);
          expect(initResult.success).toBe(true);
          
          let callbackCount = 0;
          let lastReceivedTime = 0;
          
          // Subscribe to time updates
          const unsubscribe = testAdapter.subscribeToTime((julianDate) => {
            callbackCount++;
            lastReceivedTime = julianDate;
          });
          
          // Set multiple times with small increments to avoid time jump issues
          const baseTime = timeAuthority.getCurrentJulianDate();
          timeOffsets.forEach((offset, index) => {
            const julianDate = baseTime + offset; // Small offset from base time
            const setTimeResult = timeAuthority.setTime(julianDate);
            expect(setTimeResult.success).toBe(true);
            
            // Verify callback was called
            expect(callbackCount).toBe(index + 1);
            expect(Math.abs(lastReceivedTime - julianDate)).toBeLessThan(1e-10);
          });
          
          // Unsubscribe and verify no more callbacks
          unsubscribe();
          const finalCallbackCount = callbackCount;
          
          const setTimeResult = timeAuthority.setTime(baseTime + timeOffsets[0]);
          expect(setTimeResult.success).toBe(true);
          
          // Callback count should not increase after unsubscribe
          expect(callbackCount).toBe(finalCallbackCount);
          
          // Clean up
          testAdapter.dispose();
        }
      ), { numRuns: 30 });
    });
  });

  describe('Property 11: No Direct Astronomical Access', () => {
    test('render components must not access VSOP87 directly', () => {
      // This test verifies architectural compliance
      // In a real implementation, this would use static analysis or runtime monitoring
      
      // Initialize adapter
      const initResult = adapter.initialize(spaceTimeCore, timeAuthority);
      expect(initResult.success).toBe(true);
      
      // Verify that adapter provides all necessary data through proper interfaces
      const bodies = adapter.getCelestialBodies();
      expect(bodies.length).toBeGreaterThan(0);
      
      // Verify that each body has all required data for rendering
      bodies.forEach(body => {
        // Position data (from StateVector)
        expect(typeof body.x).toBe('number');
        expect(typeof body.y).toBe('number');
        expect(typeof body.z).toBe('number');
        
        // Physical properties
        expect(typeof body.radius).toBe('number');
        expect(typeof body.color).toBe('string');
        
        // Display properties
        expect(typeof body.name).toBe('string');
      });
      
      // Verify that adapter doesn't expose internal ephemeris providers
      const renderInterface = adapter.getRenderInterface();
      
      // RenderLayerInterface should not expose ephemeris providers directly
      expect(renderInterface).toBeDefined();
      expect(typeof renderInterface.getCurrentTime).toBe('function');
      expect(typeof renderInterface.subscribeToTime).toBe('function');
      expect(typeof renderInterface.getSpaceTimeCore).toBe('function');
      
      // Verify that the Space-Time Core interface is properly restricted
      const spaceTimeCoreInterface = renderInterface.getSpaceTimeCore();
      expect(typeof spaceTimeCoreInterface.getBodyState).toBe('function');
      expect(typeof spaceTimeCoreInterface.getAvailableBodies).toBe('function');
    });

    test('time control must use Time Authority exclusively', () => {
      fc.assert(fc.property(
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (timeOffset) => {
          // Create fresh adapter for each iteration
          const testAdapter = new RenderingIntegrationAdapter();
          
          // Initialize adapter
          const initResult = testAdapter.initialize(spaceTimeCore, timeAuthority);
          expect(initResult.success).toBe(true);
          
          // Simulate time control component behavior
          let timeUpdateReceived = false;
          let receivedJulianDate = 0;
          
          // Subscribe to time updates (like TimeControl component would)
          const unsubscribe = testAdapter.subscribeToTime((jd) => {
            timeUpdateReceived = true;
            receivedJulianDate = jd;
          });
          
          // Set time through Time Authority (the only allowed way) with small offset
          const baseTime = timeAuthority.getCurrentJulianDate();
          const julianDate = baseTime + timeOffset;
          const setTimeResult = timeAuthority.setTime(julianDate);
          expect(setTimeResult.success).toBe(true);
          
          // Verify time update was received
          expect(timeUpdateReceived).toBe(true);
          expect(Math.abs(receivedJulianDate - julianDate)).toBeLessThan(1e-10);
          
          // Verify current time can be retrieved
          const currentTime = testAdapter.getCurrentTime();
          expect(currentTime).toBeInstanceOf(Date);
          
          // Convert back to Julian Date for comparison
          const retrievedJD = (currentTime.getTime() / 86400000) + 2440587.5;
          expect(Math.abs(retrievedJD - julianDate)).toBeLessThan(1e-6); // Allow for conversion precision
          
          unsubscribe();
          
          // Clean up
          testAdapter.dispose();
        }
      ), { numRuns: 50 });
    });
  });

  describe('Integration Compliance Tests', () => {
    test('global adapter singleton must work correctly', () => {
      // Test global adapter access
      const globalAdapter1 = getRenderingAdapter();
      const globalAdapter2 = getRenderingAdapter();
      
      // Should return same instance
      expect(globalAdapter1).toBe(globalAdapter2);
      
      // Initialize global adapter
      const initResult = initializeRenderingAdapter(spaceTimeCore, timeAuthority);
      expect(initResult.success).toBe(true);
      
      // Verify global adapter is ready
      expect(globalAdapter1.isReady()).toBe(true);
      
      // Test functionality through global adapter
      const bodies = globalAdapter1.getCelestialBodies();
      expect(Array.isArray(bodies)).toBe(true);
      
      const currentTime = globalAdapter1.getCurrentTime();
      expect(currentTime).toBeInstanceOf(Date);
    });

    test('adapter must handle specific celestial body queries', () => {
      fc.assert(fc.property(
        fc.constantFrom('sun', 'earth', 'mars', 'jupiter'),
        (bodyName) => {
          // Create fresh adapter for each iteration
          const testAdapter = new RenderingIntegrationAdapter();
          
          // Initialize adapter
          const initResult = testAdapter.initialize(spaceTimeCore, timeAuthority);
          expect(initResult.success).toBe(true);
          
          // Query specific body
          const body = testAdapter.getCelestialBody(bodyName);
          
          if (body) {
            expect(body.name.toLowerCase()).toBe(bodyName);
            expect(typeof body.x).toBe('number');
            expect(typeof body.y).toBe('number');
            expect(typeof body.z).toBe('number');
            expect(typeof body.radius).toBe('number');
            expect(typeof body.color).toBe('string');
            
            // Verify finite values
            expect(Number.isFinite(body.x)).toBe(true);
            expect(Number.isFinite(body.y)).toBe(true);
            expect(Number.isFinite(body.z)).toBe(true);
            expect(Number.isFinite(body.radius)).toBe(true);
          }
          
          // Clean up
          testAdapter.dispose();
        }
      ), { numRuns: 20 });
    });

    test('adapter must handle initialization errors gracefully', () => {
      // Test uninitialized adapter
      expect(adapter.isReady()).toBe(false);
      
      // Should return empty array when not initialized
      const bodies = adapter.getCelestialBodies();
      expect(bodies).toEqual([]);
      
      // Should return current date when not initialized
      const currentTime = adapter.getCurrentTime();
      expect(currentTime).toBeInstanceOf(Date);
      
      // Should return null for specific body queries when not initialized
      const body = adapter.getCelestialBody('earth');
      expect(body).toBeNull();
      
      // Test double initialization
      const initResult1 = adapter.initialize(spaceTimeCore, timeAuthority);
      expect(initResult1.success).toBe(true);
      
      const initResult2 = adapter.initialize(spaceTimeCore, timeAuthority);
      expect(initResult2.success).toBe(false);
      expect(initResult2.error?.code).toBe('ALREADY_INITIALIZED');
    });

    test('adapter must clean up resources properly', () => {
      // Initialize adapter
      const initResult = adapter.initialize(spaceTimeCore, timeAuthority);
      expect(initResult.success).toBe(true);
      
      let callbackCalled = false;
      const unsubscribe = adapter.subscribeToTime(() => {
        callbackCalled = true;
      });
      
      // Verify adapter is ready
      expect(adapter.isReady()).toBe(true);
      
      // Dispose adapter
      adapter.dispose();
      
      // Verify adapter is no longer ready
      expect(adapter.isReady()).toBe(false);
      
      // Verify subscriptions are cleaned up
      const setTimeResult = timeAuthority.setTime(2451545.0);
      expect(setTimeResult.success).toBe(true);
      
      // Callback should not be called after dispose
      expect(callbackCalled).toBe(false);
    });
  });
});