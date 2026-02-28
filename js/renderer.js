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

    drawScoreboard(tanks) {
        const ctx = this.ctx;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left';
        const y = 18;
        let x = MAZE_OFFSET_X;
        for (const tk of tanks) {
            ctx.fillStyle = tk.color;
            const label = tk.isAI ? t('ai') : `P${tk.id + 1}`;
            ctx.fillText(`${label}: ${tk.score}`, x, y);
            x += 100;
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
}
