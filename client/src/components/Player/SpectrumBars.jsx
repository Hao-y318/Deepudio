// 音频频谱可视化 - 64段 Canvas，动态渐变

import { useRef, useEffect } from 'preact/hooks';

let audioCtx = null;
let analyser = null;
let source = null;
let animId = null;

export function SpectrumBars() {
  const canvasRef = useRef(null);

  useEffect(() => {
    setupAudio();
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  function setupAudio() {
    // 尝试从全局 audio 元素连接
    const audioEl = document.querySelector('audio');
    if (!audioEl) {
      // 没有 audio 元素时显示呼吸动画
      drawIdle(canvasRef.current);
      return;
    }

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (!source) {
        source = audioCtx.createMediaElementSource(audioEl);
      }
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      draw();
    } catch {
      drawIdle(canvasRef.current);
    }
  }

  function draw() {
    animId = requestAnimationFrame(draw);
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, W, H);

    // 倒对数映射：低音在中间
    const barCount = 64;
    const barWidth = (W / barCount) * 0.8;
    const gap = (W / barCount) * 0.2;

    for (let i = 0; i < barCount; i++) {
      // 对称映射（低频→中间，高频→两边）
      const half = barCount / 2;
      let srcIdx;
      if (i < half) {
        srcIdx = Math.floor((i / half) ** 2 * bufferLength * 0.4);
      } else {
        srcIdx = Math.floor(((barCount - 1 - i) / half) ** 2 * bufferLength * 0.4);
      }

      const value = dataArray[Math.min(srcIdx, bufferLength - 1)] || 0;
      const barHeight = (value / 255) * H * 0.85;

      // 渐变颜色
      const gradient = ctx.createLinearGradient(0, H, 0, H - barHeight);
      const pos = i / barCount;
      const r = Math.floor(236 + pos * 19);        // pink range
      const g = Math.floor(72 + pos * 128);
      const b = Math.floor(153 + pos * 47);
      gradient.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
      gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.7)`);
      gradient.addColorStop(1, `rgba(${r+40},${g+40},${b+40},0.9)`);

      ctx.fillStyle = gradient;
      const x = i * (barWidth + gap);
      const radius = barWidth / 2;
      ctx.beginPath();
      ctx.roundRect(x, H - barHeight, barWidth, barHeight, radius);
      ctx.fill();

      // 顶部高亮
      if (barHeight > 2) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + value / 512})`;
        ctx.beginPath();
        ctx.roundRect(x, H - barHeight, barWidth, 3, radius);
        ctx.fill();
      }
    }
  }

  function drawIdle(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const barCount = 64;
    const barWidth = (W / barCount) * 0.8;
    const gap = (W / barCount) * 0.2;

    function frame() {
      animId = requestAnimationFrame(frame);
      ctx.clearRect(0, 0, W, H);
      const t = Date.now() / 1000;
      for (let i = 0; i < barCount; i++) {
        const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
        const h = Math.sin(t * 2 + i * 0.15) * 15 + 20 - centerDist * 10;
        const gradient = ctx.createLinearGradient(0, H, 0, H - h);
        gradient.addColorStop(0, `rgba(236,72,153,0.2)`);
        gradient.addColorStop(1, `rgba(236,72,153,0.5)`);
        ctx.fillStyle = gradient;
        const x = i * (barWidth + gap);
        ctx.beginPath();
        ctx.roundRect(x, H - Math.max(2, h), barWidth, Math.max(2, h), barWidth / 2);
        ctx.fill();
      }
    }
    frame();
  }

  return (
    <canvas
      ref={canvasRef}
      class="spectrum-canvas"
      width={380}
      height={80}
    />
  );
}
