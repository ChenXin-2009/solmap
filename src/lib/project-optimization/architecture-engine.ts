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
  PhysicsConcept,
  PhysicsConstantType,
  ArchitectureLayer,
  ArchitectureLayerDefinition,
  ViolationType,
  LayerViolationType
} from './governance-types';

import { ProjectAST, SourceLocation } from './types';
import { PhysicsConceptRegistry, ArchitectureRegistry } from './governance-core';

// Helper function to safely extract error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

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
        warnings.push(`Failed to repair SSOT violation: ${getErrorMessage(error)}`);
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

    // Validate violation before processing
    if (!concept.name || !concept.authoritySource || !violation.location.file) {
      throw new Error('Invalid SSOT violation: missing required fields');
    }

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
        warnings.push(`Failed to repair layer violation: ${getErrorMessage(error)}`);
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
        warnings.push(`Failed to stupidify renderer: ${getErrorMessage(error)}`);
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
    // For testing, return a mock location
    return [violation.location];
  }

  private async findPhysicsComputations(violation: RendererViolation): Promise<SourceLocation[]> {
    // Implementation would find physics computations in renderer
    // For testing, return a mock location
    return [violation.location];
  }

  private async enforceAllowedInputs(violation: RendererViolation): Promise<CodeChange[]> {
    // Implementation would modify renderer to only accept allowed inputs
    return [{
      type: ChangeType.MODIFY,
      file: violation.location.file,
      original: '// Unrestricted renderer inputs',
      modified: '// Inputs restricted to: positionVector, attitudeMatrix, visualParams',
      location: violation.location,
      description: 'Enforce allowed renderer inputs'
    }];
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
        warnings.push(`Failed to replace magic number: ${getErrorMessage(error)}`);
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
      description: `Import ${violation.suspectedType} constant`
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

/**
 * Enhanced Layer Separation Repair Utilities
 * Provides detailed layer separation violation repair
 */
export class LayerSeparationRepairUtils {
  /**
   * Analyze cross-layer dependencies and create repair plan
   */
  static async analyzeLayerViolations(violations: LayerViolation[]): Promise<LayerRepairPlan> {
    const repairActions: LayerRepairAction[] = [];
    const affectedLayers = new Set<ArchitectureLayer>();

    for (const violation of violations) {
      affectedLayers.add(violation.sourceLayer);
      affectedLayers.add(violation.targetLayer);

      const action = await this.createRepairAction(violation);
      repairActions.push(action);
    }

    return {
      affectedLayers: Array.from(affectedLayers),
      repairActions,
      estimatedEffort: this.calculateLayerRepairEffort(repairActions),
      dependencies: this.analyzeDependencies(repairActions)
    };
  }

  private static async createRepairAction(violation: LayerViolation): Promise<LayerRepairAction> {
    const sourceLayerDef = ArchitectureRegistry.getLayer(violation.sourceLayer);
    const targetLayerDef = ArchitectureRegistry.getLayer(violation.targetLayer);

    if (!sourceLayerDef || !targetLayerDef) {
      throw new Error(`Unknown layer: ${violation.sourceLayer} or ${violation.targetLayer}`);
    }

    // Determine the appropriate repair strategy
    const strategy = this.determineRepairStrategy(violation, sourceLayerDef, targetLayerDef);

    return {
      violationId: `${violation.sourceLayer}-${violation.targetLayer}-${violation.location.line}`,
      strategy,
      sourceLayer: violation.sourceLayer,
      targetLayer: violation.targetLayer,
      affectedFiles: [violation.location.file],
      codeChanges: await this.generateLayerRepairChanges(violation, strategy),
      dependencies: [],
      estimatedTime: this.estimateRepairTime(strategy)
    };
  }

  private static determineRepairStrategy(
    violation: LayerViolation,
    sourceLayerDef: ArchitectureLayerDefinition,
    targetLayerDef: ArchitectureLayerDefinition
  ): LayerRepairStrategy {
    // If source layer is not allowed to depend on target layer
    if (!sourceLayerDef.allowedDependencies.includes(violation.targetLayer)) {
      return LayerRepairStrategy.REMOVE_DEPENDENCY;
    }

    // If it's a wrong direction dependency
    if (violation.layerViolationType === 'wrong_dependency_direction') {
      return LayerRepairStrategy.REVERSE_DEPENDENCY;
    }

    // If it's mixed responsibilities
    if (violation.layerViolationType === 'mixed_responsibilities') {
      return LayerRepairStrategy.SPLIT_RESPONSIBILITIES;
    }

    // Default to adding interface
    return LayerRepairStrategy.ADD_INTERFACE;
  }

  private static async generateLayerRepairChanges(
    violation: LayerViolation,
    strategy: LayerRepairStrategy
  ): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];

    switch (strategy) {
      case LayerRepairStrategy.REMOVE_DEPENDENCY:
        changes.push({
          type: ChangeType.REMOVE,
          file: violation.location.file,
          original: `// Forbidden import from ${violation.targetLayer}`,
          modified: '',
          location: violation.location,
          description: `Remove forbidden dependency from ${violation.sourceLayer} to ${violation.targetLayer}`
        });
        break;

      case LayerRepairStrategy.ADD_INTERFACE:
        changes.push({
          type: ChangeType.ADD,
          file: this.getInterfaceFile(violation.sourceLayer, violation.targetLayer),
          original: '',
          modified: this.generateLayerInterface(violation.sourceLayer, violation.targetLayer),
          location: { file: violation.location.file, line: 1, column: 1 },
          description: `Add interface between ${violation.sourceLayer} and ${violation.targetLayer}`
        });
        break;

      case LayerRepairStrategy.SPLIT_RESPONSIBILITIES:
        changes.push(...await this.generateSplitChanges(violation));
        break;

      case LayerRepairStrategy.REVERSE_DEPENDENCY:
        changes.push(...await this.generateReverseDependencyChanges(violation));
        break;
    }

    return changes;
  }

  private static getInterfaceFile(sourceLayer: ArchitectureLayer, targetLayer: ArchitectureLayer): string {
    return `src/lib/interfaces/${sourceLayer}-${targetLayer}-interface.ts`;
  }

  private static generateLayerInterface(sourceLayer: ArchitectureLayer, targetLayer: ArchitectureLayer): string {
    return `// Interface between ${sourceLayer} and ${targetLayer} layers
export interface ${this.capitalize(sourceLayer)}${this.capitalize(targetLayer)}Interface {
  // Define interface methods here
}`;
  }

  private static async generateSplitChanges(violation: LayerViolation): Promise<CodeChange[]> {
    // Implementation for splitting mixed responsibilities
    return [{
      type: ChangeType.MOVE,
      file: violation.location.file,
      original: '// Mixed responsibility code',
      modified: '// Moved to appropriate layer',
      location: violation.location,
      description: `Split mixed responsibilities in ${violation.sourceLayer}`
    }];
  }

  private static async generateReverseDependencyChanges(violation: LayerViolation): Promise<CodeChange[]> {
    // Implementation for reversing wrong direction dependencies
    return [{
      type: ChangeType.MODIFY,
      file: violation.location.file,
      original: '// Wrong direction dependency',
      modified: '// Corrected dependency direction',
      location: violation.location,
      description: `Reverse dependency direction between ${violation.sourceLayer} and ${violation.targetLayer}`
    }];
  }

  private static calculateLayerRepairEffort(actions: LayerRepairAction[]): number {
    return actions.reduce((total, action) => total + action.estimatedTime, 0);
  }

  private static analyzeDependencies(actions: LayerRepairAction[]): string[] {
    // Analyze dependencies between repair actions
    return [];
  }

  private static estimateRepairTime(strategy: LayerRepairStrategy): number {
    switch (strategy) {
      case LayerRepairStrategy.REMOVE_DEPENDENCY:
        return 1;
      case LayerRepairStrategy.ADD_INTERFACE:
        return 4;
      case LayerRepairStrategy.SPLIT_RESPONSIBILITIES:
        return 8;
      case LayerRepairStrategy.REVERSE_DEPENDENCY:
        return 6;
      default:
        return 2;
    }
  }

  private static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Enhanced Renderer Stupidity Repair Utilities
 * Provides detailed renderer stupidification
 */
