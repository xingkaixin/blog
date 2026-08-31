import { Fishing, FishingPhase, KOI_SPECIES, REEL_DURATION, type Point } from "./fishing";

function drawKoi(ctx: CanvasRenderingContext2D, palette: number, bend: number): void {
  const colors = KOI_SPECIES[palette];
  ctx.fillStyle = "rgba(240, 246, 231, 0.7)";
  ctx.beginPath();
  ctx.ellipse(6, 8, 10, 4, 0.6, 0, Math.PI * 2);
  ctx.ellipse(6, -8, 10, 4, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-20, bend * 6);
  ctx.quadraticCurveTo(-29, bend * 12 - 5, -36, bend * 12 - 12);
  ctx.quadraticCurveTo(-31, bend * 12, -36, bend * 12 + 12);
  ctx.quadraticCurveTo(-29, bend * 12 + 5, -20, bend * 6);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.bezierCurveTo(15, 12, -4, 13, -22, bend * 6);
  ctx.bezierCurveTo(-4, -13, 15, -12, 22, 0);
  ctx.fillStyle = colors.body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = colors.mark;
  ctx.beginPath();
  ctx.ellipse(12, 0, 5, 5, 0, 0, Math.PI * 2);
  if (palette !== 4) {
    ctx.ellipse(-2, 2, 8, 6, -0.3, 0, Math.PI * 2);
    ctx.ellipse(-16, 0, 5, 4, 0.2, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#121b1b";
  ctx.beginPath();
  ctx.arc(16, 4, 1.3, 0, Math.PI * 2);
  ctx.arc(16, -4, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawRod(
  ctx: CanvasRenderingContext2D,
  end: Point,
  w: number,
  h: number,
  tension: number,
): void {
  const butt = { x: w * 0.92, y: h + 16 };
  const tip = { x: butt.x + (end.x - butt.x) * 0.65, y: end.y - 26 - tension * 12 };
  const mid = { x: (butt.x + tip.x) / 2 - tension * 16, y: (butt.y + tip.y) / 2 };
  const gradient = ctx.createLinearGradient(butt.x, butt.y, tip.x, tip.y);
  gradient.addColorStop(0, "#5c4827");
  gradient.addColorStop(0.4, "#bfa15f");
  gradient.addColorStop(0.8, "#d6b876");
  gradient.addColorStop(1, "#8f6f36");
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(butt.x, butt.y);
  ctx.quadraticCurveTo(mid.x, mid.y, tip.x, tip.y);
  ctx.stroke();
  ctx.fillStyle = "#65512e";
  for (let i = 1; i < 4; i++) {
    const p = i / 4;
    const q = 1 - p;
    ctx.beginPath();
    ctx.arc(
      q * q * butt.x + 2 * q * p * mid.x + p * p * tip.x,
      q * q * butt.y + 2 * q * p * mid.y + p * p * tip.y,
      2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(235, 245, 240, 0.8)";
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.quadraticCurveTo((tip.x + end.x) / 2, (tip.y + end.y) / 2 + 16 * (1 - tension), end.x, end.y);
  ctx.stroke();
}

function drawBobber(
  ctx: CanvasRenderingContext2D,
  point: Point,
  t: number,
  phase: FishingPhase,
): void {
  const biting = phase === FishingPhase.Bite;
  const nibbling = phase === FishingPhase.Nibble;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.strokeStyle = biting ? "rgba(255, 209, 102, 0.85)" : "rgba(230, 249, 240, 0.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 2, biting ? 14 : 9, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  const sink = biting
    ? 8 + Math.sin(t * 28) * 2
    : nibbling
      ? Math.sin(t * 20) * 3
      : Math.sin(t * 3.4) * 1.5;
  ctx.translate(0, sink);
  ctx.rotate(biting ? 0.4 + Math.sin(t * 24) * 0.12 : 0);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#f5f5e8";
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(0, 9);
  ctx.stroke();
  ctx.strokeStyle = "#ee532f";
  ctx.beginPath();
  ctx.moveTo(0, -19);
  ctx.lineTo(0, -12);
  ctx.stroke();
  ctx.fillStyle = "#ee532f";
  ctx.beginPath();
  ctx.ellipse(0, 1, 3, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawFishingOverlay(
  ctx: CanvasRenderingContext2D,
  fishing: Fishing,
  t: number,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  const state = fishing.state;
  if (state.phase === FishingPhase.Idle) {
    return;
  }
  // 水面在窄屏横向裁切，浮漂和鱼仍使用同一套 3:1 世界坐标。
  const origin = {
    x: (fishing.bobber.x - 1.5) * height + width / 2,
    y: (1 - fishing.bobber.y) * height,
  };
  const end = { ...origin };
  let angle = 0;
  let scale = 1;
  if (state.phase === FishingPhase.Reeling) {
    const p = Math.min(1, fishing.stateTime / REEL_DURATION);
    const q = 1 - p;
    const basket = { x: width - 40, y: height - 24 };
    const control = {
      x: (origin.x + basket.x) / 2,
      y: Math.max(26, Math.min(origin.y, basket.y) - height * 0.65),
    };
    end.x = q * q * origin.x + 2 * q * p * control.x + p * p * basket.x;
    end.y = q * q * origin.y + 2 * q * p * control.y + p * p * basket.y;
    angle = Math.atan2(
      q * (control.y - origin.y) + p * (basket.y - control.y),
      q * (control.x - origin.x) + p * (basket.x - control.x),
    );
    scale = 0.7 + Math.sin(p * Math.PI) * 0.3;
    ctx.fillStyle = `rgba(230, 248, 255, ${Math.max(0, 1 - fishing.stateTime / 0.65) * 0.8})`;
    for (let i = 0; i < 18; i++) {
      const age = fishing.stateTime;
      const direction = -Math.PI * 0.85 + (i / 17) * Math.PI * 0.7;
      const speed = 50 + ((i * 37) % 90);
      ctx.beginPath();
      ctx.arc(
        origin.x + Math.cos(direction) * speed * age,
        origin.y + Math.sin(direction) * speed * age + 180 * age * age,
        1.2 + (i % 3) * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  drawRod(
    ctx,
    end,
    width,
    height,
    state.phase === FishingPhase.Bite || state.phase === FishingPhase.Reeling ? 1 : 0,
  );
  if (state.phase === FishingPhase.Reeling) {
    ctx.save();
    ctx.translate(end.x, end.y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    drawKoi(ctx, state.catch.palette, Math.sin(fishing.stateTime * 32) * 0.5);
    ctx.restore();
  } else {
    drawBobber(ctx, origin, t, state.phase);
  }
}
