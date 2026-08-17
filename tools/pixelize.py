# -*- coding: utf-8 -*-
"""
把任意图片转成「真·像素画」：
1. 可选：先把颜色量化成有限色板（像素画感的关键）
2. 降采样到目标像素宽（LANCZOS，保留轮廓）
3. 再用最近邻（NEAREST）放大回原图宽度 —— 得到硬边方块像素

用法（在项目根目录运行）：
  python tools/pixelize.py 输入.png 输出.png [--width 192] [--colors 24] [--scale 4]

--width  降采样后的像素宽度（越小越"粗像素"），默认 192
--colors 量化色数（不填 = 不量化，保留原色彩）
--scale  放大倍数（不填 = 自动放大回输入图宽度）
示例：
  python tools/pixelize.py assets/bg/hills-far.png assets/bg/hills-far.png --width 160 --colors 20
（输入输出同名 = 原地转换，请先备份）
"""
import argparse
from PIL import Image

def main():
    ap = argparse.ArgumentParser(description="图片转像素画")
    ap.add_argument("src", help="输入图片路径")
    ap.add_argument("dst", help="输出图片路径")
    ap.add_argument("--width", type=int, default=192, help="降采样像素宽度，默认 192")
    ap.add_argument("--colors", type=int, default=0, help="量化色数，0=不量化，默认 0")
    ap.add_argument("--scale", type=int, default=0, help="放大倍数，0=自动放大回原宽，默认 0")
    args = ap.parse_args()

    im = Image.open(args.src).convert("RGB")
    orig_w = im.width

    if args.colors > 0:
        im = im.convert("P", palette=Image.ADAPTIVE, colors=args.colors).convert("RGB")

    # 等比降采样到目标像素宽
    small_h = max(1, round(im.height * args.width / im.width))
    small = im.resize((args.width, small_h), Image.LANCZOS)

    # 最近邻放大
    scale = args.scale or max(1, round(orig_w / args.width))
    out = small.resize((small.width * scale, small.height * scale), Image.NEAREST)

    out.save(args.dst)
    print("done: %s -> %s (%dx%d, %dx pixels)" % (args.src, args.dst, out.width, out.height, args.width))

if __name__ == "__main__":
    main()
