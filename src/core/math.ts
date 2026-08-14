export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function angleDelta(a: number, b: number): number {
  let da = Math.abs(a - b) % (Math.PI * 2);
  if (da > Math.PI) da = Math.PI * 2 - da;
  return da;
}

export function inArc(
  originX: number,
  originY: number,
  facingX: number,
  facingY: number,
  targetX: number,
  targetY: number,
  range: number,
  arc: number,
): boolean {
  if (dist(originX, originY, targetX, targetY) > range) return false;
  const facing = Math.atan2(facingY, facingX);
  const toward = Math.atan2(targetY - originY, targetX - originX);
  return angleDelta(facing, toward) <= arc / 2;
}
