// Core governance data structures and implementations
// Based on Spec-0 to Spec-8 from .kiro/specs/solmap-ai-governance.md

import {
  GovernanceSpec,
  GovernanceRule,
  GovernanceRuleType,
  EnforcementLevel,
  ValidationCriteria,
  GovernanceConstraint,
  ConstraintType,
  FailureCondition,
  FailureType,
  FailureAction,
  PhysicsConcept,
  PhysicsConceptType,
  UsagePattern,
  ArchitectureLayer,
  ArchitectureLayerDefinition,
  LayerOperation,
  ViolationType,
  ViolationSeverity
} from './governance-types';

import { ProjectAST, SourceLocation } from './types';

// Core governance specification implementations
export class GovernanceSpecImpl implements GovernanceSpec {
  constructor(
    public specNumber: string,
    public title: string,
    public rules: GovernanceRule[] = [],
    public constraints: GovernanceConstraint[] = [],
    public failureConditions: FailureCondition[] = []
  ) {}

  static createSpec0(): GovernanceSpecImpl {
    return new GovernanceSpecImpl(
      'Spec-0',
      '最高约束（Global Constitution）',
      [
        {
          id: 'spec0-physics-priority',
          description: '物理系统优先：正确性 > 架构完整性 > 功能实现 > 视觉效果',
          ruleType: GovernanceRuleType.PHYSICS_PRIORITY,
          enforcementLevel: EnforcementLevel.STRICT,
          validationCriteria: [
            {
              name: 'unique-authority-definition',
              description: '所有天文/物理概念必须存在唯一权威定义点',
              validator: (ast: ProjectAST) => true, // Implementation needed
              errorMessage: '检测到物理概念的重复定义'
            }
          ]
        }
      ],
      [
        {
          type: ConstraintType.UNIQUE_DEFINITION,
          description: '任意模块禁止引入第二定义源',
          target: 'physics_concepts',
          condition: 'single_authority_source'
        }
      ],
      [
        {
          type: FailureType.REPEATED_MODIFICATIONS,
          threshold: 3,
          description: '同一问题被修改≥3次触发结构性失败',
          action: FailureAction.TRIGGER_REFACTORING
        }
      ]
    );
  }

  static createSpec1(): GovernanceSpecImpl {
    return new GovernanceSpecImpl(
      'Spec-1',
      'Architecture Guardian（架构守护 AI）',
      [
        {
          id: 'spec1-layer-separation',
          description: '确保层分离不被破坏',
          ruleType: GovernanceRuleType.LAYER_SEPARATION,
          enforcementLevel: EnforcementLevel.STRICT,
          validationCriteria: [
            {
              name: 'no-cross-layer-imports',
              description: '不存在跨层import',
              validator: (ast: ProjectAST) => true, // Implementation needed
              errorMessage: '检测到违反层分离的跨层导入'
            }
          ]
        }
      ]
    );
  }

  static createSpec2(): GovernanceSpecImpl {
    return new GovernanceSpecImpl(
      'Spec-2',
      'Physics Guardian（物理守护 AI）',
      [
        {
          id: 'spec2-ssot-enforcement',
          description: '维护所有天文与物理定义的正确性',
          ruleType: GovernanceRuleType.SSOT_ENFORCEMENT,
          enforcementLevel: EnforcementLevel.STRICT,
          validationCriteria: [
            {
              name: 'constants-from-authority',
              description: '所有物理常量只能来自lib/astronomy/constants',
              validator: (ast: ProjectAST) => true, // Implementation needed
              errorMessage: '物理常量必须从权威定义点获取'
            }
          ]
        }
      ]
    );
  }

  static createSpec6(): GovernanceSpecImpl {
    return new GovernanceSpecImpl(
      'Spec-6',
      'Renderer 愚蠢化原则',
      [
        {
          id: 'spec6-renderer-stupidity',
          description: '确保渲染层保持愚蠢化',
          ruleType: GovernanceRuleType.RENDERER_STUPIDITY,
          enforcementLevel: EnforcementLevel.STRICT,
          validationCriteria: [
            {
              name: 'renderer-allowed-inputs',
              description: '渲染器只能接收位置向量、姿态矩阵和可视参数',
              validator: (ast: ProjectAST) => true, // Implementation needed
              errorMessage: '渲染器接收了禁止的输入类型'
            }
          ]
        }
      ]
    );
  }

  static getAllSpecs(): GovernanceSpecImpl[] {
    return [
      GovernanceSpecImpl.createSpec0(),
      GovernanceSpecImpl.createSpec1(),
      GovernanceSpecImpl.createSpec2(),
      GovernanceSpecImpl.createSpec6()
    ];
  }
}

