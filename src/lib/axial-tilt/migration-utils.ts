/**
 * Migration utilities for the Axial Tilt Physics System.
 * 
 * This module provides utilities to migrate from legacy obliquity angle
 * configurations to the new spin axis vector system.
 * 
 * @module axial-tilt/migration-utils
 * @requirements 6.4
 */

import type {
  Vector3,
  OrbitalElements,
  CelestialBodyOrientationConfig,
  RotationSense,
} from './types';
import { orbitalCalculator } from './orbital-calculator';
import { spinAxisCalculator } from './spin-axis-calculator';

// ============================================================================
// Legacy Configuration Types
// ============================================================================

/**
 * Legacy configuration that used direct obliquity angles.
 * This is what we're migrating FROM.
 */
export interface LegacyObliquityConfig {
  /** Obliquity in degrees */
  readonly obliquityDegrees: number;
  
  /** Optional rotation sense override */
  readonly rotationSense?: RotationSense;
  
  /** Optional model north axis */
  readonly modelNorthAxis?: readonly [number, number, number];
  
  /** Optional precession rate */
  readonly precessionRate?: number;
}

/**
 * Migration result containing both old and new configurations.
 */
export interface MigrationResult {
  /** Original legacy configuration */
  readonly legacy: LegacyObliquityConfig;
  
  /** New spin axis configuration */
  readonly modern: CelestialBodyOrientationConfig;
  
  /** Migration metadata */
  readonly metadata: {
    /** Whether migration was successful */
    readonly success: boolean;
    
    /** Migration timestamp */
    readonly timestamp: Date;
    
    /** Any warnings or notes */
    readonly warnings: string[];
    
    /** Computed spin axis vector components */
    readonly computedSpinAxis: readonly [number, number, number];
    
    /** Derived rotation sense */
    readonly derivedRotationSense: RotationSense;
  };
}

// ============================================================================
// Migration Functions
// ============================================================================

/**
 * Migrate legacy obliquity configuration to spin axis vector configuration.
 * 
 * This function converts old-style obliquity angle configurations to the new
 * physically correct spin axis vector system.
 * 
 * Process:
 * 1. Validate legacy configuration
 * 2. Compute orbital normal from orbital elements
 * 3. Compute spin axis from obliquity and orbital normal
 * 4. Derive rotation sense if not explicitly provided
 * 5. Create new configuration with spin axis vector
 * 
 * @param legacyConfig - Legacy configuration with obliquity in degrees
 * @param orbitalElements - Orbital elements for computing orbital normal
 * @param bodyId - Body identifier for logging/debugging
 * @returns Migration result with both old and new configurations
 * 
 * @requirements 6.4
 */
