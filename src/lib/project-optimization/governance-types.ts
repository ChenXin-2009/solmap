// Governance compliance types for SolMap project
// Based on Spec-0 to Spec-8 from .kiro/specs/solmap-ai-governance.md

import { SourceLocation, ProjectAST, ModuleInfo } from './types';

// Core governance specification representation
export interface GovernanceSpec {
  specNumber: string; // "Spec-0", "Spec-1", etc.
  title: string;
  rules: GovernanceRule[];
  constraints: GovernanceConstraint[];
  failureConditions: FailureCondition[];
}

// Governance rule definition
export interface GovernanceRule {
  id: string;
  description: string;
  ruleType: GovernanceRuleType;
  enforcementLevel: EnforcementLevel;
  validationCriteria: ValidationCriteria[];
}

export enum GovernanceRuleType {
  SSOT_ENFORCEMENT = 'ssot_enforcement',
  LAYER_SEPARATION = 'layer_separation',
  RENDERER_STUPIDITY = 'renderer_stupidity',
  MAGIC_NUMBER_ELIMINATION = 'magic_number_elimination',
  STRUCTURAL_FAILURE_PREVENTION = 'structural_failure_prevention',
  PHYSICS_PRIORITY = 'physics_priority',
  CONSTANTS_PURITY = 'constants_purity',
  AI_PRECOMMIT_CHECK = 'ai_precommit_check'
}

export enum EnforcementLevel {
  STRICT = 'strict',
  MODERATE = 'moderate',
  LENIENT = 'lenient'
}

export enum EnforcementStrictness {
  STRICT = 'strict',
  MODERATE = 'moderate',
  LENIENT = 'lenient'
}

export interface ValidationCriteria {
  name: string;
  description: string;
  validator: (ast: ProjectAST) => boolean;
  errorMessage: string;
}

export interface GovernanceConstraint {
  type: ConstraintType;
  description: string;
  target: string;
  condition: string;
}

export enum ConstraintType {
  UNIQUE_DEFINITION = 'unique_definition',
  FORBIDDEN_IMPORT = 'forbidden_import',
  REQUIRED_STRUCTURE = 'required_structure',
  LAYER_BOUNDARY = 'layer_boundary'
}

export interface FailureCondition {
  type: FailureType;
  threshold: number;
  description: string;
  action: FailureAction;
}

export enum FailureType {
  REPEATED_MODIFICATIONS = 'repeated_modifications',
  STRUCTURAL_VIOLATION = 'structural_violation',
  PHYSICS_INCONSISTENCY = 'physics_inconsistency'
}

export enum FailureAction {
  FREEZE_DEVELOPMENT = 'freeze_development',
  TRIGGER_REFACTORING = 'trigger_refactoring',
  REQUIRE_HUMAN_REVIEW = 'require_human_review'
}

// Spec violation representation
export interface SpecViolation {
  specNumber: string; // "Spec-0", "Spec-1", etc.
  violationType: ViolationType;
  location: SourceLocation;
  description: string;
  governanceReference: string;
  severity: ViolationSeverity;
  detectedAt: Date;
  fixAttempts: number;
}

export enum ViolationType {
  SSOT_VIOLATION = 'ssot_violation',
  LAYER_SEPARATION_VIOLATION = 'layer_separation_violation',
  RENDERER_INTELLIGENCE = 'renderer_intelligence',
  MAGIC_NUMBER = 'magic_number',
  STRUCTURAL_FAILURE = 'structural_failure',
  CONSTANTS_POLLUTION = 'constants_pollution',
  PHYSICS_PRIORITY_VIOLATION = 'physics_priority_violation'
}

export enum ViolationSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Physics concept definition
export interface PhysicsConcept {
  name: string;
  type: PhysicsConceptType;
  authoritySource: string;
  allowedUsagePatterns: UsagePattern[];
  forbiddenContexts: string[];
  unit?: string;
  referenceFrame?: string;
}

