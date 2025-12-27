// Core interfaces for the project optimization system
import {
  ProjectAST,
  DependencyGraph,
  CodeMetrics,
  Pattern,
  PatternMatch,
  DuplicationIssue,
  PerformanceIssue,
  ArchitectureIssue,
  DeadCodeIssue,
  ConfigurationIssue,
  DocumentationIssue,
  OptimizationResult,
  CodeChange,
  OptimizationConfig,
  OptimizationMetrics
} from './types';

// Core analyzer interface
export interface CodeAnalyzer {
  parseProject(projectPath: string): Promise<ProjectAST>;
  analyzeDependencies(ast: ProjectAST): DependencyGraph;
  extractMetrics(ast: ProjectAST): CodeMetrics;
  findPatterns(ast: ProjectAST, patterns: Pattern[]): PatternMatch[];
}

// Issue detection interface
export interface IssueDetector {
  detectDuplication(ast: ProjectAST): DuplicationIssue[];
  detectPerformanceIssues(ast: ProjectAST): PerformanceIssue[];
  detectArchitectureViolations(ast: ProjectAST): ArchitectureIssue[];
  detectDeadCode(ast: ProjectAST): DeadCodeIssue[];
  detectConfigurationIssues(ast: ProjectAST): ConfigurationIssue[];
  detectDocumentationIssues(ast: ProjectAST): DocumentationIssue[];
}

// Optimization engine interface
export interface OptimizationEngine {
  optimizeDuplication(issues: DuplicationIssue[]): OptimizationResult;
  optimizePerformance(issues: PerformanceIssue[]): OptimizationResult;
  optimizeArchitecture(issues: ArchitectureIssue[]): OptimizationResult;
  removeDeadCode(issues: DeadCodeIssue[]): OptimizationResult;
  optimizeConfiguration(issues: ConfigurationIssue[]): OptimizationResult;
  optimizeDocumentation(issues: DocumentationIssue[]): OptimizationResult;
}

// Code generation interface
export interface CodeGenerator {
  generateCode(changes: CodeChange[]): GeneratedCode;
  formatCode(code: string, language: string): string;
  validateSyntax(code: string, language: string): ValidationResult;
  preserveComments(original: string, modified: string): string;
}

// Validation interface
export interface Validator {
  validateFunctionality(original: ProjectAST, optimized: ProjectAST): ValidationResult;
  validatePerformance(original: ProjectAST, optimized: ProjectAST): PerformanceComparison;
  validateArchitecture(optimized: ProjectAST, rules: ArchitectureRule[]): ArchitectureValidation;
  runTests(projectPath: string): TestResult;
}

// Error recovery interface
export interface ErrorRecovery {
  createBackup(files: string[]): BackupInfo;
  rollback(backupId: string): Promise<void>;
  validateRollback(backupId: string): ValidationResult;
  cleanupBackups(olderThan: Date): void;
}

// Configuration management interface
export interface ConfigurationManager {
  loadConfig(projectPath: string): Promise<OptimizationConfig>;
  saveConfig(config: OptimizationConfig, projectPath: string): Promise<void>;
  validateConfig(config: OptimizationConfig): ValidationResult;
  mergeConfigs(base: OptimizationConfig, override: OptimizationConfig): OptimizationConfig;
}

// Report generation interface
export interface ReportGenerator {
  generateAnalysisReport(ast: ProjectAST, issues: any[]): AnalysisReport;
  generateOptimizationReport(results: OptimizationResult[]): OptimizationReport;
  generateSummaryReport(before: CodeMetrics, after: CodeMetrics): SummaryReport;
  exportReport(report: any, format: ReportFormat): string;
}

// Additional types for interfaces
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  message: string;
  location?: SourceLocation;
  code?: string;
}

export interface ValidationWarning {
  message: string;
  location?: SourceLocation;
  suggestion?: string;
}

export interface PerformanceComparison {
  improved: boolean;
  metrics: PerformanceMetrics;
  recommendations: string[];
}

export interface PerformanceMetrics {
  executionTime: number;
  memoryUsage: number;
  bundleSize: number;
  renderTime?: number;
}

export interface ArchitectureValidation {
  compliant: boolean;
  violations: ArchitectureViolation[];
  score: number;
}

export interface ArchitectureViolation {
  rule: string;
  description: string;
  location: SourceLocation;
  severity: 'error' | 'warning';
}

