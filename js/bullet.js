class Bullet {
    constructor(x, y, angle, ownerId) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * BULLET_SPEED;
        this.vy = Math.sin(angle) * BULLET_SPEED;
        this.radius = BULLET_RADIUS;
        this.ownerId = ownerId;
        this.bounces = 0;
        this.maxBounces = BULLET_MAX_BOUNCES;
        this.alive = true;
        this.lifetime = 0;
    }

    update(dt, walls) {
        if (!this.alive) return;
        this.lifetime += dt;
        if (this.lifetime > BULLET_MAX_LIFETIME) { this.alive = false; return; }

        let remaining = dt;
        let iterations = 0;
        while (remaining > 1e-6 && iterations < 10) {
            iterations++;
            const dx = this.vx * remaining;
            const dy = this.vy * remaining;
            // 找最近墙壁碰撞
            let minT = 1;
            let hitWall = null;
            for (const w of walls) {
                const t = this._wallIntersect(w, dx, dy);
                if (t >= 0 && t < minT) {
                    minT = t;
                    hitWall = w;
                }
            }
            if (hitWall && minT < 1) {
                // 移动到碰撞点（留一点间隙）
                this.x += dx * minT;
                this.y += dy * minT;
                remaining *= (1 - minT);
                // 反射
                if (hitWall.type === 'h') {
                    this.vy = -this.vy;
                } else {
                    this.vx = -this.vx;
                }
                this.bounces++;
                if (this.bounces > this.maxBounces) {
                    this.alive = false;
                    return;
                }
            } else {
                this.x += dx;
                this.y += dy;
                remaining = 0;
            }
        }
    }

    // 子弹圆心 vs 轴对齐墙段碰撞检测
    _wallIntersect(wall, dx, dy) {
        const r = this.radius;
        if (wall.type === 'h') {
            // 水平墙: y 固定
            const wy = wall.y1;
            if (Math.abs(dy) < 1e-10) return -1;
            // 计算到达墙面的 t
            const targetY = dy > 0 ? wy - r : wy + r;
            const t = (targetY - this.y) / dy;
            if (t < 0 || t > 1) return -1;
            const hitX = this.x + dx * t;
            if (hitX >= Math.min(wall.x1, wall.x2) - r && hitX <= Math.max(wall.x1, wall.x2) + r) {
                return t;
            }
        } else {
            // 垂直墙: x 固定
            const wx = wall.x1;
            if (Math.abs(dx) < 1e-10) return -1;
            const targetX = dx > 0 ? wx - r : wx + r;
            const t = (targetX - this.x) / dx;
            if (t < 0 || t > 1) return -1;
            const hitY = this.y + dy * t;
            if (hitY >= Math.min(wall.y1, wall.y2) - r && hitY <= Math.max(wall.y1, wall.y2) + r) {
                return t;
            }
        }
        return -1;
    }
}
