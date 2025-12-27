// Governance analyzer implementation for SolMap project
// Based on Spec-0 to Spec-8 from .kiro/specs/solmap-ai-governance.md

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { TypeScriptCodeAnalyzer } from './analyzer';
import { GovernanceAnalyzer } from './governance-interfaces';
import { SSOTViolationDetectorImpl } from './ssot-violation-detector';
import {
  GovernanceAnalysis,
  SpecViolation,
  StructuralFailure,
  GovernanceSpec,
  ViolationType,
  ViolationSeverity,
  StructuralFailureType,
  RefactoringUrgency,
  ModificationRecord,
  ComplianceScore,
  ComplianceTrend,
  SSOTViolation
} from './governance-types';
import {
  ProjectAST,
  SourceLocation
} from './types';
import {
  CodeHistory
} from './governance-types';
import {
  GovernanceSpecLoader,
  createSourceLocation,
  isPhysicsConstantFile,
  isRendererFile,
  getModuleLayer
} from './governance-core';

export class GovernanceAnalyzerImpl implements GovernanceAnalyzer {
  private codeAnalyzer: TypeScriptCodeAnalyzer;
  private ssotDetector: SSOTViolationDetectorImpl;
  private governanceSpecs: GovernanceSpec[] = [];

  constructor() {
    this.codeAnalyzer = new TypeScriptCodeAnalyzer();
    this.ssotDetector = new SSOTViolationDetectorImpl();
  }

  async analyzeProject(projectPath: string): Promise<GovernanceAnalysis> {
    // Load governance specifications
    await this.loadGovernanceSpecs(path.join(projectPath, '.kiro/specs/solmap-ai-governance.md'));

    // Parse project AST
    const ast = await this.codeAnalyzer.parseProject(projectPath);

    // Perform all governance checks
    const specViolations = this.validateSpec0Compliance(ast);
    const physicsViolations = this.checkPhysicsSystemPriority(ast);
    const structuralFailures = this.detectStructuralFailures(ast, this.createMockHistory());

    // SSOT violation detection
    const duplicateDefinitions = this.ssotDetector.detectDuplicateDefinitions(ast);
    const physicsConstantViolations = this.ssotDetector.validatePhysicsConstants(ast);
    const authorityViolations = this.ssotDetector.checkAuthorityDefinitions(ast);
    const constantsViolations = this.ssotDetector.validateConstantsDirectory(
      path.join(projectPath, 'src/lib/astronomy/constants')
    );

    // Convert SSOT violations to spec violations
    const ssotViolations: SSOTViolation[] = [];
    
    // Convert duplicate definitions
    for (const duplicate of duplicateDefinitions) {
      ssotViolations.push({
        specNumber: 'Spec-2',
        violationType: ViolationType.SSOT_VIOLATION,
        location: duplicate.authorityLocation,
        description: `Duplicate definition of ${duplicate.concept.name}`,
        governanceReference: 'Spec-2: SSOT 原则强制执行',
        severity: duplicate.violationSeverity,
        detectedAt: new Date(),
        fixAttempts: 0,
        concept: duplicate.concept,
        authorityLocation: duplicate.authorityLocation,
        duplicateLocations: duplicate.duplicateLocations
      });
    }

    // Convert physics constant violations
    for (const violation of physicsConstantViolations) {
      ssotViolations.push({
        specNumber: 'Spec-2',
        violationType: ViolationType.SSOT_VIOLATION,
        location: violation.location,
        description: `Physics constant from non-authority source: ${violation.actualSource}`,
        governanceReference: 'Spec-2: 物理常量必须从权威定义点获取',
        severity: ViolationSeverity.HIGH,
        detectedAt: new Date(),
        fixAttempts: 0,
        concept: {
          name: violation.constantType,
          type: this.mapConstantTypeToConceptType(violation.constantType),
          authoritySource: violation.expectedSource,
          allowedUsagePatterns: [],
          forbiddenContexts: []
        },
        authorityLocation: { file: violation.expectedSource, line: 1, column: 1 },
        duplicateLocations: [violation.location]
      });
    }

    // Convert authority violations
    for (const violation of authorityViolations) {
      ssotViolations.push({
        specNumber: 'Spec-2',
        violationType: ViolationType.SSOT_VIOLATION,
        location: violation.location,
        description: `Physics concept defined outside authority: ${violation.concept.name}`,
        governanceReference: 'Spec-2: 权威定义验证',
        severity: ViolationSeverity.CRITICAL,
        detectedAt: new Date(),
        fixAttempts: 0,
        concept: violation.concept,
        authorityLocation: { file: violation.expectedAuthority, line: 1, column: 1 },
        duplicateLocations: [violation.location]
      });
    }

    // Combine all violations
    const allViolations = [
      ...specViolations,
      ...physicsViolations
    ];

    // Calculate compliance score
    const overallCompliance = this.calculateComplianceScore(allViolations, structuralFailures);

    return {
      specViolations: allViolations,
      ssotViolations,
      layerViolations: [], // Will be implemented in later tasks
      renderingViolations: [], // Will be implemented in later tasks
      magicNumbers: [], // Will be implemented in later tasks
      structuralFailures,
      constantsPollution: [], // Will be implemented in later tasks
      overallCompliance
    };
  }

