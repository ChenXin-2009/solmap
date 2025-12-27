// Magic Number Detector for SolMap Governance Compliance
// Implements Spec-4: Magic Number Elimination from .kiro/specs/solmap-ai-governance.md

import * as ts from 'typescript';
import { 
  MagicNumberDetector as IMagicNumberDetector,
  ConstantUsage,
  ConstantSourceViolation,
  NumericValue,
  UnitClarityViolation,
  ConfigurationViolation
} from './governance-interfaces';
import {
  MagicNumberViolation,
  PhysicsConstantType,
  ViolationType,
  ViolationSeverity
} from './governance-types';
import { ProjectAST, SourceLocation } from './types';

export class MagicNumberDetector implements IMagicNumberDetector {
  private readonly PHYSICS_CONSTANTS = {
    // Common physics constants that should come from authority files
    ANGLES: [0, 23.44, 90, 180, 270, 360, Math.PI, Math.PI/2, Math.PI/4, 2*Math.PI],
    PERIODS: [24, 365.25, 687, 11.86, 29.46, 84.01, 164.8], // hours/years for planets
    SCALE_FACTORS: [1000, 10000, 100000, 1000000], // common scaling factors
    PHYSICS_VALUES: [9.81, 6.67430e-11, 299792458], // g, G, c
  };

  private readonly AUTHORITY_SOURCES = {
    [PhysicsConstantType.AXIAL_TILT]: 'lib/astronomy/constants/axialTilt.ts',
    [PhysicsConstantType.PHYSICAL_PARAMS]: 'lib/astronomy/constants/physicalParams.ts',
    [PhysicsConstantType.ROTATION]: 'lib/astronomy/constants/rotation.ts',
    [PhysicsConstantType.REFERENCE_FRAMES]: 'lib/astronomy/constants/referenceFrames.ts',
  };

  private readonly SUSPICIOUS_PATTERNS = [
    /\b\d+\.?\d*\s*\*\s*Math\.PI\b/, // angle calculations
    /\b\d+\.?\d*\s*\/\s*180\s*\*\s*Math\.PI\b/, // degree to radian
    /\b\d+\.?\d*\s*\*\s*180\s*\/\s*Math\.PI\b/, // radian to degree
    /\b(24|365\.25|687|11\.86|29\.46|84\.01|164\.8)\b/, // planetary periods
    /\b(23\.44|25\.19|177\.36|3\.13|26\.73|97\.77|28\.32)\b/, // axial tilts
  ];

  detectHardcodedConstants(ast: ProjectAST): MagicNumberViolation[] {
    const violations: MagicNumberViolation[] = [];

    for (let i = 0; i < ast.files.length; i++) {
      const fileAst = ast.files[i];
      // We need to get the file path from somewhere else, perhaps from modules
      const filePath = ast.modules[i]?.path || `file_${i}.ts`;

      const sourceFile = ts.createSourceFile(
        filePath,
        '', // We'll need the actual content
        ts.ScriptTarget.Latest,
        true
      );

      // Skip constants files - they're allowed to have hardcoded values
      if (this.isConstantsFile(filePath)) {
        continue;
      }

      const fileViolations = this.scanFileForMagicNumbers(fileAst, sourceFile, filePath);
      violations.push(...fileViolations);
    }

    return violations;
  }

  validateConstantSources(constants: ConstantUsage[]): ConstantSourceViolation[] {
    const violations: ConstantSourceViolation[] = [];

    for (const constant of constants) {
      const expectedSource = this.getExpectedSource(constant);
      if (expectedSource && constant.source !== expectedSource) {
        violations.push({
          constantName: constant.name,
          expectedSource,
          actualSource: constant.source,
          location: constant.location,
        });
      }
    }

    return violations;
  }

