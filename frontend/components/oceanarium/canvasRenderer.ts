// High-performance canvas renderer for the living oceanarium simulation

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  type: 'bubble' | 'plankton' | 'sparkle';
}

export interface FoodPellet {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: 'flake' | 'super_pellet';
  wobble: number;
}

export interface RenderFishState {
  id: number;
  species_id: string;
  name: string;
  nickname?: string | null;
  depth_zone: 'sunlit' | 'twilight' | 'abyssal';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  scale: number;
  primary_color: string;
  secondary_color: string;
  glow: boolean;
  body_type: string;
  tail_angle: number;
  tail_speed: number;
  status: 'active' | 'dormant';
  is_favorite: number;
}

/**
 * Draw vertical ocean depth background and water turbidity
 */
export function drawDepthBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  waterQuality: number
) {
  // 1. Ocean depth gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#00c6ff');      // Sunlit surface
  gradient.addColorStop(0.25, '#0072ff');   // Shallow reef
  gradient.addColorStop(0.45, '#12234e');   // Twilight upper
  gradient.addColorStop(0.70, '#0a1128');   // Twilight lower
  gradient.addColorStop(0.85, '#020617');   // Abyssal trench
  gradient.addColorStop(1.0, '#000208');    // Seafloor abyss

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Sunlight caustic rays (surface to ~35% height)
  const rayHeight = height * 0.35;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const rayX = (width / 6) * i + Math.sin(time * 0.001 + i) * 30;
    const rayWidth = 40 + Math.sin(time * 0.002 + i) * 15;
    const rayGrad = ctx.createLinearGradient(rayX, 0, rayX + 60, rayHeight);
    rayGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    rayGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.04)');
    rayGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(rayX - rayWidth / 2, 0);
    ctx.lineTo(rayX + rayWidth / 2, 0);
    ctx.lineTo(rayX + rayWidth * 1.5, rayHeight);
    ctx.lineTo(rayX - rayWidth * 0.5, rayHeight);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 3. Seafloor rocky silhouette with glowing bioluminescent vents
  ctx.save();
  ctx.fillStyle = '#01030a';
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, height - 35);
  ctx.bezierCurveTo(width * 0.25, height - 55, width * 0.4, height - 20, width * 0.6, height - 45);
  ctx.bezierCurveTo(width * 0.75, height - 60, width * 0.9, height - 30, width, height - 40);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // Coral / Vent glows at bottom
  ctx.fillStyle = '#66fcf1';
  ctx.shadowColor = '#66fcf1';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(width * 0.35, height - 30, 4, 0, Math.PI * 2);
  ctx.arc(width * 0.68, height - 38, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Turbidity / Sickness Overlay if water quality < 80%
  if (waterQuality < 80) {
    const distressAlpha = ((80 - waterQuality) / 80) * 0.45;
    ctx.save();
    ctx.fillStyle = `rgba(45, 55, 30, ${distressAlpha})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

/**
 * Draw individual fish creature with realistic movement and effects
 */
export function drawFish(
  ctx: CanvasRenderingContext2D,
  fish: RenderFishState,
  time: number
) {
  ctx.save();
  ctx.translate(fish.x, fish.y);

  // Flip horizontally based on horizontal velocity
  const facingRight = fish.vx >= 0;
  if (!facingRight) {
    ctx.scale(-1, 1);
  }

  // Tilt based on vertical velocity
  const tilt = Math.max(-0.4, Math.min(0.4, (fish.vy / 2)));
  ctx.rotate(tilt);

  // Overall scale
  const s = fish.scale * 24;
  ctx.scale(s / 24, s / 24);

  // Bioluminescent glow for abyssal / glowing fish
  if (fish.glow && fish.status === 'active') {
    ctx.shadowColor = fish.secondary_color || fish.primary_color;
    ctx.shadowBlur = 14 + Math.sin(time * 0.005 + fish.id) * 6;
  }

  const tailWave = Math.sin(time * 0.008 * fish.tail_speed + fish.id) * 0.3;

  // 1. Tail fin
  ctx.save();
  ctx.translate(-22, 0);
  ctx.rotate(tailWave);
  ctx.fillStyle = fish.secondary_color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-14, -10);
  ctx.bezierCurveTo(-8, 0, -8, 0, -14, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 2. Dorsal & Pectoral fins
  ctx.fillStyle = fish.secondary_color;
  ctx.beginPath();
  ctx.moveTo(-5, -10);
  ctx.quadraticCurveTo(0, -18, 8, -10);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-2, 4);
  ctx.quadraticCurveTo(4, 12, 6, 4);
  ctx.closePath();
  ctx.fill();

  // 3. Fish Body
  const bodyGrad = ctx.createLinearGradient(-20, 0, 20, 0);
  bodyGrad.addColorStop(0, fish.secondary_color);
  bodyGrad.addColorStop(1, fish.primary_color);
  ctx.fillStyle = bodyGrad;

  ctx.beginPath();
  ctx.moveTo(22, 0); // Snout
  ctx.bezierCurveTo(15, -12, -15, -12, -22, 0); // Top curve
  ctx.bezierCurveTo(-15, 12, 15, 12, 22, 0);   // Bottom curve
  ctx.closePath();
  ctx.fill();

  // 4. Eye
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(12, -3, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#050b14';
  ctx.beginPath();
  ctx.arc(13, -3, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Angler lure if species is angler
  if (fish.species_id.includes('angler')) {
    ctx.strokeStyle = fish.secondary_color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, -10);
    ctx.quadraticCurveTo(16, -26, 26, -18);
    ctx.stroke();

    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(26, -18, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Favorite badge (golden star)
  if (fish.is_favorite) {
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('★', -4, -18);
  }

  // 5. Dormant state (translucent slumber orb)
  if (fish.status === 'dormant') {
    ctx.save();
    ctx.fillStyle = 'rgba(180, 220, 255, 0.25)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sleep "Zzz"
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('z', 12, -20);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Z', 20, -28);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draw falling food pellet with trailing bubbles
 */
export function drawPellet(ctx: CanvasRenderingContext2D, pellet: FoodPellet) {
  ctx.save();
  ctx.translate(pellet.x, pellet.y);

  if (pellet.type === 'flake') {
    // Golden crunchy flake
    ctx.fillStyle = '#f6d365';
    ctx.strokeStyle = '#fda085';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 3, pellet.wobble, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Super glowing pearl pellet
    ctx.fillStyle = '#a18cd1';
    ctx.shadowColor = '#fbc2eb';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2, -2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trailing micro bubble
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(Math.sin(pellet.y * 0.1) * 3, -8, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