// Physics concept definitions
export class PhysicsConceptRegistry {
  private static concepts: Map<string, PhysicsConcept> = new Map();

  static registerConcept(concept: PhysicsConcept): void {
    this.concepts.set(concept.name, concept);
  }

  static getConcept(name: string): PhysicsConcept | undefined {
    return this.concepts.get(name);
  }

  static getAllConcepts(): PhysicsConcept[] {
    return Array.from(this.concepts.values());
  }

  static initializeDefaultConcepts(): void {
    // Axial tilt concepts
    this.registerConcept({
      name: 'earth_axial_tilt',
      type: PhysicsConceptType.AXIAL_TILT,
      authoritySource: 'lib/astronomy/constants/axialTilt.ts',
      allowedUsagePatterns: [
        {
          pattern: 'import { EARTH_AXIAL_TILT } from "lib/astronomy/constants/axialTilt"',
          description: '从权威源导入轴倾角',
          allowed: true
        }
      ],
      forbiddenContexts: ['renderer', 'ui'],
      unit: 'degrees',
      referenceFrame: 'J2000'
    });

    // Physical parameters
    this.registerConcept({
      name: 'earth_radius',
      type: PhysicsConceptType.RADIUS,
      authoritySource: 'lib/astronomy/constants/physicalParams.ts',
      allowedUsagePatterns: [
        {
          pattern: 'import { EARTH_RADIUS } from "lib/astronomy/constants/physicalParams"',
          description: '从权威源导入半径',
          allowed: true
        }
      ],
      forbiddenContexts: ['renderer'],
      unit: 'km'
    });

    // Rotation periods
    this.registerConcept({
      name: 'earth_rotation_period',
      type: PhysicsConceptType.ROTATION_PERIOD,
      authoritySource: 'lib/astronomy/constants/rotation.ts',
      allowedUsagePatterns: [
        {
          pattern: 'import { EARTH_ROTATION_PERIOD } from "lib/astronomy/constants/rotation"',
          description: '从权威源导入自转周期',
          allowed: true
        }
      ],
      forbiddenContexts: ['renderer'],
      unit: 'hours'
    });

    // Reference frames
    this.registerConcept({
      name: 'j2000_frame',
      type: PhysicsConceptType.REFERENCE_FRAME,
      authoritySource: 'lib/astronomy/constants/referenceFrames.ts',
      allowedUsagePatterns: [
        {
          pattern: 'import { J2000_FRAME } from "lib/astronomy/constants/referenceFrames"',
          description: '从权威源导入参考系',
          allowed: true
        }
      ],
      forbiddenContexts: ['renderer']
    });
  }
}

// Architecture layer definitions
export class ArchitectureRegistry {
  private static layers: Map<ArchitectureLayer, ArchitectureLayerDefinition> = new Map();

  static registerLayer(layer: ArchitectureLayerDefinition): void {
    this.layers.set(layer.name, layer);
  }

  static getLayer(name: ArchitectureLayer): ArchitectureLayerDefinition | undefined {
    return this.layers.get(name);
  }

  static getAllLayers(): ArchitectureLayerDefinition[] {
    return Array.from(this.layers.values());
  }

  static initializeDefaultLayers(): void {
    // Constants layer
    this.registerLayer({
      name: ArchitectureLayer.CONSTANTS,
      allowedDependencies: [], // Constants depend on nothing
      forbiddenImports: ['*'], // No imports allowed in constants
      allowedOperations: [LayerOperation.DEFINE_CONSTANTS],
      responsibilityBoundaries: [
        'Define physical constants',
        'Define astronomical constants',
        'Freeze constant objects',
        'No logic or computation'
      ]
    });

    // Astronomy layer
    this.registerLayer({
      name: ArchitectureLayer.ASTRONOMY,
      allowedDependencies: [ArchitectureLayer.CONSTANTS],
      forbiddenImports: ['src/components/**', 'src/lib/3d/**'],
      allowedOperations: [LayerOperation.COMPUTE_PHYSICS],
      responsibilityBoundaries: [
        'Astronomical calculations',
        'Orbital mechanics',
        'Time and coordinate transformations',
        'Physical computations'
      ]
    });

    // Physics layer
    this.registerLayer({
      name: ArchitectureLayer.PHYSICS,
      allowedDependencies: [ArchitectureLayer.CONSTANTS, ArchitectureLayer.ASTRONOMY],
      forbiddenImports: ['src/components/**'],
      allowedOperations: [LayerOperation.COMPUTE_PHYSICS],
      responsibilityBoundaries: [
        'Physics simulations',
        'Force calculations',
        'Motion dynamics',
        'Physical state management'
      ]
    });

    // Rendering layer
    this.registerLayer({
      name: ArchitectureLayer.RENDERING,
      allowedDependencies: [ArchitectureLayer.INFRASTRUCTURE],
      forbiddenImports: [
        'lib/astronomy/constants/**',
        'lib/astronomy/**',
        'lib/physics/**'
      ],
      allowedOperations: [LayerOperation.RENDER_ONLY],
      responsibilityBoundaries: [
        'Render position vectors',
        'Apply attitude matrices',
        'Display visual parameters',
        'No physics knowledge',
        'No computations'
      ]
    });

    // Infrastructure layer
    this.registerLayer({
      name: ArchitectureLayer.INFRASTRUCTURE,
      allowedDependencies: [ArchitectureLayer.CONSTANTS],
      forbiddenImports: [],
      allowedOperations: [LayerOperation.MANAGE_INFRASTRUCTURE],
      responsibilityBoundaries: [
        'State management',
        'Event handling',
        'Service registry',
        'Configuration management'
      ]
    });
  }
}

