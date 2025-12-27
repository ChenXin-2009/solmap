// Core types for the project optimization system

export interface Project {
  path: string;
  name: string;
  version: string;
  dependencies: Dependency[];
  files: ProjectFile[];
  configuration: ProjectConfiguration;
}

export interface ProjectFile {
  path: string;
  type: FileType;
  content: string;
  ast: FileAST;
  metrics: FileMetrics;
  issues: Issue[];
}

export interface Dependency {
  name: string;
  version: string;
  type: DependencyType;
  used: boolean;
  importedBy: string[];
}

export interface ProjectConfiguration {
  typescript: boolean;
  framework: string;
  testFramework: string;
  buildTool: string;
}

export interface FileAST {
  type: string;
  body: any[];
  sourceType: string;
  imports: ImportDeclaration[];
  exports: ExportDeclaration[];
  functions: FunctionDeclaration[];
  classes: ClassDeclaration[];
  variables: VariableDeclaration[];
}

export interface FileMetrics {
  linesOfCode: number;
  complexity: number;
  duplicationScore: number;
  maintainabilityIndex: number;
}

export interface Issue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  location: SourceLocation;
  description: string;
  suggestion: string;
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface OptimizationConfig {
  enabled: boolean;
  rules: OptimizationRule[];
  thresholds: OptimizationThresholds;
  exclusions: string[];
}

export interface OptimizationRule {
  name: string;
  type: OptimizationType;
  severity: RuleSeverity;
  parameters: Record<string, any>;
}

export interface OptimizationThresholds {
  duplicationSimilarity: number;
  complexityLimit: number;
  fileSizeLimit: number;
  functionLengthLimit: number;
}

export interface CodeChange {
  type: ChangeType;
  file: string;
  original: string;
  modified: string;
  location: SourceLocation;
  description: string;
}

export interface OptimizationResult {
  success: boolean;
  changes: CodeChange[];
  metrics: OptimizationMetrics;
  warnings: string[];
}

export interface OptimizationMetrics {
  filesProcessed: number;
  issuesFound: number;
  issuesFixed: number;
  linesRemoved: number;
  duplicationsEliminated: number;
  performanceImprovements: number;
}

export interface ProjectAST {
  files: FileAST[];
  modules: ModuleInfo[];
  dependencies: DependencyInfo[];
}

export interface ModuleInfo {
  name: string;
  path: string;
  exports: string[];
  imports: string[];
  dependencies: string[];
}

