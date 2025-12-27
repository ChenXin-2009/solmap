// Renderer Stupidity Checker - Ensures rendering layer remains stupid
// Based on Spec-3 from .kiro/specs/solmap-ai-governance.md

import {
  RendererStupidityChecker,
  RendererImportViolation,
  ComputationViolation,
  ImportInfo,
  FileAST as GovernanceFileAST,
  ImportViolation,
  FunctionInfo,
  ComputationInfo
} from './governance-interfaces';

import {
  RendererViolation,
  RendererIntelligenceType,
  ViolationType,
  ViolationSeverity,
  ArchitectureLayer,
  RendererInputViolation,
  PhysicsKnowledgeViolation
} from './governance-types';

import { ProjectAST, ModuleInfo, SourceLocation } from './types';

export class RendererStupidityCheckerImpl implements RendererStupidityChecker {
  // Allowed inputs for renderer modules (Spec-3.1)
  private readonly ALLOWED_RENDERER_INPUTS = [
    'positionVector',
    'attitudeMatrix', 
    'visualParams',
    'position',
    'rotation',
    'scale',
    'color',
    'opacity',
    'texture',
    'material',
    'geometry'
  ];

  // Forbidden physics concepts that renderers should not know about (Spec-3.2, 3.3)
  private readonly FORBIDDEN_PHYSICS_CONCEPTS = [
    'axialTilt',
    'period',
    'referenceFrame',
    'orbitalPeriod',
    'rotationPeriod',
    'physicalParams',
    'GM',
    'mass',
    'radius',
    'ephemeris',
    'kepler',
    'orbital',
    'physics',
    'astronomy'
  ];

  // Forbidden import patterns for renderers (Spec-3.2)
  private readonly FORBIDDEN_IMPORT_PATTERNS = [
    /lib\/astronomy/,
    /lib\/physics/,
    /constants\/axialTilt/,
    /constants\/physicalParams/,
    /constants\/rotation/,
    /constants\/referenceFrames/,
    /orbital/,
    /ephemeris/,
    /kepler/
  ];

  // Renderer module patterns
  private readonly RENDERER_MODULE_PATTERNS = [
    /components\/canvas/,
    /3d/,
    /render/,
    /visual/,
    /display/,
    /graphics/,
    /scene/,
    /mesh/,
    /material/,
    /texture/,
    /shader/
  ];

  /**
   * Identifies renderer modules in the project
   */
  identifyRendererModules(ast: ProjectAST): string[] {
    const rendererModules: string[] = [];

    // Check modules for renderer patterns
    for (const module of ast.modules) {
      const modulePath = module.path || module.name;
      
      // Check if module path matches renderer patterns
      const isRenderer = this.RENDERER_MODULE_PATTERNS.some(pattern => 
        pattern.test(modulePath)
      );

      if (isRenderer) {
        rendererModules.push(modulePath);
      }
    }

    return rendererModules;
  }

  /**
   * Check renderer inputs for compliance with Spec-3.1
   * Ensures renderers only accept position vectors, attitude matrices, and visual params
   */
  checkRendererInputs(rendererModules: ModuleInfo[]): RendererInputViolation[] {
    const violations: RendererInputViolation[] = [];

    for (const module of rendererModules) {
      const inputViolations = this.analyzeModuleInputs(module);
      if (inputViolations.length > 0) {
        violations.push({
          rendererModule: module.path,
          allowedInputs: this.ALLOWED_RENDERER_INPUTS,
          actualInputs: this.extractModuleInputs(module),
          violations: inputViolations,
          location: {
            file: module.path,
            line: 1,
            column: 1
          }
        });
      }
    }

    return violations;
  }

  /**
   * Detect physics knowledge in renderer code (Spec-3.2, 3.3)
   * Identifies when renderers know about axial tilt, periods, or reference frames
   */
  detectPhysicsKnowledge(rendererCode: string[]): PhysicsKnowledgeViolation[] {
    const violations: PhysicsKnowledgeViolation[] = [];

    for (let i = 0; i < rendererCode.length; i++) {
      const code = rendererCode[i];
      const detectedConcepts = this.findPhysicsConceptsInCode(code);
      
      if (detectedConcepts.length > 0) {
        violations.push({
          rendererModule: `renderer_${i}`,
          forbiddenConcepts: this.FORBIDDEN_PHYSICS_CONCEPTS,
          detectedConcepts,
          location: {
            file: `renderer_${i}`,
            line: 1,
            column: 1
          }
        });
      }
    }

    return violations;
  }

