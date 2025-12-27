// Example usage of the GovernanceAnalyzer
// This demonstrates how to use the governance analyzer to check SolMap project compliance

import { GovernanceAnalyzerImpl } from './governance-analyzer';
import { ViolationType, ViolationSeverity } from './governance-types';

export async function analyzeProjectGovernance(projectPath: string = '.') {
  const analyzer = new GovernanceAnalyzerImpl();
  
  try {
    console.log('🔍 Starting governance analysis...');
    
    // Perform complete governance analysis
    const analysis = await analyzer.analyzeProject(projectPath);
    
    console.log('\n📊 Governance Analysis Results:');
    console.log(`Overall Compliance Score: ${analysis.overallCompliance.overall}/100`);
    console.log(`Critical Violations: ${analysis.overallCompliance.criticalViolations}`);
    console.log(`Trend: ${analysis.overallCompliance.trend}`);
    
    // Report violations by type
    const violationsByType = new Map<ViolationType, number>();
    for (const violation of analysis.specViolations) {
      violationsByType.set(violation.violationType, (violationsByType.get(violation.violationType) || 0) + 1);
    }
    
    console.log('\n🚨 Violations by Type:');
    for (const [type, count] of violationsByType) {
      console.log(`  ${type}: ${count}`);
    }
    
    // Report structural failures
    if (analysis.structuralFailures.length > 0) {
      console.log('\n⚠️  Structural Failures:');
      for (const failure of analysis.structuralFailures) {
        console.log(`  ${failure.problemArea}: ${failure.description}`);
      }
    }
    
    // Report by spec compliance
    console.log('\n📋 Compliance by Spec:');
    for (const [spec, score] of Object.entries(analysis.overallCompliance.bySpec)) {
      console.log(`  ${spec}: ${score}/100`);
    }
    
    // Provide recommendations
    console.log('\n💡 Recommendations:');
    if (analysis.overallCompliance.criticalViolations > 0) {
      console.log('  🔴 CRITICAL: Address critical violations immediately');
      console.log('  🔴 Consider freezing feature development until resolved');
    }
    
    const highSeverityViolations = analysis.specViolations.filter(v => v.severity === ViolationSeverity.HIGH).length;
    if (highSeverityViolations > 0) {
      console.log(`  🟡 HIGH: ${highSeverityViolations} high-severity violations need attention`);
    }
    
    if (analysis.structuralFailures.length > 0) {
      console.log('  🔄 REFACTORING: Structural refactoring recommended');
    }
    
    if (analysis.overallCompliance.overall >= 90) {
      console.log('  ✅ EXCELLENT: Project maintains high governance standards');
    } else if (analysis.overallCompliance.overall >= 70) {
      console.log('  ✅ GOOD: Project follows most governance principles');
    } else {
      console.log('  ❌ NEEDS IMPROVEMENT: Significant governance issues detected');
    }
    
    return analysis;
    
  } catch (error) {
    console.error('❌ Governance analysis failed:', error);
    throw error;
  }
}

// Example of how to check specific violations
export function checkForCommonViolations(analysis: any) {
  console.log('\n🔍 Common Violation Patterns:');
  
  // Check for SSOT violations
  const ssotViolations = analysis.specViolations.filter((v: any) => v.violationType === ViolationType.SSOT_VIOLATION);
  if (ssotViolations.length > 0) {
    console.log(`  📍 SSOT Violations: ${ssotViolations.length}`);
    console.log('    - Multiple definitions of physics concepts detected');
    console.log('    - Consider consolidating to authority files in lib/astronomy/constants/');
  }
  
  // Check for renderer intelligence
  const rendererViolations = analysis.specViolations.filter((v: any) => v.violationType === ViolationType.RENDERER_INTELLIGENCE);
  if (rendererViolations.length > 0) {
    console.log(`  🎨 Renderer Intelligence: ${rendererViolations.length}`);
    console.log('    - Rendering layer contains physics logic');
    console.log('    - Move calculations to appropriate physics/astronomy layers');
  }
  
  // Check for magic numbers
  const magicNumbers = analysis.specViolations.filter((v: any) => v.violationType === ViolationType.MAGIC_NUMBER);
  if (magicNumbers.length > 0) {
    console.log(`  🔢 Magic Numbers: ${magicNumbers.length}`);
    console.log('    - Hardcoded constants detected');
    console.log('    - Extract to authority constant files');
  }
  
  // Check for constants pollution
  const constantsPollution = analysis.specViolations.filter((v: any) => v.violationType === ViolationType.CONSTANTS_POLLUTION);
  if (constantsPollution.length > 0) {
    console.log(`  🧹 Constants Pollution: ${constantsPollution.length}`);
    console.log('    - Logic found in constants files');
    console.log('    - Keep constants files pure (only constants and Object.freeze)');
  }
}

// Example usage (commented out to avoid execution during import)
/*
async function main() {
  try {
    const analysis = await analyzeProjectGovernance('.');
    checkForCommonViolations(analysis);
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

// Uncomment to run
// main();
*/