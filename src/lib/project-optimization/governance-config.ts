// Governance configuration management
// Based on Spec-0 to Spec-8 from .kiro/specs/solmap-ai-governance.md

import {
  GovernanceConfig,
  SSOTConfig,
  LayerSeparationConfig,
  RendererStupidityConfig,
  StructuralFailureConfig,
  ReportingConfig,
  AuthorityDefinition,
  DependencyRule,
  EnforcementLevel,
  EnforcementStrictness,
  ArchitectureLayer,
  PhysicsConceptType
} from './governance-types';

// Default governance configuration for SolMap project
export const DEFAULT_GOVERNANCE_CONFIG: GovernanceConfig = {
  enabledSpecs: ['Spec-0', 'Spec-1', 'Spec-2', 'Spec-3', 'Spec-6', 'Spec-8'],
  enforcementLevel: EnforcementLevel.STRICT,
  
  ssotConfiguration: {
    authorityDefinitions: [
      {
        concept: PhysicsConceptType.AXIAL_TILT,
        authorityFile: 'lib/astronomy/constants/axialTilt.ts',
        allowedAccessPatterns: [
          'import { * } from "lib/astronomy/constants/axialTilt"',
          'import * as AxialTilt from "lib/astronomy/constants/axialTilt"'
        ],
        forbiddenUsageContexts: ['renderer', 'components/canvas', 'lib/3d']
      },
      {
        concept: PhysicsConceptType.PHYSICAL_PARAMETER,
        authorityFile: 'lib/astronomy/constants/physicalParams.ts',
        allowedAccessPatterns: [
          'import { * } from "lib/astronomy/constants/physicalParams"',
          'import * as PhysicalParams from "lib/astronomy/constants/physicalParams"'
        ],
        forbiddenUsageContexts: ['renderer', 'components/canvas']
      },
      {
        concept: PhysicsConceptType.ROTATION_PERIOD,
        authorityFile: 'lib/astronomy/constants/rotation.ts',
        allowedAccessPatterns: [
          'import { * } from "lib/astronomy/constants/rotation"',
          'import * as Rotation from "lib/astronomy/constants/rotation"'
        ],
        forbiddenUsageContexts: ['renderer', 'components/canvas']
      },
      {
        concept: PhysicsConceptType.REFERENCE_FRAME,
        authorityFile: 'lib/astronomy/constants/referenceFrames.ts',
        allowedAccessPatterns: [
          'import { * } from "lib/astronomy/constants/referenceFrames"',
          'import * as ReferenceFrames from "lib/astronomy/constants/referenceFrames"'
        ],
        forbiddenUsageContexts: ['renderer', 'components/canvas']
      }
    ],
    allowedDuplicationExceptions: [], // No exceptions - strict SSOT
    constantsDirectoryPath: 'lib/astronomy/constants',
    enforcementStrictness: EnforcementStrictness.STRICT
  },

  layerSeparationRules: {
    layerDefinitions: [], // Will be populated by ArchitectureRegistry
    allowedCrossLayerExceptions: [], // No exceptions - strict separation
    dependencyRules: [
      {
        fromLayer: ArchitectureLayer.RENDERING,
        toLayer: ArchitectureLayer.CONSTANTS,
        allowed: false,
        exceptions: []
      },
      {
        fromLayer: ArchitectureLayer.RENDERING,
        toLayer: ArchitectureLayer.ASTRONOMY,
        allowed: false,
        exceptions: []
      },
      {
        fromLayer: ArchitectureLayer.RENDERING,
        toLayer: ArchitectureLayer.PHYSICS,
        allowed: false,
        exceptions: []
      },
      {
        fromLayer: ArchitectureLayer.RENDERING,
        toLayer: ArchitectureLayer.INFRASTRUCTURE,
        allowed: true,
        exceptions: []
      },
      {
        fromLayer: ArchitectureLayer.PHYSICS,
        toLayer: ArchitectureLayer.CONSTANTS,
        allowed: true,
        exceptions: []
      },
      {
        fromLayer: ArchitectureLayer.PHYSICS,
        toLayer: ArchitectureLayer.ASTRONOMY,
        allowed: true,
        exceptions: []
      },
      {
        fromLayer: ArchitectureLayer.ASTRONOMY,
        toLayer: ArchitectureLayer.CONSTANTS,
        allowed: true,
        exceptions: []
      }
    ]
  },

  rendererStupidityRules: {
    rendererPatterns: [
      'src/components/canvas/**',
      'src/lib/3d/**',
      '**/*render*',
      '**/*Render*',
      '**/*canvas*',
      '**/*Canvas*'
    ],
    allowedInputTypes: [
      'positionVector',
      'attitudeMatrix',
      'quaternion',
      'visualParams',
      'color',
      'opacity',
      'scale',
      'texture'
    ],
    forbiddenImportPatterns: [
      'lib/astronomy/constants/**',
      'lib/astronomy/**',
      'lib/physics/**',
      'lib/axial-tilt/**'
    ],
    allowedComputationTypes: [
      'matrix_multiplication',
      'vector_transformation',
      'color_interpolation',
      'texture_mapping'
    ]
  },

  structuralFailureThresholds: {
    modificationThreshold: 3, // Spec-0: ≥3 modifications = structural failure
    instabilityThreshold: 0.7, // 70% test/visual instability
    parameterTuningThreshold: 5, // 5+ parameter changes
    monitoringPeriod: 30 // 30 days
  },

  reportingConfig: {
    outputFormat: 'json',
    includeCodeExamples: true,
    detailLevel: 'detailed',
    autoGenerate: true,
    recipients: []
  }
};

