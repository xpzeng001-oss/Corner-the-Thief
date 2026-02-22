/**
 * 围堵小偷 - 主游戏引擎
 * 包含：图数据结构、AI、渲染、场景管理、输入处理
 */
const levels = require('./levels');

// ==================== 常量 ====================
const COLORS = {
  bg: '#F5EFDC',
  nodeFill: '#FFFFFF',
  nodeStroke: '#4A6FA5',
  nodeStrokeWidth: 3,
  edge: '#4A6FA5',
  edgeShadow: '#3A5A8A',
  edgeWidth: 7,
  police: '#2979FF',
  policeDark: '#1565C0',
  policeLight: '#64B5F6',
  thief: '#BF360C',
  thiefDark: '#8B0000',
  thiefLight: '#FF7043',
  exit: '#FF8F00',
  exitDark: '#E65100',
  exitGlow: '#FFD54F',
  highlight: '#FFD600',
  highlightGlow: 'rgba(255,214,0,0.4)',
  validMove: '#66BB6A',
  validMoveGlow: 'rgba(102,187,106,0.4)',
  button: '#C8963E',
  buttonDark: '#A67A2E',
  buttonLight: '#E0B05E',
  buttonText: '#FFFFFF',
  text: '#333333',
  textLight: '#666666',
  title: '#2C3E50',
  overlay: 'rgba(0,0,0,0.55)',
  win: '#4CAF50',
  lose: '#F44336',
  star: '#FFD600',
  starEmpty: '#CCCCCC',
  white: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.15)',
};

const NODE_RADIUS = 20;
const CHAR_RADIUS = 16;
const ANIM_DURATION = 280;
const TOP_BAR_H = 80;
const BOTTOM_BAR_H = 90;
const PADDING = 35;

// ==================== 图数据结构 ====================
class Graph {
  constructor(nodes, edges) {
    this.nodes = nodes;
    this.adj = {};
    for (let i = 0; i < nodes.length; i++) this.adj[i] = [];
    for (const [a, b] of edges) {
      this.adj[a].push(b);
      this.adj[b].push(a);
    }
  }

  neighbors(i) { return this.adj[i] || []; }

  // BFS最短路径长度
  bfs(from, to, blocked) {
    if (from === to) return 0;
    const visited = new Set(blocked || []);
    visited.add(from);
    const queue = [[from, 0]];
    while (queue.length > 0) {
      const [cur, dist] = queue.shift();
      for (const nb of this.adj[cur]) {
        if (nb === to) return dist + 1;
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push([nb, dist + 1]);
        }
      }
    }
    return Infinity;
  }

  // 从from出发可达的节点数（不经过blocked）
  reachableCount(from, blocked) {
    const visited = new Set(blocked || []);
    visited.add(from);
    const queue = [from];
    let count = 0;
    while (queue.length > 0) {
      const cur = queue.shift();
      count++;
      for (const nb of this.adj[cur]) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    return count;
  }
}

