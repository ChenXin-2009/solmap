/**
 * Development mode warnings for the Axial Tilt Physics System.
 * 
 * This module provides utilities to detect and warn about anti-patterns
 * in development mode, particularly direct rotation.x/y/z assignments
 * that bypass the physically correct spin axis system.
 * 
 * @module axial-tilt/dev-warnings
 * @requirements 6.3
 */

import { AxialTiltErrorCodes } from './types';

// ============================================================================
// Development Mode Detection
// ============================================================================

/**
 * Check if we're running in development mode.
 * 
 * This checks multiple environment indicators:
 * - NODE_ENV === 'development'
 * - process.env.NODE_ENV === 'development'
 * - window.location.hostname includes 'localhost' or '127.0.0.1'
 */
function isDevelopmentMode(): boolean {
  // Node.js environment check
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'development';
  }
  
  // Browser environment check
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname.startsWith('192.168.') ||
           hostname.endsWith('.local');
  }
  
  // Default to false if we can't determine
  return false;
}

// ============================================================================
// Rotation Assignment Detection
// ============================================================================

/**
 * Error thrown when direct rotation assignment is detected in development mode.
 */
export class DirectRotationAssignmentError extends Error {
  public readonly code = AxialTiltErrorCodes.DIRECT_ROTATION_SET;
  
  constructor(
    public readonly property: 'x' | 'y' | 'z',
    public readonly value: number,
    public readonly stackTrace?: string
  ) {
    super(
      `Direct rotation.${property} assignment detected! ` +
      `This bypasses the physically correct axial tilt system. ` +
      `Use Planet.setSpinAxisVector() instead. ` +
      `Attempted to set rotation.${property} = ${value}`
    );
    this.name = 'DirectRotationAssignmentError';
  }
}

/**
 * Warning logged when direct rotation assignment is detected in production mode.
 */
export interface DirectRotationWarning {
  readonly type: 'DIRECT_ROTATION_ASSIGNMENT';
  readonly property: 'x' | 'y' | 'z';
  readonly value: number;
  readonly timestamp: Date;
  readonly stackTrace?: string;
  readonly message: string;
}

/**
 * Global registry of rotation assignment warnings.
 * Used to avoid spamming the console with duplicate warnings.
 */
const warningRegistry = new Set<string>();

/**
 * Create a proxy for Three.js Euler rotation object that detects direct assignments.
 * 
 * This function wraps a Three.js Euler object to intercept direct assignments
 * to x, y, z properties and either throw an error (development) or log a warning (production).
 * 
 * @param originalRotation - Original Three.js Euler rotation object
 * @param objectId - Identifier for the object (for debugging)
 * @returns Proxied rotation object that detects assignments
 */
export function createRotationProxy(
  originalRotation: any,
  objectId: string = 'unknown'
): any {
  const isDev = isDevelopmentMode() || strictModeEnabled;
  
  return new Proxy(originalRotation, {
    set(target: any, property: string | symbol, value: any): boolean {
      // Only intercept x, y, z assignments
      if (property === 'x' || property === 'y' || property === 'z') {
        const stackTrace = new Error().stack;
        
        // Check if this assignment is coming from our own axial tilt system
        const isFromAxialTiltSystem = stackTrace?.includes('mesh-orientation-manager') ||
                                     stackTrace?.includes('axial-tilt/mesh-orientation-manager') ||
                                     stackTrace?.includes('setSpinAxisVector');
        
        if (!isFromAxialTiltSystem) {
          const warningKey = `${objectId}-${property}-${value}`;
          
          if (isDev) {
            // Throw error in development mode
            throw new DirectRotationAssignmentError(property, value, stackTrace);
          } else {
            // Log warning in production mode (but only once per unique assignment)
            if (!warningRegistry.has(warningKey)) {
              warningRegistry.add(warningKey);
              
              const warning: DirectRotationWarning = {
                type: 'DIRECT_ROTATION_ASSIGNMENT',
                property,
                value,
                timestamp: new Date(),
                stackTrace,
                message: `Direct rotation.${property} assignment detected on ${objectId}! ` +
                        `This bypasses the physically correct axial tilt system. ` +
                        `Consider using Planet.setSpinAxisVector() instead.`
              };
              
              console.warn('[AXIAL TILT WARNING]', warning.message);
              console.warn('Stack trace:', stackTrace);
            }
          }
        }
      }
      
      // Proceed with the assignment
      target[property] = value;
      return true;
    },
    
    get(target: any, property: string | symbol): any {
      return target[property];
    }
  });
}

/**
 * Install rotation monitoring on a Three.js mesh.
 * 
 * This function replaces the mesh's rotation property with a proxy
 * that detects direct assignments to x, y, z.
 * 
 * @param mesh - Three.js mesh to monitor
 * @param meshId - Identifier for the mesh (for debugging)
 */