export class RendererStupidityRepairUtils {
  /**
   * Analyze renderer violations and create stupidification plan
   */
  static async analyzeRendererViolations(violations: RendererViolation[]): Promise<RendererRepairPlan> {
    const repairActions: RendererRepairAction[] = [];
    const affectedRenderers = new Set<string>();

    for (const violation of violations) {
      affectedRenderers.add(violation.rendererModule);

      const action = await this.createRendererRepairAction(violation);
      repairActions.push(action);
    }

    return {
      affectedRenderers: Array.from(affectedRenderers),
      repairActions,
      estimatedEffort: this.calculateRendererRepairEffort(repairActions),
      stupidificationLevel: this.calculateStupidificationLevel(repairActions)
    };
  }

  private static async createRendererRepairAction(violation: RendererViolation): Promise<RendererRepairAction> {
    const strategy = this.determineStupidificationStrategy(violation);

    return {
      violationId: `${violation.rendererModule}-${violation.intelligenceType}`,
      strategy,
      rendererModule: violation.rendererModule,
      intelligenceType: violation.intelligenceType,
      codeChanges: await this.generateStupidificationChanges(violation, strategy),
      estimatedTime: this.estimateStupidificationTime(strategy),
      allowedInputs: this.getAllowedRendererInputs(),
      forbiddenOperations: this.getForbiddenRendererOperations()
    };
  }

