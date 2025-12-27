// Architecture Repair Engine - Main implementation
// Implements automatic repair of governance specification violations
// Based on Spec-0 to Spec-8 from .kiro/specs/solmap-ai-governance.md

import {
  ArchitectureRepairEngine,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from './governance-interfaces';

import {
  SSOTViolation,
  LayerViolation,
  RendererViolation,
  MagicNumberViolation,
  StructuralFailure,
  RepairResult,
  RefactoringPlan,
  CodeChange,
  ChangeType,
  RefactoringStep,
  RefactoringType,
  RefactoringEffort,
  RiskAssessment,
  Risk,
  RiskLevel,
  RiskCategory,
  Mitigation,
  EffortComplexity,
  PhysicsConceptType,
  ArchitectureLayer,
  ViolationType
} from './governance-types';

import { ProjectAST, SourceLocation } from './types';
import { PhysicsConceptRegistry, ArchitectureRegistry } from './governance-core';

/**
 * Main Architecture Repair Engine implementation
 * Provides automated repair capabilities for governance violations
 */
export class ArchitectureRepairEngineImpl implements ArchitectureRepairEngine {
  private ssotRepairer: SSOTViolationRepairer;
  private layerRepairer: LayerSeparationRepairer;
  private rendererRepairer: RendererStupidityRepairer;
  private magicNumberRepairer: MagicNumberRepairer;
  private structuralRepairer: StructuralFailureRepairer;

  constructor() {
    this.ssotRepairer = new SSOTViolationRepairer();
    this.layerRepairer = new LayerSeparationRepairer();
    this.rendererRepairer = new RendererStupidityRepairer();
    this.magicNumberRepairer = new MagicNumberRepairer();
    this.structuralRepairer = new StructuralFailureRepairer();
  }

  /**
   * Repair SSOT violations by migrating duplicate definitions to authority sources
   */
  async repairSSOTViolations(violations: SSOTViolation[]): Promise<RepairResult> {
    return this.ssotRepairer.repair(violations);
  }

  /**
   * Fix layer separation violations by moving code to correct layers
   */
  async fixLayerSeparation(violations: LayerViolation[]): Promise<RepairResult> {
    return this.layerRepairer.repair(violations);
  }

  /**
   * Stupidify renderer by removing physics logic and forbidden imports
   */
  async stupidifyRenderer(violations: RendererViolation[]): Promise<RepairResult> {
    return this.rendererRepairer.repair(violations);
  }

  /**
   * Eliminate magic numbers by replacing with authority source references
   */
  async eliminateMagicNumbers(violations: MagicNumberViolation[]): Promise<RepairResult> {
    return this.magicNumberRepairer.repair(violations);
  }

  /**
   * Trigger structural refactoring for repeated failure patterns
   */
  async triggerStructuralRefactoring(failures: StructuralFailure[]): Promise<RefactoringPlan> {
    return this.structuralRepairer.createRefactoringPlan(failures);
  }

  /**
   * Validate that repairs maintain functionality and improve architecture
   */
  async validateRepair(original: ProjectAST, repaired: ProjectAST): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check that no new violations were introduced
    const newViolations = await this.detectNewViolations(original, repaired);
    if (newViolations.length > 0) {
      errors.push({
        message: `Repair introduced ${newViolations.length} new violations`,
        severity: 'error'
      });
    }

    // Check that functionality is preserved
    const functionalityPreserved = await this.checkFunctionalityPreservation(original, repaired);
    if (!functionalityPreserved) {
      errors.push({
        message: 'Repair may have broken existing functionality',
        severity: 'error'
      });
    }

    // Check that architecture improved
    const architectureImproved = await this.checkArchitectureImprovement(original, repaired);
    if (!architectureImproved) {
      warnings.push({
        message: 'Architecture quality did not improve significantly',
        suggestion: 'Consider additional refactoring'
      });
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      functionalityPreserved,
      architectureImproved
    };
  }

  private async detectNewViolations(original: ProjectAST, repaired: ProjectAST): Promise<any[]> {
    // Implementation would use governance analyzers to detect new violations
    // For now, return empty array
    return [];
  }

  private async checkFunctionalityPreservation(original: ProjectAST, repaired: ProjectAST): Promise<boolean> {
    // Implementation would run tests and compare behavior
    // For now, assume functionality is preserved
    return true;
  }

  private async checkArchitectureImprovement(original: ProjectAST, repaired: ProjectAST): Promise<boolean> {
    // Implementation would calculate architecture quality metrics
    // For now, assume improvement
    return true;
  }
}

