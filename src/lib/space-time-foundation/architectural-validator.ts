/**
 * Architectural Compliance Validator
 * 
 * Runtime validation tools to ensure architectural compliance and detect
 * violations of core rules during AI-assisted development.
 * 
 * This module implements Task 10.2: Establish AI development constraints
 * by providing runtime checks for core rule violations.
 */

import {
  SpaceTimeCore,
  TimeAuthority,
  EphemerisProvider,
  ReferenceFrameInfo,
  SpaceTimeResult,
  StateVector
} from './interfaces';
import {
  ERROR_CODES,
  PRIMARY_REFERENCE_FRAME,
  TIME_CONTINUITY_CONSTRAINTS,
  STANDARD_BODY_IDS
} from './constants';
import { LayerAccessValidator, LayerBoundaryEnforcer } from './render-layer-interface';

/**
 * Architectural violation types
 */
export interface ArchitecturalViolation {
  readonly type: 'TIME_AUTHORITY' | 'REFERENCE_FRAME' | 'LAYER_BOUNDARY' | 'INTERFACE_COMPLIANCE' | 'PHASE_SCOPE';
  readonly severity: 'ERROR' | 'WARNING' | 'INFO';
  readonly message: string;
  readonly component: string;
  readonly timestamp: number;
  readonly details?: Record<string, unknown>;
}

/**
 * Validation result with detailed findings
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly violations: readonly ArchitecturalViolation[];
  readonly summary: {
    readonly errorCount: number;
    readonly warningCount: number;
    readonly infoCount: number;
  };
}

/**
 * Architectural Compliance Validator
 * 
 * Provides runtime validation of core architectural rules to prevent
 * violations during AI-assisted development.
 */
export class ArchitecturalValidator {
  private static violations: ArchitecturalViolation[] = [];
  private static readonly MAX_VIOLATIONS = 50;

  /**
   * Validate Time Authority compliance
   */
  static validateTimeAuthority(timeAuthority: TimeAuthority): ValidationResult {
    const violations: ArchitecturalViolation[] = [];

    try {
      // Check if time authority follows continuity constraints
      const currentTime = timeAuthority.getCurrentJulianDate();
      
      // Validate time range
      if (currentTime < TIME_CONTINUITY_CONSTRAINTS.minJulianDate) {
        violations.push({
          type: 'TIME_AUTHORITY',
          severity: 'ERROR',
          message: `Time is before minimum allowed range: ${currentTime} < ${TIME_CONTINUITY_CONSTRAINTS.minJulianDate}`,
          component: 'TimeAuthority',
          timestamp: Date.now(),
          details: { currentTime, minAllowed: TIME_CONTINUITY_CONSTRAINTS.minJulianDate }
        });
      }

      if (currentTime > TIME_CONTINUITY_CONSTRAINTS.maxJulianDate) {
        violations.push({
          type: 'TIME_AUTHORITY',
          severity: 'ERROR',
          message: `Time is after maximum allowed range: ${currentTime} > ${TIME_CONTINUITY_CONSTRAINTS.maxJulianDate}`,
          component: 'TimeAuthority',
          timestamp: Date.now(),
          details: { currentTime, maxAllowed: TIME_CONTINUITY_CONSTRAINTS.maxJulianDate }
        });
      }

      // Validate time precision
      const precision = Math.abs(currentTime - Math.round(currentTime * 1e10) / 1e10);
      if (precision > TIME_CONTINUITY_CONSTRAINTS.minTimePrecision) {
        violations.push({
          type: 'TIME_AUTHORITY',
          severity: 'WARNING',
          message: `Time precision may be insufficient: ${precision} > ${TIME_CONTINUITY_CONSTRAINTS.minTimePrecision}`,
          component: 'TimeAuthority',
          timestamp: Date.now(),
          details: { precision, minRequired: TIME_CONTINUITY_CONSTRAINTS.minTimePrecision }
        });
      }

    } catch (error) {
      violations.push({
        type: 'TIME_AUTHORITY',
        severity: 'ERROR',
        message: `Time Authority validation failed: ${error}`,
        component: 'TimeAuthority',
        timestamp: Date.now(),
        details: { error: String(error) }
      });
    }

    this.recordViolations(violations);
    return this.createValidationResult(violations);
  }