export enum PhysicsConceptType {
  AXIAL_TILT = 'axial_tilt',
  PHYSICAL_PARAMETER = 'physical_parameter',
  ROTATION_PERIOD = 'rotation_period',
  ORBITAL_PERIOD = 'orbital_period',
  REFERENCE_FRAME = 'reference_frame',
  RADIUS = 'radius',
  MASS = 'mass',
  GM = 'gm'
}

export interface UsagePattern {
  pattern: string;
  description: string;
  allowed: boolean;
}

// SSOT violation types
export interface SSOTViolation extends SpecViolation {
  violationType: ViolationType.SSOT_VIOLATION;
  concept: PhysicsConcept;
  authorityLocation: SourceLocation;
  duplicateLocations: SourceLocation[];
}

export interface DuplicateDefinition {
  concept: PhysicsConcept;
  authorityLocation: SourceLocation;
  duplicateLocations: SourceLocation[];
  violationSeverity: ViolationSeverity;
}

export interface PhysicsConstantViolation {
  constantType: PhysicsConstantType;
  expectedSource: string;
  actualSource: string;
  location: SourceLocation;
}

export enum PhysicsConstantType {
  AXIAL_TILT = 'axialTilt',
  PHYSICAL_PARAMS = 'physicalParams',
  ROTATION = 'rotation',
  REFERENCE_FRAMES = 'referenceFrames'
}

// Layer separation types
export interface LayerViolation extends SpecViolation {
  violationType: ViolationType.LAYER_SEPARATION_VIOLATION;
  violatingModule: string;
  targetLayer: ArchitectureLayer;
  sourceLayer: ArchitectureLayer;
  layerViolationType: LayerViolationType;
}

export enum ArchitectureLayer {
  RENDERING = 'rendering',
  PHYSICS = 'physics',
  ASTRONOMY = 'astronomy',
  CONSTANTS = 'constants',
  INFRASTRUCTURE = 'infrastructure'
}

export enum LayerViolationType {
  CROSS_LAYER_IMPORT = 'cross_layer_import',
  WRONG_DEPENDENCY_DIRECTION = 'wrong_dependency_direction',
  MIXED_RESPONSIBILITIES = 'mixed_responsibilities'
}

export interface CrossLayerImport {
  importingModule: string;
  importedModule: string;
  importingLayer: ArchitectureLayer;
  importedLayer: ArchitectureLayer;
  location: SourceLocation;
}

// Renderer stupidity types
export interface RendererViolation extends SpecViolation {
  violationType: ViolationType.RENDERER_INTELLIGENCE;
  rendererModule: string;
  intelligenceType: RendererIntelligenceType;
}

export enum RendererIntelligenceType {
  PHYSICS_KNOWLEDGE = 'physics_knowledge',
  COMPUTATION_LOGIC = 'computation_logic',
  FORBIDDEN_IMPORT = 'forbidden_import',
  INVALID_INPUT = 'invalid_input'
}

export interface RendererInputViolation {
  rendererModule: string;
  allowedInputs: string[]; // ['positionVector', 'attitudeMatrix', 'visualParams']
  actualInputs: string[];
  violations: string[];
  location: SourceLocation;
}

export interface PhysicsKnowledgeViolation {
  rendererModule: string;
  forbiddenConcepts: string[]; // ['axialTilt', 'period', 'referenceFrame']
  detectedConcepts: string[];
  location: SourceLocation;
}

// Magic number types
export interface MagicNumberViolation extends SpecViolation {
  violationType: ViolationType.MAGIC_NUMBER;
  value: number | string;
  suspectedType: PhysicsConstantType;
  suggestedSource: string;
  context: string;
}

// Structural failure types
export interface StructuralFailure extends SpecViolation {
  violationType: ViolationType.STRUCTURAL_FAILURE;
  problemArea: string;
  modificationCount: number;
  modificationHistory: ModificationRecord[];
  failureType: StructuralFailureType;
  refactoringUrgency: RefactoringUrgency;
}