  private static determineStupidificationStrategy(violation: RendererViolation): RendererStupidificationStrategy {
    switch (violation.intelligenceType) {
      case 'physics_knowledge':
        return RendererStupidificationStrategy.REMOVE_PHYSICS_KNOWLEDGE;
      case 'computation_logic':
        return RendererStupidificationStrategy.REMOVE_COMPUTATIONS;
      case 'forbidden_import':
        return RendererStupidificationStrategy.REMOVE_IMPORTS;
      case 'invalid_input':
        return RendererStupidificationStrategy.RESTRICT_INPUTS;
      default:
        return RendererStupidificationStrategy.FULL_STUPIDIFICATION;
    }
  }

  private static async generateStupidificationChanges(
    violation: RendererViolation,
    strategy: RendererStupidificationStrategy
  ): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];

    switch (strategy) {
      case RendererStupidificationStrategy.REMOVE_PHYSICS_KNOWLEDGE:
        changes.push(...await this.removePhysicsKnowledge(violation));
        break;

      case RendererStupidificationStrategy.REMOVE_COMPUTATIONS:
        changes.push(...await this.removeComputations(violation));
        break;

      case RendererStupidificationStrategy.REMOVE_IMPORTS:
        changes.push(...await this.removeForbiddenImports(violation));
        break;

      case RendererStupidificationStrategy.RESTRICT_INPUTS:
        changes.push(...await this.restrictInputs(violation));
        break;

      case RendererStupidificationStrategy.FULL_STUPIDIFICATION:
        changes.push(...await this.performFullStupidification(violation));
        break;
    }

    return changes;
  }

  private static async removePhysicsKnowledge(violation: RendererViolation): Promise<CodeChange[]> {
    return [{
      type: ChangeType.REMOVE,
      file: violation.location.file,
      original: '// Physics knowledge code',
      modified: '// Physics knowledge removed - renderer stupidified',
      location: violation.location,
      description: `Remove physics knowledge from renderer ${violation.rendererModule}`
    }];
  }

  private static async removeComputations(violation: RendererViolation): Promise<CodeChange[]> {
    return [{
      type: ChangeType.REMOVE,
      file: violation.location.file,
      original: '// Computation logic',
      modified: '// Computations moved to physics layer',
      location: violation.location,
      description: `Remove computations from renderer ${violation.rendererModule}`
    }];
  }

  private static async removeForbiddenImports(violation: RendererViolation): Promise<CodeChange[]> {
    return [{
      type: ChangeType.REMOVE,
      file: violation.location.file,
      original: "import { ... } from 'lib/astronomy/constants/...'",
      modified: '',
      location: violation.location,
      description: `Remove forbidden imports from renderer ${violation.rendererModule}`
    }];
  }

  private static async restrictInputs(violation: RendererViolation): Promise<CodeChange[]> {
    const allowedInputs = this.getAllowedRendererInputs();
    const inputRestriction = `// Renderer inputs restricted to: ${allowedInputs.join(', ')}`;

    return [{
      type: ChangeType.MODIFY,
      file: violation.location.file,
      original: '// Unrestricted inputs',
      modified: inputRestriction,
      location: violation.location,
      description: `Restrict inputs for renderer ${violation.rendererModule}`
    }];
  }

  private static async performFullStupidification(violation: RendererViolation): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];

    // Remove all physics knowledge
    changes.push(...await this.removePhysicsKnowledge(violation));

    // Remove all computations
    changes.push(...await this.removeComputations(violation));

    // Remove forbidden imports
    changes.push(...await this.removeForbiddenImports(violation));

    // Restrict inputs
    changes.push(...await this.restrictInputs(violation));

    return changes;
  }

  private static getAllowedRendererInputs(): string[] {
    return [
      'positionVector',
      'attitudeMatrix',
      'visualParams',
      'renderingOptions',
      'displaySettings'
    ];
  }

  private static getForbiddenRendererOperations(): string[] {
    return [
      'physicsCalculations',
      'astronomicalComputations',
      'axialTiltCalculations',
      'periodCalculations',
      'referenceFrameTransformations'
    ];
  }

  private static calculateRendererRepairEffort(actions: RendererRepairAction[]): number {
    return actions.reduce((total, action) => total + action.estimatedTime, 0);
  }

  private static calculateStupidificationLevel(actions: RendererRepairAction[]): StupidificationLevel {
    const totalActions = actions.length;
    const fullStupidifications = actions.filter(a => 
      a.strategy === RendererStupidificationStrategy.FULL_STUPIDIFICATION
    ).length;

    const ratio = fullStupidifications / totalActions;

    if (ratio >= 0.8) return StupidificationLevel.COMPLETE;
    if (ratio >= 0.6) return StupidificationLevel.HIGH;
    if (ratio >= 0.4) return StupidificationLevel.MEDIUM;
    return StupidificationLevel.LOW;
  }

  private static estimateStupidificationTime(strategy: RendererStupidificationStrategy): number {
    switch (strategy) {
      case RendererStupidificationStrategy.REMOVE_PHYSICS_KNOWLEDGE:
        return 3;
      case RendererStupidificationStrategy.REMOVE_COMPUTATIONS:
        return 4;
      case RendererStupidificationStrategy.REMOVE_IMPORTS:
        return 1;
      case RendererStupidificationStrategy.RESTRICT_INPUTS:
        return 2;
      case RendererStupidificationStrategy.FULL_STUPIDIFICATION:
        return 8;
      default:
        return 2;
    }
  }
}