  /**
   * Validate Reference Frame compliance
   */
  static validateReferenceFrame(referenceFrame: ReferenceFrameInfo): ValidationResult {
    const violations: ArchitecturalViolation[] = [];

    // Check if frame matches primary reference frame
    if (referenceFrame.frameId !== PRIMARY_REFERENCE_FRAME.frameId) {
      violations.push({
        type: 'REFERENCE_FRAME',
        severity: 'ERROR',
        message: `Reference frame must be primary frame '${PRIMARY_REFERENCE_FRAME.frameId}', got '${referenceFrame.frameId}'`,
        component: 'ReferenceFrame',
        timestamp: Date.now(),
        details: { 
          expected: PRIMARY_REFERENCE_FRAME.frameId, 
          actual: referenceFrame.frameId 
        }
      });
    }

    // Check if frame type is authoritative
    if (referenceFrame.type !== 'AUTHORITATIVE') {
      violations.push({
        type: 'REFERENCE_FRAME',
        severity: 'ERROR',
        message: `Reference frame must be AUTHORITATIVE type, got '${referenceFrame.type}'`,
        component: 'ReferenceFrame',
        timestamp: Date.now(),
        details: { expected: 'AUTHORITATIVE', actual: referenceFrame.type }
      });
    }

    // Check units compliance
    if (referenceFrame.positionUnit !== 'km') {
      violations.push({
        type: 'REFERENCE_FRAME',
        severity: 'ERROR',
        message: `Position unit must be 'km', got '${referenceFrame.positionUnit}'`,
        component: 'ReferenceFrame',
        timestamp: Date.now(),
        details: { expected: 'km', actual: referenceFrame.positionUnit }
      });
    }

    if (referenceFrame.velocityUnit !== 'km/s') {
      violations.push({
        type: 'REFERENCE_FRAME',
        severity: 'ERROR',
        message: `Velocity unit must be 'km/s', got '${referenceFrame.velocityUnit}'`,
        component: 'ReferenceFrame',
        timestamp: Date.now(),
        details: { expected: 'km/s', actual: referenceFrame.velocityUnit }
      });
    }

    if (referenceFrame.timeUnit !== 'JD') {
      violations.push({
        type: 'REFERENCE_FRAME',
        severity: 'ERROR',
        message: `Time unit must be 'JD', got '${referenceFrame.timeUnit}'`,
        component: 'ReferenceFrame',
        timestamp: Date.now(),
        details: { expected: 'JD', actual: referenceFrame.timeUnit }
      });
    }

    this.recordViolations(violations);
    return this.createValidationResult(violations);
  }

  /**
   * Validate Layer Boundary compliance
   */
  static validateLayerBoundary(
    sourceLayer: 'Physical' | 'Render',
    operation: string,
    target?: object
  ): ValidationResult {
    const violations: ArchitecturalViolation[] = [];

    // Use existing layer boundary enforcer
    const boundaryResult = LayerBoundaryEnforcer.validateLayerSeparation(
      sourceLayer, 
      'Physical', // Assume target is Physical Layer for validation
      operation
    );

    if (!boundaryResult.success) {
      violations.push({
        type: 'LAYER_BOUNDARY',
        severity: 'ERROR',
        message: boundaryResult.error.message,
        component: `${sourceLayer}Layer`,
        timestamp: Date.now(),
        details: { 
          operation, 
          errorCode: boundaryResult.error.code,
          target: target ? target.constructor.name : 'unknown'
        }
      });
    }

    // Additional validation for render layer operations
    if (sourceLayer === 'Render') {
      const accessResult = LayerAccessValidator.validateOperation(operation);
      if (!accessResult.success) {
        violations.push({
          type: 'LAYER_BOUNDARY',
          severity: 'ERROR',
          message: accessResult.error.message,
          component: 'RenderLayer',
          timestamp: Date.now(),
          details: { operation, errorCode: accessResult.error.code }
        });
      }
    }

    this.recordViolations(violations);
    return this.createValidationResult(violations);
  }

