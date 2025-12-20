# What This System Physically Represents

## Core Physical Meaning (10 lines)

This system represents a **Heliocentric Inertial Coordinate System (ICRF/J2000)** where:

1. **Origin**: Center of the Sun
2. **Time**: Julian Date (continuous astronomical time)
3. **Space**: 3D Cartesian coordinates in kilometers
4. **Motion**: Velocities in km/s relative to the inertial frame
5. **Bodies**: Point masses with physical radii (planets, satellites, spacecraft)
6. **Reference**: International Celestial Reference Frame (J2000.0 epoch)
7. **Scope**: Classical mechanics only (no relativistic corrections in Phase 1)
8. **Authority**: Single time source, single coordinate system
9. **Precision**: Suitable for mission planning and orbital mechanics
10. **Purpose**: Trustworthy foundation for aerospace applications

## What This Means Practically

- **Position (x,y,z)**: Kilometers from Sun's center in ICRF axes
- **Velocity (vx,vy,vz)**: Kilometers per second in ICRF axes  
- **Time (JD)**: Days since January 1, 4713 BCE (astronomical standard)
- **Radius (r)**: Physical radius of the body in kilometers

## What This System Is NOT

- Not a game engine coordinate system
- Not a rendering/graphics coordinate system  
- Not Earth-centered (geocentric)
- Not rotating with any celestial body
- Not including relativistic effects (Phase 1)
- Not handling attitude/orientation (Phase 1)

## Trust Guarantee

Every position query returns data that is:
- **Physically meaningful**: Real distances and times
- **Consistent**: Same reference frame for all bodies
- **Traceable**: Clear provenance from astronomical data sources
- **Extensible**: Ready for spacecraft, missions, and logistics