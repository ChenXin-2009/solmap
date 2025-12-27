// Example usage of StructuralFailureDetector
import { StructuralFailureDetector } from './structural-failure-detector';
import {
  CodeHistory,
  TestHistory,
  VisualHistory,
  SpecViolation,
  ViolationType,
  ViolationSeverity
} from './governance-types';

/**
 * Example demonstrating how to use the StructuralFailureDetector
 * to identify structural failures and refactoring needs
 */
export function demonstrateStructuralFailureDetection() {
  const detector = new StructuralFailureDetector();

  // Example 1: Analyze modification history for structural failures
  const codeHistory: CodeHistory = {
    files: [{
      path: 'src/rendering/planet-renderer.ts',
      modifications: [
        { timestamp: new Date('2024-01-01'), description: 'Fix planet rotation bug', author: 'dev1', changeType: 'fix' },
        { timestamp: new Date('2024-01-03'), description: 'Adjust rotation parameters', author: 'dev2', changeType: 'modify' },
        { timestamp: new Date('2024-01-05'), description: 'Fix rotation visual glitch', author: 'dev1', changeType: 'fix' },
        { timestamp: new Date('2024-01-07'), description: 'Tune rotation speed', author: 'dev3', changeType: 'modify' },
        { timestamp: new Date('2024-01-09'), description: 'Fix rotation axis issue', author: 'dev1', changeType: 'fix' }
      ],
      stability: {
        modificationFrequency: 5,
        averageTimeBetweenChanges: 2,
        testStability: 0.6,
        visualStability: 0.5
      }
    }],
    commits: [],
    testResults: [],
    visualResults: []
  };

  console.log('=== Structural Failure Detection ===');
  const structuralFailures = detector.analyzeModificationHistory(codeHistory);
  
  structuralFailures.forEach((failure, index) => {
    console.log(`\nStructural Failure ${index + 1}:`);
    console.log(`  Problem Area: ${failure.problemArea}`);
    console.log(`  Modification Count: ${failure.modificationCount}`);
    console.log(`  Failure Type: ${failure.failureType}`);
    console.log(`  Refactoring Urgency: ${failure.refactoringUrgency}`);
    console.log(`  Description: ${failure.description}`);
  });

  // Example 2: Detect instability patterns
  const testResults: TestHistory[] = [
    { timestamp: new Date('2024-01-01'), passed: true, testName: 'planet-rotation-test', duration: 100 },
    { timestamp: new Date('2024-01-02'), passed: false, testName: 'planet-rotation-test', duration: 100, error: 'rotation mismatch' },
    { timestamp: new Date('2024-01-03'), passed: true, testName: 'planet-rotation-test', duration: 100 },
    { timestamp: new Date('2024-01-04'), passed: false, testName: 'planet-rotation-test', duration: 100, error: 'rotation mismatch' },
    { timestamp: new Date('2024-01-05'), passed: true, testName: 'planet-rotation-test', duration: 100 }
  ];

  const visualResults: VisualHistory[] = [
    { timestamp: new Date('2024-01-01'), stable: true, description: 'good planet rendering' },
    { timestamp: new Date('2024-01-02'), stable: false, description: 'planet wobble detected' },
    { timestamp: new Date('2024-01-03'), stable: false, description: 'rotation axis drift' },
    { timestamp: new Date('2024-01-04'), stable: true, description: 'good planet rendering' },
    { timestamp: new Date('2024-01-05'), stable: false, description: 'visual artifacts' }
  ];

  console.log('\n=== Instability Pattern Detection ===');
  const instabilityPatterns = detector.detectInstabilityPatterns(testResults, visualResults);
  
  instabilityPatterns.forEach((pattern, index) => {
    console.log(`\nInstability Pattern ${index + 1}:`);
    console.log(`  Type: ${pattern.type}`);
    console.log(`  Description: ${pattern.description}`);
    console.log(`  Frequency: ${(pattern.frequency * 100).toFixed(1)}%`);
    console.log(`  Affected Files: ${pattern.affectedFiles.join(', ')}`);
  });

  // Example 3: Identify refactoring needs based on violations
  const violations: SpecViolation[] = [
    {
      specNumber: 'Spec-2',
      violationType: ViolationType.SSOT_VIOLATION,
      location: { file: 'src/rendering/planet-renderer.ts', line: 45, column: 10 },
      description: 'Duplicate axial tilt definition found',
      governanceReference: 'Spec-2: SSOT Enforcement',
      severity: ViolationSeverity.HIGH,
      detectedAt: new Date(),
      fixAttempts: 0
    },
    {
      specNumber: 'Spec-3',
      violationType: ViolationType.RENDERER_INTELLIGENCE,
      location: { file: 'src/rendering/planet-renderer.ts', line: 67, column: 5 },
      description: 'Renderer contains physics calculation logic',
      governanceReference: 'Spec-3: Renderer Stupidity',
      severity: ViolationSeverity.HIGH,
      detectedAt: new Date(),
      fixAttempts: 0
    },
    {
      specNumber: 'Spec-4',
      violationType: ViolationType.MAGIC_NUMBER,
      location: { file: 'src/rendering/planet-renderer.ts', line: 89, column: 15 },
      description: 'Hardcoded rotation speed constant',
      governanceReference: 'Spec-4: Magic Number Elimination',
      severity: ViolationSeverity.MEDIUM,
      detectedAt: new Date(),
      fixAttempts: 0
    }
  ];

  console.log('\n=== Refactoring Recommendations ===');
  const refactoringRecommendations = detector.identifyRefactoringNeeds(violations);
  
  refactoringRecommendations.forEach((recommendation, index) => {
    console.log(`\nRefactoring Recommendation ${index + 1}:`);
    console.log(`  Priority: ${recommendation.priority}`);
    console.log(`  Type: ${recommendation.type}`);
    console.log(`  Description: ${recommendation.description}`);
    console.log(`  Affected Files: ${recommendation.affectedFiles.join(', ')}`);
    console.log(`  Estimated Effort: ${recommendation.estimatedEffort} hours`);
    console.log(`  Benefits:`);
    recommendation.benefits.forEach(benefit => {
      console.log(`    - ${benefit}`);
    });
  });

  // Example 4: Calculate stability score
  const fileHistory = codeHistory.files[0];
  const stabilityScore = detector.calculateStabilityScore(fileHistory);
  
  console.log('\n=== Stability Assessment ===');
  console.log(`File: ${fileHistory.path}`);
  console.log(`Stability Score: ${(stabilityScore * 100).toFixed(1)}%`);
  console.log(`Recommendation: ${stabilityScore < 0.5 ? 'URGENT REFACTORING NEEDED' : 
                                 stabilityScore < 0.7 ? 'Refactoring recommended' : 
                                 'Stable'}`);

  return {
    structuralFailures,
    instabilityPatterns,
    refactoringRecommendations,
    stabilityScore
  };
}

// Example of how to integrate with governance system
export function integrateWithGovernanceSystem() {
  console.log('\n=== Integration with Governance System ===');
  console.log('The StructuralFailureDetector integrates with the governance system by:');
  console.log('1. Detecting Spec-5 violations (Structural Failure Prevention)');
  console.log('2. Providing refactoring recommendations based on governance violations');
  console.log('3. Calculating stability metrics to prevent future structural failures');
  console.log('4. Triggering development freeze recommendations for critical failures');
  console.log('5. Generating risk assessments for refactoring activities');
}

// Run the demonstration if this file is executed directly
if (require.main === module) {
  demonstrateStructuralFailureDetection();
  integrateWithGovernanceSystem();
}