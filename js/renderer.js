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
        ctx.save();
        ctx.globalAlpha = TOUCH_CONTROL_OPACITY;

        // 绘制外圈（底座） - 始终显示
        ctx.strokeStyle = playerIndex === 0 ? '#4CAF50' : '#2196F3';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(joystick.centerX, joystick.centerY,
                TOUCH_JOYSTICK_OUTER_RADIUS, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制旋转区标识圈
        ctx.strokeStyle = 'rgba(255, 193, 7, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(joystick.centerX, joystick.centerY,
                TOUCH_ROTATION_THRESHOLD, 0, Math.PI * 2);
        ctx.stroke();

        // 如果摇杆激活，绘制摇杆头和方向线
        if (joystick.active) {
            // 根据距离选择颜色：旋转区=黄色，移动区=绿色
            const joystickColor = joystick.distance < TOUCH_ROTATION_THRESHOLD ?
                '#FFC107' : '#4CAF50';

            // 绘制方向线
            if (joystick.distance > TOUCH_JOYSTICK_DEAD_ZONE) {
                ctx.strokeStyle = joystickColor;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(joystick.centerX, joystick.centerY);
                ctx.lineTo(joystick.currentX, joystick.currentY);
                ctx.stroke();
            }

            // 绘制摇杆头
            ctx.fillStyle = joystickColor;
            ctx.beginPath();
            ctx.arc(joystick.currentX, joystick.currentY,
                    TOUCH_JOYSTICK_INNER_RADIUS, 0, Math.PI * 2);
            ctx.fill();

            // 摇杆头边框
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // 玩家标识
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${playerIndex + 1}`, joystick.centerX, joystick.centerY);

        ctx.restore();
    }

    // 绘制开火按钮（支持双玩家，动态布局）
    drawTouchFireButton(fireButton, tank, playerIndex) {
        // 如果位置未初始化，不绘制
        if (fireButton.centerX === 0 && fireButton.centerY === 0) return;
        
        const ctx = this.ctx;
        const x = fireButton.centerX;
        const y = fireButton.centerY;

        ctx.save();
        ctx.globalAlpha = TOUCH_CONTROL_OPACITY;

        // 按钮背景
        ctx.fillStyle = fireButton.active ? '#FF4444' : '#FF6666';
        ctx.beginPath();
        ctx.arc(x, y, TOUCH_FIRE_BUTTON_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        // 按钮边框
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 冷却进度
        if (tank && tank.shootTimer > 0) {
            const progress = tank.shootTimer / SHOOT_COOLDOWN;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x, y, TOUCH_FIRE_BUTTON_RADIUS,
                    -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
            ctx.closePath();
            ctx.fill();
        }

        // 开火图标（十字准星）
        ctx.globalAlpha = TOUCH_CONTROL_OPACITY + 0.2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 15, y);
        ctx.lineTo(x + 15, y);
        ctx.moveTo(x, y - 15);
        ctx.lineTo(x, y + 15);
        ctx.stroke();

        ctx.restore();
    }
}
