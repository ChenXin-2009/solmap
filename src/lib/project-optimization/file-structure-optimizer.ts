// File structure optimization implementation for project optimization system
import {
  ProjectAST,
  FileAST,
  OptimizationResult,
  CodeChange,
  ChangeType,
  IssueType,
  IssueSeverity,
  SourceLocation,
  ModuleInfo
} from './types';

export interface FileStructureOptimizationConfig {
  optimizeFileNaming: boolean;
  optimizeDirectoryStructure: boolean;
  splitLargeFiles: boolean;
  optimizeModuleExports: boolean;
  enforceNamingConventions: boolean;
}

export interface FileStructureIssue {
  id: string;
  type: FileStructureIssueType;
  severity: IssueSeverity;
  location: SourceLocation;
  description: string;
  suggestion: string;
  currentValue?: string;
  recommendedValue?: string;
  fileSize?: number;
}

export enum FileStructureIssueType {
  POOR_FILE_NAMING = 'poor_file_naming',
  POOR_DIRECTORY_STRUCTURE = 'poor_directory_structure',
  OVERSIZED_FILE = 'oversized_file',
  POOR_MODULE_BOUNDARIES = 'poor_module_boundaries',
  INCONSISTENT_EXPORTS = 'inconsistent_exports'
}

export interface FileStructureMetrics {
  totalFiles: number;
  averageFileSize: number;
  largeFiles: number;
  poorlyNamedFiles: number;
  inconsistentExports: number;
  directoryDepth: number;
}

export class FileStructureOptimizer {
  private config: FileStructureOptimizationConfig;
  private readonly MAX_FILE_SIZE = 500; // lines
  private readonly MAX_DIRECTORY_DEPTH = 5;

  constructor(config: FileStructureOptimizationConfig = {
    optimizeFileNaming: true,
    optimizeDirectoryStructure: true,
    splitLargeFiles: true,
    optimizeModuleExports: true,
    enforceNamingConventions: true
  }) {
    this.config = config;
  }

  /**
   * Analyze file structure and identify optimization opportunities
   */
  analyzeFileStructure(ast: ProjectAST): FileStructureIssue[] {
    const issues: FileStructureIssue[] = [];

    // Analyze individual files
    for (const file of ast.files) {
      issues.push(...this.analyzeFile(file));
    }

    // Analyze directory structure
    issues.push(...this.analyzeDirectoryStructure(ast));

    // Analyze module boundaries
    issues.push(...this.analyzeModuleBoundaries(ast));

    return issues;
  }