  validateSpec0Compliance(ast: ProjectAST): SpecViolation[] {
    const violations: SpecViolation[] = [];

    // Check for unique authority definitions (Spec-0 rule)
    const duplicateDefinitions = this.findDuplicatePhysicsDefinitions(ast);
    for (const duplicate of duplicateDefinitions) {
      violations.push({
        specNumber: 'Spec-0',
        violationType: ViolationType.SSOT_VIOLATION,
        location: duplicate.location,
        description: `Duplicate definition of physics concept: ${duplicate.concept}`,
        governanceReference: 'Spec-0: 所有天文/物理概念必须存在唯一权威定义点',
        severity: ViolationSeverity.CRITICAL,
        detectedAt: new Date(),
        fixAttempts: 0
      });
    }

    // Check for renderer intelligence (Spec-0 rule)
    const rendererIntelligence = this.findRendererIntelligence(ast);
    for (const intelligence of rendererIntelligence) {
      violations.push({
        specNumber: 'Spec-0',
        violationType: ViolationType.RENDERER_INTELLIGENCE,
        location: intelligence.location,
        description: `Renderer contains physics logic: ${intelligence.description}`,
        governanceReference: 'Spec-0: 渲染层不得解释、推导或修正物理量',
        severity: ViolationSeverity.HIGH,
        detectedAt: new Date(),
        fixAttempts: 0
      });
    }

    // Check for physics system priority violations
    const priorityViolations = this.detectPhysicsSystemPriorityViolations(ast);
    violations.push(...priorityViolations);

    // Check for second definition sources
    const secondDefinitionSources = this.detectSecondDefinitionSources(ast);
    violations.push(...secondDefinitionSources);

    return violations;
  }

  checkPhysicsSystemPriority(ast: ProjectAST): SpecViolation[] {
    const violations: SpecViolation[] = [];

    // Check for magic numbers in physics calculations
    const magicNumbers = this.findMagicNumbers(ast);
    for (const magicNumber of magicNumbers) {
      violations.push({
        specNumber: 'Spec-0',
        violationType: ViolationType.MAGIC_NUMBER,
        location: magicNumber.location,
        description: `Magic number detected: ${magicNumber.value}`,
        governanceReference: 'Spec-0: 物理系统优先原则',
        severity: ViolationSeverity.MEDIUM,
        detectedAt: new Date(),
        fixAttempts: 0
      });
    }

    // Check for constants pollution
    const constantsPollution = this.findConstantsPollution(ast);
    for (const pollution of constantsPollution) {
      violations.push({
        specNumber: 'Spec-0',
        violationType: ViolationType.CONSTANTS_POLLUTION,
        location: pollution.location,
        description: `Constants file contains logic: ${pollution.description}`,
        governanceReference: 'Spec-0: 物理系统优先原则',
        severity: ViolationSeverity.HIGH,
        detectedAt: new Date(),
        fixAttempts: 0
      });
    }

    return violations;
  }

