/**
 * Axial Tilt Physics System - Core Types and Interfaces
 * 
 * This module defines the fundamental types for the physically correct
 * axial tilt system. The core principle is:
 * 
 * > Obliquity is NOT a rotation amount, but a geometric relationship.
 * > Axial tilt = angle between spin axis vector and orbital normal vector.
 * 
 * CRITICAL CONSTRAINTS:
 * - Physical Layer SHALL NOT import or reference any Three.js types
 * - Render Layer SHALL NOT import or reference any ICRF/J2000 constants
 * - FrameTransformer is the ONLY module allowed to encode engine-specific axis conventions
 * 
 * Reference Frame: ICRF/J2000 ecliptic (Z-up)
 * - Z-axis: ecliptic normal (perpendicular to Earth's orbital plane)
 * - X-axis: vernal equinox direction
 * - Y-axis: completes right-handed system
 * 
 * @module axial-tilt/types
 * @requirements 2.1, 2.2, 7.1
 */

// ============================================================================
// Vector Types (Physical Layer - no Three.js dependency)
// ============================================================================

/**
 * 3D Vector representation in Cartesian coordinates.
 * 
 * This is a pure data type with no Three.js dependency.
 * Used for all physical calculations in ICRF/J2000 frame.
 */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Create a Vector3 from components.
 */
export function createVector3(x: number, y: number, z: number): Vector3 {
  return { x, y, z };
}

/**
 * Ecliptic normal vector (Z-up in ICRF/J2000).
 * This is the reference for all planetary orbital normals.
 */
export const ECLIPTIC_NORMAL: Vector3 = Object.freeze({ x: 0, y: 0, z: 1 });

// ============================================================================
// Orbital Elements
// ============================================================================

/**
 * Orbital elements defining a celestial body's orbit.
 * 
 * All angles are in RADIANS.
 * Reference plane: Ecliptic (黄道面)
 * Reference direction: Vernal equinox (春分点)
 * 
 * @requirements 1.1, 1.3
 */
export interface OrbitalElements {
  /**
   * Inclination (i) in radians.
   * Angle between orbital plane and ecliptic plane.
   * Range: [0, π]
   */
  readonly inclination: number;

  /**
   * Longitude of Ascending Node (Ω) in radians.
   * Angle from vernal equinox to ascending node, measured in ecliptic plane.
   * Range: [0, 2π)
   */
  readonly longitudeOfAscendingNode: number;
}

// ============================================================================
// Rotation Sense
// ============================================================================

/**
 * Rotation sense (prograde or retrograde).
 * 
 * - "prograde": rotation in same direction as orbital motion (most planets)
 * - "retrograde": rotation opposite to orbital motion (Venus, Uranus)
 * 
 * This field allows explicit control independent of obliquity,
 * which is important for angular velocity calculations.
 * 
 * @requirements 2.6
 */
export type RotationSense = "prograde" | "retrograde";

// ============================================================================
// Celestial Body Orientation Configuration
// ============================================================================

/**
 * Configuration for a celestial body's orientation.
 * 
 * This is the input configuration that can be provided in two ways:
 * 1. Direct spinAxis vector (preferred)
 * 2. obliquityDegrees (legacy, will be converted to spinAxis)
 * 
 * @requirements 2.1, 2.2, 7.1, 7.4
 */
export interface CelestialBodyOrientationConfig {
  /**
   * Spin axis vector in ICRF/J2000 ecliptic frame.
   * If provided, this is the authoritative source.
   * Must be a unit vector (magnitude = 1 ± 0.0001).
   */
  readonly spinAxis?: readonly [number, number, number];

  /**
   * Obliquity in degrees (legacy support).
   * Used to compute spinAxis if spinAxis not provided.
   * Range: [0, 90] for prograde, (90, 180] for retrograde.
   * 
   * NOTE: For retrograde rotators, obliquity encodes BOTH
   * geometric tilt AND rotation sense. See rotationSense for
   * explicit control.
   */
  readonly obliquityDegrees?: number;

