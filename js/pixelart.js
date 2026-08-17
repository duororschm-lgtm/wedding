/* ============================================================
   像素画渲染工具
   把字符画网格渲染成 SVG（shape-rendering: crispEdges 保证像素锐利）
   用法：PixelArt.sprite('heart', 4) → 一个 4 倍大的爱心 SVG 元素
   ============================================================ */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function pixelArt(grid, palette, scale) {
    scale = scale || 1;
    var height = grid.length;
    var width = 0;
    for (var i = 0; i < grid.length; i++) width = Math.max(width, grid[i].length);

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('width', width * scale);
    svg.setAttribute('height', height * scale);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('aria-hidden', 'true');

    for (var y = 0; y < grid.length; y++) {
      var row = grid[y];
      for (var x = 0; x < row.length; x++) {
        var ch = row.charAt(x);
        if (ch === '.' || ch === ' ') continue;
        var color = palette[ch];
        if (!color) continue;
        var rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', 1);
        rect.setAttribute('height', 1);
        rect.setAttribute('fill', color);
        svg.appendChild(rect);
      }
    }
    return svg;
  }

  /* ---------- 调色板 ---------- */
  var P = {
    // 通用
    ink: '#4a2f1d', inkSoft: '#7a4e2d',
    paper: '#fffdf5', cream: '#fff8e7', cream2: '#ffefc9', flap: '#ffe9b8',
    skin: '#ffd9b0', blush: '#ff9aae',
    hair: '#6b4226', hairLight: '#8b5a2b',
    red: '#e85d75', redLight: '#ff8fa5', redDark: '#c24b5e',
    pink: '#ffb3c1',
    gold: '#ffc94d', goldShade: '#d9b45a', straw: '#f4d06f',
    grass: '#6dbe45', grassDark: '#4e9a3a',
    blue: '#4a7fd4', blueDark: '#3a66ae',
    white: '#ffffff', strawDark: '#d9b45a'
  };

  /* ---------- 精灵定义 ---------- */
  var SPRITES = {

    /* 大爱心 9×8 */
    heart: {
      palette: { H: P.redLight, X: P.red, S: P.redDark },
      grid: [
        '..H...X..',
        '.HHH.XXX.',
        'HHXXXXXXX',
        'XXXXXXXXS',
        '.XXXXXXSS',
        '..XXXXS..',
        '...XXX...',
        '....X....'
      ]
    },

    /* 小爱心 7×6 */
    heartSm: {
      palette: { H: P.redLight, X: P.red },
      grid: [
        '.HH.HH.',
        'HXXXXXH',
        'HXXXXXH',
        '.XXXXX.',
        '..XXX..',
        '...X...'
      ]
    },

    /* 新郎（农夫）16×26 */
    groom: {
      palette: {
        Y: P.straw, y: P.strawDark, K: P.hairLight,
        H: P.hair, F: P.skin, E: P.ink, R: P.blush,
        W: P.paper, B: P.blue, b: P.blueDark, O: P.inkSoft
      },
      grid: [
        '................',
        '................',
        '.....YYYYYY.....',
        '....YYYYYYYY....',
        '....YYyyyyYY....',
        '.YKKKKKKKKKKKKY.',
        '.YYYYYYYYYYYYYY.',
        '..HHFFFFFFFFHH..',
        '..HHFFFFFFFFHH..',
        '..HHFEFFFFEFHH..',
        '..HHFFFFFFFFHH..',
        '..HHFRFFFFRFHH..',
        '....FFFFFFFF....',
        '....FFF..FFF....',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '.BBBBBBBBBBBBBB.',
        '.BbBBBBBBBBBBbB.',
        '.BbbBBBBBBBBbbB.',
        '.BBBBBBBBBBBBBB.',
        '..BBBBBBBBBBBB..',
        '..BBB......BBB..',
        '..BBB......BBB..',
        '..BBB......BBB..',
        '..OOO......OOO..',
        '..OOO......OOO..'
      ]
    },

    /* 新娘 16×26 */
    bride: {
      palette: {
        V: P.white, H: P.hairLight, F: P.skin, E: P.ink, R: P.blush,
        W: P.paper, P: P.pink
      },
      grid: [
        '................',
        '................',
        '....VVVVVVVV....',
        '...VVVVVVVVVV...',
        '..VVVVVVVVVVVV..',
        '..VVHHHHHHHHVV..',
        '..VVHHHHHHHHVV..',
        '...HHFFFFFFHH...',
        '...HHFEFFEFHH...',
        '...HHFFFFFFHH...',
        '...HHFRFFRFHH...',
        '....FFFFFFFF....',
        '.....FF..FF.....',
        '....WWWWWWWW....',
        '..WWWWWWWWWWWW..',
        '..WWWWWWWWWWWW..',
        '..WWWWWRRWWWWW..',
        '..WWWWWWWWWWWW..',
        '.WWWWWWWWWWWWWW.',
        '.WWWWWWWWWWWWWW.',
        '..WWWRRRRRRWWW..',
        '.WWWWWWWWWWWWWW.',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        'WWWWWWWWWWWWWWWW',
        '.WWWWWWWWWWWWWW.'
      ]
    },

    /* 树 9×12 */
    tree: {
      palette: { G: P.grass, g: P.grassDark, T: P.inkSoft },
      grid: [
        '....G....',
        '...GGG...',
        '..GGGGG..',
        '.GGGGGGG.',
        'GGGGGGGGG',
        'GGgGGGGgG',
        '.GgGGGgG.',
        '..GGGGG..',
        '...TTT...',
        '...TTT...',
        '...TTT...',
        '.........'
      ]
    },

    /* 小花 5×5 */
    flower: {
      palette: { Y: P.gold, R: P.red, G: P.grassDark },
      grid: [
        '..Y..',
        '.RYR.',
        '.RRR.',
        '..G..',
        '..G..'
      ]
    },

    /* 云朵 12×5 */
    cloud: {
      palette: { C: P.white },
      grid: [
        '...CCCC.....',
        '..CCCCCC....',
        '.CCCCCCCCCC.',
        'CCCCCCCCCCCC',
        'CCCCCCCCCCCC'
      ]
    },

    /* 太阳 10×10 */
    sun: {
      palette: { Y: P.gold },
      grid: [
        '....YY....',
        '...YYYY...',
        '..YYYYYY..',
        '.YYYYYYYY.',
        'YYYYYYYYYY',
        'YYYYYYYYYY',
        'YYYYYYYYYY',
        '.YYYYYYYY.',
        '..YYYYYY..',
        '...YYYY...'
      ]
    },

    /* 月亮（月牙）10×10 */
    moon: {
      palette: { M: '#fff0b0', m: '#e8d48a' },
      grid: [
        '..........',
        '...mmmm...',
        '..mMMMM...',
        '.mMMMMm...',
        '.mMMMM....',
        '.mMMMM....',
        '.mMMMM....',
        '..mMMMm...',
        '...mmm....',
        '..........'
      ]
    },

    /* 星星 7×7 */
    star: {
      palette: { X: P.gold },
      grid: [
        '...X...',
        '...X...',
        'X..X..X',
        '..XXX..',
        'X..X..X',
        '...X...',
        '...X...'
      ]
    },

    /* 音符 8×8 */
    note: {
      palette: { X: P.ink },
      grid: [
        '..XX....',
        '..X.X...',
        '..X.X...',
        '..X.X.X.',
        'XXXXXXX.',
        '.XXXXXX.',
        '....XX..',
        '...X....'
      ]
    },

    /* 地图图钉 6×7 */
    pin: {
      palette: { X: P.red, S: P.redDark },
      grid: [
        '..XX..',
        '.XXXX.',
        '.X..X.',
        '..XX..',
        '..XX..',
        '..SS..',
        '..SS..'
      ]
    },

    /* 日历 7×7 */
    calendar: {
      palette: { X: P.ink, D: P.red },
      grid: [
        'XXXXXXX',
        'X.....X',
        'X.D.D.X',
        'X.....X',
        'X.....X',
        'X.....X',
        'XXXXXXX'
      ]
    },

    /* 礼物 9×7 */
    gift: {
      palette: { X: P.gold, B: P.red, b: P.redDark },
      grid: [
        '.X.X.X.X.',
        'XXXXXXXXX',
        'BBBBBBBBB',
        'BBBBBBBBB',
        '..XXXXX..',
        '..XbbbX..',
        '..XXXXX..'
      ]
    },

    /* 信封：背面（无盖）28×20 */
    envelopeBack: {
      palette: { B: P.ink, W: P.paper },
      grid: (function () {
        var g = ['BBBBBBBBBBBBBBBBBBBBBBBBBBBB'];
        for (var i = 0; i < 18; i++) g.push('B' + 'WWWWWWWWWWWWWWWWWWWWWWWWWW' + 'B');
        g.push('BBBBBBBBBBBBBBBBBBBBBBBBBBBB');
        return g;
      })()
    },

    /* 信封盖（三角翻盖）28×11 */
    envelopeFlap: {
      palette: { L: P.flap },
      grid: [
        '.LLLLLLLLLLLLLLLLLLLLLLLLLL.',
        '..LLLLLLLLLLLLLLLLLLLLLLLL..',
        '...LLLLLLLLLLLLLLLLLLLLL....',
        '.....LLLLLLLLLLLLLLLLL......',
        '......LLLLLLLLLLLLLLL.......',
        '.......LLLLLLLLLLLLL........',
        '.........LLLLLLLLL..........',
        '..........LLLLLLL...........',
        '...........LLLLL............',
        '.............L..............',
        '............................'
      ]
    },

    /* 信封正面（带 V 形口袋，上方留出信纸滑出口）28×20 */
    envelopeFront: {
      palette: { B: P.ink, W: P.paper },
      grid: [
        'BBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        'BW........................WB',
        'BWWW....................WWWB',
        'BWWWWW................WWWWWB',
        'BWWWWWWW............WWWWWWWB',
        'BWWWWWWWW..........WWWWWWWWB',
        'BWWWWWWWWWW......WWWWWWWWWWB',
        'BWWWWWWWWWWWW..WWWWWWWWWWWWB',
        'BWWWWWWWWWWWWWWWWWWWWWWWWWWB',
        'BWWWWWWWWWWWWWWWWWWWWWWWWWWB',
        'BWWWWWWWWWWWWWWWWWWWWWWWWWWB',
        'BWWWWWWWWWWWWWWWWWWWWWWWWWWB',
        'BWWWWWWWWWWWWWWWWWWWWWWWWWWB',
        'BWWWWWWWWWWWWWWWWWWWWWWWWWWB',
        'BWWWWWWWWWWWWWWWWWWWWWWWWWWB',
        'BWWWWWWWWWWWWWWWWWWWWWWWWWWB',
        'BWWWWWWWWWWWWWWWWWWWWWWWWWWB',
        'BWWWWWWWWWWWWWWWWWWWWWWWWWWB',
        'BWWWWWWWWWWWWWWWWWWWWWWWWWWB',
        'BBBBBBBBBBBBBBBBBBBBBBBBBBBB'
      ]
    },

    /* 花瓣 4×4（花瓣雨用） */
    petal: {
      palette: { P: P.pink, R: P.redLight },
      grid: [
        '.PP.',
        'PRRP',
        'RRRR',
        '.RR.'
      ]
    },

    /* 草丛 10×3 */
    grassTuft: {
      palette: { G: P.grassDark },
      grid: [
        '..G..G..G.',
        '.GG.GG.GGG',
        'GGGGGGGGGG'
      ]
    }
  };

  /* 生成一个指定精灵的 SVG */
  function sprite(name, scale) {
    var def = SPRITES[name];
    if (!def) throw new Error('未知精灵: ' + name);
    return pixelArt(def.grid, def.palette, scale);
  }

  window.PixelArt = { pixelArt: pixelArt, sprite: sprite, SPRITES: SPRITES, PALETTES: P };
})();
