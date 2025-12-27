// Architecture rule engine implementation
import { 
  ProjectAST, 
  ArchitectureIssue, 
  FileAST,
  ModuleInfo,
  DependencyGraph,
  SourceLocation,
  IssueType,
  IssueSeverity,
  ImportDeclaration,
  DependencyInfo
} from './types';
import { ArchitectureRule } from './interfaces';

export interface ArchitectureRuleEngine {
  validateLayerSeparation(ast: ProjectAST, rules: LayerSeparationRule[]): ArchitectureIssue[];
  validateDependencyDirection(ast: ProjectAST, dependencyGraph: DependencyGraph, rules: DependencyRule[]): ArchitectureIssue[];
  validateInterfaceImplementation(ast: ProjectAST, rules: InterfaceRule[]): ArchitectureIssue[];
  validateSingleResponsibility(ast: ProjectAST, rules: ResponsibilityRule[]): ArchitectureIssue[];
  validateNamingConsistency(ast: ProjectAST, rules: NamingRule[]): ArchitectureIssue[];
}

export interface LayerSeparationRule {
  name: string;
  description: string;
  layerPattern: RegExp;
  allowedDependencies: RegExp[];
  forbiddenDependencies: RegExp[];
  severity: IssueSeverity;
}

export interface DependencyRule {
  name: string;
  description: string;
  sourcePattern: RegExp;
  targetPattern: RegExp;
  direction: 'allowed' | 'forbidden';
  severity: IssueSeverity;
}

export interface InterfaceRule {
  name: string;
  description: string;
  interfacePattern: RegExp;
  requiredMethods: string[];
  requiredProperties: string[];
  severity: IssueSeverity;
}

export interface ResponsibilityRule {
  name: string;
  description: string;
  classPattern: RegExp;
  maxMethods: number;
  maxProperties: number;
  maxComplexity: number;
  severity: IssueSeverity;
}

export interface NamingRule {
  name: string;
  description: string;
  targetType: 'file' | 'class' | 'function' | 'variable' | 'interface';
  pattern: RegExp;
  severity: IssueSeverity;
}

export class ProjectArchitectureRuleEngine implements ArchitectureRuleEngine {
  