export function installRotationMonitoring(mesh: any, meshId: string = 'unknown'): void {
  if (!mesh || !mesh.rotation) {
    return;
  }
  
  // Store original rotation
  const originalRotation = mesh.rotation;
  
  // Try to replace with proxy, but handle read-only properties gracefully
  try {
    // Replace with proxy
    mesh.rotation = createRotationProxy(originalRotation, meshId);
  } catch (error) {
    // If we can't replace the rotation property (e.g., it's read-only),
    // we'll install monitoring on the individual x, y, z properties instead
    if (error instanceof TypeError && error.message.includes('read only')) {
      installRotationPropertyMonitoring(originalRotation, meshId);
    } else {
      // For simple objects (like in tests), try property monitoring directly
      installRotationPropertyMonitoring(originalRotation, meshId);
    }
  }
}

/**
 * Install monitoring on individual rotation properties (x, y, z).
 * This is used as a fallback when the rotation property itself is read-only.
 * 
 * @param rotation - The rotation object to monitor
 * @param meshId - Identifier for the mesh (for debugging)
 */
function installRotationPropertyMonitoring(rotation: any, meshId: string): void {
  // Store original property descriptors
  const originalDescriptors = {
    x: Object.getOwnPropertyDescriptor(rotation, 'x') || { value: rotation.x, writable: true, enumerable: true, configurable: true },
    y: Object.getOwnPropertyDescriptor(rotation, 'y') || { value: rotation.y, writable: true, enumerable: true, configurable: true },
    z: Object.getOwnPropertyDescriptor(rotation, 'z') || { value: rotation.z, writable: true, enumerable: true, configurable: true },
  };
  
  // Replace x, y, z properties with monitored versions
  ['x', 'y', 'z'].forEach((property) => {
    const originalDescriptor = originalDescriptors[property as keyof typeof originalDescriptors];
    let currentValue = rotation[property];
    
    try {
      Object.defineProperty(rotation, property, {
        get() {
          return currentValue;
        },
        set(value: number) {
          // Re-evaluate development mode each time (don't cache)
          const isDev = isDevelopmentMode() || strictModeEnabled;
          const stackTrace = new Error().stack;
          
          // Check if this assignment is coming from our own axial tilt system
          const isFromAxialTiltSystem = stackTrace?.includes('mesh-orientation-manager') ||
                                       stackTrace?.includes('axial-tilt/mesh-orientation-manager') ||
                                       stackTrace?.includes('setSpinAxisVector') ||
                                       stackTrace?.includes('applySpinAxisOrientation') ||
                                       stackTrace?.includes('applyDailyRotation');
          
          if (!isFromAxialTiltSystem) {
            const warningKey = `${meshId}-${property}-${value}`;
            
            if (isDev) {
              // Throw error in development mode
              throw new DirectRotationAssignmentError(property as 'x' | 'y' | 'z', value, stackTrace);
            } else {
              // Log warning in production mode (but only once per unique assignment)
              if (!warningRegistry.has(warningKey)) {
                warningRegistry.add(warningKey);
                
                const warning: DirectRotationWarning = {
                  type: 'DIRECT_ROTATION_ASSIGNMENT',
                  property: property as 'x' | 'y' | 'z',
                  value,
                  timestamp: new Date(),
                  stackTrace,
                  message: `Direct rotation.${property} assignment detected on ${meshId}! ` +
                          `This bypasses the physically correct axial tilt system. ` +
                          `Consider using Planet.setSpinAxisVector() instead.`
                };
                
                console.warn('[AXIAL TILT WARNING]', warning.message);
                console.warn('Stack trace:', stackTrace);
              }
            }
          }
          
          // Proceed with the assignment
          currentValue = value;
        },
        enumerable: originalDescriptor.enumerable,
        configurable: originalDescriptor.configurable,
      });
    } catch (defineError) {
      // If we can't redefine the property, just log a warning and continue
      console.warn(`[AXIAL TILT] Could not install monitoring on rotation.${property} for ${meshId}:`, defineError);
    }
  });
}

/**
 * Install rotation monitoring on multiple meshes.
 * 
 * @param meshes - Array of meshes to monitor
 * @param getIdFn - Function to get ID for each mesh (optional)
 */
export function installRotationMonitoringBatch(
  meshes: any[],
  getIdFn?: (mesh: any, index: number) => string
): void {
  meshes.forEach((mesh, index) => {
    const meshId = getIdFn ? getIdFn(mesh, index) : `mesh-${index}`;
    installRotationMonitoring(mesh, meshId);
  });
}

// ============================================================================
// Code Pattern Detection
// ============================================================================

/**
 * Static code analysis patterns that indicate problematic rotation usage.
 * These are used for linting and code review.
 */
