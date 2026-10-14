from PIL import Image, ImageDraw
from pathlib import Path
out = Path("assets")
out.mkdir(exist_ok=True)
im = Image.new("RGBA", (512, 512), (4, 17, 19, 255))
d = ImageDraw.Draw(im)
for r in range(246, 0, -1):
    k = (246 - r) / 246
    d.ellipse((256-r, 256-r, 256+r, 256+r), fill=(5+int(k*18), 38+int(k*50), 42+int(k*18), 255))
for x, y, r in [(361,139,88), (156,145,32), (232,115,17)]:
    d.ellipse((x-r,y-r,x+r,y+r), fill=(75,175,96,255) if r > 40 else (245,243,137,255))
for x, y, r in [(125,368,75),(385,365,83),(250,410,60)]:
    d.ellipse((x-r,y-r//3,x+r,y+r//3), fill=(41,133,113,255))
points = [(122,400),(122,124),(178,124),(332,318),(332,124),(390,124),(390,400),(333,400),(179,206),(179,400)]
d.line(points+[points[0]], fill=(1,27,24,255), width=33, joint="curve")
d.polygon(points, fill=(130,239,119,255))
d.line([(152,381),(152,155),(362,364),(362,151)], fill=(220,255,175,255), width=10, joint="curve")
d.arc((27,165,487,410), start=7,end=177, fill=(227,255,132,255),width=13)
d.arc((27,165,487,410), start=187,end=352, fill=(119,255,83,255),width=10)
d.ellipse((10,10,502,502),outline=(126,255,123,255),width=10)
im.save(out / "namek.png")
im.save(out / "namek.ico",format="ICO",sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print("Generated",out / "namek.ico")
