/**
 * LamaTrak — Animated Nature Background
 * Extracted from animated-background.html for use on the login screen.
 * Use NatureBg.start() / NatureBg.stop() to control the animation lifecycle.
 */

const CONFIG = {
  leaves: {
    count: 24,
    colors: [
      '#2e5e3e', '#3a6b4a', '#4a7a3a', '#5a8035',
      '#6b8a3a', '#7a6a2a', '#6a5a24', '#4e6e3a', '#3a5c2e'
    ],
    sizeMin: 3,
    sizeMax: 10,
    speedX: { min: 0.12, range: 0.35 },
    speedY: { min: -0.08, range: 0.25 },
    opacityMin: 0.12,
    opacityRange: 0.3,
    wobbleSpeed: { min: 0.006, range: 0.012 },
  },
  seeds: {
    count: 16,
    sizeMin: 3.5,
    sizeMax: 8.5,
    speedY: { min: -0.3, range: -0.1 },
    speedX: { min: 0.04, range: 0.25 },
    opacityMin: 0.25,
    opacityRange: 0.4,
    bodyColor: 'rgba(225,235,215,0.7)',
    stemColor: 'rgba(230,240,220,0.55)',
    spokeColor: 'rgba(235,240,225,0.45)',
    tipColor: 'rgba(240,245,230,0.4)',
  },
  birds: {
    spawnIntervalMin: 300,
    spawnIntervalRange: 300,
    sizeMin: 5,
    sizeMax: 12,
    speedMin: 0.25,
    speedRange: 0.45,
    maxOpacityMin: 0.2,
    maxOpacityRange: 0.3,
    strokeColor: '#9ac4e0',
    strokeWidth: 1.3,
    fadeInRate: 0.004,
    fadeOutRate: 0.004,
    fadeOutDistance: 80,
  },
};

class NatureBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;
    this.leaves = [];
    this.seeds = [];
    this.birds = [];
    this.t = 0;
    this.birdTimer = 0;
    this.nextBirdTime = Math.random() * CONFIG.birds.spawnIntervalRange + CONFIG.birds.spawnIntervalMin;
    this.animId = null;

    this._resize();
    this._initLeaves();
    this._initSeeds();

    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  start() {
    const loop = () => {
      this._draw();
      this.animId = requestAnimationFrame(loop);
    };
    loop();
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
    window.removeEventListener('resize', this._onResize);
  }

  get W() { return this.canvas.offsetWidth; }
  get H() { return this.canvas.offsetHeight; }

  _resize() {
    this.canvas.width = this.canvas.offsetWidth * this.dpr;
    this.canvas.height = this.canvas.offsetHeight * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _makeLeaf(randomY = false) {
    const cfg = CONFIG.leaves;
    return {
      x: randomY ? Math.random() * this.W : -20 - Math.random() * 160,
      y: randomY ? Math.random() * this.H : Math.random() * this.H * 0.85 + this.H * 0.05,
      size: Math.random() * (cfg.sizeMax - cfg.sizeMin) + cfg.sizeMin,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.025,
      vx: Math.random() * cfg.speedX.range + cfg.speedX.min,
      vy: Math.random() * cfg.speedY.range + cfg.speedY.min,
      wobP: Math.random() * Math.PI * 2,
      wobS: Math.random() * cfg.wobbleSpeed.range + cfg.wobbleSpeed.min,
      color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
      opacity: Math.random() * cfg.opacityRange + cfg.opacityMin,
      type: Math.floor(Math.random() * 4),
    };
  }

  _initLeaves() {
    this.leaves = Array.from({ length: CONFIG.leaves.count }, () => this._makeLeaf(true));
  }

  _drawLeaf(l) {
    const ctx = this.ctx;
    const s = l.size;
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(l.rot);
    ctx.globalAlpha = l.opacity;
    ctx.fillStyle = l.color;

    ctx.beginPath();
    if (l.type === 0) {
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.75, -s * 0.25, 0, s);
      ctx.quadraticCurveTo(-s * 0.75, -s * 0.25, 0, -s);
    } else if (l.type === 1) {
      ctx.ellipse(0, 0, s * 0.35, s, 0, 0, Math.PI * 2);
    } else if (l.type === 2) {
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 1.1, 0, 0, s);
      ctx.quadraticCurveTo(-s * 0.35, 0, 0, -s);
    } else {
      ctx.moveTo(0, -s * 0.9);
      ctx.bezierCurveTo(s * 0.9, -s * 0.5, s * 0.6, s * 0.4, 0, s);
      ctx.bezierCurveTo(-s * 0.6, s * 0.4, -s * 0.9, -s * 0.5, 0, -s * 0.9);
    }
    ctx.fill();

    ctx.strokeStyle = l.color;
    ctx.globalAlpha = l.opacity * 0.4;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(0, s * 0.7);
    ctx.stroke();
    if (l.type === 3 || l.type === 0) {
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.2);
      ctx.lineTo(s * 0.3, s * 0.15);
      ctx.moveTo(0, s * 0.1);
      ctx.lineTo(-s * 0.25, s * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  _makeSeed(randomY = false) {
    const cfg = CONFIG.seeds;
    return {
      x: Math.random() * this.W,
      y: randomY ? Math.random() * this.H : this.H + 15 + Math.random() * 80,
      vy: Math.random() * cfg.speedY.range + cfg.speedY.min,
      vx: Math.random() * cfg.speedX.range + cfg.speedX.min,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.008,
      size: Math.random() * (cfg.sizeMax - cfg.sizeMin) + cfg.sizeMin,
      wobP: Math.random() * Math.PI * 2,
      wobS: Math.random() * 0.008 + 0.004,
      opacity: Math.random() * cfg.opacityRange + cfg.opacityMin,
      spokes: Math.floor(Math.random() * 4) + 5,
    };
  }

  _initSeeds() {
    this.seeds = Array.from({ length: CONFIG.seeds.count }, () => this._makeSeed(true));
  }

  _drawSeed(s) {
    const ctx = this.ctx;
    const cfg = CONFIG.seeds;
    const sz = s.size;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.globalAlpha = s.opacity;

    ctx.fillStyle = cfg.bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, sz * 0.5, sz * 0.12, sz * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = cfg.stemColor;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, sz * 0.35);
    ctx.lineTo(0, -sz * 0.3);
    ctx.stroke();

    for (let i = 0; i < s.spokes; i++) {
      const angle = (i / s.spokes) * Math.PI * 2;
      const len = sz * 0.85;
      const ex = Math.cos(angle) * len;
      const ey = -sz * 0.3 + Math.sin(angle) * len * 0.25 - len * 0.5;

      ctx.strokeStyle = cfg.spokeColor;
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(0, -sz * 0.3);
      ctx.quadraticCurveTo(ex * 0.35, ey + len * 0.25, ex, ey);
      ctx.stroke();

      ctx.fillStyle = cfg.tipColor;
      ctx.beginPath();
      ctx.arc(ex, ey, sz * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _makeBird() {
    const cfg = CONFIG.birds;
    const y = Math.random() * this.H * 0.35 + this.H * 0.03;
    const fromLeft = Math.random() > 0.3;
    return {
      x: fromLeft ? -30 : this.W + 30,
      y, baseY: y,
      size: Math.random() * (cfg.sizeMax - cfg.sizeMin) + cfg.sizeMin,
      speed: (fromLeft ? 1 : -1) * (Math.random() * cfg.speedRange + cfg.speedMin),
      wP: Math.random() * Math.PI * 2,
      wS: Math.random() * 0.045 + 0.025,
      bP: Math.random() * Math.PI * 2,
      opacity: 0,
      maxOpacity: Math.random() * cfg.maxOpacityRange + cfg.maxOpacityMin,
      fadeIn: true,
      glide: Math.random() > 0.4,
      dir: fromLeft ? 1 : -1,
    };
  }

  _drawBird(b) {
    const ctx = this.ctx;
    const cfg = CONFIG.birds;
    const s = b.size;
    const wing = b.glide
      ? Math.sin(this.t * b.wS * 0.25 + b.wP) * 0.12 + 0.28
      : Math.sin(this.t * b.wS + b.wP) * 0.45;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.scale(b.dir, 1);
    ctx.globalAlpha = b.opacity;
    ctx.strokeStyle = cfg.strokeColor;
    ctx.lineWidth = cfg.strokeWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-s, -s * wing);
    ctx.quadraticCurveTo(-s * 0.3, -s * wing * 1.7, 0, 0);
    ctx.quadraticCurveTo(s * 0.3, -s * wing * 1.7, s, -s * wing);
    ctx.stroke();
    ctx.restore();
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const cfg = CONFIG;
    this.t++;
    this.birdTimer++;

    ctx.clearRect(0, 0, W, H);

    this.seeds.forEach(s => {
      s.y += s.vy;
      s.x += s.vx + Math.sin(this.t * s.wobS + s.wobP) * 0.4;
      s.rot += s.rotV;
      if (s.y < -35 || s.x > W + 35) Object.assign(s, this._makeSeed());
      this._drawSeed(s);
    });

    this.leaves.forEach(l => {
      l.x += l.vx + Math.sin(this.t * l.wobS + l.wobP) * 0.45;
      l.y += l.vy + Math.cos(this.t * l.wobS * 0.7 + l.wobP) * 0.15;
      l.rot += l.rotV + Math.sin(this.t * 0.008 + l.wobP) * 0.004;
      if (l.x > W + 35 || l.y > H + 35 || l.y < -35) Object.assign(l, this._makeLeaf());
      this._drawLeaf(l);
    });

    if (this.birdTimer >= this.nextBirdTime) {
      this.birds.push(this._makeBird());
      this.birdTimer = 0;
      this.nextBirdTime = Math.random() * cfg.birds.spawnIntervalRange + cfg.birds.spawnIntervalMin;
    }

    this.birds.forEach(b => {
      b.x += b.speed;
      b.y = b.baseY + Math.sin(this.t * 0.006 + b.bP) * 10;
      if (b.fadeIn) {
        b.opacity += cfg.birds.fadeInRate;
        if (b.opacity >= b.maxOpacity) { b.opacity = b.maxOpacity; b.fadeIn = false; }
      }
      const edgeDist = b.dir > 0 ? W - b.x : b.x;
      if (edgeDist < cfg.birds.fadeOutDistance) {
        b.opacity = Math.max(0, b.opacity - cfg.birds.fadeOutRate);
      }
      this._drawBird(b);
    });

    this.birds = this.birds.filter(b => b.x > -60 && b.x < W + 60 && b.opacity > 0.001);
  }
}

/* ── Lifecycle wrapper ── */
var NatureBg = {
  _bg: null,
  init: function() {
    var canvas = document.getElementById('nature-canvas');
    if (!canvas) return;
    this._bg = new NatureBackground(canvas);
  },
  start: function() {
    if (!this._bg) this.init();
    if (this._bg) this._bg.start();
  },
  stop: function() {
    if (this._bg) {
      this._bg.destroy();
      this._bg = null;
    }
  }
};
