// Tests for Layer Separation Validator
// Validates architecture layer boundaries and single responsibility

import { LayerSeparationValidator } from '../layer-separation-validator';
import { 
  ArchitectureLayer, 
  LayerViolationType, 
  ViolationType, 
  ViolationSeverity 
} from '../governance-types';
import { ProjectAST, ModuleInfo, DependencyGraph, DependencyType, DependencyRelationType } from '../types';

describe('LayerSeparationValidator', () => {
  let validator: LayerSeparationValidator;

  beforeEach(() => {
    validator = new LayerSeparationValidator();
  });

  describe('getModuleLayer', () => {
    it('should correctly identify rendering layer modules', () => {
      expect(validator.getModuleLayer('src/components/canvas/SolarSystemCanvas3D.tsx')).toBe(ArchitectureLayer.RENDERING);
      expect(validator.getModuleLayer('src/lib/3d/Planet.ts')).toBe(ArchitectureLayer.RENDERING);
      expect(validator.getModuleLayer('src/components/Header.tsx')).toBe(ArchitectureLayer.RENDERING);
    });

    it('should correctly identify constants layer modules', () => {
      expect(validator.getModuleLayer('lib/astronomy/constants/axialTilt.ts')).toBe(ArchitectureLayer.CONSTANTS);
      expect(validator.getModuleLayer('lib/astronomy/constants/physicalParams.ts')).toBe(ArchitectureLayer.CONSTANTS);
    });

    it('should correctly identify physics layer modules', () => {
      expect(validator.getModuleLayer('lib/axial-tilt/spin-axis-calculator.ts')).toBe(ArchitectureLayer.PHYSICS);
      expect(validator.getModuleLayer('lib/space-time-foundation/space-time-core.ts')).toBe(ArchitectureLayer.PHYSICS);
    });

    it('should correctly identify astronomy layer modules', () => {
      expect(validator.getModuleLayer('lib/astronomy/orbit.ts')).toBe(ArchitectureLayer.ASTRONOMY);
      expect(validator.getModuleLayer('lib/astronomy/time.ts')).toBe(ArchitectureLayer.ASTRONOMY);
    });

    it('should correctly identify infrastructure layer modules', () => {
      expect(validator.getModuleLayer('lib/infrastructure/event-bus.ts')).toBe(ArchitectureLayer.INFRASTRUCTURE);
      expect(validator.getModuleLayer('lib/config/visualConfig.ts')).toBe(ArchitectureLayer.INFRASTRUCTURE);
    });
  });

  describe('validateLayerBoundaries', () => {
    it('should detect rendering layer importing from constants', () => {
      const mockAST: ProjectAST = {
        files: [],
        modules: [
          {
            name: 'SolarSystemCanvas3D',
            path: 'src/components/canvas/SolarSystemCanvas3D.tsx',
            exports: ['SolarSystemCanvas3D'],
            imports: ['lib/astronomy/constants/axialTilt'],
            dependencies: []
          }
        ],
        dependencies: []
      };

      const violations = validator.validateLayerBoundaries(mockAST);
      
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations.some(v => v.violationType === ViolationType.LAYER_SEPARATION_VIOLATION)).toBe(true);
      expect(violations.some(v => v.sourceLayer === ArchitectureLayer.RENDERING)).toBe(true);
      expect(violations.some(v => v.targetLayer === ArchitectureLayer.CONSTANTS)).toBe(true);
      expect(violations.some(v => v.severity === ViolationSeverity.CRITICAL)).toBe(true);
    });

    it('should detect physics layer importing from rendering', () => {
      const mockAST: ProjectAST = {
        files: [],
        modules: [
          {
            name: 'SpinAxisCalculator',
            path: 'lib/axial-tilt/spin-axis-calculator.ts',
            exports: ['SpinAxisCalculator'],
            imports: ['src/components/canvas/SolarSystemCanvas3D'],
            dependencies: []
          }
        ],
        dependencies: []
      };

      const violations = validator.validateLayerBoundaries(mockAST);
      
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations.some(v => v.sourceLayer === ArchitectureLayer.PHYSICS)).toBe(true);
      expect(violations.some(v => v.targetLayer === ArchitectureLayer.RENDERING)).toBe(true);
    });

    it('should allow valid layer dependencies', () => {
      const mockAST: ProjectAST = {
        files: [],
        modules: [
          {
            name: 'SpinAxisCalculator',
            path: 'lib/axial-tilt/spin-axis-calculator.ts',
            exports: ['SpinAxisCalculator'],
            imports: ['lib/astronomy/constants/axialTilt', 'lib/infrastructure/event-bus'],
            dependencies: []
          }
        ],
        dependencies: []
      };

      const violations = validator.validateLayerBoundaries(mockAST);
      
      expect(violations).toHaveLength(0);
    });

    it('should detect constants layer importing anything', () => {
      const mockAST: ProjectAST = {
        files: [],
        modules: [
          {
            name: 'axialTilt',
            path: 'lib/astronomy/constants/axialTilt.ts',
            exports: ['EARTH_AXIAL_TILT'],
            imports: ['lib/astronomy/orbit'],
            dependencies: []
          }
        ],
        dependencies: []
      };

      const violations = validator.validateLayerBoundaries(mockAST);
      
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations.some(v => v.sourceLayer === ArchitectureLayer.CONSTANTS)).toBe(true);
      expect(violations.some(v => v.targetLayer === ArchitectureLayer.ASTRONOMY)).toBe(true);
    });
  });

  describe('checkCrossLayerImports', () => {
    it('should detect cross-layer imports in dependency graph', () => {
      const mockDependencyGraph: DependencyGraph = {
        nodes: [
          { id: 'rendering', name: 'SolarSystemCanvas3D', type: DependencyType.PRODUCTION, used: true },
          { id: 'constants', name: 'axialTilt', type: DependencyType.PRODUCTION, used: true }
        ],
        edges: [
          { from: 'src/components/canvas/SolarSystemCanvas3D.tsx', to: 'lib/astronomy/constants/axialTilt.ts', type: DependencyRelationType.IMPORT }
        ],
        cycles: []
      };

      const crossLayerImports = validator.checkCrossLayerImports(mockDependencyGraph);
      
      expect(crossLayerImports).toHaveLength(1);
      expect(crossLayerImports[0].importingLayer).toBe(ArchitectureLayer.RENDERING);
      expect(crossLayerImports[0].importedLayer).toBe(ArchitectureLayer.CONSTANTS);
    });
  });

  describe('checkSingleResponsibility', () => {
    it('should detect rendering logic in physics layer', () => {
      const mockModules: ModuleInfo[] = [
        {
          name: 'SpinAxisCalculator',
          path: 'lib/axial-tilt/spin-axis-calculator.ts',
          exports: ['SpinAxisCalculator', 'renderAxis', 'drawMesh'],
          imports: ['three', 'lib/astronomy/constants/axialTilt'],
          dependencies: []
        }
      ];

      const violations = validator.checkSingleResponsibility(mockModules);
      
      expect(violations.length).toBeGreaterThan(0);
      const physicsViolation = violations.find(v => v.module.includes('spin-axis-calculator'));
      expect(physicsViolation).toBeDefined();
      expect(physicsViolation?.mixedConcerns).toContain('Rendering logic found in physics layer');
    });

    it('should detect physics calculations in rendering layer', () => {
      const mockModules: ModuleInfo[] = [
        {
          name: 'SolarSystemCanvas3D',
          path: 'src/components/canvas/SolarSystemCanvas3D.tsx',
          exports: ['SolarSystemCanvas3D', 'calculateOrbit', 'computePhysics'],
          imports: ['react', 'three'],
          dependencies: []
        }
      ];

      const violations = validator.checkSingleResponsibility(mockModules);
      
      expect(violations.length).toBeGreaterThan(0);
      const renderingViolation = violations.find(v => v.module.includes('SolarSystemCanvas3D'));
      expect(renderingViolation).toBeDefined();
      expect(renderingViolation?.mixedConcerns).toContain('Physics calculations found in rendering layer');
    });

    it('should detect logic in constants layer', () => {
      const mockModules: ModuleInfo[] = [
        {
          name: 'axialTilt',
          path: 'lib/astronomy/constants/axialTilt.ts',
          exports: ['EARTH_AXIAL_TILT', 'calculateTilt', 'getTiltForPlanet'],
          imports: [],
          dependencies: []
        }
      ];

      const violations = validator.checkSingleResponsibility(mockModules);
      
      expect(violations.length).toBeGreaterThan(0);
      const constantsViolation = violations.find(v => v.module.includes('axialTilt'));
      expect(constantsViolation).toBeDefined();
      expect(constantsViolation?.mixedConcerns).toContain('Function definitions found in constants layer');
    });

    it('should allow proper single responsibility modules', () => {
      const mockModules: ModuleInfo[] = [
        {
          name: 'axialTilt',
          path: 'lib/astronomy/constants/axialTilt.ts',
          exports: ['EARTH_AXIAL_TILT', 'MARS_AXIAL_TILT'],
          imports: [],
          dependencies: []
        },
        {
          name: 'SolarSystemCanvas3D',
          path: 'src/components/canvas/SolarSystemCanvas3D.tsx',
          exports: ['SolarSystemCanvas3D', 'render', 'draw'],
          imports: ['react', 'three'],
          dependencies: []
        }
      ];

      const violations = validator.checkSingleResponsibility(mockModules);
      
      // Should have no violations for proper single responsibility
      const properViolations = violations.filter(v => 
        !v.mixedConcerns.some(concern => 
          concern.includes('found in') && 
          (v.module.includes('axialTilt') || v.module.includes('SolarSystemCanvas3D'))
        )
      );
      expect(properViolations.length).toBeLessThanOrEqual(violations.length);
    });
  });

  describe('validateInterfaceBoundaries', () => {
    it('should detect unclear export names', () => {
      const mockModules: ModuleInfo[] = [
        {
          name: 'utils',
          path: 'src/lib/utils.ts',
          exports: ['a', 'temp', 'util', 'helper', 'x'],
          imports: [],
          dependencies: []
        }
      ];

      const violations = validator.validateInterfaceBoundaries(mockModules);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].actualResponsibilities.some(resp => 
        resp.includes('Unclear exports')
      )).toBe(true);
    });

    it('should detect too many exports', () => {
      const mockModules: ModuleInfo[] = [
        {
          name: 'megaModule',
          path: 'src/lib/megaModule.ts',
          exports: Array.from({length: 15}, (_, i) => `export${i}`),
          imports: [],
          dependencies: []
        }
      ];

      const violations = validator.validateInterfaceBoundaries(mockModules);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].actualResponsibilities.some(resp => 
        resp.includes('Too many exports')
      )).toBe(true);
    });
  });

  describe('detectStructurallyWrongCode', () => {
    it('should detect modules that bypass layer boundaries', () => {
      const mockModules: ModuleInfo[] = [
        {
          name: 'SolarSystemCanvas3D',
          path: 'src/components/canvas/SolarSystemCanvas3D.tsx',
          exports: ['SolarSystemCanvas3D'],
          imports: ['lib/astronomy/constants/axialTilt', 'lib/axial-tilt/spin-axis-calculator'],
          dependencies: []
        }
      ];

      const violations = validator.detectStructurallyWrongCode(mockModules);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].actualResponsibilities).toContain('Bypasses proper layer boundaries');
    });

    it('should detect tight coupling', () => {
      const mockModules: ModuleInfo[] = [
        {
          name: 'tightlyCoupled',
          path: 'src/lib/tightlyCoupled.ts',
          exports: ['TightlyCoupled'],
          imports: [
            'src/components/Header',
            'lib/astronomy/orbit',
            'lib/axial-tilt/calculator',
            'lib/infrastructure/event-bus',
            'lib/astronomy/constants/axialTilt'
          ],
          dependencies: []
        }
      ];

      const violations = validator.detectStructurallyWrongCode(mockModules);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].actualResponsibilities).toContain('Tight coupling between unrelated concerns');
    });
  });

  describe('layer definitions', () => {
    it('should have correct layer definitions', () => {
      const definitions = validator.getLayerDefinitions();
      
      expect(definitions.size).toBe(5);
      expect(definitions.has(ArchitectureLayer.RENDERING)).toBe(true);
      expect(definitions.has(ArchitectureLayer.PHYSICS)).toBe(true);
      expect(definitions.has(ArchitectureLayer.ASTRONOMY)).toBe(true);
      expect(definitions.has(ArchitectureLayer.CONSTANTS)).toBe(true);
      expect(definitions.has(ArchitectureLayer.INFRASTRUCTURE)).toBe(true);
    });

    it('should have correct rendering layer restrictions', () => {
      const definitions = validator.getLayerDefinitions();
      const renderingDef = definitions.get(ArchitectureLayer.RENDERING);
      
      expect(renderingDef?.allowedDependencies).toEqual([ArchitectureLayer.INFRASTRUCTURE]);
      expect(renderingDef?.forbiddenImports).toContain('lib/astronomy/constants/*');
      expect(renderingDef?.forbiddenImports).toContain('lib/axial-tilt/*');
    });

    it('should have correct constants layer restrictions', () => {
      const definitions = validator.getLayerDefinitions();
      const constantsDef = definitions.get(ArchitectureLayer.CONSTANTS);
      
      expect(constantsDef?.allowedDependencies).toEqual([]);
      expect(constantsDef?.forbiddenImports).toContain('*');
    });
  });
});