  validateLayerSeparation(ast: ProjectAST, rules: LayerSeparationRule[]): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];
    
    for (const rule of rules) {
      for (const file of ast.files) {
        // Check if file belongs to this layer
        if (rule.layerPattern.test(file.sourceType)) {
          // Check imports for layer violations
          for (const importDecl of file.imports) {
            const importPath = importDecl.source;
            
            // Check if import is forbidden
            const isForbidden = rule.forbiddenDependencies.some(pattern => 
              pattern.test(importPath)
            );
            
            if (isForbidden) {
              issues.push({
                id: `layer_violation_${file.sourceType}_${importPath}`,
                type: IssueType.ARCHITECTURE,
                severity: rule.severity,
                location: {
                  file: file.sourceType,
                  line: 1, // Would need actual line numbers from parser
                  column: 1
                },
                description: `Layer separation violation: ${rule.description}`,
                suggestion: `Remove or refactor dependency from ${file.sourceType} to ${importPath}`,
                violatedRule: rule.name,
                expectedPattern: `Layer should only depend on: ${rule.allowedDependencies.map(p => p.source).join(', ')}`,
                actualPattern: `Found dependency on: ${importPath}`
              });
            }
            
            // Check if import is allowed (if allowedDependencies is specified)
            if (rule.allowedDependencies.length > 0) {
              const isAllowed = rule.allowedDependencies.some(pattern => 
                pattern.test(importPath)
              );
              
              if (!isAllowed && !this.isStandardLibrary(importPath)) {
                issues.push({
                  id: `layer_not_allowed_${file.sourceType}_${importPath}`,
                  type: IssueType.ARCHITECTURE,
                  severity: rule.severity,
                  location: {
                    file: file.sourceType,
                    line: 1,
                    column: 1
                  },
                  description: `Layer dependency not in allowed list: ${rule.description}`,
                  suggestion: `Ensure dependency ${importPath} is allowed for this layer`,
                  violatedRule: rule.name,
                  expectedPattern: `Layer should only depend on: ${rule.allowedDependencies.map(p => p.source).join(', ')}`,
                  actualPattern: `Found dependency on: ${importPath}`
                });
              }
            }
          }
        }
      }
    }
    
    return issues;
  }

  validateDependencyDirection(ast: ProjectAST, dependencyGraph: DependencyGraph, rules: DependencyRule[]): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];
    
    for (const rule of rules) {
      for (const edge of dependencyGraph.edges) {
        const sourceNode = dependencyGraph.nodes.find(n => n.id === edge.from);
        const targetNode = dependencyGraph.nodes.find(n => n.id === edge.to);
        
        if (!sourceNode || !targetNode) continue;
        
        const sourceMatches = rule.sourcePattern.test(sourceNode.name);
        const targetMatches = rule.targetPattern.test(targetNode.name);
        
        if (sourceMatches && targetMatches) {
          if (rule.direction === 'forbidden') {
            issues.push({
              id: `dependency_direction_${edge.from}_${edge.to}`,
              type: IssueType.ARCHITECTURE,
              severity: rule.severity,
              location: {
                file: sourceNode.name,
                line: 1,
                column: 1
              },
              description: `Forbidden dependency direction: ${rule.description}`,
              suggestion: `Refactor to remove dependency from ${sourceNode.name} to ${targetNode.name}`,
              violatedRule: rule.name,
              expectedPattern: `${rule.sourcePattern.source} should not depend on ${rule.targetPattern.source}`,
              actualPattern: `Found dependency from ${sourceNode.name} to ${targetNode.name}`
            });
          }
        }
      }
    }
    
    // Check for circular dependencies
    for (const cycle of dependencyGraph.cycles) {
      if (cycle.length > 1) {
        const cycleDescription = cycle.join(' -> ') + ' -> ' + cycle[0];
        
        issues.push({
          id: `circular_dependency_${cycle.join('_')}`,
          type: IssueType.ARCHITECTURE,
          severity: IssueSeverity.HIGH,
          location: {
            file: cycle[0],
            line: 1,
            column: 1
          },
          description: `Circular dependency detected: ${cycleDescription}`,
          suggestion: `Break the circular dependency by introducing interfaces or refactoring`,
          violatedRule: 'No Circular Dependencies',
          expectedPattern: 'Acyclic dependency graph',
          actualPattern: `Circular dependency: ${cycleDescription}`
        });
      }
    }
    
    return issues;
  }

  validateInterfaceImplementation(ast: ProjectAST, rules: InterfaceRule[]): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];
    
    for (const rule of rules) {
      for (const file of ast.files) {
        for (const cls of file.classes) {
          // Check if class should implement this interface
          if (rule.interfacePattern.test(cls.name)) {
            // Check required methods
            for (const requiredMethod of rule.requiredMethods) {
              const hasMethod = cls.methods.some(method => method.name === requiredMethod);
              
              if (!hasMethod) {
                issues.push({
                  id: `missing_method_${file.sourceType}_${cls.name}_${requiredMethod}`,
                  type: IssueType.ARCHITECTURE,
                  severity: rule.severity,
                  location: {
                    file: file.sourceType,
                    line: 1,
                    column: 1
                  },
                  description: `Missing required method: ${requiredMethod} in class ${cls.name}`,
                  suggestion: `Implement required method ${requiredMethod} in class ${cls.name}`,
                  violatedRule: rule.name,
                  expectedPattern: `Class should implement method: ${requiredMethod}`,
                  actualPattern: `Method ${requiredMethod} not found in class ${cls.name}`
                });
              }
            }
            
            // Check required properties
            for (const requiredProperty of rule.requiredProperties) {
              const hasProperty = cls.properties.some(prop => prop.name === requiredProperty);
              
              if (!hasProperty) {
                issues.push({
                  id: `missing_property_${file.sourceType}_${cls.name}_${requiredProperty}`,
                  type: IssueType.ARCHITECTURE,
                  severity: rule.severity,
                  location: {
                    file: file.sourceType,
                    line: 1,
                    column: 1
                  },
                  description: `Missing required property: ${requiredProperty} in class ${cls.name}`,
                  suggestion: `Add required property ${requiredProperty} to class ${cls.name}`,
                  violatedRule: rule.name,
                  expectedPattern: `Class should have property: ${requiredProperty}`,
                  actualPattern: `Property ${requiredProperty} not found in class ${cls.name}`
                });
              }
            }
          }
        }
      }
    }
    
    return issues;
  }

  validateSingleResponsibility(ast: ProjectAST, rules: ResponsibilityRule[]): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];
    
    for (const rule of rules) {
      for (const file of ast.files) {
        for (const cls of file.classes) {
          // Check if class matches the pattern
          if (rule.classPattern.test(cls.name)) {
            // Check method count
            if (cls.methods.length > rule.maxMethods) {
              issues.push({
                id: `too_many_methods_${file.sourceType}_${cls.name}`,
                type: IssueType.ARCHITECTURE,
                severity: rule.severity,
                location: {
                  file: file.sourceType,
                  line: 1,
                  column: 1
                },
                description: `Class ${cls.name} has too many methods (${cls.methods.length} > ${rule.maxMethods})`,
                suggestion: `Consider splitting class ${cls.name} into smaller, more focused classes`,
                violatedRule: rule.name,
                expectedPattern: `Class should have at most ${rule.maxMethods} methods`,
                actualPattern: `Class has ${cls.methods.length} methods`
              });
            }
            
            // Check property count
            if (cls.properties.length > rule.maxProperties) {
              issues.push({
                id: `too_many_properties_${file.sourceType}_${cls.name}`,
                type: IssueType.ARCHITECTURE,
                severity: rule.severity,
                location: {
                  file: file.sourceType,
                  line: 1,
                  column: 1
                },
                description: `Class ${cls.name} has too many properties (${cls.properties.length} > ${rule.maxProperties})`,
                suggestion: `Consider splitting class ${cls.name} or using composition`,
                violatedRule: rule.name,
                expectedPattern: `Class should have at most ${rule.maxProperties} properties`,
                actualPattern: `Class has ${cls.properties.length} properties`
              });
            }
            
            // Check complexity (simplified - count methods + properties)
            const complexity = cls.methods.length + cls.properties.length;
            if (complexity > rule.maxComplexity) {
              issues.push({
                id: `high_complexity_${file.sourceType}_${cls.name}`,
                type: IssueType.ARCHITECTURE,
                severity: rule.severity,
                location: {
                  file: file.sourceType,
                  line: 1,
                  column: 1
                },
                description: `Class ${cls.name} has high complexity (${complexity} > ${rule.maxComplexity})`,
                suggestion: `Refactor class ${cls.name} to reduce complexity and improve maintainability`,
                violatedRule: rule.name,
                expectedPattern: `Class complexity should be at most ${rule.maxComplexity}`,
                actualPattern: `Class complexity is ${complexity}`
              });
            }
          }
        }
      }
    }
    
    return issues;
  }

  validateNamingConsistency(ast: ProjectAST, rules: NamingRule[]): ArchitectureIssue[] {
    const issues: ArchitectureIssue[] = [];
    
    for (const rule of rules) {
      for (const file of ast.files) {
        switch (rule.targetType) {
          case 'file':
            if (!rule.pattern.test(file.sourceType)) {
              issues.push({
                id: `naming_file_${file.sourceType}`,
                type: IssueType.ARCHITECTURE,
                severity: rule.severity,
                location: {
                  file: file.sourceType,
                  line: 1,
                  column: 1
                },
                description: `File name doesn't follow naming convention: ${rule.description}`,
                suggestion: `Rename file to follow the pattern: ${rule.pattern.source}`,
                violatedRule: rule.name,
                expectedPattern: rule.pattern.source,
                actualPattern: file.sourceType
              });
            }
            break;
            
          case 'class':
            for (const cls of file.classes) {
              if (!rule.pattern.test(cls.name)) {
                issues.push({
                  id: `naming_class_${file.sourceType}_${cls.name}`,
                  type: IssueType.ARCHITECTURE,
                  severity: rule.severity,
                  location: {
                    file: file.sourceType,
                    line: 1,
                    column: 1
                  },
                  description: `Class name doesn't follow naming convention: ${rule.description}`,
                  suggestion: `Rename class ${cls.name} to follow the pattern: ${rule.pattern.source}`,
                  violatedRule: rule.name,
                  expectedPattern: rule.pattern.source,
                  actualPattern: cls.name
                });
              }
            }
            break;
            
          case 'function':
            for (const func of file.functions) {
              if (!rule.pattern.test(func.name)) {
                issues.push({
                  id: `naming_function_${file.sourceType}_${func.name}`,
                  type: IssueType.ARCHITECTURE,
                  severity: rule.severity,
                  location: {
                    file: file.sourceType,
                    line: 1,
                    column: 1
                  },
                  description: `Function name doesn't follow naming convention: ${rule.description}`,
                  suggestion: `Rename function ${func.name} to follow the pattern: ${rule.pattern.source}`,
                  violatedRule: rule.name,
                  expectedPattern: rule.pattern.source,
                  actualPattern: func.name
                });
              }
            }
            break;
            
          case 'variable':
            for (const variable of file.variables) {
              if (!rule.pattern.test(variable.name)) {
                issues.push({
                  id: `naming_variable_${file.sourceType}_${variable.name}`,
                  type: IssueType.ARCHITECTURE,
                  severity: rule.severity,
                  location: {
                    file: file.sourceType,
                    line: 1,
                    column: 1
                  },
                  description: `Variable name doesn't follow naming convention: ${rule.description}`,
                  suggestion: `Rename variable ${variable.name} to follow the pattern: ${rule.pattern.source}`,
                  violatedRule: rule.name,
                  expectedPattern: rule.pattern.source,
                  actualPattern: variable.name
                });
              }
            }
            break;
            
          case 'interface':
            // Check for interface-like classes or types
            for (const cls of file.classes) {
              if (cls.name.startsWith('I') || cls.name.endsWith('Interface')) {
                if (!rule.pattern.test(cls.name)) {
                  issues.push({
                    id: `naming_interface_${file.sourceType}_${cls.name}`,
                    type: IssueType.ARCHITECTURE,
                    severity: rule.severity,
                    location: {
                      file: file.sourceType,
                      line: 1,
                      column: 1
                    },
                    description: `Interface name doesn't follow naming convention: ${rule.description}`,
                    suggestion: `Rename interface ${cls.name} to follow the pattern: ${rule.pattern.source}`,
                    violatedRule: rule.name,
                    expectedPattern: rule.pattern.source,
                    actualPattern: cls.name
                  });
                }
              }
            }
            break;
        }
      }
    }
    
    return issues;
  }

  /**
   * Check if import path is a standard library (Node.js, browser APIs, etc.)
   */
  private isStandardLibrary(importPath: string): boolean {
    const standardLibraries = [
      // Node.js built-in modules
      'fs', 'path', 'http', 'https', 'url', 'crypto', 'os', 'util', 'events',
      'stream', 'buffer', 'child_process', 'cluster', 'dgram', 'dns', 'net',
      'readline', 'repl', 'tls', 'tty', 'vm', 'zlib', 'assert', 'console',
      
      // Browser APIs (common ones)
      'window', 'document', 'navigator', 'location', 'history',
      
      // Common external libraries that are usually allowed
      'react', 'react-dom', 'react-router', 'react-router-dom',
      'lodash', 'moment', 'axios', 'fetch',
      'three', 'three.js',
      '@types/', 'types/'
    ];
    
    return standardLibraries.some(lib => 
      importPath === lib || 
      importPath.startsWith(lib + '/') ||
      importPath.startsWith('@types/') ||
      importPath.startsWith('types/')
    );
  }
}