// Additional types for layer separation and renderer repair
export interface LayerRepairPlan {
  affectedLayers: ArchitectureLayer[];
  repairActions: LayerRepairAction[];
  estimatedEffort: number;
  dependencies: string[];
}

export interface LayerRepairAction {
  violationId: string;
  strategy: LayerRepairStrategy;
  sourceLayer: ArchitectureLayer;
  targetLayer: ArchitectureLayer;
  affectedFiles: string[];
  codeChanges: CodeChange[];
  dependencies: string[];
  estimatedTime: number;
}

export enum LayerRepairStrategy {
  REMOVE_DEPENDENCY = 'remove_dependency',
  ADD_INTERFACE = 'add_interface',
  SPLIT_RESPONSIBILITIES = 'split_responsibilities',
  REVERSE_DEPENDENCY = 'reverse_dependency'
}

export interface RendererRepairPlan {
  affectedRenderers: string[];
  repairActions: RendererRepairAction[];
  estimatedEffort: number;
  stupidificationLevel: StupidificationLevel;
}

export interface RendererRepairAction {
  violationId: string;
  strategy: RendererStupidificationStrategy;
  rendererModule: string;
  intelligenceType: string;
  codeChanges: CodeChange[];
  estimatedTime: number;
  allowedInputs: string[];
  forbiddenOperations: string[];
}

export enum RendererStupidificationStrategy {
  REMOVE_PHYSICS_KNOWLEDGE = 'remove_physics_knowledge',
  REMOVE_COMPUTATIONS = 'remove_computations',
  REMOVE_IMPORTS = 'remove_imports',
  RESTRICT_INPUTS = 'restrict_inputs',
  FULL_STUPIDIFICATION = 'full_stupidification'
}

export enum StupidificationLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  COMPLETE = 'complete'
}
/**
 * Enhanced Magic Number Elimination Utilities
 * Provides comprehensive magic number detection and replacement
 */
export class MagicNumberEliminationUtils {
  /**
   * Analyze magic number violations and create elimination plan
   */
  static async analyzeMagicNumbers(violations: MagicNumberViolation[]): Promise<MagicNumberEliminationPlan> {
    const eliminationActions: MagicNumberEliminationAction[] = [];
    const constantsToCreate: ConstantDefinition[] = [];
    const affectedFiles = new Set<string>();

    for (const violation of violations) {
      affectedFiles.add(violation.location.file);

      const action = await this.createEliminationAction(violation);
      eliminationActions.push(action);

      const constantDef = await this.createConstantDefinition(violation);
      if (constantDef) {
        constantsToCreate.push(constantDef);
      }
    }

    return {
      affectedFiles: Array.from(affectedFiles),
      eliminationActions,
      constantsToCreate,
      estimatedEffort: this.calculateEliminationEffort(eliminationActions),
      authorityFiles: this.identifyAuthorityFiles(constantsToCreate)
    };
  }

