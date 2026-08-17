# -*- coding: utf-8 -*-
"""
批量处理 AI 生成的素材图 → 网页可用资产：
1. 颜色量化（有限色板，像素画感）
2. 降采样到目标像素宽（LANCZOS）→ 最近邻放大回原尺寸（硬边像素）
3. 可选：从图片四边 flood-fill 抠除近白色背景 → 透明（借鉴参考仓库的
   clearConnectedBackground 思路：连通的白/近白区域才算背景，内容里的白色不受影响）

用法（项目根目录）：
  python tools/process_bg.py

按下面的 JOBS 配置逐张处理，输出到 assets/bg/pix/<name>.png
"""
import os
from PIL import Image

JOBS = [
    # (源文件, 像素宽, 色数, 抠白)
    ("hills-far.png",       192, 20, True),    # 远景山丘（白底）
    ("tree-line.png",       192, 20, True),    # 中景树线（白底）
    ("grass-fore.png",      192, 20, True),    # 草地前景（白底）
    ("night-sky.png",       224, 32, False),   # 夜空（满幅）
    ("pond.png",            192, 24, True),    # 钓鱼池塘（白底）
    ("flowerbed.png",       160, 20, True),    # 花田空地（白底）
    ("campfire.png",        144, 20, True),    # 篝火（白底）
    ("farm-map.png",        256, 28, False),   # 农场俯视地图（满幅）
    ("fortune-booth.png",   192, 24, True),    # 占卜师摊位（白底）
]

SRC_DIR = "assets/bg"
DST_DIR = "assets/bg/pix"


def quantize(im, colors):
    if colors <= 0:
        return im
    return im.convert("P", palette=Image.ADAPTIVE, colors=colors).convert("RGB")


def remove_white(im, thresh=230, maxdiff=32):
    """从四边 flood-fill 抠掉连通的近白区域（背景），返回 RGBA 图"""
    im = im.convert("RGBA")
    px = im.load()
    W, H = im.size
    visited = bytearray(W * H)
    stack = [(x, 0) for x in range(W)] + [(x, H - 1) for x in range(W)] \
          + [(0, y) for y in range(1, H - 1)] + [(W - 1, y) for y in range(1, H - 1)]

    def is_white(c):
        r, g, b = c[0], c[1], c[2]
        return r >= thresh and g >= thresh and b >= thresh \
            and max(r, g, b) - min(r, g, b) <= maxdiff

    while stack:
        x, y = stack.pop()
        idx = y * W + x
        if visited[idx]:
            continue
        visited[idx] = 1
        if not is_white(px[x, y]):
            continue
        px[x, y] = (255, 255, 255, 0)
        if x > 0: stack.append((x - 1, y))
        if x < W - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < H - 1: stack.append((x, y + 1))
    return im


def main():
    os.makedirs(DST_DIR, exist_ok=True)
    for name, width, colors, cut_white in JOBS:
        src = os.path.join(SRC_DIR, name)
        dst = os.path.join(DST_DIR, name)
        if not os.path.exists(src):
            print("skip (no file):", name)
            continue
        im = Image.open(src).convert("RGB")
        orig_w = im.width
        im = quantize(im, colors)
        small_h = max(1, round(im.height * width / im.width))
        small = im.resize((width, small_h), Image.LANCZOS)
        if cut_white:
            small = remove_white(small)
        scale = max(1, round(orig_w / width))
        out = small.resize((small.width * scale, small.height * scale), Image.NEAREST)
        out.save(dst)
        kb = os.path.getsize(dst) // 1024
        print("ok: %-18s %dx%d  %dKB  alpha=%s" % (name, out.width, out.height, kb, "yes" if cut_white else "no"))


if __name__ == "__main__":
    main()
