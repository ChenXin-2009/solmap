// Configuration management for project optimization
import { OptimizationConfig, OptimizationRule, OptimizationThresholds, OptimizationType, RuleSeverity } from './types';

export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  enabled: true,
  rules: [
    {
      name: 'duplicate-code-detection',
      type: OptimizationType.DUPLICATION_REMOVAL,
      severity: RuleSeverity.WARNING,
      parameters: {
        minSimilarity: 0.8,
        minLines: 5,
        ignoreComments: true,
        ignoreWhitespace: true
      }
    },
    {
      name: 'dead-code-elimination',
      type: OptimizationType.DEAD_CODE_ELIMINATION,
      severity: RuleSeverity.INFO,
      parameters: {
        removeUnusedImports: true,
        removeUnusedVariables: true,
        removeTodoComments: false,
        removeDebugCode: true
      }
    },
    {
      name: 'performance-optimization',
      type: OptimizationType.PERFORMANCE_OPTIMIZATION,
      severity: RuleSeverity.ERROR,
      parameters: {
        detectMemoryLeaks: true,
        optimizeThreeJS: true,
        optimizeRenderLoop: true,
        checkAsyncOperations: true
      }
    },
    {
      name: 'architecture-improvement',
      type: OptimizationType.ARCHITECTURE_IMPROVEMENT,
      severity: RuleSeverity.WARNING,
      parameters: {
        enforceLayerSeparation: true,
        checkDependencyDirection: true,
        validateInterfaces: true,
        checkNamingConventions: true
      }
    },
    {
      name: 'configuration-standardization',
      type: OptimizationType.CONFIGURATION_STANDARDIZATION,
      severity: RuleSeverity.INFO,
      parameters: {
        extractHardcodedValues: true,
        mergeConfigurations: true,
        standardizeImports: true,
        consolidateTypes: true
      }
    }
  ],
  thresholds: {
    duplicationSimilarity: 0.8,
    complexityLimit: 10,
    fileSizeLimit: 500,
    functionLengthLimit: 50
  },
  exclusions: [
    'node_modules/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    'dist/**',
    'build/**',
    '.next/**',
    'coverage/**'
  ]
};

export const OPTIMIZATION_THRESHOLDS: OptimizationThresholds = {
  duplicationSimilarity: 0.8,
  complexityLimit: 10,
  fileSizeLimit: 500,
  functionLengthLimit: 50
};

export function createOptimizationConfig(overrides: Partial<OptimizationConfig> = {}): OptimizationConfig {
  return {
    ...DEFAULT_OPTIMIZATION_CONFIG,
    ...overrides,
    rules: overrides.rules || DEFAULT_OPTIMIZATION_CONFIG.rules,
    thresholds: {
      ...DEFAULT_OPTIMIZATION_CONFIG.thresholds,
      ...overrides.thresholds
    },
    exclusions: overrides.exclusions || DEFAULT_OPTIMIZATION_CONFIG.exclusions
  };
}

export function validateOptimizationConfig(config: OptimizationConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.rules || config.rules.length === 0) {
    errors.push('Configuration must have at least one optimization rule');
  }

  if (config.thresholds.duplicationSimilarity < 0 || config.thresholds.duplicationSimilarity > 1) {
    errors.push('Duplication similarity threshold must be between 0 and 1');
  }

  if (config.thresholds.complexityLimit < 1) {
    errors.push('Complexity limit must be greater than 0');
  }

  if (config.thresholds.fileSizeLimit < 1) {
    errors.push('File size limit must be greater than 0');
  }

  if (config.thresholds.functionLengthLimit < 1) {
    errors.push('Function length limit must be greater than 0');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}