  /**
   * Optimize file structure based on identified issues
   */
  optimizeFileStructure(issues: FileStructureIssue[]): OptimizationResult {
    const changes: CodeChange[] = [];
    const warnings: string[] = [];
    let successCount = 0;

    try {
      // Group issues by type for batch processing
      const issuesByType = this.groupIssuesByType(issues);

      // Process file naming issues
      if (this.config.optimizeFileNaming && issuesByType.poor_file_naming) {
        const namingChanges = this.optimizeFileNaming(issuesByType.poor_file_naming);
        changes.push(...namingChanges);
        successCount += namingChanges.length;
      }

      // Process directory structure issues
      if (this.config.optimizeDirectoryStructure && issuesByType.poor_directory_structure) {
        const structureChanges = this.optimizeDirectoryStructure(issuesByType.poor_directory_structure);
        changes.push(...structureChanges);
        successCount += structureChanges.length;
      }

      // Process oversized files
      if (this.config.splitLargeFiles && issuesByType.oversized_file) {
        const splitChanges = this.splitLargeFiles(issuesByType.oversized_file);
        changes.push(...splitChanges);
        successCount += splitChanges.length;
      }

      // Process module export issues
      if (this.config.optimizeModuleExports && issuesByType.inconsistent_exports) {
        const exportChanges = this.optimizeModuleExports(issuesByType.inconsistent_exports);
        changes.push(...exportChanges);
        successCount += exportChanges.length;
      }

      return {
        success: true,
        changes,
        metrics: {
          filesProcessed: this.getUniqueFiles(changes).length,
          issuesFound: issues.length,
          issuesFixed: successCount,
          linesRemoved: this.countRemovedLines(changes),
          duplicationsEliminated: 0,
          performanceImprovements: issuesByType.oversized_file?.length || 0
        },
        warnings
      };
    } catch (error) {
      return {
        success: false,
        changes: [],
        metrics: {
          filesProcessed: 0,
          issuesFound: issues.length,
          issuesFixed: 0,
          linesRemoved: 0,
          duplicationsEliminated: 0,
          performanceImprovements: 0
        },
        warnings: [`File structure optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Calculate file structure metrics for a project
   */
  calculateFileStructureMetrics(ast: ProjectAST): FileStructureMetrics {
    const issues = this.analyzeFileStructure(ast);
    const fileSizes = ast.files.map(file => this.estimateFileSize(file));

    return {
      totalFiles: ast.files.length,
      averageFileSize: fileSizes.reduce((sum, size) => sum + size, 0) / fileSizes.length,
      largeFiles: issues.filter(i => i.type === FileStructureIssueType.OVERSIZED_FILE).length,
      poorlyNamedFiles: issues.filter(i => i.type === FileStructureIssueType.POOR_FILE_NAMING).length,
      inconsistentExports: issues.filter(i => i.type === FileStructureIssueType.INCONSISTENT_EXPORTS).length,
      directoryDepth: this.calculateMaxDirectoryDepth(ast)
    };
  }

  private analyzeFile(file: FileAST): FileStructureIssue[] {
    const issues: FileStructureIssue[] = [];
    const fileName = this.extractFileName(file.sourceType);
    const fileSize = this.estimateFileSize(file);

    // Check file naming conventions
    if (this.config.enforceNamingConventions && !this.isValidFileName(fileName)) {
      issues.push({
        id: `poor-naming-${fileName}`,
        type: FileStructureIssueType.POOR_FILE_NAMING,
        severity: IssueSeverity.LOW,
        location: { file: file.sourceType, line: 1, column: 1 },
        description: `File name "${fileName}" doesn't follow naming conventions`,
        suggestion: 'Use kebab-case for file names and descriptive names',
        currentValue: fileName,
        recommendedValue: this.suggestFileName(fileName)
      });
    }

    // Check file size
    if (fileSize > this.MAX_FILE_SIZE) {
      issues.push({
        id: `oversized-file-${fileName}`,
        type: FileStructureIssueType.OVERSIZED_FILE,
        severity: IssueSeverity.MEDIUM,
        location: { file: file.sourceType, line: 1, column: 1 },
        description: `File is too large (${fileSize} lines)`,
        suggestion: 'Consider splitting this file into smaller, more focused modules',
        fileSize
      });
    }

    // Check export consistency
    if (this.hasInconsistentExports(file)) {
      issues.push({
        id: `inconsistent-exports-${fileName}`,
        type: FileStructureIssueType.INCONSISTENT_EXPORTS,
        severity: IssueSeverity.LOW,
        location: { file: file.sourceType, line: 1, column: 1 },
        description: 'File has inconsistent export patterns',
        suggestion: 'Standardize export patterns (prefer named exports or default exports consistently)'
      });
    }

    return issues;
  }

  private analyzeDirectoryStructure(ast: ProjectAST): FileStructureIssue[] {
    const issues: FileStructureIssue[] = [];
    const directories = this.extractDirectories(ast);

    // Check directory depth
    const maxDepth = this.calculateMaxDirectoryDepth(ast);
    if (maxDepth > this.MAX_DIRECTORY_DEPTH) {
      issues.push({
        id: 'deep-directory-structure',
        type: FileStructureIssueType.POOR_DIRECTORY_STRUCTURE,
        severity: IssueSeverity.MEDIUM,
        location: { file: 'project-root', line: 1, column: 1 },
        description: `Directory structure is too deep (${maxDepth} levels)`,
        suggestion: 'Consider flattening the directory structure or reorganizing modules'
      });
    }

    // Check for poorly organized directories
    for (const directory of directories) {
      if (this.isPoorlyOrganizedDirectory(directory, ast)) {
        issues.push({
          id: `poor-organization-${directory}`,
          type: FileStructureIssueType.POOR_DIRECTORY_STRUCTURE,
          severity: IssueSeverity.LOW,
          location: { file: directory, line: 1, column: 1 },
          description: `Directory "${directory}" appears to be poorly organized`,
          suggestion: 'Consider reorganizing files based on functionality or domain'
        });
      }
    }

    return issues;
  }

