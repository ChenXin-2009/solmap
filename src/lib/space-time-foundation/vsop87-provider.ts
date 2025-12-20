/**
 * VSOP87 Ephemeris Provider
 * 
 * Adapts the existing VSOP87 orbital calculations to the EphemerisProvider interface.
 * Provides high-accuracy planetary positions using VSOP87 simplified model.
 * 
 * CRITICAL: Protected by CORE_RULES.md - modifications require approval.
 */

import {
  EphemerisProvider,
  StateVector,
  SpaceTimeResult,
  Vector3,
  StateMetadata
} from './interfaces';
import {
  STANDARD_BODY_IDS,
  ERROR_CODES,
  ASTRONOMICAL_CONSTANTS,
  PRIMARY_REFERENCE_FRAME
} from './constants';

// Import existing orbital calculations
import { ORBITAL_ELEMENTS, calculatePosition, OrbitalElements } from '../astronomy/orbit';

/**
 * VSOP87 Ephemeris Provider Implementation
 * 
 * Provides planetary positions using VSOP87 simplified model.
 * Supports the 8 major planets with high accuracy.
 */
export class VSOP87Provider implements EphemerisProvider {
  private readonly providerId = 'vsop87';
  private readonly supportedBodies: readonly string[];
  private readonly timeRange: { readonly startJD: number; readonly endJD: number };
  private readonly bodyElementsMap: Map<string, OrbitalElements>;

  constructor() {
    // Map standard body IDs to orbital elements
    this.bodyElementsMap = new Map();
    const supportedBodyList: string[] = [];

    // Add planets that have orbital elements
    const bodyMapping: Record<string, string> = {
      [STANDARD_BODY_IDS.MERCURY]: 'mercury',
      [STANDARD_BODY_IDS.VENUS]: 'venus',
      [STANDARD_BODY_IDS.EARTH]: 'earth',
      [STANDARD_BODY_IDS.MARS]: 'mars',
      [STANDARD_BODY_IDS.JUPITER]: 'jupiter',
      [STANDARD_BODY_IDS.SATURN]: 'saturn',
      [STANDARD_BODY_IDS.URANUS]: 'uranus',
      [STANDARD_BODY_IDS.NEPTUNE]: 'neptune'
    };

    for (const [standardId, elementsKey] of Object.entries(bodyMapping)) {
      const elements = ORBITAL_ELEMENTS[elementsKey];
      if (elements) {
        this.bodyElementsMap.set(standardId, elements);
        supportedBodyList.push(standardId);
      }
    }

    this.supportedBodies = supportedBodyList;

    // VSOP87 is valid for approximately ±3000 years from J2000
    // Conservative range for good accuracy
    this.timeRange = {
      startJD: ASTRONOMICAL_CONSTANTS.J2000_JD - 365250, // ~1000 years before J2000
      endJD: ASTRONOMICAL_CONSTANTS.J2000_JD + 365250     // ~1000 years after J2000
    };
  }

  getProviderId(): string {
    return this.providerId;
  }

  getSupportedBodies(): readonly string[] {
    return this.supportedBodies;
  }

  getTimeRange(): { readonly startJD: number; readonly endJD: number } {
    return this.timeRange;
  }

