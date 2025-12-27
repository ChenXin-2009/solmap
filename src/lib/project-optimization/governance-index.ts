// Governance compliance modules - separate export to avoid conflicts
export * from './governance-types';
export * from './governance-interfaces';
export * from './governance-core';
export * from './governance-config';

// Re-export specific types to avoid conflicts
export type {
  GovernanceSpec,
  SpecViolation,
  PhysicsConcept,
  GovernanceAnalysis,
  SSOTViolation,
  LayerViolation,
  RendererViolation,
  MagicNumberViolation,
  StructuralFailure,
  ConstantsPollution,
  GovernanceConfig
} from './governance-types';

export type {
  GovernanceAnalyzer,
  SSOTViolationDetector,
  LayerSeparationValidator,
  RendererStupidityChecker,
  MagicNumberDetector,
  StructuralFailureDetector,
  ArchitectureRepairEngine,
  AIPreCommitChecker,
  GovernanceEducator,
  GovernanceMonitor
} from './governance-interfaces';

export {
  GovernanceSpecImpl,
  PhysicsConceptRegistry,
  ArchitectureRegistry,
  ViolationSeverityCalculator,
  GovernanceSpecLoader,
  createSourceLocation,
  isPhysicsConstantFile,
  isRendererFile,
  getModuleLayer
} from './governance-core';

export {
  DEFAULT_GOVERNANCE_CONFIG,
  validateGovernanceConfig,
  loadGovernanceConfig,
  saveGovernanceConfig,
  mergeGovernanceConfigs
} from './governance-config';