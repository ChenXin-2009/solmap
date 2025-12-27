// Tests for SSOT Violation Detector
// Validates detection of Single Source of Truth violations

import { SSOTViolationDetectorImpl } from '../ssot-violation-detector';
import { PhysicsConceptType, PhysicsConstantType, ViolationSeverity } from '../governance-types';
import { ProjectAST } from '../types';

describe('SSOTViolationDetector', () => {
  let detector: SSOTViolationDetectorImpl;

  beforeEach(() => {
    detector = new SSOTViolationDetectorImpl();
  });

  describe('detectDuplicateDefinitions', () => {
    it('should detect duplicate physics concept definitions', () => {
      const mockAST: ProjectAST = {
        files: [
          {
            path: 'lib/astronomy/constants/axialTilt.ts',
            variables: [
              { name: 'EARTH_AXIAL_TILT', value: 23.44, kind: 'const', initialized: true }
            ]
          },
          {
            path: 'src/components/Planet.ts',
            variables: [
              { name: 'EARTH_AXIAL_TILT', value: 23.4, kind: 'const', initialized: true }
            ]
          }
        ],
        modules: [],
        dependencies: []
      };

      const duplicates = detector.detectDuplicateDefinitions(mockAST);
      
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].concept.type).toBe(PhysicsConceptType.AXIAL_TILT);
      expect(duplicates[0].duplicateLocations).toHaveLength(1);
      expect(duplicates[0].violationSeverity).toBe(ViolationSeverity.CRITICAL);
    });

    it('should not flag single definitions as duplicates', () => {
      const mockAST: ProjectAST = {
        files: [
          {
            path: 'lib/astronomy/constants/axialTilt.ts',
            variables: [
              { name: 'EARTH_AXIAL_TILT', value: 23.44, kind: 'const', initialized: true }
            ]
          }
        ],
        modules: [],
        dependencies: []
      };

      const duplicates = detector.detectDuplicateDefinitions(mockAST);
      
      expect(duplicates).toHaveLength(0);
    });
  });

  describe('validatePhysicsConstants', () => {
    it('should detect imports from non-authority sources', () => {
      const mockAST: ProjectAST = {
        files: [
          {
            path: 'src/components/Planet.ts',
            imports: [
              {
                source: 'src/utils/constants.ts',
                specifiers: [{ imported: 'EARTH_AXIAL_TILT', local: 'EARTH_AXIAL_TILT', type: 'named' }],
                type: 'import'
              }
            ]
          }
        ],
        modules: [],
        dependencies: []
      };

      const violations = detector.validatePhysicsConstants(mockAST);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].expectedSource).toBe('lib/astronomy/constants/axialTilt.ts');
      expect(violations[0].actualSource).toBe('src/utils/constants.ts');
    });

    it('should allow imports from authority sources', () => {
      const mockAST: ProjectAST = {
        files: [
          {
            path: 'src/components/Planet.ts',
            imports: [
              {
                source: 'lib/astronomy/constants/axialTilt',
                specifiers: [{ imported: 'EARTH_AXIAL_TILT', local: 'EARTH_AXIAL_TILT', type: 'named' }],
                type: 'import'
              }
            ]
          }
        ],
        modules: [],
        dependencies: []
      };

      const violations = detector.validatePhysicsConstants(mockAST);
      
      expect(violations).toHaveLength(0);
    });
  });

  describe('validateConstantsDirectory', () => {
    it('should detect logic in constants files', () => {
      // This would require actual file system access
      // For now, we'll test the internal method
      const violations = detector['checkConstantsFilePurity'](
        'lib/astronomy/constants/test.ts',
        `
        export const EARTH_RADIUS = 6371;
        
        function calculateSurfaceArea() {
          return 4 * Math.PI * EARTH_RADIUS * EARTH_RADIUS;
        }
        `
      );

      expect(violations).toHaveLength(1);
      expect(violations[0].violationType).toBe('logic');
      expect(violations[0].description).toContain('function definitions');
    });

    it('should detect computational logic in constants files', () => {
      const violations = detector['checkConstantsFilePurity'](
        'lib/astronomy/constants/test.ts',
        `
        export const EARTH_RADIUS = 6371;
        export const EARTH_DIAMETER = EARTH_RADIUS * 2;
        `
      );

      expect(violations).toHaveLength(1);
      expect(violations[0].violationType).toBe('computation');
      expect(violations[0].description).toContain('computational logic');
    });

    it('should allow pure constant definitions', () => {
      const violations = detector['checkConstantsFilePurity'](
        'lib/astronomy/constants/test.ts',
        `
        export const EARTH_RADIUS = 6371; // km
        export const EARTH_MASS = 5.972e24; // kg
        
        export const EARTH_PARAMS = Object.freeze({
          radius: EARTH_RADIUS,
          mass: EARTH_MASS
        });
        `
      );

      expect(violations).toHaveLength(0);
    });
  });

  describe('checkAuthorityDefinitions', () => {
    it('should detect physics definitions outside authority files', () => {
      const mockAST: ProjectAST = {
        files: [
          {
            type: 'Program',
            body: [],
            sourceType: 'module',
            imports: [],
            exports: [],
            functions: [],
            classes: [],
            variables: [
              { name: 'EARTH_AXIAL_TILT', value: 23.44, kind: 'const', initialized: true }
            ]
          }
        ],
        modules: [
          { name: 'Planet', path: 'src/components/Planet.ts', exports: [], imports: [], dependencies: [] }
        ],
        dependencies: []
      };

      const violations = detector.checkAuthorityDefinitions(mockAST);
      
      expect(violations).toHaveLength(1);
      expect(violations[0].expectedAuthority).toBe('lib/astronomy/constants/axialTilt.ts');
      expect(violations[0].actualSource).toBe('src/components/Planet.ts');
    });

    it('should allow definitions in authority files', () => {
      const mockAST: ProjectAST = {
        files: [
          {
            type: 'Program',
            body: [],
            sourceType: 'module',
            imports: [],
            exports: [],
            functions: [],
            classes: [],
            variables: [
              { name: 'EARTH_AXIAL_TILT', value: 23.44, kind: 'const', initialized: true }
            ]
          }
        ],
        modules: [
          { name: 'axialTilt', path: 'lib/astronomy/constants/axialTilt.ts', exports: [], imports: [], dependencies: [] }
        ],
        dependencies: []
      };

      const violations = detector.checkAuthorityDefinitions(mockAST);
      
      expect(violations).toHaveLength(0);
    });
  });
});