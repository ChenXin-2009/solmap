// Project Optimization Tool - Main Entry Point
export * from './types';
export * from './interfaces';
export * from './analyzer';
export * from './detector';
export * from './engine';
export * from './generator';
export * from './validator';
export * from './config';
export * from './documentation-optimizer';

// Governance compliance modules (separate to avoid conflicts)
export * as Governance from './governance-index';