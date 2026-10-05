export function addHallBackground(scene, shadeAlpha = 0.32) {
  const { width, height } = scene.scale;
  const image = scene.add.image(width / 2, height / 2, 'adventurers-hall');
  image.setScale(Math.max(width / image.width, height / image.height));
  if (shadeAlpha > 0) scene.add.rectangle(width / 2, height / 2, width, height, 0x120904, shadeAlpha);
  return image;
}