// Configuration validation
export function validateGovernanceConfig(config: GovernanceConfig): string[] {
  const errors: string[] = [];

  // Check enabled specs
  if (!config.enabledSpecs.includes('Spec-0')) {
    errors.push('Spec-0 (最高约束) must always be enabled');
  }

  // Check SSOT configuration
  if (config.ssotConfiguration.authorityDefinitions.length === 0) {
    errors.push('At least one authority definition must be specified');
  }

  // Check structural failure thresholds
  if (config.structuralFailureThresholds.modificationThreshold < 3) {
    errors.push('Modification threshold must be at least 3 (per Spec-0)');
  }

  // Check renderer stupidity rules
  if (config.rendererStupidityRules.rendererPatterns.length === 0) {
    errors.push('Renderer patterns must be specified');
  }

  return errors;
}

// Load configuration from file or use defaults
export async function loadGovernanceConfig(projectPath?: string): Promise<GovernanceConfig> {
  // In a real implementation, this would load from a config file
  // For now, return the default configuration
  return DEFAULT_GOVERNANCE_CONFIG;
}

// Save configuration to file
export async function saveGovernanceConfig(
  config: GovernanceConfig,
  projectPath: string
): Promise<void> {
  // In a real implementation, this would save to a config file
  // For now, just validate the configuration
  const errors = validateGovernanceConfig(config);
  if (errors.length > 0) {
    throw new Error(`Invalid governance configuration: ${errors.join(', ')}`);
  }
}

// Merge configurations (for overrides)
export function mergeGovernanceConfigs(
  base: GovernanceConfig,
  override: Partial<GovernanceConfig>
): GovernanceConfig {
  return {
    ...base,
    ...override,
    ssotConfiguration: {
      ...base.ssotConfiguration,
      ...override.ssotConfiguration
    },
    layerSeparationRules: {
      ...base.layerSeparationRules,
      ...override.layerSeparationRules
    },
    rendererStupidityRules: {
      ...base.rendererStupidityRules,
      ...override.rendererStupidityRules
    },
    structuralFailureThresholds: {
      ...base.structuralFailureThresholds,
      ...override.structuralFailureThresholds
    },
    reportingConfig: {
      ...base.reportingConfig,
      ...override.reportingConfig
    }
  };
}