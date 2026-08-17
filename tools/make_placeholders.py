# -*- coding: utf-8 -*-
"""
生成 photos/ 下的像素风占位图（SVG）和分享预览图 share-preview.png
与 js/pixelart.js 使用同一套精灵网格，风格保持一致。
用法：python tools/make_placeholders.py
"""
import zlib
import struct
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PHOTOS = os.path.join(ROOT, "photos")

# ---------------- 调色板 ----------------
INK = "#4a2f1d"
SKY = "#9bd8ff"
SKY_LIGHT = "#c9ebff"
GRASS = "#6dbe45"
GRASS_DARK = "#4e9a3a"
WOOD = "#8b5a2b"
PAPER = "#fffdf5"
RED = "#e85d75"
RED_LIGHT = "#ff8fa5"
RED_DARK = "#c24b5e"
GOLD = "#ffc94d"
PINK = "#ffb3c1"
BLUE = "#4a7fd4"
WHITE = "#ffffff"
SKIN = "#ffd9b0"
HAIR = "#6b4226"
HAIR_LIGHT = "#8b5a2b"
BLUSH = "#ff9aae"
STRAW = "#f4d06f"
STRAW_DARK = "#d9b45a"
BLUE_DARK = "#3a66ae"
WOOD_LIGHT = "#b98a5a"
WINDOW = "#9bd8ff"

# ---------------- 精灵网格 ----------------
SUN = (["....YY....",
        "...YYYY...",
        "..YYYYYY..",
        ".YYYYYYYY.",
        "YYYYYYYYYY",
        "YYYYYYYYYY",
        "YYYYYYYYYY",
        ".YYYYYYYY.",
        "..YYYYYY..",
        "...YYYY..."], {"Y": GOLD})

CLOUD = (["...CCCC.....",
          "..CCCCCC....",
          ".CCCCCCCCCC.",
          "CCCCCCCCCCCC",
          "CCCCCCCCCCCC"], {"C": WHITE})

TREE = (["....G....",
         "...GGG...",
         "..GGGGG..",
         ".GGGGGGG.",
         "GGGGGGGGG",
         "GGgGGGGgG",
         ".GgGGGgG.",
         "..GGGGG..",
         "...TTT...",
         "...TTT...",
         "...TTT..."], {"G": GRASS, "g": GRASS_DARK, "T": WOOD})

FLOWER = (["..Y..",
           ".RYR.",
           ".RRR.",
           "..G..",
           "..G.."], {"Y": GOLD, "R": RED, "G": GRASS_DARK})

TUFT = (["..G..G..G.",
         ".GG.GG.GGG",
         "GGGGGGGGGG"], {"G": GRASS_DARK})

HEART = (["..H...X..",
          ".HHH.XXX.",
          "HHXXXXXXX",
          "XXXXXXXXS",
          ".XXXXXXSS",
          "..XXXXS..",
          "...XXX...",
          "....X...."], {"H": RED_LIGHT, "X": RED, "S": RED_DARK})

GROOM = ([
    "................",
    "................",
    ".....YYYYYY.....",
    "....YYYYYYYY....",
    "....YYyyyyYY....",
    ".YKKKKKKKKKKKKY.",
    ".YYYYYYYYYYYYYY.",
    "..HHFFFFFFFFHH..",
    "..HHFFFFFFFFHH..",
    "..HHFEFFFFEFHH..",
    "..HHFFFFFFFFHH..",
    "..HHFRFFFFRFHH..",
    "....FFFFFFFF....",
    "....FFF..FFF....",
    ".WWWWWWWWWWWWWW.",
    ".WWWWWWWWWWWWWW.",
    ".BBBBBBBBBBBBBB.",
    ".BbBBBBBBBBBBbB.",
    ".BbbBBBBBBBBbbB.",
    ".BBBBBBBBBBBBBB.",
    "..BBBBBBBBBBBB..",
    "..BBB......BBB..",
    "..BBB......BBB..",
    "..BBB......BBB..",
    "..OOO......OOO..",
    "..OOO......OOO..",
], {"Y": STRAW, "y": STRAW_DARK, "K": HAIR_LIGHT, "H": HAIR, "F": SKIN,
    "E": INK, "R": BLUSH, "W": PAPER, "B": BLUE, "b": BLUE_DARK, "O": WOOD})