  detectStructuralFailures(ast: ProjectAST, history: CodeHistory): StructuralFailure[] {
    const failures: StructuralFailure[] = [];

    // Analyze modification patterns
    for (const fileHistory of history.files) {
      if (fileHistory.modifications.length >= 3) {
        // Check if modifications are for the same problem
        const repeatedModifications = this.analyzeRepeatedModifications(fileHistory.modifications);
        
        if (repeatedModifications.length > 0) {
          failures.push({
            specNumber: 'Spec-0',
            violationType: ViolationType.STRUCTURAL_FAILURE,
            location: createSourceLocation(fileHistory.path, 1, 1),
            description: `File has been modified ${fileHistory.modifications.length} times for similar issues`,
            governanceReference: 'Spec-0: 同一问题被修改≥3次触发结构性失败',
            severity: ViolationSeverity.CRITICAL,
            detectedAt: new Date(),
            fixAttempts: fileHistory.modifications.length,
            problemArea: fileHistory.path,
            modificationCount: fileHistory.modifications.length,
            modificationHistory: fileHistory.modifications,
            failureType: StructuralFailureType.REPEATED_MODIFICATIONS,
            refactoringUrgency: RefactoringUrgency.IMMEDIATE
          });
        }
      }
    }

    // Detect early signs of structural failure from AST analysis
    const earlyFailureSigns = this.detectEarlyStructuralFailureSigns(ast);
    failures.push(...earlyFailureSigns);

    // Detect parameter tuning patterns
    const parameterTuningFailures = this.detectParameterTuningFailures(ast, history);
    failures.push(...parameterTuningFailures);

    // Detect architecture drift patterns
    const architectureDriftFailures = this.detectArchitectureDriftFailures(ast);
    failures.push(...architectureDriftFailures);

    return failures;
  }

  async loadGovernanceSpecs(specsPath: string): Promise<GovernanceSpec[]> {
    try {
      // Load specs from markdown file
      this.governanceSpecs = await GovernanceSpecLoader.loadFromMarkdown(specsPath);
      return this.governanceSpecs;
    } catch (error) {
      console.warn(`Could not load governance specs from ${specsPath}, using defaults`);
      this.governanceSpecs = GovernanceSpecLoader.getDefaultSpecs();
      return this.governanceSpecs;
    }
  }

  private findDuplicatePhysicsDefinitions(ast: ProjectAST): Array<{concept: string, location: SourceLocation}> {
    const definitions: Array<{concept: string, location: SourceLocation}> = [];
    const physicsConstants = new Map<string, SourceLocation[]>();

    // Known physics concepts to look for
    const knownConcepts = [
      'EARTH_AXIAL_TILT', 'MARS_AXIAL_TILT', 'JUPITER_AXIAL_TILT',
      'EARTH_RADIUS', 'MARS_RADIUS', 'JUPITER_RADIUS',
      'EARTH_ROTATION_PERIOD', 'MARS_ROTATION_PERIOD',
      'J2000_FRAME', 'ECLIPTIC_FRAME'
    ];

    for (const file of ast.files) {
      for (const variable of file.variables) {
        if (knownConcepts.includes(variable.name)) {
          if (!physicsConstants.has(variable.name)) {
            physicsConstants.set(variable.name, []);
          }
          physicsConstants.get(variable.name)!.push(
            createSourceLocation(file.sourceType, 1, 1) // Simplified location
          );
        }
      }
    }

    // Find duplicates
    for (const [concept, locations] of physicsConstants) {
      if (locations.length > 1) {
        definitions.push({
          concept,
          location: locations[0] // Report first occurrence
        });
      }
    }

    return definitions;
  }