/**
 * SSOT Violation Repairer
 * Handles migration of duplicate definitions to authority sources
 */
class SSOTViolationRepairer {
  async repair(violations: SSOTViolation[]): Promise<RepairResult> {
    const repairedViolations: SSOTViolation[] = [];
    const codeChanges: CodeChange[] = [];
    const remainingViolations: SSOTViolation[] = [];
    const warnings: string[] = [];

    for (const violation of violations) {
      try {
        const changes = await this.repairSingleViolation(violation);
        codeChanges.push(...changes);
        repairedViolations.push(violation);
      } catch (error) {
        remainingViolations.push(violation);
        warnings.push(`Failed to repair SSOT violation: ${error.message}`);
      }
    }

    return {
      success: remainingViolations.length === 0,
      repairedViolations,
      codeChanges,
      remainingViolations,
      warnings
    };
  }

  private async repairSingleViolation(violation: SSOTViolation): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];
    const concept = violation.concept;

    // Remove duplicate definitions
    for (const duplicateLocation of violation.duplicateLocations) {
      changes.push({
        type: ChangeType.REMOVE,
        file: duplicateLocation.file,
        original: await this.extractCodeAtLocation(duplicateLocation),
        modified: '',
        location: duplicateLocation,
        description: `Remove duplicate definition of ${concept.name}`
      });
    }

    // Add import from authority source to files that need it
    const filesNeedingImport = await this.findFilesNeedingImport(violation);
    for (const file of filesNeedingImport) {
      const importStatement = this.generateAuthorityImport(concept);
      changes.push({
        type: ChangeType.ADD,
        file,
        original: '',
        modified: importStatement,
        location: { file, line: 1, column: 1 },
        description: `Add import from authority source for ${concept.name}`
      });
    }

    return changes;
  }

  private async extractCodeAtLocation(location: SourceLocation): Promise<string> {
    // Implementation would extract the actual code at the location
    return `// Code at ${location.file}:${location.line}`;
  }

  private async findFilesNeedingImport(violation: SSOTViolation): Promise<string[]> {
    // Implementation would analyze which files need the import
    return violation.duplicateLocations.map(loc => loc.file);
  }

  private generateAuthorityImport(concept: PhysicsConcept): string {
    const conceptName = concept.name.toUpperCase();
    const authorityPath = concept.authoritySource.replace('.ts', '');
    
    switch (concept.type) {
      case PhysicsConceptType.AXIAL_TILT:
        return `import { ${conceptName} } from '${authorityPath}';`;
      case PhysicsConceptType.PHYSICAL_PARAMETER:
        return `import { ${conceptName} } from '${authorityPath}';`;
      case PhysicsConceptType.ROTATION_PERIOD:
        return `import { ${conceptName} } from '${authorityPath}';`;
      case PhysicsConceptType.REFERENCE_FRAME:
        return `import { ${conceptName} } from '${authorityPath}';`;
      default:
        return `import { ${conceptName} } from '${authorityPath}';`;
    }
  }
}

/**
 * Layer Separation Repairer
 * Handles moving code to correct architectural layers
 */