export function migrateLegacyObliquity(
  legacyConfig: LegacyObliquityConfig,
  orbitalElements: OrbitalElements,
  bodyId: string = 'unknown'
): MigrationResult {
  const warnings: string[] = [];
  const timestamp = new Date();
  
  try {
    // Validate legacy configuration
    if (legacyConfig.obliquityDegrees < 0 || legacyConfig.obliquityDegrees > 180) {
      warnings.push(`Invalid obliquity ${legacyConfig.obliquityDegrees}° for ${bodyId}. Must be in range [0, 180].`);
    }
    
    // Convert obliquity to radians
    const obliquityRadians = (legacyConfig.obliquityDegrees * Math.PI) / 180;
    
    // Derive rotation sense if not provided
    let rotationSense: RotationSense;
    if (legacyConfig.rotationSense) {
      rotationSense = legacyConfig.rotationSense;
    } else {
      // Infer from obliquity: > 90° typically means retrograde
      rotationSense = legacyConfig.obliquityDegrees > 90 ? 'retrograde' : 'prograde';
      warnings.push(`Inferred rotation sense '${rotationSense}' for ${bodyId} from obliquity ${legacyConfig.obliquityDegrees}°`);
    }
    
    // Compute orbital normal vector
    const orbitalNormal = orbitalCalculator.computeOrbitalNormal(orbitalElements);
    
    // Compute ascending node direction
    const ascendingNodeDirection = orbitalCalculator.computeAscendingNodeDirection(
      orbitalElements.longitudeOfAscendingNode
    );
    
    // Compute spin axis vector
    const spinAxisVector = spinAxisCalculator.computeSpinAxis(
      orbitalNormal,
      ascendingNodeDirection,
      obliquityRadians
    );
    
    // Create spin axis tuple
    const computedSpinAxis: readonly [number, number, number] = [
      spinAxisVector.x,
      spinAxisVector.y,
      spinAxisVector.z
    ];
    
    // Validate the computed spin axis by round-trip test
    const roundTripObliquity = spinAxisCalculator.computeObliquity(spinAxisVector, orbitalNormal);
    const roundTripDegrees = (roundTripObliquity * 180) / Math.PI;
    const obliquityError = Math.abs(roundTripDegrees - legacyConfig.obliquityDegrees);
    
    if (obliquityError > 0.1) {
      warnings.push(`Round-trip obliquity error ${obliquityError.toFixed(3)}° for ${bodyId}. Expected ${legacyConfig.obliquityDegrees}°, got ${roundTripDegrees.toFixed(3)}°`);
    }
    
    // Create modern configuration
    const modernConfig: CelestialBodyOrientationConfig = {
      spinAxis: computedSpinAxis,
      obliquityDegrees: legacyConfig.obliquityDegrees, // Keep for reference
      rotationSense,
      modelNorthAxis: legacyConfig.modelNorthAxis,
      precessionRate: legacyConfig.precessionRate,
    };
    
    return {
      legacy: legacyConfig,
      modern: modernConfig,
      metadata: {
        success: true,
        timestamp,
        warnings,
        computedSpinAxis,
        derivedRotationSense: rotationSense,
      },
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    warnings.push(`Migration failed for ${bodyId}: ${errorMessage}`);
    
    // Return a fallback configuration
    const fallbackConfig: CelestialBodyOrientationConfig = {
      obliquityDegrees: legacyConfig.obliquityDegrees,
      rotationSense: legacyConfig.rotationSense || 'prograde',
      modelNorthAxis: legacyConfig.modelNorthAxis,
      precessionRate: legacyConfig.precessionRate,
    };
    
    return {
      legacy: legacyConfig,
      modern: fallbackConfig,
      metadata: {
        success: false,
        timestamp,
        warnings,
        computedSpinAxis: [0, 0, 1], // Fallback to ecliptic normal
        derivedRotationSense: legacyConfig.rotationSense || 'prograde',
      },
    };
  }
}

/**
 * Batch migrate multiple legacy configurations.
 * 
 * @param configs - Map of body ID to legacy configuration
 * @param orbitalElementsMap - Map of body ID to orbital elements
 * @returns Map of body ID to migration result
 */
export function migrateLegacyObliquityBatch(
  configs: Record<string, LegacyObliquityConfig>,
  orbitalElementsMap: Record<string, OrbitalElements>
): Record<string, MigrationResult> {
  const results: Record<string, MigrationResult> = {};
  
  for (const [bodyId, legacyConfig] of Object.entries(configs)) {
    const orbitalElements = orbitalElementsMap[bodyId];
    if (!orbitalElements) {
      // Create a fallback result for missing orbital elements
      results[bodyId] = {
        legacy: legacyConfig,
        modern: {
          obliquityDegrees: legacyConfig.obliquityDegrees,
          rotationSense: legacyConfig.rotationSense || 'prograde',
          modelNorthAxis: legacyConfig.modelNorthAxis,
          precessionRate: legacyConfig.precessionRate,
        },
        metadata: {
          success: false,
          timestamp: new Date(),
          warnings: [`Missing orbital elements for ${bodyId}`],
          computedSpinAxis: [0, 0, 1],
          derivedRotationSense: legacyConfig.rotationSense || 'prograde',
        },
      };
      continue;
    }
    
    results[bodyId] = migrateLegacyObliquity(legacyConfig, orbitalElements, bodyId);
  }
  
  return results;
}

/**
 * Generate migration report for logging/debugging.
 * 
 * @param results - Migration results from batch migration
 * @returns Human-readable migration report
 */
export function generateMigrationReport(results: Record<string, MigrationResult>): string {
  const lines: string[] = [];
  lines.push('='.repeat(60));
  lines.push('AXIAL TILT MIGRATION REPORT');
  lines.push('='.repeat(60));
  lines.push('');
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const [bodyId, result] of Object.entries(results)) {
    if (result.metadata.success) {
      successCount++;
      lines.push(`✓ ${bodyId.toUpperCase()}`);
      lines.push(`  Legacy obliquity: ${result.legacy.obliquityDegrees}°`);
      lines.push(`  Computed spin axis: [${result.metadata.computedSpinAxis.map(x => x.toFixed(6)).join(', ')}]`);
      lines.push(`  Rotation sense: ${result.metadata.derivedRotationSense}`);
      
      if (result.metadata.warnings.length > 0) {
        lines.push(`  Warnings: ${result.metadata.warnings.length}`);
        for (const warning of result.metadata.warnings) {
          lines.push(`    - ${warning}`);
        }
      }
    } else {
      failureCount++;
      lines.push(`✗ ${bodyId.toUpperCase()} (FAILED)`);
      for (const warning of result.metadata.warnings) {
        lines.push(`    - ${warning}`);
      }
    }
    lines.push('');
  }
  
  lines.push('-'.repeat(60));
  lines.push(`Summary: ${successCount} successful, ${failureCount} failed`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('='.repeat(60));
  
  return lines.join('\n');
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate that a modern configuration is equivalent to a legacy configuration.
 * 
 * This is used to verify that migration was successful.
 * 
 * @param modern - Modern spin axis configuration
 * @param legacy - Legacy obliquity configuration
 * @param orbitalElements - Orbital elements for validation
 * @param tolerance - Tolerance for obliquity comparison (degrees)
 * @returns Validation result with any discrepancies
 */
export function validateMigration(
  modern: CelestialBodyOrientationConfig,
  legacy: LegacyObliquityConfig,
  orbitalElements: OrbitalElements,
  tolerance: number = 0.1
): { valid: boolean; discrepancies: string[] } {
  const discrepancies: string[] = [];
  
  if (!modern.spinAxis) {
    discrepancies.push('Modern configuration missing spin axis vector');
    return { valid: false, discrepancies };
  }
  
  try {
    // Compute orbital normal
    const orbitalNormal = orbitalCalculator.computeOrbitalNormal(orbitalElements);
    
    // Create spin axis vector from modern config
    const spinAxis: Vector3 = {
      x: modern.spinAxis[0],
      y: modern.spinAxis[1],
      z: modern.spinAxis[2],
    };
    
    // Compute obliquity from spin axis
    const computedObliquityRadians = spinAxisCalculator.computeObliquity(spinAxis, orbitalNormal);
    const computedObliquityDegrees = (computedObliquityRadians * 180) / Math.PI;
    
    // Compare with legacy obliquity
    const obliquityError = Math.abs(computedObliquityDegrees - legacy.obliquityDegrees);
    if (obliquityError > tolerance) {
      discrepancies.push(`Obliquity mismatch: expected ${legacy.obliquityDegrees}°, computed ${computedObliquityDegrees.toFixed(3)}° (error: ${obliquityError.toFixed(3)}°)`);
    }
    
    // Check rotation sense consistency
    const expectedRotationSense = legacy.rotationSense || (legacy.obliquityDegrees > 90 ? 'retrograde' : 'prograde');
    if (modern.rotationSense !== expectedRotationSense) {
      discrepancies.push(`Rotation sense mismatch: expected ${expectedRotationSense}, got ${modern.rotationSense}`);
    }
    
    // Check model north axis
    if (legacy.modelNorthAxis && modern.modelNorthAxis) {
      const legacyAxis = legacy.modelNorthAxis;
      const modernAxis = modern.modelNorthAxis;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(legacyAxis[i] - modernAxis[i]) > 1e-10) {
          discrepancies.push(`Model north axis mismatch at component ${i}: expected ${legacyAxis[i]}, got ${modernAxis[i]}`);
          break;
        }
      }
    }
    
    return { valid: discrepancies.length === 0, discrepancies };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    discrepancies.push(`Validation failed: ${errorMessage}`);
    return { valid: false, discrepancies };
  }
}