  private findRendererIntelligence(ast: ProjectAST): Array<{description: string, location: SourceLocation}> {
    const intelligence: Array<{description: string, location: SourceLocation}> = [];

    for (const file of ast.files) {
      // Check if this is a renderer file
      const filePath = file.sourceType; // Simplified - would use actual file path
      if (isRendererFile(filePath)) {
        // Look for physics-related imports
        for (const importDecl of file.imports) {
          if (importDecl.source.includes('astronomy/constants') || 
              importDecl.source.includes('axial-tilt') ||
              importDecl.source.includes('physics')) {
            intelligence.push({
              description: `Renderer imports physics module: ${importDecl.source}`,
              location: createSourceLocation(filePath, 1, 1)
            });
          }
        }

        // Look for physics calculations in functions
        for (const func of file.functions) {
          if (func.name.toLowerCase().includes('calculate') ||
              func.name.toLowerCase().includes('compute') ||
              func.name.toLowerCase().includes('angle') ||
              func.name.toLowerCase().includes('rotation')) {
            intelligence.push({
              description: `Renderer contains physics calculation: ${func.name}`,
              location: createSourceLocation(filePath, 1, 1)
            });
          }
        }
      }
    }

    return intelligence;
  }

  private findMagicNumbers(ast: ProjectAST): Array<{value: string, location: SourceLocation}> {
    const magicNumbers: Array<{value: string, location: SourceLocation}> = [];

    // This would require more sophisticated AST analysis to find numeric literals
    // For now, return empty array as placeholder
    return magicNumbers;
  }

  private findConstantsPollution(ast: ProjectAST): Array<{description: string, location: SourceLocation}> {
    const pollution: Array<{description: string, location: SourceLocation}> = [];

    for (const file of ast.files) {
      const filePath = file.sourceType; // Simplified - would use actual file path
      if (isPhysicsConstantFile(filePath)) {
        // Check for functions in constants files
        if (file.functions.length > 0) {
          pollution.push({
            description: `Constants file contains ${file.functions.length} functions`,
            location: createSourceLocation(filePath, 1, 1)
          });
        }

        // Check for classes in constants files
        if (file.classes.length > 0) {
          pollution.push({
            description: `Constants file contains ${file.classes.length} classes`,
            location: createSourceLocation(filePath, 1, 1)
          });
        }
      }
    }

    return pollution;
  }

  private analyzeRepeatedModifications(modifications: ModificationRecord[]): ModificationRecord[] {
    // Simple heuristic: if modifications have similar descriptions or affect similar areas
    const repeatedMods: ModificationRecord[] = [];
    const keywords = ['fix', 'adjust', 'correct', 'update', 'tweak'];

    for (const mod of modifications) {
      const hasKeyword = keywords.some(keyword => 
        mod.description.toLowerCase().includes(keyword)
      );
      if (hasKeyword) {
        repeatedMods.push(mod);
      }
    }

    return repeatedMods.length >= 2 ? repeatedMods : [];
  }

