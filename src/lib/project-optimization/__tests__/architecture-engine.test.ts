// Architecture Repair Engine Tests
import {
  ArchitectureRepairEngineImpl,
  LayerSeparationRepairUtils,
  RendererStupidityRepairUtils,
  MagicNumberEliminationUtils,
  StructuralRefactoringUtils
} from '../architecture-engine';

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
  PhysicsConcept,
  LayerViolationType,
  RendererIntelligenceType,
  StructuralFailureType,
  RefactoringUrgency
} from '../governance-types';

import { ChangeType } from '../types';

import { SourceLocation } from '../types';

describe('ArchitectureRepairEngine', () => {
  let repairEngine: ArchitectureRepairEngineImpl;

  beforeEach(() => {
    repairEngine = new ArchitectureRepairEngineImpl();
  });

  describe('SSOT Violation Repair', () => {
    it('should repair SSOT violations by migrating to authority sources', async () => {
      const mockConcept: PhysicsConcept = {
        name: 'earth_axial_tilt',
        type: PhysicsConceptType.AXIAL_TILT,
        authoritySource: 'lib/astronomy/constants/axialTilt.ts',
        allowedUsagePatterns: [],
        forbiddenContexts: []
      };

      const mockLocation: SourceLocation = {
        file: 'src/test/file.ts',
        line: 10,
        column: 5
      };

      const ssotViolation: SSOTViolation = {
        specNumber: 'Spec-2',
        violationType: ViolationType.SSOT_VIOLATION,
        location: mockLocation,
        description: 'Duplicate definition of earth axial tilt',
        governanceReference: 'Spec-2: Physics Guardian',
        severity: ViolationSeverity.HIGH,
        detectedAt: new Date(),
        fixAttempts: 0,
        concept: mockConcept,
        authorityLocation: mockLocation,
        duplicateLocations: [mockLocation]
      };

      const result = await repairEngine.repairSSOTViolations([ssotViolation]);

      expect(result.success).toBe(true);
      expect(result.repairedViolations).toHaveLength(1);
      expect(result.codeChanges.length).toBeGreaterThan(0);
      expect(result.warnings).toEqual([]);
    });

    it('should handle repair failures gracefully', async () => {
      const invalidViolation: SSOTViolation = {
        specNumber: 'Spec-2',
        violationType: ViolationType.SSOT_VIOLATION,
        location: { file: '', line: 0, column: 0 },
        description: 'Invalid violation',
        governanceReference: 'Spec-2',
        severity: ViolationSeverity.HIGH,
        detectedAt: new Date(),
        fixAttempts: 0,
        concept: {
          name: '',
          type: PhysicsConceptType.AXIAL_TILT,
          authoritySource: '',
          allowedUsagePatterns: [],
          forbiddenContexts: []
        },
        authorityLocation: { file: '', line: 0, column: 0 },
        duplicateLocations: []
      };

      const result = await repairEngine.repairSSOTViolations([invalidViolation]);

      expect(result.success).toBe(false);
      expect(result.remainingViolations).toHaveLength(1);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Layer Separation Repair', () => {
    it('should repair layer separation violations', async () => {
      const layerViolation: LayerViolation = {
        specNumber: 'Spec-1',
        violationType: ViolationType.LAYER_SEPARATION_VIOLATION,
        location: { file: 'src/components/test.tsx', line: 5, column: 1 },
        description: 'Cross-layer import violation',
        governanceReference: 'Spec-1: Architecture Guardian',
        severity: ViolationSeverity.HIGH,
        detectedAt: new Date(),
        fixAttempts: 0,
        violatingModule: 'src/components/test.tsx',
        targetLayer: ArchitectureLayer.CONSTANTS,
        sourceLayer: ArchitectureLayer.RENDERING,
        layerViolationType: LayerViolationType.CROSS_LAYER_IMPORT
      };

      const result = await repairEngine.fixLayerSeparation([layerViolation]);

      expect(result.success).toBe(true);
      expect(result.repairedViolations).toHaveLength(1);
      expect(result.codeChanges.length).toBeGreaterThan(0);
    });
  });

  describe('Renderer Stupidification', () => {
    it('should stupidify intelligent renderers', async () => {
      const rendererViolation: RendererViolation = {
        specNumber: 'Spec-6',
        violationType: ViolationType.RENDERER_INTELLIGENCE,
        location: { file: 'src/components/canvas/Planet.tsx', line: 20, column: 1 },
        description: 'Renderer contains physics knowledge',
        governanceReference: 'Spec-6: Renderer Stupidity',
        severity: ViolationSeverity.HIGH,
        detectedAt: new Date(),
        fixAttempts: 0,
        rendererModule: 'src/components/canvas/Planet.tsx',
        intelligenceType: RendererIntelligenceType.PHYSICS_KNOWLEDGE
      };

      const result = await repairEngine.stupidifyRenderer([rendererViolation]);

      expect(result.success).toBe(true);
      expect(result.repairedViolations).toHaveLength(1);
      expect(result.codeChanges.length).toBeGreaterThan(0);
    });
  });

  describe('Magic Number Elimination', () => {
    it('should eliminate magic numbers by replacing with constants', async () => {
      const magicNumberViolation: MagicNumberViolation = {
        specNumber: 'Spec-4',
        violationType: ViolationType.MAGIC_NUMBER,
        location: { file: 'src/lib/physics/orbit.ts', line: 15, column: 10 },
        description: 'Hardcoded axial tilt value',
        governanceReference: 'Spec-4: Magic Number Elimination',
        severity: ViolationSeverity.MEDIUM,
        detectedAt: new Date(),
        fixAttempts: 0,
        value: 23.44,
        suspectedType: PhysicsConstantType.AXIAL_TILT,
        suggestedSource: 'lib/astronomy/constants/axialTilt.ts',
        context: 'earth axial tilt calculation'
      };

      const result = await repairEngine.eliminateMagicNumbers([magicNumberViolation]);

      expect(result.success).toBe(true);
      expect(result.repairedViolations).toHaveLength(1);
      expect(result.codeChanges.length).toBeGreaterThan(0);
      
      // Check that import and constant replacement were added
      const hasImport = result.codeChanges.some(c => c.type === ChangeType.ADD && c.description.includes('Import'));
      const hasReplacement = result.codeChanges.some(c => c.type === ChangeType.MODIFY);
      expect(hasImport).toBe(true);
      expect(hasReplacement).toBe(true);
    });
  });

  describe('Structural Refactoring', () => {
    it('should create refactoring plan for structural failures', async () => {
      const structuralFailure: StructuralFailure = {
        specNumber: 'Spec-0',
        violationType: ViolationType.STRUCTURAL_FAILURE,
        location: { file: 'src/lib/problematic.ts', line: 1, column: 1 },
        description: 'Repeated modifications indicate structural failure',
        governanceReference: 'Spec-0: Global Constitution',
        severity: ViolationSeverity.CRITICAL,
        detectedAt: new Date(),
        fixAttempts: 0,
        problemArea: 'orbital calculations',
        modificationCount: 5,
        modificationHistory: [],
        failureType: StructuralFailureType.REPEATED_MODIFICATIONS,
        refactoringUrgency: RefactoringUrgency.IMMEDIATE
      };

      const plan = await repairEngine.triggerStructuralRefactoring([structuralFailure]);

      expect(plan.freezeRecommendation).toBe(true);
      expect(plan.refactoringSteps.length).toBeGreaterThan(0);
      expect(plan.estimatedEffort.totalHours).toBeGreaterThan(0);
      expect(plan.riskAssessment.overallRisk).toBeDefined();
    });
  });
});

describe('LayerSeparationRepairUtils', () => {
  it('should analyze layer violations and create repair plan', async () => {
    const violation: LayerViolation = {
      specNumber: 'Spec-1',
      violationType: ViolationType.LAYER_SEPARATION_VIOLATION,
      location: { file: 'src/test.ts', line: 1, column: 1 },
      description: 'Test violation',
      governanceReference: 'Spec-1',
      severity: ViolationSeverity.HIGH,
      detectedAt: new Date(),
      fixAttempts: 0,
      violatingModule: 'src/test.ts',
      targetLayer: ArchitectureLayer.CONSTANTS,
      sourceLayer: ArchitectureLayer.RENDERING,
      layerViolationType: LayerViolationType.CROSS_LAYER_IMPORT
    };

    const plan = await LayerSeparationRepairUtils.analyzeLayerViolations([violation]);

    expect(plan.affectedLayers).toContain(ArchitectureLayer.RENDERING);
    expect(plan.affectedLayers).toContain(ArchitectureLayer.CONSTANTS);
    expect(plan.repairActions).toHaveLength(1);
    expect(plan.estimatedEffort).toBeGreaterThan(0);
  });
});

describe('RendererStupidityRepairUtils', () => {
  it('should analyze renderer violations and create stupidification plan', async () => {
    const violation: RendererViolation = {
      specNumber: 'Spec-6',
      violationType: ViolationType.RENDERER_INTELLIGENCE,
      location: { file: 'src/renderer.ts', line: 1, column: 1 },
      description: 'Test violation',
      governanceReference: 'Spec-6',
      severity: ViolationSeverity.HIGH,
      detectedAt: new Date(),
      fixAttempts: 0,
      rendererModule: 'src/renderer.ts',
      intelligenceType: RendererIntelligenceType.PHYSICS_KNOWLEDGE
    };

    const plan = await RendererStupidityRepairUtils.analyzeRendererViolations([violation]);

    expect(plan.affectedRenderers).toContain('src/renderer.ts');
    expect(plan.repairActions).toHaveLength(1);
    expect(plan.estimatedEffort).toBeGreaterThan(0);
    expect(plan.stupidificationLevel).toBeDefined();
  });
});

describe('MagicNumberEliminationUtils', () => {
  it('should analyze magic numbers and create elimination plan', async () => {
    const violation: MagicNumberViolation = {
      specNumber: 'Spec-4',
      violationType: ViolationType.MAGIC_NUMBER,
      location: { file: 'src/test.ts', line: 1, column: 1 },
      description: 'Test magic number',
      governanceReference: 'Spec-4',
      severity: ViolationSeverity.MEDIUM,
      detectedAt: new Date(),
      fixAttempts: 0,
      value: 42,
      suspectedType: PhysicsConstantType.AXIAL_TILT,
      suggestedSource: 'lib/constants/test.ts',
      context: 'test context'
    };

    const plan = await MagicNumberEliminationUtils.analyzeMagicNumbers([violation]);

    expect(plan.affectedFiles).toContain('src/test.ts');
    expect(plan.eliminationActions).toHaveLength(1);
    expect(plan.constantsToCreate).toHaveLength(1);
    expect(plan.estimatedEffort).toBeGreaterThan(0);
  });
});

describe('StructuralRefactoringUtils', () => {
  it('should analyze structural failures and create refactoring plan', async () => {
    const failure: StructuralFailure = {
      specNumber: 'Spec-0',
      violationType: ViolationType.STRUCTURAL_FAILURE,
      location: { file: 'src/test.ts', line: 1, column: 1 },
      description: 'Test structural failure',
      governanceReference: 'Spec-0',
      severity: ViolationSeverity.CRITICAL,
      detectedAt: new Date(),
      fixAttempts: 0,
      problemArea: 'test area',
      modificationCount: 3,
      modificationHistory: [],
      failureType: StructuralFailureType.REPEATED_MODIFICATIONS,
      refactoringUrgency: RefactoringUrgency.HIGH
    };

    const plan = await StructuralRefactoringUtils.analyzeStructuralFailures([failure]);

    expect(plan.phases.length).toBeGreaterThan(0);
    expect(plan.totalEstimatedTime).toBeGreaterThan(0);
    expect(plan.riskLevel).toBeDefined();
    expect(plan.successCriteria.length).toBeGreaterThan(0);
    expect(plan.rollbackPlan).toBeDefined();
  });

  it('should recommend development freeze for critical failures', async () => {
    const criticalFailure: StructuralFailure = {
      specNumber: 'Spec-0',
      violationType: ViolationType.STRUCTURAL_FAILURE,
      location: { file: 'src/critical.ts', line: 1, column: 1 },
      description: 'Critical structural failure',
      governanceReference: 'Spec-0',
      severity: ViolationSeverity.CRITICAL,
      detectedAt: new Date(),
      fixAttempts: 0,
      problemArea: 'critical area',
      modificationCount: 6, // >= 5 should trigger freeze
      modificationHistory: [],
      failureType: StructuralFailureType.REPEATED_MODIFICATIONS,
      refactoringUrgency: RefactoringUrgency.IMMEDIATE
    };

    const plan = await StructuralRefactoringUtils.analyzeStructuralFailures([criticalFailure]);

    expect(plan.developmentFreeze).toBe(true);
  });
});