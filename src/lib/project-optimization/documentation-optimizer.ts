import {
  ProjectAST,
  FileAST,
  Issue,
  IssueType,
  IssueSeverity,
  SourceLocation,
  FunctionDeclaration,
  ClassDeclaration,
  MethodDeclaration,
  OptimizationResult,
  CodeChange,
  ChangeType,
  DocumentationIssue,
  DocumentationType
} from './types';

export interface DocumentationSyncResult {
  commentConsistencyIssues: DocumentationIssue[];
  missingApiDocumentation: DocumentationIssue[];
  invalidExamples: DocumentationIssue[];
  totalIssues: number;
}

export class DocumentationOptimizer {
  /**
   * Synchronize documentation with code implementation
   * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
   */
  public syncDocumentation(ast: ProjectAST): DocumentationSyncResult {
    const commentConsistencyIssues: DocumentationIssue[] = [];
    const missingApiDocumentation: DocumentationIssue[] = [];
    const invalidExamples: DocumentationIssue[] = [];

    for (const file of ast.files) {
      // Check comment-code consistency (Requirement 10.1)
      commentConsistencyIssues.push(...this.checkCommentConsistency(file));
      
      // Identify missing API documentation (Requirement 10.2)
      missingApiDocumentation.push(...this.identifyMissingApiDocumentation(file));
      
      // Verify example code correctness (Requirement 10.3)
      invalidExamples.push(...this.verifyExampleCodeCorrectness(file));
    }

    return {
      commentConsistencyIssues,
      missingApiDocumentation,
      invalidExamples,
      totalIssues: commentConsistencyIssues.length + missingApiDocumentation.length + invalidExamples.length
    };
  }

