# Space-Time Foundation System Physics

## Core Physical Principles (10-Line Summary)

1. **Single Authoritative Reference Frame**: All physical calculations use ICRF/J2000 Heliocentric coordinates (km, km/s, JD)
2. **Time Authority Exclusivity**: Only TimeAuthority can modify system time, enforcing continuity constraints (max 1-day jumps)
3. **Physical Layer Supremacy**: Space-Time Core provides authoritative celestial body states via VSOP87 ephemeris calculations
4. **Render Layer Isolation**: Render components access physical data read-only through RenderLayerInterface, never direct computation
5. **StateVector Purity**: All physical quantities (position, velocity, radius) remain unscaled in authoritative units
6. **Ephemeris Provider Architecture**: Pluggable providers (VSOP87, JPL, etc.) route through EphemerisRouter with priority management
7. **Layer Boundary Enforcement**: Runtime validation prevents render layer from accessing write operations or direct ephemeris
8. **Scale Strategy Separation**: Visual scaling exists only in render layer, physical positions remain immutable
9. **Time Continuity Preservation**: Quantified constraints prevent discontinuities that would break orbital mechanics
10. **Hierarchical Body Management**: Celestial bodies organized in parent-child relationships (Sun→Planets→Satellites) with metadata

## Architecture Overview

The Space-Time Foundation establishes a trustworthy coordinate system for aerospace applications by enforcing strict separation between authoritative physical calculations (Physical Layer) and display transformations (Render Layer). This ensures that all astronomical computations maintain scientific accuracy while providing flexible visualization capabilities.