BRIDE = ([
    "................",
    "................",
    "....VVVVVVVV....",
    "...VVVVVVVVVV...",
    "..VVVVVVVVVVVV..",
    "..VVHHHHHHHHVV..",
    "..VVHHHHHHHHVV..",
    "...HHFFFFFFHH...",
    "...HHFEFFEFHH...",
    "...HHFFFFFFHH...",
    "...HHFRFFRFHH...",
    "....FFFFFFFF....",
    ".....FF..FF.....",
    "....WWWWWWWW....",
    "..WWWWWWWWWWWW..",
    "..WWWWWWWWWWWW..",
    "..WWWWWRRWWWWW..",
    "..WWWWWWWWWWWW..",
    ".WWWWWWWWWWWWWW.",
    ".WWWWWWWWWWWWWW.",
    "..WWWRRRRRRWWW..",
    ".WWWWWWWWWWWWWW.",
    "WWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWW",
    ".WWWWWWWWWWWWWW.",
], {"V": WHITE, "H": HAIR_LIGHT, "F": SKIN, "E": INK, "R": BLUSH,
    "W": PAPER, "P": PINK})

HOUSE = ([
    "..RRRRRRRRRRRRRRRR..",
    ".RRRRRRRRRRRRRRRRRR.",
    "RWWWWWWWWWWWWWWWWWWR",
    "RWWWWWWWWWWWWWWWWWWR",
    "RWWBBBWWWWWWWWBBBWWR",
    "RWWBBBWWWWWWWWBBBWWR",
    "RWWWWWWWWWWWWWWWWWWR",
    "RWWWWWWWWWWWWWWWWWWR",
    "RWWWWWWWWWWWWWWWWWWR",
    "RWWWWWWWWWWWWWWWWWWR",
    "RWWWWWWWWDDDWWWWWWWR",
    "RWWWWWWWWDDDWWWWWWWR",
    "RWWWWWWWWDDDWWWWWWWR",
    "RWWWWWWWWDDDWWWWWWWR",
    "RWWWWWWWWDDDWWWWWWWR",
    "FFFFFFFFFFFFFFFFFFFF",
], {"R": RED_DARK, "W": "#fff8e7", "B": WINDOW, "D": WOOD, "F": WOOD_LIGHT})

# ---------------- SVG 渲染 ----------------
def svg_doc(w=80, h=60, cell=10):
    """返回 (parts, 尺寸)，parts 是一段段 svg 元素文本"""
    parts = []
    parts.append(
        '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
        'viewBox="0 0 %d %d" shape-rendering="crispEdges">' % (w * cell, h * cell, w, h))
    return parts


def draw(parts, grid, pal, x, y, cell=1):
    for gy, row in enumerate(grid):
        for gx, ch in enumerate(row):
            if ch == ".":
                continue
            parts.append('<rect x="%g" y="%g" width="%d" height="%d" fill="%s"/>'
                         % (x + gx * cell, y + gy * cell, cell, cell, pal[ch]))


def rect(parts, x, y, w, h, fill):
    parts.append('<rect x="%g" y="%g" width="%g" height="%g" fill="%s"/>' % (x, y, w, h, fill))


def label(parts, text):
    parts.append('<text x="74" y="57" font-size="4" font-family="monospace" '
                 'fill="#4a2f1d" opacity="0.55" text-anchor="end">%s</text>' % text)


def finish(parts):
    parts.append('</svg>')


def base_scene(parts, label_text):
    """天空 + 太阳 + 云 + 草地 + 标签"""
    rect(parts, 0, 0, 80, 60, SKY)
    rect(parts, 0, 40, 80, 20, GRASS)
    rect(parts, 0, 54, 80, 6, GRASS_DARK)
    draw(parts, SUN[0], SUN[1], 58, 5)
    draw(parts, CLOUD[0], CLOUD[1], 6, 7)
    for tx in range(0, 80, 12):
        draw(parts, TUFT[0], TUFT[1], tx, 53)
    if label_text:
        label(parts, label_text)


def write_svg(name, build, label_text):
    parts = svg_doc()
    build(parts, label_text)
    finish(parts)
    path = os.path.join(PHOTOS, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(parts))
    print("生成", os.path.relpath(path, ROOT))


# ---------------- 场景 ----------------
def scene1(parts, t):
    base_scene(parts, t)
    draw(parts, TREE[0], TREE[1], 10, 28)
    draw(parts, TREE[0], TREE[1], 60, 26)
    for fx, fy in [(32, 44), (44, 48), (52, 42), (22, 48), (68, 46)]:
        draw(parts, FLOWER[0], FLOWER[1], fx, fy)


def scene2(parts, t):
    base_scene(parts, t)
    draw(parts, GROOM[0], GROOM[1], 16, 28)
    draw(parts, BRIDE[0], BRIDE[1], 48, 28)
    draw(parts, HEART[0], HEART[1], 36, 14, cell=2)
    draw(parts, FLOWER[0], FLOWER[1], 28, 47)
    draw(parts, FLOWER[0], FLOWER[1], 56, 47)


def scene3(parts, t):
    base_scene(parts, t)
    draw(parts, HEART[0], HEART[1], 26, 16, cell=3)
    for fx in range(8, 76, 8):
        draw(parts, FLOWER[0], FLOWER[1], fx, 46)


