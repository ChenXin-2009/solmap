# Core Rules: AI Development Boundaries

## Purpose

This document defines the immutable core of the Space-Time Foundation system. These rules protect system integrity during AI-assisted development by clearly separating what AI can and cannot modify.

## ❌ PROHIBITED: AI Cannot Modify Without Explicit Approval

### 1. Time Progression Rules
- Julian Date calculation methods
- Time Authority implementation (`TimeAuthorityImpl`)
- Time subscription/notification mechanisms
- Time continuity validation logic
- **Implementation Boundary**: `TIME_CONTINUITY_CONSTRAINTS` in constants.ts
- **Runtime Constraint**: Maximum 1-day time jumps (`maxTimeJumpDays: 1.0`)

### 2. Coordinate System Definitions
- Primary reference frame specification (ICRF/J2000 Heliocentric Inertial)
- Reference frame count limitations (Phase 1: exactly 1 authoritative frame)
- State Vector semantic definitions
- Unit specifications (km, km/s, JD)
- **Implementation Boundary**: `PRIMARY_REFERENCE_FRAME` in constants.ts
- **Interface Boundary**: `StateVector` interface in types.ts

### 3. Ephemeris Provider Interface
- Core interface signature: `getState(bodyId, jd) -> StateVector`
- StateVector structure: `{position, velocity, radius, metadata}`
- Provider registration/routing mechanisms
- Interface versioning or breaking changes
- **Implementation Boundary**: `EphemerisProvider` interface in interfaces.ts
- **Router Implementation**: `EphemerisRouterImpl` and `EphemerisStrategyImpl`

### 4. Physical/Render Layer Boundaries
- Interface contracts between layers
- Data flow direction (Physical → Render only)
- Abstraction barriers preventing Render_Layer from accessing VSOP87/JPL directly
- **Implementation Boundary**: `RenderLayerInterface` in render-layer-interface.ts
- **Access Control**: `LayerAccessValidator` and `LayerBoundaryEnforcer` classes
- **Forbidden Operations**: Write operations in `FORBIDDEN_WRITE_OPERATIONS` set

### 5. Phase 1 Scope Constraints
- Feature exclusion list (no relativistic corrections, no attitude control, etc.)
- Architecture change approval requirements
- Reference frame count limitations
- **Implementation Boundary**: Single `SpaceTimeCoreImpl` instance per system
- **Body Support**: Limited to VSOP87 supported bodies (8 major planets)

### 6. Core Implementation Classes (NEW)
- `SpaceTimeCoreImpl`: Central authoritative component
- `TimeAuthorityImpl`: Single source of truth for time
- `RenderLayerInterfaceImpl`: Controlled render access
- `VSOP87Provider`: Primary ephemeris source
- **Error Codes**: `ERROR_CODES` constant definitions
- **Standard Body IDs**: `STANDARD_BODY_IDS` enumeration

## ✅ ALLOWED: AI Can Freely Generate/Modify

### 1. Implementation Details
- VSOP87 calculation optimizations
- Rendering performance improvements
- UI/UX enhancements
- Visualization effects and styling
- **Render Layer**: All components in rendering-integration.ts
- **Legacy Compatibility**: `LegacyCelestialBody` interface adaptations

### 2. Provider Implementations
- New Ephemeris_Provider implementations (JPL, TLE, SPICE)
- Provider-specific optimizations
- Caching and performance layers
- Data validation and error handling
- **Extension Point**: Additional providers via `EphemerisStrategy.registerProvider()`

### 3. Testing and Validation
- Unit tests for all components
- Integration tests
- Performance benchmarks
- Validation datasets
- **Property-Based Tests**: All tests in `__tests__/space-time-foundation/`
- **Test Utilities**: Helper functions and mock implementations

### 4. Documentation and Examples
- API documentation
- Usage examples
- Performance guides
- Integration tutorials
- **Generated Docs**: API references and usage guides

### 5. Utility Functions
- Coordinate transformation helpers (within approved reference frames)
- Mathematical utilities
- Data formatting and serialization
- Logging and debugging tools
- **Scale Strategy**: Render-only scaling in `ScaleStrategyImpl`
- **Display Properties**: Body colors, names, and visual attributes

### 6. Integration Adapters (NEW)
- `RenderingIntegrationAdapter`: Legacy system bridge
- `TimeControlIntegrated`: UI component integration
- Unit conversion utilities (km ↔ AU)
- Backward compatibility layers

## Implementation-Specific Boundaries

### Runtime Validation
- **Layer Access Control**: `LayerAccessValidator.validateOperation()`
- **Boundary Enforcement**: `LayerBoundaryEnforcer.validateLayerSeparation()`
- **Time Constraints**: Automatic validation in `TimeAuthority.setTime()`

### Interface Contracts
- **Read-Only Access**: Render layer limited to query methods only
- **Write Operations**: Exclusively through Physical Layer components
- **State Immutability**: StateVector objects are readonly
- **Provider Isolation**: No direct VSOP87 access from render components

### Error Handling
- **Standardized Codes**: All errors use `ERROR_CODES` constants
- **Result Pattern**: `SpaceTimeResult<T>` for all operations
- **Graceful Degradation**: System continues operation on non-critical errors

## Enforcement Guidelines

1. **Before Major Changes**: Always check if the change affects prohibited areas
2. **Architecture Changes**: Require explicit human approval for any change to prohibited items
3. **Interface Changes**: Any modification to core interfaces must be reviewed
4. **Scope Creep**: Reject features that violate Phase 1 limitations
5. **Documentation**: Update this document when core rules change
6. **Runtime Checks**: Leverage existing validation systems for compliance

## Validation Checklist

Before accepting AI-generated changes, verify:

- [ ] Does not modify time progression logic
- [ ] Does not add new authoritative reference frames
- [ ] Does not break Physical/Render layer separation
- [ ] Does not violate Phase 1 scope limitations
- [ ] Maintains StateVector semantic integrity
- [ ] Preserves Ephemeris Provider interface contracts
- [ ] **NEW**: Does not bypass `LayerAccessValidator` controls
- [ ] **NEW**: Maintains `ERROR_CODES` consistency
- [ ] **NEW**: Preserves `SpaceTimeCoreImpl` singleton pattern
- [ ] **NEW**: Respects `TIME_CONTINUITY_CONSTRAINTS`

## Emergency Override

If core rules must be modified:
1. Document the reason for the change
2. Update this CORE_RULES.md document
3. Update related requirements and design documents
4. Validate that all existing implementations remain compatible
5. Update AI development prompts and constraints
6. **NEW**: Update runtime validation rules in `LayerAccessValidator`
7. **NEW**: Regenerate system documentation with new boundaries