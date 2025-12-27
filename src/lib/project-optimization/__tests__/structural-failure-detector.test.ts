// Tests for StructuralFailureDetector
import { StructuralFailureDetector } from '../structural-failure-detector';
import {
  CodeHistory,
  TestHistory,
  VisualHistory,
  StructuralFailureType,
  RefactoringUrgency,
  ViolationType,
  ViolationSeverity,
  SpecViolation
} from '../governance-types';

describe('StructuralFailureDetector', () => {
  let detector: StructuralFailureDetector;

  beforeEach(() => {
    detector = new StructuralFailureDetector();
  });

  describe('analyzeModificationHistory', () => {
    it('should detect structural failures when modification threshold is exceeded', () => {
      const history: CodeHistory = {
        files: [{
          path: 'src/problematic-file.ts',
          modifications: [
            { timestamp: new Date('2024-01-01'), description: 'Fix rendering issue', author: 'dev1', changeType: 'fix' },
            { timestamp: new Date('2024-01-02'), description: 'Adjust parameters', author: 'dev2', changeType: 'modify' },
            { timestamp: new Date('2024-01-03'), description: 'Fix visual bug', author: 'dev1', changeType: 'fix' },
            { timestamp: new Date('2024-01-04'), description: 'Tune values', author: 'dev3', changeType: 'modify' }
          ],
          stability: {
            modificationFrequency: 4,
            averageTimeBetweenChanges: 1,
            testStability: 0.7,
            visualStability: 0.6
          }
        }],
        commits: [],
        testResults: [],
        visualResults: []
      };

      const failures = detector.analyzeModificationHistory(history);

      expect(failures).toHaveLength(1);
      expect(failures[0].problemArea).toBe('src/problematic-file.ts');
      expect(failures[0].modificationCount).toBe(4);
      expect(failures[0].violationType).toBe(ViolationType.STRUCTURAL_FAILURE);
      expect(failures[0].severity).toBe(ViolationSeverity.CRITICAL);
    });

    it('should not detect failures when modification count is below threshold', () => {
      const history: CodeHistory = {
        files: [{
          path: 'src/stable-file.ts',
          modifications: [
            { timestamp: new Date('2024-01-01'), description: 'Initial implementation', author: 'dev1', changeType: 'add' },
            { timestamp: new Date('2024-01-02'), description: 'Minor fix', author: 'dev1', changeType: 'fix' }
          ],
          stability: {
            modificationFrequency: 2,
            averageTimeBetweenChanges: 1,
            testStability: 0.9,
            visualStability: 0.9
          }
        }],
        commits: [],
        testResults: [],
        visualResults: []
      };

      const failures = detector.analyzeModificationHistory(history);

      expect(failures).toHaveLength(0);
    });
  });

  describe('detectInstabilityPatterns', () => {
    it('should detect test flakiness patterns', () => {
      const testResults: TestHistory[] = [
        { timestamp: new Date('2024-01-01'), passed: true, testName: 'flaky-test', duration: 100 },
        { timestamp: new Date('2024-01-02'), passed: false, testName: 'flaky-test', duration: 100, error: 'timeout' },
        { timestamp: new Date('2024-01-03'), passed: true, testName: 'flaky-test', duration: 100 },
        { timestamp: new Date('2024-01-04'), passed: false, testName: 'flaky-test', duration: 100, error: 'timeout' },
        { timestamp: new Date('2024-01-05'), passed: true, testName: 'flaky-test', duration: 100 }
      ];

      const patterns = detector.detectInstabilityPatterns(testResults, []);

      expect(patterns).toHaveLength(1);
      expect(patterns[0].type).toBe('test_flakiness');
      expect(patterns[0].description).toContain('flaky-test');
      expect(patterns[0].frequency).toBeGreaterThan(0);
    });

    it('should detect visual instability patterns', () => {
      const visualResults: VisualHistory[] = [
        { timestamp: new Date('2024-01-01'), stable: true, description: 'good render' },
        { timestamp: new Date('2024-01-02'), stable: false, description: 'visual glitch' },
        { timestamp: new Date('2024-01-03'), stable: false, description: 'rendering issue' },
        { timestamp: new Date('2024-01-04'), stable: true, description: 'good render' },
        { timestamp: new Date('2024-01-05'), stable: false, description: 'visual bug' }
      ];

      const patterns = detector.detectInstabilityPatterns([], visualResults);

      expect(patterns).toHaveLength(1);
      expect(patterns[0].type).toBe('visual_inconsistency');
      expect(patterns[0].description).toContain('Visual instability');
    });
  });

  describe('identifyRefactoringNeeds', () => {
    it('should create refactoring recommendations based on violations', () => {
      const violations: SpecViolation[] = [
        {
          specNumber: 'Spec-1',
          violationType: ViolationType.SSOT_VIOLATION,
          location: { file: 'src/test.ts', line: 1, column: 1 },
          description: 'SSOT violation',
          governanceReference: 'Spec-1',
          severity: ViolationSeverity.HIGH,
          detectedAt: new Date(),
          fixAttempts: 0
        },
        {
          specNumber: 'Spec-2',
          violationType: ViolationType.LAYER_SEPARATION_VIOLATION,
          location: { file: 'src/test.ts', line: 2, column: 1 },
          description: 'Layer violation',
          governanceReference: 'Spec-2',
          severity: ViolationSeverity.MEDIUM,
          detectedAt: new Date(),
          fixAttempts: 0
        }
      ];

      const recommendations = detector.identifyRefactoringNeeds(violations);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].affectedFiles).toContain('src/test.ts');
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[0].estimatedEffort).toBeGreaterThan(0);
    });
  });

  describe('calculateStabilityScore', () => {
    it('should calculate stability score correctly', () => {
      const fileHistory = {
        path: 'src/test.ts',
        modifications: [],
        stability: {
          modificationFrequency: 2,
          averageTimeBetweenChanges: 5,
          testStability: 0.9,
          visualStability: 0.8
        }
      };

      const score = detector.calculateStabilityScore(fileHistory);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  // Note: provideFreezeRecommendations method not implemented in simplified version
});