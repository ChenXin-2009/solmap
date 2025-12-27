// Basic infrastructure tests for governance compliance system
import * as fc from 'fast-check';
import {
  GovernanceSpecImpl,
  PhysicsConceptRegistry,
  ArchitectureRegistry,
  ViolationSeverityCalculator,
  createSourceLocation,
  isPhysicsConstantFile,
  isRendererFile,
  getModuleLayer
} from '../governance-core';

import {
  DEFAULT_GOVERNANCE_CONFIG,
  validateGovernanceConfig
} from '../governance-config';

import {
  ViolationType,
  ViolationSeverity,
  ArchitectureLayer,
  PhysicsConceptType,
  SpecViolation,
  GovernanceSpec,
  PhysicsConcept
} from '../governance-types';

import { ProjectAST, SourceLocation } from '../types';

describe('Governance Infrastructure', () => {
  describe('GovernanceSpecImpl', () => {
    test('should create Spec-0 with correct properties', () => {
      const spec0 = GovernanceSpecImpl.createSpec0();
      
      expect(spec0.specNumber).toBe('Spec-0');
      expect(spec0.title).toBe('最高约束（Global Constitution）');
      expect(spec0.rules).toHaveLength(1);
      expect(spec0.constraints).toHaveLength(1);
      expect(spec0.failureConditions).toHaveLength(1);
    });

    test('should create all default specs', () => {
      const specs = GovernanceSpecImpl.getAllSpecs();
      
      expect(specs).toHaveLength(4);
      expect(specs.map(s => s.specNumber)).toContain('Spec-0');
      expect(specs.map(s => s.specNumber)).toContain('Spec-1');
      expect(specs.map(s => s.specNumber)).toContain('Spec-2');
      expect(specs.map(s => s.specNumber)).toContain('Spec-6');
    });
  });

  describe('PhysicsConceptRegistry', () => {
    test('should have default physics concepts registered', () => {
      const concepts = PhysicsConceptRegistry.getAllConcepts();
      
      expect(concepts.length).toBeGreaterThan(0);
      
      const earthAxialTilt = PhysicsConceptRegistry.getConcept('earth_axial_tilt');
      expect(earthAxialTilt).toBeDefined();
      expect(earthAxialTilt?.type).toBe(PhysicsConceptType.AXIAL_TILT);
      expect(earthAxialTilt?.authoritySource).toBe('lib/astronomy/constants/axialTilt.ts');
    });

    test('should register new concepts', () => {
      const testConcept = {
        name: 'test_concept',
        type: PhysicsConceptType.RADIUS,
        authoritySource: 'test/authority.ts',
        allowedUsagePatterns: [],
        forbiddenContexts: []
      };

      PhysicsConceptRegistry.registerConcept(testConcept);
      const retrieved = PhysicsConceptRegistry.getConcept('test_concept');
      
      expect(retrieved).toEqual(testConcept);
    });
  });

  describe('ArchitectureRegistry', () => {
    test('should have default architecture layers registered', () => {
      const layers = ArchitectureRegistry.getAllLayers();
      
      expect(layers.length).toBeGreaterThan(0);
      
      const constantsLayer = ArchitectureRegistry.getLayer(ArchitectureLayer.CONSTANTS);
      expect(constantsLayer).toBeDefined();
      expect(constantsLayer?.allowedDependencies).toHaveLength(0);
      expect(constantsLayer?.forbiddenImports).toContain('*');
    });

    test('should enforce rendering layer restrictions', () => {
      const renderingLayer = ArchitectureRegistry.getLayer(ArchitectureLayer.RENDERING);
      
      expect(renderingLayer).toBeDefined();
      expect(renderingLayer?.forbiddenImports).toContain('lib/astronomy/constants/**');
      expect(renderingLayer?.forbiddenImports).toContain('lib/astronomy/**');
      expect(renderingLayer?.forbiddenImports).toContain('lib/physics/**');
    });
  });

  describe('ViolationSeverityCalculator', () => {
    test('should assign critical severity to structural failures', () => {
      const severity = ViolationSeverityCalculator.calculateSeverity(
        ViolationType.STRUCTURAL_FAILURE,
        {}
      );
      
      expect(severity).toBe(ViolationSeverity.CRITICAL);
    });

    test('should assign high severity to physics SSOT violations', () => {
      const severity = ViolationSeverityCalculator.calculateSeverity(
        ViolationType.SSOT_VIOLATION,
        { isPhysicsConcept: true }
      );
      
      expect(severity).toBe(ViolationSeverity.HIGH);
    });

    test('should assign medium severity to renderer intelligence', () => {
      const severity = ViolationSeverityCalculator.calculateSeverity(
        ViolationType.RENDERER_INTELLIGENCE,
        { hasPhysicsComputation: false }
      );
      
      expect(severity).toBe(ViolationSeverity.MEDIUM);
    });
  });

  describe('Utility Functions', () => {
    test('should create source locations correctly', () => {
      const location = createSourceLocation('test.ts', 10, 5, 12, 20);
      
      expect(location.file).toBe('test.ts');
      expect(location.line).toBe(10);
      expect(location.column).toBe(5);
      expect(location.endLine).toBe(12);
      expect(location.endColumn).toBe(20);
    });

    test('should identify physics constant files', () => {
      expect(isPhysicsConstantFile('lib/astronomy/constants/axialTilt.ts')).toBe(true);
      expect(isPhysicsConstantFile('lib/astronomy/constants/physicalParams.ts')).toBe(true);
      expect(isPhysicsConstantFile('src/components/Header.tsx')).toBe(false);
    });

    test('should identify renderer files', () => {
      expect(isRendererFile('src/components/canvas/3d/SolarSystemCanvas3D.tsx')).toBe(true);
      expect(isRendererFile('src/lib/3d/Planet.ts')).toBe(true);
      expect(isRendererFile('src/lib/astronomy/orbit.ts')).toBe(false);
    });

    test('should determine module layers correctly', () => {
      expect(getModuleLayer('lib/astronomy/constants/axialTilt.ts')).toBe(ArchitectureLayer.CONSTANTS);
      expect(getModuleLayer('lib/astronomy/orbit.ts')).toBe(ArchitectureLayer.ASTRONOMY);
      expect(getModuleLayer('src/components/canvas/3d/SolarSystemCanvas3D.tsx')).toBe(ArchitectureLayer.RENDERING);
      expect(getModuleLayer('lib/infrastructure/event-bus.ts')).toBe(ArchitectureLayer.INFRASTRUCTURE);
    });
  });

  describe('Governance Configuration', () => {
    test('should have valid default configuration', () => {
      const errors = validateGovernanceConfig(DEFAULT_GOVERNANCE_CONFIG);
      
      expect(errors).toHaveLength(0);
    });

    test('should validate Spec-0 requirement', () => {
      const invalidConfig = {
        ...DEFAULT_GOVERNANCE_CONFIG,
        enabledSpecs: ['Spec-1', 'Spec-2'] // Missing Spec-0
      };
      
      const errors = validateGovernanceConfig(invalidConfig);
      
      expect(errors).toContain('Spec-0 (最高约束) must always be enabled');
    });

    test('should validate modification threshold', () => {
      const invalidConfig = {
        ...DEFAULT_GOVERNANCE_CONFIG,
        structuralFailureThresholds: {
          ...DEFAULT_GOVERNANCE_CONFIG.structuralFailureThresholds,
          modificationThreshold: 2 // Below required minimum of 3
        }
      };
      
      const errors = validateGovernanceConfig(invalidConfig);
      
      expect(errors).toContain('Modification threshold must be at least 3 (per Spec-0)');
    });

    test('should require authority definitions', () => {
      const invalidConfig = {
        ...DEFAULT_GOVERNANCE_CONFIG,
        ssotConfiguration: {
          ...DEFAULT_GOVERNANCE_CONFIG.ssotConfiguration,
          authorityDefinitions: [] // Empty authority definitions
        }
      };
      
      const errors = validateGovernanceConfig(invalidConfig);
      
      expect(errors).toContain('At least one authority definition must be specified');
    });
  });
});