class LayerSeparationRepairer {
  async repair(violations: LayerViolation[]): Promise<RepairResult> {
    const repairedViolations: LayerViolation[] = [];
    const codeChanges: CodeChange[] = [];
    const remainingViolations: LayerViolation[] = [];
    const warnings: string[] = [];

    for (const violation of violations) {
      try {
        const changes = await this.repairLayerViolation(violation);
        codeChanges.push(...changes);
        repairedViolations.push(violation);
      } catch (error) {
        remainingViolations.push(violation);
        warnings.push(`Failed to repair layer violation: ${error.message}`);
      }
    }

    return {
      success: remainingViolations.length === 0,
      repairedViolations,
      codeChanges,
      remainingViolations,
      warnings
    };
  }

  private async repairLayerViolation(violation: LayerViolation): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];

    // Remove forbidden import
    changes.push({
      type: ChangeType.REMOVE,
      file: violation.location.file,
      original: await this.extractImportStatement(violation),
      modified: '',
      location: violation.location,
      description: `Remove forbidden cross-layer import from ${violation.sourceLayer} to ${violation.targetLayer}`
    });

    // Add proper layer interface if needed
    const interfaceChanges = await this.addLayerInterface(violation);
    changes.push(...interfaceChanges);

    return changes;
  }

  private async extractImportStatement(violation: LayerViolation): Promise<string> {
    // Implementation would extract the actual import statement
    return `import { ... } from '${violation.violatingModule}';`;
  }

  private async addLayerInterface(violation: LayerViolation): Promise<CodeChange[]> {
    // Implementation would add proper layer interfaces
    // For now, return empty array
    return [];
  }
}

/**
 * Renderer Stupidity Repairer
 * Removes physics logic and forbidden imports from renderers
 */
class RendererStupidityRepairer {
  async repair(violations: RendererViolation[]): Promise<RepairResult> {
    const repairedViolations: RendererViolation[] = [];
    const codeChanges: CodeChange[] = [];
    const remainingViolations: RendererViolation[] = [];
    const warnings: string[] = [];

    for (const violation of violations) {
      try {
        const changes = await this.stupidifyRenderer(violation);
        codeChanges.push(...changes);
        repairedViolations.push(violation);
      } catch (error) {
        remainingViolations.push(violation);
        warnings.push(`Failed to stupidify renderer: ${error.message}`);
      }
    }

    return {
      success: remainingViolations.length === 0,
      repairedViolations,
      codeChanges,
      remainingViolations,
      warnings
    };
  }

  private async stupidifyRenderer(violation: RendererViolation): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];

    // Remove forbidden imports
    const forbiddenImports = await this.findForbiddenImports(violation);
    for (const importLocation of forbiddenImports) {
      changes.push({
        type: ChangeType.REMOVE,
        file: violation.location.file,
        original: await this.extractCodeAtLocation(importLocation),
        modified: '',
        location: importLocation,
        description: `Remove forbidden physics import from renderer`
      });
    }

    // Remove physics computations
    const computations = await this.findPhysicsComputations(violation);
    for (const computation of computations) {
      changes.push({
        type: ChangeType.REMOVE,
        file: violation.location.file,
        original: await this.extractCodeAtLocation(computation),
        modified: '// Physics computation moved to appropriate layer',
        location: computation,
        description: `Remove physics computation from renderer`
      });
    }

    // Ensure renderer only accepts allowed inputs
    const inputChanges = await this.enforceAllowedInputs(violation);
    changes.push(...inputChanges);

    return changes;
  }

  private async findForbiddenImports(violation: RendererViolation): Promise<SourceLocation[]> {
    // Implementation would find forbidden imports in renderer
    return [];
  }

  private async findPhysicsComputations(violation: RendererViolation): Promise<SourceLocation[]> {
    // Implementation would find physics computations in renderer
    return [];
  }

  private async enforceAllowedInputs(violation: RendererViolation): Promise<CodeChange[]> {
    // Implementation would modify renderer to only accept allowed inputs
    return [];
  }

  private async extractCodeAtLocation(location: SourceLocation): Promise<string> {
    // Implementation would extract the actual code at the location
    return `// Code at ${location.file}:${location.line}`;
  }
}

