export const ABILITY_BORDER_FRAGMENT = `
precision mediump float;

uniform vec2 resolution;
uniform float time;
varying vec2 fragCoord;

float borderHash(float value) {
  return fract(sin(value * 12.9898) * 43758.5453);
}

void main() {
  vec2 point = fragCoord - resolution * 0.5;
  vec2 outside = abs(point) - vec2(402.0, 62.0);
  float edge = max(outside.x, outside.y);
  if (abs(edge) > 7.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float distanceAlong;
  if (outside.y > outside.x) {
    distanceAlong = point.y < 0.0 ? point.x + 402.0 : 928.0 + 402.0 - point.x;
  } else {
    distanceAlong = point.x > 0.0 ? 804.0 + point.y + 62.0 : 1732.0 + 62.0 - point.y;
  }

  float phase = fract((distanceAlong + time * 175.0) / 185.6);
  float wave = exp(-pow((phase - 0.5) * 5.0, 2.0));
  float glintSeed = borderHash(floor(distanceAlong / 4.0));
  float glint = step(0.45, glintSeed)
    * pow(max(0.0, sin(time * (8.0 + glintSeed * 6.0) + glintSeed * 6.283)), 6.0);
  float line = 1.0 - smoothstep(1.0, 3.0, abs(edge));
  float glow = exp(-edge * edge * 0.23);
  float alpha = clamp(line * (0.12 + 0.30 * wave)
    + glow * (0.09 + 0.35 * wave + 0.65 * glint), 0.0, 0.9);
  vec3 gold = mix(vec3(1.0, 0.61, 0.12), vec3(1.0, 0.95, 0.7),
    clamp(wave * 0.5 + glint, 0.0, 1.0));
  gl_FragColor = vec4(gold * alpha, alpha);
}
`;
