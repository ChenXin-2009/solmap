/**
 * Reference Frame Manager
 * 
 * Manages reference frame definitions and enforces Phase 1 constraints.
 * CRITICAL: Phase 1 allows exactly 1 authoritative reference frame.
 * 
 * CRITICAL: Protected by CORE_RULES.md - modifications require approval.
 */

import {
  ReferenceFrameInfo,
  SpaceTimeResult,
  SpaceTimeError
} from './types';
import {
  PRIMARY_REFERENCE_FRAME,
  ERROR_CODES
} from './constants';

/**
 * Reference Frame Manager Implementation
 * 
 * Enforces single authoritative reference frame constraint for Phase 1.
 * Manages derived display frames for render layer use only.
 */
export class ReferenceFrameManager {
  private authoritativeFrame: ReferenceFrameInfo;
  private derivedFrames: Map<string, ReferenceFrameInfo>;
  private isInitialized: boolean;

  constructor() {
    this.authoritativeFrame = PRIMARY_REFERENCE_FRAME;
    this.derivedFrames = new Map();
    this.isInitialized = true;
  }

  /**
   * Get the primary authoritative reference frame
   */
  getAuthoritativeFrame(): ReferenceFrameInfo {
    return this.authoritativeFrame;
  }

  /**
   * Get all reference frames (authoritative + derived)
   */
  getAllFrames(): ReferenceFrameInfo[] {
    return [this.authoritativeFrame, ...Array.from(this.derivedFrames.values())];
  }

  /**
   * Get reference frame by ID
   */
  getFrameById(frameId: string): SpaceTimeResult<ReferenceFrameInfo> {
    if (frameId === this.authoritativeFrame.frameId) {
      return { success: true, data: this.authoritativeFrame };
    }

    const derivedFrame = this.derivedFrames.get(frameId);
    if (derivedFrame) {
      return { success: true, data: derivedFrame };
    }

    return {
      success: false,
      error: {
        code: ERROR_CODES.INVALID_CONFIGURATION,
        message: `Reference frame not found: ${frameId}`
      }
    };
  }

