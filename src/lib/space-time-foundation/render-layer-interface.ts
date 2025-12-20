/**
 * Render Layer Interface Implementation
 * 
 * Provides controlled, read-only access to Space-Time Core for rendering components.
 * Enforces strict layer separation between Physical Layer (authoritative) and 
 * Render Layer (display only).
 * 
 * CRITICAL: Protected by CORE_RULES.md - modifications require approval.
 */

import {
  RenderLayerInterface,
  SpaceTimeCore,
  TimeAuthority,
  StateVector,
  BodyHierarchy,
  ReferenceFrameInfo,
  SpaceTimeResult,
  UnsubscribeFunction,
  TimeUpdateCallback
} from './interfaces';
import {
  ERROR_CODES
} from './constants';

/**
 * Render Layer Interface Implementation
 * 
 * Provides safe, controlled access to space-time data for rendering components.
 * CRITICAL: Only exposes read-only operations to prevent render layer from 
 * modifying authoritative physical state.
 */
export class RenderLayerInterfaceImpl implements RenderLayerInterface {
  private spaceTimeCore: SpaceTimeCore | null = null;
  private timeAuthority: TimeAuthority | null = null;
  private isInitialized = false;

  constructor() {
    // Initialize empty - must call initialize() before use
  }

  /**
   * Initialize the render layer interface
   * 
   * @param spaceTimeCore - The space-time core instance
   * @param timeAuthority - The time authority instance
   */
  initialize(spaceTimeCore: SpaceTimeCore, timeAuthority: TimeAuthority): SpaceTimeResult<void> {
    if (this.isInitialized) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.ALREADY_INITIALIZED,
          message: 'Render Layer Interface is already initialized'
        }
      };
    }

    if (!spaceTimeCore) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Space-Time Core is required for initialization'
        }
      };
    }

    if (!timeAuthority) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Time Authority is required for initialization'
        }
      };
    }

    this.spaceTimeCore = spaceTimeCore;
    this.timeAuthority = timeAuthority;
    this.isInitialized = true;

    return { success: true, data: undefined };
  }

  /**
   * Get read-only access to Space-Time Core
   * 
   * CRITICAL: Only exposes read-only query methods, never write operations
   */
  getSpaceTimeCore(): Pick<SpaceTimeCore, 
    'getBodyState' | 
    'getBodiesState' | 
    'getBodyHierarchy' | 
    'getReferenceFrameInfo' | 
    'getAvailableBodies'
  > {
    if (!this.isInitialized || !this.spaceTimeCore) {
      throw new Error('Render Layer Interface is not initialized');
    }

    // Return only read-only methods - write operations are forbidden
    return {
      getBodyState: (bodyId: string, julianDate?: number) => {
        const jd = julianDate ?? this.timeAuthority!.getCurrentJulianDate();
        return this.spaceTimeCore!.getBodyState(bodyId, jd);
      },
      
      getBodiesState: (bodyIds: readonly string[], julianDate?: number) => {
        const jd = julianDate ?? this.timeAuthority!.getCurrentJulianDate();
        return this.spaceTimeCore!.getBodiesState(bodyIds, jd);
      },
      
      getBodyHierarchy: (bodyId: string) => 
        this.spaceTimeCore!.getBodyHierarchy(bodyId),
      
      getReferenceFrameInfo: () => 
        this.spaceTimeCore!.getReferenceFrameInfo(),
      
      getAvailableBodies: () => 
        this.spaceTimeCore!.getAvailableBodies()
    };
  }

  /**
   * Get current time from Time Authority
   * 
   * CRITICAL: Read-only access only - render layer cannot modify time
   */
  getCurrentTime(): number {
    if (!this.isInitialized || !this.timeAuthority) {
      throw new Error('Render Layer Interface is not initialized');
    }

    return this.timeAuthority.getCurrentJulianDate();
  }

  /**
   * Subscribe to time updates
   * 
   * Allows render layer to react to time changes without modifying time
   */
  subscribeToTime(callback: TimeUpdateCallback): UnsubscribeFunction {
    if (!this.isInitialized || !this.timeAuthority) {
      throw new Error('Render Layer Interface is not initialized');
    }

    return this.timeAuthority.subscribe(callback);
  }

  /**
   * Check if the interface is initialized (for testing/debugging)
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset the interface (for testing only)
   */
  reset(): void {
    this.spaceTimeCore = null;
    this.timeAuthority = null;
    this.isInitialized = false;
  }
}

/**
 * Access Control Validator
 * 
 * Runtime validation to ensure render layer components only access
 * allowed operations and never attempt to modify physical state.
 */