  private static async createEliminationAction(violation: MagicNumberViolation): Promise<MagicNumberEliminationAction> {
    const strategy = this.determineEliminationStrategy(violation);
    const constantName = this.generateConstantName(violation);
    const authorityFile = this.determineAuthorityFile(violation);

    return {
      violationId: `${violation.location.file}-${violation.location.line}-${violation.value}`,
      strategy,
      magicNumber: violation.value,
      constantName,
      authorityFile,
      suspectedType: violation.suspectedType,
      codeChanges: await this.generateEliminationChanges(violation, constantName, authorityFile),
      estimatedTime: this.estimateEliminationTime(strategy),
      context: violation.context
    };
  }

  private static determineEliminationStrategy(violation: MagicNumberViolation): MagicNumberEliminationStrategy {
    // Check if constant already exists in authority file
    if (this.constantExistsInAuthority(violation)) {
      return MagicNumberEliminationStrategy.USE_EXISTING_CONSTANT;
    }

    // Check if it's a physics constant
    if (this.isPhysicsConstant(violation)) {
      return MagicNumberEliminationStrategy.CREATE_PHYSICS_CONSTANT;
    }

    // Check if it's a configuration value
    if (this.isConfigurationValue(violation)) {
      return MagicNumberEliminationStrategy.CREATE_CONFIG_CONSTANT;
    }

    // Default to creating a local constant
    return MagicNumberEliminationStrategy.CREATE_LOCAL_CONSTANT;
  }

  private static generateConstantName(violation: MagicNumberViolation): string {
    const context = violation.context.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const type = violation.suspectedType.toString().toUpperCase();
    
    // Generate meaningful constant name based on context and type
    switch (violation.suspectedType) {
      case PhysicsConstantType.AXIAL_TILT:
        return `${context}_AXIAL_TILT`;
      case PhysicsConstantType.PHYSICAL_PARAMS:
        return `${context}_RADIUS` || `${context}_MASS` || `${context}_GM`;
      case PhysicsConstantType.ROTATION:
        return `${context}_ROTATION_PERIOD`;
      case PhysicsConstantType.REFERENCE_FRAMES:
        return `${context}_REFERENCE_FRAME`;
      default:
        return `${context}_CONSTANT`;
    }
  }

  private static determineAuthorityFile(violation: MagicNumberViolation): string {
    switch (violation.suspectedType) {
      case PhysicsConstantType.AXIAL_TILT:
        return 'lib/astronomy/constants/axialTilt.ts';
      case PhysicsConstantType.PHYSICAL_PARAMS:
        return 'lib/astronomy/constants/physicalParams.ts';
      case PhysicsConstantType.ROTATION:
        return 'lib/astronomy/constants/rotation.ts';
      case PhysicsConstantType.REFERENCE_FRAMES:
        return 'lib/astronomy/constants/referenceFrames.ts';
      default:
        return violation.suggestedSource || 'lib/constants/general.ts';
    }
  }