  /**
   * Validate renderer imports for forbidden physics/astronomy modules (Spec-3.2)
   */
  validateRendererImports(imports: ImportInfo[]): RendererImportViolation[] {
    const violations: RendererImportViolation[] = [];
    const rendererImports = imports.filter(imp => 
      this.isRendererModule(imp.module)
    );

    for (const importInfo of rendererImports) {
      const importViolations = this.checkImportViolations(importInfo);
      
      if (importViolations.length > 0) {
        violations.push({
          rendererModule: importInfo.module,
          forbiddenImports: this.getForbiddenImportPatterns(),
          actualImports: [importInfo.source],
          violations: importViolations,
          location: importInfo.location
        });
      }
    }

    return violations;
  }

  /**
   * Check for computation logic in renderer AST (Spec-3.4, 3.5)
   * Identifies angle calculations, period computations, or physics derivations
   */
  checkComputationLogic(rendererAST: GovernanceFileAST[]): ComputationViolation[] {
    const violations: ComputationViolation[] = [];

    for (const fileAST of rendererAST) {
      if (!this.isRendererModule(fileAST.path)) {
        continue;
      }

      const computationViolations = this.analyzeComputations(fileAST);
      violations.push(...computationViolations);
    }

    return violations;
  }

  /**
   * Ensure renderer responsibility boundaries are strictly maintained (Spec-3.5)
   */
  validateRendererResponsibilities(rendererModules: ModuleInfo[]): ComputationViolation[] {
    const violations: ComputationViolation[] = [];

    for (const module of rendererModules) {
      const responsibilityViolations = this.checkResponsibilityBoundaries(module);
      violations.push(...responsibilityViolations);
    }

    return violations;
  }

  // Private helper methods

  private analyzeModuleInputs(module: ModuleInfo): string[] {
    const violations: string[] = [];
    const inputs = this.extractModuleInputs(module);

    for (const input of inputs) {
      if (!this.isAllowedInput(input)) {
        violations.push(`Forbidden input: ${input}`);
      }
    }

    return violations;
  }

  private extractModuleInputs(module: ModuleInfo): string[] {
    // Extract inputs from module imports and dependencies
    const inputs: string[] = [];
    
    // Add imports as potential inputs
    inputs.push(...module.imports);
    
    // Add dependencies as potential inputs
    inputs.push(...module.dependencies);
    
    return inputs;
  }

  private isAllowedInput(input: string): boolean {
    return this.ALLOWED_RENDERER_INPUTS.some(allowed => 
      input.toLowerCase().includes(allowed.toLowerCase())
    );
  }

  private findPhysicsConceptsInCode(code: string): string[] {
    const detectedConcepts: string[] = [];
    
    for (const concept of this.FORBIDDEN_PHYSICS_CONCEPTS) {
      const regex = new RegExp(`\\b${concept}\\b`, 'gi');
      if (regex.test(code)) {
        detectedConcepts.push(concept);
      }
    }

    return detectedConcepts;
  }

  private isRendererModule(modulePath: string): boolean {
    return this.RENDERER_MODULE_PATTERNS.some(pattern => 
      pattern.test(modulePath)
    );
  }

  private checkImportViolations(importInfo: ImportInfo): ImportViolation[] {
    const violations: ImportViolation[] = [];

    for (const pattern of this.FORBIDDEN_IMPORT_PATTERNS) {
      if (pattern.test(importInfo.source)) {
        violations.push({
          importedModule: importInfo.source,
          reason: `Renderer should not import physics/astronomy modules: ${importInfo.source}`,
          severity: 'error'
        });
      }
    }

    return violations;
  }

  private getForbiddenImportPatterns(): string[] {
    return this.FORBIDDEN_IMPORT_PATTERNS.map(pattern => pattern.source);
  }

  private analyzeComputations(fileAST: GovernanceFileAST): ComputationViolation[] {
    const violations: ComputationViolation[] = [];

    // Check for forbidden computations in functions
    for (const func of fileAST.functions || []) {
      const computationViolations = this.checkFunctionComputations(func, fileAST.path);
      violations.push(...computationViolations);
    }

    // Check for forbidden computations in general code
    for (const computation of fileAST.computations || []) {
      if (this.isForbiddenComputation(computation)) {
        violations.push({
          rendererModule: fileAST.path,
          computationType: this.getComputationType(computation),
          description: `Forbidden computation in renderer: ${computation.description}`,
          location: computation.location,
          suggestedFix: this.suggestComputationFix(computation)
        });
      }
    }

    // Additional checks for specific computation patterns
    const additionalViolations = this.detectSpecificComputationPatterns(fileAST);
    violations.push(...additionalViolations);

    return violations;
  }