  /**
   * Validate Ephemeris Provider interface compliance
   */
  static validateEphemerisProvider(provider: EphemerisProvider): ValidationResult {
    const violations: ArchitecturalViolation[] = [];

    try {
      // Check required methods exist
      const requiredMethods = ['getProviderId', 'getSupportedBodies', 'getTimeRange', 'getState'];
      for (const method of requiredMethods) {
        if (typeof (provider as any)[method] !== 'function') {
          violations.push({
            type: 'INTERFACE_COMPLIANCE',
            severity: 'ERROR',
            message: `Provider missing required method: ${method}`,
            component: 'EphemerisProvider',
            timestamp: Date.now(),
            details: { providerId: provider.getProviderId?.() || 'unknown', missingMethod: method }
          });
        }
      }

      // Validate provider ID
      const providerId = provider.getProviderId();
      if (!providerId || typeof providerId !== 'string') {
        violations.push({
          type: 'INTERFACE_COMPLIANCE',
          severity: 'ERROR',
          message: 'Provider ID must be a non-empty string',
          component: 'EphemerisProvider',
          timestamp: Date.now(),
          details: { providerId }
        });
      }

      // Validate supported bodies
      const supportedBodies = provider.getSupportedBodies();
      if (!Array.isArray(supportedBodies)) {
        violations.push({
          type: 'INTERFACE_COMPLIANCE',
          severity: 'ERROR',
          message: 'Supported bodies must be an array',
          component: 'EphemerisProvider',
          timestamp: Date.now(),
          details: { providerId, supportedBodies }
        });
      }

      // Validate time range
      const timeRange = provider.getTimeRange();
      if (!timeRange || typeof timeRange.startJD !== 'number' || typeof timeRange.endJD !== 'number') {
        violations.push({
          type: 'INTERFACE_COMPLIANCE',
          severity: 'ERROR',
          message: 'Time range must have numeric startJD and endJD properties',
          component: 'EphemerisProvider',
          timestamp: Date.now(),
          details: { providerId, timeRange }
        });
      }

    } catch (error) {
      violations.push({
        type: 'INTERFACE_COMPLIANCE',
        severity: 'ERROR',
        message: `Provider validation failed: ${error}`,
        component: 'EphemerisProvider',
        timestamp: Date.now(),
        details: { error: String(error) }
      });
    }

    this.recordViolations(violations);
    return this.createValidationResult(violations);
  }

  /**
   * Validate StateVector purity (no scaled or transformed values)
   */
  static validateStateVectorPurity(stateVector: StateVector): ValidationResult {
    const violations: ArchitecturalViolation[] = [];

    // Check for reasonable physical values (not scaled)
    const position = stateVector.position;
    const velocity = stateVector.velocity;
    const radius = stateVector.radius;

    // Position should be in km (reasonable range for solar system)
    const positionMagnitude = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
    if (positionMagnitude > 1e12) { // Beyond reasonable solar system distances
      violations.push({
        type: 'INTERFACE_COMPLIANCE',
        severity: 'WARNING',
        message: `Position magnitude unusually large: ${positionMagnitude} km`,
        component: 'StateVector',
        timestamp: Date.now(),
        details: { positionMagnitude, position }
      });
    }

    // Velocity should be in km/s (reasonable range for celestial bodies)
    const velocityMagnitude = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    if (velocityMagnitude > 1000) { // Beyond reasonable orbital velocities
      violations.push({
        type: 'INTERFACE_COMPLIANCE',
        severity: 'WARNING',
        message: `Velocity magnitude unusually large: ${velocityMagnitude} km/s`,
        component: 'StateVector',
        timestamp: Date.now(),
        details: { velocityMagnitude, velocity }
      });
    }

    // Radius should be positive and reasonable
    if (radius <= 0) {
      violations.push({
        type: 'INTERFACE_COMPLIANCE',
        severity: 'ERROR',
        message: `Radius must be positive: ${radius}`,
        component: 'StateVector',
        timestamp: Date.now(),
        details: { radius }
      });
    }

    if (radius > 1e6) { // Larger than Jupiter
      violations.push({
        type: 'INTERFACE_COMPLIANCE',
        severity: 'WARNING',
        message: `Radius unusually large: ${radius} km`,
        component: 'StateVector',
        timestamp: Date.now(),
        details: { radius }
      });
    }

    // Check metadata completeness
    const metadata = stateVector.metadata;
    if (!metadata.julianDate || !Number.isFinite(metadata.julianDate)) {
      violations.push({
        type: 'INTERFACE_COMPLIANCE',
        severity: 'ERROR',
        message: 'StateVector metadata must include valid Julian Date',
        component: 'StateVector',
        timestamp: Date.now(),
        details: { julianDate: metadata.julianDate }
      });
    }

    if (!metadata.referenceFrame) {
      violations.push({
        type: 'INTERFACE_COMPLIANCE',
        severity: 'ERROR',
        message: 'StateVector metadata must include reference frame',
        component: 'StateVector',
        timestamp: Date.now(),
        details: { referenceFrame: metadata.referenceFrame }
      });
    }

    if (!metadata.provider) {
      violations.push({
        type: 'INTERFACE_COMPLIANCE',
        severity: 'ERROR',
        message: 'StateVector metadata must include provider',
        component: 'StateVector',
        timestamp: Date.now(),
        details: { provider: metadata.provider }
      });
    }

    this.recordViolations(violations);
    return this.createValidationResult(violations);
  }

