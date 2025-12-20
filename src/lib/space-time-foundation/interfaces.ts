/**
 * Space-Time Foundation Core Interfaces
 * 
 * This module defines the core interfaces for the aerospace-grade
 * space-time coordinate foundation. These interfaces establish the
 * architectural boundaries between components.
 * 
 * CRITICAL: These interfaces are protected by CORE_RULES.md
 * Any modifications require explicit approval.
 */

import {
  StateVector,
  ReferenceFrameInfo,
  BodyHierarchy,
  TimeContinuityConstraints,
  SpaceTimeResult,
  UnsubscribeFunction,
  TimeUpdateCallback,
  Vector3,
  StateMetadata
} from './types';

// Re-export types for external use
export type {
  StateVector,
  ReferenceFrameInfo,
  BodyHierarchy,
  TimeContinuityConstraints,
  SpaceTimeResult,
  UnsubscribeFunction,
  TimeUpdateCallback,
  Vector3,
  StateMetadata
};

/**
 * Ephemeris Provider Interface
 * 
 * Standardized interface for astronomical data sources.
 * All providers (VSOP87, JPL, TLE, SPICE) must implement this interface.
 */
export interface EphemerisProvider {
  /** Provider identification */
  getProviderId(): string;
  
  /** Get list of supported celestial bodies */
  getSupportedBodies(): readonly string[];
  
  /** Get valid time range for this provider */
  getTimeRange(): { readonly startJD: number; readonly endJD: number };
  
  /** 
   * Core state calculation
   * @param bodyId - Celestial body identifier
   * @param julianDate - Julian Date for calculation
   * @returns StateVector with position, velocity, radius, and metadata
   */
  getState(bodyId: string, julianDate: number): SpaceTimeResult<StateVector>;
  
  /** 
   * Bulk calculation for efficiency
   * @param bodyId - Celestial body identifier  
   * @param julianDates - Array of Julian Dates
   * @returns Array of StateVectors
   */
  getStates(bodyId: string, julianDates: readonly number[]): SpaceTimeResult<readonly StateVector[]>;
  
  /** Get calculation accuracy for a body */
  getAccuracy(bodyId: string): number;
  
  /** Check if provider supports velocity calculations */
  supportsVelocity(): boolean;
}

/**
 * Ephemeris Router Interface
 * 
 * Lightweight routing of state queries to appropriate providers.
 * Separated from strategy for clean responsibility separation.
 */
export interface EphemerisRouter {
  /** 
   * Route state query to appropriate provider
   * @param bodyId - Celestial body identifier
   * @param julianDate - Julian Date for calculation
   * @returns StateVector from selected provider
   */
  getState(bodyId: string, julianDate: number): SpaceTimeResult<StateVector>;
  
  /** 
   * Route bulk state queries
   * @param bodyId - Celestial body identifier
   * @param julianDates - Array of Julian Dates
   * @returns Array of StateVectors from selected provider
   */
  getStates(bodyId: string, julianDates: readonly number[]): SpaceTimeResult<readonly StateVector[]>;
}

/**
 * Ephemeris Strategy Interface
 * 
 * Provider management and selection strategy.
 * Separated from router for clean responsibility separation.
 */
export interface EphemerisStrategy {
  /** Register a new provider */
  registerProvider(provider: EphemerisProvider): SpaceTimeResult<void>;
  
  /** Set provider priority for a specific body */
  setProviderPriority(bodyId: string, providerIds: readonly string[]): SpaceTimeResult<void>;
  
  /** Select best provider for a query */
  selectProvider(bodyId: string, julianDate: number): SpaceTimeResult<EphemerisProvider>;
  
  /** Get list of registered providers */
  getRegisteredProviders(): readonly string[];
}

/**
 * Time Authority Interface
 * 
 * Single source of truth for time progression with quantified continuity constraints.
 * CRITICAL: Only this component can modify system time.
 */
export interface TimeAuthority {
  /** Get current system Julian Date */
  getCurrentJulianDate(): number;
  
