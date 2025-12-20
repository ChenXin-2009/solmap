/**
 * Layer Separation Property Tests
 * 
 * Property-based tests for layer separation integrity.
 * Validates that Physical Layer and Render Layer maintain strict boundaries.
 * 
 * CRITICAL: These tests validate CORE_RULES.md constraints.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';

import {
  SpaceTimeCore,
  TimeAuthority,
  EphemerisProvider,
  RenderLayerInterface
} from '../../lib/space-time-foundation/interfaces';
import {
  STANDARD_BODY_IDS,
  ERROR_CODES,
  PRIMARY_REFERENCE_FRAME
} from '../../lib/space-time-foundation/constants';
import { SpaceTimeCoreImpl } from '../../lib/space-time-foundation/space-time-core';
import { TimeAuthorityImpl } from '../../lib/space-time-foundation/time-authority';
import { VSOP87Provider } from '../../lib/space-time-foundation/vsop87-provider';
import { 
  RenderLayerInterfaceImpl, 
  LayerAccessValidator, 
  LayerBoundaryEnforcer 
} from '../../lib/space-time-foundation/render-layer-interface';

describe('Layer Separation Property Tests', () => {
  let core: SpaceTimeCoreImpl;
  let timeAuthority: TimeAuthority;
  let provider: EphemerisProvider;
  let renderInterface: RenderLayerInterfaceImpl;

  beforeEach(() => {
    core = new SpaceTimeCoreImpl();
    timeAuthority = new TimeAuthorityImpl();
    provider = new VSOP87Provider();
    renderInterface = new RenderLayerInterfaceImpl();
    
    // Reset violation count
    LayerBoundaryEnforcer.resetViolations();
  });

  afterEach(() => {
    core.reset();
    renderInterface.reset();
    if ('dispose' in timeAuthority) {
      (timeAuthority as any).dispose();
    }
    LayerBoundaryEnforcer.resetViolations();
  });

  /**
   * Property 6: Layer Separation Integrity
   * 
   * VALIDATES: Requirements 4.1, 4.2
   * CONSTRAINT: Render Layer must only access read-only operations
   */
  describe('Property 6: Layer Separation Integrity', () => {
    test('render layer interface must only expose read-only operations', () => {
      // Initialize systems
      const initResult = core.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(initResult.success).toBe(true);
      
      const regResult = core.registerEphemerisProvider(provider);
      expect(regResult.success).toBe(true);
      
      const renderInitResult = renderInterface.initialize(core, timeAuthority);
      expect(renderInitResult.success).toBe(true);

      fc.assert(fc.property(
        fc.constant(renderInterface),
        (testRenderInterface) => {
          const spaceTimeCore = testRenderInterface.getSpaceTimeCore();
          
          // Verify only read operations are available
          expect(typeof spaceTimeCore.getBodyState).toBe('function');
          expect(typeof spaceTimeCore.getBodiesState).toBe('function');
          expect(typeof spaceTimeCore.getBodyHierarchy).toBe('function');
          expect(typeof spaceTimeCore.getReferenceFrameInfo).toBe('function');
          expect(typeof spaceTimeCore.getAvailableBodies).toBe('function');
          
          // Verify write operations are NOT available
          expect((spaceTimeCore as any).registerEphemerisProvider).toBeUndefined();
          expect((spaceTimeCore as any).setProviderPriority).toBeUndefined();
          expect((spaceTimeCore as any).initialize).toBeUndefined();
          
          // Verify time authority only provides read access
          const currentTime = testRenderInterface.getCurrentTime();
          expect(typeof currentTime).toBe('number');
          expect(Number.isFinite(currentTime)).toBe(true);
        }
      ), { numRuns: 100 });
    });

    test('access validator must correctly identify allowed and forbidden operations', () => {
      fc.assert(fc.property(
        fc.constantFrom(
          'getBodyState',
          'getBodiesState', 
          'getBodyHierarchy',
          'getReferenceFrameInfo',
          'getAvailableBodies',
          'getCurrentJulianDate',
          'subscribe'
        ),
        (allowedOperation) => {
          const validation = LayerAccessValidator.validateOperation(allowedOperation);
          expect(validation.success).toBe(true);
        }
      ), { numRuns: 100 });
    });

    test('access validator must reject forbidden operations', () => {
      fc.assert(fc.property(
        fc.constantFrom(
          'registerEphemerisProvider',
          'setProviderPriority',
          'initialize',
          'setTime',
          'setTimeSpeed',
          'start',
          'stop'
        ),
        (forbiddenOperation) => {
          const validation = LayerAccessValidator.validateOperation(forbiddenOperation);
          expect(validation.success).toBe(false);
          expect(validation.error.code).toBe(ERROR_CODES.UNAUTHORIZED_ACCESS);
          expect(validation.error.message).toContain('forbidden');
        }
      ), { numRuns: 100 });
    });

    test('layer boundary enforcer must validate layer interactions', () => {
      // Reset violations before test
      LayerBoundaryEnforcer.resetViolations();
      
      fc.assert(fc.property(
        fc.constantFrom('Physical', 'Render'),
        fc.constantFrom('Physical', 'Render'),
        fc.constantFrom('getBodyState', 'setTime', 'registerEphemerisProvider'),
        (sourceLayer, targetLayer, operation) => {
          // Reset violations for each property test iteration
          LayerBoundaryEnforcer.resetViolations();
          
          const validation = LayerBoundaryEnforcer.validateLayerSeparation(
            sourceLayer as 'Physical' | 'Render',
            targetLayer as 'Physical' | 'Render', 
            operation
          );
          
          // Physical layer can do anything
          if (sourceLayer === 'Physical') {
            expect(validation.success).toBe(true);
          }
          
          // Render layer accessing Physical layer must follow rules
          if (sourceLayer === 'Render' && targetLayer === 'Physical') {
            const allowedOps = LayerAccessValidator.getAllowedOperations();
            if (allowedOps.includes(operation)) {
              expect(validation.success).toBe(true);
            } else {
              expect(validation.success).toBe(false);
            }
          }
          
          // Render-to-Render is always allowed
          if (sourceLayer === 'Render' && targetLayer === 'Render') {
            expect(validation.success).toBe(true);
          }
        }
      ), { numRuns: 100 });
    });

    test('access controlled proxy must prevent unauthorized access', () => {
      // Initialize systems
      const initResult = core.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(initResult.success).toBe(true);
      
      const regResult = core.registerEphemerisProvider(provider);
      expect(regResult.success).toBe(true);

      fc.assert(fc.property(
        fc.constant(core),
        (testCore) => {
          // Create access-controlled proxy
          const proxy = LayerAccessValidator.createAccessControlledProxy(
            testCore, 
            'TestRenderLayer'
          );
          
          // Allowed operations should work
          expect(() => {
            proxy.getAvailableBodies();
          }).not.toThrow();
          
          expect(() => {
            proxy.getReferenceFrameInfo();
          }).not.toThrow();
          
          // Forbidden operations should throw
          expect(() => {
            (proxy as any).registerEphemerisProvider(provider);
          }).toThrow(/forbidden/);
          
          expect(() => {
            (proxy as any).setProviderPriority('earth', ['vsop87']);
          }).toThrow(/forbidden/);
          
          // Direct property modification should be forbidden
          expect(() => {
            (proxy as any).someProperty = 'value';
          }).toThrow(/Direct property modification is forbidden/);
        }
      ), { numRuns: 50 }); // Reduced runs for expensive proxy operations
    });

    test('render layer interface must enforce initialization requirements', () => {
      fc.assert(fc.property(
        fc.constant(new RenderLayerInterfaceImpl()),
        (testInterface) => {
          // Uninitialized interface should throw on access
          expect(() => {
            testInterface.getSpaceTimeCore();
          }).toThrow(/not initialized/);
          
          expect(() => {
            testInterface.getCurrentTime();
          }).toThrow(/not initialized/);
          
          expect(() => {
            testInterface.subscribeToTime(() => {});
          }).toThrow(/not initialized/);
          
          // Should not be ready
          expect(testInterface.isReady()).toBe(false);
        }
      ), { numRuns: 100 });
    });

    test('render layer interface must prevent double initialization', () => {
      // Initialize systems
      const initResult = core.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(initResult.success).toBe(true);

      fc.assert(fc.property(
        fc.constant(renderInterface),
        fc.constant(core),
        fc.constant(timeAuthority),
        (testInterface, testCore, testTimeAuthority) => {
          // First initialization should succeed
          const result1 = testInterface.initialize(testCore, testTimeAuthority);
          expect(result1.success).toBe(true);
          
          // Second initialization should fail
          const result2 = testInterface.initialize(testCore, testTimeAuthority);
          expect(result2.success).toBe(false);
          expect(result2.error.code).toBe(ERROR_CODES.ALREADY_INITIALIZED);
          
          // Reset for next iteration
          testInterface.reset();
        }
      ), { numRuns: 100 });
    });
  });

  /**
   * Integration Tests for Layer Separation
   */
  describe('Layer Separation Integration Tests', () => {
    test('render layer must successfully access allowed operations', () => {
      // Initialize systems
      const initResult = core.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(initResult.success).toBe(true);
      
      const regResult = core.registerEphemerisProvider(provider);
      expect(regResult.success).toBe(true);
      
      const renderInitResult = renderInterface.initialize(core, timeAuthority);
      expect(renderInitResult.success).toBe(true);

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
          const spaceTimeCore = renderInterface.getSpaceTimeCore();
          
          // Should be able to query body state
          const stateResult = spaceTimeCore.getBodyState(bodyId, julianDate);
          if (stateResult.success) {
            const state = stateResult.data;
            
            // Verify state vector structure
            expect(typeof state.position).toBe('object');
            expect(typeof state.velocity).toBe('object');
            expect(typeof state.radius).toBe('number');
            expect(typeof state.metadata).toBe('object');
          }
          
          // Should be able to get hierarchy
          const hierarchyResult = spaceTimeCore.getBodyHierarchy(bodyId);
          if (hierarchyResult.success) {
            const hierarchy = hierarchyResult.data;
            expect(hierarchy.bodyId).toBe(bodyId);
          }
          
          // Should be able to get reference frame info
          const frameInfo = spaceTimeCore.getReferenceFrameInfo();
          expect(frameInfo.frameId).toBe(PRIMARY_REFERENCE_FRAME.frameId);
          
          // Should be able to get available bodies
          const availableBodies = spaceTimeCore.getAvailableBodies();
          expect(Array.isArray(availableBodies)).toBe(true);
          expect(availableBodies.length).toBeGreaterThan(0);
          
          // Should be able to get current time
          const currentTime = renderInterface.getCurrentTime();
          expect(typeof currentTime).toBe('number');
          expect(Number.isFinite(currentTime)).toBe(true);
        }
      ), { numRuns: 50 }); // Reduced runs for integration tests
    });

    test('violation tracking must work correctly', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 5 }),
        (violationCount) => {
          // Reset violations
          LayerBoundaryEnforcer.resetViolations();
          
          // Record some violations
          for (let i = 0; i < violationCount; i++) {
            LayerBoundaryEnforcer.recordViolation({
              layer: 'Render',
              operation: 'setTime',
              message: `Test violation ${i + 1}`,
              timestamp: Date.now()
            });
          }
          
          const stats = LayerBoundaryEnforcer.getViolationStats();
          expect(stats.count).toBe(violationCount);
          expect(stats.remaining).toBe(10 - violationCount);
          expect(stats.maxAllowed).toBe(10);
          
          // Reset for next iteration
          LayerBoundaryEnforcer.resetViolations();
        }
      ), { numRuns: 100 });
    });

    test('time subscription must work through render interface', () => {
      // Initialize systems
      const initResult = core.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(initResult.success).toBe(true);
      
      const renderInitResult = renderInterface.initialize(core, timeAuthority);
      expect(renderInitResult.success).toBe(true);

      fc.assert(fc.property(
        fc.double({ min: 2451545, max: 2500000, noNaN: true, noDefaultInfinity: true }),
        (newTime) => {
          let callbackCalled = false;
          let receivedTime = 0;
          
          // Subscribe through render interface
          const unsubscribe = renderInterface.subscribeToTime((julianDate) => {
            callbackCalled = true;
            receivedTime = julianDate;
          });
          
          // Change time (this would normally be done by Physical Layer)
          const setTimeResult = timeAuthority.setTime(newTime);
          if (setTimeResult.success) {
            expect(callbackCalled).toBe(true);
            expect(receivedTime).toBe(newTime);
          }
          
          // Cleanup
          unsubscribe();
        }
      ), { numRuns: 50 }); // Reduced runs for subscription tests
    });
  });
});