export interface DependencyInfo {
  name: string;
  version: string;
  importedBy: string[];
  exports: string[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: string[][];
}

export interface DependencyNode {
  id: string;
  name: string;
  type: DependencyType;
  used: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: DependencyRelationType;
}

export interface CodeMetrics {
  linesOfCode: number;
  complexity: ComplexityMetrics;
  duplication: DuplicationMetrics;
  coverage: CoverageMetrics;
}

export interface ComplexityMetrics {
  cyclomatic: number;
  cognitive: number;
  halstead: HalsteadMetrics;
}

export interface HalsteadMetrics {
  vocabulary: number;
  length: number;
  difficulty: number;
  effort: number;
}

export interface DuplicationMetrics {
  duplicatedLines: number;
  duplicatedBlocks: number;
  duplicationRatio: number;
}

export interface CoverageMetrics {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

export interface Pattern {
  name: string;
  type: PatternType;
  matcher: RegExp | ((node: any) => boolean);
  description: string;
}

export interface PatternMatch {
  pattern: Pattern;
  location: SourceLocation;
  context: any;
}

// Enums
export enum FileType {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  JSON = 'json',
  MARKDOWN = 'markdown',
  CSS = 'css',
  HTML = 'html',
  TEST = 'test'
}

export enum DependencyType {
  PRODUCTION = 'production',
  DEVELOPMENT = 'development',
  PEER = 'peer',
  OPTIONAL = 'optional'
}

export enum IssueType {
  DUPLICATION = 'duplication',
  DEAD_CODE = 'dead_code',
  PERFORMANCE = 'performance',
  ARCHITECTURE = 'architecture',
  CONFIGURATION = 'configuration',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  DEPENDENCY = 'dependency'
}

export enum IssueSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum OptimizationType {
  DUPLICATION_REMOVAL = 'duplication_removal',
  DEAD_CODE_ELIMINATION = 'dead_code_elimination',
  PERFORMANCE_OPTIMIZATION = 'performance_optimization',
  ARCHITECTURE_IMPROVEMENT = 'architecture_improvement',
  CONFIGURATION_STANDARDIZATION = 'configuration_standardization'
}

export enum RuleSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export enum ChangeType {
  ADD = 'add',
  REMOVE = 'remove',
  MODIFY = 'modify',
  MOVE = 'move',
  RENAME = 'rename'
}

export enum DependencyRelationType {
  IMPORT = 'import',
  REQUIRE = 'require',
  DYNAMIC_IMPORT = 'dynamic_import',
  TYPE_IMPORT = 'type_import'
}

export enum PatternType {
  DUPLICATION = 'duplication',
  ANTI_PATTERN = 'anti_pattern',
  PERFORMANCE_ISSUE = 'performance_issue',
  ARCHITECTURE_VIOLATION = 'architecture_violation'
}

// Specific issue types
export interface DuplicationIssue extends Issue {
  type: IssueType.DUPLICATION;
  duplicates: SourceLocation[];
  similarity: number;
  extractionSuggestion: string;
}

export interface PerformanceIssue extends Issue {
  type: IssueType.PERFORMANCE;
  performanceImpact: PerformanceImpact;
  optimizationSuggestion: string;
}

export interface ArchitectureIssue extends Issue {
  type: IssueType.ARCHITECTURE;
  violatedRule: string;
  expectedPattern: string;
  actualPattern: string;
}

export interface DeadCodeIssue extends Issue {
  type: IssueType.DEAD_CODE;
  codeType: DeadCodeType;
  references: SourceLocation[];
}

export interface ConfigurationIssue extends Issue {
  type: IssueType.CONFIGURATION;
  configType: ConfigurationType;
  recommendedValue: any;
  currentValue: any;
}

export interface DocumentationIssue extends Issue {
  type: IssueType.DOCUMENTATION;
  documentationType: DocumentationType;
  expectedDocumentation?: string;
  currentDocumentation?: string;
}

export enum PerformanceImpact {
  MEMORY_LEAK = 'memory_leak',
  CPU_INTENSIVE = 'cpu_intensive',
  BLOCKING_OPERATION = 'blocking_operation',
  INEFFICIENT_ALGORITHM = 'inefficient_algorithm'
}

export enum DeadCodeType {
  UNUSED_IMPORT = 'unused_import',
  UNUSED_VARIABLE = 'unused_variable',
  UNUSED_FUNCTION = 'unused_function',
  UNREACHABLE_CODE = 'unreachable_code',
  TODO_COMMENT = 'todo_comment',
  DEBUG_CODE = 'debug_code'
}

export enum ConfigurationType {
  HARDCODED_VALUE = 'hardcoded_value',
  DUPLICATE_CONFIG = 'duplicate_config',
  MISSING_DEFAULT = 'missing_default',
  INCONSISTENT_USAGE = 'inconsistent_usage'
}

export enum DocumentationType {
  MISSING_FUNCTION_DOC = 'missing_function_doc',
  MISSING_CLASS_DOC = 'missing_class_doc',
  MISSING_METHOD_DOC = 'missing_method_doc',
  OUTDATED_COMMENT = 'outdated_comment',
  INCONSISTENT_COMMENT = 'inconsistent_comment',
  INVALID_EXAMPLE = 'invalid_example',
  MISSING_PARAM_DOC = 'missing_param_doc',
  MISSING_RETURN_DOC = 'missing_return_doc'
}

// Declaration types for AST
export interface ImportDeclaration {
  source: string;
  specifiers: ImportSpecifier[];
  type: 'import' | 'require';
}

export interface ImportSpecifier {
  imported: string;
  local: string;
  type: 'default' | 'namespace' | 'named';
}

export interface ExportDeclaration {
  specifiers: ExportSpecifier[];
  source?: string;
  declaration?: any;
}

export interface ExportSpecifier {
  exported: string;
  local: string;
}

export interface FunctionDeclaration {
  name: string;
  parameters: Parameter[];
  returnType?: string;
  body: any;
  async: boolean;
  generator: boolean;
}

export interface Parameter {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: any;
}

export interface ClassDeclaration {
  name: string;
  superClass?: string;
  implements: string[];
  methods: MethodDeclaration[];
  properties: PropertyDeclaration[];
}

export interface MethodDeclaration {
  name: string;
  parameters: Parameter[];
  returnType?: string;
  static: boolean;
  private: boolean;
  async: boolean;
}

export interface PropertyDeclaration {
  name: string;
  type?: string;
  static: boolean;
  private: boolean;
  readonly: boolean;
}

export interface VariableDeclaration {
  name: string;
  type?: string;
  kind: 'var' | 'let' | 'const';
  initialized: boolean;
}