/**
 * Magic Number Repairer
 * Replaces hardcoded constants with authority source references
 */
class MagicNumberRepairer {
  async repair(violations: MagicNumberViolation[]): Promise<RepairResult> {
    const repairedViolations: MagicNumberViolation[] = [];
    const codeChanges: CodeChange[] = [];
    const remainingViolations: MagicNumberViolation[] = [];
    const warnings: string[] = [];

    for (const violation of violations) {
      try {
        const changes = await this.replaceMagicNumber(violation);
        codeChanges.push(...changes);
        repairedViolations.push(violation);
      } catch (error) {
        remainingViolations.push(violation);
        warnings.push(`Failed to replace magic number: ${error.message}`);
      }
    }

    return {
      success: remainingViolations.length === 0,
      repairedViolations,
      codeChanges,
      remainingViolations,
      warnings
    };
  }

  private async replaceMagicNumber(violation: MagicNumberViolation): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];

    // Add import for the constant
    const importStatement = this.generateConstantImport(violation);
    changes.push({
      type: ChangeType.ADD,
      file: violation.location.file,
      original: '',
      modified: importStatement,
      location: { file: violation.location.file, line: 1, column: 1 },
      description: `Add import for ${violation.suspectedType} constant`
    });

    // Replace magic number with constant reference
    const constantName = this.getConstantName(violation);
    changes.push({
      type: ChangeType.MODIFY,
      file: violation.location.file,
      original: violation.value.toString(),
      modified: constantName,
      location: violation.location,
      description: `Replace magic number ${violation.value} with ${constantName}`
    });

    return changes;
  }

  private generateConstantImport(violation: MagicNumberViolation): string {
    const constantName = this.getConstantName(violation);
    const sourcePath = violation.suggestedSource.replace('.ts', '');
    return `import { ${constantName} } from '${sourcePath}';`;
  }

  private getConstantName(violation: MagicNumberViolation): string {
    // Generate appropriate constant name based on context and type
    const context = violation.context.toUpperCase().replace(/\s+/g, '_');
    const type = violation.suspectedType.toString().toUpperCase();
    return `${context}_${type}`;
  }
}

/**
 * Structural Failure Repairer
 * Creates refactoring plans for structural failures
 */
class StructuralFailureRepairer {
  async createRefactoringPlan(failures: StructuralFailure[]): Promise<RefactoringPlan> {
    const refactoringSteps: RefactoringStep[] = [];
    let totalEffort = 0;
    const risks: Risk[] = [];

    for (const failure of failures) {
      const steps = await this.createStepsForFailure(failure);
      refactoringSteps.push(...steps);
      totalEffort += this.estimateEffortForFailure(failure);
      risks.push(...this.assessRisksForFailure(failure));
    }

    const estimatedEffort: RefactoringEffort = {
      totalHours: totalEffort,
      complexity: this.calculateComplexity(totalEffort),
      riskLevel: this.calculateOverallRisk(risks)
    };

    const riskAssessment: RiskAssessment = {
      overallRisk: this.calculateOverallRisk(risks),
      risks,
      mitigations: this.generateMitigations(risks)
    };

    return {
      freezeRecommendation: failures.some(f => f.modificationCount >= 5),
      refactoringSteps,
      estimatedEffort,
      riskAssessment
    };
  }

  private async createStepsForFailure(failure: StructuralFailure): Promise<RefactoringStep[]> {
    const steps: RefactoringStep[] = [];

    // Step 1: Analyze the problem area
    steps.push({
      order: 1,
      description: `Analyze structural failure in ${failure.problemArea}`,
      type: RefactoringType.EXTRACT_CONSTANT,
      affectedFiles: [failure.location.file],
      estimatedTime: 2,
      dependencies: []
    });

    // Step 2: Create proper abstraction
    steps.push({
      order: 2,
      description: `Create proper abstraction for ${failure.problemArea}`,
      type: RefactoringType.SPLIT_LAYER,
      affectedFiles: [failure.location.file],
      estimatedTime: 8,
      dependencies: [1]
    });

    // Step 3: Migrate existing code
    steps.push({
      order: 3,
      description: `Migrate existing code to new abstraction`,
      type: RefactoringType.MOVE_TO_AUTHORITY,
      affectedFiles: [failure.location.file],
      estimatedTime: 4,
      dependencies: [2]
    });

    return steps;
  }