  private analyzeModuleBoundaries(ast: ProjectAST): FileStructureIssue[] {
    const issues: FileStructureIssue[] = [];

    // Analyze module cohesion and coupling
    for (const module of ast.modules) {
      if (this.hasPoorModuleBoundaries(module, ast)) {
        issues.push({
          id: `poor-boundaries-${module.name}`,
          type: FileStructureIssueType.POOR_MODULE_BOUNDARIES,
          severity: IssueSeverity.MEDIUM,
          location: { file: module.path, line: 1, column: 1 },
          description: `Module "${module.name}" has unclear boundaries`,
          suggestion: 'Consider refactoring to improve module cohesion and reduce coupling'
        });
      }
    }

    return issues;
  }

  private optimizeFileNaming(issues: FileStructureIssue[]): CodeChange[] {
    const changes: CodeChange[] = [];

    for (const issue of issues) {
      if (issue.recommendedValue) {
        changes.push({
          type: ChangeType.RENAME,
          file: issue.location.file,
          original: issue.currentValue || '',
          modified: issue.recommendedValue,
          location: issue.location,
          description: `Renamed file to follow naming conventions: ${issue.currentValue} → ${issue.recommendedValue}`
        });
      }
    }

    return changes;
  }

  private optimizeDirectoryStructure(issues: FileStructureIssue[]): CodeChange[] {
    const changes: CodeChange[] = [];

    for (const issue of issues) {
      changes.push({
        type: ChangeType.MOVE,
        file: issue.location.file,
        original: 'current directory structure',
        modified: 'optimized directory structure',
        location: issue.location,
        description: 'Reorganized directory structure for better organization'
      });
    }

    return changes;
  }

  private splitLargeFiles(issues: FileStructureIssue[]): CodeChange[] {
    const changes: CodeChange[] = [];

    for (const issue of issues) {
      // Suggest splitting strategies based on file content
      const splitStrategy = this.determineSplitStrategy(issue);
      
      changes.push({
        type: ChangeType.MODIFY,
        file: issue.location.file,
        original: `large file (${issue.fileSize} lines)`,
        modified: 'split into smaller modules',
        location: issue.location,
        description: `Split large file using ${splitStrategy} strategy`
      });
    }

    return changes;
  }

  private optimizeModuleExports(issues: FileStructureIssue[]): CodeChange[] {
    const changes: CodeChange[] = [];

    for (const issue of issues) {
      changes.push({
        type: ChangeType.MODIFY,
        file: issue.location.file,
        original: 'inconsistent export patterns',
        modified: 'standardized export patterns',
        location: issue.location,
        description: 'Standardized module export patterns for consistency'
      });
    }

    return changes;
  }

  private extractFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  private estimateFileSize(file: FileAST): number {
    // Estimate based on AST node count (rough approximation)
    return file.body.length * 5; // Assume average 5 lines per top-level node
  }

  private isValidFileName(fileName: string): boolean {
    // Check for kebab-case naming convention
    const kebabCasePattern = /^[a-z0-9]+(-[a-z0-9]+)*\.(ts|js|tsx|jsx|json|md)$/;
    return kebabCasePattern.test(fileName);
  }

