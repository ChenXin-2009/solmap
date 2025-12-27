// SSOT Violation Detector Implementation
// Based on Spec-2 from .kiro/specs/solmap-ai-governance.md
// Detects violations of Single Source of Truth principle for physics/astronomy concepts

import {
  SSOTViolationDetector,
  AuthorityViolation,
  ConstantsViolation,
  ConceptUsage
} from './governance-interfaces';

import {
  DuplicateDefinition,
  PhysicsConstantViolation,
  PhysicsConcept,
  PhysicsConceptType,
  PhysicsConstantType,
  ViolationSeverity,
  ViolationType
} from './governance-types';

import {
  ProjectAST,
  SourceLocation,
  ModuleInfo,
  ImportDeclaration,
  VariableDeclaration
} from './types';

import {
  PhysicsConceptRegistry,
  createSourceLocation,
  isPhysicsConstantFile,
  getModuleLayer
} from './governance-core';

import * as fs from 'fs';
import * as path from 'path';

export class SSOTViolationDetectorImpl implements SSOTViolationDetector {
  private readonly authorityFiles = new Map<PhysicsConceptType, string>([
    [PhysicsConceptType.AXIAL_TILT, 'lib/astronomy/constants/axialTilt.ts'],
    [PhysicsConceptType.PHYSICAL_PARAMETER, 'lib/astronomy/constants/physicalParams.ts'],
    [PhysicsConceptType.RADIUS, 'lib/astronomy/constants/physicalParams.ts'],
    [PhysicsConceptType.MASS, 'lib/astronomy/constants/physicalParams.ts'],
    [PhysicsConceptType.GM, 'lib/astronomy/constants/physicalParams.ts'],
    [PhysicsConceptType.ROTATION_PERIOD, 'lib/astronomy/constants/rotation.ts'],
    [PhysicsConceptType.ORBITAL_PERIOD, 'lib/astronomy/constants/rotation.ts'],
    [PhysicsConceptType.REFERENCE_FRAME, 'lib/astronomy/constants/referenceFrames.ts']
  ]);

  private readonly physicsConceptPatterns = new Map<PhysicsConceptType, RegExp[]>([
    [PhysicsConceptType.AXIAL_TILT, [
      /axial.*tilt/i,
      /obliquity/i,
      /axis.*angle/i,
      /tilt.*angle/i,
      /23\.4.*deg/i, // Earth's axial tilt
      /23\.44/i
    ]],
    [PhysicsConceptType.PHYSICAL_PARAMETER, [
      /radius/i,
      /mass/i,
      /gm/i,
      /gravitational.*parameter/i,
      /6371.*km/i, // Earth radius
      /5\.972.*24/i // Earth mass
    ]],
    [PhysicsConceptType.ROTATION_PERIOD, [
      /rotation.*period/i,
      /sidereal.*day/i,
      /spin.*period/i,
      /24.*hour/i,
      /23\.93.*hour/i // Earth rotation period
    ]],
    [PhysicsConceptType.ORBITAL_PERIOD, [
      /orbital.*period/i,
      /year/i,
      /revolution.*period/i,
      /365\.25.*day/i
    ]],
    [PhysicsConceptType.REFERENCE_FRAME, [
      /j2000/i,
      /icrf/i,
      /ecliptic/i,
      /equatorial/i,
      /reference.*frame/i,
      /coordinate.*system/i
    ]]
  ]);

