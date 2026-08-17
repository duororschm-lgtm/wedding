# Gemini 素材生成需求（提示词手册）

用 Gemini 生成背景素材时，把下面的英文提示词整段粘贴进去即可。
生成后把图片放进 `assets/bg/` 文件夹（文件名按下面标注的来），
再告诉 Claude「图放好了」，由它来集成进页面。

## 通用规则（每条提示词都要遵守的要点）

- **风格**：16-bit 复古像素画，硬边方块像素，**不要抗锯齿**，扁平色块，有限的调色板，温馨农场游戏风（类似经典种田游戏画面）
- **禁止**：文字、水印、签名、人物（除注明外）、平滑渐变、照片感
- **白底**：凡是标注「白底」的图，背景必须是纯白 #FFFFFF —— 网页上会用混合模式把白色抠掉，只剩前景
- **尺寸**：Gemini 默认比例即可，生成后我们用脚本统一转成真像素（见下方「转像素」）
- **配色**（全站统一，提示词里可直接写 hex）：天空蓝 #9BD8FF #7CC0F5 ｜ 草绿 #6DBE45 #4E9A3A ｜ 木棕 #B98A5A #8B5A2B ｜ 深棕 #4A2F1D ｜ 金黄 #FFC94D ｜ 爱心红 #E85D75 ｜ 夜蓝 #1D2B58 #101A38

---

## 一期（现在用）

### ① 远景山丘 —— 文件名 `hills-far.png`（白底）
主视觉最远的背景层。柔和圆润的山丘连绵起伏、占画面下半部，**山脚平贴底边**，上半部纯白。
颜色用浅蓝系（#93C9E8、#7FB4D8），与页面天空同族。不要天空、太阳、树、云。

```
A low-resolution 16-bit pixel art background layer for a cozy retro farming game.
Soft rolling hills in pastel blue tones (#93C9E8, #7FB4D8) stretch across the full
width of the frame. The base of the hills aligns exactly with the bottom edge.
The upper half of the image is completely flat pure white (#FFFFFF).
No sky, no sun, no clouds, no trees, no characters, no text, no watermark.
Crisp square pixels, no anti-aliasing, flat limited color palette.
Wide 16:9 landscape composition.
```

### ② 中景树林树线 —— 文件名 `tree-line.png`（白底）
一排圆润可爱的树（像小果园），树冠大而蓬松、树干短粗，树底贴画面底边，上半部纯白。
绿色 #6DBE45 / #4E9A3A，树干 #8B5A2B。

```
A low-resolution 16-bit pixel art background layer for a cozy retro farming game.
A single horizontal row of cute round trees with big fluffy canopies and short thick
trunks, standing side by side across the full width of the frame. Tree bases align
with the bottom edge. Canopy greens (#6DBE45, #4E9A3A), trunks brown (#8B5A2B).
The upper half of the image is completely flat pure white (#FFFFFF).
No sky, no hills, no characters, no text, no watermark.
Crisp square pixels, no anti-aliasing, flat limited color palette.
Wide 16:9 landscape composition.
```

### ③ 夜间星空 —— 文件名 `night-sky.png`（满幅背景，不要白底）
晚上 18 点后整屏背景。深蓝夜空，上深下略浅（#101A38 → #1D2B58），
撒满大小不一的白色/淡黄色小星星。**不要月亮**（页面已有像素月亮）、不要云、不要地面。

```
A low-resolution 16-bit pixel art night sky background for a cozy retro game.
Deep blue gradient from #101A38 at the top to #1D2B58 at the bottom.
Dozens of small white and pale yellow (#FFF8D0) stars scattered across the sky,
some larger and twinkling. No moon, no clouds, no ground, no trees, no text.
Crisp square pixels, no anti-aliasing, flat limited color palette.
16:9 composition (it will be cropped to portrait on mobile).
```

### ④ 草地前景草丛 —— 文件名 `grass-fore.png`（白底，可选）
画面底部一排低矮草丛/草垛剪影，上部纯白，草绿色 #4E9A3A。

```
A low-resolution 16-bit pixel art foreground layer for a cozy retro farming game.
A strip of low grass tufts and small bushes along the bottom edge of the frame,
grass green (#4E9A3A). The upper part of the image is completely flat pure white
(#FFFFFF). No sky, no trees, no characters, no text, no watermark.
Crisp square pixels, no anti-aliasing. Wide 16:9 landscape composition.
```

---

## 二期（游戏环节用，可以现在就一起生成好）

### ⑤ 钓鱼池塘 —— 文件名 `pond.png`（白底）
钓祝福小游戏场景。3/4 俯视视角：蓝色水面池塘，一条木质小码头伸进水里，
几丛芦苇和睡莲叶子。配色：水面 #7CC0F5，码头 #B98A5A。不要人物、不要鱼。

```
A low-resolution 16-bit pixel art fishing pond scene for a cozy retro farming game,
seen from a 3/4 top-down view. A blue pond (#7CC0F5) with a small wooden pier (#B98A5A)
reaching into the water, a few reeds and lily pads around the edge. The background
around the pond is completely flat pure white (#FFFFFF). No characters, no fish,
no text, no watermark. Crisp square pixels, no anti-aliasing, flat limited palette.
Wide 16:9 landscape composition.
```

