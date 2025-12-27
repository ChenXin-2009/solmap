// Example usage of the Architecture Repair Engine
// Demonstrates how to use the repair engine to fix governance violations

import { architectureRepairEngine } from './architecture-engine';
import {
  SSOTViolation,
  LayerViolation,
  RendererViolation,
  MagicNumberViolation,
  StructuralFailure,
  ViolationType,
  ViolationSeverity,
  ArchitectureLayer,
  PhysicsConceptType,
  PhysicsConstantType,
  LayerViolationType,
  RendererIntelligenceType,
  StructuralFailureType,
  RefactoringUrgency
} from './governance-types';

/**
 * Example: Repairing SSOT violations
 * This example shows how to repair violations where physics constants
 * are defined in multiple places instead of using the authority source
 */
export async function repairSSOTViolationsExample() {
  console.log('=== SSOT Violation Repair Example ===');

  // Create a mock SSOT violation
  const ssotViolation: SSOTViolation = {
    specNumber: 'Spec-2',
    violationType: ViolationType.SSOT_VIOLATION,
    location: { file: 'src/components/Planet.tsx', line: 45, column: 12 },
    description: 'Duplicate definition of Earth axial tilt found',
    governanceReference: 'Spec-2: Physics Guardian - SSOT Enforcement',
    severity: ViolationSeverity.HIGH,
    detectedAt: new Date(),
    fixAttempts: 0,
    concept: {
      name: 'earth_axial_tilt',
      type: PhysicsConceptType.AXIAL_TILT,
      authoritySource: 'lib/astronomy/constants/axialTilt.ts',
      allowedUsagePatterns: [],
      forbiddenContexts: ['renderer']
    },
    authorityLocation: { file: 'lib/astronomy/constants/axialTilt.ts', line: 5, column: 1 },
    duplicateLocations: [
      { file: 'src/components/Planet.tsx', line: 45, column: 12 }
    ]
  };

  // Repair the violation
  const result = await architectureRepairEngine.repairSSOTViolations([ssotViolation]);

  console.log('Repair Result:', {
    success: result.success,
    repairedCount: result.repairedViolations.length,
    codeChanges: result.codeChanges.length,
    warnings: result.warnings
  });

  // Display code changes
  result.codeChanges.forEach((change, index) => {
    console.log(`Change ${index + 1}:`, {
      type: change.type,
      file: change.file,
      description: change.description
    });
  });
}

/**
 * Example: Fixing layer separation violations
 * This example shows how to repair violations where rendering layer
 * imports physics constants directly
 */
export async function repairLayerSeparationExample() {
  console.log('\n=== Layer Separation Repair Example ===');

  const layerViolation: LayerViolation = {
    specNumber: 'Spec-1',
    violationType: ViolationType.LAYER_SEPARATION_VIOLATION,
    location: { file: 'src/components/canvas/Planet.tsx', line: 3, column: 1 },
    description: 'Rendering layer importing from constants layer',
    governanceReference: 'Spec-1: Architecture Guardian - Layer Separation',
    severity: ViolationSeverity.HIGH,
    detectedAt: new Date(),
    fixAttempts: 0,
    violatingModule: 'src/components/canvas/Planet.tsx',
    targetLayer: ArchitectureLayer.CONSTANTS,
    sourceLayer: ArchitectureLayer.RENDERING,
    layerViolationType: LayerViolationType.CROSS_LAYER_IMPORT
  };

  const result = await architectureRepairEngine.fixLayerSeparation([layerViolation]);

  console.log('Layer Separation Repair Result:', {
    success: result.success,
    repairedCount: result.repairedViolations.length,
    codeChanges: result.codeChanges.length
  });
}

/**
 * Example: Stupidifying intelligent renderers
 * This example shows how to remove physics knowledge from renderers
 */
export async function stupidifyRendererExample() {
  console.log('\n=== Renderer Stupidification Example ===');

  const rendererViolation: RendererViolation = {
    specNumber: 'Spec-6',
    violationType: ViolationType.RENDERER_INTELLIGENCE,
    location: { file: 'src/components/canvas/Planet.tsx', line: 120, column: 5 },
    description: 'Renderer contains axial tilt calculations',
    governanceReference: 'Spec-6: Renderer Stupidity Principle',
    severity: ViolationSeverity.HIGH,
    detectedAt: new Date(),
    fixAttempts: 0,
    rendererModule: 'src/components/canvas/Planet.tsx',
    intelligenceType: RendererIntelligenceType.PHYSICS_KNOWLEDGE
  };

  const result = await architectureRepairEngine.stupidifyRenderer([rendererViolation]);

  console.log('Renderer Stupidification Result:', {
    success: result.success,
    repairedCount: result.repairedViolations.length,
    codeChanges: result.codeChanges.length
  });
}