  /**
   * Detects duplicate definitions of physics concepts across the project
   * Validates that each physics concept has only one authority definition point
   */
  detectDuplicateDefinitions(ast: ProjectAST): DuplicateDefinition[] {
    const duplicates: DuplicateDefinition[] = [];
    const conceptDefinitions = new Map<string, SourceLocation[]>();

    // Scan all files for physics concept definitions
    for (let i = 0; i < ast.files.length; i++) {
      const fileAst = ast.files[i];
      const filePath = ast.modules[i]?.path || `file_${i}.ts`;
      
      const definitions = this.findPhysicsDefinitionsInFile(fileAst, filePath);
      
      for (const definition of definitions) {
        const conceptKey = `${definition.concept.type}:${definition.concept.name}`;
        
        if (!conceptDefinitions.has(conceptKey)) {
          conceptDefinitions.set(conceptKey, []);
        }
        
        conceptDefinitions.get(conceptKey)!.push(definition.location);
      }
    }

    // Check for duplicates
    for (const [conceptKey, locations] of conceptDefinitions) {
      if (locations.length > 1) {
        const [conceptType, conceptName] = conceptKey.split(':');
        const concept = this.createPhysicsConceptFromKey(conceptType as PhysicsConceptType, conceptName);
        
        // Determine which location is the authority (should be in constants directory)
        const authorityLocation = locations.find(loc => 
          isPhysicsConstantFile(loc.file)
        ) || locations[0];
        
        const duplicateLocations = locations.filter(loc => loc !== authorityLocation);
        
        if (duplicateLocations.length > 0) {
          duplicates.push({
            concept,
            authorityLocation,
            duplicateLocations,
            violationSeverity: this.calculateDuplicateDefinitionSeverity(concept, duplicateLocations)
          });
        }
      }
    }

    return duplicates;
  }

  /**
   * Validates that physics constants are imported from their authority sources
   */
  validatePhysicsConstants(ast: ProjectAST): PhysicsConstantViolation[] {
    const violations: PhysicsConstantViolation[] = [];

    for (let i = 0; i < ast.files.length; i++) {
      const fileAst = ast.files[i];
      const filePath = ast.modules[i]?.path || `file_${i}.ts`;
      
      // Skip authority files themselves
      if (isPhysicsConstantFile(filePath)) {
        continue;
      }

      const constantUsages = this.findPhysicsConstantUsage(fileAst, filePath);
      
      for (const usage of constantUsages) {
        const expectedSource = this.getExpectedAuthoritySource(usage.constantType);
        
        // Normalize both paths for comparison
        const normalizedActual = usage.actualSource.replace(/\.ts$/, '');
        const normalizedExpected = expectedSource.replace(/\.ts$/, '');
        
        // Check if the import source matches the expected authority source
        if (normalizedActual !== normalizedExpected) {
          violations.push({
            constantType: usage.constantType,
            expectedSource,
            actualSource: usage.actualSource,
            location: usage.location
          });
        }
      }
    }

    return violations;
  }

