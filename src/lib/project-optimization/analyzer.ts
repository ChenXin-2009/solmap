// Code analyzer implementation using TypeScript Compiler API
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { CodeAnalyzer } from './interfaces';
import { 
  ProjectAST, 
  DependencyGraph, 
  CodeMetrics, 
  Pattern, 
  PatternMatch,
  FileAST,
  ModuleInfo,
  DependencyInfo,
  ImportDeclaration,
  ExportDeclaration,
  FunctionDeclaration,
  ClassDeclaration,
  VariableDeclaration,
  FileType,
  DependencyNode,
  DependencyEdge,
  DependencyType,
  DependencyRelationType,
  ComplexityMetrics,
  DuplicationMetrics,
  CoverageMetrics,
  HalsteadMetrics
} from './types';

export class TypeScriptCodeAnalyzer implements CodeAnalyzer {
  private program: ts.Program | null = null;
  private typeChecker: ts.TypeChecker | null = null;

  async parseProject(projectPath: string): Promise<ProjectAST> {
    // Find TypeScript config file
    const configPath = this.findTsConfig(projectPath);
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    
    if (configFile.error) {
      throw new Error(`Error reading tsconfig.json: ${configFile.error.messageText}`);
    }

    // Parse the config file
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath)
    );

    if (parsedConfig.errors.length > 0) {
      throw new Error(`Error parsing tsconfig.json: ${parsedConfig.errors[0].messageText}`);
    }

    // Create TypeScript program
    this.program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
    this.typeChecker = this.program.getTypeChecker();

    // Parse all source files
    const files: FileAST[] = [];
    const modules: ModuleInfo[] = [];
    const dependencies: DependencyInfo[] = [];

    for (const sourceFile of this.program.getSourceFiles()) {
      if (!sourceFile.isDeclarationFile && this.isProjectFile(sourceFile.fileName, projectPath)) {
        const fileAST = this.parseSourceFile(sourceFile);
        files.push(fileAST);

        // Extract module info
        const moduleInfo = this.extractModuleInfo(sourceFile);
        modules.push(moduleInfo);
      }
    }

    // Extract dependency information
    const dependencyMap = this.extractDependencies(files);
    dependencies.push(...dependencyMap.values());

    return {
      files,
      modules,
      dependencies
    };
  }

  analyzeDependencies(ast: ProjectAST): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const nodeMap = new Map<string, DependencyNode>();

    // Create nodes for all modules
    for (const module of ast.modules) {
      const node: DependencyNode = {
        id: module.name,
        name: module.name,
        type: DependencyType.PRODUCTION, // Default, could be refined
        used: module.imports.length > 0 || module.exports.length > 0
      };
      nodes.push(node);
      nodeMap.set(module.name, node);
    }

    // Create nodes for external dependencies
    for (const dep of ast.dependencies) {
      if (!nodeMap.has(dep.name)) {
        const node: DependencyNode = {
          id: dep.name,
          name: dep.name,
          type: this.inferDependencyType(dep.name),
          used: dep.importedBy.length > 0
        };
        nodes.push(node);
        nodeMap.set(dep.name, node);
      }
    }

    // Create edges based on imports
    for (let i = 0; i < ast.files.length; i++) {
      const file = ast.files[i];
      const fromModule = ast.modules[i]?.name || `file${i}`;
      
      for (const importDecl of file.imports) {
        const toModule = this.resolveModuleName(importDecl.source, ast.modules);
        
        if (nodeMap.has(fromModule) && nodeMap.has(toModule)) {
          edges.push({
            from: fromModule,
            to: toModule,
            type: importDecl.type === 'import' ? DependencyRelationType.IMPORT : DependencyRelationType.REQUIRE
          });
        }
      }
    }

    // Detect cycles
    const cycles = this.detectCycles(nodes, edges);

    return {
      nodes,
      edges,
      cycles
    };
  }

  extractMetrics(ast: ProjectAST): CodeMetrics {
    let totalLinesOfCode = 0;
    let totalComplexity = 0;
    let totalDuplication = 0;
    let totalFunctions = 0;

    for (const file of ast.files) {
      totalLinesOfCode += file.sourceType === 'module' ? this.countLines(file) : 0;
      totalComplexity += this.calculateComplexity(file);
      totalDuplication += file.functions.length; // Simplified duplication metric
      totalFunctions += file.functions.length;
    }

    const complexity: ComplexityMetrics = {
      cyclomatic: totalComplexity,
      cognitive: Math.floor(totalComplexity * 1.2), // Approximation
      halstead: this.calculateHalsteadMetrics(ast)
    };

    const duplication: DuplicationMetrics = {
      duplicatedLines: 0, // Would need more sophisticated analysis
      duplicatedBlocks: 0,
      duplicationRatio: 0
    };

    const coverage: CoverageMetrics = {
      lines: 0, // Would need test coverage data
      functions: 0,
      branches: 0,
      statements: 0
    };

    return {
      linesOfCode: totalLinesOfCode,
      complexity,
      duplication,
      coverage
    };
  }

  findPatterns(ast: ProjectAST, patterns: Pattern[]): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const file of ast.files) {
      for (const pattern of patterns) {
        const fileMatches = this.findPatternsInFile(file, pattern);
        matches.push(...fileMatches);
      }
    }

    return matches;
  }

  private findTsConfig(projectPath: string): string {
    const configPath = path.join(projectPath, 'tsconfig.json');
    if (fs.existsSync(configPath)) {
      return configPath;
    }
    
    // Look for tsconfig in parent directories
    let currentDir = projectPath;
    while (currentDir !== path.dirname(currentDir)) {
      currentDir = path.dirname(currentDir);
      const parentConfigPath = path.join(currentDir, 'tsconfig.json');
      if (fs.existsSync(parentConfigPath)) {
        return parentConfigPath;
      }
    }
    
    throw new Error('tsconfig.json not found');
  }

  private isProjectFile(fileName: string, projectPath: string): boolean {
    const relativePath = path.relative(projectPath, fileName);
    return !relativePath.startsWith('..') && 
           !relativePath.includes('node_modules') &&
           (fileName.endsWith('.ts') || fileName.endsWith('.tsx'));
  }

  private parseSourceFile(sourceFile: ts.SourceFile): FileAST {
    const imports: ImportDeclaration[] = [];
    const exports: ExportDeclaration[] = [];
    const functions: FunctionDeclaration[] = [];
    const classes: ClassDeclaration[] = [];
    const variables: VariableDeclaration[] = [];

    const visit = (node: ts.Node) => {
      switch (node.kind) {
        case ts.SyntaxKind.ImportDeclaration:
          imports.push(this.parseImportDeclaration(node as ts.ImportDeclaration));
          break;
        case ts.SyntaxKind.ExportDeclaration:
        case ts.SyntaxKind.ExportAssignment:
          exports.push(this.parseExportDeclaration(node));
          break;
        case ts.SyntaxKind.FunctionDeclaration:
          functions.push(this.parseFunctionDeclaration(node as ts.FunctionDeclaration));
          break;
        case ts.SyntaxKind.ClassDeclaration:
          classes.push(this.parseClassDeclaration(node as ts.ClassDeclaration));
          break;
        case ts.SyntaxKind.VariableStatement:
          variables.push(...this.parseVariableStatement(node as ts.VariableStatement));
          break;
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      type: 'Program',
      body: [], // Simplified - would contain full AST
      sourceType: sourceFile.isDeclarationFile ? 'declaration' : 'module',
      imports,
      exports,
      functions,
      classes,
      variables
    };
  }

  private parseImportDeclaration(node: ts.ImportDeclaration): ImportDeclaration {
    const source = (node.moduleSpecifier as ts.StringLiteral).text;
    const specifiers = [];

    if (node.importClause) {
      if (node.importClause.name) {
        // Default import
        specifiers.push({
          imported: 'default',
          local: node.importClause.name.text,
          type: 'default' as const
        });
      }

      if (node.importClause.namedBindings) {
        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          // Namespace import
          specifiers.push({
            imported: '*',
            local: node.importClause.namedBindings.name.text,
            type: 'namespace' as const
          });
        } else if (ts.isNamedImports(node.importClause.namedBindings)) {
          // Named imports
          for (const element of node.importClause.namedBindings.elements) {
            specifiers.push({
              imported: element.propertyName?.text || element.name.text,
              local: element.name.text,
              type: 'named' as const
            });
          }
        }
      }
    }

    return {
      source,
      specifiers,
      type: 'import'
    };
  }

  private parseExportDeclaration(node: ts.Node): ExportDeclaration {
    // Simplified export parsing
    return {
      specifiers: [],
      source: undefined,
      declaration: undefined
    };
  }

  private parseFunctionDeclaration(node: ts.FunctionDeclaration): FunctionDeclaration {
    return {
      name: node.name?.text || 'anonymous',
      parameters: node.parameters.map(param => ({
        name: param.name.getText(),
        type: param.type?.getText(),
        optional: !!param.questionToken,
        defaultValue: param.initializer?.getText()
      })),
      returnType: node.type?.getText(),
      body: {}, // Simplified
      async: !!(node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword)),
      generator: !!(node.asteriskToken)
    };
  }

  private parseClassDeclaration(node: ts.ClassDeclaration): ClassDeclaration {
    return {
      name: node.name?.text || 'anonymous',
      superClass: node.heritageClauses?.find(clause => clause.token === ts.SyntaxKind.ExtendsKeyword)
        ?.types[0]?.expression.getText(),
      implements: node.heritageClauses?.find(clause => clause.token === ts.SyntaxKind.ImplementsKeyword)
        ?.types.map(type => type.expression.getText()) || [],
      methods: [],
      properties: []
    };
  }

  private parseVariableStatement(node: ts.VariableStatement): VariableDeclaration[] {
    return node.declarationList.declarations.map(decl => ({
      name: decl.name.getText(),
      type: decl.type?.getText(),
      kind: node.declarationList.flags & ts.NodeFlags.Const ? 'const' :
            node.declarationList.flags & ts.NodeFlags.Let ? 'let' : 'var',
      initialized: !!decl.initializer
    }));
  }

  private extractModuleInfo(sourceFile: ts.SourceFile): ModuleInfo {
    const imports: string[] = [];
    const exports: string[] = [];
    const dependencies: string[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const source = (node.moduleSpecifier as ts.StringLiteral).text;
        imports.push(source);
        if (!source.startsWith('.')) {
          dependencies.push(source);
        }
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const source = (node.moduleSpecifier as ts.StringLiteral).text;
        exports.push(source);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return {
      name: this.getModuleName({ sourceType: sourceFile.isDeclarationFile ? 'declaration' : 'module' } as FileAST),
      path: sourceFile.fileName,
      exports,
      imports,
      dependencies
    };
  }

  private extractDependencies(files: FileAST[]): Map<string, DependencyInfo> {
    const dependencies = new Map<string, DependencyInfo>();

    for (const file of files) {
      for (const importDecl of file.imports) {
        const depName = importDecl.source;
        if (!depName.startsWith('.')) { // External dependency
          if (!dependencies.has(depName)) {
            dependencies.set(depName, {
              name: depName,
              version: 'unknown',
              importedBy: [],
              exports: []
            });
          }
          const dep = dependencies.get(depName)!;
          const moduleName = this.getModuleName(file);
          if (!dep.importedBy.includes(moduleName)) {
            dep.importedBy.push(moduleName);
          }
        }
      }
    }

    return dependencies;
  }

  private resolveModuleName(source: string, modules: ModuleInfo[]): string {
    // For relative imports, try to find the matching module
    if (source.startsWith('./') || source.startsWith('../')) {
      const matchingModule = modules.find(mod => 
        mod.path.includes(source.replace('./', '').replace('../', ''))
      );
      return matchingModule?.name || source;
    }
    // For external dependencies, return as-is
    return source;
  }

  private getModuleName(file: FileAST): string {
    // Simplified module name extraction
    return file.sourceType || 'unknown';
  }

  private inferDependencyType(depName: string): DependencyType {
    // Simple heuristic - could be improved by reading package.json
    if (depName.startsWith('@types/')) {
      return DependencyType.DEVELOPMENT;
    }
    return DependencyType.PRODUCTION;
  }

  private detectCycles(nodes: DependencyNode[], edges: DependencyEdge[]): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const adjacencyList = new Map<string, string[]>();

    // Build adjacency list
    for (const edge of edges) {
      if (!adjacencyList.has(edge.from)) {
        adjacencyList.set(edge.from, []);
      }
      adjacencyList.get(edge.from)!.push(edge.to);
    }

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart).concat([node]));
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path]);
      }

      recursionStack.delete(node);
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  private countLines(file: FileAST): number {
    // Simplified line counting - would need actual source text
    return file.functions.length * 10 + file.classes.length * 20 + file.variables.length * 2;
  }

  private calculateComplexity(file: FileAST): number {
    // Simplified complexity calculation
    let complexity = 1; // Base complexity
    
    for (const func of file.functions) {
      complexity += 1; // Each function adds complexity
      complexity += func.parameters.length * 0.1; // Parameters add slight complexity
    }
    
    for (const cls of file.classes) {
      complexity += 2; // Classes are more complex
    }

    return Math.floor(complexity);
  }

  private calculateHalsteadMetrics(ast: ProjectAST): HalsteadMetrics {
    // Simplified Halstead metrics calculation
    let operators = 0;
    let operands = 0;
    let uniqueOperators = new Set<string>();
    let uniqueOperands = new Set<string>();

    for (const file of ast.files) {
      operators += file.functions.length + file.classes.length;
      operands += file.variables.length;
      
      file.functions.forEach(f => uniqueOperators.add(f.name));
      file.variables.forEach(v => uniqueOperands.add(v.name));
    }

    const vocabulary = uniqueOperators.size + uniqueOperands.size;
    const length = operators + operands;
    const difficulty = (uniqueOperators.size / 2) * (operands / uniqueOperands.size);
    const effort = difficulty * length;

    return {
      vocabulary,
      length,
      difficulty,
      effort
    };
  }

  private findPatternsInFile(file: FileAST, pattern: Pattern): PatternMatch[] {
    const matches: PatternMatch[] = [];
    
    // Simplified pattern matching - would need more sophisticated implementation
    if (typeof pattern.matcher === 'function') {
      // Function-based matching would require actual AST nodes
    } else {
      // RegExp-based matching would require source text
    }

    return matches;
  }
}