### ⑥ 花田空地 —— 文件名 `flowerbed.png`（白底）
种花园游戏：俯视的方形花田，松软深棕色泥土，整齐分成 3×3 九个空格子
（**格子是空的，不要长花**），四周围一圈浅色木栅栏。1:1 方形构图。

```
A low-resolution 16-bit pixel art empty garden plot seen directly from above,
for a cozy retro farming game. A square bed of soft dark brown soil divided into a
neat 3 by 3 grid of nine empty planting cells. No plants, no flowers, no tools.
A light wooden fence (#B98A5A) borders the plot. The background outside the plot is
completely flat pure white (#FFFFFF). No characters, no text, no watermark.
Crisp square pixels, no anti-aliasing. Square 1:1 composition.
```

### ⑦ 篝火 —— 文件名 `campfire.png`（白底）
烟花晚会环节：夜晚篝火特写——橙色/黄色火苗、交叉堆叠的深棕色木柴、
地面一圈小石块、微弱暖色光晕。1:1。

```
A low-resolution 16-bit pixel art campfire at night for a cozy retro game.
Bright orange (#FFC94D, #E85D75 accents) flames rising from a neat pile of crossed
dark brown logs (#8B5A2B), surrounded by a small ring of grey stones on the ground,
with a soft warm glow. The background is completely flat pure white (#FFFFFF).
No characters, no text, no watermark. Crisp square pixels, no anti-aliasing.
Square 1:1 composition.
```

### ⑧ 农场俯视全景地图 —— 文件名 `farm-map.png`（满幅，不要白底）
二期照片墙：温暖明亮的农场俯视全景——红顶谷仓、小木屋、几块彩色农田、
草地小径、一口小池塘、木栅栏围场。留出开阔的草地空间（以后嵌照片）。
**不要人物**、不要文字。16:9 横版。

```
A low-resolution 16-bit pixel art top-down farm map for a cozy retro farming game,
bright and warm daylight style. A red-roofed barn (#E85D75), a small wooden house,
several colorful crop fields, grassy paths, a small pond, and wooden fences.
Plenty of open green pasture space. No characters, no animals, no text, no watermark.
Crisp square pixels, no anti-aliasing, flat limited palette with greens (#6DBE45,
#4E9A3A), wood browns (#B98A5A), warm cream (#FFF8E7). Wide 16:9 landscape.
```

### ⑨ 占卜师摊位 —— 文件名 `fortune-booth.png`（白底）
占卜运势彩蛋：路边占卜小摊位——紫色顶棚的帐篷摊、木桌上放水晶球和几张卡牌、
挂着小彩旗。**可以有一个戴兜帽的神秘占卜师**站在桌后。4:3。

```
A low-resolution 16-bit pixel art fortune teller booth by the roadside, for a cozy
retro game. A small tent stall with a purple striped canopy, a wooden table with a
crystal ball and tarot cards, and tiny festive bunting flags. One mysterious hooded
fortune teller in a purple cloak stands behind the table. The background is
completely flat pure white (#FFFFFF). No text, no watermark. Crisp square pixels,
no anti-aliasing, flat limited palette. 4:3 composition.
```

### ⑩ 婚礼仪式场景 —— 文件名 `ceremony.png`（满幅，不要白底）
「婚礼节」大图：户外草地上的婚礼仪式场景——木制花拱门（红金花饰）、
一侧白色婚礼长桌和小蛋糕、两棵树之间拉着彩旗、蓝天白云。温暖喜庆的白昼气氛。
**不要人物、不要动物**。16:9 横版。

```
A low-resolution 16-bit pixel art outdoor wedding ceremony scene for a cozy retro
farming game. A small wooden arch decorated with red and gold pixel flowers
(#E85D75, #FFC94D) stands on a grassy meadow (#6DBE45, #4E9A3A). A white wedding
table with a small cake sits to one side, colorful bunting flags strung between two
round trees, blue sky (#9BD8FF, #7CC0F5) with a few white pixel clouds. Warm festive
daylight mood. No characters, no people, no animals, no text, no watermark, no logo.
Crisp square pixels, no anti-aliasing, flat limited color palette. Wide 16:9
landscape composition.
```

---

## 生成之后

1. 把图放进 `assets/bg/`，**文件名用上面标注的**（例如 `hills-far.png`）
2. 告诉 Claude「图片放好了」，Claude 会：
   - 跑 `python tools/process_bg.py` 把图转成硬边真像素（如果 Gemini 生成的不够像素）
   - 集成进视差背景 / 游戏场景（白底的图会自动抠白叠上去）
3. 生成得不满意很正常，用同一段提示词多抽几次，挑顺眼的

## 备注

- 开源站找到的备选素材（已下载 CC0 森林视差分层包，偏暗色，暂未用）记录在 `assets/bg/LICENSES.md`
- 提示词不写游戏名、不模仿任何有版权的游戏画面，生成结果可以放心商用
