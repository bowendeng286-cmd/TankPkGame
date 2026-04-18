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

function getRicochetMaxDistance(maxBounces) {
    const width = COLS * CELL_SIZE;
    const height = ROWS * CELL_SIZE;
    const arenaDiagonal = Math.sqrt(width * width + height * height);
    return arenaDiagonal * Math.max(1, (maxBounces || 0) + 1);
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
                    d0: elapsed * Math.sqrt(vx * vx + vy * vy),
                    d1: (elapsed + legDt) * Math.sqrt(vx * vx + vy * vy),
                    length: legDt * Math.sqrt(vx * vx + vy * vy),
                    vx,
                    vy,
                    bounces,
                    radius
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
                    d0: elapsed * Math.sqrt(vx * vx + vy * vy),
                    d1: (elapsed + remaining) * Math.sqrt(vx * vx + vy * vy),
                    length: remaining * Math.sqrt(vx * vx + vy * vy),
                    vx,
                    vy,
                    bounces,
                    radius
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

function traceRicochetPath(projectileLike, walls, maxBounces, maxDistance) {
    if (!projectileLike) {
        return { segments: [], bouncePoints: [], totalLength: 0, finalState: null };
    }

    const radius = projectileLike.radius != null ? projectileLike.radius : BULLET_RADIUS;
    let x = projectileLike.x;
    let y = projectileLike.y;
    let vx = projectileLike.vx;
    let vy = projectileLike.vy;
    let bounces = projectileLike.bounces || 0;
    const limitBounces = Math.max(0, maxBounces != null ? maxBounces : BULLET_MAX_BOUNCES);
    let remainingDistance = Math.max(0, maxDistance != null ? maxDistance : getRicochetMaxDistance(limitBounces));
    const segments = [];
    const bouncePoints = [];
    let travelled = 0;
    let iterations = 0;
    const maxIterations = Math.max(12, limitBounces + 6);

    while (remainingDistance > 1e-6 && iterations < maxIterations) {
        iterations++;

        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed < 1e-6) break;

        const dx = vx / speed * remainingDistance;
        const dy = vy / speed * remainingDistance;
        let minT = 1;
        let hitWall = null;

        for (const wall of walls) {
            const t = _bulletWallIntersectAt(x, y, radius, wall, dx, dy);
            if (t >= 0 && t < minT) {
                minT = t;
                hitWall = wall;
            }
        }

        if (hitWall && minT < 1) {
            const nextX = x + dx * minT;
            const nextY = y + dy * minT;
            const legLength = remainingDistance * minT;
            if (legLength > 1e-6) {
                segments.push({
                    x1: x,
                    y1: y,
                    x2: nextX,
                    y2: nextY,
                    d0: travelled,
                    d1: travelled + legLength,
                    length: legLength,
                    vx,
                    vy,
                    bounces,
                    radius
                });
            }

            travelled += legLength;
            remainingDistance = Math.max(0, remainingDistance - legLength);
            x = nextX;
            y = nextY;

            bouncePoints.push({
                x: nextX,
                y: nextY,
                distance: travelled,
                wall: hitWall,
                bounceIndex: bounces + 1
            });

            if (bounces + 1 >= limitBounces || remainingDistance <= 1e-6) {
                remainingDistance = 0;
                break;
            }

            if (hitWall.type === 'h') {
                vy = -vy;
            } else {
                vx = -vx;
            }
            bounces++;
        } else {
            const nextX = x + dx;
            const nextY = y + dy;
            if (remainingDistance > 1e-6) {
                segments.push({
                    x1: x,
                    y1: y,
                    x2: nextX,
                    y2: nextY,
                    d0: travelled,
                    d1: travelled + remainingDistance,
                    length: remainingDistance,
                    vx,
                    vy,
                    bounces,
                    radius
                });
                travelled += remainingDistance;
            }
            x = nextX;
            y = nextY;
            remainingDistance = 0;
        }
    }

    return {
        segments,
        bouncePoints,
        totalLength: travelled,
        finalState: {
            x,
            y,
            vx,
            vy,
            radius,
            ownerId: projectileLike.ownerId,
            bounces,
            maxBounces: limitBounces
        }
    };
}

