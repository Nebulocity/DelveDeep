// Phaser text uses one color per object. Small measured spans keep rank gains green inline.
export function rankComparisonText(scene, value, width, size, color) {
  const group = scene.add.container(0, 0);
  const rows = [[]];
  let lineWidth = 0;
  const lineHeight = size + 10;

  // Markers contain an arrow and its difference. Plain words and spaces retain the body color.
  const tokens = value.match(/\{\{[^}]+\}\}|\n|[^\s{}]+|[ \t]+/g) ?? [];
  for (const token of tokens) {
    if (token === '\n') {
      rows.push([]);
      lineWidth = 0;
      continue;
    }
    if (!lineWidth && /^\s+$/.test(token)) continue;
    const gain = token.startsWith('{{');
    const span = scene.add.text(0, 0, gain ? token.slice(2, -2) : token, {
      fontFamily: 'Arial', fontSize: `${size}px`, color: gain ? '#72d79a' : color
    }).setOrigin(0, 0);
    if (lineWidth && lineWidth + span.width > width) {
      rows.push([]);
      lineWidth = 0;
      if (/^\s+$/.test(token)) { span.destroy(); continue; }
    }
    span.setX(lineWidth);
    rows.at(-1).push(span);
    group.add(span);
    lineWidth += span.width;
  }

  // Center each wrapped line independently inside the shared details panel.
  rows.forEach((row, index) => {
    const usedWidth = row.reduce((sum, span) => sum + span.width, 0);
    for (const span of row) span.setPosition(span.x + (width - usedWidth) / 2, index * lineHeight);
  });
  group.setSize(width, rows.length * lineHeight);
  return group;
}