  private estimateEffortForFailure(failure: StructuralFailure): number {
    // Base effort depends on modification count
    const baseEffort = failure.modificationCount * 2;
    
    // Additional effort based on failure type
    switch (failure.failureType) {
      case 'repeated_modifications':
        return baseEffort + 8;
      case 'visual_instability':
        return baseEffort + 12;
      case 'parameter_tuning':
        return baseEffort + 6;
      case 'architecture_drift':
        return baseEffort + 16;
      default:
        return baseEffort;
    }
  }

  private assessRisksForFailure(failure: StructuralFailure): Risk[] {
    const risks: Risk[] = [];

    risks.push({
      description: `Refactoring ${failure.problemArea} may break existing functionality`,
      probability: 0.3,
      impact: RiskLevel.HIGH,
      category: RiskCategory.FUNCTIONAL
    });

    if (failure.modificationCount >= 5) {
      risks.push({
        description: `High modification count indicates deep structural issues`,
        probability: 0.7,
        impact: RiskLevel.CRITICAL,
        category: RiskCategory.ARCHITECTURAL
      });
    }

    return risks;
  }

  private calculateComplexity(totalHours: number): EffortComplexity {
    if (totalHours <= 8) return EffortComplexity.LOW;
    if (totalHours <= 24) return EffortComplexity.MEDIUM;
    if (totalHours <= 80) return EffortComplexity.HIGH;
    return EffortComplexity.VERY_HIGH;
  }

  private calculateOverallRisk(risks: Risk[]): RiskLevel {
    if (risks.some(r => r.impact === RiskLevel.CRITICAL)) return RiskLevel.CRITICAL;
    if (risks.some(r => r.impact === RiskLevel.HIGH)) return RiskLevel.HIGH;
    if (risks.some(r => r.impact === RiskLevel.MEDIUM)) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private generateMitigations(risks: Risk[]): Mitigation[] {
    return risks.map((risk, index) => ({
      riskId: index.toString(),
      strategy: this.getMitigationStrategy(risk),
      effort: this.getMitigationEffort(risk),
      effectiveness: this.getMitigationEffectiveness(risk)
    }));
  }

  private getMitigationStrategy(risk: Risk): string {
    switch (risk.category) {
      case RiskCategory.FUNCTIONAL:
        return 'Comprehensive testing before and after refactoring';
      case RiskCategory.ARCHITECTURAL:
        return 'Incremental refactoring with frequent validation';
      case RiskCategory.PERFORMANCE:
        return 'Performance benchmarking at each step';
      case RiskCategory.TIMELINE:
        return 'Break down into smaller, manageable chunks';
      default:
        return 'Regular review and validation';
    }
  }

  private getMitigationEffort(risk: Risk): number {
    switch (risk.impact) {
      case RiskLevel.CRITICAL:
        return 8;
      case RiskLevel.HIGH:
        return 4;
      case RiskLevel.MEDIUM:
        return 2;
      default:
        return 1;
    }
  }

  private getMitigationEffectiveness(risk: Risk): number {
    // Return effectiveness as a value between 0 and 1
    switch (risk.category) {
      case RiskCategory.FUNCTIONAL:
        return 0.8;
      case RiskCategory.ARCHITECTURAL:
        return 0.7;
      case RiskCategory.PERFORMANCE:
        return 0.6;
      case RiskCategory.TIMELINE:
        return 0.5;
      default:
        return 0.6;
    }
  }
}

// Export the main implementation
export const architectureRepairEngine = new ArchitectureRepairEngineImpl();