  /**
   * Rotation sense (prograde or retrograde).
   * 
   * If not specified:
   * - obliquity <= 90°: assumed prograde
   * - obliquity > 90°: assumed retrograde
   */
  readonly rotationSense?: RotationSense;

  /**
   * Model north axis (which local axis points to north pole).
   * Default: [0, 1, 0] for +Y
   */
  readonly modelNorthAxis?: readonly [number, number, number];

  /**
   * Precession rate in arcseconds per century.
   * Reserved for future use (Phase 1 does not implement precession).
   * 
   * @requirements 7.4
   */
  readonly precessionRate?: number;
}

// ============================================================================
// Celestial Body Orientation State
// ============================================================================

/**
 * Runtime state of a celestial body's orientation.
 * 
 * This is the computed state after processing configuration.
 * All vectors are in ICRF/J2000 ecliptic frame.
 * 
 * @requirements 2.1, 2.2
 */
export interface CelestialBodyOrientationState {
  /** Body identifier */
  readonly bodyId: string;

  /** Orbital normal vector in ICRF/J2000 frame (unit vector) */
  readonly orbitalNormal: Vector3;

  /** Spin axis vector in ICRF/J2000 frame (unit vector) */
  readonly spinAxis: Vector3;

  /** Derived obliquity in radians (readonly, computed from vectors) */
  readonly obliquity: number;

  /** Epoch for which these values are valid (Julian Date) */
  readonly epoch: number;

  /** Rotation sense */
  readonly rotationSense: RotationSense;

  /** Precession rate in arcseconds/century (reserved for future) */
  readonly precessionRate?: number;
}

// ============================================================================
// Model Configuration
// ============================================================================

/**
 * Model-specific configuration for mesh orientation.
 * 
 * Different 3D models may have different conventions for which
 * local axis points to the "north pole".
 * 
 * @requirements 4.6
 */
export interface ModelConfig {
  /**
   * Which local axis points to physical north pole.
   * Default: (0, 1, 0) for +Y (standard sphere models)
   */
  readonly northAxis: Vector3;
}

/**
 * Default model configuration (north axis = +Y).
 */
export const DEFAULT_MODEL_CONFIG: ModelConfig = Object.freeze({
  northAxis: Object.freeze({ x: 0, y: 1, z: 0 })
});

// ============================================================================
// Degenerate Case Constants
// ============================================================================

/**
 * Tolerance for floating-point comparisons.
 * Used for unit vector validation and degenerate case detection.
 */
export const EPSILON = 1e-10;

/**
 * Tolerance for unit vector validation.
 * Magnitude must be 1 ± this value.
 */
export const UNIT_VECTOR_TOLERANCE = 1e-10;

/**
 * Tolerance for obliquity validation (degrees).
 * Computed obliquity must match NASA values within this tolerance.
 */
export const OBLIQUITY_TOLERANCE_DEGREES = 0.1;

/**
 * Tolerance for cross product magnitude in degenerate case detection.
 * If |A × N| < this value, vectors are nearly parallel.
 */
export const CROSS_PRODUCT_TOLERANCE = 1e-10;

/**
 * Tolerance for angular comparison (radians).
 */
export const ANGULAR_TOLERANCE = 1e-6;

// ============================================================================
// Calculator Interfaces
// ============================================================================

/**
 * Calculator for orbital plane properties.
 * 
 * Computes orbital normal vector and ascending node direction
 * from orbital elements (i, Ω).
 * 
 * CRITICAL: This calculator is ONLY valid for ecliptic reference plane.
 * Satellite orientation systems require a separate calculator.
 * 
 * @requirements 1.1, 1.3, 1.4, 1.6
 */
export interface OrbitalCalculator {
  /**
   * Compute orbital normal vector from orbital elements.
   * 
   * Formula:
   *   N_x = sin(i) * sin(Ω)
   *   N_y = -sin(i) * cos(Ω)
   *   N_z = cos(i)
   * 
   * @param elements - Orbital elements (i, Ω) in radians
   * @returns Unit vector in ICRF/J2000 ecliptic frame
   * @throws Error if inclination or LOAN is out of valid range
   */
  computeOrbitalNormal(elements: OrbitalElements): Vector3;