  private checkFunctionComputations(func: FunctionInfo, modulePath: string): ComputationViolation[] {
    const violations: ComputationViolation[] = [];

    // Check function name for physics-related computations
    if (this.isForbiddenFunctionName(func.name)) {
      violations.push({
        rendererModule: modulePath,
        computationType: 'physics_derivation',
        description: `Renderer function should not perform physics calculations: ${func.name}`,
        location: func.location,
        suggestedFix: `Move ${func.name} to physics layer and pass result as input parameter`
      });
    }

    return violations;
  }

  private isForbiddenComputation(computation: ComputationInfo): boolean {
    const forbiddenTypes = ['physics', 'trigonometric'];
    return forbiddenTypes.includes(computation.type);
  }

  private getComputationType(computation: ComputationInfo): 'angle' | 'period' | 'physics_derivation' {
    if (computation.type === 'trigonometric') return 'angle';
    if (computation.description.includes('period')) return 'period';
    return 'physics_derivation';
  }

  private suggestComputationFix(computation: ComputationInfo): string {
    switch (computation.type) {
      case 'trigonometric':
        return 'Move angle calculations to physics layer and pass computed rotation matrix';
      case 'physics':
        return 'Move physics calculations to appropriate physics/astronomy layer';
      default:
        return 'Move computation logic out of renderer to maintain stupidity';
    }
  }

  private isForbiddenFunctionName(name: string): boolean {
    const forbiddenPatterns = [
      /calculate.*angle/i,
      /compute.*period/i,
      /derive.*physics/i,
      /orbital/i,
      /kepler/i,
      /ephemeris/i,
      /axial.*tilt/i,
      /rotation.*period/i
    ];

    return forbiddenPatterns.some(pattern => pattern.test(name));
  }

  /**
   * Detect specific computation patterns that indicate renderer intelligence (Spec-3.4, 3.5)
   */
  private detectSpecificComputationPatterns(fileAST: GovernanceFileAST): ComputationViolation[] {
    const violations: ComputationViolation[] = [];

    // Check for angle calculations
    const angleViolations = this.detectAngleCalculations(fileAST);
    violations.push(...angleViolations);

    // Check for period calculations
    const periodViolations = this.detectPeriodCalculations(fileAST);
    violations.push(...periodViolations);

    // Check for physics derivations
    const physicsViolations = this.detectPhysicsDerivations(fileAST);
    violations.push(...physicsViolations);

    // Check for data interpretation logic
    const interpretationViolations = this.detectDataInterpretation(fileAST);
    violations.push(...interpretationViolations);

    return violations;
  }