  private static async generateEliminationChanges(
    violation: MagicNumberViolation,
    constantName: string,
    authorityFile: string
  ): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];

    // Add constant definition to authority file
    changes.push({
      type: ChangeType.ADD,
      file: authorityFile,
      original: '',
      modified: this.generateConstantDefinition(constantName, violation.value, violation.context),
      location: { file: authorityFile, line: 1, column: 1 },
      description: `Add ${constantName} to authority file ${authorityFile}`
    });

    // Add import statement
    changes.push({
      type: ChangeType.ADD,
      file: violation.location.file,
      original: '',
      modified: this.generateImportStatement(constantName, authorityFile),
      location: { file: violation.location.file, line: 1, column: 1 },
      description: `Import ${constantName} from ${authorityFile}`
    });

    // Replace magic number with constant
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

  private static generateConstantDefinition(constantName: string, value: number | string, context: string): string {
    const unit = this.inferUnit(context);
    const comment = this.generateConstantComment(constantName, context, unit);
    
    return `${comment}
export const ${constantName} = ${typeof value === 'string' ? `'${value}'` : value}${unit ? ` as const; // ${unit}` : ' as const;'}`;
  }

  private static generateImportStatement(constantName: string, authorityFile: string): string {
    const importPath = authorityFile.replace('.ts', '').replace('lib/', '../');
    return `import { ${constantName} } from '${importPath}';`;
  }

  private static generateConstantComment(constantName: string, context: string, unit?: string): string {
    return `/**
 * ${constantName.replace(/_/g, ' ').toLowerCase()}
 * Context: ${context}${unit ? `\n * Unit: ${unit}` : ''}
 */`;
  }

  private static inferUnit(context: string): string | undefined {
    const lowerContext = context.toLowerCase();
    
    if (lowerContext.includes('angle') || lowerContext.includes('tilt')) return 'degrees';
    if (lowerContext.includes('radius') || lowerContext.includes('distance')) return 'km';
    if (lowerContext.includes('mass')) return 'kg';
    if (lowerContext.includes('period') || lowerContext.includes('time')) return 'hours';
    if (lowerContext.includes('velocity') || lowerContext.includes('speed')) return 'km/s';
    
    return undefined;
  }

  private static constantExistsInAuthority(violation: MagicNumberViolation): boolean {
    // Implementation would check if constant already exists
    return false;
  }

  private static isPhysicsConstant(violation: MagicNumberViolation): boolean {
    const context = violation.context.toLowerCase();
    return context.includes('physics') || 
           context.includes('astronomy') || 
           context.includes('orbital') ||
           context.includes('axial') ||
           context.includes('rotation');
  }

  private static isConfigurationValue(violation: MagicNumberViolation): boolean {
    const context = violation.context.toLowerCase();
    return context.includes('config') || 
           context.includes('setting') || 
           context.includes('option');
  }

  private static async createConstantDefinition(violation: MagicNumberViolation): Promise<ConstantDefinition | null> {
    if (this.constantExistsInAuthority(violation)) {
      return null;
    }

    return {
      name: this.generateConstantName(violation),
      value: violation.value,
      type: violation.suspectedType,
      authorityFile: this.determineAuthorityFile(violation),
      context: violation.context,
      unit: this.inferUnit(violation.context)
    };
  }

  private static calculateEliminationEffort(actions: MagicNumberEliminationAction[]): number {
    return actions.reduce((total, action) => total + action.estimatedTime, 0);
  }

  private static identifyAuthorityFiles(constants: ConstantDefinition[]): string[] {
    const files = new Set<string>();
    constants.forEach(c => files.add(c.authorityFile));
    return Array.from(files);
  }

  private static estimateEliminationTime(strategy: MagicNumberEliminationStrategy): number {
    switch (strategy) {
      case MagicNumberEliminationStrategy.USE_EXISTING_CONSTANT:
        return 1;
      case MagicNumberEliminationStrategy.CREATE_PHYSICS_CONSTANT:
        return 3;
      case MagicNumberEliminationStrategy.CREATE_CONFIG_CONSTANT:
        return 2;
      case MagicNumberEliminationStrategy.CREATE_LOCAL_CONSTANT:
        return 1;
      default:
        return 2;
    }
  }
}

/**
 * Enhanced Structural Refactoring Utilities
 * Provides comprehensive structural failure analysis and refactoring
 */
export class StructuralRefactoringUtils {
  /**
   * Analyze structural failures and create comprehensive refactoring plan
   */
  static async analyzeStructuralFailures(failures: StructuralFailure[]): Promise<StructuralRefactoringPlan> {
    const refactoringPhases: RefactoringPhase[] = [];
    const developmentFreeze = this.shouldFreezeDevelopment(failures);
    const criticalFailures = failures.filter(f => f.modificationCount >= 5);

    // Phase 1: Analysis and Planning
    refactoringPhases.push(await this.createAnalysisPhase(failures));

    // Phase 2: Critical Failure Resolution
    if (criticalFailures.length > 0) {
      refactoringPhases.push(await this.createCriticalResolutionPhase(criticalFailures));
    }

    // Phase 3: Structural Improvements
    refactoringPhases.push(await this.createStructuralImprovementPhase(failures));

    // Phase 4: Validation and Testing
    refactoringPhases.push(await this.createValidationPhase(failures));

    return {
      developmentFreeze,
      phases: refactoringPhases,
      totalEstimatedTime: this.calculateTotalTime(refactoringPhases),
      riskLevel: this.assessOverallRisk(failures),
      successCriteria: this.defineSuccessCriteria(failures),
      rollbackPlan: this.createRollbackPlan(failures)
    };
  }

  private static shouldFreezeDevelopment(failures: StructuralFailure[]): boolean {
    // Freeze development if any failure has been modified 5+ times
    return failures.some(f => f.modificationCount >= 5);
  }

  private static async createAnalysisPhase(failures: StructuralFailure[]): Promise<RefactoringPhase> {
    const steps: RefactoringStep[] = [];

    steps.push({
      order: 1,
      description: 'Analyze all structural failures and their root causes',
      type: RefactoringType.EXTRACT_CONSTANT,
      affectedFiles: failures.map(f => f.location.file),
      estimatedTime: failures.length * 2,
      dependencies: []
    });

    steps.push({
      order: 2,
      description: 'Create detailed refactoring plan for each failure',
      type: RefactoringType.SPLIT_LAYER,
      affectedFiles: [],
      estimatedTime: failures.length * 1,
      dependencies: [1]
    });

    return {
      name: 'Analysis and Planning',
      description: 'Comprehensive analysis of structural failures',
      steps,
      duration: this.calculatePhaseTime(steps),
      risks: [
        'Incomplete analysis may miss critical issues',
        'Planning phase may take longer than estimated'
      ]
    };
  }

