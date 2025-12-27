/**
 * Axis Visualization Debug Tool
 * 
 * Provides visual debugging capabilities for spin axes:
 * - Draw axis lines for each planet
 * - Toggle between canonical and physical modes
 * - Real-time axis direction display
 * 
 * This tool helps identify coordinate system issues vs physical parameter issues
 */

import * as THREE from 'three';
import { Vector3 } from 'three';
import { CanonicalAxisDebugger } from './debug-canonical-axis';

export interface AxisVisualizationConfig {
  showAxisLines: boolean;
  axisLineLength: number;
  axisLineColor: number;
  showAxisLabels: boolean;
  debugMode: 'canonical' | 'physical';
}

export class AxisVisualizationDebugger {
  private debugger: CanonicalAxisDebugger;
  private config: AxisVisualizationConfig;
  private axisLines: Map<string, THREE.Group> = new Map();
  private scene: THREE.Scene | null = null;

  constructor(config: Partial<AxisVisualizationConfig> = {}) {
    this.config = {
      showAxisLines: true,
      axisLineLength: 2.0,
      axisLineColor: 0x00ff00, // Green
      showAxisLabels: false,
      debugMode: 'canonical',
      ...config
    };

    this.debugger = new CanonicalAxisDebugger({
      mode: this.config.debugMode,
      showAxisVisualization: true,
      logOrientationDetails: true
    });
  }

  /**
   * Initialize with Three.js scene
   */
  initialize(scene: THREE.Scene): void {
    this.scene = scene;
  }

  /**
   * Create or update axis visualization for a planet
   */
  updatePlanetAxisVisualization(
    planetName: string,
    planetMesh: THREE.Object3D,
    physicalSpinAxis: Vector3
  ): void {
    if (!this.scene || !this.config.showAxisLines) {
      return;
    }

    // Get the spin axis based on current debug mode
    const spinAxis = this.debugger.getSpinAxisForPlanet(planetName, physicalSpinAxis);

    // Remove existing axis line if it exists
    const existingLine = this.axisLines.get(planetName);
    if (existingLine) {
      this.scene.remove(existingLine);
    }

    // Create new axis line
    const axisGroup = this.createAxisLine(spinAxis, planetMesh.position);
    this.axisLines.set(planetName, axisGroup);
    this.scene.add(axisGroup);

    // Log axis information
    console.log(`[AxisViz] ${planetName}: ${this.config.debugMode} axis`, {
      axis: spinAxis,
      position: planetMesh.position
    });
  }

  /**
   * Create a visual axis line
   */
  private createAxisLine(axis: Vector3, position: Vector3): THREE.Group {
    const group = new THREE.Group();
    group.position.copy(position);

    // Create line geometry
    const points = [
      new Vector3(0, 0, 0),
      axis.clone().multiplyScalar(this.config.axisLineLength)
    ];

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: this.config.axisLineColor,
      linewidth: 2
    });

    const line = new THREE.Line(geometry, material);
    group.add(line);

    // Add arrow head
    const arrowGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({ 
      color: this.config.axisLineColor 
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    
    // Position arrow at the end of the line
    const arrowPosition = axis.clone().multiplyScalar(this.config.axisLineLength);
    arrow.position.copy(arrowPosition);
    
    // Orient arrow to point along the axis
    arrow.lookAt(arrowPosition.clone().add(axis));
    
    group.add(arrow);

    return group;
  }

  /**
   * Switch between canonical and physical modes
   */
  switchMode(mode: 'canonical' | 'physical'): void {
    this.config.debugMode = mode;
    this.debugger.setMode(mode);
    
    console.log(`[AxisViz] Switched to ${mode} mode`);
    
    // Clear existing visualizations - they will be recreated on next update
    this.clearAllVisualizations();
  }

  /**
   * Set canonical axis for testing
   */
  setCanonicalAxis(axis: Vector3): void {
    this.debugger.setCanonicalAxis(axis);
    console.log(`[AxisViz] Set canonical axis to`, axis);
    
    // Clear existing visualizations if in canonical mode
    if (this.config.debugMode === 'canonical') {
      this.clearAllVisualizations();
    }
  }

  /**
   * Toggle axis line visibility
   */
  toggleAxisLines(visible: boolean): void {
    this.config.showAxisLines = visible;
    
    if (!visible) {
      this.clearAllVisualizations();
    }
  }

  /**
   * Clear all axis visualizations
   */
  clearAllVisualizations(): void {
    if (!this.scene) return;

    this.axisLines.forEach((axisGroup) => {
      this.scene!.remove(axisGroup);
    });
    this.axisLines.clear();
  }

  /**
   * Get current configuration
   */
  getConfig(): AxisVisualizationConfig {
    return { ...this.config };
  }

  /**
   * Run system consistency check and log results
   */
  runConsistencyCheck(): void {
    const result = this.debugger.validateSystemConsistency();
    
    console.log('=== SYSTEM CONSISTENCY CHECK ===');
    console.log(`Mode: ${this.config.debugMode}`);
    console.log(`Consistent: ${result.isConsistent}`);
    
    if (!result.isConsistent) {
      console.log('Issues found:');
      result.issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    console.log('Test results:');
    result.testResults.forEach(test => {
      console.log(`  ${test.planetName}: q(${test.finalQuaternion.x.toFixed(3)}, ${test.finalQuaternion.y.toFixed(3)}, ${test.finalQuaternion.z.toFixed(3)}, ${test.finalQuaternion.w.toFixed(3)})`);
    });
    
    console.log('================================');
  }

  /**
   * Create debug UI controls (returns configuration for UI integration)
   */
  getDebugUIConfig(): {
    mode: 'canonical' | 'physical';
    showAxisLines: boolean;
    canonicalAxisOptions: Array<{ name: string; axis: Vector3 }>;
    actions: {
      switchMode: (mode: 'canonical' | 'physical') => void;
      toggleAxisLines: (visible: boolean) => void;
      setCanonicalAxis: (axis: Vector3) => void;
      runConsistencyCheck: () => void;
    };
  } {
    return {
      mode: this.config.debugMode,
      showAxisLines: this.config.showAxisLines,
      canonicalAxisOptions: [
        { name: '+Y (Up)', axis: new Vector3(0, 1, 0) },
        { name: '+X (Right)', axis: new Vector3(1, 0, 0) },
        { name: '+Z (Forward)', axis: new Vector3(0, 0, 1) },
        { name: '-Y (Down)', axis: new Vector3(0, -1, 0) },
        { name: '-X (Left)', axis: new Vector3(-1, 0, 0) },
        { name: '-Z (Back)', axis: new Vector3(0, 0, -1) }
      ],
      actions: {
        switchMode: (mode) => this.switchMode(mode),
        toggleAxisLines: (visible) => this.toggleAxisLines(visible),
        setCanonicalAxis: (axis) => this.setCanonicalAxis(axis),
        runConsistencyCheck: () => this.runConsistencyCheck()
      }
    };
  }
}