/**
 * Default architecture rules for SolMap project
 */
export const DEFAULT_SOLMAP_ARCHITECTURE_RULES = {
  layerSeparation: [
    {
      name: 'Rendering Layer Isolation',
      description: 'Rendering layer should not directly access physics calculations',
      layerPattern: /src\/components\/canvas\/3d/,
      allowedDependencies: [
        /src\/lib\/3d/,
        /src\/lib\/types/,
        /src\/lib\/config/,
        /react/,
        /three/,
        /@types/
      ],
      forbiddenDependencies: [
        /src\/lib\/astronomy/,
        /src\/lib\/axial-tilt/,
        /src\/lib\/space-time-foundation/
      ],
      severity: IssueSeverity.HIGH
    },
    {
      name: 'Physics Layer Isolation',
      description: 'Physics calculations should not depend on UI components',
      layerPattern: /src\/lib\/(astronomy|axial-tilt|space-time-foundation)/,
      allowedDependencies: [
        /src\/lib\/types/,
        /src\/lib\/config/,
        /@types/
      ],
      forbiddenDependencies: [
        /src\/components/,
        /react/,
        /three/
      ],
      severity: IssueSeverity.CRITICAL
    },
    {
      name: '3D Layer Isolation',
      description: '3D rendering utilities should not depend on React directly',
      layerPattern: /src\/lib\/3d/,
      allowedDependencies: [
        /src\/lib\/types/,
        /src\/lib\/config/,
        /three/,
        /@types/
      ],
      forbiddenDependencies: [
        /react/
      ],
      severity: IssueSeverity.HIGH
    },
    {
      name: 'Infrastructure Layer Isolation',
      description: 'Infrastructure should be independent of business logic',
      layerPattern: /src\/lib\/infrastructure/,
      allowedDependencies: [
        /src\/lib\/types/,
        /@types/
      ],
      forbiddenDependencies: [
        /src\/components/,
        /src\/lib\/(astronomy|axial-tilt|3d)/,
        /react/,
        /three/
      ],
      severity: IssueSeverity.HIGH
    },
    {
      name: 'General Library Layer Isolation',
      description: 'Library modules should not depend on UI frameworks',
      layerPattern: /src\/lib/,
      allowedDependencies: [
        /src\/lib/,
        /@types/,
        /three/,
        /lodash/,
        /moment/,
        /axios/
      ],
      forbiddenDependencies: [
        /react/
      ],
      severity: IssueSeverity.MEDIUM
    }
  ],
  
  dependencyDirection: [
    {
      name: 'UI depends on Logic',
      description: 'UI components should depend on business logic, not vice versa',
      sourcePattern: /src\/lib/,
      targetPattern: /src\/components/,
      direction: 'forbidden' as const,
      severity: IssueSeverity.CRITICAL
    },
    {
      name: 'High-level depends on Low-level',
      description: 'High-level modules should not depend on low-level implementation details',
      sourcePattern: /src\/lib\/(astronomy|space-time-foundation)/,
      targetPattern: /src\/lib\/3d/,
      direction: 'forbidden' as const,
      severity: IssueSeverity.HIGH
    }
  ],
  
  interfaceImplementation: [
    {
      name: 'Manager Interface',
      description: 'All manager classes should implement standard management methods',
      interfacePattern: /Manager$/,
      requiredMethods: ['initialize', 'cleanup'],
      requiredProperties: [],
      severity: IssueSeverity.MEDIUM
    },
    {
      name: 'Controller Interface',
      description: 'All controller classes should implement standard control methods',
      interfacePattern: /Controller$/,
      requiredMethods: ['update'],
      requiredProperties: [],
      severity: IssueSeverity.MEDIUM
    }
  ],
  
  singleResponsibility: [
    {
      name: 'Class Size Limit',
      description: 'Classes should not be too large to maintain single responsibility',
      classPattern: /.*/,
      maxMethods: 15,
      maxProperties: 10,
      maxComplexity: 20,
      severity: IssueSeverity.MEDIUM
    },
    {
      name: 'Manager Class Limit',
      description: 'Manager classes should be focused and not too complex',
      classPattern: /Manager$/,
      maxMethods: 10,
      maxProperties: 8,
      maxComplexity: 15,
      severity: IssueSeverity.HIGH
    }
  ],
  
  namingConsistency: [
    {
      name: 'Component File Naming',
      description: 'React component files should use PascalCase',
      targetType: 'file' as const,
      pattern: /^[A-Z][a-zA-Z0-9]*\.(tsx|jsx)$/,
      severity: IssueSeverity.LOW
    },
    {
      name: 'Class Naming',
      description: 'Classes should use PascalCase',
      targetType: 'class' as const,
      pattern: /^[A-Z][a-zA-Z0-9]*$/,
      severity: IssueSeverity.MEDIUM
    },
    {
      name: 'Function Naming',
      description: 'Functions should use camelCase',
      targetType: 'function' as const,
      pattern: /^[a-z][a-zA-Z0-9]*$/,
      severity: IssueSeverity.LOW
    },
    {
      name: 'Variable Naming',
      description: 'Variables should use camelCase',
      targetType: 'variable' as const,
      pattern: /^[a-z][a-zA-Z0-9]*$/,
      severity: IssueSeverity.LOW
    },
    {
      name: 'Interface Naming',
      description: 'Interfaces should start with I or end with Interface',
      targetType: 'interface' as const,
      pattern: /^(I[A-Z][a-zA-Z0-9]*|[A-Z][a-zA-Z0-9]*Interface)$/,
      severity: IssueSeverity.MEDIUM
    }
  ]
};