  private calculateComplianceScore(violations: SpecViolation[], failures: StructuralFailure[]): ComplianceScore {
    const totalIssues = violations.length + failures.length;
    const criticalViolations = violations.filter(v => v.severity === ViolationSeverity.CRITICAL).length +
                              failures.length; // All structural failures are critical

    // Calculate overall score (0-100)
    let overall = 100;
    overall -= criticalViolations * 20; // Critical issues heavily penalized
    overall -= violations.filter(v => v.severity === ViolationSeverity.HIGH).length * 10;
    overall -= violations.filter(v => v.severity === ViolationSeverity.MEDIUM).length * 5;
    overall -= violations.filter(v => v.severity === ViolationSeverity.LOW).length * 2;

    overall = Math.max(0, overall); // Don't go below 0

    // Calculate by-spec scores
    const bySpec: Record<string, number> = {};
    const specGroups = new Map<string, SpecViolation[]>();
    
    for (const violation of violations) {
      if (!specGroups.has(violation.specNumber)) {
        specGroups.set(violation.specNumber, []);
      }
      specGroups.get(violation.specNumber)!.push(violation);
    }

    for (const [specNumber, specViolations] of specGroups) {
      let specScore = 100;
      specScore -= specViolations.filter(v => v.severity === ViolationSeverity.CRITICAL).length * 25;
      specScore -= specViolations.filter(v => v.severity === ViolationSeverity.HIGH).length * 15;
      specScore -= specViolations.filter(v => v.severity === ViolationSeverity.MEDIUM).length * 8;
      specScore -= specViolations.filter(v => v.severity === ViolationSeverity.LOW).length * 3;
      bySpec[specNumber] = Math.max(0, specScore);
    }

    // Determine trend (simplified - would need historical data)
    const trend = overall >= 80 ? ComplianceTrend.STABLE :
                  overall >= 60 ? ComplianceTrend.DEGRADING :
                  ComplianceTrend.DEGRADING;

    return {
      overall,
      bySpec,
      criticalViolations,
      trend
    };
  }

  private createMockHistory(): CodeHistory {
    // Create mock history for testing - in real implementation this would come from git history
    return {
      files: [
        {
          path: 'src/lib/3d/Planet.ts',
          modifications: [
            {
              timestamp: new Date('2024-01-01'),
              description: 'Fix axial tilt calculation',
              author: 'developer',
              changeType: 'fix'
            },
            {
              timestamp: new Date('2024-01-15'),
              description: 'Adjust axial tilt for visual accuracy',
              author: 'developer',
              changeType: 'fix'
            },
            {
              timestamp: new Date('2024-02-01'),
              description: 'Correct axial tilt rendering issue',
              author: 'developer',
              changeType: 'fix'
            }
          ],
          stability: {
            modificationFrequency: 3,
            averageTimeBetweenChanges: 15,
            testStability: 0.7,
            visualStability: 0.6
          }
        }
      ],
      commits: [],
      testResults: [],
      visualResults: []
    };
  }

  private detectPhysicsSystemPriorityViolations(ast: ProjectAST): SpecViolation[] {
    const violations: SpecViolation[] = [];

    // Check for visual effects taking priority over physics correctness
    const visualPriorityViolations = this.findVisualPriorityViolations(ast);
    for (const violation of visualPriorityViolations) {
      violations.push({
        specNumber: 'Spec-0',
        violationType: ViolationType.PHYSICS_PRIORITY_VIOLATION,
        location: violation.location,
        description: violation.description,
        governanceReference: 'Spec-0: 正确性 > 架构完整性 > 功能实现 > 视觉效果',
        severity: ViolationSeverity.HIGH,
        detectedAt: new Date(),
        fixAttempts: 0
      });
    }

    // Check for functional implementation bypassing architecture
    const architectureBypassViolations = this.findArchitectureBypassViolations(ast);
    for (const violation of architectureBypassViolations) {
      violations.push({
        specNumber: 'Spec-0',
        violationType: ViolationType.PHYSICS_PRIORITY_VIOLATION,
        location: violation.location,
        description: violation.description,
        governanceReference: 'Spec-0: 正确性 > 架构完整性 > 功能实现 > 视觉效果',
        severity: ViolationSeverity.HIGH,
        detectedAt: new Date(),
        fixAttempts: 0
      });
    }

    return violations;
  }

