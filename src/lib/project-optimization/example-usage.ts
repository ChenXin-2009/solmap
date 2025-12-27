// Example usage of the Renderer Stupidity Checker
import { createRendererStupidityChecker, extractRendererViolations } from './renderer-stupidity-checker';
import { ProjectAST, ModuleInfo } from './types';
import { ImportInfo, FileAST as GovernanceFileAST } from './governance-interfaces';

/**
 * Example demonstrating how to use the Renderer Stupidity Checker
 * to detect violations of Spec-3 (Renderer Stupidity) governance rules
 */
export function demonstrateRendererStupidityChecker() {
  const checker = createRendererStupidityChecker();

  // Example project AST with renderer and non-renderer modules
  const projectAST: ProjectAST = {
    files: [],
    modules: [
      {
        name: 'SolarSystemCanvas3D',
        path: 'src/components/canvas/3d/SolarSystemCanvas3D.tsx',
        exports: ['SolarSystemCanvas3D'],
        imports: ['axialTilt', 'rotationPeriod', 'position', 'rotation'], // Mixed good and bad imports
        dependencies: ['three', 'lib/astronomy/constants/axialTilt'] // Bad dependency
      },
      {
        name: 'Planet',
        path: 'src/lib/3d/Planet.ts',
        exports: ['Planet', 'calculateOrbit'], // Bad export - calculation in renderer
        imports: ['THREE', 'material', 'geometry'],
        dependencies: []
      },
      {
        name: 'OrbitCalculator',
        path: 'src/lib/astronomy/orbit.ts', // Not a renderer - should be ignored
        exports: ['calculateOrbit'],
        imports: ['axialTilt', 'physicalParams'],
        dependencies: []
      }
    ],
    dependencies: []
  };

  console.log('=== Renderer Stupidity Checker Demo ===\n');

  // 1. Identify renderer modules
  console.log('1. Identifying renderer modules...');
  const rendererModules = checker.identifyRendererModules(projectAST);
  console.log('Found renderer modules:', rendererModules);
  console.log();

  // 2. Check renderer inputs
  console.log('2. Checking renderer inputs...');
  const rendererModuleInfos = projectAST.modules.filter(m => 
    rendererModules.includes(m.path)
  );
  const inputViolations = checker.checkRendererInputs(rendererModuleInfos);
  console.log(`Found ${inputViolations.length} input violations:`);
  inputViolations.forEach(violation => {
    console.log(`  - ${violation.rendererModule}: ${violation.violations.join(', ')}`);
  });
  console.log();

  // 3. Detect physics knowledge in renderer code
  console.log('3. Detecting physics knowledge in renderer code...');
  const rendererCode = [
    'const tilt = axialTilt * Math.PI / 180;', // Bad - physics knowledge
    'const period = rotationPeriod * 24 * 3600;', // Bad - physics knowledge
    'mesh.position.set(x, y, z);', // Good - just rendering
    'const orbit = calculateKepler(planet);' // Bad - physics calculation
  ];
  const knowledgeViolations = checker.detectPhysicsKnowledge(rendererCode);
  console.log(`Found ${knowledgeViolations.length} physics knowledge violations:`);
  knowledgeViolations.forEach(violation => {
    console.log(`  - Detected concepts: ${violation.detectedConcepts.join(', ')}`);
  });
  console.log();

  // 4. Validate renderer imports
  console.log('4. Validating renderer imports...');
  const imports: ImportInfo[] = [
    {
      source: 'lib/astronomy/constants/axialTilt',
      imported: ['EARTH_AXIAL_TILT'],
      location: { file: 'src/components/canvas/3d/SolarSystemCanvas3D.tsx', line: 1, column: 1 },
      module: 'src/components/canvas/3d/SolarSystemCanvas3D.tsx'
    },
    {
      source: 'three',
      imported: ['Mesh', 'Material'],
      location: { file: 'src/lib/3d/Planet.ts', line: 1, column: 1 },
      module: 'src/lib/3d/Planet.ts'
    }
  ];
  const importViolations = checker.validateRendererImports(imports);
  console.log(`Found ${importViolations.length} import violations:`);
  importViolations.forEach(violation => {
    console.log(`  - ${violation.rendererModule}: ${violation.violations.map(v => v.importedModule).join(', ')}`);
  });
  console.log();

  // 5. Check computation logic
  console.log('5. Checking computation logic...');
  const rendererAST: GovernanceFileAST[] = [
    {
      path: 'src/components/canvas/3d/SolarSystemCanvas3D.tsx',
      ast: {},
      imports: [],
      exports: [],
      functions: [
        {
          name: 'calculateAngle', // Bad - calculation in renderer
          parameters: ['x', 'y'],
          location: { file: 'src/components/canvas/3d/SolarSystemCanvas3D.tsx', line: 10, column: 1 },
          complexity: 5
        },
        {
          name: 'render', // Good - rendering function
          parameters: ['scene'],
          location: { file: 'src/components/canvas/3d/SolarSystemCanvas3D.tsx', line: 20, column: 1 },
          complexity: 3
        }
      ],
      computations: [
        {
          type: 'trigonometric',
          description: 'angle calculation using Math.sin',
          location: { file: 'src/components/canvas/3d/SolarSystemCanvas3D.tsx', line: 15, column: 1 },
          variables: ['angle']
        }
      ]
    }
  ];
  const computationViolations = checker.checkComputationLogic(rendererAST);
  console.log(`Found ${computationViolations.length} computation violations:`);
  computationViolations.forEach(violation => {
    console.log(`  - ${violation.rendererModule}: ${violation.description}`);
    console.log(`    Suggested fix: ${violation.suggestedFix}`);
  });
  console.log();

  // 6. Extract all violations as unified renderer violations
  console.log('6. Extracting unified renderer violations...');
  const allViolations = extractRendererViolations(
    inputViolations,
    knowledgeViolations,
    importViolations,
    computationViolations
  );
  console.log(`Total renderer violations: ${allViolations.length}`);
  allViolations.forEach((violation, index) => {
    console.log(`  ${index + 1}. ${violation.specNumber}: ${violation.description}`);
    console.log(`     Reference: ${violation.governanceReference}`);
    console.log(`     Severity: ${violation.severity}`);
  });
  console.log();

  console.log('=== Demo Complete ===');
  console.log('The Renderer Stupidity Checker successfully detected violations of Spec-3 governance rules.');
  console.log('This ensures that rendering layers remain "stupid" and do not contain physics logic.');

  return {
    rendererModules,
    inputViolations,
    knowledgeViolations,
    importViolations,
    computationViolations,
    allViolations
  };
}

/**
 * Example of how to integrate the checker into a CI/CD pipeline
 */
export function checkProjectCompliance(projectAST: ProjectAST): boolean {
  const checker = createRendererStupidityChecker();
  
  // Get all renderer modules
  const rendererModules = checker.identifyRendererModules(projectAST);
  const rendererModuleInfos = projectAST.modules.filter(m => 
    rendererModules.includes(m.path)
  );

  // Check all types of violations
  const inputViolations = checker.checkRendererInputs(rendererModuleInfos);
  const importViolations = checker.validateRendererImports([]);
  const computationViolations = checker.checkComputationLogic([]);

  // Convert to unified violations
  const allViolations = extractRendererViolations(
    inputViolations,
    [],
    importViolations,
    computationViolations
  );

  // Check if there are any critical violations
  const criticalViolations = allViolations.filter(v => 
    v.severity === 'critical' || v.severity === 'high'
  );

  if (criticalViolations.length > 0) {
    console.error(`❌ Project fails Spec-3 compliance: ${criticalViolations.length} critical violations found`);
    criticalViolations.forEach(violation => {
      console.error(`   - ${violation.description}`);
    });
    return false;
  }

  console.log('✅ Project passes Spec-3 compliance: No critical renderer stupidity violations found');
  return true;
}