export interface TestResult {
  passed: boolean;
  total: number;
  passed_count: number;
  failed: number;
  skipped: number;
  coverage?: CoverageResult;
  failures: TestFailure[];
}

export interface CoverageResult {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

export interface TestFailure {
  test: string;
  error: string;
  location?: SourceLocation;
}

export interface GeneratedCode {
  files: GeneratedFile[];
  summary: GenerationSummary;
}

export interface GeneratedFile {
  path: string;
  content: string;
  encoding: string;
  metadata: FileMetadata;
}

export interface FileMetadata {
  generated: Date;
  originalPath?: string;
  changes: string[];
  warnings: string[];
}

export interface GenerationSummary {
  filesGenerated: number;
  linesAdded: number;
  linesRemoved: number;
  linesModified: number;
  warnings: string[];
  errors: string[];
}

export interface ArchitectureRule {
  name: string;
  description: string;
  pattern: string | RegExp;
  violation: string;
  severity: 'error' | 'warning';
  enabled: boolean;
}

export interface AnalysisReport {
  summary: AnalysisSummary;
  issues: IssuesByType;
  metrics: CodeMetrics;
  recommendations: Recommendation[];
  timestamp: Date;
}

export interface AnalysisSummary {
  filesAnalyzed: number;
  issuesFound: number;
  criticalIssues: number;
  estimatedEffort: number;
}

export interface IssuesByType {
  duplication: DuplicationIssue[];
  performance: PerformanceIssue[];
  architecture: ArchitectureIssue[];
  deadCode: DeadCodeIssue[];
  configuration: ConfigurationIssue[];
  documentation: DocumentationIssue[];
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

export interface OptimizationReport {
  summary: OptimizationSummary;
  results: OptimizationResult[];
  metrics: OptimizationMetrics;
  timestamp: Date;
}

export interface OptimizationSummary {
  totalOptimizations: number;
  successfulOptimizations: number;
  failedOptimizations: number;
  timeElapsed: number;
}

export interface SummaryReport {
  before: CodeMetrics;
  after: CodeMetrics;
  improvements: ImprovementMetrics;
  recommendations: string[];
}

export interface ImprovementMetrics {
  duplicationsReduced: number;
  deadCodeRemoved: number;
  performanceGains: number;
  maintainabilityImproved: number;
}

export interface BackupInfo {
  id: string;
  timestamp: Date;
  files: BackupFile[];
  metadata: BackupMetadata;
}

export interface BackupFile {
  path: string;
  content: string;
  hash: string;
}

export interface BackupMetadata {
  projectPath: string;
  reason: string;
  size: number;
  fileCount: number;
}

export interface ArchitectureRule {
  name: string;
  description: string;
  pattern: string | RegExp;
  violation: string;
  severity: 'error' | 'warning';
  enabled: boolean;
}

export interface AnalysisReport {
  summary: AnalysisSummary;
  issues: IssuesByType;
  metrics: CodeMetrics;
  recommendations: Recommendation[];
  timestamp: Date;
}

export interface AnalysisSummary {
  filesAnalyzed: number;
  issuesFound: number;
  criticalIssues: number;
  estimatedEffort: number;
}

export interface IssuesByType {
  duplication: DuplicationIssue[];
  performance: PerformanceIssue[];
  architecture: ArchitectureIssue[];
  deadCode: DeadCodeIssue[];
  configuration: ConfigurationIssue[];
  documentation: DocumentationIssue[];
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

export interface OptimizationReport {
  summary: OptimizationSummary;
  results: OptimizationResult[];
  metrics: OptimizationMetrics;
  timestamp: Date;
}

export interface OptimizationSummary {
  totalOptimizations: number;
  successfulOptimizations: number;
  failedOptimizations: number;
  timeElapsed: number;
}

export interface SummaryReport {
  before: CodeMetrics;
  after: CodeMetrics;
  improvements: ImprovementMetrics;
  recommendations: string[];
}

export interface ImprovementMetrics {
  duplicationsReduced: number;
  deadCodeRemoved: number;
  performanceGains: number;
  maintainabilityImproved: number;
}

export enum ReportFormat {
  JSON = 'json',
  HTML = 'html',
  MARKDOWN = 'markdown',
  PDF = 'pdf'
}

// Import missing types from types.ts
import {
  OptimizationType,
  RuleSeverity,
  SourceLocation
} from './types';