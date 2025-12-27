// Governance compliance interfaces for SolMap project
// Based on Spec-0 to Spec-8 from .kiro/specs/solmap-ai-governance.md

import {
  GovernanceAnalysis,
  SpecViolation,
  SSOTViolation,
  LayerViolation,
  RendererViolation,
  MagicNumberViolation,
  StructuralFailure,
  ConstantsPollution,
  PhysicsConcept,
  DuplicateDefinition,
  PhysicsConstantViolation,
  CrossLayerImport,
  RendererInputViolation,
  PhysicsKnowledgeViolation,
  RepairResult,
  RefactoringPlan,
  AIPreCommitCheck,
  PreCommitResult,
  CodeHistory,
  GovernanceSpec,
  ComplianceScore
} from './governance-types';

import { ProjectAST, DependencyGraph, ModuleInfo, SourceLocation } from './types';

// Main governance analyzer interface
export interface GovernanceAnalyzer {
  analyzeProject(projectPath: string): Promise<GovernanceAnalysis>;
  validateSpec0Compliance(ast: ProjectAST): SpecViolation[];
  checkPhysicsSystemPriority(ast: ProjectAST): SpecViolation[];
  detectStructuralFailures(ast: ProjectAST, history: CodeHistory): StructuralFailure[];
  loadGovernanceSpecs(specsPath: string): Promise<GovernanceSpec[]>;
}

// SSOT violation detector interface
export interface SSOTViolationDetector {
  detectDuplicateDefinitions(ast: ProjectAST): DuplicateDefinition[];
  validatePhysicsConstants(ast: ProjectAST): PhysicsConstantViolation[];
  checkAuthorityDefinitions(ast: ProjectAST): AuthorityViolation[];
  validateConstantsDirectory(constantsPath: string): ConstantsViolation[];
  findPhysicsConceptUsage(ast: ProjectAST, concept: PhysicsConcept): ConceptUsage[];
}

export interface AuthorityViolation {
  concept: PhysicsConcept;
  expectedAuthority: string;
  actualSource: string;
  location: SourceLocation;
}

export interface ConstantsViolation {
  file: string;
  violationType: 'logic' | 'computation' | 'unfrozen';
  description: string;
  location: SourceLocation;
}

export interface ConceptUsage {
  concept: PhysicsConcept;
  location: SourceLocation;
  usageType: 'import' | 'reference' | 'definition';
  isAuthoritative: boolean;
}

// Layer separation validator interface
export interface LayerSeparationValidator {
  validateLayerBoundaries(ast: ProjectAST): LayerViolation[];
  checkCrossLayerImports(dependencies: DependencyGraph): CrossLayerImport[];
  validateDependencyDirection(dependencies: DependencyGraph): DependencyViolation[];
  checkSingleResponsibility(modules: ModuleInfo[]): ResponsibilityViolation[];
  getModuleLayer(modulePath: string): ArchitectureLayer;
}

export interface DependencyViolation {
  fromModule: string;
  toModule: string;
  fromLayer: ArchitectureLayer;
  toLayer: ArchitectureLayer;
  violationType: 'forbidden_dependency' | 'wrong_direction';
  location: SourceLocation;
}

export interface ResponsibilityViolation {
  module: string;
  expectedResponsibilities: string[];
  actualResponsibilities: string[];
  mixedConcerns: string[];
  location: SourceLocation;
}

// Renderer stupidity checker interface
export interface RendererStupidityChecker {
  checkRendererInputs(rendererModules: ModuleInfo[]): RendererInputViolation[];
  detectPhysicsKnowledge(rendererCode: string[]): PhysicsKnowledgeViolation[];
  validateRendererImports(imports: ImportInfo[]): RendererImportViolation[];
  checkComputationLogic(rendererAST: FileAST[]): ComputationViolation[];
  identifyRendererModules(ast: ProjectAST): string[];
}

export interface ImportInfo {
  source: string;
  imported: string[];
  location: SourceLocation;
  module: string;
}

export interface FileAST {
  path: string;
  ast: any;
  imports: ImportInfo[];
  exports: string[];
  functions: FunctionInfo[];
  computations: ComputationInfo[];
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType?: string;
  location: SourceLocation;
  complexity: number;
}

export interface ComputationInfo {
  type: 'arithmetic' | 'trigonometric' | 'physics';
  description: string;
  location: SourceLocation;
  variables: string[];
}