/**
 * Example: Eliminating magic numbers
 * This example shows how to replace hardcoded constants with authority references
 */
export async function eliminateMagicNumbersExample() {
  console.log('\n=== Magic Number Elimination Example ===');

  const magicNumberViolation: MagicNumberViolation = {
    specNumber: 'Spec-4',
    violationType: ViolationType.MAGIC_NUMBER,
    location: { file: 'src/lib/physics/orbit.ts', line: 67, column: 25 },
    description: 'Hardcoded Earth axial tilt value',
    governanceReference: 'Spec-4: Magic Number Elimination',
    severity: ViolationSeverity.MEDIUM,
    detectedAt: new Date(),
    fixAttempts: 0,
    value: 23.44,
    suspectedType: PhysicsConstantType.AXIAL_TILT,
    suggestedSource: 'lib/astronomy/constants/axialTilt.ts',
    context: 'earth axial tilt calculation'
  };

  const result = await architectureRepairEngine.eliminateMagicNumbers([magicNumberViolation]);

  console.log('Magic Number Elimination Result:', {
    success: result.success,
    repairedCount: result.repairedViolations.length,
    codeChanges: result.codeChanges.length
  });
}

/**
 * Example: Structural refactoring for repeated failures
 * This example shows how to create a refactoring plan for structural failures
 */
export async function structuralRefactoringExample() {
  console.log('\n=== Structural Refactoring Example ===');

  const structuralFailure: StructuralFailure = {
    specNumber: 'Spec-0',
    violationType: ViolationType.STRUCTURAL_FAILURE,
    location: { file: 'src/lib/problematic/orbit.ts', line: 1, column: 1 },
    description: 'Orbital calculation has been modified 5 times',
    governanceReference: 'Spec-0: Global Constitution - Structural Failure Prevention',
    severity: ViolationSeverity.CRITICAL,
    detectedAt: new Date(),
    fixAttempts: 0,
    problemArea: 'orbital calculations',
    modificationCount: 5,
    modificationHistory: [
      {
        timestamp: new Date('2024-01-01'),
        description: 'Fixed orbital period calculation',
        author: 'developer1',
        changeType: 'bug_fix'
      },
      {
        timestamp: new Date('2024-01-15'),
        description: 'Adjusted orbital eccentricity',
        author: 'developer2',
        changeType: 'parameter_tuning'
      }
    ],
    failureType: StructuralFailureType.REPEATED_MODIFICATIONS,
    refactoringUrgency: RefactoringUrgency.IMMEDIATE
  };

  const plan = await architectureRepairEngine.triggerStructuralRefactoring([structuralFailure]);

  console.log('Structural Refactoring Plan:', {
    freezeRecommendation: plan.freezeRecommendation,
    totalSteps: plan.refactoringSteps.length,
    estimatedHours: plan.estimatedEffort.totalHours,
    riskLevel: plan.riskAssessment.overallRisk
  });

  console.log('Refactoring Steps:');
  plan.refactoringSteps.forEach((step, index) => {
    console.log(`  ${index + 1}. ${step.description} (${step.estimatedTime}h)`);
  });
}

/**
 * Example: Complete repair workflow
 * This example demonstrates a complete repair workflow with multiple violation types
 */
export async function completeRepairWorkflowExample() {
  console.log('\n=== Complete Repair Workflow Example ===');

  // Run all repair examples
  await repairSSOTViolationsExample();
  await repairLayerSeparationExample();
  await stupidifyRendererExample();
  await eliminateMagicNumbersExample();
  await structuralRefactoringExample();

  console.log('\n=== Workflow Complete ===');
  console.log('All governance violations have been analyzed and repair plans generated.');
  console.log('Next steps:');
  console.log('1. Review the proposed code changes');
  console.log('2. Apply changes incrementally');
  console.log('3. Run tests after each change');
  console.log('4. Validate architecture compliance');
  console.log('5. Monitor for new violations');
}

// Export for use in other modules
export {
  architectureRepairEngine
};

// Run examples if this file is executed directly
if (require.main === module) {
  completeRepairWorkflowExample().catch(console.error);
}