// Violation severity calculator
export class ViolationSeverityCalculator {
  static calculateSeverity(
    violationType: ViolationType,
    context: any
  ): ViolationSeverity {
    switch (violationType) {
      case ViolationType.STRUCTURAL_FAILURE:
        return ViolationSeverity.CRITICAL;
      
      case ViolationType.SSOT_VIOLATION:
        return context.isPhysicsConcept ? ViolationSeverity.HIGH : ViolationSeverity.MEDIUM;
      
      case ViolationType.RENDERER_INTELLIGENCE:
        return context.hasPhysicsComputation ? ViolationSeverity.HIGH : ViolationSeverity.MEDIUM;
      
      case ViolationType.LAYER_SEPARATION_VIOLATION:
        return context.crossesMultipleLayers ? ViolationSeverity.HIGH : ViolationSeverity.MEDIUM;
      
      case ViolationType.MAGIC_NUMBER:
        return context.isPhysicsConstant ? ViolationSeverity.MEDIUM : ViolationSeverity.LOW;
      
      case ViolationType.CONSTANTS_POLLUTION:
        return ViolationSeverity.MEDIUM;
      
      case ViolationType.PHYSICS_PRIORITY_VIOLATION:
        return ViolationSeverity.HIGH;
      
      default:
        return ViolationSeverity.LOW;
    }
  }
}

// Governance specification loader
export class GovernanceSpecLoader {
  static async loadFromMarkdown(filePath: string): Promise<GovernanceSpec[]> {
    // This would parse the .kiro/specs/solmap-ai-governance.md file
    // For now, return the default specs
    return GovernanceSpecImpl.getAllSpecs();
  }

  static getDefaultSpecs(): GovernanceSpec[] {
    return GovernanceSpecImpl.getAllSpecs();
  }
}

// Initialize registries
PhysicsConceptRegistry.initializeDefaultConcepts();
ArchitectureRegistry.initializeDefaultLayers();

// Export utility functions
export function createSourceLocation(
  file: string,
  line: number,
  column: number,
  endLine?: number,
  endColumn?: number
): SourceLocation {
  return {
    file,
    line,
    column,
    endLine,
    endColumn
  };
}

export function isPhysicsConstantFile(filePath: string): boolean {
  return filePath.includes('lib/astronomy/constants/');
}

export function isRendererFile(filePath: string): boolean {
  return filePath.includes('components/canvas/') || 
         filePath.includes('lib/3d/') ||
         filePath.toLowerCase().includes('render');
}

export function getModuleLayer(filePath: string): ArchitectureLayer {
  if (filePath.includes('lib/astronomy/constants/')) {
    return ArchitectureLayer.CONSTANTS;
  }
  if (filePath.includes('lib/astronomy/')) {
    return ArchitectureLayer.ASTRONOMY;
  }
  if (filePath.includes('lib/physics/') || filePath.includes('lib/axial-tilt/')) {
    return ArchitectureLayer.PHYSICS;
  }
  if (filePath.includes('components/') || filePath.includes('lib/3d/')) {
    return ArchitectureLayer.RENDERING;
  }
  if (filePath.includes('lib/infrastructure/') || filePath.includes('lib/state')) {
    return ArchitectureLayer.INFRASTRUCTURE;
  }
  
  // Default to infrastructure for unknown files
  return ArchitectureLayer.INFRASTRUCTURE;
}