  /**
   * Validate Phase 1 scope limitations
   */
  static validatePhase1Scope(component: string, feature: string): ValidationResult {
    const violations: ArchitecturalViolation[] = [];

    // List of excluded Phase 1 features
    const excludedFeatures = [
      'relativistic',
      'attitude',
      'propulsion',
      'non-inertial',
      'spacecraft-dynamics',
      'orbital-maneuvers',
      'perturbations',
      'tidal-forces'
    ];

    const featureLower = feature.toLowerCase();
    for (const excluded of excludedFeatures) {
      if (featureLower.includes(excluded)) {
        violations.push({
          type: 'PHASE_SCOPE',
          severity: 'ERROR',
          message: `Feature '${feature}' is excluded from Phase 1 scope`,
          component,
          timestamp: Date.now(),
          details: { feature, excludedPattern: excluded }
        });
      }
    }

    this.recordViolations(violations);
    return this.createValidationResult(violations);
  }

  /**
   * Comprehensive system validation
   */
  static validateSystem(
    spaceTimeCore: SpaceTimeCore,
    timeAuthority: TimeAuthority,
    referenceFrame: ReferenceFrameInfo
  ): ValidationResult {
    const allViolations: ArchitecturalViolation[] = [];

    // Validate each component
    const timeResult = this.validateTimeAuthority(timeAuthority);
    allViolations.push(...timeResult.violations);

    const frameResult = this.validateReferenceFrame(referenceFrame);
    allViolations.push(...frameResult.violations);

    // Test a sample state query for compliance
    try {
      const testBodyResult = spaceTimeCore.getBodyState('earth', timeAuthority.getCurrentJulianDate());
      if (testBodyResult.success) {
        const stateResult = this.validateStateVectorPurity(testBodyResult.data);
        allViolations.push(...stateResult.violations);
      }
    } catch (error) {
      allViolations.push({
        type: 'INTERFACE_COMPLIANCE',
        severity: 'ERROR',
        message: `System validation test failed: ${error}`,
        component: 'SpaceTimeCore',
        timestamp: Date.now(),
        details: { error: String(error) }
      });
    }

    return this.createValidationResult(allViolations);
  }

  /**
   * Get all recorded violations
   */
  static getAllViolations(): readonly ArchitecturalViolation[] {
    return [...this.violations];
  }

  /**
   * Get violation statistics
   */
  static getViolationStats(): {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: number; // Last hour
  } {
    const oneHourAgo = Date.now() - 3600000;
    
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let recent = 0;

    for (const violation of this.violations) {
      byType[violation.type] = (byType[violation.type] || 0) + 1;
      bySeverity[violation.severity] = (bySeverity[violation.severity] || 0) + 1;
      
      if (violation.timestamp > oneHourAgo) {
        recent++;
      }
    }

    return {
      total: this.violations.length,
      byType,
      bySeverity,
      recent
    };
  }