  /**
   * Checks that physics concepts are only defined in their authority files
   * Validates axialTilt.ts, physicalParams.ts, rotation.ts, referenceFrames.ts authority
   * Detects non-authority sources for physics data
   */
  checkAuthorityDefinitions(ast: ProjectAST): AuthorityViolation[] {
    const violations: AuthorityViolation[] = [];

    // Check each file for physics concept definitions
    for (let i = 0; i < ast.files.length; i++) {
      const fileAst = ast.files[i];
      const filePath = ast.modules[i]?.path || `file_${i}.ts`;
      
      const definitions = this.findPhysicsDefinitionsInFile(fileAst, filePath);
      
      for (const definition of definitions) {
        const expectedAuthority = this.authorityFiles.get(definition.concept.type);
        
        if (expectedAuthority && !definition.isAuthoritative) {
          // This is a non-authority definition of a physics concept
          violations.push({
            concept: definition.concept,
            expectedAuthority,
            actualSource: filePath,
            location: definition.location
          });
        }
      }

      // Check imports for non-authority physics data access
      const importViolations = this.checkNonAuthorityImports(fileAst, filePath);
      for (const violation of importViolations) {
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Validates that constants directory files contain only constants, no logic
   * Ensures authority files (axialTilt.ts, physicalParams.ts, rotation.ts, referenceFrames.ts) maintain purity
   */
  validateConstantsDirectory(constantsPath: string): ConstantsViolation[] {
    const violations: ConstantsViolation[] = [];

    if (!fs.existsSync(constantsPath)) {
      return violations;
    }

    const constantFiles = this.getConstantFiles(constantsPath);

    for (const filePath of constantFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Check general constants file purity
        const purityViolations = this.checkConstantsFilePurity(filePath, content);
        violations.push(...purityViolations);
        
        // Additional validation for authority files
        if (this.isAuthorityFile(filePath)) {
          const authorityViolations = this.validateAuthorityFilePurity(filePath, content);
          violations.push(...authorityViolations);
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return violations;
  }

  /**
   * Finds usage of physics concepts in the project
   */
  findPhysicsConceptUsage(ast: ProjectAST, concept: PhysicsConcept): ConceptUsage[] {
    const usages: ConceptUsage[] = [];

    for (const fileAst of ast.files) {
      const fileUsages = this.findConceptUsageInFile(fileAst, concept);
      usages.push(...fileUsages);
    }

    return usages;
  }

  /**
   * Validates that all physics data access goes through authority sources
   * Detects direct hardcoded values or imports from non-authority files
   */
  validatePhysicsDataAccess(ast: ProjectAST): AuthorityViolation[] {
    const violations: AuthorityViolation[] = [];

    for (let i = 0; i < ast.files.length; i++) {
      const fileAst = ast.files[i];
      const filePath = ast.modules[i]?.path || `file_${i}.ts`;
      
      // Skip authority files themselves
      if (isPhysicsConstantFile(filePath)) {
        continue;
      }

      // Check for hardcoded physics values
      const hardcodedViolations = this.detectHardcodedPhysicsValues(fileAst, filePath);
      violations.push(...hardcodedViolations);

      // Check for imports from non-authority sources
      const importViolations = this.checkNonAuthorityImports(fileAst, filePath);
      violations.push(...importViolations);
    }

    return violations;
  }

  /**
   * Detects hardcoded physics values that should come from authority sources
   */
  private detectHardcodedPhysicsValues(fileAst: any, filePath: string): AuthorityViolation[] {
    const violations: AuthorityViolation[] = [];
    
    // Common physics constants that are often hardcoded
    const suspiciousValues = [
      { value: 23.4, type: PhysicsConceptType.AXIAL_TILT, name: 'Earth axial tilt' },
      { value: 23.44, type: PhysicsConceptType.AXIAL_TILT, name: 'Earth axial tilt' },
      { value: 6371, type: PhysicsConceptType.RADIUS, name: 'Earth radius (km)' },
      { value: 6378, type: PhysicsConceptType.RADIUS, name: 'Earth equatorial radius (km)' },
      { value: 24, type: PhysicsConceptType.ROTATION_PERIOD, name: 'Earth rotation period (hours)' },
      { value: 23.93, type: PhysicsConceptType.ROTATION_PERIOD, name: 'Earth sidereal day (hours)' },
      { value: 365.25, type: PhysicsConceptType.ORBITAL_PERIOD, name: 'Earth orbital period (days)' }
    ];

    // This would require actual AST parsing to find numeric literals
    // For now, we'll check the file content as a string
    if (fileAst.content) {
      for (const suspicious of suspiciousValues) {
        if (fileAst.content.includes(suspicious.value.toString())) {
          const expectedAuthority = this.authorityFiles.get(suspicious.type) || '';
          
          violations.push({
            concept: {
              name: suspicious.name,
              type: suspicious.type,
              authoritySource: expectedAuthority,
              allowedUsagePatterns: [],
              forbiddenContexts: []
            },
            expectedAuthority,
            actualSource: 'hardcoded value',
            location: createSourceLocation(filePath, 1, 1)
          });
        }
      }
    }

    return violations;
  }

  // Private helper methods

  /**
   * Checks for imports from non-authority sources for physics data
   */
  private checkNonAuthorityImports(fileAst: any, filePath: string): AuthorityViolation[] {
    const violations: AuthorityViolation[] = [];

    if (!fileAst.imports) {
      return violations;
    }

    for (const importDecl of fileAst.imports) {
      const physicsConceptType = this.identifyPhysicsConstantTypeFromImport(importDecl);
      
      if (physicsConceptType) {
        const expectedAuthority = this.getExpectedAuthoritySource(physicsConceptType);
        
        // Check if import is from the correct authority source
        // Normalize both paths by removing .ts extension and comparing
        const normalizedSource = importDecl.source.replace(/\.ts$/, '');
        const normalizedAuthority = expectedAuthority.replace(/\.ts$/, '');
        
        // Allow exact match or if source is contained in authority path
        const isFromAuthority = normalizedSource === normalizedAuthority || 
                               normalizedAuthority.includes(normalizedSource);
        
        if (!isFromAuthority) {
          // Convert PhysicsConstantType to PhysicsConceptType
          const conceptType = physicsConceptType === PhysicsConstantType.AXIAL_TILT ? PhysicsConceptType.AXIAL_TILT :
                             physicsConceptType === PhysicsConstantType.PHYSICAL_PARAMS ? PhysicsConceptType.PHYSICAL_PARAMETER :
                             physicsConceptType === PhysicsConstantType.ROTATION ? PhysicsConceptType.ROTATION_PERIOD :
                             physicsConceptType === PhysicsConstantType.REFERENCE_FRAMES ? PhysicsConceptType.REFERENCE_FRAME :
                             PhysicsConceptType.PHYSICAL_PARAMETER;
          
          const concept = this.createPhysicsConceptFromImport(importDecl, conceptType);
          
          violations.push({
            concept,
            expectedAuthority,
            actualSource: importDecl.source,
            location: createSourceLocation(filePath, 1, 1)
          });
        }
      }
    }

    return violations;
  }

  /**
   * Validates that authority files (axialTilt.ts, physicalParams.ts, etc.) maintain purity
   */
  private validateAuthorityFilePurity(filePath: string, content: string): ConstantsViolation[] {
    const violations: ConstantsViolation[] = [];

    // Authority files should only contain constant definitions
    const authorityFileViolations = this.checkConstantsFilePurity(filePath, content);
    
    // Additional checks specific to authority files
    if (this.isAuthorityFile(filePath)) {
      // Check that all exports are properly frozen
      const exportPattern = /export\s+const\s+(\w+)/g;
      let match;
      
      while ((match = exportPattern.exec(content)) !== null) {
        const constantName = match[1];
        
        // Check if the constant is an object that should be frozen
        const objectDefPattern = new RegExp(`const\\s+${constantName}\\s*=\\s*\\{`, 'g');
        if (objectDefPattern.test(content)) {
          // Check if Object.freeze is used
          const freezePattern = new RegExp(`Object\\.freeze\\(${constantName}\\)`, 'g');
          if (!freezePattern.test(content)) {
            violations.push({
              file: filePath,
              violationType: 'unfrozen',
              description: `Authority file constant '${constantName}' should be frozen with Object.freeze()`,
              location: createSourceLocation(filePath, 1, 1)
            });
          }
        }
      }

      // Check for proper unit and reference frame documentation
      if (!content.includes('unit:') && !content.includes('Unit:')) {
        violations.push({
          file: filePath,
          violationType: 'logic',
          description: 'Authority file should document units for physical constants',
          location: createSourceLocation(filePath, 1, 1)
        });
      }
    }

    return violations;
  }

  /**
   * Checks if a file is one of the authority definition files
   */
  private isAuthorityFile(filePath: string): boolean {
    const authorityFiles = [
      'axialTilt.ts',
      'physicalParams.ts', 
      'rotation.ts',
      'referenceFrames.ts'
    ];
    
    return authorityFiles.some(file => filePath.endsWith(file));
  }

  /**
   * Maps PhysicsConceptType to PhysicsConstantType for authority validation
   */
  private mapPhysicsConceptToConstantType(conceptType: PhysicsConceptType): PhysicsConstantType {
    switch (conceptType) {
      case PhysicsConceptType.AXIAL_TILT:
        return PhysicsConstantType.AXIAL_TILT;
      case PhysicsConceptType.PHYSICAL_PARAMETER:
      case PhysicsConceptType.RADIUS:
      case PhysicsConceptType.MASS:
      case PhysicsConceptType.GM:
        return PhysicsConstantType.PHYSICAL_PARAMS;
      case PhysicsConceptType.ROTATION_PERIOD:
      case PhysicsConceptType.ORBITAL_PERIOD:
        return PhysicsConstantType.ROTATION;
      case PhysicsConceptType.REFERENCE_FRAME:
        return PhysicsConstantType.REFERENCE_FRAMES;
      default:
        return PhysicsConstantType.PHYSICAL_PARAMS;
    }
  }

  /**
   * Creates a PhysicsConcept from an import declaration
   */
  private createPhysicsConceptFromImport(importDecl: ImportDeclaration, type: PhysicsConceptType): PhysicsConcept {
    const authoritySource = this.authorityFiles.get(type) || '';
    
    // Extract concept name from import specifiers
    const conceptName = importDecl.specifiers?.[0]?.imported || 'unknown';
    
    return {
      name: conceptName,
      type,
      authoritySource,
      allowedUsagePatterns: [],
      forbiddenContexts: ['renderer']
    };
  }

  private findPhysicsDefinitionsInFile(fileAst: any, filePath: string): ConceptUsage[] {
    const definitions: ConceptUsage[] = [];

    // Check variable declarations for physics constants
    if (fileAst.variables) {
      for (const variable of fileAst.variables) {
        const conceptType = this.identifyPhysicsConceptType(variable.name, variable.value);
        
        if (conceptType) {
          const concept = this.createPhysicsConceptFromVariable(variable, conceptType);
          const isAuthoritative = isPhysicsConstantFile(filePath);
          
          definitions.push({
            concept,
            location: createSourceLocation(filePath, 1, 1), // Would need actual line/column from AST
            usageType: 'definition',
            isAuthoritative
          });
        }
      }
    }

    return definitions;
  }

  private findPhysicsConstantUsage(fileAst: any, filePath: string): Array<{
    constantType: PhysicsConstantType;
    actualSource: string;
    location: SourceLocation;
  }> {
    const usages: Array<{
      constantType: PhysicsConstantType;
      actualSource: string;
      location: SourceLocation;
    }> = [];

    // Check imports for physics constants
    if (fileAst.imports) {
      for (const importDecl of fileAst.imports) {
        const constantType = this.identifyPhysicsConstantTypeFromImport(importDecl);
        
        if (constantType) {
          usages.push({
            constantType,
            actualSource: importDecl.source,
            location: createSourceLocation(filePath, 1, 1) // Would need actual line/column
          });
        }
      }
    }

    return usages;
  }

  private findConceptUsageInFile(fileAst: any, concept: PhysicsConcept): ConceptUsage[] {
    const usages: ConceptUsage[] = [];

    // This would analyze the AST to find references to the concept
    // For now, return empty array - full implementation would require AST traversal
    
    return usages;
  }

  private identifyPhysicsConceptType(name: string, value?: any): PhysicsConceptType | null {
    const nameUpper = name.toUpperCase();

    // Check for axial tilt patterns
    if (nameUpper.includes('AXIAL') && nameUpper.includes('TILT') ||
        nameUpper.includes('OBLIQUITY') ||
        nameUpper.includes('AXIS_ANGLE')) {
      return PhysicsConceptType.AXIAL_TILT;
    }

    // Check for physical parameters
    if (nameUpper.includes('RADIUS') || nameUpper.includes('MASS') || nameUpper.includes('GM')) {
      return PhysicsConceptType.PHYSICAL_PARAMETER;
    }

    // Check for rotation periods
    if (nameUpper.includes('ROTATION') && nameUpper.includes('PERIOD') ||
        nameUpper.includes('SIDEREAL') ||
        nameUpper.includes('SPIN_PERIOD')) {
      return PhysicsConceptType.ROTATION_PERIOD;
    }

    // Check for orbital periods
    if (nameUpper.includes('ORBITAL') && nameUpper.includes('PERIOD') ||
        nameUpper.includes('YEAR') ||
        nameUpper.includes('REVOLUTION')) {
      return PhysicsConceptType.ORBITAL_PERIOD;
    }

    // Check for reference frames
    if (nameUpper.includes('FRAME') || nameUpper.includes('J2000') ||
        nameUpper.includes('ICRF') || nameUpper.includes('ECLIPTIC')) {
      return PhysicsConceptType.REFERENCE_FRAME;
    }

    return null;
  }

  private identifyPhysicsConstantTypeFromImport(importDecl: ImportDeclaration): PhysicsConstantType | null {
    const source = importDecl.source.toLowerCase();

    // Check import specifiers for physics constant names
    if (importDecl.specifiers) {
      for (const specifier of importDecl.specifiers) {
        const importedName = specifier.imported.toLowerCase();
        
        if (importedName.includes('axial') && importedName.includes('tilt')) {
          return PhysicsConstantType.AXIAL_TILT;
        }
        if (importedName.includes('radius') || importedName.includes('mass') || importedName.includes('gm')) {
          return PhysicsConstantType.PHYSICAL_PARAMS;
        }
        if (importedName.includes('rotation') && importedName.includes('period')) {
          return PhysicsConstantType.ROTATION;
        }
        if (importedName.includes('frame') || importedName.includes('j2000')) {
          return PhysicsConstantType.REFERENCE_FRAMES;
        }
      }
    }

    // Fallback to source path analysis
    if (source.includes('axialtilt')) {
      return PhysicsConstantType.AXIAL_TILT;
    }
    if (source.includes('physicalparams')) {
      return PhysicsConstantType.PHYSICAL_PARAMS;
    }
    if (source.includes('rotation')) {
      return PhysicsConstantType.ROTATION;
    }
    if (source.includes('referenceframes')) {
      return PhysicsConstantType.REFERENCE_FRAMES;
    }

    return null;
  }

  private createPhysicsConceptFromKey(type: PhysicsConceptType, name: string): PhysicsConcept {
    const authoritySource = this.authorityFiles.get(type) || '';
    
    return {
      name,
      type,
      authoritySource,
      allowedUsagePatterns: [],
      forbiddenContexts: ['renderer']
    };
  }

  private createPhysicsConceptFromVariable(variable: VariableDeclaration, type: PhysicsConceptType): PhysicsConcept {
    const authoritySource = this.authorityFiles.get(type) || '';
    
    return {
      name: variable.name,
      type,
      authoritySource,
      allowedUsagePatterns: [],
      forbiddenContexts: ['renderer']
    };
  }

  private getExpectedAuthoritySource(constantType: PhysicsConstantType): string {
    switch (constantType) {
      case PhysicsConstantType.AXIAL_TILT:
        return 'lib/astronomy/constants/axialTilt.ts';
      case PhysicsConstantType.PHYSICAL_PARAMS:
        return 'lib/astronomy/constants/physicalParams.ts';
      case PhysicsConstantType.ROTATION:
        return 'lib/astronomy/constants/rotation.ts';
      case PhysicsConstantType.REFERENCE_FRAMES:
        return 'lib/astronomy/constants/referenceFrames.ts';
      default:
        return '';
    }
  }

  private calculateDuplicateDefinitionSeverity(
    concept: PhysicsConcept,
    duplicateLocations: SourceLocation[]
  ): ViolationSeverity {
    // Critical if physics concept is duplicated
    if (concept.type === PhysicsConceptType.AXIAL_TILT ||
        concept.type === PhysicsConceptType.PHYSICAL_PARAMETER) {
      return ViolationSeverity.CRITICAL;
    }

    // High if multiple duplicates exist
    if (duplicateLocations.length > 2) {
      return ViolationSeverity.HIGH;
    }

    return ViolationSeverity.MEDIUM;
  }

  private getConstantFiles(constantsPath: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(constantsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.ts')) {
          files.push(path.join(constantsPath, entry.name));
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return files;
  }

  private checkConstantsFilePurity(filePath: string, content: string): ConstantsViolation[] {
    const violations: ConstantsViolation[] = [];

    // Check for function definitions (not allowed in constants files)
    if (content.includes('function ') || content.includes('=> ')) {
      violations.push({
        file: filePath,
        violationType: 'logic',
        description: 'Constants file contains function definitions',
        location: createSourceLocation(filePath, 1, 1)
      });
    }

    // Check for conditional logic (if statements, loops)
    if (content.includes('if (') || content.includes('for (') || content.includes('while (')) {
      violations.push({
        file: filePath,
        violationType: 'logic',
        description: 'Constants file contains conditional logic',
        location: createSourceLocation(filePath, 1, 1)
      });
    }

    // Check for computations (mathematical operations in assignments)
    const computationPattern = /=\s*[^;]*[\+\-\*\/\%]/;
    if (computationPattern.test(content)) {
      violations.push({
        file: filePath,
        violationType: 'computation',
        description: 'Constants file contains computational logic',
        location: createSourceLocation(filePath, 1, 1)
      });
    }

    // Check for unfrozen objects (should use Object.freeze)
    const objectPattern = /export\s+const\s+\w+\s*=\s*\{[^}]*\}/g;
    const matches = content.match(objectPattern);
    if (matches) {
      for (const match of matches) {
        if (!content.includes(`Object.freeze(${match.split('=')[0].trim().split(' ').pop()})`)) {
          violations.push({
            file: filePath,
            violationType: 'unfrozen',
            description: 'Constants file contains unfrozen objects',
            location: createSourceLocation(filePath, 1, 1)
          });
        }
      }
    }

    return violations;
  }
}