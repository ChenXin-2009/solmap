/**
 * Planet Debug Integration
 * 
 * Integrates canonical axis debugging into the Planet class
 * Allows runtime switching between canonical and physical modes
 * 
 * This is the bridge between the debug tools and the actual Planet rendering
 */

import { Vector3 } from 'three';
import { CanonicalAxisDebugger } from './debug-canonical-axis';
import { AxisVisualizationDebugger } from './axis-visualization-debug';
import type { Vector3 as AxialTiltVector3 } from './types';

export interface PlanetDebugState {
  planetName: string;
  debugMode: 'canonical' | 'physical';
  physicalSpinAxis: AxialTiltVector3;
  effectiveSpinAxis: AxialTiltVector3;
  isConsistent: boolean;
}

export class PlanetDebugIntegration {
  private static instance: PlanetDebugIntegration | null = null;
  
  private canonicalDebugger: CanonicalAxisDebugger;
  private visualizationDebugger: AxisVisualizationDebugger;
  private planetStates: Map<string, PlanetDebugState> = new Map();
  private isEnabled: boolean = false;

  private constructor() {
    this.canonicalDebugger = new CanonicalAxisDebugger({
      mode: 'canonical',
      logOrientationDetails: false // Reduce noise in production
    });
    
    this.visualizationDebugger = new AxisVisualizationDebugger({
      debugMode: 'canonical',
      showAxisLines: false // Start with visualization off
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PlanetDebugIntegration {
    if (!PlanetDebugIntegration.instance) {
      PlanetDebugIntegration.instance = new PlanetDebugIntegration();
    }
    return PlanetDebugIntegration.instance;
  }

  /**
   * Enable debug mode
   */
  enable(): void {
    this.isEnabled = true;
    console.log('[PlanetDebug] Debug mode enabled');
  }

  /**
   * Disable debug mode
   */
  disable(): void {
    this.isEnabled = false;
    this.visualizationDebugger.clearAllVisualizations();
    console.log('[PlanetDebug] Debug mode disabled');
  }

  /**
   * Initialize with Three.js scene (for visualizations)
   */
  initializeScene(scene: THREE.Scene): void {
    this.visualizationDebugger.initialize(scene);
  }

  /**
   * Get the effective spin axis for a planet based on current debug mode
   * This is the main integration point with Planet class
   */
  getEffectiveSpinAxis(planetName: string, physicalSpinAxis: AxialTiltVector3): AxialTiltVector3 {
    if (!this.isEnabled) {
      return physicalSpinAxis;
    }

    // Convert to Three.js Vector3 for compatibility
    const physicalVector3 = new Vector3(physicalSpinAxis.x, physicalSpinAxis.y, physicalSpinAxis.z);
    const effectiveVector3 = this.canonicalDebugger.getSpinAxisForPlanet(planetName, physicalVector3);
    
    // Convert back to AxialTiltVector3
    const effectiveSpinAxis: AxialTiltVector3 = {
      x: effectiveVector3.x,
      y: effectiveVector3.y,
      z: effectiveVector3.z
    };

    // Update planet state
    this.updatePlanetState(planetName, physicalSpinAxis, effectiveSpinAxis);

    return effectiveSpinAxis;
  }

  /**
   * Update visualization for a planet
   */
  updatePlanetVisualization(planetName: string, planetMesh: THREE.Object3D, physicalSpinAxis: AxialTiltVector3): void {
    if (!this.isEnabled) {
      return;
    }

    const physicalVector3 = new Vector3(physicalSpinAxis.x, physicalSpinAxis.y, physicalSpinAxis.z);
    this.visualizationDebugger.updatePlanetAxisVisualization(planetName, planetMesh, physicalVector3);
  }

  /**
   * Update internal planet state tracking
   */
  private updatePlanetState(planetName: string, physicalSpinAxis: AxialTiltVector3, effectiveSpinAxis: AxialTiltVector3): void {
    const state: PlanetDebugState = {
      planetName,
      debugMode: this.canonicalDebugger.getConfig().mode,
      physicalSpinAxis,
      effectiveSpinAxis,
      isConsistent: true // Will be updated by consistency checks
    };

    this.planetStates.set(planetName, state);
  }

  /**
   * Switch debug mode for all planets
   */
  switchMode(mode: 'canonical' | 'physical'): void {
    if (!this.isEnabled) {
      console.warn('[PlanetDebug] Cannot switch mode - debug not enabled');
      return;
    }

    this.canonicalDebugger.setMode(mode);
    this.visualizationDebugger.switchMode(mode);
    
    console.log(`[PlanetDebug] Switched all planets to ${mode} mode`);
    
    // Clear planet states - they will be rebuilt on next update
    this.planetStates.clear();
  }

  /**
   * Set canonical axis for testing
   */
  setCanonicalAxis(axis: Vector3): void {
    if (!this.isEnabled) {
      console.warn('[PlanetDebug] Cannot set canonical axis - debug not enabled');
      return;
    }

    this.canonicalDebugger.setCanonicalAxis(axis);
    this.visualizationDebugger.setCanonicalAxis(axis);
    
    console.log(`[PlanetDebug] Set canonical axis to`, axis);
  }

  /**
   * Toggle axis visualization
   */
  toggleAxisVisualization(visible: boolean): void {
    if (!this.isEnabled) {
      console.warn('[PlanetDebug] Cannot toggle visualization - debug not enabled');
      return;
    }

    this.visualizationDebugger.toggleAxisLines(visible);
  }

  /**
   * Run comprehensive system consistency check
   */
  runSystemConsistencyCheck(): {
    overallConsistent: boolean;
    planetStates: PlanetDebugState[];
    systemConsistency: ReturnType<CanonicalAxisDebugger['validateSystemConsistency']>;
  } {
    const systemConsistency = this.canonicalDebugger.validateSystemConsistency();
    const planetStates = Array.from(this.planetStates.values());
    
    // Update consistency flags
    planetStates.forEach(state => {
      state.isConsistent = systemConsistency.isConsistent;
    });

    const result = {
      overallConsistent: systemConsistency.isConsistent,
      planetStates,
      systemConsistency
    };

    console.log('[PlanetDebug] System Consistency Check:', result);
    return result;
  }

  /**
   * Get current debug configuration for UI integration
   */
  getDebugUIConfig(): {
    enabled: boolean;
    mode: 'canonical' | 'physical';
    showAxisLines: boolean;
    planetCount: number;
    actions: {
      enable: () => void;
      disable: () => void;
      switchMode: (mode: 'canonical' | 'physical') => void;
      setCanonicalAxis: (axis: Vector3) => void;
      toggleAxisVisualization: (visible: boolean) => void;
      runConsistencyCheck: () => void;
    };
  } {
    const vizConfig = this.visualizationDebugger.getConfig();
    
    return {
      enabled: this.isEnabled,
      mode: vizConfig.debugMode,
      showAxisLines: vizConfig.showAxisLines,
      planetCount: this.planetStates.size,
      actions: {
        enable: () => this.enable(),
        disable: () => this.disable(),
        switchMode: (mode) => this.switchMode(mode),
        setCanonicalAxis: (axis) => this.setCanonicalAxis(axis),
        toggleAxisVisualization: (visible) => this.toggleAxisVisualization(visible),
        runConsistencyCheck: () => this.runSystemConsistencyCheck()
      }
    };
  }

  /**
   * Get current planet states (for debugging UI)
   */
  getPlanetStates(): PlanetDebugState[] {
    return Array.from(this.planetStates.values());
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled(): boolean {
    return this.isEnabled;
  }
}

// Export singleton instance for easy access
export const planetDebugIntegration = PlanetDebugIntegration.getInstance();