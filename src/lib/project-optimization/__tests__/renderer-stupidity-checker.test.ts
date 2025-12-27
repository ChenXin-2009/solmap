// Renderer Stupidity Checker Tests
import { 
  RendererStupidityCheckerImpl, 
  createRendererStupidityChecker, 
  isRendererFile,
  extractRendererViolations 
} from '../renderer-stupidity-checker';
import { ModuleInfo, ProjectAST } from '../types';
import { 
  RendererInputViolation, 
  PhysicsKnowledgeViolation,
  RendererImportViolation,
  ComputationViolation,
  ImportInfo,
  FileAST as GovernanceFileAST
} from '../governance-interfaces';

describe('RendererStupidityChecker', () => {
  let checker: RendererStupidityCheckerImpl;

  beforeEach(() => {
    checker = new RendererStupidityCheckerImpl();
  });

  describe('identifyRendererModules', () => {
    it('should identify renderer modules by path patterns', () => {
      const ast: ProjectAST = {
        files: [],
        modules: [
          { name: 'SolarSystemCanvas3D', path: 'src/components/canvas/3d/SolarSystemCanvas3D.tsx', exports: [], imports: [], dependencies: [] },
          { name: 'Planet', path: 'src/lib/3d/Planet.ts', exports: [], imports: [], dependencies: [] },
          { name: 'SceneManager', path: 'src/lib/3d/SceneManager.ts', exports: [], imports: [], dependencies: [] },
          { name: 'OrbitCalculator', path: 'src/lib/astronomy/orbit.ts', exports: [], imports: [], dependencies: [] }
        ],
        dependencies: []
      };

      const rendererModules = checker.identifyRendererModules(ast);

      expect(rendererModules).toContain('src/components/canvas/3d/SolarSystemCanvas3D.tsx');
      expect(rendererModules).toContain('src/lib/3d/Planet.ts');
      expect(rendererModules).toContain('src/lib/3d/SceneManager.ts');
      expect(rendererModules).not.toContain('src/lib/astronomy/orbit.ts');
    });

    it('should return empty array for non-renderer modules', () => {
      const ast: ProjectAST = {
        files: [],
        modules: [
          { name: 'OrbitCalculator', path: 'src/lib/astronomy/orbit.ts', exports: [], imports: [], dependencies: [] },
          { name: 'PhysicsConstants', path: 'src/lib/constants/physics.ts', exports: [], imports: [], dependencies: [] }
        ],
        dependencies: []
      };

      const rendererModules = checker.identifyRendererModules(ast);

      expect(rendererModules).toHaveLength(0);
    });
  });

  describe('checkRendererInputs', () => {
    it('should detect forbidden inputs in renderer modules', () => {
      const rendererModules: ModuleInfo[] = [
        { 
          name: 'TestRenderer', 
          path: 'src/components/canvas/TestRenderer.tsx', 
          exports: ['TestRenderer'], 
          imports: ['axialTilt', 'orbitalPeriod'], 
          dependencies: [] 
        }
      ];

      const violations = checker.checkRendererInputs(rendererModules);

      expect(violations).toHaveLength(1);
      expect(violations[0].rendererModule).toBe('src/components/canvas/TestRenderer.tsx');
      expect(violations[0].allowedInputs).toContain('positionVector');
      expect(violations[0].allowedInputs).toContain('attitudeMatrix');
      expect(violations[0].allowedInputs).toContain('visualParams');
    });

    it('should not report violations for modules with allowed inputs', () => {
      const rendererModules: ModuleInfo[] = [
        { 
          name: 'GoodRenderer', 
          path: 'src/components/canvas/GoodRenderer.tsx', 
          exports: ['GoodRenderer'], 
          imports: ['position', 'rotation', 'material'], 
          dependencies: [] 
        }
      ];

      const violations = checker.checkRendererInputs(rendererModules);

      expect(violations).toHaveLength(0);
    });
  });

  describe('detectPhysicsKnowledge', () => {
    it('should detect forbidden physics concepts in renderer code', () => {
      const rendererCode = [
        'const tilt = axialTilt * Math.PI / 180;',
        'const period = rotationPeriod * 24 * 3600;',
        'return position.transform(referenceFrame);'
      ];

      const violations = checker.detectPhysicsKnowledge(rendererCode);

      expect(violations).toHaveLength(3);
      expect(violations[0].detectedConcepts).toContain('axialTilt');
      expect(violations[1].detectedConcepts).toContain('rotationPeriod');
      expect(violations[2].detectedConcepts).toContain('referenceFrame');
    });

    it('should not detect violations in clean renderer code', () => {
      const rendererCode = [
        'const mesh = new THREE.Mesh(geometry, material);',
        'mesh.position.set(x, y, z);',
        'mesh.rotation.set(rx, ry, rz);'
      ];

      const violations = checker.detectPhysicsKnowledge(rendererCode);

      expect(violations).toHaveLength(0);
    });
  });

  describe('validateRendererImports', () => {
    it('should detect forbidden imports in renderer modules', () => {
      const imports: ImportInfo[] = [
        {
          source: 'lib/astronomy/constants/axialTilt',
          imported: ['EARTH_AXIAL_TILT'],
          location: { file: 'src/components/canvas/BadRenderer.tsx', line: 1, column: 1 },
          module: 'src/components/canvas/BadRenderer.tsx'
        },
        {
          source: 'lib/physics/orbital',
          imported: ['calculateOrbit'],
          location: { file: 'src/components/canvas/BadRenderer.tsx', line: 2, column: 1 },
          module: 'src/components/canvas/BadRenderer.tsx'
        }
      ];

      const violations = checker.validateRendererImports(imports);

      expect(violations).toHaveLength(2);
      expect(violations[0].violations[0].importedModule).toBe('lib/astronomy/constants/axialTilt');
      expect(violations[1].violations[0].importedModule).toBe('lib/physics/orbital');
    });

    it('should not report violations for allowed imports', () => {
      const imports: ImportInfo[] = [
        {
          source: 'three',
          imported: ['Mesh', 'Material'],
          location: { file: 'src/components/canvas/GoodRenderer.tsx', line: 1, column: 1 },
          module: 'src/components/canvas/GoodRenderer.tsx'
        }
      ];

      const violations = checker.validateRendererImports(imports);

      expect(violations).toHaveLength(0);
    });
  });

  describe('checkComputationLogic', () => {
    it('should detect forbidden computations in renderer AST', () => {
      const rendererAST: GovernanceFileAST[] = [
        {
          path: 'src/components/canvas/ComputingRenderer.tsx',
          ast: {},
          imports: [],
          exports: [],
          functions: [
            {
              name: 'calculateAngle',
              parameters: ['x', 'y'],
              location: { file: 'src/components/canvas/ComputingRenderer.tsx', line: 10, column: 1 },
              complexity: 5
            }
          ],
          computations: [
            {
              type: 'trigonometric',
              description: 'angle calculation',
              location: { file: 'src/components/canvas/ComputingRenderer.tsx', line: 15, column: 1 },
              variables: ['angle']
            }
          ]
        }
      ];

      const violations = checker.checkComputationLogic(rendererAST);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].rendererModule).toBe('src/components/canvas/ComputingRenderer.tsx');
      expect(violations[0].computationType).toBe('physics_derivation');
    });

    it('should not report violations for non-renderer modules', () => {
      const nonRendererAST: GovernanceFileAST[] = [
        {
          path: 'src/lib/astronomy/calculations.ts',
          ast: {},
          imports: [],
          exports: [],
          functions: [
            {
              name: 'calculateOrbit',
              parameters: ['planet'],
              location: { file: 'src/lib/astronomy/calculations.ts', line: 10, column: 1 },
              complexity: 10
            }
          ],
          computations: []
        }
      ];

      const violations = checker.checkComputationLogic(nonRendererAST);

      expect(violations).toHaveLength(0);
    });
  });

  describe('utility functions', () => {
    describe('isRendererFile', () => {
      it('should identify renderer files correctly', () => {
        expect(isRendererFile('src/components/canvas/3d/SolarSystem.tsx')).toBe(true);
        expect(isRendererFile('src/lib/3d/Planet.ts')).toBe(true);
        expect(isRendererFile('src/components/render/Scene.tsx')).toBe(true);
        expect(isRendererFile('src/lib/astronomy/orbit.ts')).toBe(false);
        expect(isRendererFile('src/lib/constants/physics.ts')).toBe(false);
      });
    });

    describe('extractRendererViolations', () => {
      it('should convert specific violations to general renderer violations', () => {
        const inputViolations: RendererInputViolation[] = [
          {
            rendererModule: 'test.tsx',
            allowedInputs: ['position'],
            actualInputs: ['axialTilt'],
            violations: ['forbidden input'],
            location: { file: 'test.tsx', line: 1, column: 1 }
          }
        ];

        const knowledgeViolations: PhysicsKnowledgeViolation[] = [
          {
            rendererModule: 'test.tsx',
            forbiddenConcepts: ['axialTilt'],
            detectedConcepts: ['axialTilt'],
            location: { file: 'test.tsx', line: 2, column: 1 }
          }
        ];

        const violations = extractRendererViolations(inputViolations, knowledgeViolations, [], []);

        expect(violations).toHaveLength(2);
        expect(violations[0].specNumber).toBe('Spec-3');
        expect(violations[0].governanceReference).toContain('Spec-3.1');
        expect(violations[1].governanceReference).toContain('Spec-3.2');
      });
    });
  });

  describe('factory function', () => {
    it('should create a renderer stupidity checker instance', () => {
      const checker = createRendererStupidityChecker();
      expect(checker).toBeInstanceOf(RendererStupidityCheckerImpl);
    });
  });
});