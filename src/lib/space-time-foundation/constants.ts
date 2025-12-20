/**
 * Space-Time Foundation Constants
 * 
 * This module defines the fundamental constants for the aerospace-grade
 * space-time coordinate foundation.
 * 
 * CRITICAL: These constants are protected by CORE_RULES.md
 * Any modifications require explicit approval.
 */

import { ReferenceFrameInfo, TimeContinuityConstraints } from './types';

/**
 * Primary Reference Frame (Phase 1: exactly 1 authoritative frame)
 * 
 * CRITICAL: This is the single authoritative reference frame for Phase 1.
 * All physical calculations must use this frame.
 */
export const PRIMARY_REFERENCE_FRAME: ReferenceFrameInfo = {
  frameId: "ICRF_J2000_HELIOCENTRIC",
  name: "Heliocentric Inertial ICRF/J2000",
  origin: "Sun Center",
  axes: "ICRF J2000.0",
  type: "AUTHORITATIVE",
  positionUnit: "km",
  velocityUnit: "km/s",
  timeUnit: "JD"
} as const;

/**
 * Time Continuity Constraints (quantified standards)
 * 
 * These constraints prevent time discontinuities that would break
 * physical calculations.
 */
export const TIME_CONTINUITY_CONSTRAINTS: TimeContinuityConstraints = {
  maxTimeJumpDays: 1.0,        // Maximum 1 day jump per update
  maxSpeedMultiplier: 1000000, // Maximum 1 million x real-time
  minTimePrecision: 1e-10,     // ~0.01 seconds precision
  minJulianDate: 1721425.5,    // Year 1 CE
  maxJulianDate: 5373484.5     // Year 9999 CE
} as const;

/**
 * Astronomical Constants
 */
export const ASTRONOMICAL_CONSTANTS = {
  /** J2000.0 epoch Julian Date */
  J2000_JD: 2451545.0,
  
  /** Astronomical Unit in kilometers */
  AU_KM: 149597870.7,
  
  /** Days per Julian century */
  DAYS_PER_CENTURY: 36525.0,
  
  /** Seconds per day */
  SECONDS_PER_DAY: 86400.0,
  
  /** Milliseconds per day */
  MS_PER_DAY: 86400000.0
} as const;

/**
 * Error Codes for Space-Time Foundation
 */
export const ERROR_CODES = {
  // Time Authority Errors
  INVALID_TIME_RANGE: "INVALID_TIME_RANGE",
  TIME_DISCONTINUITY: "TIME_DISCONTINUITY", 
  INVALID_SPEED_MULTIPLIER: "INVALID_SPEED_MULTIPLIER",
  
  // Ephemeris Provider Errors
  BODY_NOT_SUPPORTED: "BODY_NOT_SUPPORTED",
  TIME_OUT_OF_RANGE: "TIME_OUT_OF_RANGE",
  CALCULATION_FAILED: "CALCULATION_FAILED",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  
  // State Query Errors
  INVALID_BODY_ID: "INVALID_BODY_ID",
  INVALID_JULIAN_DATE: "INVALID_JULIAN_DATE",
  INVALID_STATE_VECTOR: "INVALID_STATE_VECTOR",
  PRECISION_LOSS: "PRECISION_LOSS",
  
  // Layer Boundary Violations
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  INTERFACE_VIOLATION: "INTERFACE_VIOLATION",
  MULTIPLE_AUTHORITATIVE_FRAMES: "MULTIPLE_AUTHORITATIVE_FRAMES",
  
  // System Errors
  NOT_INITIALIZED: "NOT_INITIALIZED",
  ALREADY_INITIALIZED: "ALREADY_INITIALIZED",
  INVALID_CONFIGURATION: "INVALID_CONFIGURATION"
} as const;

/**
 * Standard Body IDs
 * 
 * Standardized identifiers for celestial bodies.
 * These should be used consistently across all providers.
 */
