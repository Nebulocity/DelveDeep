import zipfile
from io import BytesIO
from PIL import Image, ImageDraw
z = zipfile.ZipFile('work/elder-slime-object.zip')
ns = sorted(n for n in z.namelist() if 'slime_collapses' in n and '/north-east/' in n)
out = Image.new('RGB', (9 * 120, 140), '#444')
draw = ImageDraw.Draw(out)
colors = {(167, 201, 76), (123, 165, 91), (116, 129, 138)}
for index, name in enumerate(ns):
    image = Image.open(BytesIO(z.read(name))).convert('RGBA')
    if index:
        image.putdata([(r, g, b, 0 if (r, g, b) in colors else a) for r, g, b, a in image.getdata()])
    preview = image.resize((110, 110))
    out.paste(preview, (index * 120, 0), preview)
    draw.text((index * 120, 112), str(index), fill='white')
out.save('work/elder-death-ne-clean-preview.png')