  /**
   * Get ascending node direction vector.
   * 
   * Formula:
   *   A_x = cos(Ω)
   *   A_y = sin(Ω)
   *   A_z = 0
   * 
   * @param longitudeOfAscendingNode - Ω in radians
   * @returns Unit vector in ICRF/J2000 ecliptic frame
   */
  computeAscendingNodeDirection(longitudeOfAscendingNode: number): Vector3;
}

/**
 * Calculator for spin axis properties.
 * 
 * Computes spin axis vector from obliquity and orbital normal,
 * and vice versa.
 * 
 * @requirements 2.3, 2.4, 2.5, 3.1, 3.2
 */
export interface SpinAxisCalculator {
  /**
   * Compute spin axis vector from obliquity and orbital normal.
   * 
   * Algorithm (Rodrigues' rotation formula):
   *   1. Start from orbital normal N
   *   2. Get ascending node direction A
   *   3. Rotate N around A by obliquity ε
   *   4. S = N*cos(ε) + (A×N)*sin(ε) + A*(A·N)*(1-cos(ε))
   * 
   * DEGENERATE CASES (CRITICAL):
   *   - If obliquity = 0: return orbitalNormal directly (no rotation needed)
   *   - If |ascendingNodeDirection × orbitalNormal| < CROSS_PRODUCT_TOLERANCE:
   *     choose a deterministic orthogonal axis:
   *     fallbackAxis = normalize(cross(orbitalNormal, [1,0,0]))
   *     if |fallbackAxis| < CROSS_PRODUCT_TOLERANCE: 
   *       fallbackAxis = normalize(cross(orbitalNormal, [0,1,0]))
   * 
   * @param orbitalNormal - Orbital plane normal (unit vector)
   * @param ascendingNodeDirection - Ascending node direction (unit vector)
   * @param obliquityRadians - Obliquity in radians (0 to π)
   * @returns Spin axis unit vector in ICRF/J2000 frame
   */
  computeSpinAxis(
    orbitalNormal: Vector3,
    ascendingNodeDirection: Vector3,
    obliquityRadians: number
  ): Vector3;

  /**
   * Compute obliquity from spin axis and orbital normal.
   * 
   * Formula: ε = acos(clamp(S·N, -1, 1))
   * 
   * @param spinAxis - Spin axis unit vector
   * @param orbitalNormal - Orbital normal unit vector
   * @returns Obliquity in radians [0, π]
   */
  computeObliquity(spinAxis: Vector3, orbitalNormal: Vector3): number;
}

/**
 * Coordinate frame transformer.
 * 
 * Transforms vectors between ICRF/J2000 (Z-up ecliptic) and
 * Three.js render frame (Y-up).
 * 
 * This is the ONLY module allowed to encode engine-specific axis conventions.
 * 
 * @requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */
export interface FrameTransformer {
  /**
   * Transform vector from ICRF/J2000 (Z-up ecliptic) to Three.js (Y-up).
   * 
   * Transformation:
   *   render_x = icrf_x
   *   render_y = icrf_z
   *   render_z = -icrf_y
   * 
   * @param v - Vector in ICRF/J2000 frame
   * @returns Vector in Three.js render frame
   */
  icrfToRender(v: Vector3): Vector3;

  /**
   * Transform vector from Three.js (Y-up) to ICRF/J2000 (Z-up ecliptic).
   * 
   * Inverse transformation:
   *   icrf_x = render_x
   *   icrf_y = -render_z
   *   icrf_z = render_y
   * 
   * @param v - Vector in Three.js render frame
   * @returns Vector in ICRF/J2000 frame
   */
  renderToIcrf(v: Vector3): Vector3;