def scene4(parts, t):
    base_scene(parts, t)
    draw(parts, TREE[0], TREE[1], 6, 30)
    draw(parts, TREE[0], TREE[1], 34, 26)
    draw(parts, TREE[0], TREE[1], 64, 30)
    for fx in [(20, 46), (48, 44), (58, 48)]:
        draw(parts, FLOWER[0], FLOWER[1], fx[0], fx[1])


def scene5(parts, t):
    base_scene(parts, t)
    draw(parts, CLOUD[0], CLOUD[1], 20, 10)
    draw(parts, CLOUD[0], CLOUD[1], 46, 16)
    for fx in range(10, 74, 10):
        draw(parts, FLOWER[0], FLOWER[1], fx, 45)


def scene6(parts, t):
    base_scene(parts, t)
    draw(parts, HOUSE[0], HOUSE[1], 30, 24, cell=2)
    for fx, fy in [(16, 47), (22, 45), (70, 47), (74, 45)]:
        draw(parts, FLOWER[0], FLOWER[1], fx, fy)


# ---------------- PNG（分享预览图） ----------------
def write_png(path, w, h, rows):
    raw = b"".join(b"\x00" + b"".join(bytes(px) + b"\xff" for px in row) for row in rows)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    print("生成", os.path.relpath(path, ROOT))


HEX = {SKY: (155, 216, 255), SKY_LIGHT: (201, 235, 255), GRASS: (109, 190, 69),
       GRASS_DARK: (78, 154, 58), GOLD: (255, 201, 77), WHITE: (255, 255, 255),
       RED: (232, 93, 117), RED_LIGHT: (255, 143, 165), RED_DARK: (194, 75, 94),
       WOOD: (139, 91, 43), WOOD_LIGHT: (185, 138, 90), PAPER: (255, 253, 245),
       INK: (74, 47, 29), SKIN: (255, 217, 176), HAIR: (107, 66, 38),
       HAIR_LIGHT: (139, 91, 43), BLUSH: (255, 154, 174), STRAW: (244, 208, 111),
       STRAW_DARK: (217, 180, 90), BLUE: (74, 127, 212), BLUE_DARK: (58, 102, 174),
       PINK: (255, 179, 193), "#fff8e7": (255, 248, 231), WINDOW: (155, 216, 255)}


def make_preview():
    W, H = 160, 90  # 画布（像素格），最后放大 4 倍 → 640×360
    top = HEX[SKY_LIGHT]
    bottom = HEX[SKY]
    grid = [[top] * W for _ in range(H)]
    for y in range(H):
        t = y / H
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        grid[y] = [c] * W
    # 草地
    for y in range(52, H):
        grid[y] = [HEX[GRASS]] * W
    for y in range(80, H):
        grid[y] = [HEX[GRASS_DARK]] * W
    # 太阳、云、草丛
    stamp(grid, SUN, 112, 6)
    stamp(grid, CLOUD, 18, 12)
    stamp(grid, CLOUD, 118, 20)
    for tx in range(0, W, 12):
        stamp(grid, TUFT, tx, 79)
    # 新人 + 爱心
    stamp(grid, GROOM, 58, 40)
    stamp(grid, BRIDE, 86, 40)
    stamp(grid, HEART, 72, 14, 2)
    stamp(grid, FLOWER, 50, 72)
    stamp(grid, FLOWER, 102, 72)

    # 放大 4 倍
    rows = []
    for y in range(H):
        for _ in range(4):
            row = []
            for x in range(W):
                for _ in range(4):
                    row.append(grid[y][x])
            rows.append(row)
    write_png(os.path.join(ROOT, "share-preview.png"), W * 4, H * 4, rows)


def stamp(grid, sprite, x, y, cell=1):
    sprite_grid, pal = sprite
    for gy, row in enumerate(sprite_grid):
        for gx, ch in enumerate(row):
            if ch == ".":
                continue
            color = HEX.get(pal[ch], pal[ch])
            for dy in range(cell):
                for dx in range(cell):
                    yy, xx = y + gy * cell + dy, x + gx * cell + dx
                    if 0 <= yy < len(grid) and 0 <= xx < len(grid[0]):
                        grid[yy][xx] = color


if __name__ == "__main__":
    os.makedirs(PHOTOS, exist_ok=True)
    scenes = [("photo1.svg", scene1, "照片位 1/6"),
              ("photo2.svg", scene2, "照片位 2/6"),
              ("photo3.svg", scene3, "照片位 3/6"),
              ("photo4.svg", scene4, "照片位 4/6"),
              ("photo5.svg", scene5, "照片位 5/6"),
              ("photo6.svg", scene6, "照片位 6/6")]
    for name, fn, text in scenes:
        write_svg(name, fn, text)
    make_preview()
