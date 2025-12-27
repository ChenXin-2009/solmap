/**
 * Debug tool for verifying system consistency with canonical spin axes
 * Purpose: Validate that all planets behave identically when given the same spinAxis
 * This isolates rendering/coordinate issues from physical parameter issues
 */

import { Vector3 } from 'three';
import { createMeshOrientationManager } from './mesh-orientation-manager';
import { createFrameTransformer } from './frame-transformer';
import { ModelConfig, DEFAULT_MODEL_CONFIG, MeshOrientationManager, FrameTransformer } from './types';

export interface CanonicalAxisDebugConfig {
  mode: 'canonical' | 'physical';
  canonicalAxis: Vector3;
  showAxisVisualization: boolean;
  logOrientationDetails: boolean;
}

export class CanonicalAxisDebugger {
  private static readonly DEFAULT_CANONICAL_AXIS = new Vector3(0, 1, 0); // Render frame +Y
  
  private config: CanonicalAxisDebugConfig;
  private meshManager: MeshOrientationManager;
  private frameTransformer: FrameTransformer;

  constructor(config: Partial<CanonicalAxisDebugConfig> = {}) {
    this.config = {
      mode: 'canonical',
      canonicalAxis: CanonicalAxisDebugger.DEFAULT_CANONICAL_AXIS.clone(),
      showAxisVisualization: false,
      logOrientationDetails: false,
      ...config
    };
    
    this.meshManager = createMeshOrientationManager();
    this.frameTransformer = createFrameTransformer();
  }

  /**
   * Get the spin axis for a planet based on current debug mode
   * In canonical mode: all planets use the same axis
   * In physical mode: use the provided physical axis
   */
  getSpinAxisForPlanet(planetName: string, physicalSpinAxis: Vector3): Vector3 {
    if (this.config.mode === 'canonical') {
      if (this.config.logOrientationDetails) {
        console.log(`[CanonicalDebug] ${planetName}: Using canonical axis`, this.config.canonicalAxis);
      }
      return this.config.canonicalAxis.clone();
    } else {
      if (this.config.logOrientationDetails) {
        console.log(`[CanonicalDebug] ${planetName}: Using physical axis`, physicalSpinAxis);
      }
      return physicalSpinAxis.clone();
    }
  }

  /**
   * Critical self-check question:
   * "If I set all planets' spinAxis to (0,1,0), should they all behave identically?"
   * 
   * This method tests this assumption by applying the same axis to a test mesh
   * and verifying the resulting orientation is consistent
   */
  validateSystemConsistency(): {
    isConsistent: boolean;
    issues: string[];
    testResults: Array<{
      planetName: string;
      finalQuaternion: { x: number; y: number; z: number; w: number };
      spinAxisUsed: Vector3;
    }>;
  } {
    const issues: string[] = [];
    const testResults: Array<{
      planetName: string;
      finalQuaternion: { x: number; y: number; z: number; w: number };
      spinAxisUsed: Vector3;
    }> = [];

    // Test planets that should behave identically with canonical axis
    const testPlanets = ['Earth', 'Mars', 'Saturn', 'Venus'];
    const canonicalAxis = this.config.canonicalAxis.clone();

    // Mock mesh object for testing
    const createMockMesh = () => {
      const mockQuaternion = { x: 0, y: 0, z: 0, w: 1 };
      return {
        quaternion: {
          ...mockQuaternion,
          copy: (q: any) => {
            mockQuaternion.x = q.x;
            mockQuaternion.y = q.y;
            mockQuaternion.z = q.z;
            mockQuaternion.w = q.w;
          }
        },
        rotation: { x: 0, y: 0, z: 0 }
      };
    };

    let referenceQuaternion: { x: number; y: number; z: number; w: number } | null = null;

    for (const planetName of testPlanets) {
      const mockMesh = createMockMesh();
      
      try {
        // Apply canonical axis orientation using default model config
        this.meshManager.applySpinAxisOrientation(mockMesh as any, canonicalAxis, DEFAULT_MODEL_CONFIG);
        
        const result = {
          planetName,
          finalQuaternion: { ...mockMesh.quaternion },
          spinAxisUsed: canonicalAxis.clone()
        };
        
        testResults.push(result);

        // Check consistency with first planet
        if (referenceQuaternion === null) {
          referenceQuaternion = { ...mockMesh.quaternion };
        } else {
          const tolerance = 1e-10;
          const qDiff = Math.abs(referenceQuaternion.x - mockMesh.quaternion.x) +
                       Math.abs(referenceQuaternion.y - mockMesh.quaternion.y) +
                       Math.abs(referenceQuaternion.z - mockMesh.quaternion.z) +
                       Math.abs(referenceQuaternion.w - mockMesh.quaternion.w);
          
          if (qDiff > tolerance) {
            issues.push(`${planetName} quaternion differs from reference by ${qDiff.toExponential(3)}`);
          }
        }
        
      } catch (error) {
        issues.push(`${planetName} failed orientation application: ${error}`);
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues,
      testResults
    };
  }

  /**
   * Verify that the coordinate system assumptions are clear and consistent
   */
  validateCoordinateSystemAssumptions(): {
    renderFrameNorthAxis: Vector3;
    modelNorthAxis: Vector3;
    transformationIsConsistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Define what we think the coordinate system should be
    const renderFrameNorthAxis = new Vector3(0, 1, 0); // +Y is north in render frame
    const modelNorthAxis = new Vector3(0, 1, 0); // Assuming model also uses +Y as north
    
    // Test round-trip transformation
    const testVector = new Vector3(0, 1, 0);
    const icrfVector = this.frameTransformer.renderToIcrf(testVector);
    const backToRender = this.frameTransformer.icrfToRender(icrfVector);
    
    const roundTripError = testVector.distanceTo(backToRender);
    const transformationIsConsistent = roundTripError < 1e-10;
    
    if (!transformationIsConsistent) {
      issues.push(`Round-trip transformation error: ${roundTripError.toExponential(3)}`);
    }
    
    return {
      renderFrameNorthAxis,
      modelNorthAxis,
      transformationIsConsistent,
      issues
    };
  }

  /**
   * Switch between canonical and physical modes
   */
  setMode(mode: 'canonical' | 'physical'): void {
    this.config.mode = mode;
    console.log(`[CanonicalDebug] Switched to ${mode} mode`);
  }

  /**
   * Set custom canonical axis for testing
   */
  setCanonicalAxis(axis: Vector3): void {
    this.config.canonicalAxis = axis.clone().normalize();
    console.log(`[CanonicalDebug] Set canonical axis to`, this.config.canonicalAxis);
  }

  /**
   * Get current configuration
   */
  getConfig(): CanonicalAxisDebugConfig {
    return { ...this.config };
  }
}