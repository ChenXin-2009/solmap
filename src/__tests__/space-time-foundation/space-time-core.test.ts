/**
 * Space-Time Core Property Tests
 * 
 * Property-based tests for Space-Time Core functionality.
 * Validates universal correctness properties for the central coordinator.
 * 
 * CRITICAL: These tests validate CORE_RULES.md constraints.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';

import {
  SpaceTimeCore,
  TimeAuthority,
  EphemerisProvider,
  StateVector,
  ReferenceFrameInfo
} from '../../lib/space-time-foundation/interfaces';
import {
  STANDARD_BODY_IDS,
  ERROR_CODES,
  PRIMARY_REFERENCE_FRAME,
  ASTRONOMICAL_CONSTANTS
} from '../../lib/space-time-foundation/constants';
import { SpaceTimeCoreImpl } from '../../lib/space-time-foundation/space-time-core';
import { TimeAuthorityImpl } from '../../lib/space-time-foundation/time-authority';
import { VSOP87Provider } from '../../lib/space-time-foundation/vsop87-provider';

describe('Space-Time Core Property Tests', () => {
  let core: SpaceTimeCoreImpl;
  let timeAuthority: TimeAuthority;
  let provider: EphemerisProvider;

  beforeEach(() => {
    core = new SpaceTimeCoreImpl();
    timeAuthority = new TimeAuthorityImpl();
    provider = new VSOP87Provider();
  });

  afterEach(() => {
    core.reset();
    if ('dispose' in timeAuthority) {
      (timeAuthority as any).dispose();
    }
  });

  /**
   * Property 3: Physical Units Consistency
   * 
   * VALIDATES: Requirements 2.1, 2.2
   * CONSTRAINT: All physical quantities must maintain consistent units
   */
  describe('Property 3: Physical Units Consistency', () => {
    test('all state vectors must use consistent physical units', () => {
      // Initialize core
      const initResult = core.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(initResult.success).toBe(true);
      
      const regResult = core.registerEphemerisProvider(provider);
      expect(regResult.success).toBe(true);
      
      const supportedBodies = provider.getSupportedBodies();
      const timeRange = provider.getTimeRange();
      
      fc.assert(fc.property(
        fc.constantFrom(...supportedBodies),
        fc.double({ 
          min: timeRange.startJD, 
          max: timeRange.endJD,
          noNaN: true,
          noDefaultInfinity: true
        }),
        (bodyId, julianDate) => {
          const stateResult = core.getBodyState(bodyId, julianDate);
          
          if (stateResult.success) {
            const state = stateResult.data;
            
            // Position must be in kilometers
            expect(typeof state.position.x).toBe('number');
            expect(typeof state.position.y).toBe('number');
            expect(typeof state.position.z).toBe('number');
            expect(Number.isFinite(state.position.x)).toBe(true);
            expect(Number.isFinite(state.position.y)).toBe(true);
            expect(Number.isFinite(state.position.z)).toBe(true);
            
            // Velocity must be in km/s
            expect(typeof state.velocity.x).toBe('number');
            expect(typeof state.velocity.y).toBe('number');
            expect(typeof state.velocity.z).toBe('number');
            expect(Number.isFinite(state.velocity.x)).toBe(true);
            expect(Number.isFinite(state.velocity.y)).toBe(true);
            expect(Number.isFinite(state.velocity.z)).toBe(true);
            
            // Radius must be in kilometers and positive
            expect(typeof state.radius).toBe('number');
            expect(Number.isFinite(state.radius)).toBe(true);
            expect(state.radius).toBeGreaterThan(0);
            
            // Metadata must specify correct units
            expect(state.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);
            expect(PRIMARY_REFERENCE_FRAME.positionUnit).toBe('km');
            expect(PRIMARY_REFERENCE_FRAME.velocityUnit).toBe('km/s');
            expect(PRIMARY_REFERENCE_FRAME.timeUnit).toBe('JD');
            
            // Physical constraints - positions should be reasonable for solar system
            const positionMagnitude = Math.sqrt(
              state.position.x ** 2 + state.position.y ** 2 + state.position.z ** 2
            );
            
            // Should be between Mercury's perihelion and Neptune's aphelion (rough bounds)
            expect(positionMagnitude).toBeGreaterThan(0.3 * ASTRONOMICAL_CONSTANTS.AU_KM); // ~Mercury perihelion
            expect(positionMagnitude).toBeLessThan(50 * ASTRONOMICAL_CONSTANTS.AU_KM); // ~Neptune aphelion
            
            // Velocity should be reasonable for orbital motion
            const velocityMagnitude = Math.sqrt(
              state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2
            );
            
            // Should be between 0.1 km/s and 100 km/s (very conservative bounds)
            expect(velocityMagnitude).toBeGreaterThan(0.1);
            expect(velocityMagnitude).toBeLessThan(100);
          }
        }
      ), { numRuns: 100 });
    });

    test('bulk state queries must maintain unit consistency', () => {
      // Initialize core
      const initResult = core.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(initResult.success).toBe(true);
      
      const regResult = core.registerEphemerisProvider(provider);
      expect(regResult.success).toBe(true);
      
      const supportedBodies = provider.getSupportedBodies();
      const timeRange = provider.getTimeRange();
      
      fc.assert(fc.property(
        fc.array(fc.constantFrom(...supportedBodies), { minLength: 1, maxLength: 3 })
          .map(arr => [...new Set(arr)]), // Remove duplicates
        fc.double({ 
          min: timeRange.startJD, 
          max: timeRange.endJD,
          noNaN: true,
          noDefaultInfinity: true
        }),
        (bodyIds, julianDate) => {
          const statesResult = core.getBodiesState(bodyIds, julianDate);
          
          if (statesResult.success) {
            const statesMap = statesResult.data;
            
            expect(statesMap.size).toBe(bodyIds.length);
            
            for (const [bodyId, state] of statesMap) {
              // Same unit consistency checks as single state
              expect(Number.isFinite(state.position.x)).toBe(true);
              expect(Number.isFinite(state.velocity.x)).toBe(true);
              expect(state.radius).toBeGreaterThan(0);
              expect(state.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);
              
              // Verify body ID matches
              expect(bodyIds).toContain(bodyId);
            }
          }
        }
      ), { numRuns: 50 });
    });
  });

  /**
   * Property 4: State Vector Purity
   * 
   * VALIDATES: Requirements 2.6
   * CONSTRAINT: StateVectors must contain only physical quantities, never scaled values
   */
  describe('Property 4: State Vector Purity', () => {
    test('state vectors must contain only physical quantities', () => {
      // Initialize core
      const initResult = core.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(initResult.success).toBe(true);
      
      const regResult = core.registerEphemerisProvider(provider);
      expect(regResult.success).toBe(true);
      
      const supportedBodies = provider.getSupportedBodies();
      const timeRange = provider.getTimeRange();
      
      fc.assert(fc.property(
        fc.constantFrom(...supportedBodies),
        fc.double({ 
          min: timeRange.startJD, 
          max: timeRange.endJD,
          noNaN: true,
          noDefaultInfinity: true
        }),
        (bodyId, julianDate) => {
          const stateResult = core.getBodyState(bodyId, julianDate);
          
          if (stateResult.success) {
            const state = stateResult.data;
            
            // State vector structure must be immutable (check readonly nature)
            // Note: TypeScript readonly doesn't prevent runtime assignment, 
            // but we can check that the structure is as expected
            expect(state).toHaveProperty('position');
            expect(state).toHaveProperty('velocity');
            expect(state).toHaveProperty('radius');
            expect(state).toHaveProperty('metadata');
            
            // Verify the state vector follows the expected structure
            expect(typeof state.position).toBe('object');
            expect(typeof state.velocity).toBe('object');
            expect(typeof state.radius).toBe('number');
            expect(typeof state.metadata).toBe('object');
            
            // Position must represent physical coordinates, not scaled
            // Check that position changes appropriately with time
            const dt = 1.0 / 24.0; // 1 hour
            const futureStateResult = core.getBodyState(bodyId, julianDate + dt);
            
            if (futureStateResult.success) {
              const futureState = futureStateResult.data;
              
              // Position should change by approximately velocity * time
              const expectedDx = state.velocity.x * dt * 24 * 3600; // Convert to seconds
              const expectedDy = state.velocity.y * dt * 24 * 3600;
              const expectedDz = state.velocity.z * dt * 24 * 3600;
              
              const actualDx = futureState.position.x - state.position.x;
              const actualDy = futureState.position.y - state.position.y;
              const actualDz = futureState.position.z - state.position.z;
              
              // Allow for reasonable numerical error (1% or 1000 km, whichever is larger)
              const tolerance = Math.max(Math.abs(expectedDx) * 0.01, 1000);
              
              expect(Math.abs(actualDx - expectedDx)).toBeLessThan(tolerance);
              expect(Math.abs(actualDy - expectedDy)).toBeLessThan(tolerance);
              expect(Math.abs(actualDz - expectedDz)).toBeLessThan(tolerance);
            }
            
            // Metadata must be complete and accurate
            expect(state.metadata.julianDate).toBe(julianDate);
            expect(state.metadata.referenceFrame).toBe(PRIMARY_REFERENCE_FRAME.frameId);
            expect(typeof state.metadata.provider).toBe('string');
            expect(state.metadata.provider.length).toBeGreaterThan(0);
          }
        }
      ), { numRuns: 50 }); // Reduced runs for expensive calculations
    });

    test('state vectors must not contain render-layer transformations', () => {
      // Initialize core
      const initResult = core.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(initResult.success).toBe(true);
      
      const regResult = core.registerEphemerisProvider(provider);
      expect(regResult.success).toBe(true);
      
      const supportedBodies = provider.getSupportedBodies();
      const timeRange = provider.getTimeRange();
      
      fc.assert(fc.property(
        fc.constantFrom(...supportedBodies),
        fc.double({ 
          min: timeRange.startJD, 
          max: timeRange.endJD,
          noNaN: true,
          noDefaultInfinity: true
        }),
        (bodyId, julianDate) => {
          const stateResult = core.getBodyState(bodyId, julianDate);
          
          if (stateResult.success) {
            const state = stateResult.data;
            
            // State vector must not contain any render-specific properties
            expect(state).not.toHaveProperty('displayPosition');
            expect(state).not.toHaveProperty('visualScale');
            expect(state).not.toHaveProperty('realScale');
            expect(state).not.toHaveProperty('cameraTransform');
            expect(state).not.toHaveProperty('screenPosition');
            expect(state).not.toHaveProperty('pixelCoordinates');
            
            // Metadata must not contain render-specific information
            expect(state.metadata).not.toHaveProperty('displayScale');
            expect(state.metadata).not.toHaveProperty('cameraMatrix');
            expect(state.metadata).not.toHaveProperty('viewportSize');
            
            // Position values must be in physical units, not normalized or scaled
            // Check that positions are in reasonable physical ranges
            const positionMagnitude = Math.sqrt(
              state.position.x ** 2 + state.position.y ** 2 + state.position.z ** 2
            );
            
            // Should not be normalized (0-1 range) or in display units
            expect(positionMagnitude).toBeGreaterThan(1000); // At least 1000 km from origin
            
            // Should not be in AU (would be much smaller numbers)
            // Mercury's distance is ~0.39 AU = ~58 million km
            if (bodyId === STANDARD_BODY_IDS.MERCURY) {
              expect(positionMagnitude).toBeGreaterThan(30_000_000); // At least 30 million km
            }
          }
        }
      ), { numRuns: 100 });
    });
  });

  /**
   * Core Functionality Property Tests
   */
  describe('Core Functionality Property Tests', () => {
    test('initialization must be idempotent', () => {
      fc.assert(fc.property(
        fc.constant(timeAuthority),
        fc.constant(PRIMARY_REFERENCE_FRAME),
        (testTimeAuthority, testReferenceFrame) => {
          const testCore = new SpaceTimeCoreImpl();
          
          // First initialization should succeed
          const result1 = testCore.initialize(testTimeAuthority, testReferenceFrame);
          expect(result1.success).toBe(true);
          
          // Second initialization should fail
          const result2 = testCore.initialize(testTimeAuthority, testReferenceFrame);
          expect(result2.success).toBe(false);
          expect(result2.error.code).toBe(ERROR_CODES.INVALID_CONFIGURATION);
          
          testCore.reset();
        }
      ), { numRuns: 100 });
    });

    test('body hierarchy must be consistent', () => {
      // Initialize core
      const initResult = core.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(initResult.success).toBe(true);
      
      const regResult = core.registerEphemerisProvider(provider);
      expect(regResult.success).toBe(true);
      
      fc.assert(fc.property(
        fc.constantFrom(...Object.values(STANDARD_BODY_IDS)),
        (bodyId) => {
          const hierarchyResult = core.getBodyHierarchy(bodyId);
          
          if (hierarchyResult.success) {
            const hierarchy = hierarchyResult.data;
            
            // Hierarchy must be self-consistent
            expect(hierarchy.bodyId).toBe(bodyId);
            expect(typeof hierarchy.hierarchyLevel).toBe('number');
            expect(hierarchy.hierarchyLevel).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(hierarchy.children)).toBe(true);
            
            // If has parent, parent should exist and include this body as child
            if (hierarchy.parentId) {
              const parentResult = core.getBodyHierarchy(hierarchy.parentId);
              if (parentResult.success) {
                const parent = parentResult.data;
                expect(parent.children).toContain(bodyId);
                expect(parent.hierarchyLevel).toBeLessThan(hierarchy.hierarchyLevel);
              }
            }
            
            // Children should have this body as parent
            for (const childId of hierarchy.children) {
              const childResult = core.getBodyHierarchy(childId);
              if (childResult.success) {
                const child = childResult.data;
                expect(child.parentId).toBe(bodyId);
                expect(child.hierarchyLevel).toBeGreaterThan(hierarchy.hierarchyLevel);
              }
            }
          }
        }
      ), { numRuns: 100 });
    });

    test('available bodies list must match registered providers', () => {
      fc.assert(fc.property(
        fc.constant(provider),
        (testProvider) => {
          // Create fresh core for each test
          const testCore = new SpaceTimeCoreImpl();
          const testTimeAuthority = new TimeAuthorityImpl();
          
          // Initialize core
          const initResult = testCore.initialize(testTimeAuthority, PRIMARY_REFERENCE_FRAME);
          expect(initResult.success).toBe(true);
          
          // Before registration
          const bodiesBefore = testCore.getAvailableBodies();
          
          // Register provider
          const regResult = testCore.registerEphemerisProvider(testProvider);
          expect(regResult.success).toBe(true);
          
          // After registration
          const bodiesAfter = testCore.getAvailableBodies();
          
          // Should include all bodies from provider
          const providerBodies = testProvider.getSupportedBodies();
          for (const bodyId of providerBodies) {
            expect(bodiesAfter).toContain(bodyId);
          }
          
          // Should be sorted
          const sortedBodies = [...bodiesAfter].sort();
          expect(bodiesAfter).toEqual(sortedBodies);
          
          // Cleanup
          testCore.reset();
          if ('dispose' in testTimeAuthority) {
            (testTimeAuthority as any).dispose();
          }
        }
      ), { numRuns: 100 });
    });

    test('uninitialized core must reject all operations', () => {
      const uninitializedCore = new SpaceTimeCoreImpl();
      
      fc.assert(fc.property(
        fc.string(),
        fc.double(),
        (bodyId, julianDate) => {
          const stateResult = uninitializedCore.getBodyState(bodyId, julianDate);
          expect(stateResult.success).toBe(false);
          expect(stateResult.error.code).toBe(ERROR_CODES.NOT_INITIALIZED);
          
          const hierarchyResult = uninitializedCore.getBodyHierarchy(bodyId);
          expect(hierarchyResult.success).toBe(false);
          expect(hierarchyResult.error.code).toBe(ERROR_CODES.NOT_INITIALIZED);
        }
      ), { numRuns: 100 });
    });
  });
});