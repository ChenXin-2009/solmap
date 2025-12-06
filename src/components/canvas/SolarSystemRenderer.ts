// Minimal SolarSystemRenderer stub
// - 提供必要的方法以便在缺少完整版实现时通过构建和进行基本调试。

export class SolarSystemRenderer {
  private ctx: CanvasRenderingContext2D;
  public width: number;
  public height: number;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  updateSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  // alias for compatibility
  resize(width: number, height: number) {
    this.updateSize(width, height);
  }

  // Lightweight render: 清空画布并在左上角显示调试信息
  render(
    bodies: any[],
    viewOffset: any,
    zoom: number,
    scaleMode: any,
    trailHistory: any,
    trailEnabled: boolean,
    lang: string
  ) {
    try {
      this.ctx.save();
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.width, this.height);

      // 简单提示文字，帮助调试
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '12px sans-serif';
      this.ctx.fillText(`Bodies: ${Array.isArray(bodies) ? bodies.length : 'NA'}`, 8, 16);
      this.ctx.fillText(`Zoom: ${zoom}`, 8, 32);
      this.ctx.fillText(`ScaleMode: ${String(scaleMode)}`, 8, 48);
      this.ctx.fillText(`Trails: ${trailEnabled ? 'on' : 'off'}`, 8, 64);

      // 如 bodies 是数组且包含位置字段，可绘制极简点表示
      if (Array.isArray(bodies)) {
        this.ctx.fillStyle = '#FFCC00';
        for (let i = 0; i < Math.min(bodies.length, 50); i++) {
          const b = bodies[i];
          // 尝试读取可能存在的坐标字段 (x, y)
          const x = (b && (b.x ?? b.posX ?? b.position?.x)) ?? null;
          const y = (b && (b.y ?? b.posY ?? b.position?.y)) ?? null;
          if (typeof x === 'number' && typeof y === 'number') {
            // 将世界坐标简化映射到画布中心附近用于调试
            const cx = this.width / 2 + (x - (viewOffset?.x ?? 0)) * (zoom / 50);
            const cy = this.height / 2 + (y - (viewOffset?.y ?? 0)) * (zoom / 50);
            this.ctx.fillRect(cx - 1, cy - 1, 2, 2);
          }
        }
      }
    } finally {
      this.ctx.restore();
    }
  }
}
