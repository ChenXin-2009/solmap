// TrailHistory - minimal trail manager used by canvas renderer

export type TrailPoint = { x: number; y: number; timestamp: number };

export class TrailHistory {
  private trails: Map<string, TrailPoint[]> = new Map();
  private frameCounter = 0;

  addPoint(bodyName: string, x: number, y: number, maxLength = 200, samplingRate = 1): void {
    this.frameCounter++;
    if (samplingRate > 1 && this.frameCounter % samplingRate !== 0) return;

    if (!this.trails.has(bodyName)) this.trails.set(bodyName, []);
    const trail = this.trails.get(bodyName)!;
    trail.push({ x, y, timestamp: Date.now() });
    if (trail.length > maxLength) {
      trail.splice(0, trail.length - maxLength);
    }
  }

  getTrail(bodyName: string): TrailPoint[] {
    return this.trails.get(bodyName) ?? [];
  }

  clear(bodyName?: string) {
    if (bodyName) this.trails.delete(bodyName);
    else this.trails.clear();
  }
}
