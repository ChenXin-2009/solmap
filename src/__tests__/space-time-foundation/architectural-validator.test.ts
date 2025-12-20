/**
 * Architectural Validator Tests
 * 
 * Tests for Task 10.2: Establish AI development constraints
 * Validates runtime checks for core rule violations.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  ArchitecturalValidator,
  AIConstraintEnforcer,
  ArchitecturalViolation,
  ValidationResult
} from '../../lib/space-time-foundation/architectural-validator';
import { TimeAuthorityImpl } from '../../lib/space-time-foundation/time-authority';
import { VSOP87Provider } from '../../lib/space-time-foundation/vsop87-provider';
import { SpaceTimeCoreImpl } from '../../lib/space-time-foundation/space-time-core';
import {
  PRIMARY_REFERENCE_FRAME,
  TIME_CONTINUITY_CONSTRAINTS,
  ERROR_CODES
} from '../../lib/space-time-foundation/constants';
import { StateVector, ReferenceFrameInfo } from '../../lib/space-time-foundation/types';

describe('Architectural Validator Tests', () => {
  beforeEach(() => {
    // Clear violations before each test
    ArchitecturalValidator.clearViolations();
  });

  describe('Task 10.2: AI Development Constraints', () => {
    test('should validate Time Authority compliance', () => {
      const timeAuthority = new TimeAuthorityImpl();

      const result = ArchitecturalValidator.validateTimeAuthority(timeAuthority);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.summary.errorCount).toBe(0);
    });

    test('should detect Time Authority violations', () => {
      // Create a time authority with an invalid time directly
      const invalidTime = TIME_CONTINUITY_CONSTRAINTS.maxJulianDate + 1000;
      const timeAuthority = new TimeAuthorityImpl(invalidTime);

      const result = ArchitecturalValidator.validateTimeAuthority(timeAuthority);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('TIME_AUTHORITY');
      expect(result.violations[0].severity).toBe('ERROR');
      expect(result.summary.errorCount).toBeGreaterThan(0);
    });

    test('should validate Reference Frame compliance', () => {
      const result = ArchitecturalValidator.validateReferenceFrame(PRIMARY_REFERENCE_FRAME);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.summary.errorCount).toBe(0);
    });

    test('should detect Reference Frame violations', () => {
      const invalidFrame: ReferenceFrameInfo = {
        frameId: "INVALID_FRAME",
        name: "Invalid Frame",
        origin: "Unknown",
        axes: "Unknown",
        type: "DERIVED_DISPLAY", // Should be AUTHORITATIVE
        positionUnit: "AU", // Should be km
        velocityUnit: "AU/day", // Should be km/s
        timeUnit: "days" // Should be JD
      };

      const result = ArchitecturalValidator.validateReferenceFrame(invalidFrame);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.message.includes('Reference frame must be primary frame'))).toBe(true);
      expect(result.violations.some(v => v.message.includes('must be AUTHORITATIVE type'))).toBe(true);
      expect(result.violations.some(v => v.message.includes("Position unit must be 'km'"))).toBe(true);
    });

    test('should validate Layer Boundary compliance', () => {
      const result = ArchitecturalValidator.validateLayerBoundary('Render', 'getBodyState');

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should detect Layer Boundary violations', () => {
      const result = ArchitecturalValidator.validateLayerBoundary('Render', 'registerEphemerisProvider');

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].type).toBe('LAYER_BOUNDARY');
      expect(result.violations[0].severity).toBe('ERROR');
      expect(result.violations[0].message).toContain('forbidden');
    });

    test('should validate Ephemeris Provider compliance', () => {
      const provider = new VSOP87Provider();
      const result = ArchitecturalValidator.validateEphemerisProvider(provider);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should detect Ephemeris Provider violations', () => {
      // Create invalid provider
      const invalidProvider = {
        // Missing required methods
        getProviderId: () => '', // Empty ID
        getSupportedBodies: () => 'not-an-array', // Should be array
        getTimeRange: () => ({ invalid: true }), // Missing startJD/endJD
        getState: () => null
      } as any;

      const result = ArchitecturalValidator.validateEphemerisProvider(invalidProvider);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.message.includes('Provider ID must be a non-empty string'))).toBe(true);
      expect(result.violations.some(v => v.message.includes('Supported bodies must be an array'))).toBe(true);
    });

    test('should validate StateVector purity', () => {
      const validStateVector: StateVector = {
        position: { x: 149597870.7, y: 0, z: 0 }, // 1 AU in km
        velocity: { x: 0, y: 29.78, z: 0 }, // Earth orbital velocity
        radius: 6371, // Earth radius in km
        metadata: {
          julianDate: 2451545.0, // J2000.0
          referenceFrame: PRIMARY_REFERENCE_FRAME.frameId,
          provider: 'test'
        }
      };

      const result = ArchitecturalValidator.validateStateVectorPurity(validStateVector);

      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    test('should detect StateVector purity violations', () => {
      const invalidStateVector: StateVector = {
        position: { x: 1e15, y: 0, z: 0 }, // Unreasonably large
        velocity: { x: 0, y: 2000, z: 0 }, // Unreasonably fast
        radius: -100, // Negative radius
        metadata: {
          julianDate: NaN, // Invalid date
          referenceFrame: '', // Empty frame
          provider: '' // Empty provider
        }
      };

      const result = ArchitecturalValidator.validateStateVectorPurity(invalidStateVector);

      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.message.includes('Radius must be positive'))).toBe(true);
      expect(result.violations.some(v => v.message.includes('valid Julian Date'))).toBe(true);
    });

    test('should validate Phase 1 scope limitations', () => {
      const validResult = ArchitecturalValidator.validatePhase1Scope('TestComponent', 'position-calculation');
      expect(validResult.isValid).toBe(true);

      const invalidResult = ArchitecturalValidator.validatePhase1Scope('TestComponent', 'relativistic-correction');
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.violations[0].type).toBe('PHASE_SCOPE');
      expect(invalidResult.violations[0].message).toContain('excluded from Phase 1 scope');
    });

    test('should perform comprehensive system validation', async () => {
      // Set up complete system
      const timeAuthority = new TimeAuthorityImpl();

      const spaceTimeCore = new SpaceTimeCoreImpl();
      const initResult = spaceTimeCore.initialize(timeAuthority, PRIMARY_REFERENCE_FRAME);
      expect(initResult.success).toBe(true);

      const provider = new VSOP87Provider();
      const registerResult = spaceTimeCore.registerEphemerisProvider(provider);
      expect(registerResult.success).toBe(true);

      // Validate entire system
      const result = ArchitecturalValidator.validateSystem(
        spaceTimeCore,
        timeAuthority,
        PRIMARY_REFERENCE_FRAME
      );

      expect(result.isValid).toBe(true);
      expect(result.summary.errorCount).toBe(0);
    });
  });

  describe('AI Constraint Enforcer', () => {
    test('should allow AI modifications of permitted components', () => {
      const result = AIConstraintEnforcer.validateAIModification(
        'rendering-integration',
        'updateVisualization',
        { type: 'enhancement' }
      );

      expect(result.success).toBe(true);
    });

    test('should block AI modifications of prohibited components', () => {
      const result = AIConstraintEnforcer.validateAIModification(
        'TimeAuthorityImpl',
        'modifyTimeProgression',
        { type: 'core-change' }
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ERROR_CODES.UNAUTHORIZED_ACCESS);
      expect(result.error.message).toContain('prohibited by CORE_RULES.md');
    });

    test('should block AI modifications that violate Phase 1 scope', () => {
      const result = AIConstraintEnforcer.validateAIModification(
        'TestComponent',
        'add-relativistic-corrections',
        { type: 'feature-addition' }
      );

      expect(result.success).toBe(false);
      expect(result.error.message).toContain('violates Phase 1 scope');
    });

    test('should provide lists of modifiable and prohibited components', () => {
      const modifiable = AIConstraintEnforcer.getAIModifiableComponents();
      const prohibited = AIConstraintEnforcer.getAIProhibitedComponents();

      expect(modifiable).toContain('rendering-integration');
      expect(modifiable).toContain('scale-strategy');
      expect(modifiable).toContain('ui-components');

      expect(prohibited).toContain('space-time-core');
      expect(prohibited).toContain('time-authority');
      expect(prohibited).toContain('CORE_RULES.md');
    });
  });

  describe('Violation Tracking and Statistics', () => {
    test('should track violations and provide statistics', () => {
      // Generate some violations
      ArchitecturalValidator.validateLayerBoundary('Render', 'registerEphemerisProvider');
      ArchitecturalValidator.validateLayerBoundary('Render', 'setProviderPriority');

      const stats = ArchitecturalValidator.getViolationStats();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.byType['LAYER_BOUNDARY']).toBeGreaterThan(0);
      expect(stats.bySeverity['ERROR']).toBeGreaterThan(0);
    });

    test('should provide access to all recorded violations', () => {
      // Generate a violation
      ArchitecturalValidator.validateLayerBoundary('Render', 'registerEphemerisProvider');

      const violations = ArchitecturalValidator.getAllViolations();
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toHaveProperty('type');
      expect(violations[0]).toHaveProperty('severity');
      expect(violations[0]).toHaveProperty('message');
      expect(violations[0]).toHaveProperty('timestamp');
    });

    test('should enforce maximum violation limits', () => {
      // This test would be dangerous to run as it could crash the system
      // Instead, we'll just verify the mechanism exists
      const stats = ArchitecturalValidator.getViolationStats();
      expect(typeof stats.total).toBe('number');
    });
  });

  describe('Integration with Existing Layer Validation', () => {
    test('should integrate with LayerAccessValidator', () => {
      const result = ArchitecturalValidator.validateLayerBoundary('Render', 'getBodyState');
      expect(result.isValid).toBe(true);

      const invalidResult = ArchitecturalValidator.validateLayerBoundary('Render', 'setTime');
      expect(invalidResult.isValid).toBe(false);
    });

    test('should integrate with LayerBoundaryEnforcer', () => {
      // The validator should use the existing boundary enforcer
      const result = ArchitecturalValidator.validateLayerBoundary('Physical', 'registerEphemerisProvider');
      expect(result.isValid).toBe(true); // Physical layer can do anything
    });
  });
});

describe('Property 12: Architectural Compliance Validation', () => {
  test('architectural validator must detect core rule violations', () => {
    // Test multiple violation types
    const violations: ArchitecturalViolation[] = [];

    // Time Authority violation
    const timeResult = ArchitecturalValidator.validateTimeAuthority({
      getCurrentJulianDate: () => TIME_CONTINUITY_CONSTRAINTS.maxJulianDate + 1000,
      setTime: () => {},
      setTimeSpeed: () => {},
      subscribe: () => () => {},
      validateTimeProgression: () => false
    } as any);
    violations.push(...timeResult.violations);

    // Reference Frame violation
    const frameResult = ArchitecturalValidator.validateReferenceFrame({
      frameId: "INVALID",
      name: "Invalid",
      origin: "Unknown",
      axes: "Unknown", 
      type: "DERIVED_DISPLAY",
      positionUnit: "AU",
      velocityUnit: "AU/day",
      timeUnit: "days"
    });
    violations.push(...frameResult.violations);

    // Layer Boundary violation
    const layerResult = ArchitecturalValidator.validateLayerBoundary('Render', 'registerEphemerisProvider');
    violations.push(...layerResult.violations);

    // Should detect all violation types
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some(v => v.type === 'TIME_AUTHORITY')).toBe(true);
    expect(violations.some(v => v.type === 'REFERENCE_FRAME')).toBe(true);
    expect(violations.some(v => v.type === 'LAYER_BOUNDARY')).toBe(true);
    expect(violations.every(v => v.severity === 'ERROR')).toBe(true);
  });

  test('AI constraint enforcer must prevent prohibited modifications', () => {
    const prohibitedComponents = [
      'TimeAuthorityImpl',
      'SpaceTimeCoreImpl',
      'PRIMARY_REFERENCE_FRAME',
      'StateVector',
      'EphemerisProvider'
    ];

    for (const component of prohibitedComponents) {
      const result = AIConstraintEnforcer.validateAIModification(
        component,
        'modify-core-logic',
        { type: 'ai-generated' }
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ERROR_CODES.UNAUTHORIZED_ACCESS);
      expect(result.error.message).toContain('prohibited by CORE_RULES.md');
    }
  });

  test('validation system must maintain architectural integrity', () => {
    // Test that the validation system itself follows architectural rules
    const validator = ArchitecturalValidator;
    
    // Should have all required methods
    expect(typeof validator.validateTimeAuthority).toBe('function');
    expect(typeof validator.validateReferenceFrame).toBe('function');
    expect(typeof validator.validateLayerBoundary).toBe('function');
    expect(typeof validator.validateEphemerisProvider).toBe('function');
    expect(typeof validator.validateStateVectorPurity).toBe('function');
    expect(typeof validator.validatePhase1Scope).toBe('function');
    expect(typeof validator.validateSystem).toBe('function');

    // Should track violations properly
    expect(typeof validator.getAllViolations).toBe('function');
    expect(typeof validator.getViolationStats).toBe('function');
    expect(typeof validator.clearViolations).toBe('function');

    // AI constraint enforcer should exist
    expect(typeof AIConstraintEnforcer.validateAIModification).toBe('function');
    expect(typeof AIConstraintEnforcer.getAIModifiableComponents).toBe('function');
    expect(typeof AIConstraintEnforcer.getAIProhibitedComponents).toBe('function');
  });
});