// ==================== 小偷AI ====================
const ThiefAI = {
  getMove(graph, thiefPos, policePos, exits, aiLevel) {
    const neighbors = graph.neighbors(thiefPos);
    const valid = neighbors.filter(n => policePos.indexOf(n) === -1);
    if (valid.length === 0) return -1;

    // 如果能直接到达出口，立刻走
    for (const v of valid) {
      if (exits.indexOf(v) !== -1) return v;
    }

    // 过滤掉警察相邻的节点（小偷不会主动送上门），除非无路可走
    const safe = valid.filter(n => {
      for (const p of policePos) {
        if (graph.neighbors(p).indexOf(n) !== -1) return false;
      }
      return true;
    });
    const moves = safe.length > 0 ? safe : valid;

    if (aiLevel <= 1) return this.easyMove(moves);
    if (aiLevel === 2) return this.mediumMove(graph, moves, policePos);
    if (aiLevel === 3) return this.hardMove(graph, moves, policePos, exits);
    return this.expertMove(graph, thiefPos, moves, policePos, exits);
  },

  // 随机移动
  easyMove(valid) {
    return valid[Math.floor(Math.random() * valid.length)];
  },

  // 远离最近警察
  mediumMove(graph, valid, policePos) {
    let best = -1, bestDist = -1;
    for (const v of valid) {
      let minDist = Infinity;
      for (const p of policePos) {
        const d = graph.bfs(v, p, []);
        if (d < minDist) minDist = d;
      }
      if (minDist > bestDist) {
        bestDist = minDist;
        best = v;
      }
    }
    return best;
  },

  // 向出口方向移动，考虑警察阻挡
  hardMove(graph, valid, policePos, exits) {
    let best = -1, bestScore = -Infinity;
    for (const v of valid) {
      let minExitDist = Infinity;
      for (const e of exits) {
        const d = graph.bfs(v, e, policePos);
        if (d < minExitDist) minExitDist = d;
      }
      // 出口不可达时用大有限值代替Infinity，避免score变-Infinity
      if (minExitDist === Infinity) minExitDist = 50;
      // 离出口越近分越高，同时远离警察加分
      let minPoliceDist = Infinity;
      for (const p of policePos) {
        const d = graph.bfs(v, p, []);
        if (d < minPoliceDist) minPoliceDist = d;
      }
      const score = -minExitDist * 3 + minPoliceDist;
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    return best;
  },

  // 最优逃跑：考虑可达空间+出口距离+警察距离
  expertMove(graph, thiefPos, valid, policePos, exits) {
    let best = -1, bestScore = -Infinity;
    for (const v of valid) {
      // 可达空间
      const reachable = graph.reachableCount(v, policePos);
      // 最近出口距离
      let minExitDist = Infinity;
      for (const e of exits) {
        const d = graph.bfs(v, e, policePos);
        if (d < minExitDist) minExitDist = d;
      }
      // 出口不可达时用大有限值代替Infinity，避免score变-Infinity
      if (minExitDist === Infinity) minExitDist = 50;
      // 最近警察距离
      let minPoliceDist = Infinity;
      for (const p of policePos) {
        const d = graph.bfs(v, p, []);
        if (d < minPoliceDist) minPoliceDist = d;
      }
      // 出口可达性
      const exitReachable = exits.some(e => graph.bfs(v, e, policePos) < Infinity);
      const score = (exitReachable ? 100 : 0) + reachable * 2 - minExitDist * 3 + minPoliceDist;
      if (score > bestScore) {
        bestScore = score;
        best = v;
      }
    }
    return best;
  }
};

// ==================== 主游戏类 ====================
class Game {
  constructor(canvas, ctx, W, H, dpr, safeTop, menuRect) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.safeTop = safeTop || 0;
    // 微信胶囊按钮区域（右上角 ··· 按钮）
    this.menuRect = menuRect || { top: safeTop + 4, bottom: safeTop + 36, left: W - 95, right: W - 7 };

    // 场景状态
    this.scene = 'menu';       // menu | levelSelect | game | rules
    this.prevScene = 'game';

    // 进度存储
    this.progress = this.loadProgress();

    // 游戏状态
    this.graph = null;
    this.levelData = null;
    this.levelNum = 1;
    this.policePos = [];
    this.thiefPos = -1;
    this.exits = [];
    this.selectedPolice = -1;
    this.validMoves = [];
    this.steps = 0;
    this.stepLimit = 0;
    this.gameState = 'playing'; // playing | animating | win | lose
    this.message = '';

    // 动画
    this.animations = [];
    this.animTime = 0;

    // 节点屏幕坐标缓存
    this.nodeScreenPos = [];

    // 闪烁
    this.pulseTime = 0;

    // 关卡选择滚动
    this.scrollY = 0;
    this.scrollTargetY = 0;

    // 胜利星星动画
    this.resultTimer = 0;

    // 输入
    this.touchStartY = 0;
    this.isDragging = false;
    this.setupInput();

    // 菜单装饰线（预生成避免闪烁）
    this.menuLines = [];
    for (let i = 0; i < 12; i++) {
      this.menuLines.push({
        x1: Math.random(), y1: Math.random() * 0.5,
        x2: Math.random(), y2: Math.random() * 0.5,
      });
    }

    // 预计算顶部栏高度（基于胶囊按钮位置）
    this.topBarH = this.menuRect.bottom + 6 + 40;

    // 音频系统
    this.sounds = {};
    this.bgmPlaying = false;
    this.soundEnabled = true;
    this.initAudio();

    // 上一帧时间
    this.lastTime = Date.now();
  }

  // ==================== 存储 ====================
  loadProgress() {
    try {
      const data = wx.getStorageSync('cornerThiefProgress');
      if (data) return JSON.parse(data);
    } catch (e) {}
    return { unlocked: 1, stars: {} };
  }

  saveProgress() {
    try {
      wx.setStorageSync('cornerThiefProgress', JSON.stringify(this.progress));
    } catch (e) {}
  }

  // ==================== 音频系统 ====================
  initAudio() {
    this.bgm = null;
    this.sfxVol = {
      move: 0.7, select: 0.6, win: 0.8, lose: 0.7, thief_move: 0.5,
    };
  }

  playBGM() {
    if (!this.soundEnabled || this.bgmPlaying) return;
    try {
      // 每次重新创建，避免状态残留
      if (this.bgm) {
        try { this.bgm.destroy(); } catch (e) {}
      }
      this.bgm = wx.createInnerAudioContext({ obeyMuteSwitch: false });
      this.bgm.src = 'audio/bgm.mp3';
      this.bgm.loop = true;
      this.bgm.volume = 0.35;
      this.bgm.onCanplay(() => {
        console.log('BGM canplay, starting...');
        this.bgm.play();
      });
      this.bgm.onPlay(() => { console.log('BGM playing'); });
      this.bgm.onError((err) => { console.error('BGM error:', JSON.stringify(err)); });
      this.bgmPlaying = true;
    } catch (e) {
      console.error('playBGM failed:', e);
    }
  }

  stopBGM() {
    try {
      if (this.bgm) {
        this.bgm.pause();
      }
      this.bgmPlaying = false;
    } catch (e) {}
  }

  playSFX(name) {
    if (!this.soundEnabled) return;
    try {
      var audio = wx.createInnerAudioContext({ obeyMuteSwitch: false });
      audio.src = 'audio/' + name + '.mp3';
      audio.volume = this.sfxVol[name] || 0.6;
      audio.onEnded(function () { audio.destroy(); });
      audio.onError(function (err) { console.error('SFX error ' + name + ':', JSON.stringify(err)); audio.destroy(); });
      audio.onCanplay(function () { audio.play(); });
    } catch (e) {}
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    if (this.soundEnabled) {
      this.playBGM();
    } else {
      this.stopBGM();
    }
  }

  // ==================== 输入处理 ====================
  setupInput() {
    wx.onTouchStart((e) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      const x = t.clientX, y = t.clientY;
      this.touchStartY = y;
      this.isDragging = false;
      this.handleTouch(x, y, 'start');
    });

    wx.onTouchMove((e) => {
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      const dy = t.clientY - this.touchStartY;
      if (Math.abs(dy) > 8) this.isDragging = true;
      if (this.scene === 'levelSelect' && this.isDragging) {
        this.scrollY -= (t.clientY - this.touchStartY);
        this.touchStartY = t.clientY;
        this.clampScroll();
      }
    });

    wx.onTouchEnd((e) => {
      if (e.changedTouches.length === 0) return;
      const t = e.changedTouches[0];
      if (!this.isDragging) {
        this.handleTouch(t.clientX, t.clientY, 'end');
      }
    });
  }

  handleTouch(x, y, phase) {
    if (phase !== 'end') return;
    switch (this.scene) {
      case 'menu': this.handleMenuTouch(x, y); break;
      case 'levelSelect': this.handleLevelSelectTouch(x, y); break;
      case 'game': this.handleGameTouch(x, y); break;
      case 'rules': this.handleRulesTouch(x, y); break;
    }
  }

  // ==================== 菜单场景 ====================
  handleMenuTouch(x, y) {
    const cx = this.W / 2, cy = this.H * 0.58;
    const bw = 200, bh = 56;
    // 音量开关 (右下角)
    const soundBtnX = this.W - 50, soundBtnY = this.H * 0.92 - 15;
    if ((x - soundBtnX) * (x - soundBtnX) + (y - soundBtnY) * (y - soundBtnY) <= 22 * 22) {
      this.toggleSound();
      return;
    }
    if (x >= cx - bw/2 && x <= cx + bw/2 && y >= cy - bh/2 && y <= cy + bh/2) {
      this.scene = 'levelSelect';
      this.playBGM(); // 首次用户交互后启动背景音乐
    }
  }

  renderMenu() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // 装饰线条（使用预生成数据）
    ctx.strokeStyle = COLORS.nodeStroke;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.1;
    for (const line of this.menuLines) {
      ctx.beginPath();
      ctx.moveTo(line.x1 * W, line.y1 * H);
      ctx.lineTo(line.x2 * W, line.y2 * H);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 装饰节点
    ctx.globalAlpha = 0.08;
    const decorNodes = [[0.15,0.18],[0.85,0.2],[0.1,0.4],[0.9,0.38],[0.2,0.55],[0.8,0.52]];
    for (const [nx, ny] of decorNodes) {
      ctx.beginPath();
      ctx.arc(nx * W, ny * H, 12, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.nodeStroke;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 标题
    ctx.fillStyle = COLORS.title;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('围堵小偷', W / 2, H * 0.28);

    // 副标题
    ctx.fillStyle = COLORS.textLight;
    ctx.font = '16px sans-serif';
    ctx.fillText('10步之内抓住他，你行吗？', W / 2, H * 0.36);

    // 警察和小偷图标
    this.drawPoliceIcon(W * 0.3, H * 0.46, 22);
    this.drawPoliceIcon(W * 0.5, H * 0.44, 26);
    this.drawPoliceIcon(W * 0.7, H * 0.46, 22);
    this.drawThiefIcon(W * 0.5, H * 0.46 + 45, 20);

    // 开始按钮
    this.drawButton(W / 2 - 100, H * 0.58 - 28, 200, 56, '开始游戏', 22);

    // 音量开关按钮
    this.drawSoundButton(W - 50, H * 0.92 - 15);

    // 底部文字
    ctx.fillStyle = COLORS.textLight;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('策略围堵 · 斗智斗勇', W / 2, H * 0.92);
  }

  // ==================== 关卡选择场景 ====================
  clampScroll() {
    const totalLevels = levels.length - 1;
    const rows = Math.ceil(totalLevels / 4);
    const topH = this.topBarH;
    const contentH = rows * 85 + 120;
    const maxScroll = Math.max(0, contentH - (this.H - topH));
    this.scrollY = Math.max(0, Math.min(this.scrollY, maxScroll));
  }

  handleLevelSelectTouch(x, y) {
    const topH = this.topBarH;
    // 返回按钮
    if (x < 80 && y < topH) {
      this.scene = 'menu';
      return;
    }
    // 关卡按钮
    const cols = 4;
    const cellW = (this.W - 40) / cols;
    const cellH = 85;
    const startY = topH + 50 - this.scrollY;
    for (let i = 1; i < levels.length; i++) {
      const row = Math.floor((i - 1) / cols);
      const col = (i - 1) % cols;
      const cx = 20 + col * cellW + cellW / 2;
      const cy = startY + row * cellH + cellH / 2;
      const sz = 32;
      if (x >= cx - sz && x <= cx + sz && y >= cy - sz && y <= cy + sz) {
        if (i <= this.progress.unlocked) {
          this.startLevel(i);
        }
        return;
      }
    }
  }

  renderLevelSelect() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const mr = this.menuRect;
    const topH = this.topBarH;
    const btnMidY = (mr.top + mr.bottom) / 2;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // 顶部栏背景
    ctx.fillStyle = 'rgba(245,239,220,0.95)';
    ctx.fillRect(0, 0, W, topH);

    // 标题 — 与胶囊同行居中
    ctx.fillStyle = COLORS.title;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('选择关卡', mr.left / 2, btnMidY);

    // 返回按钮
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('< 返回', 12, btnMidY);

    // 裁剪区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, topH, W, H - topH);
    ctx.clip();

    const cols = 4;
    const cellW = (W - 40) / cols;
    const cellH = 85;
    const startY = topH + 50 - this.scrollY;

    for (let i = 1; i < levels.length; i++) {
      const row = Math.floor((i - 1) / cols);
      const col = (i - 1) % cols;
      const cx = 20 + col * cellW + cellW / 2;
      const cy = startY + row * cellH + cellH / 2;
      const unlocked = i <= this.progress.unlocked;
      const stars = this.progress.stars[i] || 0;

      // 关卡方块
      ctx.beginPath();
      this.roundRect(cx - 30, cy - 30, 60, 60, 10);
      if (unlocked) {
        ctx.fillStyle = stars > 0 ? COLORS.police : COLORS.nodeStroke;
      } else {
        ctx.fillStyle = '#CCCCCC';
      }
      ctx.fill();

      // 关卡号
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unlocked ? '' + i : '🔒', cx, cy - 4);

      // 星星
      if (stars > 0) {
        ctx.font = '10px sans-serif';
        let starStr = '';
        for (let s = 0; s < 3; s++) {
          starStr += s < stars ? '★' : '☆';
        }
        ctx.fillStyle = COLORS.star;
        ctx.fillText(starStr, cx, cy + 20);
      }

      // 关卡名
      if (levels[i]) {
        ctx.fillStyle = COLORS.textLight;
        ctx.font = '10px sans-serif';
        ctx.fillText(levels[i].name, cx, cy + 42);
      }
    }
    ctx.restore();
  }

  // ==================== 游戏场景 ====================
  startLevel(num) {
    this.levelNum = num;
    this.levelData = levels[num];
    if (!this.levelData) return;

    const ld = this.levelData;
    this.graph = new Graph(ld.nodes, ld.edges);
    this.policePos = ld.police.slice();
    this.thiefPos = ld.thief;
    this.exits = ld.exits.slice();
    this.stepLimit = ld.steps;
    this.steps = 0;
    this.selectedPolice = -1;
    this.validMoves = [];
    this.gameState = 'playing';
    this.message = '';
    this.animations = [];
    this.resultTimer = 0;
    this.scene = 'game';

    // 计算节点屏幕坐标
    this.calcNodePositions();
  }

  calcNodePositions() {
    const topH = this.topBarH;
    const gameTop = topH + 15;
    const gameBottom = this.H - BOTTOM_BAR_H;
    const gameH = gameBottom - gameTop;
    const gameW = this.W;
    this.nodeScreenPos = this.levelData.nodes.map(n => ({
      x: PADDING + n.x * (gameW - PADDING * 2),
      y: gameTop + PADDING + n.y * (gameH - PADDING * 2),
    }));
  }

  handleGameTouch(x, y) {
    const mr = this.menuRect;
    const topH = this.topBarH;
    // 重来按钮（左侧）
    if (x >= 8 && x <= 68 && y >= mr.top && y <= mr.bottom) {
      this.startLevel(this.levelNum);
      return;
    }
    // 选关按钮（重来右侧）
    if (x >= 74 && x <= 134 && y >= mr.top && y <= mr.bottom) {
      this.scene = 'levelSelect';
      return;
    }
    // 规则按钮（胶囊左边）
    const ruleBtnX = mr.left - 60 - 8;
    if (x >= ruleBtnX && x <= mr.left - 8 && y >= mr.top && y <= mr.bottom) {
      this.prevScene = 'game';
      this.scene = 'rules';
      return;
    }

    // 胜利/失败时的按钮
    if (this.gameState === 'win' || this.gameState === 'lose') {
      this.handleResultTouch(x, y);
      return;
    }

    if (this.gameState !== 'playing') return;

    // 查找点击的节点
    for (let i = 0; i < this.nodeScreenPos.length; i++) {
      const np = this.nodeScreenPos[i];
      const dx = x - np.x, dy = y - np.y;
      if (dx * dx + dy * dy <= (NODE_RADIUS + 12) * (NODE_RADIUS + 12)) {
        this.onNodeTap(i);
        return;
      }
    }

    // 点击空白取消选择
    this.selectedPolice = -1;
    this.validMoves = [];
  }

  onNodeTap(nodeIndex) {
    // 检查是否点击了警察
    const policeIndex = this.policePos.indexOf(nodeIndex);
    if (policeIndex !== -1) {
      this.selectedPolice = policeIndex;
      this.playSFX('select');
      const neighbors = this.graph.neighbors(nodeIndex);
      // 可移动到空节点或小偷节点（直接抓捕）
      this.validMoves = neighbors.filter(n =>
        this.policePos.indexOf(n) === -1
      );
      return;
    }

    // 检查是否点击了有效移动目标
    if (this.selectedPolice !== -1 && this.validMoves.indexOf(nodeIndex) !== -1) {
      this.executeMove(this.selectedPolice, nodeIndex);
      return;
    }

    // 取消选择
    this.selectedPolice = -1;
    this.validMoves = [];
  }

  executeMove(policeIndex, targetNode) {
    const fromNode = this.policePos[policeIndex];
    this.gameState = 'animating';
    this.selectedPolice = -1;
    this.validMoves = [];
    this.playSFX('move');

    // 警察移动动画
    this.startAnimation(
      this.nodeScreenPos[fromNode],
      this.nodeScreenPos[targetNode],
      'police',
      policeIndex,
      () => {
        this.policePos[policeIndex] = targetNode;
        this.steps++;

        // 检查是否直接抓到小偷
        if (targetNode === this.thiefPos) {
          this.onWin();
          return;
        }

        // 检查小偷是否被困（所有相邻节点都被警察占据）
        const thiefMoves = this.graph.neighbors(this.thiefPos)
          .filter(n => this.policePos.indexOf(n) === -1);
        if (thiefMoves.length === 0) {
          this.onWin();
          return;
        }

        // 小偷移动
        this.thiefMove();
      }
    );
  }

  thiefMove() {
    const move = ThiefAI.getMove(
      this.graph, this.thiefPos, this.policePos, this.exits, this.levelData.ai
    );

    if (move === -1) {
      this.onWin();
      return;
    }

    this.playSFX('thief_move');
    // 小偷移动动画
    this.startAnimation(
      this.nodeScreenPos[this.thiefPos],
      this.nodeScreenPos[move],
      'thief',
      0,
      () => {
        this.thiefPos = move;

        // 检查是否到达出口
        if (this.exits.indexOf(move) !== -1) {
          this.onLose('小偷逃跑了！');
          return;
        }

        // 检查小偷是否被困
        const thiefMoves = this.graph.neighbors(this.thiefPos)
          .filter(n => this.policePos.indexOf(n) === -1);
        if (thiefMoves.length === 0) {
          this.onWin();
          return;
        }

        // 检查步数
        if (this.steps >= this.stepLimit) {
          this.onLose('步数用完了！');
          return;
        }

        this.gameState = 'playing';
      }
    );
  }

  onWin() {
    this.gameState = 'win';
    this.resultTimer = 0;
    this.playSFX('win');
    // 计算星级
    const optimal = this.levelData.optimal;
    let starCount = 1;
    if (this.steps <= optimal) starCount = 3;
    else if (this.steps <= optimal + 2) starCount = 2;
    this.currentStars = starCount;
    // 保存进度
    const prev = this.progress.stars[this.levelNum] || 0;
    if (starCount > prev) this.progress.stars[this.levelNum] = starCount;
    if (this.levelNum >= this.progress.unlocked && this.levelNum < levels.length - 1) {
      this.progress.unlocked = this.levelNum + 1;
    }
    this.saveProgress();
  }

  onLose(msg) {
    this.gameState = 'lose';
    this.message = msg || '围堵失败！';
    this.resultTimer = 0;
    this.playSFX('lose');
  }

  // ==================== 动画系统 ====================
  startAnimation(from, to, type, index, callback) {
    this.animations.push({
      fromX: from.x, fromY: from.y,
      toX: to.x, toY: to.y,
      type, index,
      progress: 0,
      callback,
    });
  }

  updateAnimations(dt) {
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const a = this.animations[i];
      a.progress += dt / ANIM_DURATION;
      if (a.progress >= 1) {
        a.progress = 1;
        if (a.callback) a.callback();
        this.animations.splice(i, 1);
      }
    }
  }

  getAnimPos(anim) {
    const t = this.easeInOut(anim.progress);
    return {
      x: anim.fromX + (anim.toX - anim.fromX) * t,
      y: anim.fromY + (anim.toY - anim.fromY) * t,
    };
  }

  easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // ==================== 渲染：游戏场景 ====================
  renderGame() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // 顶部栏
    this.renderGameTopBar();

    // 底部信息栏
    this.renderGameBottomBar();

    // 绘制边
    this.renderEdges();

    // 绘制节点
    this.renderNodes();

    // 绘制角色
    this.renderCharacters();

    // 动画中的角色
    this.renderAnimations();

    // 胜利/失败覆盖层
    if (this.gameState === 'win' || this.gameState === 'lose') {
      this.renderResultOverlay();
    }
  }

  renderGameTopBar() {
    const ctx = this.ctx;
    const W = this.W;
    const mr = this.menuRect; // 微信胶囊按钮位置

    // 按钮行与胶囊按钮垂直对齐
    const btnY = mr.top;
    const btnH = mr.bottom - mr.top;
    // 第二行：关卡信息，在胶囊下方
    const infoY = mr.bottom + 6;
    // 顶部栏总高度
    const topH = infoY + 40;

    // 顶部背景
    ctx.fillStyle = 'rgba(245,239,220,0.95)';
    ctx.fillRect(0, 0, W, topH);

    // 底部分隔线
    ctx.strokeStyle = COLORS.nodeStroke;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.moveTo(0, topH);
    ctx.lineTo(W, topH);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 重来按钮 — 左侧，与胶囊同行
    this.drawSmallButton(8, btnY, 60, btnH, '重来');

    // 选关按钮 — 重来右侧
    this.drawSmallButton(74, btnY, 60, btnH, '选关');

    // 规则按钮 — 紧贴胶囊左边
    const ruleBtnW = 60;
    const ruleBtnX = mr.left - ruleBtnW - 8;
    this.drawSmallButton(ruleBtnX, btnY, ruleBtnW, btnH, '规则');

    // 关卡标签（胶囊样式）— 居中在选关和规则之间
    const labelLeft = 140;
    const labelRight = ruleBtnX - 8;
    const labelW = Math.min(120, labelRight - labelLeft);
    const labelX = labelLeft + (labelRight - labelLeft - labelW) / 2;
    ctx.fillStyle = COLORS.nodeStroke;
    ctx.beginPath();
    this.roundRect(labelX, btnY, labelW, btnH, btnH / 2);
    ctx.fill();

    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold ' + Math.min(17, btnH * 0.5) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('第 ' + this.levelNum + ' 关', labelX + labelW / 2, btnY + btnH / 2);

    // 关卡名称 + 描述（第二行）
    ctx.fillStyle = COLORS.title;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(this.levelData.name, W / 2, infoY + 8);

    ctx.fillStyle = COLORS.textLight;
    ctx.font = '12px sans-serif';
    ctx.fillText(this.levelData.desc || '', W / 2, infoY + 26);
  }

  renderGameBottomBar() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    ctx.fillStyle = COLORS.title;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const remaining = this.stepLimit - this.steps;
    ctx.fillText('剩余步数: ' + remaining + ' / ' + this.stepLimit + '  (最优' + this.levelData.optimal + '步)', W / 2, H - BOTTOM_BAR_H + 25);

    // 步数条
    const barW = W - 80;
    const barH = 8;
    const barX = 40;
    const barY = H - BOTTOM_BAR_H + 48;

    ctx.fillStyle = '#E0E0E0';
    ctx.beginPath();
    this.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    const ratio = Math.max(0, remaining / this.stepLimit);
    let barColor = COLORS.win;
    if (ratio < 0.3) barColor = COLORS.lose;
    else if (ratio < 0.6) barColor = COLORS.exit;

    ctx.fillStyle = barColor;
    ctx.beginPath();
    this.roundRect(barX, barY, barW * ratio, barH, 4);
    ctx.fill();

    // 提示文字
    if (this.gameState === 'playing' && this.selectedPolice === -1) {
      ctx.fillStyle = COLORS.textLight;
      ctx.font = '13px sans-serif';
      ctx.fillText('点击警察选择，再点击相邻节点移动', W / 2, H - 18);
    } else if (this.gameState === 'playing' && this.selectedPolice !== -1) {
      ctx.fillStyle = COLORS.police;
      ctx.font = '13px sans-serif';
      ctx.fillText('点击绿色节点移动警察', W / 2, H - 18);
    }
  }

  renderEdges() {
    const ctx = this.ctx;
    const ld = this.levelData;
    for (const [a, b] of ld.edges) {
      const pa = this.nodeScreenPos[a];
      const pb = this.nodeScreenPos[b];

      // 阴影
      ctx.strokeStyle = COLORS.edgeShadow;
      ctx.lineWidth = COLORS.edgeWidth + 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y + 2);
      ctx.lineTo(pb.x, pb.y + 2);
      ctx.stroke();

      // 主线
      ctx.strokeStyle = COLORS.edge;
      ctx.lineWidth = COLORS.edgeWidth;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
  }

  renderNodes() {
    const ctx = this.ctx;
    const pulse = Math.sin(this.pulseTime * 3) * 0.3 + 0.7;

    for (let i = 0; i < this.nodeScreenPos.length; i++) {
      const p = this.nodeScreenPos[i];
      const isExit = this.exits.indexOf(i) !== -1;
      const isValid = this.validMoves.indexOf(i) !== -1;
      const isSelectedNode = this.selectedPolice !== -1 && this.policePos[this.selectedPolice] === i;

      // 选中发光
      if (isSelectedNode) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, NODE_RADIUS + 8, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.highlightGlow;
        ctx.fill();
      }

      // 有效移动发光
      if (isValid) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, NODE_RADIUS + 6 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.validMoveGlow;
        ctx.fill();
      }

      // 节点阴影
      ctx.beginPath();
      ctx.arc(p.x, p.y + 2, NODE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.shadow;
      ctx.fill();

      // 节点本体
      ctx.beginPath();
      ctx.arc(p.x, p.y, NODE_RADIUS, 0, Math.PI * 2);
      if (isExit) {
        ctx.fillStyle = COLORS.exit;
        ctx.strokeStyle = COLORS.exitDark;
      } else if (isValid) {
        ctx.fillStyle = COLORS.validMove;
        ctx.strokeStyle = '#388E3C';
      } else if (isSelectedNode) {
        ctx.fillStyle = COLORS.highlight;
        ctx.strokeStyle = '#F9A825';
      } else {
        ctx.fillStyle = COLORS.nodeFill;
        ctx.strokeStyle = COLORS.nodeStroke;
      }
      ctx.fill();
      ctx.lineWidth = COLORS.nodeStrokeWidth;
      ctx.stroke();

      // 出口文字
      if (isExit) {
        ctx.fillStyle = COLORS.white;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('出口', p.x, p.y);
      }
    }
  }

  renderCharacters() {
    // 是否有动画中的角色
    const animatingPolice = new Set();
    const animatingThief = this.animations.some(a => a.type === 'thief');
    for (const a of this.animations) {
      if (a.type === 'police') animatingPolice.add(a.index);
    }

    // 绘制警察
    for (let i = 0; i < this.policePos.length; i++) {
      if (animatingPolice.has(i)) continue;
      const pos = this.nodeScreenPos[this.policePos[i]];
      this.drawPoliceIcon(pos.x, pos.y, CHAR_RADIUS);
    }

    // 绘制小偷
    if (!animatingThief) {
      const pos = this.nodeScreenPos[this.thiefPos];
      this.drawThiefIcon(pos.x, pos.y, CHAR_RADIUS);
    }
  }

  renderAnimations() {
    for (const anim of this.animations) {
      const pos = this.getAnimPos(anim);
      if (anim.type === 'police') {
        this.drawPoliceIcon(pos.x, pos.y, CHAR_RADIUS);
      } else {
        this.drawThiefIcon(pos.x, pos.y, CHAR_RADIUS);
      }
    }
  }

  // ==================== 结果覆盖层 ====================
  renderResultOverlay() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    // 遮罩
    ctx.fillStyle = COLORS.overlay;
    ctx.fillRect(0, 0, W, H);

    // 面板
    const panelW = 280, panelH = 280;
    const px = (W - panelW) / 2, py = (H - panelH) / 2 - 20;

    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    this.roundRect(px, py, panelW, panelH, 16);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    if (this.gameState === 'win') {
      // 胜利
      ctx.fillStyle = COLORS.win;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('围堵成功！', W / 2, py + 45);

      // 星星
      const starY = py + 95;
      for (let i = 0; i < 3; i++) {
        const sx = W / 2 + (i - 1) * 45;
        ctx.font = '36px sans-serif';
        const earned = i < this.currentStars;
        const showAnim = this.resultTimer > 0.3 + i * 0.3;
        if (earned && showAnim) {
          ctx.fillStyle = COLORS.star;
          ctx.fillText('★', sx, starY);
        } else {
          ctx.fillStyle = COLORS.starEmpty;
          ctx.fillText('☆', sx, starY);
        }
      }

      // 步数信息
      ctx.fillStyle = COLORS.text;
      ctx.font = '16px sans-serif';
      ctx.fillText('用了 ' + this.steps + ' 步 (最优 ' + this.levelData.optimal + ' 步)', W / 2, py + 145);

      // 按钮
      if (this.levelNum < levels.length - 1) {
        this.drawButton(W / 2 - 90, py + 175, 180, 44, '下一关', 18);
      }
      this.drawSmallButton(W / 2 - 55, py + 230, 110, 36, '重玩本关');
    } else {
      // 失败
      ctx.fillStyle = COLORS.lose;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('围堵失败', W / 2, py + 45);

      ctx.fillStyle = COLORS.text;
      ctx.font = '16px sans-serif';
      ctx.fillText(this.message, W / 2, py + 90);

      ctx.fillStyle = COLORS.textLight;
      ctx.font = '14px sans-serif';
      ctx.fillText('已用 ' + this.steps + ' / ' + this.stepLimit + ' 步', W / 2, py + 125);

      // 重试按钮
      this.drawButton(W / 2 - 90, py + 160, 180, 44, '再试一次', 18);
      this.drawSmallButton(W / 2 - 55, py + 218, 110, 36, '返回选关');
    }
  }

  handleResultTouch(x, y) {
    const W = this.W, H = this.H;
    const panelH = 280;
    const py = (H - panelH) / 2 - 20;

    if (this.gameState === 'win') {
      // 下一关
      if (this.levelNum < levels.length - 1) {
        if (x >= W/2 - 90 && x <= W/2 + 90 && y >= py + 175 && y <= py + 219) {
          this.startLevel(this.levelNum + 1);
          return;
        }
      }
      // 重玩
      if (x >= W/2 - 55 && x <= W/2 + 55 && y >= py + 230 && y <= py + 266) {
        this.startLevel(this.levelNum);
        return;
      }
    } else {
      // 再试一次
      if (x >= W/2 - 90 && x <= W/2 + 90 && y >= py + 160 && y <= py + 204) {
        this.startLevel(this.levelNum);
        return;
      }
      // 返回选关
      if (x >= W/2 - 55 && x <= W/2 + 55 && y >= py + 218 && y <= py + 254) {
        this.scene = 'levelSelect';
        return;
      }
    }
  }

  // ==================== 规则场景 ====================
  handleRulesTouch(_x, y) {
    // 点击底部按钮返回
    if (y > this.H - 80) {
      this.scene = this.prevScene;
    }
  }

  renderRules() {
    const ctx = this.ctx;
    const W = this.W, H = this.H;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // 标题
    ctx.fillStyle = COLORS.title;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('游戏规则', W / 2, 50);

    // 规则内容
    const rules = [
      { icon: '👮', text: '你操控三名警察（蓝色）' },
      { icon: '1️⃣', text: '每回合只能移动一名警察一步' },
      { icon: '🏃', text: '移动后小偷会自动逃跑' },
      { icon: '🚫', text: '堵住小偷所有退路即可获胜' },
      { icon: '🚪', text: '小偷到达出口你就输了' },
      { icon: '⭐', text: '步数越少星星越多' },
    ];

    const startY = 100;
    const lineH = 52;

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const y = startY + i * lineH;

      ctx.font = '22px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(r.icon, 30, y);

      ctx.fillStyle = COLORS.text;
      ctx.font = '15px sans-serif';
      ctx.fillText(r.text, 65, y);
    }

    // 图例
    const legendY = startY + rules.length * lineH + 30;
    ctx.fillStyle = COLORS.title;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('— 图例 —', W / 2, legendY);

    // 警察图标
    this.drawPoliceIcon(W * 0.2, legendY + 45, 14);
    ctx.fillStyle = COLORS.text;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('警察', W * 0.2, legendY + 72);

    // 小偷图标
    this.drawThiefIcon(W * 0.5, legendY + 45, 14);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('小偷', W * 0.5, legendY + 72);

    // 出口
    ctx.beginPath();
    ctx.arc(W * 0.8, legendY + 45, 14, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.exit;
    ctx.fill();
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('出口', W * 0.8, legendY + 45);
    ctx.fillStyle = COLORS.text;
    ctx.font = '13px sans-serif';
    ctx.fillText('出口', W * 0.8, legendY + 72);

    // 关闭按钮
    this.drawButton(W / 2 - 70, H - 70, 140, 44, '知道了', 18);
  }

  // ==================== 绘制辅助 ====================
  drawPoliceIcon(x, y, r) {
    const ctx = this.ctx;
    // 身体
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.police;
    ctx.fill();
    ctx.strokeStyle = COLORS.policeDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 帽子
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.65, r * 0.7, r * 0.28, 0, Math.PI, 0);
    ctx.fillStyle = COLORS.policeDark;
    ctx.fill();

    // 帽徽
    ctx.beginPath();
    ctx.arc(x, y - r * 0.55, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.star;
    ctx.fill();

    // 文字
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold ' + Math.max(10, r * 0.7) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('警', x, y + r * 0.15);
  }

  drawThiefIcon(x, y, r) {
    const ctx = this.ctx;
    // 身体
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.thief;
    ctx.fill();
    ctx.strokeStyle = COLORS.thiefDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 面罩
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.2, r * 0.75, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#333333';
    ctx.fill();

    // 眼睛
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.2, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.25, y - r * 0.2, r * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // 文字
    ctx.fillStyle = COLORS.white;
    ctx.font = 'bold ' + Math.max(10, r * 0.65) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('贼', x, y + r * 0.3);
  }

  drawButton(x, y, w, h, text, fontSize) {
    const ctx = this.ctx;
    // 阴影
    ctx.fillStyle = COLORS.buttonDark;
    ctx.beginPath();
    this.roundRect(x, y + 3, w, h, h / 2);
    ctx.fill();
    // 按钮
    ctx.fillStyle = COLORS.button;
    ctx.beginPath();
    this.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = COLORS.buttonLight;
    ctx.beginPath();
    this.roundRect(x + 4, y + 2, w - 8, h / 2 - 2, h / 4);
    ctx.fill();
    // 文字
    ctx.fillStyle = COLORS.buttonText;
    ctx.font = 'bold ' + (fontSize || 18) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
  }

  drawSoundButton(cx, cy) {
    const ctx = this.ctx;
    const r = 18;
    // 圆形背景
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = this.soundEnabled ? COLORS.nodeStroke : '#BBBBBB';
    ctx.fill();
    // 图标文字
    ctx.fillStyle = COLORS.white;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.soundEnabled ? '♪' : '✕', cx, cy);
  }

  drawSmallButton(x, y, w, h, text) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.button;
    ctx.beginPath();
    this.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = COLORS.buttonText;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ==================== 主循环 ====================
  start() {
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(now - this.lastTime, 50);
      this.lastTime = now;

      this.update(dt);
      this.render();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    this.pulseTime += dt / 1000;
    this.updateAnimations(dt);

    if (this.gameState === 'win' || this.gameState === 'lose') {
      this.resultTimer += dt / 1000;
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    switch (this.scene) {
      case 'menu': this.renderMenu(); break;
      case 'levelSelect': this.renderLevelSelect(); break;
      case 'game': this.renderGame(); break;
      case 'rules': this.renderRules(); break;
    }
  }
}

module.exports = Game;