  private detectSecondDefinitionSources(ast: ProjectAST): SpecViolation[] {
    const violations: SpecViolation[] = [];

    // Track all physics concept definitions across the project
    const conceptDefinitions = new Map<string, SourceLocation[]>();
    const authorityFiles = [
      'lib/astronomy/constants/axialTilt.ts',
      'lib/astronomy/constants/physicalParams.ts',
      'lib/astronomy/constants/rotation.ts',
      'lib/astronomy/constants/referenceFrames.ts'
    ];

    for (const file of ast.files) {
      const filePath = file.sourceType; // Simplified - would use actual file path
      
      // Check for physics constants defined outside authority files
      for (const variable of file.variables) {
        if (this.isPhysicsConcept(variable.name)) {
          const isAuthorityFile = authorityFiles.some(authFile => filePath.includes(authFile));
          
          if (!conceptDefinitions.has(variable.name)) {
            conceptDefinitions.set(variable.name, []);
          }
          
          const location = createSourceLocation(filePath, 1, 1);
          conceptDefinitions.get(variable.name)!.push(location);
          
          // If this is not an authority file but defines physics concepts
          if (!isAuthorityFile) {
            violations.push({
              specNumber: 'Spec-0',
              violationType: ViolationType.SSOT_VIOLATION,
              location,
              description: `Physics concept '${variable.name}' defined outside authority file`,
              governanceReference: 'Spec-0: 任意模块禁止引入第二定义源',
              severity: ViolationSeverity.CRITICAL,
              detectedAt: new Date(),
              fixAttempts: 0
            });
          }
        }
      }
    }

    // Check for multiple definitions of the same concept
    for (const [concept, locations] of conceptDefinitions) {
      if (locations.length > 1) {
        for (let i = 1; i < locations.length; i++) {
          violations.push({
            specNumber: 'Spec-0',
            violationType: ViolationType.SSOT_VIOLATION,
            location: locations[i],
            description: `Multiple definitions found for physics concept '${concept}'`,
            governanceReference: 'Spec-0: 所有天文/物理概念必须存在唯一权威定义点',
            severity: ViolationSeverity.CRITICAL,
            detectedAt: new Date(),
            fixAttempts: 0
          });
        }
      }
    }

    return violations;
  }

  private findVisualPriorityViolations(ast: ProjectAST): Array<{description: string, location: SourceLocation}> {
    const violations: Array<{description: string, location: SourceLocation}> = [];

    for (const file of ast.files) {
      const filePath = file.sourceType;
      
      // Look for comments or function names that suggest visual adjustments over physics
      for (const func of file.functions) {
        const suspiciousPatterns = [
          'visuallyCorrect',
          'looksBetter',
          'forVisualAccuracy',
          'adjustForDisplay',
          'tweakForAppearance'
        ];
        
        if (suspiciousPatterns.some(pattern => func.name.includes(pattern))) {
          violations.push({
            description: `Function '${func.name}' suggests visual priority over physics correctness`,
            location: createSourceLocation(filePath, 1, 1)
          });
        }
      }

      // Look for variables with visual-priority naming
      for (const variable of file.variables) {
        if (variable.name.includes('Visual') && this.isPhysicsConcept(variable.name.replace('Visual', ''))) {
          violations.push({
            description: `Variable '${variable.name}' suggests visual override of physics concept`,
            location: createSourceLocation(filePath, 1, 1)
          });
        }
      }
    }

    return violations;
  }

  private findArchitectureBypassViolations(ast: ProjectAST): Array<{description: string, location: SourceLocation}> {
    const violations: Array<{description: string, location: SourceLocation}> = [];

    for (const file of ast.files) {
      const filePath = file.sourceType;
      const currentLayer = getModuleLayer(filePath);
      
      // Check for direct access to constants from rendering layer
      if (currentLayer === 'rendering') {
        for (const importDecl of file.imports) {
          if (importDecl.source.includes('astronomy/constants')) {
            violations.push({
              description: `Rendering layer directly imports constants: ${importDecl.source}`,
              location: createSourceLocation(filePath, 1, 1)
            });
          }
        }
      }

      // Check for bypassing proper calculation layers
      for (const func of file.functions) {
        if (func.name.includes('calculate') || func.name.includes('compute')) {
          const hasDirectConstantAccess = file.imports.some(imp => 
            imp.source.includes('constants') && 
            !currentLayer.includes('physics') && 
            !currentLayer.includes('astronomy')
          );
          
          if (hasDirectConstantAccess) {
            violations.push({
              description: `Function '${func.name}' bypasses proper calculation layers`,
              location: createSourceLocation(filePath, 1, 1)
            });
          }
        }
      }
    }

    return violations;
  }