  /** 
   * Set time progression speed
   * @param speedMultiplier - Speed multiplier (1.0 = real-time, 365.0 = 1 year per second)
   */
  setTimeSpeed(speedMultiplier: number): SpaceTimeResult<void>;
  
  /** 
   * Set system time
   * @param julianDate - New Julian Date
   */
  setTime(julianDate: number): SpaceTimeResult<void>;
  
  /** 
   * Subscribe to time updates
   * @param callback - Function called on time changes
   * @returns Unsubscribe function
   */
  subscribe(callback: TimeUpdateCallback): UnsubscribeFunction;
  
  /** 
   * Validate time progression request
   * @param fromJD - Starting Julian Date
   * @param toJD - Ending Julian Date  
   * @param speed - Speed multiplier
   * @returns Validation result
   */
  validateTimeProgression(fromJD: number, toJD: number, speed: number): SpaceTimeResult<void>;
  
  /** Get time continuity constraints */
  getConstraints(): TimeContinuityConstraints;
  
  /** Start/stop time progression */
  start(): void;
  stop(): void;
  
  /** Check if time is progressing */
  isRunning(): boolean;
}

/**
 * Space-Time Core Interface
 * 
 * Central component managing coordinate systems and state queries.
 * CRITICAL: Render Layer can ONLY access read-only query methods.
 */
export interface SpaceTimeCore {
  // ========== READ-ONLY QUERIES (Render Layer allowed) ==========
  
  /** 
   * Get celestial body state at specific time
   * @param bodyId - Celestial body identifier
   * @param julianDate - Julian Date for query
   * @returns StateVector with position, velocity, radius, metadata
   */
  getBodyState(bodyId: string, julianDate: number): SpaceTimeResult<StateVector>;
  
  /** 
   * Get multiple bodies' states at specific time
   * @param bodyIds - Array of celestial body identifiers
   * @param julianDate - Julian Date for query
   * @returns Map of body IDs to StateVectors
   */
  getBodiesState(bodyIds: readonly string[], julianDate: number): SpaceTimeResult<ReadonlyMap<string, StateVector>>;
  
  /** 
   * Get body hierarchy information
   * @param bodyId - Celestial body identifier
   * @returns Hierarchy information
   */
  getBodyHierarchy(bodyId: string): SpaceTimeResult<BodyHierarchy>;
  
  /** Get reference frame information */
  getReferenceFrameInfo(): ReferenceFrameInfo;
  
  /** Get list of available celestial bodies */
  getAvailableBodies(): readonly string[];
  
  // ========== WRITE OPERATIONS (Physical Layer only - Render Layer FORBIDDEN) ==========
  
  /** 
   * Register ephemeris provider (Physical Layer only)
   * @param provider - Provider to register
   */
  registerEphemerisProvider(provider: EphemerisProvider): SpaceTimeResult<void>;
  
  /** 
   * Set provider priority (Physical Layer only)
   * @param bodyId - Celestial body identifier
   * @param providerIds - Ordered list of provider IDs by priority
   */
  setProviderPriority(bodyId: string, providerIds: readonly string[]): SpaceTimeResult<void>;
  
  /** 
   * Initialize the core system (Physical Layer only)
   * @param timeAuthority - Time authority instance
   * @param referenceFrame - Primary reference frame
   */
  initialize(timeAuthority: TimeAuthority, referenceFrame: ReferenceFrameInfo): SpaceTimeResult<void>;
}

/**
 * Render Layer Interface
 * 
 * Interface that Render Layer components must use.
 * CRITICAL: Only provides read-only access to Space-Time Core.
 */
export interface RenderLayerInterface {
  /** Get read-only access to Space-Time Core */
  getSpaceTimeCore(): Pick<SpaceTimeCore, 
    'getBodyState' | 
    'getBodiesState' | 
    'getBodyHierarchy' | 
    'getReferenceFrameInfo' | 
    'getAvailableBodies'
  >;
  
  /** Get current time from Time Authority */
  getCurrentTime(): number;
  
  /** Subscribe to time updates */
  subscribeToTime(callback: TimeUpdateCallback): UnsubscribeFunction;
}