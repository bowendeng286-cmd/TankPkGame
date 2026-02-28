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
        if (this.screenShake > 0) {
            this.shakeX = (Math.random() - 0.5) * this.screenShake * 8;
            this.shakeY = (Math.random() - 0.5) * this.screenShake * 8;
            ctx.translate(this.shakeX, this.shakeY);
            this.screenShake *= 0.9;
            if (this.screenShake < 0.01) this.screenShake = 0;
        }
        ctx.fillStyle = Theme.colors.bg;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    endFrame() {
        this.ctx.restore();
    }

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = Theme.colors.grid;
        ctx.lineWidth = 1;
        const ox = MAZE_OFFSET_X, oy = MAZE_OFFSET_Y;
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
        for (const w of walls) {
            ctx.beginPath();
            ctx.moveTo(w.x1, w.y1);
            ctx.lineTo(w.x2, w.y2);
            ctx.stroke();
        }
    }

    drawTank(tank) {
        if (!tank.alive) return;
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(tank.x, tank.y);
        ctx.rotate(tank.angle);
        // 车体
        ctx.fillStyle = tank.color;
        ctx.strokeStyle = Theme.colors.outline;
        ctx.lineWidth = 2;
        ctx.fillRect(-TANK_W / 2, -TANK_H / 2, TANK_W, TANK_H);
        ctx.strokeRect(-TANK_W / 2, -TANK_H / 2, TANK_W, TANK_H);
        // 炮管
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
        
        const centerX = CANVAS_W / 2;
        const y = 25;
        
        // 横向排列所有玩家分数
        const totalWidth = tanks.length * 120;
        let x = centerX - totalWidth / 2 + 60;
        
        for (const tk of tanks) {
            ctx.fillStyle = tk.color;
            const label = tk.isAI ? t('ai') : `P${tk.id + 1}`;
            ctx.fillText(`${label}: ${tk.score}`, x, y);
            x += 120;
        }
    }

    drawRoundMessage(text, showHint) {
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
            ctx.fillText(t('pressEnter'), CANVAS_W / 2, CANVAS_H / 2 + 32);
        }
        ctx.restore();
    }

    shake(intensity) {
        this.screenShake = intensity || 1;
    }

    // 绘制固定摇杆（支持双玩家，动态布局）
    drawTouchJoystick(joystick, playerIndex) {
        // 如果位置未初始化，不绘制
        if (joystick.centerX === 0 && joystick.centerY === 0) return;

        const ctx = this.ctx;
        const isDark = Theme.current === 'dark';
        const cx = joystick.centerX;
        const cy = joystick.centerY;

        // 玩家对应颜色
        const playerColor = playerIndex === 0 ? '#4CAF50' : '#2196F3';
        const playerColorDark = playerIndex === 0 ? '#2E7D32' : '#1565C0';

        ctx.save();

        // 底座背景（半透明填充）
        ctx.globalAlpha = TOUCH_CONTROL_OPACITY * 0.5;
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.arc(cx, cy, TOUCH_JOYSTICK_OUTER_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // 底座边框
        ctx.globalAlpha = TOUCH_CONTROL_OPACITY;
        ctx.strokeStyle = playerColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, TOUCH_JOYSTICK_OUTER_RADIUS, 0, Math.PI * 2);
        ctx.stroke();

        if (joystick.active) {
            // 方向线
            if (joystick.distance > TOUCH_JOYSTICK_DEAD_ZONE) {
                ctx.globalAlpha = TOUCH_CONTROL_OPACITY * 0.5;
                ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(joystick.currentX, joystick.currentY);
                ctx.stroke();
            }

            // 摇杆头：径向渐变模拟立体感
            ctx.globalAlpha = TOUCH_CONTROL_OPACITY + 0.2;
            const grad = ctx.createRadialGradient(
                joystick.currentX - TOUCH_JOYSTICK_INNER_RADIUS * 0.3,
                joystick.currentY - TOUCH_JOYSTICK_INNER_RADIUS * 0.3,
                TOUCH_JOYSTICK_INNER_RADIUS * 0.1,
                joystick.currentX, joystick.currentY,
                TOUCH_JOYSTICK_INNER_RADIUS
            );
            grad.addColorStop(0, isDark ? '#FFFFFF' : playerColor);
            grad.addColorStop(1, playerColorDark);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(joystick.currentX, joystick.currentY,
                    TOUCH_JOYSTICK_INNER_RADIUS, 0, Math.PI * 2);
            ctx.fill();

            // 摇杆头细边框
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else {
            // 未激活：中心小圆点
            ctx.globalAlpha = TOUCH_CONTROL_OPACITY * 0.5;
            ctx.fillStyle = playerColor;
            ctx.beginPath();
            ctx.arc(cx, cy, TOUCH_JOYSTICK_INNER_RADIUS * 0.45, 0, Math.PI * 2);
            ctx.fill();
        }

        // 玩家标识（底部，激活时淡出）
        ctx.globalAlpha = joystick.active ? 0.15 : 0.35;
        ctx.fillStyle = isDark ? '#FFFFFF' : '#000000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${playerIndex + 1}`, cx, cy + TOUCH_JOYSTICK_OUTER_RADIUS - 13);

        ctx.restore();
    }

    // 绘制开火按钮（支持双玩家，动态布局）
    drawTouchFireButton(fireButton, tank, playerIndex) {
        // 如果位置未初始化，不绘制
        if (fireButton.centerX === 0 && fireButton.centerY === 0) return;

        const ctx = this.ctx;
        const isDark = Theme.current === 'dark';
        const x = fireButton.centerX;
        const y = fireButton.centerY;
        const r = TOUCH_FIRE_BUTTON_RADIUS;
        const isActive = fireButton.active;

        ctx.save();
        ctx.globalAlpha = TOUCH_CONTROL_OPACITY;

        // 按钮径向渐变（按压时颜色变深）
        const grad = ctx.createRadialGradient(
            x - r * 0.25, y - r * 0.25, r * 0.05,
            x, y, r
        );
        if (isActive) {
            grad.addColorStop(0, '#CC2222');
            grad.addColorStop(1, '#7A0000');
        } else {
            grad.addColorStop(0, '#FF6B6B');
            grad.addColorStop(1, '#C0392B');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, isActive ? r - 2 : r, 0, Math.PI * 2);
        ctx.fill();

        // 按钮细边框
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 冷却环形进度条（替代扇形遮罩）
        if (tank && tank.shootTimer > 0) {
            const progress = tank.shootTimer / SHOOT_COOLDOWN;
            ctx.globalAlpha = TOUCH_CONTROL_OPACITY + 0.35;
            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.85)';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(x, y, r - 5,
                    -Math.PI / 2,
                    -Math.PI / 2 + Math.PI * 2 * (1 - progress));
            ctx.stroke();
        }

        // 准星：有间隔的十字线 + 中心圆点
        ctx.globalAlpha = isActive
            ? TOUCH_CONTROL_OPACITY + 0.05
            : TOUCH_CONTROL_OPACITY + 0.3;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        const gap = 5;
        const len = 9;
        ctx.beginPath();
        ctx.moveTo(x,       y - gap);       ctx.lineTo(x,       y - gap - len);
        ctx.moveTo(x,       y + gap);       ctx.lineTo(x,       y + gap + len);
        ctx.moveTo(x - gap, y);             ctx.lineTo(x - gap - len, y);
        ctx.moveTo(x + gap, y);             ctx.lineTo(x + gap + len, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