  private suggestFileName(fileName: string): string {
    // Convert to kebab-case
    return fileName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '')
      .replace(/[_\s]+/g, '-');
  }

  private hasInconsistentExports(file: FileAST): boolean {
    const hasDefaultExport = file.exports.some(exp => exp.specifiers.some(spec => spec.exported === 'default'));
    const hasNamedExports = file.exports.some(exp => exp.specifiers.some(spec => spec.exported !== 'default'));
    
    // Inconsistent if both default and named exports exist without clear pattern
    return hasDefaultExport && hasNamedExports && file.exports.length > 2;
  }

  private extractDirectories(ast: ProjectAST): string[] {
    const directories = new Set<string>();
    
    for (const file of ast.files) {
      const parts = file.sourceType.split('/');
      for (let i = 1; i < parts.length; i++) {
        directories.add(parts.slice(0, i).join('/'));
      }
    }
    
    return Array.from(directories);
  }

  private calculateMaxDirectoryDepth(ast: ProjectAST): number {
    let maxDepth = 0;
    
    for (const file of ast.files) {
      const depth = file.sourceType.split('/').length - 1;
      maxDepth = Math.max(maxDepth, depth);
    }
    
    return maxDepth;
  }

  private isPoorlyOrganizedDirectory(directory: string, ast: ProjectAST): boolean {
    const filesInDirectory = ast.files.filter(file => 
      file.sourceType.startsWith(directory + '/') && 
      file.sourceType.split('/').length === directory.split('/').length + 1
    );

    // Heuristics for poor organization
    const hasMoreThan10Files = filesInDirectory.length > 10;
    const hasMixedTypes = this.hasMixedFileTypes(filesInDirectory);
    const lacksCoherentNaming = this.lacksCoherentNaming(filesInDirectory);

    return hasMoreThan10Files || hasMixedTypes || lacksCoherentNaming;
  }

  private hasMixedFileTypes(files: FileAST[]): boolean {
    const types = new Set(files.map(file => this.getFileCategory(file.sourceType)));
    return types.size > 2; // More than 2 different categories suggests mixed organization
  }

  private getFileCategory(filePath: string): string {
    if (filePath.includes('test') || filePath.includes('spec')) return 'test';
    if (filePath.includes('component')) return 'component';
    if (filePath.includes('util') || filePath.includes('helper')) return 'utility';
    if (filePath.includes('type') || filePath.includes('interface')) return 'types';
    if (filePath.includes('config')) return 'config';
    return 'other';
  }

  private lacksCoherentNaming(files: FileAST[]): boolean {
    const names = files.map(file => this.extractFileName(file.sourceType));
    const commonPrefixes = this.findCommonPrefixes(names);
    
    // If less than 30% of files share common prefixes, naming might be incoherent
    return commonPrefixes.length / names.length < 0.3;
  }

  private findCommonPrefixes(names: string[]): string[] {
    const prefixes = new Set<string>();
    
    for (const name of names) {
      const parts = name.split(/[-_]/);
      if (parts.length > 1) {
        prefixes.add(parts[0]);
      }
    }
    
    return Array.from(prefixes);
  }

  private hasPoorModuleBoundaries(module: ModuleInfo, ast: ProjectAST): boolean {
    // Check coupling (too many dependencies)
    const highCoupling = module.dependencies.length > 10;
    
    // Check cohesion (exports don't seem related)
    const lowCohesion = this.hasLowCohesion(module);
    
    return highCoupling || lowCohesion;
  }

  private hasLowCohesion(module: ModuleInfo): boolean {
    // Simple heuristic: if exports have very different naming patterns, cohesion might be low
    const exportNames = module.exports;
    if (exportNames.length < 2) return false;
    
    const categories = new Set(exportNames.map(name => this.categorizeExportName(name)));
    return categories.size > exportNames.length / 2; // More than half are in different categories
  }

  private categorizeExportName(name: string): string {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('component') || lowerName.includes('view')) return 'ui';
    if (lowerName.includes('service') || lowerName.includes('api')) return 'service';
    if (lowerName.includes('util') || lowerName.includes('helper')) return 'utility';
    if (lowerName.includes('type') || lowerName.includes('interface')) return 'types';
    if (lowerName.includes('config') || lowerName.includes('constant')) return 'config';
    return 'other';
  }

  private determineSplitStrategy(issue: FileStructureIssue): string {
    // Determine how to split the file based on its characteristics
    const fileName = this.extractFileName(issue.location.file);
    
    if (fileName.includes('component')) return 'by component functionality';
    if (fileName.includes('util') || fileName.includes('helper')) return 'by utility category';
    if (fileName.includes('type') || fileName.includes('interface')) return 'by domain';
    if (fileName.includes('service') || fileName.includes('api')) return 'by service responsibility';
    
    return 'by logical grouping';
  }

  private groupIssuesByType(issues: FileStructureIssue[]): Record<string, FileStructureIssue[]> {
    const grouped: Record<string, FileStructureIssue[]> = {};
    
    for (const issue of issues) {
      if (!grouped[issue.type]) {
        grouped[issue.type] = [];
      }
      grouped[issue.type].push(issue);
    }

    return grouped;
  }

  private getUniqueFiles(changes: CodeChange[]): string[] {
    return [...new Set(changes.map(change => change.file))];
  }

  private countRemovedLines(changes: CodeChange[]): number {
    return changes.filter(change => change.type === ChangeType.REMOVE).length;
  }
}