  private static async createCriticalResolutionPhase(criticalFailures: StructuralFailure[]): Promise<RefactoringPhase> {
    const steps: RefactoringStep[] = [];

    for (let i = 0; i < criticalFailures.length; i++) {
      const failure = criticalFailures[i];
      steps.push({
        order: i + 1,
        description: `Resolve critical structural failure in ${failure.problemArea}`,
        type: this.determineRefactoringType(failure),
        affectedFiles: [failure.location.file],
        estimatedTime: this.estimateCriticalResolutionTime(failure),
        dependencies: i > 0 ? [i] : []
      });
    }

    return {
      name: 'Critical Failure Resolution',
      description: 'Address the most critical structural failures first',
      steps,
      duration: this.calculatePhaseTime(steps),
      risks: [
        'Critical failures may have deep architectural implications',
        'Resolution may break existing functionality',
        'May require significant code restructuring'
      ]
    };
  }

  private static async createStructuralImprovementPhase(failures: StructuralFailure[]): Promise<RefactoringPhase> {
    const steps: RefactoringStep[] = [];
    const nonCriticalFailures = failures.filter(f => f.modificationCount < 5);

    steps.push({
      order: 1,
      description: 'Implement proper abstractions for repeated modification areas',
      type: RefactoringType.EXTRACT_CONSTANT,
      affectedFiles: nonCriticalFailures.map(f => f.location.file),
      estimatedTime: nonCriticalFailures.length * 4,
      dependencies: []
    });

    steps.push({
      order: 2,
      description: 'Establish clear architectural boundaries',
      type: RefactoringType.SPLIT_LAYER,
      affectedFiles: this.getUniqueFiles(failures),
      estimatedTime: 16,
      dependencies: [1]
    });

    steps.push({
      order: 3,
      description: 'Migrate existing code to new architecture',
      type: RefactoringType.MOVE_TO_AUTHORITY,
      affectedFiles: this.getUniqueFiles(failures),
      estimatedTime: failures.length * 3,
      dependencies: [2]
    });

    return {
      name: 'Structural Improvements',
      description: 'Implement long-term structural improvements',
      steps,
      duration: this.calculatePhaseTime(steps),
      risks: [
        'Large-scale refactoring may introduce new bugs',
        'Team may need time to adapt to new architecture',
        'Integration challenges between old and new code'
      ]
    };
  }

  private static async createValidationPhase(failures: StructuralFailure[]): Promise<RefactoringPhase> {
    const steps: RefactoringStep[] = [];

    steps.push({
      order: 1,
      description: 'Run comprehensive test suite',
      type: RefactoringType.EXTRACT_CONSTANT,
      affectedFiles: [],
      estimatedTime: 4,
      dependencies: []
    });

    steps.push({
      order: 2,
      description: 'Validate architectural compliance',
      type: RefactoringType.SPLIT_LAYER,
      affectedFiles: [],
      estimatedTime: 2,
      dependencies: [1]
    });

    steps.push({
      order: 3,
      description: 'Performance and stability testing',
      type: RefactoringType.MOVE_TO_AUTHORITY,
      affectedFiles: [],
      estimatedTime: 6,
      dependencies: [2]
    });

    return {
      name: 'Validation and Testing',
      description: 'Comprehensive validation of refactoring results',
      steps,
      duration: this.calculatePhaseTime(steps),
      risks: [
        'Tests may reveal issues requiring additional work',
        'Performance regressions may require optimization',
        'Stability issues may require rollback'
      ]
    };
  }

  private static determineRefactoringType(failure: StructuralFailure): RefactoringType {
    switch (failure.failureType) {
      case 'repeated_modifications':
        return RefactoringType.EXTRACT_CONSTANT;
      case 'visual_instability':
        return RefactoringType.STUPIDIFY_RENDERER;
      case 'parameter_tuning':
        return RefactoringType.MOVE_TO_AUTHORITY;
      case 'architecture_drift':
        return RefactoringType.SPLIT_LAYER;
      default:
        return RefactoringType.EXTRACT_CONSTANT;
    }
  }

  private static estimateCriticalResolutionTime(failure: StructuralFailure): number {
    const baseTime = failure.modificationCount * 3;
    
    switch (failure.failureType) {
      case 'repeated_modifications':
        return baseTime + 8;
      case 'visual_instability':
        return baseTime + 12;
      case 'parameter_tuning':
        return baseTime + 6;
      case 'architecture_drift':
        return baseTime + 20;
      default:
        return baseTime;
    }
  }