export const STANDARD_BODY_IDS = {
  // Central star
  SUN: "sun",
  
  // Planets
  MERCURY: "mercury",
  VENUS: "venus", 
  EARTH: "earth",
  MARS: "mars",
  JUPITER: "jupiter",
  SATURN: "saturn",
  URANUS: "uranus",
  NEPTUNE: "neptune",
  
  // Earth's satellite
  MOON: "moon",
  
  // Jupiter's major satellites
  IO: "io",
  EUROPA: "europa", 
  GANYMEDE: "ganymede",
  CALLISTO: "callisto",
  
  // Saturn's major satellites
  TITAN: "titan",
  ENCELADUS: "enceladus",
  
  // Uranus's satellites
  MIRANDA: "miranda",
  ARIEL: "ariel",
  UMBRIEL: "umbriel", 
  TITANIA: "titania",
  
  // Neptune's satellite
  TRITON: "triton"
} as const;

/**
 * Hierarchy Levels
 */
export const HIERARCHY_LEVELS = {
  STAR: 0,
  PLANET: 1,
  SATELLITE: 2,
  SPACECRAFT: 3
} as const;

/**
 * Default Provider Priorities
 * 
 * Default priority order for ephemeris providers.
 * Higher priority providers are tried first.
 */
export const DEFAULT_PROVIDER_PRIORITIES: Record<string, readonly string[]> = {
  // Planets: VSOP87 is most accurate for planets
  [STANDARD_BODY_IDS.MERCURY]: ["vsop87", "jpl", "simplified"],
  [STANDARD_BODY_IDS.VENUS]: ["vsop87", "jpl", "simplified"],
  [STANDARD_BODY_IDS.EARTH]: ["vsop87", "jpl", "simplified"],
  [STANDARD_BODY_IDS.MARS]: ["vsop87", "jpl", "simplified"],
  [STANDARD_BODY_IDS.JUPITER]: ["vsop87", "jpl", "simplified"],
  [STANDARD_BODY_IDS.SATURN]: ["vsop87", "jpl", "simplified"],
  [STANDARD_BODY_IDS.URANUS]: ["vsop87", "jpl", "simplified"],
  [STANDARD_BODY_IDS.NEPTUNE]: ["vsop87", "jpl", "simplified"],
  
  // Satellites: JPL is typically more accurate for satellites
  [STANDARD_BODY_IDS.MOON]: ["jpl", "simplified"],
  [STANDARD_BODY_IDS.IO]: ["jpl", "simplified"],
  [STANDARD_BODY_IDS.EUROPA]: ["jpl", "simplified"],
  [STANDARD_BODY_IDS.GANYMEDE]: ["jpl", "simplified"],
  [STANDARD_BODY_IDS.CALLISTO]: ["jpl", "simplified"],
  [STANDARD_BODY_IDS.TITAN]: ["jpl", "simplified"],
  [STANDARD_BODY_IDS.ENCELADUS]: ["jpl", "simplified"],
  [STANDARD_BODY_IDS.MIRANDA]: ["jpl", "simplified"],
  [STANDARD_BODY_IDS.ARIEL]: ["jpl", "simplified"],
  [STANDARD_BODY_IDS.UMBRIEL]: ["jpl", "simplified"],
  [STANDARD_BODY_IDS.TITANIA]: ["jpl", "simplified"],
  [STANDARD_BODY_IDS.TRITON]: ["jpl", "simplified"]
} as const;

/**
 * Body Hierarchy Definitions
 * 
 * Defines the hierarchical relationships between celestial bodies.
 * Used to build the body hierarchy cache in Space-Time Core.
 */