  getState(bodyId: string, julianDate: number): SpaceTimeResult<StateVector> {
    // Validate inputs
    if (!bodyId || typeof bodyId !== 'string') {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_BODY_ID,
          message: 'Body ID must be a valid string'
        }
      };
    }

    if (!Number.isFinite(julianDate)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_JULIAN_DATE,
          message: 'Julian Date must be a finite number'
        }
      };
    }

    // Check if body is supported
    if (!this.supportedBodies.includes(bodyId)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.BODY_NOT_SUPPORTED,
          message: `Body '${bodyId}' is not supported by VSOP87 provider`
        }
      };
    }

    // Check time range
    if (julianDate < this.timeRange.startJD || julianDate > this.timeRange.endJD) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.TIME_OUT_OF_RANGE,
          message: `Julian Date ${julianDate} is outside VSOP87 valid range [${this.timeRange.startJD}, ${this.timeRange.endJD}]`
        }
      };
    }

    // Get orbital elements for this body
    const elements = this.bodyElementsMap.get(bodyId);
    if (!elements) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.CALCULATION_FAILED,
          message: `No orbital elements found for body '${bodyId}'`
        }
      };
    }

    try {
      // Calculate position using existing VSOP87 implementation
      const position = calculatePosition(elements, julianDate);

      // Convert AU to km
      const positionKm: Vector3 = {
        x: position.x * ASTRONOMICAL_CONSTANTS.AU_KM,
        y: position.y * ASTRONOMICAL_CONSTANTS.AU_KM,
        z: position.z * ASTRONOMICAL_CONSTANTS.AU_KM
      };

      // Calculate velocity by numerical differentiation
      const velocityKmS = this.calculateVelocity(elements, julianDate);

      // Get physical radius in km
      const radiusKm = elements.radius * ASTRONOMICAL_CONSTANTS.AU_KM;

      // Create metadata
      const metadata: StateMetadata = {
        julianDate,
        referenceFrame: PRIMARY_REFERENCE_FRAME.frameId,
        provider: this.providerId,
        accuracy: this.getAccuracy(bodyId)
      };

      const stateVector: StateVector = {
        position: positionKm,
        velocity: velocityKmS,
        radius: radiusKm,
        metadata
      };

      return { success: true, data: stateVector };

    } catch (error) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.CALCULATION_FAILED,
          message: `VSOP87 calculation failed for body '${bodyId}': ${error}`,
          details: { bodyId, julianDate, error: String(error) }
        }
      };
    }
  }

  getStates(bodyId: string, julianDates: readonly number[]): SpaceTimeResult<readonly StateVector[]> {
    if (!Array.isArray(julianDates) || julianDates.length === 0) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_JULIAN_DATE,
          message: 'Julian dates must be a non-empty array'
        }
      };
    }

    const states: StateVector[] = [];

    for (const jd of julianDates) {
      const result = this.getState(bodyId, jd);
      if (!result.success) {
        return result as SpaceTimeResult<readonly StateVector[]>;
      }
      states.push(result.data);
    }

    return { success: true, data: states };
  }

  getAccuracy(bodyId: string): number {
    // VSOP87 accuracy varies by planet and time range
    // These are approximate values in km for position accuracy
    const accuracyMap: Record<string, number> = {
      [STANDARD_BODY_IDS.MERCURY]: 1.0,    // ~1 km
      [STANDARD_BODY_IDS.VENUS]: 2.0,      // ~2 km
      [STANDARD_BODY_IDS.EARTH]: 1.0,      // ~1 km
      [STANDARD_BODY_IDS.MARS]: 5.0,       // ~5 km
      [STANDARD_BODY_IDS.JUPITER]: 50.0,   // ~50 km
      [STANDARD_BODY_IDS.SATURN]: 100.0,   // ~100 km
      [STANDARD_BODY_IDS.URANUS]: 200.0,   // ~200 km
      [STANDARD_BODY_IDS.NEPTUNE]: 500.0   // ~500 km
    };

    return accuracyMap[bodyId] || 1000.0; // Default 1000 km for unknown bodies
  }

  supportsVelocity(): boolean {
    return true;
  }

  /**
   * Calculate velocity by numerical differentiation
   * Uses central difference method for better accuracy
   */
  private calculateVelocity(elements: OrbitalElements, julianDate: number): Vector3 {
    // Time step for numerical differentiation (1 hour = 1/24 days)
    const dt = 1.0 / 24.0;
    
    try {
      // Calculate positions at t-dt and t+dt
      const pos1 = calculatePosition(elements, julianDate - dt);
      const pos2 = calculatePosition(elements, julianDate + dt);
      
      // Central difference: v = (pos2 - pos1) / (2 * dt)
      // Convert from AU/day to km/s
      const auPerDay_to_kmPerS = ASTRONOMICAL_CONSTANTS.AU_KM / ASTRONOMICAL_CONSTANTS.SECONDS_PER_DAY;
      
      return {
        x: (pos2.x - pos1.x) / (2 * dt) * auPerDay_to_kmPerS,
        y: (pos2.y - pos1.y) / (2 * dt) * auPerDay_to_kmPerS,
        z: (pos2.z - pos1.z) / (2 * dt) * auPerDay_to_kmPerS
      };
    } catch (error) {
      // Fallback to zero velocity if calculation fails
      console.warn(`Velocity calculation failed for ${elements.name}: ${error}`);
      return { x: 0, y: 0, z: 0 };
    }
  }

  /**
   * Get orbital elements for a body (for debugging/testing)
   */
  getOrbitalElements(bodyId: string): OrbitalElements | undefined {
    return this.bodyElementsMap.get(bodyId);
  }

  /**
   * Check if a specific Julian Date is within the valid range
   */
  isTimeValid(julianDate: number): boolean {
    return julianDate >= this.timeRange.startJD && julianDate <= this.timeRange.endJD;
  }

  /**
   * Get provider information for debugging
   */
  getProviderInfo(): {
    providerId: string;
    supportedBodyCount: number;
    timeRangeYears: number;
    supportsVelocity: boolean;
  } {
    const timeRangeYears = (this.timeRange.endJD - this.timeRange.startJD) / 365.25;
    
    return {
      providerId: this.providerId,
      supportedBodyCount: this.supportedBodies.length,
      timeRangeYears: Math.round(timeRangeYears),
      supportsVelocity: this.supportsVelocity()
    };
  }
}