  private isPhysicsConcept(name: string): boolean {
    const physicsPatterns = [
      /AXIAL_TILT/i,
      /RADIUS/i,
      /MASS/i,
      /ROTATION_PERIOD/i,
      /ORBITAL_PERIOD/i,
      /FRAME/i,
      /GM/i,
      /INCLINATION/i,
      /ECCENTRICITY/i,
      /SEMI_MAJOR_AXIS/i
    ];

    return physicsPatterns.some(pattern => pattern.test(name));
  }

  private detectEarlyStructuralFailureSigns(ast: ProjectAST): StructuralFailure[] {
    const failures: StructuralFailure[] = [];

    // Look for workaround patterns that indicate structural problems
    for (const file of ast.files) {
      const filePath = file.sourceType;
      
      // Check for workaround function names
      const workaroundPatterns = [
        'workaround',
        'hack',
        'temp',
        'temporary',
        'quickfix',
        'bandaid'
      ];

      for (const func of file.functions) {
        if (workaroundPatterns.some(pattern => func.name.toLowerCase().includes(pattern))) {
          failures.push({
            specNumber: 'Spec-0',
            violationType: ViolationType.STRUCTURAL_FAILURE,
            location: createSourceLocation(filePath, 1, 1),
            description: `Workaround function detected: ${func.name}`,
            governanceReference: 'Spec-0: 结构性失败的早期征象',
            severity: ViolationSeverity.HIGH,
            detectedAt: new Date(),
            fixAttempts: 1,
            problemArea: filePath,
            modificationCount: 1,
            modificationHistory: [],
            failureType: StructuralFailureType.ARCHITECTURE_DRIFT,
            refactoringUrgency: RefactoringUrgency.HIGH
          });
        }
      }

      // Check for excessive conditional complexity (sign of structural issues)
      for (const func of file.functions) {
        if (func.parameters.length > 5) {
          failures.push({
            specNumber: 'Spec-0',
            violationType: ViolationType.STRUCTURAL_FAILURE,
            location: createSourceLocation(filePath, 1, 1),
            description: `Function '${func.name}' has excessive parameters (${func.parameters.length})`,
            governanceReference: 'Spec-0: 结构性失败的早期征象',
            severity: ViolationSeverity.MEDIUM,
            detectedAt: new Date(),
            fixAttempts: 0,
            problemArea: filePath,
            modificationCount: 0,
            modificationHistory: [],
            failureType: StructuralFailureType.ARCHITECTURE_DRIFT,
            refactoringUrgency: RefactoringUrgency.MEDIUM
          });
        }
      }
    }

    return failures;
  }

  private detectParameterTuningFailures(ast: ProjectAST, history: CodeHistory): StructuralFailure[] {
    const failures: StructuralFailure[] = [];

    // Look for variables with names suggesting parameter tuning
    for (const file of ast.files) {
      const filePath = file.sourceType;
      
      for (const variable of file.variables) {
        const tuningPatterns = [
          'factor',
          'multiplier',
          'offset',
          'adjustment',
          'correction',
          'tweak'
        ];

        if (tuningPatterns.some(pattern => variable.name.toLowerCase().includes(pattern))) {
          // Check if this variable has been modified multiple times
          const relatedModifications = history.files
            .find(f => f.path === filePath)
            ?.modifications.filter(mod => 
              mod.description.toLowerCase().includes(variable.name.toLowerCase()) ||
              mod.description.toLowerCase().includes('adjust') ||
              mod.description.toLowerCase().includes('tweak')
            ) || [];

          if (relatedModifications.length >= 2) {
            failures.push({
              specNumber: 'Spec-0',
              violationType: ViolationType.STRUCTURAL_FAILURE,
              location: createSourceLocation(filePath, 1, 1),
              description: `Parameter tuning detected: ${variable.name} (modified ${relatedModifications.length} times)`,
              governanceReference: 'Spec-0: 同一问题被修改≥3次触发结构性失败',
              severity: ViolationSeverity.HIGH,
              detectedAt: new Date(),
              fixAttempts: relatedModifications.length,
              problemArea: filePath,
              modificationCount: relatedModifications.length,
              modificationHistory: relatedModifications,
              failureType: StructuralFailureType.PARAMETER_TUNING,
              refactoringUrgency: RefactoringUrgency.HIGH
            });
          }
        }
      }
    }

    return failures;
  }