function sliceRicochetSegments(segments, startDistance, endDistance) {
    const from = Math.max(0, Math.min(startDistance, endDistance));
    const to = Math.max(0, Math.max(startDistance, endDistance));
    if (to - from <= 1e-6) return [];

    const sliced = [];
    for (const segment of segments) {
        if (segment.d1 <= from + 1e-6) continue;
        if (segment.d0 >= to - 1e-6) break;

        const localFrom = Math.max(from, segment.d0);
        const localTo = Math.min(to, segment.d1);
        const localLength = localTo - localFrom;
        if (localLength <= 1e-6) continue;

        const t0 = segment.length > 1e-6 ? (localFrom - segment.d0) / segment.length : 0;
        const t1 = segment.length > 1e-6 ? (localTo - segment.d0) / segment.length : 1;
        sliced.push({
            x1: lerp(segment.x1, segment.x2, t0),
            y1: lerp(segment.y1, segment.y2, t0),
            x2: lerp(segment.x1, segment.x2, t1),
            y2: lerp(segment.y1, segment.y2, t1),
            d0: localFrom,
            d1: localTo,
            length: localLength,
            vx: segment.vx,
            vy: segment.vy,
            bounces: segment.bounces,
            radius: segment.radius
        });
    }

    return sliced;
}

function getRicochetPointAtDistance(segments, distance) {
    const target = Math.max(0, distance);
    if (segments.length === 0) return null;

    for (const segment of segments) {
        if (target > segment.d1 + 1e-6) continue;
        const t = segment.length > 1e-6 ? clamp((target - segment.d0) / segment.length, 0, 1) : 1;
        return {
            x: lerp(segment.x1, segment.x2, t),
            y: lerp(segment.y1, segment.y2, t)
        };
    }

    const last = segments[segments.length - 1];
    return { x: last.x2, y: last.y2 };
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

class LaserShot {
    constructor(x, y, angle, ownerId, walls) {
        this.ownerId = ownerId;
        this.speed = LASER_SPEED;
        this.tailLength = LASER_TAIL_LENGTH;
        this.beamWidth = LASER_BEAM_WIDTH;
        this.radius = LASER_RADIUS;
        this.distance = 0;
        this.prevDistance = 0;
        this.alive = true;

        const path = traceRicochetPath({
            x,
            y,
            vx: Math.cos(angle) * this.speed,
            vy: Math.sin(angle) * this.speed,
            radius: this.radius,
            ownerId
        }, walls, LASER_MAX_BOUNCES, getRicochetMaxDistance(LASER_MAX_BOUNCES));

        this.segments = path.segments;
        this.bouncePoints = path.bouncePoints;
        this.totalLength = path.totalLength;
        this.bounceCount = 0;
    }

    update(dt) {
        if (!this.alive) return;
        this.prevDistance = this.distance;
        this.distance = Math.min(this.totalLength, this.distance + this.speed * dt);
        this.bounceCount = this._countBouncesAt(this.distance);
    }

    finishFrame() {
        if (this.distance >= this.totalLength - 1e-6) {
            this.alive = false;
        }
    }

    _countBouncesAt(distance) {
        let count = 0;
        for (const point of this.bouncePoints) {
            if (point.distance <= distance + 1e-6) count++;
            else break;
        }
        return count;
    }

    getVisibleSegments() {
        return sliceRicochetSegments(this.segments, Math.max(0, this.distance - this.tailLength), this.distance);
    }

    getSweepSegments() {
        return sliceRicochetSegments(this.segments, Math.max(0, this.prevDistance - this.tailLength), this.distance);
    }

    getHeadPoint() {
        return getRicochetPointAtDistance(this.segments, this.distance);
    }
}