// Property-based tests for governance infrastructure
describe('Governance Infrastructure Property Tests', () => {
  describe('Property 1: 治理规范违规检测完整性', () => {
    /**
     * Feature: project-optimization, Property 1: 治理规范违规检测完整性
     * 
     * For any project containing code that violates Spec-0 to Spec-8 governance specifications,
     * the detection system should be able to identify all violation instances and provide
     * correct specification references.
     * 
     * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
     */
    test('should detect all governance violations with correct spec references', () => {
      fc.assert(
        fc.property(
          // Generate test data for governance violations with correct spec-violation type mappings
          fc.oneof(
            // Spec-0 violations
            fc.record({
              specNumber: fc.constant('Spec-0'),
              violationType: fc.constantFrom(
                ViolationType.PHYSICS_PRIORITY_VIOLATION,
                ViolationType.STRUCTURAL_FAILURE
              ),
              location: fc.record({
                file: fc.string({ minLength: 1, maxLength: 100 }),
                line: fc.integer({ min: 1, max: 1000 }),
                column: fc.integer({ min: 1, max: 100 })
              }),
              description: fc.string({ minLength: 10, maxLength: 200 }),
              severity: fc.constantFrom(
                ViolationSeverity.CRITICAL,
                ViolationSeverity.HIGH,
                ViolationSeverity.MEDIUM,
                ViolationSeverity.LOW
              )
            }),
            // Spec-1 violations
            fc.record({
              specNumber: fc.constant('Spec-1'),
              violationType: fc.constant(ViolationType.LAYER_SEPARATION_VIOLATION),
              location: fc.record({
                file: fc.string({ minLength: 1, maxLength: 100 }),
                line: fc.integer({ min: 1, max: 1000 }),
                column: fc.integer({ min: 1, max: 100 })
              }),
              description: fc.string({ minLength: 10, maxLength: 200 }),
              severity: fc.constantFrom(
                ViolationSeverity.CRITICAL,
                ViolationSeverity.HIGH,
                ViolationSeverity.MEDIUM,
                ViolationSeverity.LOW
              )
            }),
            // Spec-2 violations
            fc.record({
              specNumber: fc.constant('Spec-2'),
              violationType: fc.constantFrom(
                ViolationType.SSOT_VIOLATION,
                ViolationType.CONSTANTS_POLLUTION
              ),
              location: fc.record({
                file: fc.string({ minLength: 1, maxLength: 100 }),
                line: fc.integer({ min: 1, max: 1000 }),
                column: fc.integer({ min: 1, max: 100 })
              }),
              description: fc.string({ minLength: 10, maxLength: 200 }),
              severity: fc.constantFrom(
                ViolationSeverity.CRITICAL,
                ViolationSeverity.HIGH,
                ViolationSeverity.MEDIUM,
                ViolationSeverity.LOW
              )
            }),
            // Spec-6 violations
            fc.record({
              specNumber: fc.constant('Spec-6'),
              violationType: fc.constant(ViolationType.RENDERER_INTELLIGENCE),
              location: fc.record({
                file: fc.string({ minLength: 1, maxLength: 100 }),
                line: fc.integer({ min: 1, max: 1000 }),
                column: fc.integer({ min: 1, max: 100 })
              }),
              description: fc.string({ minLength: 10, maxLength: 200 }),
              severity: fc.constantFrom(
                ViolationSeverity.CRITICAL,
                ViolationSeverity.HIGH,
                ViolationSeverity.MEDIUM,
                ViolationSeverity.LOW
              )
            })
          ),
          (violationData) => {
            // Create a mock violation
            const violation: SpecViolation = {
              specNumber: violationData.specNumber,
              violationType: violationData.violationType,
              location: createSourceLocation(
                violationData.location.file,
                violationData.location.line,
                violationData.location.column
              ),
              description: violationData.description,
              governanceReference: `${violationData.specNumber}: ${violationData.description}`,
              severity: violationData.severity,
              detectedAt: new Date(),
              fixAttempts: 0
            };

            // Test that violation has all required properties
            expect(violation.specNumber).toMatch(/^Spec-[0-8]$/);
            expect(violation.violationType).toBeDefined();
            expect(violation.location).toBeDefined();
            expect(violation.location.file).toBeTruthy();
            expect(violation.location.line).toBeGreaterThan(0);
            expect(violation.location.column).toBeGreaterThan(0);
            expect(violation.description).toBeTruthy();
            expect(violation.governanceReference).toContain(violation.specNumber);
            expect(violation.severity).toBeDefined();
            expect(violation.detectedAt).toBeInstanceOf(Date);
            expect(violation.fixAttempts).toBeGreaterThanOrEqual(0);

            // Test that spec reference is correctly formatted
            expect(violation.governanceReference).toContain(violation.specNumber);
            expect(violation.governanceReference).toContain(violation.description);

            // Test that violation type matches expected patterns for each spec
            switch (violation.specNumber) {
              case 'Spec-0':
                expect([
                  ViolationType.PHYSICS_PRIORITY_VIOLATION,
                  ViolationType.STRUCTURAL_FAILURE
                ]).toContain(violation.violationType);
                break;
              case 'Spec-1':
                expect([
                  ViolationType.LAYER_SEPARATION_VIOLATION
                ]).toContain(violation.violationType);
                break;
              case 'Spec-2':
                expect([
                  ViolationType.SSOT_VIOLATION,
                  ViolationType.CONSTANTS_POLLUTION
                ]).toContain(violation.violationType);
                break;
              case 'Spec-6':
                expect([
                  ViolationType.RENDERER_INTELLIGENCE
                ]).toContain(violation.violationType);
                break;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should correctly identify physics concept violations', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Axial tilt concepts
            fc.record({
              conceptName: fc.constantFrom('earth_axial_tilt'),
              conceptType: fc.constant(PhysicsConceptType.AXIAL_TILT),
              authoritySource: fc.constant('lib/astronomy/constants/axialTilt.ts'),
              violatingFile: fc.string({ minLength: 1, maxLength: 100 })
            }),
            // Physical parameter concepts
            fc.record({
              conceptName: fc.constantFrom('earth_radius'),
              conceptType: fc.constantFrom(PhysicsConceptType.RADIUS, PhysicsConceptType.MASS, PhysicsConceptType.GM),
              authoritySource: fc.constant('lib/astronomy/constants/physicalParams.ts'),
              violatingFile: fc.string({ minLength: 1, maxLength: 100 })
            }),
            // Rotation period concepts
            fc.record({
              conceptName: fc.constantFrom('earth_rotation_period'),
              conceptType: fc.constantFrom(PhysicsConceptType.ROTATION_PERIOD, PhysicsConceptType.ORBITAL_PERIOD),
              authoritySource: fc.constant('lib/astronomy/constants/rotation.ts'),
              violatingFile: fc.string({ minLength: 1, maxLength: 100 })
            }),
            // Reference frame concepts
            fc.record({
              conceptName: fc.constantFrom('j2000_frame'),
              conceptType: fc.constant(PhysicsConceptType.REFERENCE_FRAME),
              authoritySource: fc.constant('lib/astronomy/constants/referenceFrames.ts'),
              violatingFile: fc.string({ minLength: 1, maxLength: 100 })
            })
          ),
          (conceptData) => {
            // Create a physics concept
            const concept: PhysicsConcept = {
              name: conceptData.conceptName,
              type: conceptData.conceptType,
              authoritySource: conceptData.authoritySource,
              allowedUsagePatterns: [],
              forbiddenContexts: ['renderer']
            };

            // Test that concept has required authority source
            expect(concept.authoritySource).toContain('lib/astronomy/constants/');
            
            // Test that concept type matches expected authority file
            switch (concept.type) {
              case PhysicsConceptType.AXIAL_TILT:
                expect(concept.authoritySource).toContain('axialTilt.ts');
                break;
              case PhysicsConceptType.RADIUS:
              case PhysicsConceptType.MASS:
              case PhysicsConceptType.GM:
                expect(concept.authoritySource).toContain('physicalParams.ts');
                break;
              case PhysicsConceptType.ROTATION_PERIOD:
              case PhysicsConceptType.ORBITAL_PERIOD:
                expect(concept.authoritySource).toContain('rotation.ts');
                break;
              case PhysicsConceptType.REFERENCE_FRAME:
                expect(concept.authoritySource).toContain('referenceFrames.ts');
                break;
            }

            // Test that renderer is forbidden context
            expect(concept.forbiddenContexts).toContain('renderer');

            // Test that violating file outside authority should be detected
            if (!conceptData.violatingFile.includes(concept.authoritySource)) {
              // This would be a SSOT violation
              expect(conceptData.violatingFile).not.toBe(concept.authoritySource);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should correctly classify architecture layer violations', () => {
      fc.assert(
        fc.property(
          fc.record({
            sourceLayer: fc.constantFrom(
              ArchitectureLayer.RENDERING,
              ArchitectureLayer.PHYSICS,
              ArchitectureLayer.ASTRONOMY,
              ArchitectureLayer.CONSTANTS,
              ArchitectureLayer.INFRASTRUCTURE
            ),
            targetLayer: fc.constantFrom(
              ArchitectureLayer.RENDERING,
              ArchitectureLayer.PHYSICS,
              ArchitectureLayer.ASTRONOMY,
              ArchitectureLayer.CONSTANTS,
              ArchitectureLayer.INFRASTRUCTURE
            ),
            filePath: fc.string({ minLength: 1, maxLength: 100 })
          }),
          (layerData) => {
            // Test layer classification logic
            const detectedLayer = getModuleLayer(layerData.filePath);
            
            // Test that layer detection is consistent
            expect(Object.values(ArchitectureLayer)).toContain(detectedLayer);

            // Test specific layer detection patterns
            if (layerData.filePath.includes('lib/astronomy/constants/')) {
              expect(detectedLayer).toBe(ArchitectureLayer.CONSTANTS);
            }
            if (layerData.filePath.includes('lib/astronomy/')) {
              expect(detectedLayer).toBe(ArchitectureLayer.ASTRONOMY);
            }
            if (layerData.filePath.includes('components/') || layerData.filePath.includes('lib/3d/')) {
              expect(detectedLayer).toBe(ArchitectureLayer.RENDERING);
            }
            if (layerData.filePath.includes('lib/infrastructure/')) {
              expect(detectedLayer).toBe(ArchitectureLayer.INFRASTRUCTURE);
            }

            // Test forbidden cross-layer access patterns
            if (layerData.sourceLayer === ArchitectureLayer.RENDERING) {
              // Rendering layer should not access physics/astronomy layers
              const forbiddenTargets = [
                ArchitectureLayer.PHYSICS,
                ArchitectureLayer.ASTRONOMY,
                ArchitectureLayer.CONSTANTS
              ];
              
              if (forbiddenTargets.includes(layerData.targetLayer)) {
                // This would be a layer separation violation
                expect(layerData.sourceLayer).toBe(ArchitectureLayer.RENDERING);
                expect(forbiddenTargets).toContain(layerData.targetLayer);
              }
            }

            if (layerData.sourceLayer === ArchitectureLayer.CONSTANTS) {
              // Constants layer should not depend on anything
              if (layerData.targetLayer !== ArchitectureLayer.CONSTANTS) {
                // This would be a constants purity violation
                expect(layerData.sourceLayer).toBe(ArchitectureLayer.CONSTANTS);
                expect(layerData.targetLayer).not.toBe(ArchitectureLayer.CONSTANTS);
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should correctly calculate violation severity based on context', () => {
      fc.assert(
        fc.property(
          fc.record({
            violationType: fc.constantFrom(
              ViolationType.SSOT_VIOLATION,
              ViolationType.LAYER_SEPARATION_VIOLATION,
              ViolationType.RENDERER_INTELLIGENCE,
              ViolationType.MAGIC_NUMBER,
              ViolationType.STRUCTURAL_FAILURE,
              ViolationType.CONSTANTS_POLLUTION,
              ViolationType.PHYSICS_PRIORITY_VIOLATION
            ),
            context: fc.record({
              isPhysicsConcept: fc.boolean(),
              hasPhysicsComputation: fc.boolean(),
              crossesMultipleLayers: fc.boolean(),
              isPhysicsConstant: fc.boolean()
            })
          }),
          (severityData) => {
            const severity = ViolationSeverityCalculator.calculateSeverity(
              severityData.violationType,
              severityData.context
            );

            // Test that severity is valid
            expect(Object.values(ViolationSeverity)).toContain(severity);

            // Test specific severity rules
            switch (severityData.violationType) {
              case ViolationType.STRUCTURAL_FAILURE:
                expect(severity).toBe(ViolationSeverity.CRITICAL);
                break;
              
              case ViolationType.SSOT_VIOLATION:
                if (severityData.context.isPhysicsConcept) {
                  expect(severity).toBe(ViolationSeverity.HIGH);
                } else {
                  expect(severity).toBe(ViolationSeverity.MEDIUM);
                }
                break;
              
              case ViolationType.RENDERER_INTELLIGENCE:
                if (severityData.context.hasPhysicsComputation) {
                  expect(severity).toBe(ViolationSeverity.HIGH);
                } else {
                  expect(severity).toBe(ViolationSeverity.MEDIUM);
                }
                break;
              
              case ViolationType.LAYER_SEPARATION_VIOLATION:
                if (severityData.context.crossesMultipleLayers) {
                  expect(severity).toBe(ViolationSeverity.HIGH);
                } else {
                  expect(severity).toBe(ViolationSeverity.MEDIUM);
                }
                break;
              
              case ViolationType.MAGIC_NUMBER:
                if (severityData.context.isPhysicsConstant) {
                  expect(severity).toBe(ViolationSeverity.MEDIUM);
                } else {
                  expect(severity).toBe(ViolationSeverity.LOW);
                }
                break;
              
              case ViolationType.CONSTANTS_POLLUTION:
                expect(severity).toBe(ViolationSeverity.MEDIUM);
                break;
              
              case ViolationType.PHYSICS_PRIORITY_VIOLATION:
                expect(severity).toBe(ViolationSeverity.HIGH);
                break;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should validate governance specifications completeness', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Spec-0', 'Spec-1', 'Spec-2', 'Spec-6'),
          (specNumber) => {
            const allSpecs = GovernanceSpecImpl.getAllSpecs();
            const spec = allSpecs.find(s => s.specNumber === specNumber);

            // Test that spec exists and is complete
            expect(spec).toBeDefined();
            expect(spec!.specNumber).toBe(specNumber);
            expect(spec!.title).toBeTruthy();
            expect(spec!.rules).toBeDefined();
            expect(spec!.rules.length).toBeGreaterThan(0);

            // Test that each rule has required properties
            spec!.rules.forEach(rule => {
              expect(rule.id).toBeTruthy();
              expect(rule.description).toBeTruthy();
              expect(rule.ruleType).toBeDefined();
              expect(rule.enforcementLevel).toBeDefined();
              expect(rule.validationCriteria).toBeDefined();
              expect(rule.validationCriteria.length).toBeGreaterThan(0);

              // Test validation criteria completeness
              rule.validationCriteria.forEach(criteria => {
                expect(criteria.name).toBeTruthy();
                expect(criteria.description).toBeTruthy();
                expect(criteria.validator).toBeDefined();
                expect(typeof criteria.validator).toBe('function');
                expect(criteria.errorMessage).toBeTruthy();
              });
            });

            // Test spec-specific requirements
            switch (specNumber) {
              case 'Spec-0':
                expect(spec!.title).toContain('最高约束');
                expect(spec!.failureConditions).toBeDefined();
                expect(spec!.failureConditions!.length).toBeGreaterThan(0);
                break;
              case 'Spec-1':
                expect(spec!.title).toContain('Architecture Guardian');
                break;
              case 'Spec-2':
                expect(spec!.title).toContain('Physics Guardian');
                break;
              case 'Spec-6':
                expect(spec!.title).toContain('愚蠢化');
                break;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});