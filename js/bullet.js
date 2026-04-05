function _bulletWallIntersectAt(x, y, radius, wall, dx, dy) {
    if (wall.type === 'h') {
        const wy = wall.y1;
        if (Math.abs(dy) < 1e-10) return -1;
        const targetY = dy > 0 ? wy - radius : wy + radius;
        const t = (targetY - y) / dy;
        if (t < 0 || t > 1) return -1;
        const hitX = x + dx * t;
        if (hitX >= Math.min(wall.x1, wall.x2) - radius && hitX <= Math.max(wall.x1, wall.x2) + radius) {
            return t;
        }
    } else {
        const wx = wall.x1;
        if (Math.abs(dx) < 1e-10) return -1;
        const targetX = dx > 0 ? wx - radius : wx + radius;
        const t = (targetX - x) / dx;
        if (t < 0 || t > 1) return -1;
        const hitY = y + dy * t;
        if (hitY >= Math.min(wall.y1, wall.y2) - radius && hitY <= Math.max(wall.y1, wall.y2) + radius) {
            return t;
        }
    }
    return -1;
}

function _traceBulletMotion(bulletLike, walls, maxTime, collectSegments) {
    const segments = [];
    const duration = Math.max(0, maxTime || 0);
    const radius = bulletLike.radius || BULLET_RADIUS;
    let x = bulletLike.x;
    let y = bulletLike.y;
    let vx = bulletLike.vx;
    let vy = bulletLike.vy;
    let bounces = bulletLike.bounces || 0;
    const maxBounces = bulletLike.maxBounces != null ? bulletLike.maxBounces : BULLET_MAX_BOUNCES;
    let alive = bulletLike.alive !== false;
    let remaining = duration;
    let elapsed = 0;
    let iterations = 0;
    const maxIterations = Math.max(10, maxBounces + 5);

    while (alive && remaining > 1e-6 && iterations < maxIterations) {
        iterations++;
        const dx = vx * remaining;
        const dy = vy * remaining;
        let minT = 1;
        let hitWall = null;

        for (const w of walls) {
            const t = _bulletWallIntersectAt(x, y, radius, w, dx, dy);
            if (t >= 0 && t < minT) {
                minT = t;
                hitWall = w;
            }
        }

        if (hitWall && minT < 1) {
            const nextX = x + dx * minT;
            const nextY = y + dy * minT;
            const legDt = remaining * minT;
            if (collectSegments && legDt > 1e-6) {
                segments.push({
                    x1: x,
                    y1: y,
                    x2: nextX,
                    y2: nextY,
                    t0: elapsed,
                    t1: elapsed + legDt,
                    vx,
                    vy,
                    bounces
                });
            }
            x = nextX;
            y = nextY;
            elapsed += legDt;
            remaining *= (1 - minT);

            if (hitWall.type === 'h') {
                vy = -vy;
            } else {
                vx = -vx;
            }

            bounces++;
            if (bounces > maxBounces) {
                alive = false;
            }
        } else {
            const nextX = x + dx;
            const nextY = y + dy;
            if (collectSegments && remaining > 1e-6) {
                segments.push({
                    x1: x,
                    y1: y,
                    x2: nextX,
                    y2: nextY,
                    t0: elapsed,
                    t1: elapsed + remaining,
                    vx,
                    vy,
                    bounces
                });
            }
            x = nextX;
            y = nextY;
            elapsed += remaining;
            remaining = 0;
        }
    }

    return {
        segments,
        finalState: {
            x,
            y,
            vx,
            vy,
            radius,
            ownerId: bulletLike.ownerId,
            bounces,
            maxBounces,
            alive,
            lifetime: (bulletLike.lifetime || 0) + elapsed
        }
    };
}

function traceBulletSegments(bulletLike, walls, maxTime) {
    if (!bulletLike || bulletLike.alive === false) {
        return { segments: [], finalState: bulletLike };
    }

    const remainingLifetime = Math.max(0, BULLET_MAX_LIFETIME - (bulletLike.lifetime || 0));
    const duration = Math.min(Math.max(0, maxTime || 0), remainingLifetime);
    if (duration <= 0) {
        return {
            segments: [],
            finalState: {
                x: bulletLike.x,
                y: bulletLike.y,
                vx: bulletLike.vx,
                vy: bulletLike.vy,
                radius: bulletLike.radius || BULLET_RADIUS,
                ownerId: bulletLike.ownerId,
                bounces: bulletLike.bounces || 0,
                maxBounces: bulletLike.maxBounces != null ? bulletLike.maxBounces : BULLET_MAX_BOUNCES,
                alive: bulletLike.alive !== false,
                lifetime: bulletLike.lifetime || 0
            }
        };
    }

    return _traceBulletMotion(bulletLike, walls, duration, true);
}

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

        const trace = _traceBulletMotion(this, walls, dt, false);
        const next = trace.finalState;
        this.x = next.x;
        this.y = next.y;
        this.vx = next.vx;
        this.vy = next.vy;
        this.bounces = next.bounces;
        this.alive = next.alive;
    }

    _wallIntersect(wall, dx, dy) {
        return _bulletWallIntersectAt(this.x, this.y, this.radius, wall, dx, dy);
    }
}
