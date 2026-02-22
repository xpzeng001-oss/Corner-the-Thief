/**
 * 围堵小偷 - 微信小游戏入口
 */
const Game = require('./js/main');

// 获取系统信息
const sysInfo = wx.getSystemInfoSync();
const W = sysInfo.windowWidth;
const H = sysInfo.windowHeight;
const dpr = sysInfo.pixelRatio;

// 安全区顶部偏移（刘海屏适配）
const safeTop = (sysInfo.safeArea && sysInfo.safeArea.top) ? sysInfo.safeArea.top : 0;

// 获取微信胶囊按钮位置（右上角 ··· 按钮）
let menuRect = { top: safeTop + 4, bottom: safeTop + 36, left: W - 95, right: W - 7, width: 87, height: 32 };
try {
  const r = wx.getMenuButtonBoundingClientRect();
  if (r && r.width > 0) menuRect = r;
} catch (e) {}

// 创建主画布
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');

// 设置画布尺寸（物理像素）
canvas.width = W * dpr;
canvas.height = H * dpr;

// 缩放到逻辑像素
ctx.scale(dpr, dpr);

// 启动游戏
const game = new Game(canvas, ctx, W, H, dpr, safeTop, menuRect);
game.start();
