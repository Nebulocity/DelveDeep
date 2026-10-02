import zipfile
from io import BytesIO
from PIL import Image, ImageDraw
z = zipfile.ZipFile('work/elder-slime-object.zip')
ns = sorted(n for n in z.namelist() if n.startswith('animations/The_existing_crowned') and '/north-west/' in n)
out = Image.new('RGB', (5 * 160, 180), '#444')
draw = ImageDraw.Draw(out)
colors = {(116, 129, 138), (123, 165, 91)}
for index, name in enumerate(ns):
    image = Image.open(BytesIO(z.read(name))).convert('RGBA')
    if index:
        image.putdata([(r, g, b, 0 if (r, g, b) in colors else a) for r, g, b, a in image.getdata()])
    preview = image.resize((150, 150))
    out.paste(preview, (index * 160, 0), preview)
    draw.text((index * 160, 152), str(index), fill='white')
out.save('work/elder-block-nw-clean-preview.png')
