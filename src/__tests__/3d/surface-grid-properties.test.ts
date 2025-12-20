/**
 * Property Tests for Surface Grid System
 * 
 * These tests validate universal properties for surface grid positioning,
 * alignment, and rotation coupling with planets.
 */

import * as THREE from 'three';
import { Planet } from '@/lib/3d/Planet';
import { CelestialBodyConfig } from '@/lib/types/celestialTypes';

describe('Surface Grid Properties', () => {
  
  const createTestPlanet = (
    name: string, 
    radius: number = 0.01,
    rotationPeriod: number = 24
  ): { planet: Planet; config: CelestialBodyConfig } => {
    const config: CelestialBodyConfig = {
      name,
      radius,
      color: '#FFFFFF',
      semiMajorAxis: 1.0,
      eccentricity: 0.0,
      inclination: 0,
      longitudeOfAscendingNode: 0,
      argumentOfPeriapsis: 0,
      meanAnomalyAtEpoch: 0,
      orbitalPeriod: 365.25,
      rotationPeriod
    };
    
    const planet = new Planet(config);
    return { planet, config };
  };

  /**
   * Property 8: Grid Surface Alignment
   * Validates: Requirements 4.1, 4.2, 4.4
   * 
   * Universal Property: Surface grid lines should be properly positioned
   * on the planet surface without floating or Z-fighting issues.
   */
  describe('Property 8: Grid Surface Alignment', () => {
    
    test('should position grid lines on planet surface for various planet sizes', () => {
      const planetSizes = [0.005, 0.01, 0.02, 0.05, 0.1]; // Various radii in AU
      
      planetSizes.forEach(radius => {
        const { planet } = createTestPlanet(`planet-${radius}`, radius);
        
        // Enable grid
        planet.setGridVisible(true);
        
        const mesh = planet.getMesh();
        expect(mesh).toBeDefined();
        
        if (mesh) {
          // Find grid object in the planet's children
          let gridObject: THREE.Object3D | null = null;
          mesh.traverse((child) => {
            if (child.name && child.name.includes('grid')) {
              gridObject = child;
            }
          });
          
          if (gridObject) {
            // Property: Grid should be positioned at planet surface
            const gridPosition = gridObject.position;
            const distanceFromCenter = gridPosition.length();
            
            // Grid should be very close to planet surface (within small offset)
            const expectedDistance = radius;
            const tolerance = radius * 0.1; // 10% tolerance
            expect(Math.abs(distanceFromCenter - expectedDistance)).toBeLessThan(tolerance);
            
            // Property: Grid should not be inside the planet
            expect(distanceFromCenter).toBeGreaterThanOrEqual(radius * 0.95);
            
            // Property: Grid should not be too far from surface (no floating)
            expect(distanceFromCenter).toBeLessThanOrEqual(radius * 1.2);
          }
        }
      });
    });

    test('should maintain proper grid line geometry', () => {
      const { planet } = createTestPlanet('grid-geometry-test', 0.02);
      planet.setGridVisible(true);
      
      const mesh = planet.getMesh();
      if (mesh) {
        let gridGeometry: THREE.BufferGeometry | null = null;
        
        mesh.traverse((child) => {
          if (child instanceof THREE.LineSegments && child.name.includes('grid')) {
            gridGeometry = child.geometry;
          }
        });
        
        if (gridGeometry) {
          const positions = gridGeometry.getAttribute('position');
          expect(positions).toBeDefined();
          
          // Property: All grid points should be on or near the sphere surface
          const positionArray = positions.array as Float32Array;
          for (let i = 0; i < positionArray.length; i += 3) {
            const x = positionArray[i];
            const y = positionArray[i + 1];
            const z = positionArray[i + 2];
            
            const distanceFromCenter = Math.sqrt(x * x + y * y + z * z);
            
            // Should be very close to planet radius
            expect(Math.abs(distanceFromCenter - 0.02)).toBeLessThan(0.002); // 10% tolerance
          }
          
          // Property: Should have reasonable number of grid lines
          const pointCount = positionArray.length / 3;
          expect(pointCount).toBeGreaterThan(20); // Minimum grid density
          expect(pointCount).toBeLessThan(1000); // Maximum for performance
        }
      }
    });

    test('should handle grid visibility toggling correctly', () => {
      const { planet } = createTestPlanet('visibility-test', 0.015);
      
      // Initially grid should be hidden
      planet.setGridVisible(false);
      
      const mesh = planet.getMesh();
      if (mesh) {
        let gridObject: THREE.Object3D | null = null;
        
        mesh.traverse((child) => {
          if (child.name && child.name.includes('grid')) {
            gridObject = child;
          }
        });
        
        // Property: Grid should be hidden when visibility is false
        if (gridObject) {
          expect(gridObject.visible).toBe(false);
        }
        
        // Show grid
        planet.setGridVisible(true);
        
        // Property: Grid should be visible when visibility is true
        if (gridObject) {
          expect(gridObject.visible).toBe(true);
        }
        
        // Hide grid again
        planet.setGridVisible(false);
        
        // Property: Grid should be hidden again
        if (gridObject) {
          expect(gridObject.visible).toBe(false);
        }
      }
    });
  });

  /**
   * Property 9: Grid-Planet Coupling
   * Validates: Requirements 4.3
   * 
   * Universal Property: Surface grid should rotate synchronously with
   * the planet, maintaining proper attachment to the planet mesh.
   */
  describe('Property 9: Grid-Planet Coupling', () => {
    
    test('should rotate grid with planet rotation', () => {
      const { planet } = createTestPlanet('rotation-coupling-test', 0.02, 12); // 12-hour rotation
      planet.setGridVisible(true);
      
      const mesh = planet.getMesh();
      if (mesh) {
        let gridObject: THREE.Object3D | null = null;
        
        mesh.traverse((child) => {
          if (child.name && child.name.includes('grid')) {
            gridObject = child;
          }
        });
        
        if (gridObject) {
          // Record initial rotations
          const initialPlanetRotation = mesh.rotation.y;
          const initialGridRotation = gridObject.rotation.y;
          
          // Simulate rotation over time
          let currentTime = 0;
          const timeStep = 0.1; // 0.1 day steps
          
          for (let i = 0; i < 20; i++) {
            planet.updateRotation(currentTime, 1.0);
            currentTime += timeStep;
          }
          
          const finalPlanetRotation = mesh.rotation.y;
          const finalGridRotation = gridObject.rotation.y;
          
          const planetRotationChange = finalPlanetRotation - initialPlanetRotation;
          const gridRotationChange = finalGridRotation - initialGridRotation;
          
          // Property: Grid should rotate with the planet
          // If grid is a child of planet mesh, it should inherit rotation
          // If grid has its own rotation, it should match planet rotation
          const rotationDifference = Math.abs(planetRotationChange - gridRotationChange);
          expect(rotationDifference).toBeLessThan(0.1); // Small tolerance for numerical precision
        }
      }
    });

    test('should maintain grid attachment during planet movement', () => {
      const { planet } = createTestPlanet('attachment-test', 0.015);
      planet.setGridVisible(true);
      
      const mesh = planet.getMesh();
      if (mesh) {
        let gridObject: THREE.Object3D | null = null;
        
        mesh.traverse((child) => {
          if (child.name && child.name.includes('grid')) {
            gridObject = child;
          }
        });
        
        if (gridObject) {
          // Move planet to different positions
          const testPositions = [
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 0, 1)
          ];
          
          testPositions.forEach(position => {
            mesh.position.copy(position);
            
            // Get grid world position
            const gridWorldPosition = new THREE.Vector3();
            gridObject!.getWorldPosition(gridWorldPosition);
            
            // Property: Grid should move with the planet
            const distanceBetween = gridWorldPosition.distanceTo(position);
            expect(distanceBetween).toBeLessThan(0.1); // Should be very close
          });
        }
      }
    });

    test('should synchronize grid rotation with different rotation speeds', () => {
      const rotationPeriods = [6, 12, 24, 48]; // Various rotation periods
      
      rotationPeriods.forEach(period => {
        const { planet } = createTestPlanet(`sync-test-${period}`, 0.02, period);
        planet.setGridVisible(true);
        
        const mesh = planet.getMesh();
        if (mesh) {
          let gridObject: THREE.Object3D | null = null;
          
          mesh.traverse((child) => {
            if (child.name && child.name.includes('grid')) {
              gridObject = child;
            }
          });
          
          if (gridObject) {
            // Reset rotations
            mesh.rotation.y = 0;
            if (gridObject.rotation) {
              gridObject.rotation.y = 0;
            }
            
            // Simulate rotation
            let currentTime = 0;
            const timeStep = period / 100; // 100 steps per rotation period
            
            const rotationSamples: { planet: number; grid: number }[] = [];
            
            for (let i = 0; i < 50; i++) {
              planet.updateRotation(currentTime, 1.0);
              
              rotationSamples.push({
                planet: mesh.rotation.y,
                grid: gridObject.rotation ? gridObject.rotation.y : mesh.rotation.y // Grid inherits if no separate rotation
              });
              
              currentTime += timeStep / 24; // Convert to days
            }
            
            // Property: Grid and planet rotations should be synchronized
            rotationSamples.forEach(sample => {
              const rotationDifference = Math.abs(sample.planet - sample.grid);
              expect(rotationDifference).toBeLessThan(0.05); // Small tolerance
            });
          }
        }
      });
    });

    test('should handle retrograde rotation coupling correctly', () => {
      const { planet } = createTestPlanet('retrograde-coupling', 0.02, -24); // Retrograde rotation
      planet.setGridVisible(true);
      
      const mesh = planet.getMesh();
      if (mesh) {
        let gridObject: THREE.Object3D | null = null;
        
        mesh.traverse((child) => {
          if (child.name && child.name.includes('grid')) {
            gridObject = child;
          }
        });
        
        if (gridObject) {
          // Record initial state
          const initialPlanetRotation = mesh.rotation.y;
          const initialGridRotation = gridObject.rotation ? gridObject.rotation.y : mesh.rotation.y;
          
          // Simulate retrograde rotation
          let currentTime = 0;
          const timeStep = 0.5; // 0.5 day steps
          
          for (let i = 0; i < 10; i++) {
            planet.updateRotation(currentTime, 1.0);
            currentTime += timeStep;
          }
          
          const finalPlanetRotation = mesh.rotation.y;
          const finalGridRotation = gridObject.rotation ? gridObject.rotation.y : mesh.rotation.y;
          
          const planetRotationChange = finalPlanetRotation - initialPlanetRotation;
          const gridRotationChange = finalGridRotation - initialGridRotation;
          
          // Property: Both should rotate in retrograde direction (negative)
          expect(planetRotationChange).toBeLessThan(0);
          expect(gridRotationChange).toBeLessThan(0);
          
          // Property: Grid should follow planet's retrograde rotation
          const rotationDifference = Math.abs(planetRotationChange - gridRotationChange);
          expect(rotationDifference).toBeLessThan(0.1);
        }
      }
    });
  });
});