export class LayerAccessValidator {
  private static readonly ALLOWED_READ_OPERATIONS = new Set([
    'getBodyState',
    'getBodiesState', 
    'getBodyHierarchy',
    'getReferenceFrameInfo',
    'getAvailableBodies',
    'getCurrentJulianDate',
    'subscribe'
  ]);

  private static readonly FORBIDDEN_WRITE_OPERATIONS = new Set([
    'registerEphemerisProvider',
    'setProviderPriority',
    'initialize',
    'setTime',
    'setTimeSpeed',
    'start',
    'stop'
  ]);

  /**
   * Validate that an operation is allowed for render layer
   */
  static validateOperation(operation: string): SpaceTimeResult<void> {
    if (this.FORBIDDEN_WRITE_OPERATIONS.has(operation)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.UNAUTHORIZED_ACCESS,
          message: `Render layer is forbidden from accessing operation '${operation}'. This is a Physical Layer only operation.`
        }
      };
    }

    if (!this.ALLOWED_READ_OPERATIONS.has(operation)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.UNAUTHORIZED_ACCESS,
          message: `Operation '${operation}' is not in the allowed read operations list for render layer.`
        }
      };
    }

    return { success: true, data: undefined };
  }

  /**
   * Create a proxy that enforces access control
   */
  static createAccessControlledProxy<T extends object>(
    target: T, 
    layerName: string
  ): T {
    return new Proxy(target, {
      get(obj: T, prop: string | symbol) {
        if (typeof prop === 'string') {
          const validation = LayerAccessValidator.validateOperation(prop);
          if (!validation.success) {
            throw new Error(`${layerName}: ${validation.error.message}`);
          }
        }
        
        const value = (obj as any)[prop];
        return typeof value === 'function' ? value.bind(obj) : value;
      },

      set(obj: T, prop: string | symbol, value: any) {
        throw new Error(`${layerName}: Direct property modification is forbidden. All state changes must go through Physical Layer.`);
      }
    });
  }

  /**
   * Get list of allowed operations for render layer
   */
  static getAllowedOperations(): readonly string[] {
    return Array.from(this.ALLOWED_READ_OPERATIONS);
  }

  /**
   * Get list of forbidden operations for render layer
   */
  static getForbiddenOperations(): readonly string[] {
    return Array.from(this.FORBIDDEN_WRITE_OPERATIONS);
  }
}

/**
 * Layer Boundary Enforcer
 * 
 * Runtime checks to ensure layer separation integrity is maintained.
 */
export class LayerBoundaryEnforcer {
  private static violationCount = 0;
  private static readonly MAX_VIOLATIONS = 10;

  /**
   * Record a layer boundary violation
   */
  static recordViolation(violation: {
    layer: string;
    operation: string;
    message: string;
    timestamp: number;
  }): void {
    this.violationCount++;
    
    console.error(`LAYER BOUNDARY VIOLATION #${this.violationCount}:`, {
      layer: violation.layer,
      operation: violation.operation,
      message: violation.message,
      timestamp: new Date(violation.timestamp).toISOString()
    });

    if (this.violationCount >= this.MAX_VIOLATIONS) {
      throw new Error(`Too many layer boundary violations (${this.violationCount}). System integrity compromised.`);
    }
  }

  /**
   * Validate layer separation at runtime
   */
  static validateLayerSeparation(
    sourceLayer: 'Physical' | 'Render',
    targetLayer: 'Physical' | 'Render',
    operation: string
  ): SpaceTimeResult<void> {
    // Render layer can only read from Physical layer
    if (sourceLayer === 'Render' && targetLayer === 'Physical') {
      const validation = LayerAccessValidator.validateOperation(operation);
      if (!validation.success) {
        this.recordViolation({
          layer: 'Render',
          operation,
          message: `Render layer attempted forbidden operation: ${operation}`,
          timestamp: Date.now()
        });
        return validation;
      }
    }

    // Physical layer can access anything (it's authoritative)
    if (sourceLayer === 'Physical') {
      return { success: true, data: undefined };
    }

    // Render-to-Render communication is allowed
    if (sourceLayer === 'Render' && targetLayer === 'Render') {
      return { success: true, data: undefined };
    }

    return { success: true, data: undefined };
  }

  /**
   * Get violation statistics
   */
  static getViolationStats(): {
    count: number;
    maxAllowed: number;
    remaining: number;
  } {
    return {
      count: this.violationCount,
      maxAllowed: this.MAX_VIOLATIONS,
      remaining: this.MAX_VIOLATIONS - this.violationCount
    };
  }

  /**
   * Reset violation count (for testing)
   */
  static resetViolations(): void {
    this.violationCount = 0;
  }
}