  private detectArchitectureDriftFailures(ast: ProjectAST): StructuralFailure[] {
    const failures: StructuralFailure[] = [];

    // Detect files that violate multiple architectural principles
    for (const file of ast.files) {
      const filePath = file.sourceType;
      const violations = [];

      // Check for mixed responsibilities
      const hasRenderingCode = file.functions.some(f => 
        f.name.toLowerCase().includes('render') || 
        f.name.toLowerCase().includes('draw')
      );
      const hasPhysicsCode = file.functions.some(f => 
        f.name.toLowerCase().includes('calculate') || 
        f.name.toLowerCase().includes('compute')
      );
      const hasConstantsCode = file.variables.some(v => this.isPhysicsConcept(v.name));

      if ([hasRenderingCode, hasPhysicsCode, hasConstantsCode].filter(Boolean).length > 1) {
        violations.push('Mixed responsibilities detected');
      }

      // Check for inappropriate imports
      const currentLayer = getModuleLayer(filePath);
      for (const importDecl of file.imports) {
        const importedLayer = getModuleLayer(importDecl.source);
        if (this.isInappropriateLayerAccess(currentLayer, importedLayer)) {
          violations.push(`Inappropriate layer access: ${currentLayer} -> ${importedLayer}`);
        }
      }

      if (violations.length >= 2) {
        failures.push({
          specNumber: 'Spec-0',
          violationType: ViolationType.STRUCTURAL_FAILURE,
          location: createSourceLocation(filePath, 1, 1),
          description: `Architecture drift detected: ${violations.join(', ')}`,
          governanceReference: 'Spec-0: 结构性失败的早期征象',
          severity: ViolationSeverity.HIGH,
          detectedAt: new Date(),
          fixAttempts: 0,
          problemArea: filePath,
          modificationCount: 0,
          modificationHistory: [],
          failureType: StructuralFailureType.ARCHITECTURE_DRIFT,
          refactoringUrgency: RefactoringUrgency.HIGH
        });
      }
    }

    return failures;
  }

  private isInappropriateLayerAccess(fromLayer: string, toLayer: string): boolean {
    // Define inappropriate layer access patterns
    const inappropriateAccess = [
      { from: 'rendering', to: 'constants' },
      { from: 'rendering', to: 'astronomy' },
      { from: 'rendering', to: 'physics' },
      { from: 'constants', to: 'rendering' },
      { from: 'constants', to: 'astronomy' },
      { from: 'constants', to: 'physics' }
    ];

    return inappropriateAccess.some(rule => 
      fromLayer.includes(rule.from) && toLayer.includes(rule.to)
    );
  }

  private mapConstantTypeToConceptType(constantType: any): any {
    // Map PhysicsConstantType to PhysicsConceptType
    const mapping: Record<string, string> = {
      'axialTilt': 'AXIAL_TILT',
      'physicalParams': 'PHYSICAL_PARAMETER',
      'rotation': 'ROTATION_PERIOD',
      'referenceFrames': 'REFERENCE_FRAME'
    };
    
    return mapping[constantType] || 'PHYSICAL_PARAMETER';
  }
}