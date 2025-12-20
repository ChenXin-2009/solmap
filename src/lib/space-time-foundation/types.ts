/**
 * Space-Time Foundation Core Types
 * 
 * This module defines the fundamental interfaces for the aerospace-grade
 * space-time coordinate foundation. These types establish the contract
 * between Physical Layer (authoritative) and Render Layer (display only).
 * 
 * CRITICAL: These interfaces are protected by CORE_RULES.md
 * Any modifications require explicit approval.
 */

import { Matrix4 } from 'three';

/**
 * 3D Vector representation in Cartesian coordinates
 */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * State metadata providing context about the physical state
 */
export interface StateMetadata {
  /** Julian Date of this state */
  readonly julianDate: number;
  
  /** Reference frame identifier (e.g., "ICRF_J2000_HELIOCENTRIC") */
  readonly referenceFrame: string;
  
  /** Data source provider identifier */
  readonly provider: string;
  
  /** Calculation accuracy/uncertainty (optional) */
  readonly accuracy?: number;
  
  /** Additional provider-specific metadata */
  readonly [key: string]: unknown;
}

/**
 * Standardized celestial body state vector
 * 
 * CRITICAL SEMANTICS (protected by CORE_RULES.md):
 * - position: Cartesian coordinates of body's center of mass in authoritative reference frame (km)
 * - velocity: d(position)/dt in same reference frame (km/s)  
 * - radius: Physical radius of the body (km)
 * - metadata: Complete context about this state
 * 
 * CONSTRAINT: Contains ONLY physical quantities, never scaled or transformed values
 */
export interface StateVector {
  /** Position of body's center of mass in authoritative reference frame (km) */
  readonly position: Vector3;
  
  /** Velocity as d(position)/dt in same reference frame (km/s) */
  readonly velocity: Vector3;
  
  /** Physical radius of the body (km) */
  readonly radius: number;
  
  /** Metadata about the state */
  readonly metadata: StateMetadata;
}

/**
 * Reference frame information
 * 
 * CRITICAL: Phase 1 allows exactly 1 AUTHORITATIVE frame
 * DERIVED_DISPLAY frames exist ONLY in Render Layer
 */
export interface ReferenceFrameInfo {
  /** Frame identifier */
  readonly frameId: string; // e.g., "ICRF_J2000_HELIOCENTRIC"
  
  /** Human-readable frame name */
  readonly name: string; // e.g., "Heliocentric Inertial ICRF/J2000"
  
  /** Origin description */
  readonly origin: string; // e.g., "Sun Center"
  
  /** Axes description */
  readonly axes: string; // e.g., "ICRF J2000.0"
  
  /** Frame type - CRITICAL: Phase 1 allows only 1 AUTHORITATIVE */
  readonly type: "AUTHORITATIVE" | "DERIVED_DISPLAY";
  
  /** Position unit */
  readonly positionUnit: string; // "km"
  
  /** Velocity unit */
  readonly velocityUnit: string; // "km/s"
  
  /** Time unit */
  readonly timeUnit: string; // "JD"
}

/**
 * Celestial body hierarchy information
 */
export interface BodyHierarchy {
  /** Body identifier */
  readonly bodyId: string;
  
  /** Parent body identifier (undefined for root bodies like Sun) */
  readonly parentId?: string;
  
  /** Child body identifiers */
  readonly children: readonly string[];
  
  /** Hierarchy level (0=star, 1=planet, 2=satellite, etc.) */
  readonly hierarchyLevel: number;
}

/**
 * Time continuity constraints (quantified standards)
 */
export interface TimeContinuityConstraints {
  /** Maximum allowed time jump in single update (days) */
  readonly maxTimeJumpDays: number; // 1.0
  
  /** Maximum time speed multiplier */
  readonly maxSpeedMultiplier: number; // 1000000
  
  /** Minimum time precision (days) */
  readonly minTimePrecision: number; // 1e-10
  
  /** Minimum Julian Date bound */
  readonly minJulianDate: number; // 1721425.5 (Year 1 CE)
  
  /** Maximum Julian Date bound */
  readonly maxJulianDate: number; // 5373484.5 (Year 9999 CE)
}

/**
 * Scale strategy for Render Layer only
 * 
 * CRITICAL: This exists ONLY in Render Layer, never in Physical Layer
 */
export interface ScaleStrategy {
  /** Physical coordinates (READ-ONLY reference from Physical Layer) */
  readonly physicalPosition: Vector3; // km - never modified
  
  /** Display coordinates (Render Layer calculations only) */
  displayPosition: Vector3; // scaled for visualization
  
  /** Visual scale factor (logarithmic/non-linear scaling) */
  visualScale: number;
  
  /** Real scale factor (linear scaling) */
  realScale: number;
  
  /** Camera transform matrix (Render Layer only) */
  cameraTransform: Matrix4;
}

/**
 * Scale configuration for render layer transformations
 */
export interface ScaleConfig {
  /** Minimum scale factor to prevent invisible objects */
  readonly minScale: number;
  
  /** Maximum scale factor to prevent overflow */
  readonly maxScale: number;
  
  /** Base scale for 1:1 physical to display mapping */
  readonly baseScale: number;
  
  /** Logarithmic scaling factor for large distance ranges */
  readonly logScaleFactor: number;
  
  /** Whether to use logarithmic scaling for extreme distances */
  readonly useLogarithmicScaling: boolean;
}

/**
 * Error types for the space-time foundation
 */
export interface SpaceTimeError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Result type for operations that may fail
 */
export type SpaceTimeResult<T> = {
  readonly success: true;
  readonly data: T;
} | {
  readonly success: false;
  readonly error: SpaceTimeError;
};

/**
 * Unsubscribe function type for subscriptions
 */
export type UnsubscribeFunction = () => void;

/**
 * Time update callback type
 */
export type TimeUpdateCallback = (julianDate: number) => void;

/**
 * Celestial Body ID type
 * 
 * Union type of all supported celestial body identifiers.
 * Used for type safety in body queries and operations.
 */
export type CelestialBodyId = 
  | "sun"
  | "mercury" 
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "moon"
  | "io"
  | "europa"
  | "ganymede"
  | "callisto"
  | "titan"
  | "enceladus"
  | "miranda"
  | "ariel"
  | "umbriel"
  | "titania"
  | "triton";