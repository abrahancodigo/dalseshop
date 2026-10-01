export function slideDistance(index, current, count) {
  let distance = ((index - current) % count + count) % count;
  if (distance > count / 2) distance -= count;
  return distance;
}

export function swipeStep(dx, dy, width) {
  const threshold = Math.max(32, Math.min(64, width * 0.1));
  return Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 1 : -1) : 0;
}