  checkUnitClarity(values: NumericValue[]): UnitClarityViolation[] {
    const violations: UnitClarityViolation[] = [];

    for (const value of values) {
      const violation = this.checkValueUnitClarity(value);
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  detectConfigurationValues(ast: ProjectAST): ConfigurationViolation[] {
    const violations: ConfigurationViolation[] = [];

    for (let i = 0; i < ast.files.length; i++) {
      const fileAst = ast.files[i];
      const filePath = ast.modules[i]?.path || `file_${i}.ts`;
      
      // Look for configuration objects and hardcoded values
      const configViolations = this.scanForConfigurationIssues(fileAst, filePath);
      violations.push(...configViolations);
    }

    return violations;
  }

  suggestAuthoritySource(value: number | string, context: string): string {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    // Check context for hints first (more specific)
    if (context.toLowerCase().includes('frame') || context.toLowerCase().includes('reference') || context.toLowerCase().includes('coordinate')) {
      return this.AUTHORITY_SOURCES[PhysicsConstantType.REFERENCE_FRAMES];
    }

    if (context.toLowerCase().includes('tilt') || context.toLowerCase().includes('axis')) {
      return this.AUTHORITY_SOURCES[PhysicsConstantType.AXIAL_TILT];
    }

    if (context.toLowerCase().includes('period') || context.toLowerCase().includes('rotation')) {
      return this.AUTHORITY_SOURCES[PhysicsConstantType.ROTATION];
    }

    if (context.toLowerCase().includes('radius') || context.toLowerCase().includes('mass')) {
      return this.AUTHORITY_SOURCES[PhysicsConstantType.PHYSICAL_PARAMS];
    }

    // Then check if it's a known physics constant
    if (this.PHYSICS_CONSTANTS.ANGLES.includes(numValue)) {
      return this.AUTHORITY_SOURCES[PhysicsConstantType.AXIAL_TILT];
    }

    if (this.PHYSICS_CONSTANTS.PERIODS.includes(numValue)) {
      return this.AUTHORITY_SOURCES[PhysicsConstantType.ROTATION];
    }

    // Default to physical params for numeric constants
    return this.AUTHORITY_SOURCES[PhysicsConstantType.PHYSICAL_PARAMS];
  }

  private scanFileForMagicNumbers(fileAst: any, sourceFile: ts.SourceFile, filePath: string): MagicNumberViolation[] {
    const violations: MagicNumberViolation[] = [];

    const visit = (node: ts.Node) => {
      // Check numeric literals
      if (ts.isNumericLiteral(node)) {
        const violation = this.checkNumericLiteral(node, filePath);
        if (violation) {
          violations.push(violation);
        }
      }

      // Check string literals that might contain numeric values
      if (ts.isStringLiteral(node)) {
        const violation = this.checkStringLiteral(node, filePath);
        if (violation) {
          violations.push(violation);
        }
      }

      // Check binary expressions (calculations)
      if (ts.isBinaryExpression(node)) {
        const violation = this.checkBinaryExpression(node, filePath);
        if (violation) {
          violations.push(violation);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return violations;
  }

  private checkNumericLiteral(node: ts.NumericLiteral, filePath: string): MagicNumberViolation | null {
    const value = parseFloat(node.text);
    
    // Skip common non-magic numbers
    if (this.isCommonNonMagicNumber(value)) {
      return null;
    }

    // Check if it's a suspicious physics constant
    if (this.isSuspiciousPhysicsConstant(value)) {
      const context = this.getNodeContext(node);
      return {
        specNumber: 'Spec-4',
        violationType: ViolationType.MAGIC_NUMBER,
        location: this.getSourceLocation(node, filePath),
        description: `Hardcoded physics constant ${value} detected`,
        governanceReference: 'Spec-4: Magic Number Elimination',
        severity: ViolationSeverity.HIGH,
        detectedAt: new Date(),
        fixAttempts: 0,
        value,
        suspectedType: this.guessSuspectedType(value, context),
        suggestedSource: this.suggestAuthoritySource(value, context),
        context,
      };
    }

    return null;
  }

  private checkStringLiteral(node: ts.StringLiteral, filePath: string): MagicNumberViolation | null {
    const text = node.text;
    
    // Check for numeric strings that might be physics constants
    const numericMatch = text.match(/^\d+\.?\d*$/);
    if (numericMatch) {
      const value = parseFloat(text);
      if (this.isSuspiciousPhysicsConstant(value)) {
        const context = this.getNodeContext(node);
        return {
          specNumber: 'Spec-4',
          violationType: ViolationType.MAGIC_NUMBER,
          location: this.getSourceLocation(node, filePath),
          description: `Hardcoded physics constant "${text}" in string literal`,
          governanceReference: 'Spec-4: Magic Number Elimination',
          severity: ViolationSeverity.MEDIUM,
          detectedAt: new Date(),
          fixAttempts: 0,
          value: text,
          suspectedType: this.guessSuspectedType(value, context),
          suggestedSource: this.suggestAuthoritySource(value, context),
          context,
        };
      }
    }

    return null;
  }

  private checkBinaryExpression(node: ts.BinaryExpression, filePath: string): MagicNumberViolation | null {
    const expressionText = node.getText();
    
    // Check for suspicious calculation patterns
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(expressionText)) {
        const context = this.getNodeContext(node);
        return {
          specNumber: 'Spec-4',
          violationType: ViolationType.MAGIC_NUMBER,
          location: this.getSourceLocation(node, filePath),
          description: `Suspicious physics calculation pattern: ${expressionText}`,
          governanceReference: 'Spec-4: Magic Number Elimination',
          severity: ViolationSeverity.HIGH,
          detectedAt: new Date(),
          fixAttempts: 0,
          value: expressionText,
          suspectedType: this.guessTypeFromPattern(expressionText),
          suggestedSource: this.suggestAuthoritySource(expressionText, context),
          context,
        };
      }
    }

    return null;
  }

  private isConstantsFile(filePath: string): boolean {
    return filePath.includes('/constants/') || 
           filePath.includes('constants.ts') ||
           filePath.includes('config.ts');
  }

  private isCommonNonMagicNumber(value: number): boolean {
    // Common non-magic numbers that are acceptable
    const commonNumbers = [0, 1, 2, 3, 4, 5, 10, 100, -1];
    return commonNumbers.includes(value);
  }

  private isSuspiciousPhysicsConstant(value: number): boolean {
    // Check against known physics constants
    const allPhysicsConstants = [
      ...this.PHYSICS_CONSTANTS.ANGLES,
      ...this.PHYSICS_CONSTANTS.PERIODS,
      ...this.PHYSICS_CONSTANTS.SCALE_FACTORS,
      ...this.PHYSICS_CONSTANTS.PHYSICS_VALUES,
    ];

    return allPhysicsConstants.some(constant => Math.abs(constant - value) < 0.01);
  }

  private guessSuspectedType(value: number, context: string): PhysicsConstantType {
    if (this.PHYSICS_CONSTANTS.ANGLES.includes(value) || context.includes('tilt') || context.includes('angle')) {
      return PhysicsConstantType.AXIAL_TILT;
    }

    if (this.PHYSICS_CONSTANTS.PERIODS.includes(value) || context.includes('period') || context.includes('rotation')) {
      return PhysicsConstantType.ROTATION;
    }

    if (context.includes('radius') || context.includes('mass') || context.includes('GM')) {
      return PhysicsConstantType.PHYSICAL_PARAMS;
    }

    if (context.includes('frame') || context.includes('reference')) {
      return PhysicsConstantType.REFERENCE_FRAMES;
    }

    return PhysicsConstantType.PHYSICAL_PARAMS;
  }

  private guessTypeFromPattern(expression: string): PhysicsConstantType {
    if (expression.includes('PI') || expression.includes('180')) {
      return PhysicsConstantType.AXIAL_TILT;
    }

    if (expression.includes('24') || expression.includes('365')) {
      return PhysicsConstantType.ROTATION;
    }

    return PhysicsConstantType.PHYSICAL_PARAMS;
  }

  private getNodeContext(node: ts.Node): string {
    // Get surrounding context for better analysis
    let parent = node.parent;
    let context = '';

    // Look for variable names, function names, property names
    while (parent && context.length < 100) {
      if (ts.isVariableDeclaration(parent) && parent.name) {
        context = parent.name.getText() + ' ' + context;
        break;
      }
      if (ts.isPropertyAssignment(parent) && parent.name) {
        context = parent.name.getText() + ' ' + context;
        break;
      }
      if (ts.isFunctionDeclaration(parent) && parent.name) {
        context = parent.name.getText() + ' ' + context;
        break;
      }
      parent = parent.parent;
    }

    return context.trim() || 'unknown context';
  }

  private getSourceLocation(node: ts.Node, filePath: string): SourceLocation {
    const sourceFile = node.getSourceFile();
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    return {
      file: filePath,
      line: start.line + 1,
      column: start.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1,
    };
  }

  private getExpectedSource(constant: ConstantUsage): string | null {
    // Determine expected source based on constant name and value
    const name = constant.name.toLowerCase();

    if (name.includes('tilt') || name.includes('obliquity')) {
      return this.AUTHORITY_SOURCES[PhysicsConstantType.AXIAL_TILT];
    }

    if (name.includes('period') || name.includes('rotation') || name.includes('day')) {
      return this.AUTHORITY_SOURCES[PhysicsConstantType.ROTATION];
    }

    if (name.includes('radius') || name.includes('mass') || name.includes('gm')) {
      return this.AUTHORITY_SOURCES[PhysicsConstantType.PHYSICAL_PARAMS];
    }

    if (name.includes('frame') || name.includes('reference') || name.includes('coordinate')) {
      return this.AUTHORITY_SOURCES[PhysicsConstantType.REFERENCE_FRAMES];
    }

    return null;
  }

  private checkValueUnitClarity(value: NumericValue): UnitClarityViolation | null {
    const missingUnit = !value.hasUnit && this.shouldHaveUnit(value);
    const missingReferenceFrame = !value.hasReferenceFrame && this.shouldHaveReferenceFrame(value);

    if (missingUnit || missingReferenceFrame) {
      return {
        value,
        missingUnit,
        missingReferenceFrame,
        suggestedUnit: missingUnit ? this.suggestUnit(value) : undefined,
        suggestedReferenceFrame: missingReferenceFrame ? this.suggestReferenceFrame(value) : undefined,
      };
    }

    return null;
  }

  private shouldHaveUnit(value: NumericValue): boolean {
    const context = value.context.toLowerCase();
    return context.includes('radius') || 
           context.includes('distance') || 
           context.includes('mass') || 
           context.includes('period') || 
           context.includes('angle') ||
           context.includes('velocity') ||
           context.includes('acceleration');
  }

  private shouldHaveReferenceFrame(value: NumericValue): boolean {
    const context = value.context.toLowerCase();
    return context.includes('position') || 
           context.includes('coordinate') || 
           context.includes('vector') ||
           context.includes('orientation') ||
           context.includes('rotation');
  }

  private suggestUnit(value: NumericValue): string {
    const context = value.context.toLowerCase();
    
    if (context.includes('radius') || context.includes('distance')) {
      return 'km';
    }
    if (context.includes('mass')) {
      return 'kg';
    }
    if (context.includes('period') || context.includes('time')) {
      return context.includes('day') ? 'days' : 'hours';
    }
    if (context.includes('angle') || context.includes('tilt')) {
      return 'degrees';
    }
    if (context.includes('velocity')) {
      return 'km/s';
    }
    
    return 'unknown';
  }

  private suggestReferenceFrame(value: NumericValue): string {
    const context = value.context.toLowerCase();
    
    if (context.includes('ecliptic')) {
      return 'ecliptic';
    }
    if (context.includes('equatorial')) {
      return 'equatorial';
    }
    if (context.includes('galactic')) {
      return 'galactic';
    }
    
    return 'J2000';
  }

  private scanForConfigurationIssues(fileAst: any, filePath: string): ConfigurationViolation[] {
    const violations: ConfigurationViolation[] = [];
    
    // Look for configuration objects, hardcoded values, and missing units
    const sourceFile = ts.createSourceFile(
      filePath,
      '', // We'll need the actual content
      ts.ScriptTarget.Latest,
      true
    );

    const visit = (node: ts.Node) => {
      // Check object literals that might be configuration
      if (ts.isObjectLiteralExpression(node)) {
        const configViolations = this.checkConfigurationObject(node, filePath);
        violations.push(...configViolations);
      }

      // Check variable declarations with suspicious names
      if (ts.isVariableDeclaration(node)) {
        const configViolation = this.checkConfigurationVariable(node, filePath);
        if (configViolation) {
          violations.push(configViolation);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return violations;
  }

  private checkConfigurationObject(node: ts.ObjectLiteralExpression, filePath: string): ConfigurationViolation[] {
    const violations: ConfigurationViolation[] = [];

    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property)) {
        const violation = this.checkConfigurationProperty(property, filePath);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    return violations;
  }

  private checkConfigurationProperty(property: ts.PropertyAssignment, filePath: string): ConfigurationViolation | null {
    const propertyName = property.name?.getText() || '';
    const propertyValue = property.initializer;

    // Check for hardcoded physics values in configuration
    if (ts.isNumericLiteral(propertyValue)) {
      const value = parseFloat(propertyValue.text);
      
      if (this.isSuspiciousPhysicsConstant(value)) {
        return {
          configValue: value,
          location: this.getSourceLocation(property, filePath),
          violationType: 'hardcoded',
          suggestedFix: `Move ${propertyName} to appropriate constants file: ${this.suggestAuthoritySource(value, propertyName)}`,
        };
      }

      // Check for values that should have units
      if (this.shouldConfigValueHaveUnit(propertyName, value)) {
        return {
          configValue: value,
          location: this.getSourceLocation(property, filePath),
          violationType: 'missing_unit',
          suggestedFix: `Add unit information for ${propertyName}. Suggested unit: ${this.suggestUnitForConfig(propertyName)}`,
        };
      }
    }

    // Check for string values that might need source clarification
    if (ts.isStringLiteral(propertyValue)) {
      const stringValue = propertyValue.text;
      
      if (this.needsSourceClarification(propertyName, stringValue)) {
        return {
          configValue: stringValue,
          location: this.getSourceLocation(property, filePath),
          violationType: 'unclear_source',
          suggestedFix: `Clarify source and reference frame for ${propertyName}. Consider adding metadata about data origin.`,
        };
      }
    }

    return null;
  }

  private checkConfigurationVariable(node: ts.VariableDeclaration, filePath: string): ConfigurationViolation | null {
    const variableName = node.name?.getText() || '';
    
    // Check if variable name suggests it should be a configuration value
    if (this.isConfigurationVariableName(variableName) && node.initializer) {
      if (ts.isNumericLiteral(node.initializer)) {
        const value = parseFloat(node.initializer.text);
        
        if (this.isSuspiciousPhysicsConstant(value)) {
          return {
            configValue: value,
            location: this.getSourceLocation(node, filePath),
            violationType: 'hardcoded',
            suggestedFix: `Move ${variableName} to appropriate constants file: ${this.suggestAuthoritySource(value, variableName)}`,
          };
        }
      }
    }

    return null;
  }

  private shouldConfigValueHaveUnit(propertyName: string, value: number): boolean {
    const name = propertyName.toLowerCase();
    
    // Skip dimensionless values and ratios
    if (name.includes('ratio') || name.includes('factor') || name.includes('scale') || 
        name.includes('opacity') || name.includes('alpha') || value <= 1) {
      return false;
    }

    return name.includes('radius') || 
           name.includes('distance') || 
           name.includes('size') || 
           name.includes('mass') || 
           name.includes('period') || 
           name.includes('speed') || 
           name.includes('velocity') ||
           name.includes('time') ||
           name.includes('duration');
  }

  private suggestUnitForConfig(propertyName: string): string {
    const name = propertyName.toLowerCase();
    
    if (name.includes('radius') || name.includes('distance') || name.includes('size')) {
      return 'km';
    }
    if (name.includes('mass')) {
      return 'kg';
    }
    if (name.includes('period') || name.includes('time') || name.includes('duration')) {
      return 'hours or days';
    }
    if (name.includes('speed') || name.includes('velocity')) {
      return 'km/s';
    }
    
    return 'appropriate SI unit';
  }

  private needsSourceClarification(propertyName: string, value: string): boolean {
    const name = propertyName.toLowerCase();
    
    // Values that should have clear source and reference frame
    return (name.includes('coordinate') || 
            name.includes('position') || 
            name.includes('orientation') ||
            name.includes('reference') ||
            name.includes('frame')) && 
           !value.includes('source:') && 
           !value.includes('ref:') &&
           !value.includes('frame:');
  }

  private isConfigurationVariableName(variableName: string): boolean {
    const name = variableName.toLowerCase();
    
    return name.includes('config') || 
           name.includes('setting') || 
           name.includes('param') || 
           name.includes('constant') ||
           name.includes('default') ||
           name.includes('initial');
  }

  /**
   * Enhanced method to extract numeric values with context for unit checking
   */
  extractNumericValuesWithContext(ast: ProjectAST): NumericValue[] {
    const values: NumericValue[] = [];

    for (let i = 0; i < ast.files.length; i++) {
      const fileAst = ast.files[i];
      const filePath = ast.modules[i]?.path || `file_${i}.ts`;

      const sourceFile = ts.createSourceFile(
        filePath,
        '', // We'll need the actual content
        ts.ScriptTarget.Latest,
        true
      );

      const visit = (node: ts.Node) => {
        if (ts.isNumericLiteral(node)) {
          const value = this.createNumericValue(node, filePath);
          if (value) {
            values.push(value);
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    }

    return values;
  }

  private createNumericValue(node: ts.NumericLiteral, filePath: string): NumericValue | null {
    const value = parseFloat(node.text);
    const context = this.getNodeContext(node);
    
    // Skip common non-physics numbers
    if (this.isCommonNonMagicNumber(value)) {
      return null;
    }

    return {
      value,
      context,
      location: this.getSourceLocation(node, filePath),
      hasUnit: this.contextHasUnit(context),
      hasReferenceFrame: this.contextHasReferenceFrame(context),
      unit: this.extractUnitFromContext(context),
      referenceFrame: this.extractReferenceFrameFromContext(context),
    };
  }

  private contextHasUnit(context: string): boolean {
    const unitPatterns = [
      /\bkm\b/, /\bm\b/, /\bcm\b/, /\bmm\b/, // distance
      /\bkg\b/, /\bg\b/, // mass
      /\bs\b/, /\bmin\b/, /\bh\b/, /\bhours?\b/, /\bdays?\b/, /\byears?\b/, // time
      /\bdeg\b/, /\bdegrees?\b/, /\brad\b/, /\bradians?\b/, // angle
      /\bm\/s\b/, /\bkm\/s\b/, /\bkm\/h\b/, // velocity
    ];

    return unitPatterns.some(pattern => pattern.test(context));
  }

  private contextHasReferenceFrame(context: string): boolean {
    const framePatterns = [
      /\bJ2000\b/, /\becliptic\b/, /\bequatorial\b/, /\bgalactic\b/,
      /\bICRF\b/, /\bFK5\b/, /\bheliocentric\b/, /\bgeocentric\b/,
    ];

    return framePatterns.some(pattern => pattern.test(context));
  }

  private extractUnitFromContext(context: string): string | undefined {
    const unitMatch = context.match(/\b(km|m|cm|mm|kg|g|s|min|h|hours?|days?|years?|deg|degrees?|rad|radians?|m\/s|km\/s|km\/h)\b/);
    return unitMatch ? unitMatch[1] : undefined;
  }

  /**
   * Comprehensive analysis of configuration values for governance compliance
   */
  async analyzeConfigurationCompliance(ast: ProjectAST): Promise<{
    violations: ConfigurationViolation[];
    recommendations: ConfigurationRecommendation[];
    authorityMappings: AuthorityMapping[];
  }> {
    const violations: ConfigurationViolation[] = [];
    const recommendations: ConfigurationRecommendation[] = [];
    const authorityMappings: AuthorityMapping[] = [];

    for (let i = 0; i < ast.files.length; i++) {
      const fileAst = ast.files[i];
      const filePath = ast.modules[i]?.path || `file_${i}.ts`;
      
      // Focus on configuration files
      if (this.isConfigurationFile(filePath)) {
        const analysis = await this.analyzeConfigurationFile(fileAst, filePath);
        violations.push(...analysis.violations);
        recommendations.push(...analysis.recommendations);
        authorityMappings.push(...analysis.authorityMappings);
      }
    }

    return { violations, recommendations, authorityMappings };
  }

  private isConfigurationFile(filePath: string): boolean {
    return filePath.includes('config') || 
           filePath.includes('settings') || 
           filePath.includes('Config.ts') ||
           filePath.includes('visualConfig') ||
           filePath.includes('cameraConfig');
  }

  private async analyzeConfigurationFile(fileAst: any, filePath: string): Promise<{
    violations: ConfigurationViolation[];
    recommendations: ConfigurationRecommendation[];
    authorityMappings: AuthorityMapping[];
  }> {
    const violations: ConfigurationViolation[] = [];
    const recommendations: ConfigurationRecommendation[] = [];
    const authorityMappings: AuthorityMapping[] = [];

    const sourceFile = ts.createSourceFile(
      filePath,
      '', // We'll need the actual content
      ts.ScriptTarget.Latest,
      true
    );

    const visit = (node: ts.Node) => {
      // Analyze object literals (configuration objects)
      if (ts.isObjectLiteralExpression(node)) {
        const analysis = this.analyzeConfigurationObject(node, filePath);
        violations.push(...analysis.violations);
        recommendations.push(...analysis.recommendations);
        authorityMappings.push(...analysis.authorityMappings);
      }

      // Analyze variable declarations
      if (ts.isVariableDeclaration(node)) {
        const analysis = this.analyzeConfigurationVariable(node, filePath);
        if (analysis.violation) violations.push(analysis.violation);
        if (analysis.recommendation) recommendations.push(analysis.recommendation);
        if (analysis.authorityMapping) authorityMappings.push(analysis.authorityMapping);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return { violations, recommendations, authorityMappings };
  }

  private analyzeConfigurationObject(node: ts.ObjectLiteralExpression, filePath: string): {
    violations: ConfigurationViolation[];
    recommendations: ConfigurationRecommendation[];
    authorityMappings: AuthorityMapping[];
  } {
    const violations: ConfigurationViolation[] = [];
    const recommendations: ConfigurationRecommendation[] = [];
    const authorityMappings: AuthorityMapping[] = [];

    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property)) {
        const propertyName = property.name?.getText() || '';
        const analysis = this.analyzeConfigurationProperty(property, filePath, propertyName);
        
        if (analysis.violation) violations.push(analysis.violation);
        if (analysis.recommendation) recommendations.push(analysis.recommendation);
        if (analysis.authorityMapping) authorityMappings.push(analysis.authorityMapping);
      }
    }

    return { violations, recommendations, authorityMappings };
  }

  private analyzeConfigurationProperty(
    property: ts.PropertyAssignment, 
    filePath: string, 
    propertyName: string
  ): {
    violation?: ConfigurationViolation;
    recommendation?: ConfigurationRecommendation;
    authorityMapping?: AuthorityMapping;
  } {
    const propertyValue = property.initializer;

    if (ts.isNumericLiteral(propertyValue)) {
      return this.analyzeNumericConfigValue(property, filePath, propertyName, parseFloat(propertyValue.text));
    }

    if (ts.isStringLiteral(propertyValue)) {
      return this.analyzeStringConfigValue(property, filePath, propertyName, propertyValue.text);
    }

    if (ts.isObjectLiteralExpression(propertyValue)) {
      return this.analyzeNestedConfigObject(property, filePath, propertyName);
    }

    return {};
  }

  private analyzeNumericConfigValue(
    property: ts.PropertyAssignment,
    filePath: string,
    propertyName: string,
    value: number
  ): {
    violation?: ConfigurationViolation;
    recommendation?: ConfigurationRecommendation;
    authorityMapping?: AuthorityMapping;
  } {
    const location = this.getSourceLocation(property, filePath);

    // Check if it's a physics constant that should come from authority
    if (this.isSuspiciousPhysicsConstant(value)) {
      const suggestedSource = this.suggestAuthoritySource(value, propertyName);
      
      return {
        violation: {
          configValue: value,
          location,
          violationType: 'hardcoded',
          suggestedFix: `Move ${propertyName} (${value}) to authority source: ${suggestedSource}`,
        },
        authorityMapping: {
          configProperty: propertyName,
          currentValue: value,
          suggestedAuthority: suggestedSource,
          reason: 'Physics constant should be centrally defined',
          confidence: this.calculateConfidence(value, propertyName),
        }
      };
    }

    // Check if it needs unit clarification
    if (this.shouldConfigValueHaveUnit(propertyName, value)) {
      const suggestedUnit = this.suggestUnitForConfig(propertyName);
      
      return {
        violation: {
          configValue: value,
          location,
          violationType: 'missing_unit',
          suggestedFix: `Add unit metadata for ${propertyName}. Suggested: ${suggestedUnit}`,
        },
        recommendation: {
          type: 'add_unit_metadata',
          property: propertyName,
          currentValue: value,
          suggestedUnit,
          example: `${propertyName}: { value: ${value}, unit: '${suggestedUnit}', source: 'authority_file' }`,
        }
      };
    }

    return {};
  }

  private analyzeStringConfigValue(
    property: ts.PropertyAssignment,
    filePath: string,
    propertyName: string,
    value: string
  ): {
    violation?: ConfigurationViolation;
    recommendation?: ConfigurationRecommendation;
    authorityMapping?: AuthorityMapping;
  } {
    const location = this.getSourceLocation(property, filePath);

    // Check if string contains numeric physics constants
    const numericMatch = value.match(/^\d+\.?\d*$/);
    if (numericMatch) {
      const numValue = parseFloat(value);
      if (this.isSuspiciousPhysicsConstant(numValue)) {
        const suggestedSource = this.suggestAuthoritySource(numValue, propertyName);
        
        return {
          violation: {
            configValue: value,
            location,
            violationType: 'hardcoded',
            suggestedFix: `Replace string "${value}" with import from ${suggestedSource}`,
          },
          authorityMapping: {
            configProperty: propertyName,
            currentValue: value,
            suggestedAuthority: suggestedSource,
            reason: 'String contains physics constant',
            confidence: this.calculateConfidence(numValue, propertyName),
          }
        };
      }
    }

    // Check if it needs source clarification
    if (this.needsSourceClarification(propertyName, value)) {
      return {
        violation: {
          configValue: value,
          location,
          violationType: 'unclear_source',
          suggestedFix: `Add source and reference frame metadata for ${propertyName}`,
        },
        recommendation: {
          type: 'add_source_metadata',
          property: propertyName,
          currentValue: value,
          suggestedUnit: 'N/A',
          example: `${propertyName}: { value: '${value}', source: 'IAU_2015', referenceFrame: 'J2000' }`,
        }
      };
    }

    return {};
  }

  private analyzeNestedConfigObject(
    property: ts.PropertyAssignment,
    filePath: string,
    propertyName: string
  ): {
    violation?: ConfigurationViolation;
    recommendation?: ConfigurationRecommendation;
    authorityMapping?: AuthorityMapping;
  } {
    // For nested objects, we should recursively analyze
    // This is a simplified version - full implementation would recurse
    return {
      recommendation: {
        type: 'review_nested_config',
        property: propertyName,
        currentValue: 'nested object',
        suggestedUnit: 'N/A',
        example: `Review nested configuration object ${propertyName} for compliance`,
      }
    };
  }

  private analyzeConfigurationVariable(
    node: ts.VariableDeclaration,
    filePath: string
  ): {
    violation?: ConfigurationViolation;
    recommendation?: ConfigurationRecommendation;
    authorityMapping?: AuthorityMapping;
  } {
    const variableName = node.name?.getText() || '';
    
    if (!this.isConfigurationVariableName(variableName) || !node.initializer) {
      return {};
    }

    if (ts.isNumericLiteral(node.initializer)) {
      const value = parseFloat(node.initializer.text);
      const location = this.getSourceLocation(node, filePath);

      if (this.isSuspiciousPhysicsConstant(value)) {
        const suggestedSource = this.suggestAuthoritySource(value, variableName);
        
        return {
          violation: {
            configValue: value,
            location,
            violationType: 'hardcoded',
            suggestedFix: `Move variable ${variableName} to authority source: ${suggestedSource}`,
          },
          authorityMapping: {
            configProperty: variableName,
            currentValue: value,
            suggestedAuthority: suggestedSource,
            reason: 'Configuration variable contains physics constant',
            confidence: this.calculateConfidence(value, variableName),
          }
        };
      }
    }

    return {};
  }

  private extractReferenceFrameFromContext(context: string): string | undefined {
    const frameMatch = context.match(/\b(J2000|ecliptic|equatorial|galactic|ICRF|FK5|heliocentric|geocentric)\b/);
    return frameMatch ? frameMatch[1] : undefined;
  }

  private calculateConfidence(value: number, context: string): number {
    let confidence = 0.5; // base confidence

    // Higher confidence for known physics constants
    if (this.PHYSICS_CONSTANTS.ANGLES.includes(value)) confidence += 0.3;
    if (this.PHYSICS_CONSTANTS.PERIODS.includes(value)) confidence += 0.3;
    if (this.PHYSICS_CONSTANTS.PHYSICS_VALUES.includes(value)) confidence += 0.4;

    // Higher confidence for context matches
    const contextLower = context.toLowerCase();
    if (contextLower.includes('tilt') && this.PHYSICS_CONSTANTS.ANGLES.includes(value)) confidence += 0.2;
    if (contextLower.includes('period') && this.PHYSICS_CONSTANTS.PERIODS.includes(value)) confidence += 0.2;
    if (contextLower.includes('radius') || contextLower.includes('mass')) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}

// Additional interfaces for configuration analysis
interface ConfigurationRecommendation {
  type: 'add_unit_metadata' | 'add_source_metadata' | 'review_nested_config';
  property: string;
  currentValue: any;
  suggestedUnit: string;
  example: string;
}

interface AuthorityMapping {
  configProperty: string;
  currentValue: any;
  suggestedAuthority: string;
  reason: string;
  confidence: number; // 0-1
}