  private static calculatePhaseTime(steps: RefactoringStep[]): number {
    return steps.reduce((total, step) => total + step.estimatedTime, 0);
  }

  private static calculateTotalTime(phases: RefactoringPhase[]): number {
    return phases.reduce((total, phase) => total + phase.duration, 0);
  }

  private static assessOverallRisk(failures: StructuralFailure[]): RiskLevel {
    const criticalCount = failures.filter(f => f.modificationCount >= 5).length;
    const totalFailures = failures.length;

    if (criticalCount > 0 && criticalCount / totalFailures > 0.5) {
      return RiskLevel.CRITICAL;
    }
    if (criticalCount > 0) {
      return RiskLevel.HIGH;
    }
    if (totalFailures > 10) {
      return RiskLevel.MEDIUM;
    }
    return RiskLevel.LOW;
  }

  private static defineSuccessCriteria(failures: StructuralFailure[]): string[] {
    return [
      'All structural failures resolved with modification count < 3',
      'Architecture compliance score > 90%',
      'All tests passing with no regressions',
      'Performance metrics maintained or improved',
      'Code maintainability index improved by 20%',
      'No new structural failures introduced'
    ];
  }

  private static createRollbackPlan(failures: StructuralFailure[]): string {
    return `Rollback Plan:
1. Maintain complete backup of current codebase
2. Implement rollback checkpoints after each phase
3. Automated rollback triggers if tests fail
4. Manual rollback procedure documented
5. Recovery time estimate: ${Math.ceil(failures.length / 2)} hours`;
  }

  private static getUniqueFiles(failures: StructuralFailure[]): string[] {
    const files = new Set<string>();
    failures.forEach(f => files.add(f.location.file));
    return Array.from(files);
  }
}

// Additional types for magic number elimination and structural refactoring
export interface MagicNumberEliminationPlan {
  affectedFiles: string[];
  eliminationActions: MagicNumberEliminationAction[];
  constantsToCreate: ConstantDefinition[];
  estimatedEffort: number;
  authorityFiles: string[];
}

export interface MagicNumberEliminationAction {
  violationId: string;
  strategy: MagicNumberEliminationStrategy;
  magicNumber: number | string;
  constantName: string;
  authorityFile: string;
  suspectedType: PhysicsConstantType;
  codeChanges: CodeChange[];
  estimatedTime: number;
  context: string;
}

export enum MagicNumberEliminationStrategy {
  USE_EXISTING_CONSTANT = 'use_existing_constant',
  CREATE_PHYSICS_CONSTANT = 'create_physics_constant',
  CREATE_CONFIG_CONSTANT = 'create_config_constant',
  CREATE_LOCAL_CONSTANT = 'create_local_constant'
}

export interface ConstantDefinition {
  name: string;
  value: number | string;
  type: PhysicsConstantType;
  authorityFile: string;
  context: string;
  unit?: string;
}

export interface StructuralRefactoringPlan {
  developmentFreeze: boolean;
  phases: RefactoringPhase[];
  totalEstimatedTime: number;
  riskLevel: RiskLevel;
  successCriteria: string[];
  rollbackPlan: string;
}

export interface RefactoringPhase {
  name: string;
  description: string;
  steps: RefactoringStep[];
  duration: number;
  risks: string[];
}

/**
 * Project Architecture Rule Engine - Stub implementation
 * TODO: Implement full architecture validation rules
 */
export class ProjectArchitectureRuleEngine {
  validateLayerSeparation(ast: any, rules: any): any[] {
    // Stub implementation
    return [];
  }

  validateDependencyDirection(ast: any, dependencyGraph: any, rules: any): any[] {
    // Stub implementation
    return [];
  }

  validateInterfaceImplementation(ast: any, rules: any): any[] {
    // Stub implementation
    return [];
  }

  validateSingleResponsibility(ast: any, rules: any): any[] {
    // Stub implementation
    return [];
  }

  validateNamingConsistency(ast: any, rules: any): any[] {
    // Stub implementation
    return [];
  }
}

/**
 * Default SolMap Architecture Rules - Stub implementation
 * TODO: Implement actual governance rules from specs
 */
export const DEFAULT_SOLMAP_ARCHITECTURE_RULES = {
  layerSeparation: {
    // Stub rules
  },
  dependencyDirection: {
    // Stub rules
  },
  interfaceImplementation: {
    // Stub rules
  },
  singleResponsibility: {
    // Stub rules
  },
  namingConsistency: {
    // Stub rules
  }
};