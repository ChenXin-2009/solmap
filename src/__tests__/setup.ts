/**
 * Jest Test Setup
 * 
 * Global test configuration and utilities for the Space-Time Foundation tests.
 */

// Extend Jest matchers if needed
declare global {
  namespace jest {
    interface Matchers<R> {
      // Custom matchers can be added here
    }
  }
}

// Global test timeout for property-based tests
jest.setTimeout(30000);

export {};