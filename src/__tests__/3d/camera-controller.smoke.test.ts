// Mock OrbitControls (JS module syntax) to avoid Jest parsing ESM module from node_modules
jest.mock('three/examples/jsm/controls/OrbitControls', () => {
  const THREE = require('three');
  return {
    OrbitControls: class {
      camera: any;
      domElement: any;
      target: any;
      enableDamping = false;
      dampingFactor = 0.05;
      minDistance = 0;
      maxDistance = 1000;
      zoomSpeed = 1;
      panSpeed = 0.6;
      rotateSpeed = 0.8;
      touches = {};
      enableZoom = false;
      enableRotate = true;
      enablePan = true;
      screenSpacePanning = false;
      minPolarAngle = 0;
      maxPolarAngle = Math.PI;
      constructor(camera: any, domElement: any) {
        this.camera = camera;
        this.domElement = domElement;
        this.target = new THREE.Vector3(0, 0, 0);
      }
      update() {}
      getAzimuthalAngle() { return 0; }
    }
  };
});

import * as THREE from 'three';
import { CameraController } from '@/lib/3d/CameraController';

describe('CameraController smoke tests', () => {
  test('focusOnTarget + update does not throw and sets radius', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.00001, 1e6);
    // Use a minimal mocked DOM element to avoid requiring jsdom
    const el: any = {
      isConnected: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    const controller = new CameraController(camera, el as unknown as HTMLElement);

    const target = new THREE.Vector3(0, 0, 0);

    // pass planetRadius as the 4th parameter
    expect(() => controller.focusOnTarget(target, 4, undefined, 1.0)).not.toThrow();
    // ensure radius recorded
    // @ts-ignore - accessing private for smoke verification
    expect(controller['currentTargetRadius']).toBeCloseTo(1.0);

    // call update a few times to run applyPenetrationConstraint
    expect(() => controller.update(1 / 60)).not.toThrow();
    expect(() => controller.update(1 / 60)).not.toThrow();
  });
});
