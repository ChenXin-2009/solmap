# 卫星系统设计与扩展指南

目的：为项目建立统一、标准且易扩展的卫星（moons）支持，使新增卫星变得简单且可维护。

核心设计要点：

- 卫星数据集中在 `src/lib/astronomy/orbit.ts` 的 `SATELLITE_DEFINITIONS` 中。
- 卫星在 `getCelestialBodies(julianDay)` 中被计算并以普通 CelestialBody 的形式追加返回，字段中会包含 `parent` 与 `isSatellite: true`。
- 渲染端复用现有的 `Planet` 类来渲染卫星（统一样式：球体 + 颜色 + 标记圈 + 标签）。
- 卫星轨道使用新的 `SatelliteOrbit`（在 `src/lib/3d/SatelliteOrbit.ts`）来绘制圆形轨道，轨道的位置（中心）会在每帧更新以跟随母行星。

如何添加新的卫星：

1. 打开 `src/lib/astronomy/orbit.ts`，在 `SATELLITE_DEFINITIONS` 中找到对应母行星的数组（key 为小写母星名），添加一项：

```ts
{
  name: 'NewMoon',
  a: <semi-major-axis in AU>,
  periodDays: <orbital period in days>,
  radius: <moon radius in AU>,
  color: '#rrggbb',
  phase?: <0-1 initial phase fraction>
}
```

2. 在 `src/lib/astronomy/names.ts` 中为该卫星添加本地化名称（en/zh）。

3. 运行并观察：系统会在 `getCelestialBodies()` 中自动计算卫星在当前时间的坐标，并在初始化时自动创建卫星的 `Planet` 和 `SatelliteOrbit`。

实现注意事项与扩展建议：

- 目前卫星轨道使用简化的圆形轨道（同一平面、无偏心率及倾角），可以在 `SATELLITE_DEFINITIONS` 中增加 `i`/`e`/`omega` 等字段，并在计算时使用更精确的轨道方程来替换简单圆轨道。
- 若需要更真实或复杂的渲染，可以为大型卫星预生成不同分辨率 LOD 几何体并在 `Planet` 或 `Satellite` 上进行切换。
- 可在未来将 `SatelliteOrbit` 拓展为带渐变的轨道（类似 `OrbitCurve` 的渐变实现），以提高视觉效果。

维护提示：

- 新增卫星应同时增加 `names.ts` 的中英文映射，保证 UI 显示友好。
- 如需禁用某颗卫星，可以通过 `SATELLITE_DEFINITIONS` 注释或在 UI 中提供开关（连接到 `SATELLITE_CONFIG`）。

---

感谢使用此扩展架构，如需我将现有某颗卫星改为更真实轨道（例如倾斜、偏心），我可以帮你把圆形轨道替换为真实的轨道方程并展示效果。