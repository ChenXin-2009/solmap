/**
 * Space-Time Foundation - Core Exports
 * 
 * This module provides the main exports for the aerospace-grade
 * space-time coordinate foundation.
 * 
 * CRITICAL: These exports are protected by CORE_RULES.md
 * Any modifications require explicit approval.
 */

// Core Types
export type {
  Vector3,
  StateMetadata,
  StateVector,
  ReferenceFrameInfo,
  BodyHierarchy,
  TimeContinuityConstraints,
  ScaleStrategy,
  ScaleConfig,
  SpaceTimeError,
  SpaceTimeResult,
  UnsubscribeFunction,
  TimeUpdateCallback
} from './types';

// Core Interfaces
export type {
  EphemerisProvider,
  EphemerisRouter,
  EphemerisStrategy,
  TimeAuthority,
  SpaceTimeCore,
  RenderLayerInterface
} from './interfaces';

// Constants
export {
  PRIMARY_REFERENCE_FRAME,
  TIME_CONTINUITY_CONSTRAINTS,
  ASTRONOMICAL_CONSTANTS,
  ERROR_CODES,
  STANDARD_BODY_IDS,
  HIERARCHY_LEVELS,
  DEFAULT_PROVIDER_PRIORITIES,
  BODY_HIERARCHY_DEFINITIONS
} from './constants';

// Core Implementations
export { TimeAuthorityImpl } from './time-authority';
export { ReferenceFrameManager } from './reference-frame-manager';
export { VSOP87Provider } from './vsop87-provider';
export { EphemerisRouterImpl, EphemerisStrategyImpl } from './ephemeris-router';
export { SpaceTimeCoreImpl } from './space-time-core';
export { 
  RenderLayerInterfaceImpl, 
  LayerAccessValidator, 
  LayerBoundaryEnforcer 
} from './render-layer-interface';
export { 
  RenderingIntegrationAdapter,
  getRenderingAdapter,
  initializeRenderingAdapter
} from './rendering-integration';

// Architectural Validation Tools (Task 10.2)
export {
  ArchitecturalValidator,
  AIConstraintEnforcer
} from './architectural-validator';
export type {
  ArchitecturalViolation,
  ValidationResult
} from './architectural-validator';

/**
 * Version information
 */
export const SPACE_TIME_FOUNDATION_VERSION = "1.0.0-phase1" as const;

/**
 * Phase 1 Scope Validation
 * 
 * This function validates that operations comply with Phase 1 limitations.
 * Used to prevent scope creep and maintain focus.
 */
export function validatePhase1Scope(operation: string): boolean {
  const prohibitedOperations = [
    "relativistic_correction",
    "non_inertial_frame",
    "attitude_control",
    "spacecraft_propulsion",
    "multiple_authoritative_frames"
  ];
  
  return !prohibitedOperations.some(prohibited => 
    operation.toLowerCase().includes(prohibited)
  );
}

/**
 * Reference Frame Validation
 * 
 * Validates that only one authoritative reference frame exists.
 * Critical for Phase 1 constraints.
 */
export function validateSingleAuthoritativeFrame(frames: Array<{ type: string }>): boolean {
  const authoritativeFrames = frames.filter(frame => frame.type === "AUTHORITATIVE");
  return authoritativeFrames.length === 1;
}

/**
 * State Vector Validation
 * 
 * Validates that StateVector contains only physical quantities.
 * Critical for maintaining data integrity.
 */
export function validateStateVectorPurity(stateVector: {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  radius: number;
  metadata: { julianDate: number; referenceFrame: string };
}): boolean {
  // Import here to avoid circular dependency
  const { PRIMARY_REFERENCE_FRAME } = require('./constants');
  
  // Check that all numeric values are finite and not NaN
  const { position, velocity, radius } = stateVector;
  
  const isValidVector = (v: { x: number; y: number; z: number }): boolean => 
    Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  
  return (
    isValidVector(position) &&
    isValidVector(velocity) &&
    Number.isFinite(radius) &&
    radius > 0 &&
    stateVector.metadata.julianDate > 0 &&
    stateVector.metadata.referenceFrame === PRIMARY_REFERENCE_FRAME.frameId
  );
}