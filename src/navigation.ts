import { MAP, type Obstacle } from "./world";

/** A compact, precomputed walkability grid shared by all competitors. */
export class Navigation {
  readonly cell = 2;
  readonly side = Math.ceil((MAP * 2) / this.cell);
  readonly blocked: Uint8Array;

  constructor(obstacles: readonly Obstacle[]) {
    this.blocked = new Uint8Array(this.side * this.side);
    for (let z = 0; z < this.side; z++)
      for (let x = 0; x < this.side; x++) {
        const wx = this.world(x),
          wz = this.world(z);
        this.blocked[z * this.side + x] = obstacles.some(
          (o) =>
            Math.abs(wx - o.x) < o.w / 2 + 1 &&
            Math.abs(wz - o.z) < o.d / 2 + 1,
        )
          ? 1
          : 0;
      }
  }

  private world(n: number) {
    return -MAP + (n + 0.5) * this.cell;
  }
  private coord(n: number) {
    return Math.max(
      0,
      Math.min(this.side - 1, Math.floor((n + MAP) / this.cell)),
    );
  }

  /** A* with diagonal corner checks. Returns the route without the start cell. */
  route(
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
  ): { x: number; z: number }[] {
    const side = this.side;
    const start = this.coord(fromZ) * side + this.coord(fromX);
    let goal = this.coord(toZ) * side + this.coord(toX);
    if (this.blocked[goal]) {
      let best = Infinity;
      for (
        let z = Math.max(0, this.coord(toZ) - 4);
        z <= Math.min(side - 1, this.coord(toZ) + 4);
        z++
      ) {
        for (
          let x = Math.max(0, this.coord(toX) - 4);
          x <= Math.min(side - 1, this.coord(toX) + 4);
          x++
        ) {
          const id = z * side + x,
            d = (this.world(x) - toX) ** 2 + (this.world(z) - toZ) ** 2;
          if (!this.blocked[id] && d < best) {
            best = d;
            goal = id;
          }
        }
      }
    }
    if (start === goal) return [{ x: toX, z: toZ }];
    const costs = new Float32Array(side * side).fill(Infinity);
    const previous = new Int32Array(side * side).fill(-1);
    const closed = new Uint8Array(side * side);
    const heap: { id: number; score: number }[] = [];
    const push = (id: number, score: number) => {
      let i = heap.length;
      heap.push({ id, score });
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].score <= score) break;
        heap[i] = heap[p];
        i = p;
      }
      heap[i] = { id, score };
    };
    const pop = () => {
      const first = heap[0],
        last = heap.pop()!;
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let c = i * 2 + 1;
          if (c + 1 < heap.length && heap[c + 1].score < heap[c].score) c++;
          if (heap[c].score >= last.score) break;
          heap[i] = heap[c];
          i = c;
        }
        heap[i] = last;
      }
      return first.id;
    };
    const gx = goal % side,
      gz = Math.floor(goal / side);
    costs[start] = 0;
    push(start, 0);
    while (heap.length) {
      const id = pop();
      if (closed[id]) continue;
      if (id === goal) break;
      closed[id] = 1;
      const x = id % side,
        z = Math.floor(id / side);
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = x + dx,
            nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= side || nz >= side) continue;
          const next = nz * side + nx;
          if (
            this.blocked[next] ||
            closed[next] ||
            (dx &&
              dz &&
              (this.blocked[z * side + nx] || this.blocked[nz * side + x]))
          )
            continue;
          const cost = costs[id] + (dx && dz ? 1.4142 : 1);
          if (cost >= costs[next]) continue;
          costs[next] = cost;
          previous[next] = id;
          push(next, cost + Math.hypot(nx - gx, nz - gz));
        }
    }
    if (previous[goal] === -1) return [];
    const result: { x: number; z: number }[] = [];
    for (let id = goal; id !== start; id = previous[id])
      result.push({
        x: this.world(id % side),
        z: this.world(Math.floor(id / side)),
      });
    result.reverse();
    if (!this.blocked[this.coord(toZ) * side + this.coord(toX)])
      result.push({ x: toX, z: toZ });
    return result;
  }
}
