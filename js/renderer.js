class Renderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.screenShake = 0;
        this.shakeX = 0;
        this.shakeY = 0;
    }

    clear() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = Theme.colors.bg;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.translate(VIEWPORT_OFFSET_X, VIEWPORT_OFFSET_Y);
        ctx.scale(VIEWPORT_SCALE, VIEWPORT_SCALE);

        if (this.screenShake > 0) {
            this.shakeX = (Math.random() - 0.5) * this.screenShake * 8;
            this.shakeY = (Math.random() - 0.5) * this.screenShake * 8;
            ctx.translate(this.shakeX, this.shakeY);
            this.screenShake *= 0.9;
            if (this.screenShake < 0.01) this.screenShake = 0;
        }
    }

    endFrame() {
        this.ctx.restore();
    }

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = Theme.colors.grid;
        ctx.lineWidth = 1;
        const ox = MAZE_OFFSET_X;
        const oy = MAZE_OFFSET_Y;
        for (let c = 0; c <= COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(ox + c * CELL_SIZE, oy);
            ctx.lineTo(ox + c * CELL_SIZE, oy + ROWS * CELL_SIZE);
            ctx.stroke();
        }
        for (let r = 0; r <= ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(ox, oy + r * CELL_SIZE);
            ctx.lineTo(ox + COLS * CELL_SIZE, oy + r * CELL_SIZE);
            ctx.stroke();
        }
    }

    drawWalls(walls) {
        const ctx = this.ctx;
        ctx.strokeStyle = Theme.colors.wall;
        ctx.lineWidth = WALL_THICKNESS;
        ctx.lineCap = 'round';
        for (const wall of walls) {
            ctx.beginPath();
            ctx.moveTo(wall.x1, wall.y1);
            ctx.lineTo(wall.x2, wall.y2);
            ctx.stroke();
        }
    }

    drawTank(tank) {
        if (!tank.alive) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(tank.x, tank.y);
        ctx.rotate(tank.angle);
        ctx.fillStyle = tank.color;
        ctx.strokeStyle = Theme.colors.outline;
        ctx.lineWidth = 2;
        ctx.fillRect(-TANK_W / 2, -TANK_H / 2, TANK_W, TANK_H);
        ctx.strokeRect(-TANK_W / 2, -TANK_H / 2, TANK_W, TANK_H);
        ctx.fillStyle = Theme.colors.outline;
        ctx.fillRect(TANK_W / 2 - 2, -BARREL_WIDTH / 2, BARREL_LENGTH, BARREL_WIDTH);
        ctx.restore();
    }

    drawBullet(bullet) {
        if (!bullet.alive) return;
        const ctx = this.ctx;
        ctx.fillStyle = Theme.colors.bullet;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    drawPickups(pickups) {
        if (!pickups || pickups.length === 0) return;
        for (const pickup of pickups) {
            if (!pickup.alive) continue;
            this._drawPickup(pickup);
        }
    }

    _drawPickup(pickup) {
        const ctx = this.ctx;
        const fallProgress = clamp(pickup.spawnTime / PICKUP_LAND_DURATION, 0, 1);
        const hoverOffset = pickup.landed ? 0 : (1 - fallProgress) * PICKUP_DROP_HEIGHT;
        const drawX = pickup.x;
        const drawY = pickup.y - hoverOffset;
        const scale = pickup.landed ? 1 : lerp(0.82, 1, fallProgress);

        ctx.save();
        ctx.fillStyle = colorWithAlpha('#000000', Theme.current === 'dark' ? 0.18 : 0.1);
        ctx.beginPath();
        ctx.ellipse(pickup.x, pickup.y + pickup.radius * 0.85, pickup.radius * 0.88, pickup.radius * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.scale(scale, scale);
        ctx.shadowColor = colorWithAlpha('#E1C45A', 0.35);
        ctx.shadowBlur = 6;

        ctx.fillStyle = colorWithAlpha('#E5D28A', Theme.current === 'dark' ? 0.92 : 0.98);
        ctx.beginPath();
        ctx.arc(0, 0, pickup.radius * 0.58, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = colorWithAlpha('#333333', Theme.current === 'dark' ? 0.85 : 0.9);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = -Math.PI / 2 + i * Math.PI / 3;
            const px = Math.cos(angle) * pickup.radius * 0.88;
            const py = Math.sin(angle) * pickup.radius * 0.88;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.strokeStyle = colorWithAlpha('#333333', Theme.current === 'dark' ? 0.95 : 0.98);
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(-2, -pickup.radius * 0.38);
        ctx.lineTo(2, -pickup.radius * 0.08);
        ctx.lineTo(-1, -pickup.radius * 0.08);
        ctx.lineTo(3, pickup.radius * 0.42);
        ctx.lineTo(-3, pickup.radius * 0.08);
        ctx.lineTo(0, pickup.radius * 0.08);
        ctx.stroke();
        ctx.restore();
    }

    _drawLaserPath(path, color, includeBouncePoints) {
        if (!path || !path.segments || path.segments.length === 0) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = colorWithAlpha(color, 0.3);
        ctx.shadowBlur = 4;
        ctx.strokeStyle = colorWithAlpha(color, 0.82);
        ctx.lineWidth = LASER_PREVIEW_LINE_WIDTH;
        for (const segment of path.segments) {
            ctx.beginPath();
            ctx.moveTo(segment.x1, segment.y1);
            ctx.lineTo(segment.x2, segment.y2);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.strokeStyle = colorWithAlpha('#FFFFFF', 0.7);
        ctx.lineWidth = 1;
        for (const segment of path.segments) {
            ctx.beginPath();
            ctx.moveTo(segment.x1, segment.y1);
            ctx.lineTo(segment.x2, segment.y2);
            ctx.stroke();
        }

        if (includeBouncePoints) {
            ctx.fillStyle = colorWithAlpha('#FFF8C7', 0.72);
            for (const bounce of path.bouncePoints || []) {
                ctx.beginPath();
                ctx.arc(bounce.x, bounce.y, 2.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    drawLaserPreview(path, color) {
        this._drawLaserPath(path, color, true);
    }

    _getTankColorById(ownerId) {
        if (typeof tanks !== 'undefined' && tanks && ownerId != null) {
            const owner = tanks.find(tank => tank && tank.id === ownerId);
            if (owner) return owner.color;
        }
        return Theme.colors.bullet;
    }

    drawLaserShot(shot) {
        if (!shot.alive) return;
        const segments = shot.getVisibleSegments();
        if (segments.length === 0) return;
        const color = this._getTankColorById(shot.ownerId);
        this._drawLaserPath({ segments }, color, false);
    }

    drawTankWeaponBadge(tank) {
        if (!tank || !tank.alive || !tank.hasLaserWeapon()) return;
        TouchUI.drawPill(this.ctx, tank.x - 28, tank.y - TANK_H / 2 - 20, 56, 16, t('laserReady'), {
            accentColor: '#FFD84A',
            textColor: Theme.colors.text.primary,
            font: 'bold 9px monospace',
            fillOpacity: 0.2,
            borderOpacity: 0.55
        });
    }

    drawMuzzleFlash(x, y) {
        const ctx = this.ctx;
        ctx.fillStyle = '#FFD700';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    drawScoreboardTop(tanks) {
        const ctx = this.ctx;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';

        const totalWidth = tanks.length * 120;
        let x = CANVAS_W / 2 - totalWidth / 2 + 60;

        for (const tank of tanks) {
            ctx.fillStyle = tank.color;
            const label = tank.isAI ? t('ai') : `P${tank.id + 1}`;
            ctx.fillText(`${label}: ${tank.score}`, x, 25);
            if (tank.hasLaserWeapon()) {
                TouchUI.drawPill(ctx, x + 24, 10, 34, 18, t('laser'), {
                    accentColor: '#FFD84A',
                    textColor: Theme.colors.text.primary,
                    font: 'bold 10px monospace',
                    fillOpacity: 0.18,
                    borderOpacity: 0.45
                });
            }
            x += 120;
        }
    }

    drawRoundMessage(text, showHint, isTouchDevice) {
        const ctx = this.ctx;
        ctx.save();
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, CANVAS_H / 2 - 40, CANVAS_W, 80);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2 + 8);
        if (showHint) {
            ctx.font = '16px monospace';
            ctx.fillStyle = '#CCC';
            ctx.fillText(isTouchDevice ? t('tapToContinue') : t('pressEnter'), CANVAS_W / 2, CANVAS_H / 2 + 32);
        }
        ctx.restore();
    }

    shake(intensity) {
        this.screenShake = intensity || 1;
    }

    _drawTouchHudTag(x, y, text, accent) {
        TouchUI.drawPill(this.ctx, x, y, 44, 20, text, {
            accentColor: accent,
            textColor: Theme.colors.text.primary,
            font: 'bold 10px monospace',
            fillOpacity: 0.12,
            borderOpacity: 0.28
        });
    }

    drawTouchJoystick(joystick, playerIndex) {
        if (joystick.centerX === 0 && joystick.centerY === 0) return;

        const ctx = this.ctx;
        const accent = TouchUI.playerColor(playerIndex);
        const deepAccent = TouchUI.playerDeepColor(playerIndex);
        const cx = joystick.centerX;
        const cy = joystick.centerY;
        const outerRadius = joystick.outerRadius || TOUCH_JOYSTICK_OUTER_RADIUS;
        const innerRadius = joystick.innerRadius || TOUCH_JOYSTICK_INNER_RADIUS;
        const deadZone = joystick.deadZone || TOUCH_JOYSTICK_DEAD_ZONE;
        const knobX = joystick.active ? joystick.currentX : cx;
        const knobY = joystick.active ? joystick.currentY : cy;
        const strength = clamp(joystick.strength || 0, 0, 1);

        ctx.save();
        ctx.globalAlpha = joystick.active ? 0.72 : 0.48;

        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius + 7, 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha(accent, joystick.active ? 0.12 : 0.06);
        ctx.fill();

        const base = ctx.createRadialGradient(
            cx - outerRadius * 0.2,
            cy - outerRadius * 0.25,
            outerRadius * 0.12,
            cx,
            cy,
            outerRadius
        );
        base.addColorStop(0, Theme.current === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.88)');
        base.addColorStop(1, Theme.current === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)');
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = colorWithAlpha(accent, joystick.active ? 0.82 : 0.52);
        ctx.lineWidth = joystick.active ? 2.5 : 2;
        ctx.stroke();

        if (deadZone > 0) {
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = Theme.current === 'dark' ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.16)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, deadZone, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        if (joystick.active && joystick.distance > deadZone) {
            ctx.strokeStyle = colorWithAlpha(accent, 0.34);
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(knobX, knobY);
            ctx.stroke();

            ctx.strokeStyle = colorWithAlpha('#FFFFFF', 0.28);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, outerRadius - 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * strength);
            ctx.stroke();
        }

        const knob = ctx.createRadialGradient(
            knobX - innerRadius * 0.35,
            knobY - innerRadius * 0.35,
            innerRadius * 0.1,
            knobX,
            knobY,
            innerRadius
        );
        knob.addColorStop(0, lightenColor(accent, 0.24));
        knob.addColorStop(1, deepAccent);
        ctx.fillStyle = knob;
        ctx.beginPath();
        ctx.arc(knobX, knobY, innerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(knobX - innerRadius * 0.24, knobY - innerRadius * 0.24, innerRadius * 0.26, 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha('#FFFFFF', 0.24);
        ctx.fill();
        ctx.restore();

        this._drawTouchHudTag(cx - 22, cy + outerRadius + 12, `P${playerIndex + 1}`, accent);
    }

    drawTouchFireButton(fireButton, tank, playerIndex) {
        if (fireButton.centerX === 0 && fireButton.centerY === 0) return;

        const ctx = this.ctx;
        const accent = TouchUI.playerColor(playerIndex);
        const x = fireButton.centerX;
        const y = fireButton.centerY;
        const r = fireButton.radius || TOUCH_FIRE_BUTTON_RADIUS;
        const isActive = fireButton.active;
        const displayRadius = isActive ? r - 2 : r;

        ctx.save();
        ctx.globalAlpha = isActive ? 0.78 : 0.54;

        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha(accent, isActive ? 0.12 : 0.05);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, r + 2, 0, Math.PI * 2);
        ctx.fillStyle = Theme.current === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.74)';
        ctx.fill();

        const core = ctx.createRadialGradient(
            x - displayRadius * 0.28,
            y - displayRadius * 0.34,
            displayRadius * 0.08,
            x,
            y,
            displayRadius
        );
        core.addColorStop(0, isActive ? '#FF6C57' : '#FF8A73');
        core.addColorStop(0.6, isActive ? '#D84730' : '#E95B42');
        core.addColorStop(1, isActive ? '#7C160C' : '#922012');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(x, y, displayRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x - displayRadius * 0.24, y - displayRadius * 0.28, displayRadius * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha('#FFFFFF', 0.24);
        ctx.fill();

        ctx.strokeStyle = colorWithAlpha(accent, isActive ? 0.74 : 0.36);
        ctx.lineWidth = isActive ? 2.5 : 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 2, 0, Math.PI * 2);
        ctx.stroke();

        if (tank && tank.shootTimer > 0) {
            const progress = tank.shootTimer / SHOOT_COOLDOWN;
            ctx.strokeStyle = colorWithAlpha('#FFFFFF', 0.72);
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(x, y, r - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - progress));
            ctx.stroke();
        }

        TouchUI.drawCrosshair(ctx, x, y, Math.max(16, r * 0.38), colorWithAlpha('#FFFFFF', isActive ? 0.86 : 0.78), 2.5);
        ctx.restore();

        this._drawTouchHudTag(x - 22, y + r + 12, `P${playerIndex + 1}`, accent);
    }
}