  /**
   * Validate that a vector is a unit vector.
   * Logs warning if magnitude differs from 1 by more than tolerance.
   * 
   * @param v - Vector to validate
   * @param tolerance - Tolerance for magnitude check (default: UNIT_VECTOR_TOLERANCE)
   * @returns true if valid unit vector, false otherwise
   */
  validateUnitVector(v: Vector3, tolerance?: number): boolean;
}

/**
 * Mesh orientation manager interface.
 * 
 * Applies spin axis orientation to Three.js meshes.
 * This is a Render Layer component.
 * 
 * NOTE: The actual implementation will use Three.js types,
 * but this interface uses generic types to maintain layer separation.
 * 
 * @requirements 4.2, 4.3, 4.4, 4.5, 4.7
 */
export interface MeshOrientationManager {
  /**
   * Apply spin axis orientation to mesh.
   * 
   * Process:
   *   1. Transform spinAxis from ICRF to Render frame
   *   2. Create quaternion: setFromUnitVectors(modelNorthAxis, spinAxis)
   *   3. Apply to mesh.quaternion
   * 
   * IDEMPOTENCY GUARANTEE:
   *   This operation SHALL be idempotent: applying it multiple times
   *   with the same inputs MUST result in the same mesh orientation.
   *   The mesh's previous orientation is REPLACED, not accumulated.
   * 
   * @param mesh - Three.js mesh to orient (generic type for layer separation)
   * @param spinAxis - Spin axis in ICRF/J2000 frame
   * @param modelConfig - Model-specific configuration
   */
  applySpinAxisOrientation(
    mesh: unknown,
    spinAxis: Vector3,
    modelConfig: ModelConfig
  ): void;

  /**
   * Apply daily rotation around spin axis.
   * 
   * This rotation is COMPOSED with the base orientation, not replacing it.
   * 
   * @param mesh - Three.js mesh to rotate
   * @param spinAxis - Spin axis in Render frame
   * @param rotationAngle - Rotation angle in radians
   */
  applyDailyRotation(
    mesh: unknown,
    spinAxis: Vector3,
    rotationAngle: number
  ): void;
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error codes for the axial tilt system.
 */
export const AxialTiltErrorCodes = {
  /** Inclination out of valid range [0, π] */
  INVALID_INCLINATION: 'INVALID_INCLINATION',
  
  /** Longitude of ascending node out of valid range [0, 2π) */
  INVALID_LOAN: 'INVALID_LOAN',
  
  /** Obliquity out of valid range [0, π] */
  INVALID_OBLIQUITY: 'INVALID_OBLIQUITY',
  
  /** Vector magnitude differs from 1 by more than tolerance */
  NON_UNIT_VECTOR: 'NON_UNIT_VECTOR',
  
  /** Vector has zero or near-zero magnitude */
  ZERO_VECTOR: 'ZERO_VECTOR',
  
  /** Direct rotation.x/y/z assignment attempted for obliquity */
  DIRECT_ROTATION_SET: 'DIRECT_ROTATION_SET',
  
  /** Body has no spin axis configuration */
  MISSING_SPIN_AXIS: 'MISSING_SPIN_AXIS',
} as const;

export type AxialTiltErrorCode = typeof AxialTiltErrorCodes[keyof typeof AxialTiltErrorCodes];

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Result type for operations that may fail.
 */
export type AxialTiltResult<T> = 
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: AxialTiltError };

/**
 * Error type for axial tilt operations.
 */
export interface AxialTiltError {
  readonly code: AxialTiltErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

// ============================================================================
// Planet Orientation Data (Reference Values)
// ============================================================================

/**
 * Reference obliquity values from NASA Planetary Fact Sheet.
 * Used for validation (computed values must match within OBLIQUITY_TOLERANCE_DEGREES).
 * 
 * Values in degrees.
 */
export const NASA_OBLIQUITY_REFERENCE: Record<string, number> = {
  mercury: 0.034,
  venus: 177.4,
  earth: 23.44,
  mars: 25.19,
  jupiter: 3.13,
  saturn: 26.73,
  uranus: 97.77,
  neptune: 28.32,
} as const;
