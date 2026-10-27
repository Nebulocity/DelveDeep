export function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function safeExitPosition(width, height, anchor, avoid = [], insets = {}) {
  const left = insets.left ?? 24, right = width - (insets.right ?? 24) - 290;
  const top = insets.top ?? 136, bottom = height - (insets.bottom ?? 24) - 84;
  const corners = { 'top-left': { x: left, y: top }, 'top-right': { x: right, y: top },
    'bottom-left': { x: left, y: bottom }, 'bottom-right': { x: right, y: bottom } };
  const candidates = [corners[anchor], ...Object.values(corners)].filter(Boolean);
  for (let y = top; y <= bottom; y += 90) candidates.push({ x: left, y }, { x: right, y });
  return candidates.map(p => ({ ...p, width: 290, height: 84 }))
    .find(p => p.y >= 0 && p.y + 84 <= height && avoid.every(b => !overlaps(p, b)))
    ?? { x: right, y: 0, width: 290, height: 84 };
}

export function preferredInstructionPosition(width, height, w, h, avoid, insets, preference = {}) {
  let p;
  const left = insets.left ?? 24, right = width - (insets.right ?? 24) - w;
  const top = insets.top ?? 136, bottom = height - (insets.bottom ?? 24) - h;
  // Canvas coordinates preserve the panel's top-left point when its text changes height.
  if (preference.anchor === 'preferred' && preference.space === 'canvas') p = { x: width * preference.x, y: height * preference.y };
  else if (preference.anchor === 'preferred') p = { x: left + Math.max(0, right - left) * preference.x, y: top + Math.max(0, bottom - top) * preference.y };
  else if (preference.anchor && preference.anchor !== 'auto') p = { x: preference.anchor.endsWith('left') ? left : right,
    y: preference.anchor.startsWith('top') ? top : bottom };
  if (p && p.x >= left && p.x <= right && p.y >= top && p.y <= bottom && avoid.every(b => !overlaps({ ...p, width: w, height: h }, b))) return { ...p, width: w, height: h };
  if (preference.anchor === 'preferred' && Number.isFinite(p?.x) && Number.isFinite(p?.y) && right >= left && bottom >= top) {

    // A dragged preference should settle beside an obstruction, not jump to an
    // unrelated default. The nearest safe rectangle lies at the requested point,
    // a canvas inset or an obstacle edge, all measured in logical canvas pixels.
    const x = Math.max(left, Math.min(right, p.x)), y = Math.max(top, Math.min(bottom, p.y));
    const xs = [...new Set([x, left, right, ...avoid.flatMap(b => [b.x - w, b.x + b.width])])].filter(value => value >= left && value <= right);
    const ys = [...new Set([y, top, bottom, ...avoid.flatMap(b => [b.y - h, b.y + b.height])])].filter(value => value >= top && value <= bottom);
    let nearest = null, distance = Infinity;
    for (const cx of xs) for (const cy of ys) {
      const squaredDistance = (cx - p.x) ** 2 + (cy - p.y) ** 2;
      if (squaredDistance >= distance) continue;
      const candidate = { x: cx, y: cy, width: w, height: h };
      if (avoid.some(b => overlaps(candidate, b))) continue;
      nearest = candidate; distance = squaredDistance;
    }
    return nearest;
  }
  return instructionPosition(width, height, w, h, avoid, insets);
}

// Instruction panels never receive input. If every placement would cover a required
// control, omit the panel until space returns while keeping Exit available.
export function instructionPosition(width, height, panelWidth, panelHeight, avoid, insets = {}) {
  const left = insets.left ?? 30, right = insets.right ?? 30;
  const top = insets.top ?? 30, bottom = insets.bottom ?? 30;
  const candidates = [
    { x: left, y: height - panelHeight - bottom },
    { x: width - panelWidth - right, y: height - panelHeight - Math.max(bottom, 150) },
    { x: left, y: Math.max(top, 160) },
    { x: width - panelWidth - right, y: Math.max(top, 160) },
    { x: (width - panelWidth) / 2, y: Math.max(top, 160) },
    { x: left, y: height * 0.45 },
    { x: width - panelWidth - right, y: height * 0.45 },
    { x: (width - panelWidth) / 2, y: height - panelHeight - bottom },
    ...(Number.isFinite(insets.aboveY) ? [{ x: (width - panelWidth) / 2, y: insets.aboveY - panelHeight - 24 }] : []),
    { x: (width - panelWidth) / 2, y: height * 0.6 },
    { x: (width - panelWidth) / 2, y: (height - panelHeight) / 2 }
  ];
  return candidates.map(p => ({ ...p, width: panelWidth, height: panelHeight }))
    .find(p => p.x >= left && p.y >= top && p.x + p.width <= width - right
      && p.y + p.height <= height - bottom && avoid.every(a => !overlaps(p, a))) ?? null;
}
