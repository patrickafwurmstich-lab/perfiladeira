import sys
from PIL import Image
out, fs = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).resize((640, 370)) for f in fs]
c = Image.new('RGB', (1280, 370 * ((len(ims) + 1) // 2)), 'white')
for i, im in enumerate(ims): c.paste(im, ((i % 2) * 640, (i // 2) * 370))
c.save(out)
