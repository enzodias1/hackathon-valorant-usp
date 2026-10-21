// Grade caminhável de cada mapa (gerada por pipeline/navgrid.py a partir do minimapa oficial) e busca de caminho (A*).
// Serve ao replay: entre um registro e outro, o jogador anda pelos corredores em vez de atravessar paredes.
// Sem React: as contas rodam uma vez por round (useMemo) e funcionam também na renderização do servidor.
import type { UV } from "./minimap";

export type NavGridRaw = { n: number; walk: string; spawn: { atk?: [number, number]; def?: [number, number] } };

export type NavGrid = {
  n: number;
  walk: Uint8Array; // 1 = chão; linha a linha (v), depois coluna (u)
  spawn: { atk?: UV; def?: UV };
  // memória reaproveitada entre buscas (a geração evita limpar os vetores a cada busca)
  // g em Float64: com Float32 o arredondamento às vezes guarda um custo MAIOR que o calculado e a busca não termina
  ws: { g: Float64Array; came: Int32Array; seen: Int32Array; done: Int32Array; gen: number };
};

export function decodeNavGrid(raw: NavGridRaw): NavGrid {
  const bin = atob(raw.walk);
  const size = raw.n * raw.n;
  const walk = new Uint8Array(size);
  for (let i = 0; i < size; i++) walk[i] = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1; // numpy packbits: bit mais alto primeiro
  const uv = (p?: [number, number]) => (p ? { u: p[0], v: p[1] } : undefined);
  return {
    n: raw.n, walk, spawn: { atk: uv(raw.spawn.atk), def: uv(raw.spawn.def) },
    ws: { g: new Float64Array(size), came: new Int32Array(size), seen: new Int32Array(size), done: new Int32Array(size), gen: 0 },
  };
}

const cellOf = (g: NavGrid, p: UV) => {
  const c = Math.min(g.n - 1, Math.max(0, Math.floor(p.u * g.n)));
  const r = Math.min(g.n - 1, Math.max(0, Math.floor(p.v * g.n)));
  return r * g.n + c;
};
const centerOf = (g: NavGrid, i: number): UV => ({ u: ((i % g.n) + 0.5) / g.n, v: (Math.floor(i / g.n) + 0.5) / g.n });

/** Célula de chão mais próxima (posições na beira da parede caem fora da grade às vezes); -1 se não houver perto. */
function nearestFloor(g: NavGrid, i: number, maxR = 6) {
  if (g.walk[i]) return i;
  const r0 = Math.floor(i / g.n), c0 = i % g.n;
  for (let r = 1; r <= maxR; r++) {
    let best = -1, bestD = Infinity;
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== r) continue;
        const rr = r0 + dr, cc = c0 + dc;
        if (rr < 0 || cc < 0 || rr >= g.n || cc >= g.n || !g.walk[rr * g.n + cc]) continue;
        const d = dr * dr + dc * dc;
        if (d < bestD) { bestD = d; best = rr * g.n + cc; }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

/** Linha de visada entre dois pontos só por cima do chão (amostras a cada 0,4 célula). */
function clear(g: NavGrid, a: UV, b: UV) {
  const steps = Math.ceil((Math.hypot(b.u - a.u, b.v - a.v) * g.n) / 0.4);
  for (let s = 1; s < steps; s++) {
    const f = s / steps;
    if (!g.walk[cellOf(g, { u: a.u + (b.u - a.u) * f, v: a.v + (b.v - a.v) * f })]) return false;
  }
  return true;
}

class Heap {
  private f: number[] = [];
  private i: number[] = [];
  get size() { return this.i.length; }
  push(f: number, i: number) {
    this.f.push(f); this.i.push(i);
    let k = this.i.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.f[p] <= this.f[k]) break;
      [this.f[p], this.f[k]] = [this.f[k], this.f[p]]; [this.i[p], this.i[k]] = [this.i[k], this.i[p]];
      k = p;
    }
  }
  pop() {
    const top = this.i[0];
    const lf = this.f.pop()!, li = this.i.pop()!;
    if (this.i.length) {
      this.f[0] = lf; this.i[0] = li;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < this.i.length && this.f[l] < this.f[m]) m = l;
        if (r < this.i.length && this.f[r] < this.f[m]) m = r;
        if (m === k) break;
        [this.f[m], this.f[k]] = [this.f[k], this.f[m]]; [this.i[m], this.i[k]] = [this.i[k], this.i[m]];
        k = m;
      }
    }
    return top;
  }
}

/**
 * Caminho pelo chão de `a` até `b` (A* em 8 direções, sem cortar quina), suavizado: só ficam os pontos de virada.
 * Começa e termina nas posições exatas. `null` se um dos pontos estiver longe do chão ou não houver caminho.
 */
export function findPath(g: NavGrid, a: UV, b: UV): UV[] | null {
  const s = nearestFloor(g, cellOf(g, a));
  const t = nearestFloor(g, cellOf(g, b));
  if (s < 0 || t < 0) return null;
  if (s === t || clear(g, a, b)) return [a, b];
  const { n, walk } = g;
  const ws = g.ws;
  const gen = ++ws.gen;
  const tr = Math.floor(t / n), tc = t % n;
  const h = (i: number) => {
    const dr = Math.abs(Math.floor(i / n) - tr), dc = Math.abs((i % n) - tc);
    return Math.max(dr, dc) + (Math.SQRT2 - 1) * Math.min(dr, dc);
  };
  const heap = new Heap();
  ws.seen[s] = gen; ws.g[s] = 0; ws.came[s] = -1;
  heap.push(h(s), s);
  let found = false;
  while (heap.size) {
    const cur = heap.pop();
    if (cur === t) { found = true; break; }
    if (ws.done[cur] === gen) continue; // já expandido com custo menor (entrada antiga na fila)
    ws.done[cur] = gen;
    const r = Math.floor(cur / n), c = cur % n;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const ni = rr * n + cc;
        if (!walk[ni]) continue;
        if (dr && dc && (!walk[r * n + cc] || !walk[rr * n + c])) continue; // sem cortar quina de parede
        const ng = ws.g[cur] + (dr && dc ? Math.SQRT2 : 1);
        if (ws.seen[ni] === gen && ng >= ws.g[ni]) continue;
        ws.seen[ni] = gen; ws.g[ni] = ng; ws.came[ni] = cur;
        heap.push(ng + h(ni), ni);
      }
    }
  }
  if (!found) return null;
  const cells: number[] = [];
  for (let i = t; i !== -1; i = ws.came[i]) cells.push(i);
  cells.reverse();
  // suaviza: a partir de cada ponto, pula direto para o mais distante que ainda se enxerga pelo chão
  const pts: UV[] = [a];
  let k = 0;
  const pt = (i: number) => (i === 0 ? a : i === cells.length - 1 ? b : centerOf(g, cells[i]));
  while (k < cells.length - 1) {
    let j = cells.length - 1;
    while (j > k + 1 && !clear(g, pt(k), pt(j))) j--;
    pts.push(pt(j));
    k = j;
  }
  return pts;
}