  /**
   * Clear all violations (for testing)
   */
  static clearViolations(): void {
    this.violations = [];
    LayerBoundaryEnforcer.resetViolations();
  }

  /**
   * Record violations and enforce limits
   */
  private static recordViolations(violations: ArchitecturalViolation[]): void {
    this.violations.push(...violations);

    // Enforce maximum violations limit
    if (this.violations.length > this.MAX_VIOLATIONS) {
      const excess = this.violations.length - this.MAX_VIOLATIONS;
      console.error(`ARCHITECTURAL INTEGRITY COMPROMISED: ${this.violations.length} violations recorded (limit: ${this.MAX_VIOLATIONS})`);
      
      // Keep only the most recent violations
      this.violations = this.violations.slice(-this.MAX_VIOLATIONS);
      
      throw new Error(`Too many architectural violations (${this.violations.length + excess}). System integrity compromised.`);
    }

    // Log errors immediately
    for (const violation of violations) {
      if (violation.severity === 'ERROR') {
        console.error(`ARCHITECTURAL VIOLATION [${violation.type}]:`, violation.message, violation.details);
      } else if (violation.severity === 'WARNING') {
        console.warn(`ARCHITECTURAL WARNING [${violation.type}]:`, violation.message, violation.details);
      }
    }
  }

  /**
   * Create validation result from violations
   */
  private static createValidationResult(violations: ArchitecturalViolation[]): ValidationResult {
    const errorCount = violations.filter(v => v.severity === 'ERROR').length;
    const warningCount = violations.filter(v => v.severity === 'WARNING').length;
    const infoCount = violations.filter(v => v.severity === 'INFO').length;

    return {
      isValid: errorCount === 0,
      violations,
      summary: {
        errorCount,
        warningCount,
        infoCount
      }
    };
  }
}

/**
 * AI Development Constraint Enforcer
 * 
 * Provides specific validation for AI-generated code to ensure
 * compliance with CORE_RULES.md boundaries.
 */
export class AIConstraintEnforcer {
  /**
   * Validate that AI-generated code doesn't violate core rules
   */
  static validateAIModification(
    component: string,
    operation: string,
    details: Record<string, unknown>
  ): SpaceTimeResult<void> {
    // Check against prohibited modifications
    const prohibitedPatterns = [
      'TimeAuthorityImpl',
      'SpaceTimeCoreImpl', 
      'PRIMARY_REFERENCE_FRAME',
      'TIME_CONTINUITY_CONSTRAINTS',
      'EphemerisProvider',
      'StateVector',
      'ReferenceFrameInfo'
    ];

    for (const pattern of prohibitedPatterns) {
      if (component.includes(pattern) || operation.includes(pattern)) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED_ACCESS,
            message: `AI modification of '${pattern}' is prohibited by CORE_RULES.md. This component requires explicit human approval.`,
            details: { component, operation, pattern, ...details }
          }
        };
      }
    }

    // Validate Phase 1 scope
    const scopeResult = ArchitecturalValidator.validatePhase1Scope(component, operation);
    if (!scopeResult.isValid) {
      const errors = scopeResult.violations.filter(v => v.severity === 'ERROR');
      if (errors.length > 0) {
        return {
          success: false,
          error: {
            code: ERROR_CODES.INVALID_CONFIGURATION,
            message: `AI modification violates Phase 1 scope: ${errors[0].message}`,
            details: { component, operation, violations: errors, ...details }
          }
        };
      }
    }

    return { success: true, data: undefined };
  }

  /**
   * Get list of AI-modifiable components
   */
  static getAIModifiableComponents(): readonly string[] {
    return [
      'rendering-integration',
      'scale-strategy',
      'vsop87-provider',
      'ephemeris-router',
      'test-utilities',
      'documentation',
      'ui-components',
      'visualization-effects'
    ];
  }

  /**
   * Get list of AI-prohibited components
   */
  static getAIProhibitedComponents(): readonly string[] {
    return [
      'space-time-core',
      'time-authority',
      'render-layer-interface',
      'interfaces',
      'types',
      'constants',
      'CORE_RULES.md'
    ];
  }
}