export const BODY_HIERARCHY_DEFINITIONS: Record<string, {
  parentId?: string;
  children: readonly string[];
  hierarchyLevel: number;
}> = {
  // Central star (level 0)
  [STANDARD_BODY_IDS.SUN]: {
    parentId: undefined,
    children: [
      STANDARD_BODY_IDS.MERCURY,
      STANDARD_BODY_IDS.VENUS,
      STANDARD_BODY_IDS.EARTH,
      STANDARD_BODY_IDS.MARS,
      STANDARD_BODY_IDS.JUPITER,
      STANDARD_BODY_IDS.SATURN,
      STANDARD_BODY_IDS.URANUS,
      STANDARD_BODY_IDS.NEPTUNE
    ],
    hierarchyLevel: HIERARCHY_LEVELS.STAR
  },
  
  // Planets (level 1)
  [STANDARD_BODY_IDS.MERCURY]: {
    parentId: STANDARD_BODY_IDS.SUN,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.PLANET
  },
  
  [STANDARD_BODY_IDS.VENUS]: {
    parentId: STANDARD_BODY_IDS.SUN,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.PLANET
  },
  
  [STANDARD_BODY_IDS.EARTH]: {
    parentId: STANDARD_BODY_IDS.SUN,
    children: [STANDARD_BODY_IDS.MOON],
    hierarchyLevel: HIERARCHY_LEVELS.PLANET
  },
  
  [STANDARD_BODY_IDS.MARS]: {
    parentId: STANDARD_BODY_IDS.SUN,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.PLANET
  },
  
  [STANDARD_BODY_IDS.JUPITER]: {
    parentId: STANDARD_BODY_IDS.SUN,
    children: [
      STANDARD_BODY_IDS.IO,
      STANDARD_BODY_IDS.EUROPA,
      STANDARD_BODY_IDS.GANYMEDE,
      STANDARD_BODY_IDS.CALLISTO
    ],
    hierarchyLevel: HIERARCHY_LEVELS.PLANET
  },
  
  [STANDARD_BODY_IDS.SATURN]: {
    parentId: STANDARD_BODY_IDS.SUN,
    children: [
      STANDARD_BODY_IDS.TITAN,
      STANDARD_BODY_IDS.ENCELADUS
    ],
    hierarchyLevel: HIERARCHY_LEVELS.PLANET
  },
  
  [STANDARD_BODY_IDS.URANUS]: {
    parentId: STANDARD_BODY_IDS.SUN,
    children: [
      STANDARD_BODY_IDS.MIRANDA,
      STANDARD_BODY_IDS.ARIEL,
      STANDARD_BODY_IDS.UMBRIEL,
      STANDARD_BODY_IDS.TITANIA
    ],
    hierarchyLevel: HIERARCHY_LEVELS.PLANET
  },
  
  [STANDARD_BODY_IDS.NEPTUNE]: {
    parentId: STANDARD_BODY_IDS.SUN,
    children: [STANDARD_BODY_IDS.TRITON],
    hierarchyLevel: HIERARCHY_LEVELS.PLANET
  },
  
  // Satellites (level 2)
  [STANDARD_BODY_IDS.MOON]: {
    parentId: STANDARD_BODY_IDS.EARTH,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  },
  
  // Jupiter's satellites
  [STANDARD_BODY_IDS.IO]: {
    parentId: STANDARD_BODY_IDS.JUPITER,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  },
  
  [STANDARD_BODY_IDS.EUROPA]: {
    parentId: STANDARD_BODY_IDS.JUPITER,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  },
  
  [STANDARD_BODY_IDS.GANYMEDE]: {
    parentId: STANDARD_BODY_IDS.JUPITER,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  },
  
  [STANDARD_BODY_IDS.CALLISTO]: {
    parentId: STANDARD_BODY_IDS.JUPITER,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  },
  
  // Saturn's satellites
  [STANDARD_BODY_IDS.TITAN]: {
    parentId: STANDARD_BODY_IDS.SATURN,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  },
  
  [STANDARD_BODY_IDS.ENCELADUS]: {
    parentId: STANDARD_BODY_IDS.SATURN,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  },
  
  // Uranus's satellites
  [STANDARD_BODY_IDS.MIRANDA]: {
    parentId: STANDARD_BODY_IDS.URANUS,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  },
  
  [STANDARD_BODY_IDS.ARIEL]: {
    parentId: STANDARD_BODY_IDS.URANUS,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  },
  
  [STANDARD_BODY_IDS.UMBRIEL]: {
    parentId: STANDARD_BODY_IDS.URANUS,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  },
  
  [STANDARD_BODY_IDS.TITANIA]: {
    parentId: STANDARD_BODY_IDS.URANUS,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  },
  
  // Neptune's satellite
  [STANDARD_BODY_IDS.TRITON]: {
    parentId: STANDARD_BODY_IDS.NEPTUNE,
    children: [],
    hierarchyLevel: HIERARCHY_LEVELS.SATELLITE
  }
} as const;