export interface RendererImportViolation {
  rendererModule: string;
  forbiddenImports: string[];
  actualImports: string[];
  violations: ImportViolation[];
  location: SourceLocation;
}

export interface ImportViolation {
  importedModule: string;
  reason: string;
  severity: 'error' | 'warning';
}

export interface ComputationViolation {
  rendererModule: string;
  computationType: 'angle' | 'period' | 'physics_derivation';
  description: string;
  location: SourceLocation;
  suggestedFix: string;
}

// Magic number detector interface
export interface MagicNumberDetector {
  detectHardcodedConstants(ast: ProjectAST): MagicNumberViolation[];
  validateConstantSources(constants: ConstantUsage[]): ConstantSourceViolation[];
  checkUnitClarity(values: NumericValue[]): UnitClarityViolation[];
  detectConfigurationValues(ast: ProjectAST): ConfigurationViolation[];
  suggestAuthoritySource(value: number | string, context: string): string;
}

export interface ConstantUsage {
  name: string;
  value: number | string;
  source: string;
  location: SourceLocation;
  expectedSource?: string;
}

export interface ConstantSourceViolation {
  constantName: string;
  expectedSource: string;
  actualSource: string;
  location: SourceLocation;
}

export interface NumericValue {
  value: number;
  context: string;
  location: SourceLocation;
  hasUnit: boolean;
  hasReferenceFrame: boolean;
  unit?: string;
  referenceFrame?: string;
}

export interface UnitClarityViolation {
  value: NumericValue;
  missingUnit: boolean;
  missingReferenceFrame: boolean;
  suggestedUnit?: string;
  suggestedReferenceFrame?: string;
}

export interface ConfigurationViolation {
  configValue: any;
  location: SourceLocation;
  violationType: 'hardcoded' | 'unclear_source' | 'missing_unit';
  suggestedFix: string;
}

// Structural failure detector interface
export interface StructuralFailureDetector {
  analyzeModificationHistory(history: CodeHistory): StructuralFailure[];
  detectInstabilityPatterns(testResults: TestHistory[], visualResults: VisualHistory[]): InstabilityPattern[];
  checkParameterTuning(codeChanges: CodeChange[]): ParameterTuningViolation[];
  identifyRefactoringNeeds(violations: SpecViolation[]): RefactoringRecommendation[];
  calculateStabilityScore(fileHistory: FileHistory): number;
}

export interface InstabilityPattern {
  type: 'test_flakiness' | 'visual_inconsistency' | 'performance_regression';
  description: string;
  frequency: number;
  affectedFiles: string[];
  timeRange: { start: Date; end: Date };
}

export interface ParameterTuningViolation {
  file: string;
  parameter: string;
  changeCount: number;
  changes: ParameterChange[];
  location: SourceLocation;
}

export interface ParameterChange {
  timestamp: Date;
  oldValue: any;
  newValue: any;
  reason?: string;
}

export interface RefactoringRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: RefactoringType;
  description: string;
  affectedFiles: string[];
  estimatedEffort: number;
  benefits: string[];
}

// Architecture repair engine interface
export interface ArchitectureRepairEngine {
  repairSSOTViolations(violations: SSOTViolation[]): RepairResult;
  fixLayerSeparation(violations: LayerViolation[]): RepairResult;
  stupidifyRenderer(violations: RendererViolation[]): RepairResult;
  eliminateMagicNumbers(violations: MagicNumberViolation[]): RepairResult;
  triggerStructuralRefactoring(failures: StructuralFailure[]): RefactoringPlan;
  validateRepair(original: ProjectAST, repaired: ProjectAST): ValidationResult;
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  functionalityPreserved: boolean;
  architectureImproved: boolean;
}

export interface ValidationError {
  message: string;
  location?: SourceLocation;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  message: string;
  location?: SourceLocation;
  suggestion?: string;
}

// AI pre-commit checker interface
export interface AIPreCommitChecker {
  performPreCommitCheck(changes: CodeChange[]): Promise<AIPreCommitCheck>;
  askCriticalQuestions(changes: CodeChange[]): PreCommitQuestion[];
  evaluateAnswers(answers: PreCommitAnswer[]): PreCommitResult;
  generateBlockingReport(issues: string[]): string;
  shouldBlockCommit(check: AIPreCommitCheck): boolean;
}

