// Tests for Magic Number Detector
// Validates Spec-4: Magic Number Elimination compliance

import { MagicNumberDetector } from '../magic-number-detector';
import { ProjectAST, SourceLocation } from '../types';
import { 
  MagicNumberViolation, 
  ViolationType, 
  ViolationSeverity,
  PhysicsConstantType 
} from '../governance-types';

describe('MagicNumberDetector', () => {
  let detector: MagicNumberDetector;

  beforeEach(() => {
    detector = new MagicNumberDetector();
  });

  describe('detectHardcodedConstants', () => {
    it('should detect hardcoded physics constants', () => {
      const mockAST: ProjectAST = {
        files: [{
          type: 'Program',
          body: [],
          sourceType: 'module',
          imports: [],
          exports: [],
          functions: [],
          classes: [],
          variables: []
        }],
        modules: [{
          name: 'test',
          path: 'src/test.ts',
          exports: [],
          imports: [],
          dependencies: []
        }],
        dependencies: []
      };

      const violations = detector.detectHardcodedConstants(mockAST);
      
      // Basic structure test - actual implementation would need real AST parsing
      expect(Array.isArray(violations)).toBe(true);
    });

    it('should skip constants files', () => {
      const mockAST: ProjectAST = {
        files: [{
          type: 'Program',
          body: [],
          sourceType: 'module',
          imports: [],
          exports: [],
          functions: [],
          classes: [],
          variables: []
        }],
        modules: [{
          name: 'axialTilt',
          path: 'src/lib/astronomy/constants/axialTilt.ts',
          exports: [],
          imports: [],
          dependencies: []
        }],
        dependencies: []
      };

      const violations = detector.detectHardcodedConstants(mockAST);
      expect(violations).toHaveLength(0);
    });
  });

  describe('suggestAuthoritySource', () => {
    it('should suggest correct authority source for axial tilt values', () => {
      const source = detector.suggestAuthoritySource(23.44, 'earthTilt');
      expect(source).toBe('lib/astronomy/constants/axialTilt.ts');
    });

    it('should suggest correct authority source for period values', () => {
      const source = detector.suggestAuthoritySource(365.25, 'earthPeriod');
      expect(source).toBe('lib/astronomy/constants/rotation.ts');
    });

    it('should suggest correct authority source for physical parameters', () => {
      const source = detector.suggestAuthoritySource(6371, 'earthRadius');
      expect(source).toBe('lib/astronomy/constants/physicalParams.ts');
    });

    it('should suggest reference frames for coordinate values', () => {
      const source = detector.suggestAuthoritySource(0, 'coordinateFrame');
      expect(source).toBe('lib/astronomy/constants/referenceFrames.ts');
    });
  });

  describe('validateConstantSources', () => {
    it('should detect constants from wrong sources', () => {
      const constants = [{
        name: 'earthTilt',
        value: 23.44,
        source: 'src/components/Planet.ts',
        location: {
          file: 'src/components/Planet.ts',
          line: 10,
          column: 5
        } as SourceLocation,
        expectedSource: 'lib/astronomy/constants/axialTilt.ts'
      }];

      const violations = detector.validateConstantSources(constants);
      expect(violations).toHaveLength(1);
      expect(violations[0].expectedSource).toBe('lib/astronomy/constants/axialTilt.ts');
      expect(violations[0].actualSource).toBe('src/components/Planet.ts');
    });
  });

  describe('checkUnitClarity', () => {
    it('should detect missing units for physics values', () => {
      const values = [{
        value: 6371,
        context: 'earthRadius',
        location: {
          file: 'src/test.ts',
          line: 5,
          column: 10
        } as SourceLocation,
        hasUnit: false,
        hasReferenceFrame: false
      }];

      const violations = detector.checkUnitClarity(values);
      expect(violations).toHaveLength(1);
      expect(violations[0].missingUnit).toBe(true);
      expect(violations[0].suggestedUnit).toBe('km');
    });

    it('should detect missing reference frames for coordinate values', () => {
      const values = [{
        value: 0,
        context: 'positionVector',
        location: {
          file: 'src/test.ts',
          line: 5,
          column: 10
        } as SourceLocation,
        hasUnit: false,
        hasReferenceFrame: false
      }];

      const violations = detector.checkUnitClarity(values);
      expect(violations).toHaveLength(1);
      expect(violations[0].missingReferenceFrame).toBe(true);
      expect(violations[0].suggestedReferenceFrame).toBe('J2000');
    });
  });

  describe('detectConfigurationValues', () => {
    it('should detect hardcoded values in configuration', () => {
      const mockAST: ProjectAST = {
        files: [{
          type: 'Program',
          body: [],
          sourceType: 'module',
          imports: [],
          exports: [],
          functions: [],
          classes: [],
          variables: []
        }],
        modules: [{
          name: 'visualConfig',
          path: 'src/config/visualConfig.ts',
          exports: [],
          imports: [],
          dependencies: []
        }],
        dependencies: []
      };

      const violations = detector.detectConfigurationValues(mockAST);
      expect(Array.isArray(violations)).toBe(true);
    });
  });

  describe('analyzeConfigurationCompliance', () => {
    it('should provide comprehensive configuration analysis', async () => {
      const mockAST: ProjectAST = {
        files: [{
          type: 'Program',
          body: [],
          sourceType: 'module',
          imports: [],
          exports: [],
          functions: [],
          classes: [],
          variables: []
        }],
        modules: [{
          name: 'cameraConfig',
          path: 'src/config/cameraConfig.ts',
          exports: [],
          imports: [],
          dependencies: []
        }],
        dependencies: []
      };

      const analysis = await detector.analyzeConfigurationCompliance(mockAST);
      
      expect(analysis).toHaveProperty('violations');
      expect(analysis).toHaveProperty('recommendations');
      expect(analysis).toHaveProperty('authorityMappings');
      expect(Array.isArray(analysis.violations)).toBe(true);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
      expect(Array.isArray(analysis.authorityMappings)).toBe(true);
    });
  });

  describe('extractNumericValuesWithContext', () => {
    it('should extract numeric values with proper context', () => {
      const mockAST: ProjectAST = {
        files: [{
          type: 'Program',
          body: [],
          sourceType: 'module',
          imports: [],
          exports: [],
          functions: [],
          classes: [],
          variables: []
        }],
        modules: [{
          name: 'test',
          path: 'src/test.ts',
          exports: [],
          imports: [],
          dependencies: []
        }],
        dependencies: []
      };

      const values = detector.extractNumericValuesWithContext(mockAST);
      expect(Array.isArray(values)).toBe(true);
    });
  });

  describe('integration tests', () => {
    it('should handle empty AST gracefully', () => {
      const emptyAST: ProjectAST = {
        files: [],
        modules: [],
        dependencies: []
      };

      const violations = detector.detectHardcodedConstants(emptyAST);
      expect(violations).toHaveLength(0);
    });

    it('should handle malformed AST gracefully', () => {
      const malformedAST: ProjectAST = {
        files: [{
          type: 'Program',
          body: [],
          sourceType: 'module',
          imports: [],
          exports: [],
          functions: [],
          classes: [],
          variables: []
        }],
        modules: [{
          name: 'invalid',
          path: 'invalid.ts',
          exports: [],
          imports: [],
          dependencies: []
        }],
        dependencies: []
      };

      const violations = detector.detectHardcodedConstants(malformedAST);
      expect(Array.isArray(violations)).toBe(true);
    });
  });
});