  /**
   * Add a derived display frame (Render Layer only)
   * CRITICAL: Cannot add authoritative frames in Phase 1
   */
  addDerivedFrame(frame: ReferenceFrameInfo): SpaceTimeResult<void> {
    // Validate frame type
    if (frame.type === "AUTHORITATIVE") {
      return {
        success: false,
        error: {
          code: ERROR_CODES.MULTIPLE_AUTHORITATIVE_FRAMES,
          message: `Cannot add authoritative frame ${frame.frameId}. Phase 1 allows exactly 1 authoritative frame.`
        }
      };
    }

    // Validate frame structure
    const validationResult = this.validateFrameStructure(frame);
    if (!validationResult.success) {
      return validationResult;
    }

    // Check for duplicate frame ID
    if (frame.frameId === this.authoritativeFrame.frameId || this.derivedFrames.has(frame.frameId)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: `Reference frame ID already exists: ${frame.frameId}`
        }
      };
    }

    this.derivedFrames.set(frame.frameId, frame);
    return { success: true, data: undefined };
  }

  /**
   * Remove a derived display frame
   * CRITICAL: Cannot remove the authoritative frame
   */
  removeDerivedFrame(frameId: string): SpaceTimeResult<void> {
    if (frameId === this.authoritativeFrame.frameId) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.UNAUTHORIZED_ACCESS,
          message: `Cannot remove authoritative frame: ${frameId}`
        }
      };
    }

    if (!this.derivedFrames.has(frameId)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: `Derived frame not found: ${frameId}`
        }
      };
    }

    this.derivedFrames.delete(frameId);
    return { success: true, data: undefined };
  }

  /**
   * Validate Phase 1 constraints
   * CRITICAL: Ensures exactly 1 authoritative frame exists
   */
  validatePhase1Constraints(): SpaceTimeResult<void> {
    const allFrames = this.getAllFrames();
    const authoritativeFrames = allFrames.filter(frame => frame.type === "AUTHORITATIVE");

    if (authoritativeFrames.length !== 1) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.MULTIPLE_AUTHORITATIVE_FRAMES,
          message: `Phase 1 requires exactly 1 authoritative frame, found: ${authoritativeFrames.length}`
        }
      };
    }

    // Validate authoritative frame is the expected one
    if (authoritativeFrames[0].frameId !== PRIMARY_REFERENCE_FRAME.frameId) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: `Authoritative frame must be ${PRIMARY_REFERENCE_FRAME.frameId}, found: ${authoritativeFrames[0].frameId}`
        }
      };
    }

    return { success: true, data: undefined };
  }

  /**
   * Validate reference frame structure
   */
  private validateFrameStructure(frame: ReferenceFrameInfo): SpaceTimeResult<void> {
    // Check required fields
    if (!frame.frameId || typeof frame.frameId !== 'string') {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Reference frame must have a valid frameId string'
        }
      };
    }

    if (!frame.name || typeof frame.name !== 'string') {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Reference frame must have a valid name string'
        }
      };
    }

    if (!frame.origin || typeof frame.origin !== 'string') {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Reference frame must have a valid origin string'
        }
      };
    }

    if (!frame.axes || typeof frame.axes !== 'string') {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Reference frame must have a valid axes string'
        }
      };
    }

    if (frame.type !== "AUTHORITATIVE" && frame.type !== "DERIVED_DISPLAY") {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: `Invalid frame type: ${frame.type}. Must be AUTHORITATIVE or DERIVED_DISPLAY`
        }
      };
    }

    // Validate units
    if (!frame.positionUnit || typeof frame.positionUnit !== 'string') {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Reference frame must have a valid positionUnit string'
        }
      };
    }

    if (!frame.velocityUnit || typeof frame.velocityUnit !== 'string') {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Reference frame must have a valid velocityUnit string'
        }
      };
    }

    if (!frame.timeUnit || typeof frame.timeUnit !== 'string') {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONFIGURATION,
          message: 'Reference frame must have a valid timeUnit string'
        }
      };
    }

    return { success: true, data: undefined };
  }

  /**
   * Get count of authoritative frames (should always be 1 in Phase 1)
   */
  getAuthoritativeFrameCount(): number {
    const allFrames = this.getAllFrames();
    return allFrames.filter(frame => frame.type === "AUTHORITATIVE").length;
  }

  /**
   * Get count of derived frames
   */
  getDerivedFrameCount(): number {
    return this.derivedFrames.size;
  }

  /**
   * Check if a frame ID exists
   */
  hasFrame(frameId: string): boolean {
    return frameId === this.authoritativeFrame.frameId || this.derivedFrames.has(frameId);
  }

  /**
   * Get frame type by ID
   */
  getFrameType(frameId: string): SpaceTimeResult<"AUTHORITATIVE" | "DERIVED_DISPLAY"> {
    if (frameId === this.authoritativeFrame.frameId) {
      return { success: true, data: "AUTHORITATIVE" };
    }

    const derivedFrame = this.derivedFrames.get(frameId);
    if (derivedFrame) {
      return { success: true, data: "DERIVED_DISPLAY" };
    }

    return {
      success: false,
      error: {
        code: ERROR_CODES.INVALID_CONFIGURATION,
        message: `Reference frame not found: ${frameId}`
      }
    };
  }

  /**
   * Validate that a frame ID is authoritative (for Physical Layer operations)
   */
  validateAuthoritativeFrame(frameId: string): SpaceTimeResult<void> {
    if (frameId !== this.authoritativeFrame.frameId) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.UNAUTHORIZED_ACCESS,
          message: `Physical Layer operations require authoritative frame ${this.authoritativeFrame.frameId}, got: ${frameId}`
        }
      };
    }

    return { success: true, data: undefined };
  }

  /**
   * Get system information for debugging
   */
  getSystemInfo(): {
    authoritativeFrame: string;
    derivedFrameCount: number;
    totalFrameCount: number;
    phase1Compliant: boolean;
  } {
    const validation = this.validatePhase1Constraints();
    
    return {
      authoritativeFrame: this.authoritativeFrame.frameId,
      derivedFrameCount: this.derivedFrames.size,
      totalFrameCount: this.getAllFrames().length,
      phase1Compliant: validation.success
    };
  }

  /**
   * Reset to default state (for testing)
   */
  reset(): void {
    this.authoritativeFrame = PRIMARY_REFERENCE_FRAME;
    this.derivedFrames.clear();
    this.isInitialized = true;
  }
}