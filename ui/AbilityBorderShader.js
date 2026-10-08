// This string is a small GPU program, written in GLSL rather than JavaScript.
// Phaser sends resolution and time as uniform inputs. The shader runs for each pixel
// and writes its color and transparency to gl_FragColor. It only draws the glowing
// ability border; it has no effect on damage, cooldowns or other gameplay rules.

export const ABILITY_BORDER_FRAGMENT = `

// Medium precision is enough for this small decorative effect and is supported on phones.
precision mediump float;

// resolution is the surface size in pixels; time is the animation clock supplied by Phaser.
// fragCoord is this pixel's position. vec2 means a pair of numbers, such as x and y.
uniform vec2 resolution;
uniform float time;
varying vec2 fragCoord;

float borderHash(float value) {

  // A repeatable mix makes neighboring bits of the border sparkle differently.
  // fract keeps only the fractional part, giving a value from zero up to, but not including, one.
  return fract(sin(value * 12.9898) * 43758.5453);
}

void main() {

  // Shift the pixel origin from the corner to the surface center.
  // The border's half-size is 402 by 62, so the full outlined box is 804 by 124 pixels.
  // abs mirrors both sides. edge measures the signed distance from the closest box side.
  vec2 point = fragCoord - resolution * 0.5;
  vec2 outside = abs(point) - vec2(402.0, 62.0);
  float edge = max(outside.x, outside.y);
  if (abs(edge) > 7.0) {

    // Pixels more than seven pixels from the edge are transparent and need no more work.
    gl_FragColor = vec4(0.0);
    return;
  }


  // Unwrap the four sides into one distance around the rectangle.
  // 804 is the full width, 124 is the full height, and 928 is width plus height.
  // 1732 is two widths plus one height, the distance before starting the last side.
  float distanceAlong;
  if (outside.y > outside.x) {
    distanceAlong = point.y < 0.0 ? point.x + 402.0 : 928.0 + 402.0 - point.x;
  } else {
    distanceAlong = point.x > 0.0 ? 804.0 + point.y + 62.0 : 1732.0 + 62.0 - point.y;
  }


  // Move a repeating highlight 175 pixels per second around the border.
  // Each 185.6-pixel stretch gets a phase from 0 to 1. The bell-shaped exponential
  // makes its center bright and lets the edges fade instead of ending sharply.
  float phase = fract((distanceAlong + time * 175.0) / 185.6);
  float wave = exp(-pow((phase - 0.5) * 5.0, 2.0));

  // Give each four-pixel piece its own repeatable seed. step selects only some pieces.
  // Raising the sine wave to the sixth power makes a brief glint with a long quiet gap.
  float glintSeed = borderHash(floor(distanceAlong / 4.0));
  float glint = step(0.45, glintSeed)
    * pow(max(0.0, sin(time * (8.0 + glintSeed * 6.0) + glintSeed * 6.283)), 6.0);

  // smoothstep softens the visible line between one and three pixels from the edge.
  // The exponential adds a softer glow farther away. alpha blends their strengths
  // and stays below 0.9 so the effect does not cover the button completely.
  float line = 1.0 - smoothstep(1.0, 3.0, abs(edge));
  float glow = exp(-edge * edge * 0.23);
  float alpha = clamp(line * (0.12 + 0.30 * wave)
    + glow * (0.09 + 0.35 * wave + 0.65 * glint), 0.0, 0.9);

  // vec3 holds red, green and blue. mix blends warm gold toward pale gold as it brightens.
  // Multiply the color by alpha before output for the shader's premultiplied blending.
  vec3 gold = mix(vec3(1.0, 0.61, 0.12), vec3(1.0, 0.95, 0.7),
    clamp(wave * 0.5 + glint, 0.0, 1.0));
  gl_FragColor = vec4(gold * alpha, alpha);
}
`;