export interface ModificationRecord {
  timestamp: Date;
  description: string;
  author: string;
  changeType: string;
}

export enum StructuralFailureType {
  REPEATED_MODIFICATIONS = 'repeated_modifications',
  VISUAL_INSTABILITY = 'visual_instability',
  PARAMETER_TUNING = 'parameter_tuning',
  ARCHITECTURE_DRIFT = 'architecture_drift'
}

export enum RefactoringUrgency {
  IMMEDIATE = 'immediate',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Constants purity types
export interface ConstantsPollution extends SpecViolation {
  violationType: ViolationType.CONSTANTS_POLLUTION;
  constantsFile: string;
  pollutionType: PollutionType;
  pollutingCode: string;
}

export enum PollutionType {
  LOGIC_CODE = 'logic_code',
  COMPUTATION = 'computation',
  CONDITIONAL_BRANCH = 'conditional_branch',
  FUNCTION_DEFINITION = 'function_definition',
  UNFROZEN_OBJECT = 'unfrozen_object'
}

// Architecture layer definition
export interface ArchitectureLayerDefinition {
  name: ArchitectureLayer;
  allowedDependencies: ArchitectureLayer[];
  forbiddenImports: string[];
  allowedOperations: LayerOperation[];
  responsibilityBoundaries: string[];
}

export enum LayerOperation {
  RENDER_ONLY = 'render_only',
  COMPUTE_PHYSICS = 'compute_physics',
  DEFINE_CONSTANTS = 'define_constants',
  MANAGE_INFRASTRUCTURE = 'manage_infrastructure'
}

// AI pre-commit check types
export interface AIPreCommitCheck {
  checkId: string;
  questions: PreCommitQuestion[];
  answers: PreCommitAnswer[];
  overallResult: PreCommitResult;
  blockingIssues: string[];
}

export interface PreCommitQuestion {
  question: string;
  category: PreCommitCategory;
  required: boolean;
}

export interface PreCommitAnswer {
  questionId: string;
  answer: string;
  confidence: number;
  reasoning: string;
}

export enum PreCommitCategory {
  NEW_DEFINITIONS = 'new_definitions',
  UNIT_CLARITY = 'unit_clarity',
  COMPUTATION_LAYER = 'computation_layer',
  STRUCTURAL_IMPACT = 'structural_impact'
}

export enum PreCommitResult {
  APPROVED = 'approved',
  BLOCKED = 'blocked',
  REQUIRES_REVIEW = 'requires_review'
}

// Governance analysis result
export interface GovernanceAnalysis {
  specViolations: SpecViolation[];
  ssotViolations: SSOTViolation[];
  layerViolations: LayerViolation[];
  renderingViolations: RendererViolation[];
  magicNumbers: MagicNumberViolation[];
  structuralFailures: StructuralFailure[];
  constantsPollution: ConstantsPollution[];
  overallCompliance: ComplianceScore;
}

export interface ComplianceScore {
  overall: number; // 0-100
  bySpec: Record<string, number>;
  criticalViolations: number;
  trend: ComplianceTrend;
}

export enum ComplianceTrend {
  IMPROVING = 'improving',
  STABLE = 'stable',
  DEGRADING = 'degrading'
}

// Code history for structural failure detection
export interface CodeHistory {
  files: FileHistory[];
  commits: CommitHistory[];
  testResults: TestHistory[];
  visualResults: VisualHistory[];
}

export interface FileHistory {
  path: string;
  modifications: ModificationRecord[];
  stability: StabilityMetrics;
}

export interface CommitHistory {
  hash: string;
  timestamp: Date;
  author: string;
  message: string;
  changedFiles: string[];
}

export interface TestHistory {
  timestamp: Date;
  passed: boolean;
  testName: string;
  duration: number;
  error?: string;
}

export interface VisualHistory {
  timestamp: Date;
  stable: boolean;
  description: string;
  screenshot?: string;
}

export interface StabilityMetrics {
  modificationFrequency: number;
  averageTimeBetweenChanges: number;
  testStability: number;
  visualStability: number;
}

// Repair and refactoring types
export interface RepairResult {
  success: boolean;
  repairedViolations: SpecViolation[];
  codeChanges: CodeChange[];
  remainingViolations: SpecViolation[];
  warnings: string[];
}

export interface CodeChange {
  type: ChangeType;
  file: string;
  original: string;
  modified: string;
  location: SourceLocation;
  description: string;
}

export enum ChangeType {
  ADD = 'add',
  REMOVE = 'remove',
  MODIFY = 'modify',
  MOVE = 'move',
  RENAME = 'rename'
}

export interface RefactoringPlan {
  freezeRecommendation: boolean;
  refactoringSteps: RefactoringStep[];
  estimatedEffort: RefactoringEffort;
  riskAssessment: RiskAssessment;
}

export interface RefactoringStep {
  order: number;
  description: string;
  type: RefactoringType;
  affectedFiles: string[];
  estimatedTime: number;
  dependencies: number[];
}

export enum RefactoringType {
  EXTRACT_CONSTANT = 'extract_constant',
  MOVE_TO_AUTHORITY = 'move_to_authority',
  SPLIT_LAYER = 'split_layer',
  STUPIDIFY_RENDERER = 'stupidify_renderer',
  ELIMINATE_DUPLICATION = 'eliminate_duplication'
}

export interface RefactoringEffort {
  totalHours: number;
  complexity: EffortComplexity;
  riskLevel: RiskLevel;
}

export enum EffortComplexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface RiskAssessment {
  overallRisk: RiskLevel;
  risks: Risk[];
  mitigations: Mitigation[];
}

export interface Risk {
  description: string;
  probability: number; // 0-1
  impact: RiskLevel;
  category: RiskCategory;
}

export enum RiskCategory {
  FUNCTIONAL = 'functional',
  PERFORMANCE = 'performance',
  ARCHITECTURAL = 'architectural',
  TIMELINE = 'timeline'
}

export interface Mitigation {
  riskId: string;
  strategy: string;
  effort: number;
  effectiveness: number; // 0-1
}

// Configuration interfaces
export interface GovernanceConfig {
  enabledSpecs: string[];
  ssotConfiguration: SSOTConfig;
  layerSeparationRules: LayerSeparationConfig;
  rendererStupidityRules: RendererStupidityConfig;
  structuralFailureThresholds: StructuralFailureConfig;
  enforcementLevel: EnforcementLevel;
  reportingConfig: ReportingConfig;
}

export interface SSOTConfig {
  authorityDefinitions: AuthorityDefinition[];
  allowedDuplicationExceptions: string[];
  constantsDirectoryPath: string;
  enforcementStrictness: EnforcementStrictness;
}

export interface AuthorityDefinition {
  concept: PhysicsConceptType;
  authorityFile: string;
  allowedAccessPatterns: string[];
  forbiddenUsageContexts: string[];
}

export interface LayerSeparationConfig {
  layerDefinitions: ArchitectureLayerDefinition[];
  allowedCrossLayerExceptions: string[];
  dependencyRules: DependencyRule[];
}

export interface DependencyRule {
  fromLayer: ArchitectureLayer;
  toLayer: ArchitectureLayer;
  allowed: boolean;
  exceptions: string[];
}

export interface RendererStupidityConfig {
  rendererPatterns: string[];
  allowedInputTypes: string[];
  forbiddenImportPatterns: string[];
  allowedComputationTypes: string[];
}

export interface StructuralFailureConfig {
  modificationThreshold: number;
  instabilityThreshold: number;
  parameterTuningThreshold: number;
  monitoringPeriod: number; // days
}

export interface ReportingConfig {
  outputFormat: 'json' | 'html' | 'markdown';
  includeCodeExamples: boolean;
  detailLevel: 'summary' | 'detailed' | 'verbose';
  autoGenerate: boolean;
  recipients: string[];
}