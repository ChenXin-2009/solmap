// Layer Separation Validator - Implements Spec-6 governance compliance
// Validates architecture layer boundaries and enforces strict separation

import {
  LayerSeparationValidator as ILayerSeparationValidator,
  DependencyViolation,
  ResponsibilityViolation
} from './governance-interfaces';

import {
  LayerViolation,
  CrossLayerImport,
  ArchitectureLayer,
  LayerViolationType,
  ViolationType,
  ViolationSeverity,
  ArchitectureLayerDefinition,
  LayerOperation
} from './governance-types';

import {
  ProjectAST,
  DependencyGraph,
  ModuleInfo,
  SourceLocation
} from './types';

export class LayerSeparationValidator implements ILayerSeparationValidator {
  private layerDefinitions: Map<ArchitectureLayer, ArchitectureLayerDefinition>;

  constructor() {
    this.layerDefinitions = this.initializeLayerDefinitions();
  }

  /**
   * Initialize architecture layer definitions according to SolMap governance
   */
  private initializeLayerDefinitions(): Map<ArchitectureLayer, ArchitectureLayerDefinition> {
    const definitions = new Map<ArchitectureLayer, ArchitectureLayerDefinition>();

    // RENDERING layer - must remain stupid, only render
    definitions.set(ArchitectureLayer.RENDERING, {
      name: ArchitectureLayer.RENDERING,
      allowedDependencies: [ArchitectureLayer.INFRASTRUCTURE],
      forbiddenImports: [
        'lib/astronomy/constants/*',
        'lib/axial-tilt/*',
        'lib/astronomy/orbit.ts',
        'lib/astronomy/time.ts'
      ],
      allowedOperations: [LayerOperation.RENDER_ONLY],
      responsibilityBoundaries: [
        'Accept position vectors and attitude matrices',
        'Render visual elements only',
        'No physics calculations',
        'No knowledge of physical constants'
      ]
    });

    // PHYSICS layer - handles physics calculations
    definitions.set(ArchitectureLayer.PHYSICS, {
      name: ArchitectureLayer.PHYSICS,
      allowedDependencies: [
        ArchitectureLayer.ASTRONOMY,
        ArchitectureLayer.CONSTANTS,
        ArchitectureLayer.INFRASTRUCTURE
      ],
      forbiddenImports: [
        'src/components/canvas/*',
        'src/components/*'
      ],
      allowedOperations: [LayerOperation.COMPUTE_PHYSICS],
      responsibilityBoundaries: [
        'Physics calculations and transformations',
        'Coordinate system conversions',
        'Force and motion calculations',
        'No rendering logic'
      ]
    });

    // ASTRONOMY layer - handles astronomical calculations
    definitions.set(ArchitectureLayer.ASTRONOMY, {
      name: ArchitectureLayer.ASTRONOMY,
      allowedDependencies: [
        ArchitectureLayer.CONSTANTS,
        ArchitectureLayer.INFRASTRUCTURE
      ],
      forbiddenImports: [
        'src/components/*',
        'src/lib/3d/*'
      ],
      allowedOperations: [LayerOperation.COMPUTE_PHYSICS],
      responsibilityBoundaries: [
        'Orbital mechanics calculations',
        'Time and ephemeris calculations',
        'Astronomical coordinate systems',
        'No rendering or UI logic'
      ]
    });

    // CONSTANTS layer - pure constants only
    definitions.set(ArchitectureLayer.CONSTANTS, {
      name: ArchitectureLayer.CONSTANTS,
      allowedDependencies: [], // No dependencies allowed
      forbiddenImports: ['*'], // No imports allowed except types
      allowedOperations: [LayerOperation.DEFINE_CONSTANTS],
      responsibilityBoundaries: [
        'Define physical and astronomical constants',
        'Frozen objects only',
        'No logic or calculations',
        'No imports except type definitions'
      ]
    });

    // INFRASTRUCTURE layer - cross-cutting concerns
    definitions.set(ArchitectureLayer.INFRASTRUCTURE, {
      name: ArchitectureLayer.INFRASTRUCTURE,
      allowedDependencies: [], // Can be used by all, depends on none
      forbiddenImports: [
        'src/components/*',
        'lib/astronomy/constants/*',
        'lib/axial-tilt/*'
      ],
      allowedOperations: [LayerOperation.MANAGE_INFRASTRUCTURE],
      responsibilityBoundaries: [
        'Event bus and messaging',
        'Service registry',
        'Local storage management',
        'Cross-cutting infrastructure concerns'
      ]
    });

    return definitions;
  }

