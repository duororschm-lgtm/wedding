# -*- coding: utf-8 -*-
"""处理用户生成的 4 张图。
头像：不抠底（NPC 头像本来就是带色底正方形），中心裁方 + 像素化。
狐狸装饰：色度范围抠图（低饱和 + 亮度落在边缘背景范围内才判为底，不穿透主体）+ 小岛清理。
合照：压尺寸转 webp。
"""
from PIL import Image, ImageFilter
from collections import deque
import os, sys

SRC = os.path.join(os.path.dirname(__file__), '..', 'assets', 'bg')
DST_CHAR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'tpl', 'characters')
DST_TPL = os.path.join(os.path.dirname(__file__), '..', 'assets', 'tpl')
DST_PHOTO = os.path.join(os.path.dirname(__file__), '..', 'assets', 'bg', 'pix')

def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')

def pixelate(im, target_w):
    """经典像素化：BOX 降采样 + NEAREST 放大（像素块边缘干净）。"""
    w, h = im.size
    h2 = max(1, int(h * target_w / w))
    small = im.resize((target_w, h2), Image.BOX)
    return small.resize((target_w * 2, h2 * 2), Image.NEAREST)

def center_square(im):
    w, h = im.size
    side = min(w, h)
    return im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))

def make_avatar(name, out, out_w=128, px_factor=64):
    """保留原底，中心裁方 + 像素化。"""
    im = load(name)
    im = center_square(im)
    im = pixelate(im, px_factor)
    im = im.resize((out_w, out_w), Image.LANCZOS)
    im.save(out, optimize=True)
    print('saved', out, im.size)

def edge_range(im):
    """统计四条边缘的背景色范围（避开角落 1/8 的暗角取整条边）。"""
    w, h = im.size
    px = im.load()
    mins = [255, 255, 255]; maxs = [0, 0, 0]
    for i in range(0, w, 7):
        for xy in [(i, 2), (i, h - 3)]:
            for c in range(3):
                v = px[xy][c]
                mins[c] = min(mins[c], v); maxs[c] = max(maxs[c], v)
    for j in range(0, h, 7):
        for xy in [(2, j), (w - 3, j)]:
            for c in range(3):
                v = px[xy][c]
                mins[c] = min(mins[c], v); maxs[c] = max(maxs[c], v)
    return mins, maxs

def range_key(im, sat_th=10, pad=14):
    """低饱和 + 亮度在边缘背景范围内 → 背景（透明）。"""
    mins, maxs = edge_range(im)
    px = im.load()
    w, h = im.size
    alpha = Image.new('L', (w, h))
    apx = alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            lum = (r + g + b) / 3
            if abs(r - g) <= sat_th and abs(g - b) <= sat_th \
               and mins[0] - pad <= r <= maxs[0] + pad \
               and mins[1] - pad <= g <= maxs[1] + pad \
               and mins[2] - pad <= b <= maxs[2] + pad:
                apx[x, y] = 0
            else:
                apx[x, y] = 255
    return alpha

def clean_small_islands(alpha, min_frac=0.004):
    """把小于 min_frac 的不透明小岛清成透明（去噪点/残渣）。"""
    w, h = alpha.size
    px = alpha.load()
    seen = bytearray(w * h)
    total = w * h
    removed = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            if seen[y * w + x] or px[x, y] < 200:
                continue
            q = deque([(x, y)]); seen[y * w + x] = 1
            comp = [(x, y)]
            while q:
                cx, cy = q.popleft()
                for nx, ny in [(cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)]:
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny*w+nx] and px[nx, ny] >= 200:
                        seen[ny*w+nx] = 1
                        q.append((nx, ny)); comp.append((nx, ny))
            if len(comp) < total * min_frac:
                for cx, cy in comp:
                    removed[cy*w+cx] = 1
    for y in range(h):
        for x in range(w):
            if removed[y*w+x]:
                px[x, y] = 0
    return alpha

def crop_alpha(im, margin=0.08):
    a = im.split()[3]
    bbox = a.getbbox()
    if not bbox:
        return im
    w, h = im.size
    mx = int(w * margin); my = int(h * margin)
    l = max(0, bbox[0] - mx); t = max(0, bbox[1] - my)
    r = min(w, bbox[2] + mx); b = min(h, bbox[3] + my)
    return im.crop((l, t, r, b))

def soften_alpha(im):
    a = im.split()[3].filter(ImageFilter.MinFilter(3))
    a = a.filter(ImageFilter.GaussianBlur(0.8))
    r, g, b, _ = im.split()
    return Image.merge('RGBA', (r, g, b, a))

def make_banquet_photo(name, out, target_w=800):
    """婚宴模块新人照：压宽转 webp（不像素化、不抠底，保留原照质感）。"""
    im = load(name).convert('RGB')
    w, h = im.size
    h2 = max(1, int(h * target_w / w))
    im = im.resize((target_w, h2), Image.LANCZOS)
    im.save(out, quality=86)
    print('saved', out, im.size)

def main():
    steps = set(sys.argv[1:]) if len(sys.argv) > 1 else set(['all'])
    run = lambda k: 'all' in steps or k in steps

    # ① 新郎 / ② 新娘 / ③ 狐狸头像：保留原底 + 像素化
    if run('avatar'):
        make_avatar('新郎.jfif', os.path.join(DST_CHAR, 'couple-groom.png'))
        make_avatar('新娘.jfif', os.path.join(DST_CHAR, 'couple-bride.png'))
        make_avatar('狐狸.jfif', os.path.join(DST_CHAR, 'mystery.png'))

    # ④ 狐狸装饰版（邀请函区）：范围抠图 + 小岛清理 + 像素化
    if run('deco'):
        fox = load('狐狸.jfif')
        alpha = range_key(fox)
        alpha = clean_small_islands(alpha)
        fox.putalpha(alpha)
        fox = crop_alpha(fox, margin=0.10)
        fox = soften_alpha(fox)
        fox = pixelate(fox, 180)
        fox.save(os.path.join(DST_TPL, 'fox-deco.webp'), quality=92)
        print('saved', os.path.join(DST_TPL, 'fox-deco.webp'), fox.size)

    # ⑤ 合照 → 分享卡 cover.webp + 照片墙 pix/couple-photo.webp
    if run('cover'):
        couple = load('合照.jfif').convert('RGB')
        cover = couple.resize((1200, 675), Image.LANCZOS)
        cover.save(os.path.join(DST_TPL, 'cover.webp'), quality=88)
        print('saved', os.path.join(DST_TPL, 'cover.webp'), cover.size)
        photo = couple.resize((900, int(900 * couple.height / couple.width)), Image.LANCZOS)
        photo.save(os.path.join(DST_PHOTO, 'couple-photo.webp'), quality=86)
        print('saved', os.path.join(DST_PHOTO, 'couple-photo.webp'), photo.size)

    # ⑥⑦ 婚宴模块新人照：女方=新娘全身、男方=新郎全身
    if run('photo'):
        make_banquet_photo('新娘全身.jfif', os.path.join(DST_TPL, 'bride-photo.webp'))
        make_banquet_photo('新郎全身.jfif', os.path.join(DST_TPL, 'groom-photo.webp'))

if __name__ == '__main__':
    main()
