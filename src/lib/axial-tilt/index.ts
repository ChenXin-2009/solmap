/**
 * Axial Tilt Physics System
 * 
 * This module provides a physically correct axial tilt system for celestial bodies.
 * 
 * Core principle:
 * > Obliquity is NOT a rotation amount, but a geometric relationship.
 * > Axial tilt = angle between spin axis vector and orbital normal vector.
 * 
 * @module axial-tilt
 */

// Export all types
export * from './types';

// Export OrbitalCalculator
export { createOrbitalCalculator, orbitalCalculator } from './orbital-calculator';

// Export SpinAxisCalculator
export { createSpinAxisCalculator, spinAxisCalculator } from './spin-axis-calculator';

// Export FrameTransformer
export { createFrameTransformer, frameTransformer } from './frame-transformer';

// Export MeshOrientationManager
export {
  createMeshOrientationManager,
  meshOrientationManager,
  createMeshOrientationManagerExtended,
  type MeshOrientationManagerExtended,
} from './mesh-orientation-manager';

// Export Migration Utilities
export {
  migrateLegacyObliquity,
  migrateLegacyObliquityBatch,
  generateMigrationReport,
  validateMigration,
  type LegacyObliquityConfig,
  type MigrationResult,
} from './migration-utils';

// Export Development Warnings
export {
  DirectRotationAssignmentError,
  createRotationProxy,
  installRotationMonitoring,
  installRotationMonitoringBatch,
  analyzeCodeForRotationAntiPatterns,
  enableStrictMode,
  disableStrictMode,
  isStrictModeEnabled,
  clearWarningRegistry,
  getWarningRegistrySize,
  setupDevelopmentWarnings,
  createDevelopmentSafeMesh,
  PROBLEMATIC_ROTATION_PATTERNS,
  type DirectRotationWarning,
} from './dev-warnings';
