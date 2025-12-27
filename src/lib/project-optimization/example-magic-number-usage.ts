// Example usage of Magic Number Detector for SolMap governance compliance

import { MagicNumberDetector } from './magic-number-detector';
import { ProjectAST } from './types';

/**
 * Example demonstrating how to use the MagicNumberDetector
 * to enforce Spec-4: Magic Number Elimination
 */
export class MagicNumberExample {
  private detector: MagicNumberDetector;

  constructor() {
    this.detector = new MagicNumberDetector();
  }

  /**
   * Analyze a project for magic number violations
   */
  async analyzeProject(projectAST: ProjectAST): Promise<void> {
    console.log('🔍 Analyzing project for magic numbers...');

    // Detect hardcoded constants
    const magicNumbers = this.detector.detectHardcodedConstants(projectAST);
    console.log(`Found ${magicNumbers.length} magic number violations`);

    // Analyze configuration compliance
    const configAnalysis = await this.detector.analyzeConfigurationCompliance(projectAST);
    console.log(`Configuration analysis:`);
    console.log(`- Violations: ${configAnalysis.violations.length}`);
    console.log(`- Recommendations: ${configAnalysis.recommendations.length}`);
    console.log(`- Authority mappings: ${configAnalysis.authorityMappings.length}`);

    // Extract numeric values for unit checking
    const numericValues = this.detector.extractNumericValuesWithContext(projectAST);
    const unitViolations = this.detector.checkUnitClarity(numericValues);
    console.log(`Found ${unitViolations.length} unit clarity violations`);

    // Report findings
    this.reportFindings(magicNumbers, configAnalysis, unitViolations);
  }

  /**
   * Report analysis findings with governance recommendations
   */
  private reportFindings(
    magicNumbers: any[],
    configAnalysis: any,
    unitViolations: any[]
  ): void {
    console.log('\n📊 Magic Number Analysis Report');
    console.log('================================');

    if (magicNumbers.length > 0) {
      console.log('\n🚨 Magic Number Violations:');
      magicNumbers.forEach((violation, index) => {
        console.log(`${index + 1}. ${violation.description}`);
        console.log(`   Location: ${violation.location.file}:${violation.location.line}`);
        console.log(`   Suggested source: ${violation.suggestedSource}`);
        console.log(`   Severity: ${violation.severity}`);
      });
    }

    if (configAnalysis.violations.length > 0) {
      console.log('\n⚙️ Configuration Violations:');
      configAnalysis.violations.forEach((violation: any, index: number) => {
        console.log(`${index + 1}. ${violation.violationType}: ${violation.suggestedFix}`);
      });
    }

    if (configAnalysis.authorityMappings.length > 0) {
      console.log('\n🎯 Authority Mapping Suggestions:');
      configAnalysis.authorityMappings.forEach((mapping: any, index: number) => {
        console.log(`${index + 1}. ${mapping.configProperty} → ${mapping.suggestedAuthority}`);
        console.log(`   Confidence: ${(mapping.confidence * 100).toFixed(1)}%`);
        console.log(`   Reason: ${mapping.reason}`);
      });
    }

    if (unitViolations.length > 0) {
      console.log('\n📏 Unit Clarity Violations:');
      unitViolations.forEach((violation, index) => {
        console.log(`${index + 1}. Value ${violation.value.value} in ${violation.value.context}`);
        if (violation.missingUnit) {
          console.log(`   Missing unit - suggested: ${violation.suggestedUnit}`);
        }
        if (violation.missingReferenceFrame) {
          console.log(`   Missing reference frame - suggested: ${violation.suggestedReferenceFrame}`);
        }
      });
    }

    // Governance compliance summary
    const totalViolations = magicNumbers.length + configAnalysis.violations.length + unitViolations.length;
    console.log(`\n📋 Governance Compliance Summary:`);
    console.log(`Total violations: ${totalViolations}`);
    console.log(`Spec-4 compliance: ${totalViolations === 0 ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}`);

    if (totalViolations > 0) {
      console.log('\n💡 Next Steps:');
      console.log('1. Move hardcoded constants to appropriate authority files');
      console.log('2. Add unit and reference frame metadata to configuration values');
      console.log('3. Import physics constants from authority sources');
      console.log('4. Re-run analysis to verify compliance');
    }
  }

  /**
   * Get authority source suggestion for a specific value
   */
  getAuthoritySuggestion(value: number | string, context: string): string {
    return this.detector.suggestAuthoritySource(value, context);
  }

  /**
   * Example of how to create a mock AST for testing
   */
  createMockAST(): ProjectAST {
    return {
      files: [
        {
          type: 'Program',
          body: [],
          sourceType: 'module',
          imports: [],
          exports: [],
          functions: [],
          classes: [],
          variables: []
        }
      ],
      modules: [
        {
          name: 'example',
          path: 'src/example.ts',
          exports: [],
          imports: [],
          dependencies: []
        }
      ],
      dependencies: []
    };
  }
}

// Example usage
export async function demonstrateMagicNumberDetection(): Promise<void> {
  const example = new MagicNumberExample();
  const mockAST = example.createMockAST();
  
  console.log('🚀 Starting Magic Number Detection Demo...');
  await example.analyzeProject(mockAST);
  
  // Test authority suggestions
  console.log('\n🎯 Authority Suggestion Examples:');
  console.log(`Earth tilt (23.44): ${example.getAuthoritySuggestion(23.44, 'earthTilt')}`);
  console.log(`Earth period (365.25): ${example.getAuthoritySuggestion(365.25, 'earthPeriod')}`);
  console.log(`Earth radius (6371): ${example.getAuthoritySuggestion(6371, 'earthRadius')}`);
  console.log(`Coordinate frame (0): ${example.getAuthoritySuggestion(0, 'coordinateFrame')}`);
}