  /**
   * Check consistency between comments and code implementation
   * Requirement 10.1: WHEN checking comment accuracy THEN ensure comments match code implementation
   */
  private checkCommentConsistency(file: FileAST): DocumentationIssue[] {
    const issues: DocumentationIssue[] = [];
    
    // Check function documentation consistency
    for (const func of file.functions) {
      const docComment = this.extractJSDocComment(func);
      if (docComment) {
        // Check parameter documentation consistency
        const docParams = this.extractDocParameters(docComment);
        const actualParams = func.parameters.map(p => p.name);
        
        // Find parameters documented but not in function signature
        for (const docParam of docParams) {
          if (!actualParams.includes(docParam)) {
            issues.push({
              id: `doc-param-mismatch-${func.name}-${docParam}`,
              type: IssueType.DOCUMENTATION,
              severity: IssueSeverity.MEDIUM,
              location: this.getFunctionLocation(file, func),
              description: `Parameter '${docParam}' is documented but not present in function signature`,
              suggestion: `Remove documentation for '${docParam}' or add parameter to function`,
              documentationType: DocumentationType.INCONSISTENT_COMMENT,
              currentDocumentation: docComment,
              expectedDocumentation: this.generateExpectedFunctionDoc(func)
            });
          }
        }

        // Find parameters in function but not documented
        for (const actualParam of actualParams) {
          if (!docParams.includes(actualParam)) {
            issues.push({
              id: `doc-param-missing-${func.name}-${actualParam}`,
              type: IssueType.DOCUMENTATION,
              severity: IssueSeverity.MEDIUM,
              location: this.getFunctionLocation(file, func),
              description: `Parameter '${actualParam}' is not documented`,
              suggestion: `Add documentation for parameter '${actualParam}'`,
              documentationType: DocumentationType.MISSING_PARAM_DOC,
              currentDocumentation: docComment,
              expectedDocumentation: this.generateExpectedFunctionDoc(func)
            });
          }
        }

        // Check return type documentation
        if (func.returnType && func.returnType !== 'void' && !this.hasReturnDocumentation(docComment)) {
          issues.push({
            id: `doc-return-missing-${func.name}`,
            type: IssueType.DOCUMENTATION,
            severity: IssueSeverity.MEDIUM,
            location: this.getFunctionLocation(file, func),
            description: `Function returns ${func.returnType} but has no return documentation`,
            suggestion: `Add @returns documentation for the return value`,
            documentationType: DocumentationType.MISSING_RETURN_DOC,
            currentDocumentation: docComment,
            expectedDocumentation: this.generateExpectedFunctionDoc(func)
          });
        }
      }
    }

    // Check class documentation consistency
    for (const cls of file.classes) {
      const docComment = this.extractJSDocComment(cls);
      if (docComment) {
        // Check if documented methods exist
        const docMethods = this.extractDocMethods(docComment);
        const actualMethods = cls.methods.map(m => m.name);
        
        for (const docMethod of docMethods) {
          if (!actualMethods.includes(docMethod)) {
            issues.push({
              id: `doc-method-mismatch-${cls.name}-${docMethod}`,
              type: IssueType.DOCUMENTATION,
              severity: IssueSeverity.MEDIUM,
              location: this.getClassLocation(file, cls),
              description: `Method '${docMethod}' is documented but not present in class`,
              suggestion: `Remove documentation for '${docMethod}' or implement the method`,
              documentationType: DocumentationType.INCONSISTENT_COMMENT,
              currentDocumentation: docComment
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Identify missing API documentation for public functions and classes
   * Requirement 10.2: WHEN analyzing documentation completeness THEN identify missing important function and class docs
   */
  private identifyMissingApiDocumentation(file: FileAST): DocumentationIssue[] {
    const issues: DocumentationIssue[] = [];

    // Check for missing function documentation
    for (const func of file.functions) {
      if (this.isPublicFunction(func) && !this.hasDocumentation(func)) {
        issues.push({
          id: `missing-func-doc-${func.name}`,
          type: IssueType.DOCUMENTATION,
          severity: IssueSeverity.HIGH,
          location: this.getFunctionLocation(file, func),
          description: `Public function '${func.name}' is missing documentation`,
          suggestion: `Add JSDoc documentation for function '${func.name}'`,
          documentationType: DocumentationType.MISSING_FUNCTION_DOC,
          expectedDocumentation: this.generateExpectedFunctionDoc(func)
        });
      }
    }

    // Check for missing class documentation
    for (const cls of file.classes) {
      if (this.isPublicClass(cls) && !this.hasDocumentation(cls)) {
        issues.push({
          id: `missing-class-doc-${cls.name}`,
          type: IssueType.DOCUMENTATION,
          severity: IssueSeverity.HIGH,
          location: this.getClassLocation(file, cls),
          description: `Public class '${cls.name}' is missing documentation`,
          suggestion: `Add JSDoc documentation for class '${cls.name}'`,
          documentationType: DocumentationType.MISSING_CLASS_DOC,
          expectedDocumentation: this.generateExpectedClassDoc(cls)
        });
      }

      // Check for missing method documentation
      for (const method of cls.methods) {
        if (this.isPublicMethod(method) && !this.hasDocumentation(method)) {
          issues.push({
            id: `missing-method-doc-${cls.name}-${method.name}`,
            type: IssueType.DOCUMENTATION,
            severity: IssueSeverity.MEDIUM,
            location: this.getMethodLocation(file, cls, method),
            description: `Public method '${method.name}' in class '${cls.name}' is missing documentation`,
            suggestion: `Add JSDoc documentation for method '${method.name}'`,
            documentationType: DocumentationType.MISSING_METHOD_DOC,
            expectedDocumentation: this.generateExpectedMethodDoc(method)
          });
        }
      }
    }

    return issues;
  }

  /**
   * Verify example code correctness in documentation
   * Requirement 10.5: WHEN checking example code THEN ensure documentation examples can run normally
   */
  private verifyExampleCodeCorrectness(file: FileAST): DocumentationIssue[] {
    const issues: DocumentationIssue[] = [];

    // Extract code examples from JSDoc comments
    const codeExamples = this.extractCodeExamples(file);
    
    for (const example of codeExamples) {
      // Basic syntax validation
      if (!this.isValidJavaScriptSyntax(example.code)) {
        issues.push({
          id: `invalid-example-${example.location.line}`,
          type: IssueType.DOCUMENTATION,
          severity: IssueSeverity.MEDIUM,
          location: example.location,
          description: `Code example contains syntax errors`,
          suggestion: `Fix syntax errors in the code example`,
          documentationType: DocumentationType.INVALID_EXAMPLE,
          currentDocumentation: example.code
        });
      }

      // Check if example uses undefined variables/functions
      const undefinedReferences = this.findUndefinedReferences(example.code, file);
      for (const ref of undefinedReferences) {
        issues.push({
          id: `undefined-ref-example-${example.location.line}-${ref}`,
          type: IssueType.DOCUMENTATION,
          severity: IssueSeverity.LOW,
          location: example.location,
          description: `Code example references undefined '${ref}'`,
          suggestion: `Define '${ref}' or import it in the example`,
          documentationType: DocumentationType.INVALID_EXAMPLE,
          currentDocumentation: example.code
        });
      }
    }

    return issues;
  }

  /**
   * Generate optimization suggestions for documentation issues
   */
  public generateDocumentationOptimizations(issues: DocumentationIssue[]): OptimizationResult {
    const changes: CodeChange[] = [];
    const warnings: string[] = [];

    for (const issue of issues) {
      switch (issue.documentationType) {
        case DocumentationType.MISSING_FUNCTION_DOC:
        case DocumentationType.MISSING_CLASS_DOC:
        case DocumentationType.MISSING_METHOD_DOC:
          if (issue.expectedDocumentation) {
            changes.push({
              type: ChangeType.ADD,
              file: issue.location.file,
              original: '',
              modified: issue.expectedDocumentation,
              location: issue.location,
              description: `Add missing documentation: ${issue.description}`
            });
          }
          break;

        case DocumentationType.INCONSISTENT_COMMENT:
          if (issue.expectedDocumentation && issue.currentDocumentation) {
            changes.push({
              type: ChangeType.MODIFY,
              file: issue.location.file,
              original: issue.currentDocumentation,
              modified: issue.expectedDocumentation,
              location: issue.location,
              description: `Update inconsistent documentation: ${issue.description}`
            });
          }
          break;

        case DocumentationType.INVALID_EXAMPLE:
          warnings.push(`Manual review needed for invalid example at ${issue.location.file}:${issue.location.line}`);
          break;

        default:
          warnings.push(`Unhandled documentation issue type: ${issue.documentationType}`);
      }
    }

    return {
      success: true,
      changes,
      metrics: {
        filesProcessed: new Set(issues.map(i => i.location.file)).size,
        issuesFound: issues.length,
        issuesFixed: changes.length,
        linesRemoved: 0,
        duplicationsEliminated: 0,
        performanceImprovements: 0
      },
      warnings
    };
  }

  // Helper methods
  private extractJSDocComment(node: any): string | null {
    // This would extract JSDoc comments from AST nodes
    // Implementation depends on the AST parser being used
    return null; // Placeholder
  }

  private extractDocParameters(docComment: string): string[] {
    const paramMatches = docComment.match(/@param\s+\{[^}]*\}\s+(\w+)/g) || [];
    return paramMatches.map(match => {
      const paramMatch = match.match(/@param\s+\{[^}]*\}\s+(\w+)/);
      return paramMatch ? paramMatch[1] : '';
    }).filter(Boolean);
  }

  private extractDocMethods(docComment: string): string[] {
    const methodMatches = docComment.match(/@method\s+(\w+)/g) || [];
    return methodMatches.map(match => {
      const methodMatch = match.match(/@method\s+(\w+)/);
      return methodMatch ? methodMatch[1] : '';
    }).filter(Boolean);
  }

  private hasReturnDocumentation(docComment: string): boolean {
    return /@returns?\s/.test(docComment);
  }

  private isPublicFunction(func: FunctionDeclaration): boolean {
    // Consider functions public if they're exported or not prefixed with underscore
    return !func.name.startsWith('_');
  }

  private isPublicClass(cls: ClassDeclaration): boolean {
    // Consider classes public if they're exported or not prefixed with underscore
    return !cls.name.startsWith('_');
  }

  private isPublicMethod(method: MethodDeclaration): boolean {
    // Consider methods public if they're not private and not prefixed with underscore
    return !method.private && !method.name.startsWith('_');
  }

  private hasDocumentation(node: any): boolean {
    // Check if node has JSDoc documentation
    // This would check for JSDoc comments in the AST
    return false; // Placeholder
  }

  private generateExpectedFunctionDoc(func: FunctionDeclaration): string {
    let doc = `/**\n * ${func.name}\n`;
    
    for (const param of func.parameters) {
      const type = param.type || 'any';
      doc += ` * @param {${type}} ${param.name}\n`;
    }
    
    if (func.returnType && func.returnType !== 'void') {
      doc += ` * @returns {${func.returnType}}\n`;
    }
    
    doc += ' */';
    return doc;
  }

  private generateExpectedClassDoc(cls: ClassDeclaration): string {
    return `/**\n * ${cls.name}\n */`;
  }

  private generateExpectedMethodDoc(method: MethodDeclaration): string {
    let doc = `/**\n * ${method.name}\n`;
    
    for (const param of method.parameters) {
      const type = param.type || 'any';
      doc += ` * @param {${type}} ${param.name}\n`;
    }
    
    if (method.returnType && method.returnType !== 'void') {
      doc += ` * @returns {${method.returnType}}\n`;
    }
    
    doc += ' */';
    return doc;
  }

  private extractCodeExamples(file: FileAST): Array<{code: string, location: SourceLocation}> {
    // Extract @example blocks from JSDoc comments
    // This would parse the file content to find code examples
    return []; // Placeholder
  }

  private isValidJavaScriptSyntax(code: string): boolean {
    try {
      // Basic syntax validation using Function constructor
      new Function(code);
      return true;
    } catch {
      return false;
    }
  }

  private findUndefinedReferences(code: string, file: FileAST): string[] {
    // Find variables/functions referenced in code that aren't defined in the file
    const references: string[] = [];
    const identifierPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
    const matches = code.match(identifierPattern) || [];
    
    const definedNames = new Set([
      ...file.functions.map(f => f.name),
      ...file.classes.map(c => c.name),
      ...file.variables.map(v => v.name),
      // Add built-in JavaScript objects
      'console', 'window', 'document', 'Array', 'Object', 'String', 'Number', 'Boolean'
    ]);

    for (const match of matches) {
      if (!definedNames.has(match) && !references.includes(match)) {
        references.push(match);
      }
    }

    return references;
  }

  private getFunctionLocation(file: FileAST, func: FunctionDeclaration): SourceLocation {
    // This would get the actual location from the AST
    return {
      file: 'unknown', // Would be populated from file path
      line: 1,
      column: 1
    };
  }

  private getClassLocation(file: FileAST, cls: ClassDeclaration): SourceLocation {
    return {
      file: 'unknown',
      line: 1,
      column: 1
    };
  }

  private getMethodLocation(file: FileAST, cls: ClassDeclaration, method: MethodDeclaration): SourceLocation {
    return {
      file: 'unknown',
      line: 1,
      column: 1
    };
  }
}