// Governance education and suggestion system interface
export interface GovernanceEducator {
  explainViolation(violation: SpecViolation): ViolationExplanation;
  suggestFix(violation: SpecViolation): FixSuggestion;
  provideBestPractices(violationType: ViolationType): BestPractice[];
  generateRefactoringGuide(plan: RefactoringPlan): RefactoringGuide;
  createPreventionTemplate(violationType: ViolationType): PreventionTemplate;
}

export interface ViolationExplanation {
  specReference: string;
  description: string;
  impact: string;
  examples: CodeExample[];
  relatedSpecs: string[];
}

export interface CodeExample {
  title: string;
  wrongCode: string;
  correctCode: string;
  explanation: string;
}

export interface FixSuggestion {
  steps: FixStep[];
  estimatedTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  prerequisites: string[];
  warnings: string[];
}

export interface FixStep {
  order: number;
  description: string;
  codeChanges?: CodeChange[];
  verification: string;
}

export interface BestPractice {
  title: string;
  description: string;
  examples: CodeExample[];
  commonMistakes: string[];
  tools: string[];
}

export interface RefactoringGuide {
  overview: string;
  phases: RefactoringPhase[];
  checkpoints: string[];
  rollbackPlan: string;
  successCriteria: string[];
}

export interface RefactoringPhase {
  name: string;
  description: string;
  steps: RefactoringStep[];
  duration: number;
  risks: string[];
}

export interface PreventionTemplate {
  violationType: ViolationType;
  checklistItems: string[];
  codeTemplates: CodeTemplate[];
  automationSuggestions: string[];
}

export interface CodeTemplate {
  name: string;
  description: string;
  template: string;
  variables: TemplateVariable[];
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: string;
  defaultValue?: any;
}

// Continuous monitoring and reporting interface
export interface GovernanceMonitor {
  generateComplianceReport(analysis: GovernanceAnalysis): ComplianceReport;
  trackComplianceTrend(history: ComplianceHistory[]): ComplianceTrend;
  calculateArchitectureHealth(ast: ProjectAST): ArchitectureHealth;
  generateEarlyWarnings(analysis: GovernanceAnalysis): EarlyWarning[];
  schedulePeriodicCheck(interval: number): void;
}

export interface ComplianceReport {
  timestamp: Date;
  overallScore: ComplianceScore;
  violationSummary: ViolationSummary;
  trends: ComplianceTrend[];
  recommendations: string[];
  criticalIssues: SpecViolation[];
}

export interface ViolationSummary {
  totalViolations: number;
  byType: Record<ViolationType, number>;
  bySeverity: Record<ViolationSeverity, number>;
  bySpec: Record<string, number>;
}

export interface ComplianceHistory {
  timestamp: Date;
  score: ComplianceScore;
  violations: number;
  changes: string[];
}

export interface ArchitectureHealth {
  score: number; // 0-100
  indicators: HealthIndicator[];
  risks: ArchitectureRisk[];
  recommendations: string[];
}

export interface HealthIndicator {
  name: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
  description: string;
}

export interface ArchitectureRisk {
  type: string;
  probability: number;
  impact: string;
  mitigation: string;
}

export interface EarlyWarning {
  type: 'structural_failure_risk' | 'compliance_degradation' | 'architecture_drift';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedAreas: string[];
  recommendedActions: string[];
  timeToAction: number; // days
}

// Configuration and setup interfaces
export interface GovernanceConfigManager {
  loadConfig(projectPath: string): Promise<GovernanceConfig>;
  saveConfig(config: GovernanceConfig, projectPath: string): Promise<void>;
  validateConfig(config: GovernanceConfig): ValidationResult;
  mergeConfigs(base: GovernanceConfig, override: GovernanceConfig): GovernanceConfig;
}

// Import required types and enums
import {
  ViolationType,
  ViolationSeverity,
  ArchitectureLayer,
  PhysicsConceptType,
  EnforcementLevel,
  EnforcementStrictness,
  ArchitectureLayerDefinition,
  RefactoringType,
  RefactoringStep,
  CodeChange,
  TestHistory,
  VisualHistory,
  FileHistory,
  ComplianceTrend,
  PreCommitQuestion,
  PreCommitAnswer,
  GovernanceConfig
} from './governance-types';