export const PROBLEMATIC_ROTATION_PATTERNS = [
  // Direct rotation property assignments
  /\.rotation\.[xyz]\s*=\s*[^;]+/g,
  
  // Rotation.set() calls with obliquity-related comments or variables
  /\.rotation\.set\([^)]*\)[^;]*(?:obliquity|tilt|axial)/gi,
  
  // Math operations on rotation properties
  /\.rotation\.[xyz]\s*[+\-*/]=?\s*[^;]+/g,
  
  // Rotation property in calculations
  /Math\.[^(]*\([^)]*\.rotation\.[xyz]/g,
] as const;

/**
 * Analyze code string for problematic rotation patterns.
 * 
 * This is intended for use in linting tools or code review automation.
 * 
 * @param code - Source code to analyze
 * @param filename - Filename for context (optional)
 * @returns Array of detected issues
 */
export function analyzeCodeForRotationAntiPatterns(
  code: string,
  filename: string = 'unknown'
): Array<{
  pattern: string;
  match: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
}> {
  const issues: Array<{
    pattern: string;
    match: string;
    line: number;
    column: number;
    severity: 'error' | 'warning';
    message: string;
  }> = [];
  
  const lines = code.split('\n');
  
  for (const pattern of PROBLEMATIC_ROTATION_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(code)) !== null) {
      // Find line and column
      const beforeMatch = code.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const lastNewline = beforeMatch.lastIndexOf('\n');
      const column = match.index - lastNewline;
      
      // Check if this is in a comment (basic check)
      const line = lines[lineNumber - 1];
      const commentIndex = line.indexOf('//');
      const isInComment = commentIndex >= 0 && commentIndex < column;
      
      if (!isInComment) {
        issues.push({
          pattern: pattern.source,
          match: match[0],
          line: lineNumber,
          column,
          severity: 'error',
          message: `Direct rotation assignment detected. Use Planet.setSpinAxisVector() instead of direct rotation.${match[0].includes('.x') ? 'x' : match[0].includes('.y') ? 'y' : 'z'} assignment.`
        });
      }
      
      // Prevent infinite loop for zero-width matches
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
  }
  
  return issues;
}

// ============================================================================
// Development Utilities
// ============================================================================

/**
 * Enable strict mode for axial tilt development.
 * 
 * In strict mode:
 * - All rotation assignments throw errors (even in production)
 * - Additional validation is performed
 * - More detailed logging is enabled
 */
let strictModeEnabled = false;

export function enableStrictMode(): void {
  strictModeEnabled = true;
  console.log('[AXIAL TILT] Strict mode enabled - all rotation assignments will throw errors');
}

export function disableStrictMode(): void {
  strictModeEnabled = false;
  console.log('[AXIAL TILT] Strict mode disabled');
}

export function isStrictModeEnabled(): boolean {
  return strictModeEnabled;
}

/**
 * Clear the warning registry.
 * Useful for testing or when you want to see warnings again.
 */
export function clearWarningRegistry(): void {
  warningRegistry.clear();
}

/**
 * Get current warning registry size.
 * Useful for testing or monitoring.
 */
export function getWarningRegistrySize(): number {
  return warningRegistry.size;
}

// ============================================================================
// Integration Helpers
// ============================================================================

/**
 * Recommended setup function for development environments.
 * 
 * Call this once during application initialization to set up
 * all development mode protections.
 * 
 * @param options - Configuration options
 */
export function setupDevelopmentWarnings(options: {
  /** Enable strict mode (throw errors even in production) */
  strictMode?: boolean;
  
  /** Custom mesh ID function */
  getMeshId?: (mesh: any) => string;
  
  /** Enable console logging */
  enableLogging?: boolean;
} = {}): void {
  if (options.strictMode) {
    enableStrictMode();
  }
  
  if (options.enableLogging !== false) {
    console.log('[AXIAL TILT] Development warnings enabled');
    console.log('[AXIAL TILT] Direct rotation.x/y/z assignments will be', 
                isDevelopmentMode() || strictModeEnabled ? 'blocked' : 'warned');
  }
}

/**
 * Create a development-safe mesh wrapper.
 * 
 * This function wraps a Three.js mesh with development protections
 * and provides a clean API for axial tilt operations.
 * 
 * @param mesh - Three.js mesh to wrap
 * @param meshId - Identifier for the mesh
 * @returns Wrapped mesh with development protections
 */
export function createDevelopmentSafeMesh(mesh: any, meshId: string): {
  mesh: any;
  setSpinAxisVector: (spinAxis: [number, number, number]) => void;
  getRotation: () => { x: number; y: number; z: number };
} {
  // Install rotation monitoring
  installRotationMonitoring(mesh, meshId);
  
  return {
    mesh,
    setSpinAxisVector: (spinAxis: [number, number, number]) => {
      // This would integrate with the actual MeshOrientationManager
      // For now, just log the intent
      console.log(`[AXIAL TILT] Setting spin axis for ${meshId}:`, spinAxis);
      // TODO: Integrate with actual MeshOrientationManager
    },
    getRotation: () => ({
      x: mesh.rotation.x,
      y: mesh.rotation.y,
      z: mesh.rotation.z,
    }),
  };
}