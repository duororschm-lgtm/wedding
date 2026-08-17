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
    orange: '#ff9a3c', orangeDark: '#e07b1f',
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
    },

    /* ---------- 原创山谷元素（交通/动物/礼物） ---------- */

    /* 巴士 16×9（公共交通） */
    bus: {
      palette: { B: P.blue, b: P.blueDark, W: P.paper, O: P.ink },
      grid: [
        '....BBBBBBBB....',
        '...BBBBBBBBBB...',
        '..BBWWBBBBWWBB..',
        '..BBWWBBBBWWBB..',
        '..BBBBBBBBBBBB..',
        '..BBBBBBBBBBBB..',
        '...BBBBBBBBBB...',
        '...OO......OO...',
        '...OO......OO...'
      ]
    },

    /* 小车 14×7（自驾） */
    car: {
      palette: { R: P.red, r: P.redDark, W: P.paper, O: P.ink },
      grid: [
        '....RRRRRRRR....',
        '...RRRRRRRRRR...',
        '..RRWWRRRRWWRR..',
        '..RRRRRRRRRRRR..',
        '..RRRRRRRRRRRR..',
        '...RRRRRRRRRR...',
        '...OO......OO...'
      ]
    },

    /* 小鸡 10×10 */
    chicken: {
      palette: { R: P.red, W: P.white, E: P.ink, Y: P.gold, O: P.inkSoft },
      grid: [
        '....RR....',
        '...RRRR...',
        '...WWWW...',
        '..WWWWWW..',
        '..WEWWEW..',
        '..WWWWWW..',
        '...WYYW...',
        '...WWWW...',
        '...O..O...',
        '...O..O...'
      ]
    },

    /* 奶牛 12×10 */
    cow: {
      palette: { Y: P.straw, E: P.inkSoft, B: P.ink, W: P.white, O: P.ink },
      grid: [
        '...Y......Y...',
        '..EEEEEEEEEE..',
        '..BWWWBBWWWB..',
        '..BWWWBBWWWB..',
        '...WWWWWWWW...',
        '..WWWWWWWWWW..',
        '..WWBBWWBBWW..',
        '..WWWWWWWWWW..',
        '..WWWWWWWWWW..',
        '..OO......OO..'
      ]
    },

    /* 橘猫 10×8 */
    cat: {
      palette: { O: P.orange, o: P.orangeDark, W: P.cream, E: P.ink, N: P.pink },
      grid: [
        '.OO....OO.',
        '.OOOOOOOO.',
        '.OWWWWWWO.',
        '.OWEWWEWO.',
        '.OWWWWWWO.',
        '..OWWNNWO.',
        '..OOOOOO..',
        '..OO..OO..'
      ]
    },

    /* 小狗 11×9 */
    dog: {
      palette: { E: P.inkSoft, e: P.ink, W: P.cream, N: P.pink },
      grid: [
        '..E.....E..',
        '..EE...EE..',
        '.EEEEEEEEE.',
        '.EWWWWWWWE.',
        '.EWEWWWEWE.',
        '.EWWWWWWWE.',
        '..EWWNNWE..',
        '..EEEEEEEE.',
        '..EE....EE.'
      ]
    },

    /* 婚戒 8×6 */
    ring: {
      palette: { G: P.gold, g: P.goldShade, D: P.white },
      grid: [
        '..GGGG..',
        '.G....G.',
        'G..D...G',
        'G......G',
        '.G....G.',
        '..GGGG..'
      ]
    },

    /* 草莓 8×8 */
    strawberry: {
      palette: { R: P.red, r: P.redDark, G: P.grassDark, W: P.paper },
      grid: [
        '...GG...',
        '..GGGG..',
        '..RRRR..',
        '.RRRRRR.',
        '.RWRRWR.',
        'RRRWRRWR',
        '.RRRRRR.',
        '..RRRR..'
      ]
    },

    /* 蓝莓 7×6 */
    blueberry: {
      palette: { B: P.blue, b: P.blueDark, G: P.grassDark },
      grid: [
        '..GGG..',
        '.BBBBB.',
        'BBBbBBB',
        'BBbBBBB',
        '.BBBBB.',
        '..BBB..'
      ]
    },

    /* 胡萝卜 7×9 */
    carrot: {
      palette: { O: P.orange, o: P.orangeDark, G: P.grass },
      grid: [
        '..GGG..',
        '.GGGGG.',
        '..OOO..',
        '..OOo..',
        '..OOO..',
        '.OOoOO.',
        '.OOOOo.',
        '..OOo..',
        '...O...'
      ]
    },

    /* 南瓜 10×8 */
    pumpkin: {
      palette: { O: P.orange, o: P.orangeDark, G: P.grassDark },
      grid: [
        '..GGGGG...',
        '...GGG....',
        '.OOoOOOoO.',
        'OoOOOoOOoO',
        'OOoOOOoOOO',
        'OOoOOOoOOO',
        '.OOOoOOoO.',
        '..OOoOOO..'
      ]
    },

    /* ---------- 原创游戏元素（钓祝福/花园/烟花/占卜/成就） ---------- */

    /* 小鱼 12×7（钓祝福；blue/pink 为换色变体） */
    fish: {
      palette: { O: P.orange, W: P.white, E: P.ink },
      grid: [
        '..OO......OO',
        '.OOOO....OO.',
        'OOOOOO..OO..',
        'OOOWEOOO....',
        'OOOOOO..OO..',
        '.OOOO....OO.',
        '..OO......OO'
      ]
    },
    fishBlue: {
      palette: { O: P.blue, W: P.white, E: P.ink },
      grid: [
        '..OO......OO',
        '.OOOO....OO.',
        'OOOOOO..OO..',
        'OOOWEOOO....',
        'OOOOOO..OO..',
        '.OOOO....OO.',
        '..OO......OO'
      ]
    },
    fishPink: {
      palette: { O: P.pink, W: P.white, E: P.ink },
      grid: [
        '..OO......OO',
        '.OOOO....OO.',
        'OOOOOO..OO..',
        'OOOWEOOO....',
        'OOOOOO..OO..',
        '.OOOO....OO.',
        '..OO......OO'
      ]
    },

    /* 浮漂 4×6 */
    bobber: {
      palette: { W: P.white, R: P.red },
      grid: [
        'WWWW',
        'WRRW',
        'RRRR',
        'RRRR',
        'RRRR',
        'RRRR'
      ]
    },

    /* 种子 4×4（花园成长：种子→幼苗→花苞→开花） */
    seed: {
      palette: { B: P.inkSoft },
      grid: [
        '.B..',
        'BBB.',
        'BBBB',
        '.BB.'
      ]
    },

    /* 幼苗 6×6 */
    sprout: {
      palette: { G: P.grass, B: P.inkSoft },
      grid: [
        '..GG..',
        '.G..G.',
        '..GG..',
        '..G...',
        '..B...',
        '..B...'
      ]
    },

    /* 花苞 6×8 */
    bud: {
      palette: { G: P.grass, P: P.pink, B: P.inkSoft },
      grid: [
        '..GG..',
        '.GPPG.',
        '.GPPG.',
        '..GG..',
        '..G...',
        '..B...',
        '..B...',
        '......'
      ]
    },

    /* 郁金香 7×9 */
    tulip: {
      palette: { R: P.red, r: P.redDark, G: P.grass },
      grid: [
        '..RRR..',
        '.RRRRR.',
        'RRRRRRR',
        'RRRRRRR',
        '.RRRRR.',
        '..RRR..',
        '...G...',
        '..GGG..',
        '...G...'
      ]
    },

    /* 雏菊 8×8 */
    daisy: {
      palette: { W: P.white, Y: P.gold, G: P.grass },
      grid: [
        '..WWWW..',
        '.WWYYWW.',
        'WWYYYYWW',
        'WWYYYYWW',
        '.WWYYWW.',
        '..WWWW..',
        '...G....',
        '..GGG...'
      ]
    },

    /* 风铃草 7×8 */
    bluebell: {
      palette: { B: P.blue, G: P.grass },
      grid: [
        '...G...',
        '..GGG..',
        '..BBB..',
        '.BBBBB.',
        'BBBBBBB',
        'BBBBBBB',
        '.BBBBB.',
        '..BBB..'
      ]
    },

    /* 烟花 9×9 */
    firework: {
      palette: { X: P.gold, R: P.red },
      grid: [
        'X.......X',
        '.X..X..X.',
        '..X.X.X..',
        '...XXX...',
        'XXXXRXXXX',
        '...XXX...',
        '..X.X.X..',
        '.X..X..X.',
        'X.......X'
      ]
    },

    /* 水晶球 9×10（占卜运势） */
    crystal: {
      palette: { G: P.gold, B: P.blue, W: P.white },
      grid: [
        '..GGGGG..',
        '.GGGGGGG.',
        'GGGGGGGGG',
        'G.BBBBB.G',
        'G.BBWBB.G',
        'G.BBBBB.G',
        'G.BBBBB.G',
        'GGGGGGGGG',
        '.GGGGGGG.',
        '..GGGGG..'
      ]
    },

    /* 奖杯 9×9（成就） */
    trophy: {
      palette: { G: P.gold },
      grid: [
        '..GGGGG..',
        '.GGGGGGG.',
        '.GG...GG.',
        '..G...G..',
        '...GGG...',
        '....G....',
        '...GGG...',
        '..GGGGG..',
        '.........'
      ]
    },

    /* ---------- 肖像墙动物（原创，共 11 只） ---------- */

    /* 绵羊 团团 10×10 */
    sheep: {
      palette: { W: P.white, F: P.cream, E: P.ink, N: P.blush, O: P.inkSoft },
      grid: [
        '..WWWWWW..',
        '.WWWWWWWW.',
        '.WWWWWWWW.',
        'WWFFFFFFWW',
        'WWFEFFEFWW',
        'WWFFFFFFWW',
        'WWFNFFNFWW',
        '.WWWWWWWW.',
        '.OO....OO.',
        '.OO....OO.'
      ]
    },

    /* 小猪 噜噜 10×9 */
    pig: {
      palette: { K: P.pink, k: P.blush, E: P.ink, O: P.inkSoft },
      grid: [
        '..KK..KK..',
        '.KKKKKKKK.',
        'KKKKKKKKKK',
        'KKKEKKKEKK',
        'KKKKKKKKKK',
        'KKKkkkkKKK',
        '.KkEkkEkK.',
        '..KKKKKK..',
        '.OO....OO.'
      ]
    },

    /* 兔子 蹦蹦 10×10 */
    rabbit: {
      palette: { K: P.pink, W: P.white, E: P.ink, N: P.blush, O: P.inkSoft },
      grid: [
        '.KK....KK.',
        'KKK....KKK',
        'KKK....KKK',
        'KKK....KKK',
        '.WWWWWWWW.',
        'WWWWWWWWWW',
        'WWWEWWWEWW',
        'WWWWNNWWWW',
        '.WWWWWWWW.',
        '.OO....OO.'
      ]
    },

    /* 鸭子 嘎嘎 10×8 */
    duck: {
      palette: { Y: P.gold, O: P.orange, E: P.ink },
      grid: [
        '...YY.....',
        '..YYYY....',
        '.EYYYY....',
        'OOYYYYYYY.',
        'OYYYYYYYYY',
        '.YYYYYYYY.',
        '..YYYYYY..',
        '..OO..OO..'
      ]
    },

    /* 狐狸 阿赤 11×9 */
    fox: {
      palette: { O: P.orange, W: P.white, E: P.ink },
      grid: [
        '.OO.....OO.',
        'OOOO...OOOO',
        '.OOOOOOOOO.',
        '.OOEOOEOOO.',
        '..OWWWWWWO.',
        '..OWWWWWWO.',
        '...OWEWO...',
        '....OOO....',
        '..OOOOOOO..'
      ]
    },

    /* 松鼠 栗栗 10×9 */
    squirrel: {
      palette: { B: P.inkSoft, W: P.cream, E: P.ink },
      grid: [
        '....BB.BBB',
        '...BBBBBBB',
        '..BBBBBBBB',
        '..BWWWWBBB',
        '..BWEWWEBB',
        '..BWWWWBBB',
        '..BBBBBBBB',
        '.BBBBBBBBB',
        '.BB.BB.BBB'
      ]
    },

    /* 猫头鹰 夜夜 10×10 */
    owl: {
      palette: { B: P.inkSoft, W: P.cream, E: P.ink, O: P.gold },
      grid: [
        '..BBBBBB..',
        '.BBBBBBBB.',
        '.BBWBBWBB.',
        'BBWEWBWEWB',
        'BBWEWBWEWB',
        '.BBWBBWBB.',
        '..BBOOBB..',
        '..BOOOOB..',
        '.BBBBBBBB.',
        '.OO....OO.'
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