  /**
   * Public method to get layer definitions for external use
   */
  getLayerDefinitions(): Map<ArchitectureLayer, ArchitectureLayerDefinition> {
    return new Map(this.layerDefinitions);
  }

  /**
   * Validate layer boundaries across the entire project
   */
  validateLayerBoundaries(ast: ProjectAST): LayerViolation[] {
    const violations: LayerViolation[] = [];

    for (const module of ast.modules) {
      const moduleLayer = this.getModuleLayer(module.path);
      const layerDef = this.layerDefinitions.get(moduleLayer);

      if (!layerDef) {
        continue;
      }

      // Check each import for layer violations
      for (const importPath of module.imports) {
        const importedLayer = this.getModuleLayer(importPath);
        
        // Check if this dependency is allowed
        if (!layerDef.allowedDependencies.includes(importedLayer)) {
          violations.push({
            specNumber: 'Spec-6',
            violationType: ViolationType.LAYER_SEPARATION_VIOLATION,
            location: this.createSourceLocation(module.path, 1, 1),
            description: `Layer ${moduleLayer} cannot depend on layer ${importedLayer}`,
            governanceReference: 'Spec-6: Architecture layer separation must be strictly enforced',
            severity: ViolationSeverity.HIGH,
            detectedAt: new Date(),
            fixAttempts: 0,
            violatingModule: module.path,
            targetLayer: importedLayer,
            sourceLayer: moduleLayer,
            layerViolationType: LayerViolationType.CROSS_LAYER_IMPORT
          });
        }

        // Check forbidden import patterns
        if (this.isForbiddenImport(importPath, layerDef.forbiddenImports)) {
          violations.push({
            specNumber: 'Spec-6',
            violationType: ViolationType.LAYER_SEPARATION_VIOLATION,
            location: this.createSourceLocation(module.path, 1, 1),
            description: `Module ${module.path} has forbidden import: ${importPath}`,
            governanceReference: 'Spec-6: Forbidden imports violate layer separation',
            severity: ViolationSeverity.CRITICAL,
            detectedAt: new Date(),
            fixAttempts: 0,
            violatingModule: module.path,
            targetLayer: importedLayer,
            sourceLayer: moduleLayer,
            layerViolationType: LayerViolationType.CROSS_LAYER_IMPORT
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check for cross-layer imports in dependency graph
   */
  checkCrossLayerImports(dependencies: DependencyGraph): CrossLayerImport[] {
    const crossLayerImports: CrossLayerImport[] = [];

    for (const edge of dependencies.edges) {
      const fromLayer = this.getModuleLayer(edge.from);
      const toLayer = this.getModuleLayer(edge.to);

      if (fromLayer !== toLayer) {
        const fromLayerDef = this.layerDefinitions.get(fromLayer);
        
        if (fromLayerDef && !fromLayerDef.allowedDependencies.includes(toLayer)) {
          crossLayerImports.push({
            importingModule: edge.from,
            importedModule: edge.to,
            importingLayer: fromLayer,
            importedLayer: toLayer,
            location: this.createSourceLocation(edge.from, 1, 1)
          });
        }
      }
    }

    return crossLayerImports;
  }

  /**
   * Validate dependency direction follows architecture rules
   */
  validateDependencyDirection(dependencies: DependencyGraph): DependencyViolation[] {
    const violations: DependencyViolation[] = [];

    for (const edge of dependencies.edges) {
      const fromLayer = this.getModuleLayer(edge.from);
      const toLayer = this.getModuleLayer(edge.to);

      // Check if this dependency direction is allowed
      if (!this.isDependencyDirectionAllowed(fromLayer, toLayer)) {
        violations.push({
          fromModule: edge.from,
          toModule: edge.to,
          fromLayer,
          toLayer,
          violationType: 'wrong_direction',
          location: this.createSourceLocation(edge.from, 1, 1)
        });
      }

      // Special check for constants layer - should not depend on anything
      if (fromLayer === ArchitectureLayer.CONSTANTS && toLayer !== ArchitectureLayer.CONSTANTS) {
        violations.push({
          fromModule: edge.from,
          toModule: edge.to,
          fromLayer,
          toLayer,
          violationType: 'forbidden_dependency',
          location: this.createSourceLocation(edge.from, 1, 1)
        });
      }
    }

    return violations;
  }

  /**
   * Check single responsibility principle for modules
   */
  checkSingleResponsibility(modules: ModuleInfo[]): ResponsibilityViolation[] {
    const violations: ResponsibilityViolation[] = [];

    for (const module of modules) {
      const layer = this.getModuleLayer(module.path);
      const layerDef = this.layerDefinitions.get(layer);

      if (!layerDef) {
        continue;
      }

      const actualResponsibilities = this.analyzeModuleResponsibilities(module);
      const mixedConcerns = this.findMixedConcerns(actualResponsibilities, layerDef);

      if (mixedConcerns.length > 0) {
        violations.push({
          module: module.path,
          expectedResponsibilities: layerDef.responsibilityBoundaries,
          actualResponsibilities,
          mixedConcerns,
          location: this.createSourceLocation(module.path, 1, 1)
        });
      }

      // Additional checks for specific layer violations
      const specificViolations = this.checkLayerSpecificResponsibilities(module, layer);
      violations.push(...specificViolations);
    }

    return violations;
  }

  /**
   * Determine which architecture layer a module belongs to
   */
  getModuleLayer(modulePath: string): ArchitectureLayer {
    // Normalize path separators
    const normalizedPath = modulePath.replace(/\\/g, '/');

    // RENDERING layer patterns
    if (normalizedPath.includes('src/components/canvas/') ||
        normalizedPath.includes('src/components/') ||
        normalizedPath.includes('src/lib/3d/')) {
      return ArchitectureLayer.RENDERING;
    }

    // CONSTANTS layer patterns
    if (normalizedPath.includes('lib/astronomy/constants/') ||
        normalizedPath.includes('constants/')) {
      return ArchitectureLayer.CONSTANTS;
    }

    // PHYSICS layer patterns
    if (normalizedPath.includes('lib/axial-tilt/') ||
        normalizedPath.includes('lib/physics/') ||
        normalizedPath.includes('lib/space-time-foundation/')) {
      return ArchitectureLayer.PHYSICS;
    }

    // ASTRONOMY layer patterns
    if (normalizedPath.includes('lib/astronomy/') &&
        !normalizedPath.includes('lib/astronomy/constants/')) {
      return ArchitectureLayer.ASTRONOMY;
    }

    // INFRASTRUCTURE layer patterns
    if (normalizedPath.includes('lib/infrastructure/') ||
        normalizedPath.includes('lib/config/') ||
        normalizedPath.includes('lib/state.ts')) {
      return ArchitectureLayer.INFRASTRUCTURE;
    }

    // Default to INFRASTRUCTURE for unclassified modules
    return ArchitectureLayer.INFRASTRUCTURE;
  }

  // Private helper methods

  private checkLayerSpecificResponsibilities(module: ModuleInfo, layer: ArchitectureLayer): ResponsibilityViolation[] {
    const violations: ResponsibilityViolation[] = [];

    switch (layer) {
      case ArchitectureLayer.RENDERING:
        violations.push(...this.checkRenderingLayerResponsibilities(module));
        break;
      case ArchitectureLayer.CONSTANTS:
        violations.push(...this.checkConstantsLayerResponsibilities(module));
        break;
      case ArchitectureLayer.PHYSICS:
        violations.push(...this.checkPhysicsLayerResponsibilities(module));
        break;
      case ArchitectureLayer.ASTRONOMY:
        violations.push(...this.checkAstronomyLayerResponsibilities(module));
        break;
    }

    return violations;
  }

  private checkRenderingLayerResponsibilities(module: ModuleInfo): ResponsibilityViolation[] {
    const violations: ResponsibilityViolation[] = [];
    const forbiddenResponsibilities: string[] = [];

    if (this.hasPhysicsCalculations(module)) {
      forbiddenResponsibilities.push('Physics calculations found in rendering layer');
    }

    if (this.hasConstantDefinitions(module)) {
      forbiddenResponsibilities.push('Constant definitions found in rendering layer');
    }

    if (this.hasAstronomicalCalculations(module)) {
      forbiddenResponsibilities.push('Astronomical calculations found in rendering layer');
    }

    if (forbiddenResponsibilities.length > 0) {
      violations.push({
        module: module.path,
        expectedResponsibilities: ['Render visual elements only', 'Accept position vectors and matrices'],
        actualResponsibilities: forbiddenResponsibilities,
        mixedConcerns: forbiddenResponsibilities,
        location: this.createSourceLocation(module.path, 1, 1)
      });
    }

    return violations;
  }

  private checkConstantsLayerResponsibilities(module: ModuleInfo): ResponsibilityViolation[] {
    const violations: ResponsibilityViolation[] = [];
    const forbiddenResponsibilities: string[] = [];

    if (this.hasLogicCode(module)) {
      forbiddenResponsibilities.push('Logic code found in constants layer');
    }

    if (this.hasFunctionDefinitions(module)) {
      forbiddenResponsibilities.push('Function definitions found in constants layer');
    }

    if (this.hasComputations(module)) {
      forbiddenResponsibilities.push('Computations found in constants layer');
    }

    if (forbiddenResponsibilities.length > 0) {
      violations.push({
        module: module.path,
        expectedResponsibilities: ['Define constants only', 'Frozen objects only', 'No logic or calculations'],
        actualResponsibilities: forbiddenResponsibilities,
        mixedConcerns: forbiddenResponsibilities,
        location: this.createSourceLocation(module.path, 1, 1)
      });
    }

    return violations;
  }

  private checkPhysicsLayerResponsibilities(module: ModuleInfo): ResponsibilityViolation[] {
    const violations: ResponsibilityViolation[] = [];
    const forbiddenResponsibilities: string[] = [];

    if (this.hasRenderingLogic(module)) {
      forbiddenResponsibilities.push('Rendering logic found in physics layer');
    }

    if (this.hasUIComponents(module)) {
      forbiddenResponsibilities.push('UI components found in physics layer');
    }

    if (forbiddenResponsibilities.length > 0) {
      violations.push({
        module: module.path,
        expectedResponsibilities: ['Physics calculations only', 'Coordinate transformations', 'No rendering logic'],
        actualResponsibilities: forbiddenResponsibilities,
        mixedConcerns: forbiddenResponsibilities,
        location: this.createSourceLocation(module.path, 1, 1)
      });
    }

    return violations;
  }

  private checkAstronomyLayerResponsibilities(module: ModuleInfo): ResponsibilityViolation[] {
    const violations: ResponsibilityViolation[] = [];
    const forbiddenResponsibilities: string[] = [];

    if (this.hasRenderingLogic(module)) {
      forbiddenResponsibilities.push('Rendering logic found in astronomy layer');
    }

    if (this.has3DGraphicsCode(module)) {
      forbiddenResponsibilities.push('3D graphics code found in astronomy layer');
    }

    if (forbiddenResponsibilities.length > 0) {
      violations.push({
        module: module.path,
        expectedResponsibilities: ['Astronomical calculations only', 'Orbital mechanics', 'Time calculations'],
        actualResponsibilities: forbiddenResponsibilities,
        mixedConcerns: forbiddenResponsibilities,
        location: this.createSourceLocation(module.path, 1, 1)
      });
    }

    return violations;
  }

  private isForbiddenImport(importPath: string, forbiddenPatterns: string[]): boolean {
    const normalizedImport = importPath.replace(/\\/g, '/');

    return forbiddenPatterns.some(pattern => {
      if (pattern === '*') {
        return true;
      }
      
      if (pattern.endsWith('/*')) {
        const basePattern = pattern.slice(0, -2);
        return normalizedImport.startsWith(basePattern);
      }
      
      return normalizedImport === pattern || normalizedImport.endsWith('/' + pattern);
    });
  }

  private isDependencyDirectionAllowed(fromLayer: ArchitectureLayer, toLayer: ArchitectureLayer): boolean {
    const fromLayerDef = this.layerDefinitions.get(fromLayer);
    return fromLayerDef ? fromLayerDef.allowedDependencies.includes(toLayer) : false;
  }

  private analyzeModuleResponsibilities(module: ModuleInfo): string[] {
    const responsibilities: string[] = [];

    if (module.exports.some(exp => exp.includes('render') || exp.includes('canvas') || exp.includes('3d'))) {
      responsibilities.push('Rendering logic');
    }

    if (module.exports.some(exp => exp.includes('physics') || exp.includes('force') || exp.includes('motion'))) {
      responsibilities.push('Physics calculations');
    }

    if (module.exports.some(exp => exp.includes('orbit') || exp.includes('ephemeris') || exp.includes('time'))) {
      responsibilities.push('Astronomical calculations');
    }

    if (module.exports.some(exp => exp.includes('constant') || exp.includes('CONST'))) {
      responsibilities.push('Constant definitions');
    }

    if (module.exports.some(exp => exp.includes('event') || exp.includes('service') || exp.includes('storage'))) {
      responsibilities.push('Infrastructure services');
    }

    if (module.imports.some(imp => imp.includes('constants') && imp.includes('render'))) {
      responsibilities.push('Mixed rendering and constants');
    }

    return responsibilities;
  }

  private findMixedConcerns(actualResponsibilities: string[], layerDef: ArchitectureLayerDefinition): string[] {
    const mixedConcerns: string[] = [];

    for (const responsibility of actualResponsibilities) {
      let belongsToLayer = false;

      for (const boundary of layerDef.responsibilityBoundaries) {
        if (this.responsibilityMatchesBoundary(responsibility, boundary)) {
          belongsToLayer = true;
          break;
        }
      }

      if (!belongsToLayer) {
        mixedConcerns.push(responsibility);
      }
    }

    return mixedConcerns;
  }

  private responsibilityMatchesBoundary(responsibility: string, boundary: string): boolean {
    const respLower = responsibility.toLowerCase();
    const boundaryLower = boundary.toLowerCase();
    const keywords = boundaryLower.split(' ');
    return keywords.some(keyword => respLower.includes(keyword));
  }

  private createSourceLocation(file: string, line: number, column: number): SourceLocation {
    return { file, line, column };
  }

  // Helper methods for responsibility analysis
  private hasPhysicsCalculations(module: ModuleInfo): boolean {
    return module.exports.some(exp => 
      exp.toLowerCase().includes('physics') ||
      exp.toLowerCase().includes('force') ||
      exp.toLowerCase().includes('motion') ||
      exp.toLowerCase().includes('velocity') ||
      exp.toLowerCase().includes('acceleration')
    ) || module.imports.some(imp => 
      imp.includes('physics') ||
      imp.includes('axial-tilt') ||
      imp.includes('orbital')
    );
  }

  private hasConstantDefinitions(module: ModuleInfo): boolean {
    return module.exports.some(exp => 
      exp.toUpperCase() === exp ||
      exp.toLowerCase().includes('constant') ||
      exp.toLowerCase().includes('const')
    );
  }

  private hasAstronomicalCalculations(module: ModuleInfo): boolean {
    return module.exports.some(exp => 
      exp.toLowerCase().includes('orbit') ||
      exp.toLowerCase().includes('ephemeris') ||
      exp.toLowerCase().includes('time') ||
      exp.toLowerCase().includes('julian') ||
      exp.toLowerCase().includes('vsop')
    ) || module.imports.some(imp => 
      imp.includes('astronomy') ||
      imp.includes('ephemeris') ||
      imp.includes('vsop')
    );
  }

  private hasLogicCode(module: ModuleInfo): boolean {
    return module.exports.some(exp => 
      exp.toLowerCase().includes('if') ||
      exp.toLowerCase().includes('switch') ||
      exp.toLowerCase().includes('calculate') ||
      exp.toLowerCase().includes('compute')
    );
  }

  private hasFunctionDefinitions(module: ModuleInfo): boolean {
    return module.exports.some(exp => 
      exp.toLowerCase().includes('function') ||
      exp.toLowerCase().includes('method') ||
      exp.endsWith('()') ||
      exp.toLowerCase().includes('calculate') ||
      exp.toLowerCase().includes('compute') ||
      exp.toLowerCase().includes('get') ||
      exp.toLowerCase().includes('set')
    );
  }

  private hasComputations(module: ModuleInfo): boolean {
    return module.exports.some(exp => 
      exp.toLowerCase().includes('calc') ||
      exp.toLowerCase().includes('compute') ||
      exp.toLowerCase().includes('transform') ||
      exp.toLowerCase().includes('convert')
    );
  }

  private hasRenderingLogic(module: ModuleInfo): boolean {
    return module.exports.some(exp => 
      exp.toLowerCase().includes('render') ||
      exp.toLowerCase().includes('draw') ||
      exp.toLowerCase().includes('canvas') ||
      exp.toLowerCase().includes('webgl') ||
      exp.toLowerCase().includes('three') ||
      exp.toLowerCase().includes('mesh') ||
      exp.toLowerCase().includes('material')
    ) || module.imports.some(imp => 
      imp.includes('three') ||
      imp.includes('canvas') ||
      imp.includes('webgl') ||
      imp.includes('components')
    );
  }

  private hasUIComponents(module: ModuleInfo): boolean {
    return module.exports.some(exp => 
      exp.toLowerCase().includes('component') ||
      exp.toLowerCase().includes('button') ||
      exp.toLowerCase().includes('panel') ||
      exp.toLowerCase().includes('menu') ||
      exp.toLowerCase().includes('ui')
    ) || module.imports.some(imp => 
      imp.includes('react') ||
      imp.includes('components') ||
      imp.includes('ui')
    );
  }

  private has3DGraphicsCode(module: ModuleInfo): boolean {
    return module.exports.some(exp => 
      exp.toLowerCase().includes('3d') ||
      exp.toLowerCase().includes('mesh') ||
      exp.toLowerCase().includes('geometry') ||
      exp.toLowerCase().includes('material') ||
      exp.toLowerCase().includes('scene')
    ) || module.imports.some(imp => 
      imp.includes('three') ||
      imp.includes('3d') ||
      imp.includes('webgl')
    );
  }

  /**
   * Validate interface boundaries between modules
   */
  validateInterfaceBoundaries(modules: ModuleInfo[]): ResponsibilityViolation[] {
    const violations: ResponsibilityViolation[] = [];

    for (const module of modules) {
      const interfaceViolations = this.checkInterfaceClarity(module);
      violations.push(...interfaceViolations);
    }

    return violations;
  }

  /**
   * Detect "能跑但结构错误" (works but structurally wrong) code
   */
  detectStructurallyWrongCode(modules: ModuleInfo[]): ResponsibilityViolation[] {
    const violations: ResponsibilityViolation[] = [];

    for (const module of modules) {
      const structuralIssues = this.findStructuralIssues(module);
      if (structuralIssues.length > 0) {
        violations.push({
          module: module.path,
          expectedResponsibilities: ['Architecturally correct implementation'],
          actualResponsibilities: structuralIssues,
          mixedConcerns: structuralIssues,
          location: this.createSourceLocation(module.path, 1, 1)
        });
      }
    }

    return violations;
  }

  private checkInterfaceClarity(module: ModuleInfo): ResponsibilityViolation[] {
    const violations: ResponsibilityViolation[] = [];
    const issues: string[] = [];

    // Check for unclear export names
    const unclearExports = this.findUnclearExports(module.exports);
    if (unclearExports.length > 0) {
      issues.push(`Unclear exports: ${unclearExports.join(', ')}`);
    }

    // Check for too many exports (potential mixed responsibilities)
    if (module.exports.length > 10) {
      issues.push(`Too many exports (${module.exports.length}) - potential mixed responsibilities`);
    }

    // Check for inconsistent naming patterns
    const namingIssues = this.checkNamingConsistency(module.exports);
    if (namingIssues.length > 0) {
      issues.push(...namingIssues);
    }

    if (issues.length > 0) {
      violations.push({
        module: module.path,
        expectedResponsibilities: ['Clear, consistent interface', 'Single responsibility exports'],
        actualResponsibilities: issues,
        mixedConcerns: issues,
        location: this.createSourceLocation(module.path, 1, 1)
      });
    }

    return violations;
  }

  private findStructuralIssues(module: ModuleInfo): string[] {
    const issues: string[] = [];

    // Check for bypassing layer boundaries
    if (this.bypassesLayerBoundaries(module)) {
      issues.push('Bypasses proper layer boundaries');
    }

    // Check for direct access to constants from wrong layers
    if (this.hasDirectConstantAccess(module)) {
      issues.push('Direct access to constants from inappropriate layer');
    }

    // Check for mixed abstraction levels
    if (this.hasMixedAbstractionLevels(module)) {
      issues.push('Mixes different abstraction levels');
    }

    // Check for tight coupling
    if (this.hasTightCoupling(module)) {
      issues.push('Tight coupling between unrelated concerns');
    }

    return issues;
  }

  private findUnclearExports(exports: string[]): string[] {
    const unclearPatterns = [
      /^[a-z]$/, // Single letter exports
      /^temp/i, // Temporary exports
      /^test/i, // Test exports in production code
      /^debug/i, // Debug exports
      /^util/i, // Generic util exports
      /^helper/i // Generic helper exports
    ];

    return exports.filter(exp => 
      unclearPatterns.some(pattern => pattern.test(exp)) ||
      exp.length < 3 // Very short names
    );
  }

  private checkNamingConsistency(exports: string[]): string[] {
    const issues: string[] = [];

    // Check for mixed naming conventions
    const hasCamelCase = exports.some(exp => /^[a-z][a-zA-Z0-9]*$/.test(exp));
    const hasPascalCase = exports.some(exp => /^[A-Z][a-zA-Z0-9]*$/.test(exp));
    const hasSnakeCase = exports.some(exp => /^[a-z][a-z0-9_]*$/.test(exp));
    const hasKebabCase = exports.some(exp => /^[a-z][a-z0-9-]*$/.test(exp));

    const conventionCount = [hasCamelCase, hasPascalCase, hasSnakeCase, hasKebabCase].filter(Boolean).length;
    
    if (conventionCount > 2) {
      issues.push('Mixed naming conventions detected');
    }

    // Check for inconsistent prefixes/suffixes
    const prefixes = new Set<string>();
    const suffixes = new Set<string>();

    exports.forEach(exp => {
      const parts = exp.split(/(?=[A-Z])/);
      if (parts.length > 1) {
        prefixes.add(parts[0]);
        suffixes.add(parts[parts.length - 1]);
      }
    });

    if (prefixes.size > 3) {
      issues.push('Too many different prefixes - inconsistent naming');
    }

    return issues;
  }

  private bypassesLayerBoundaries(module: ModuleInfo): boolean {
    const layer = this.getModuleLayer(module.path);
    
    // Check for direct imports that bypass proper layers
    return module.imports.some(imp => {
      const importLayer = this.getModuleLayer(imp);
      const layerDef = this.layerDefinitions.get(layer);
      
      return layerDef && !layerDef.allowedDependencies.includes(importLayer) && 
             importLayer !== layer;
    });
  }

  private hasDirectConstantAccess(module: ModuleInfo): boolean {
    const layer = this.getModuleLayer(module.path);
    
    if (layer === ArchitectureLayer.RENDERING) {
      return module.imports.some(imp => 
        imp.includes('constants') ||
        imp.includes('axial-tilt') ||
        imp.includes('physical-params')
      );
    }

    return false;
  }

  private hasMixedAbstractionLevels(module: ModuleInfo): boolean {
    const hasHighLevel = module.exports.some(exp => 
      exp.toLowerCase().includes('manager') ||
      exp.toLowerCase().includes('controller') ||
      exp.toLowerCase().includes('service')
    );

    const hasLowLevel = module.exports.some(exp => 
      exp.toLowerCase().includes('buffer') ||
      exp.toLowerCase().includes('array') ||
      exp.toLowerCase().includes('raw') ||
      exp.toLowerCase().includes('byte')
    );

    return hasHighLevel && hasLowLevel;
  }

  private hasTightCoupling(module: ModuleInfo): boolean {
    // Check if module imports from too many different layers
    const importedLayers = new Set(
      module.imports.map(imp => this.getModuleLayer(imp))
    );

    // More than 3 different layers indicates tight coupling
    return importedLayers.size > 3;
  }
}