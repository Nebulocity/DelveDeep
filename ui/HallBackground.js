// We build the Hall background and its decorative layers here. Depth controls which
// surface sits behind another; decorations should not catch menu touches.

export function addHallBackground(scene, shadeAlpha = 0.32) {

  // The braces pull named fields into local variables. This reads those fields without
  // copying the whole source object.
  const { width, height } = scene.scale;
  const image = scene.add.image(width / 2, height / 2, 'adventurers-hall');

  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  image.setScale(Math.max(width / image.width, height / image.height));
  if (shadeAlpha > 0) scene.add.rectangle(width / 2, height / 2, width, height, 0x120904, shadeAlpha);
  return image;
}