  /**
   * Detect angle calculations in renderer code
   */
  private detectAngleCalculations(fileAST: GovernanceFileAST): ComputationViolation[] {
    const violations: ComputationViolation[] = [];
    
    // Patterns that indicate angle calculations
    const anglePatterns = [
      /Math\.sin\(/,
      /Math\.cos\(/,
      /Math\.tan\(/,
      /Math\.atan2\(/,
      /Math\.asin\(/,
      /Math\.acos\(/,
      /\.toRadians\(/,
      /\.toDegrees\(/,
      /\* Math\.PI/,
      /\/ 180 \* Math\.PI/,
      /\* 180 \/ Math\.PI/
    ];

    // This would analyze the AST for these patterns
    // For now, we'll create a placeholder violation
    if (this.containsAngleCalculationPatterns(fileAST, anglePatterns)) {
      violations.push({
        rendererModule: fileAST.path,
        computationType: 'angle',
        description: 'Renderer contains angle calculations (trigonometric functions)',
        location: { file: fileAST.path, line: 1, column: 1 },
        suggestedFix: 'Move angle calculations to physics layer and pass computed rotation matrix to renderer'
      });
    }

    return violations;
  }

  /**
   * Detect period calculations in renderer code
   */
  private detectPeriodCalculations(fileAST: GovernanceFileAST): ComputationViolation[] {
    const violations: ComputationViolation[] = [];
    
    // Patterns that indicate period calculations
    const periodPatterns = [
      /rotationPeriod/i,
      /orbitalPeriod/i,
      /period.*calculation/i,
      /time.*rotation/i,
      /angular.*velocity/i,
      /revolution/i,
      /cycle.*time/i
    ];

    if (this.containsPeriodCalculationPatterns(fileAST, periodPatterns)) {
      violations.push({
        rendererModule: fileAST.path,
        computationType: 'period',
        description: 'Renderer contains period calculations or references',
        location: { file: fileAST.path, line: 1, column: 1 },
        suggestedFix: 'Move period calculations to astronomy layer and pass computed time values to renderer'
      });
    }

    return violations;
  }

  /**
   * Detect physics derivations in renderer code
   */
  private detectPhysicsDerivations(fileAST: GovernanceFileAST): ComputationViolation[] {
    const violations: ComputationViolation[] = [];
    
    // Patterns that indicate physics derivations
    const physicsPatterns = [
      /kepler/i,
      /orbital.*mechanics/i,
      /gravitational/i,
      /celestial.*mechanics/i,
      /ephemeris/i,
      /astronomical.*unit/i,
      /light.*year/i,
      /parsec/i,
      /solar.*mass/i
    ];

    if (this.containsPhysicsDerivationPatterns(fileAST, physicsPatterns)) {
      violations.push({
        rendererModule: fileAST.path,
        computationType: 'physics_derivation',
        description: 'Renderer contains physics derivations or astronomical calculations',
        location: { file: fileAST.path, line: 1, column: 1 },
        suggestedFix: 'Move physics derivations to physics/astronomy layers and pass computed results to renderer'
      });
    }

    return violations;
  }

  /**
   * Detect data interpretation logic in renderer code
   */
  private detectDataInterpretation(fileAST: GovernanceFileAST): ComputationViolation[] {
    const violations: ComputationViolation[] = [];
    
    // Patterns that indicate data interpretation
    const interpretationPatterns = [
      /interpret.*data/i,
      /parse.*ephemeris/i,
      /convert.*coordinates/i,
      /transform.*reference.*frame/i,
      /coordinate.*system/i,
      /reference.*frame.*conversion/i
    ];

    if (this.containsDataInterpretationPatterns(fileAST, interpretationPatterns)) {
      violations.push({
        rendererModule: fileAST.path,
        computationType: 'physics_derivation',
        description: 'Renderer contains data interpretation logic',
        location: { file: fileAST.path, line: 1, column: 1 },
        suggestedFix: 'Move data interpretation to appropriate data processing layer and pass interpreted results to renderer'
      });
    }

    return violations;
  }

  // Helper methods for pattern detection
  private containsAngleCalculationPatterns(fileAST: GovernanceFileAST, patterns: RegExp[]): boolean {
    // This would analyze the actual AST content
    // For now, return false as placeholder
    return false;
  }

  private containsPeriodCalculationPatterns(fileAST: GovernanceFileAST, patterns: RegExp[]): boolean {
    // This would analyze the actual AST content
    // For now, return false as placeholder
    return false;
  }

  private containsPhysicsDerivationPatterns(fileAST: GovernanceFileAST, patterns: RegExp[]): boolean {
    // This would analyze the actual AST content
    // For now, return false as placeholder
    return false;
  }

  private containsDataInterpretationPatterns(fileAST: GovernanceFileAST, patterns: RegExp[]): boolean {
    // This would analyze the actual AST content
    // For now, return false as placeholder
    return false;
  }

  /**
   * Check responsibility boundaries for renderer modules (Spec-3.5)
   */
  private checkResponsibilityBoundaries(module: ModuleInfo): ComputationViolation[] {
    const violations: ComputationViolation[] = [];

    // Check if renderer is doing non-rendering work
    const forbiddenResponsibilities = this.detectForbiddenResponsibilities(module);
    
    for (const responsibility of forbiddenResponsibilities) {
      violations.push({
        rendererModule: module.path,
        computationType: 'physics_derivation',
        description: `Renderer has forbidden responsibility: ${responsibility}`,
        location: { file: module.path, line: 1, column: 1 },
        suggestedFix: `Move ${responsibility} responsibility to appropriate layer and maintain strict renderer boundaries`
      });
    }

    return violations;
  }

  /**
   * Detect forbidden responsibilities in renderer modules
   */
  private detectForbiddenResponsibilities(module: ModuleInfo): string[] {
    const forbiddenResponsibilities: string[] = [];

    // Check exports for forbidden functionality
    for (const exportName of module.exports) {
      if (this.isForbiddenRendererExport(exportName)) {
        forbiddenResponsibilities.push(`Exporting physics/astronomy functionality: ${exportName}`);
      }
    }

    // Check imports for signs of mixed responsibilities
    for (const importName of module.imports) {
      if (this.indicatesMixedResponsibilities(importName)) {
        forbiddenResponsibilities.push(`Mixed responsibilities indicated by import: ${importName}`);
      }
    }

    return forbiddenResponsibilities;
  }

  /**
   * Check if an export name indicates forbidden renderer functionality
   */
  private isForbiddenRendererExport(exportName: string): boolean {
    const forbiddenExportPatterns = [
      /calculate/i,
      /compute/i,
      /derive/i,
      /physics/i,
      /astronomy/i,
      /orbital/i,
      /kepler/i,
      /ephemeris/i,
      /period/i,
      /tilt/i,
      /reference.*frame/i
    ];

    return forbiddenExportPatterns.some(pattern => pattern.test(exportName));
  }

  /**
   * Check if an import indicates mixed responsibilities
   */
  private indicatesMixedResponsibilities(importName: string): boolean {
    const mixedResponsibilityPatterns = [
      /physics.*and.*render/i,
      /astronomy.*render/i,
      /compute.*display/i,
      /calculate.*visual/i
    ];

    return mixedResponsibilityPatterns.some(pattern => pattern.test(importName));
  }
}

// Factory function for creating renderer stupidity checker
export function createRendererStupidityChecker(): RendererStupidityChecker {
  return new RendererStupidityCheckerImpl();
}

// Utility functions for renderer analysis
export function isRendererFile(filePath: string): boolean {
  const rendererPatterns = [
    /components\/canvas/,
    /3d/,
    /render/,
    /visual/,
    /display/,
    /graphics/,
    /scene/,
    /mesh/,
    /material/,
    /texture/,
    /shader/
  ];

  return rendererPatterns.some(pattern => pattern.test(filePath));
}

export function extractRendererViolations(
  inputViolations: RendererInputViolation[],
  knowledgeViolations: PhysicsKnowledgeViolation[],
  importViolations: RendererImportViolation[],
  computationViolations: ComputationViolation[]
): RendererViolation[] {
  const violations: RendererViolation[] = [];

  // Convert input violations
  for (const violation of inputViolations) {
    violations.push({
      specNumber: 'Spec-3',
      violationType: ViolationType.RENDERER_INTELLIGENCE,
      location: violation.location,
      description: `Renderer accepts forbidden inputs: ${violation.violations.join(', ')}`,
      governanceReference: 'Spec-3.1: Renderers should only accept position vectors, attitude matrices, and visual parameters',
      severity: ViolationSeverity.HIGH,
      detectedAt: new Date(),
      fixAttempts: 0,
      rendererModule: violation.rendererModule,
      intelligenceType: RendererIntelligenceType.INVALID_INPUT
    });
  }

  // Convert knowledge violations
  for (const violation of knowledgeViolations) {
    violations.push({
      specNumber: 'Spec-3',
      violationType: ViolationType.RENDERER_INTELLIGENCE,
      location: violation.location,
      description: `Renderer has forbidden physics knowledge: ${violation.detectedConcepts.join(', ')}`,
      governanceReference: 'Spec-3.2, 3.3: Renderers should not know about axial tilt, periods, or reference frames',
      severity: ViolationSeverity.CRITICAL,
      detectedAt: new Date(),
      fixAttempts: 0,
      rendererModule: violation.rendererModule,
      intelligenceType: RendererIntelligenceType.PHYSICS_KNOWLEDGE
    });
  }

  // Convert import violations
  for (const violation of importViolations) {
    violations.push({
      specNumber: 'Spec-3',
      violationType: ViolationType.RENDERER_INTELLIGENCE,
      location: violation.location,
      description: `Renderer imports forbidden modules: ${violation.actualImports.join(', ')}`,
      governanceReference: 'Spec-3.2: Renderers should not import physics constants or computation modules',
      severity: ViolationSeverity.HIGH,
      detectedAt: new Date(),
      fixAttempts: 0,
      rendererModule: violation.rendererModule,
      intelligenceType: RendererIntelligenceType.FORBIDDEN_IMPORT
    });
  }

  // Convert computation violations
  for (const violation of computationViolations) {
    violations.push({
      specNumber: 'Spec-3',
      violationType: ViolationType.RENDERER_INTELLIGENCE,
      location: violation.location,
      description: `Renderer performs forbidden computation: ${violation.description}`,
      governanceReference: 'Spec-3.4, 3.5: Renderers should not perform angle calculations, period computations, or physics derivations',
      severity: ViolationSeverity.HIGH,
      detectedAt: new Date(),
      fixAttempts: 0,
      rendererModule: violation.rendererModule,
      intelligenceType: RendererIntelligenceType.COMPUTATION_LOGIC
    });
  }

  return violations;
}