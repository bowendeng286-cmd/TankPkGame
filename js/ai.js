var AI_STATE = { IDLE: 0, PURSUING: 1, AIMING: 2, SHOOTING: 3, DODGING: 4, WANDERING: 5 };

class AIController {
    constructor(difficulty) {
        this.params = AI_DIFFICULTY[difficulty] || AI_DIFFICULTY.medium;
        this.state = AI_STATE.IDLE;
        this.target = null;
        this.path = [];
        this.pathIndex = 0;
        this.reactionTimer = 0;
        this.shootCooldown = 0;
        this.wanderTarget = null;
        this.dodgeDir = 0;
        this.thinkTimer = 0;
        this._cachedRicochet = null;
        this._ricochetTimer = 0;
    }

    update(dt, tank, tanks, bullets, maze) {
        if (!tank.alive) return;
        this.reactionTimer -= dt;
        this.shootCooldown -= dt;
        this.thinkTimer -= dt;
        this._ricochetTimer -= dt;

        // 感知
        const threats = this._assessThreats(tank, bullets, maze);
        const enemies = tanks.filter(t => t.alive && t.id !== tank.id);
        const nearest = this._findNearest(tank, enemies);

        // 决策: dodge → 直射 → 反弹射击 → 追击 → 漫游
        if (threats.length > 0 && Math.random() < this.params.dodgeRate) {
            this._dodge(dt, tank, threats, maze);
        } else if (nearest && this._canShootAt(tank, nearest, maze)) {
            this._aimAndShoot(dt, tank, nearest, maze);
        } else if (nearest && this._tryRicochetShot(dt, tank, nearest, maze)) {
            // 反弹射击中，不做其他动作
        } else if (nearest) {
            this._pursue(dt, tank, nearest, maze);
        } else {
            this._wander(dt, tank, maze);
        }
    }

    _assessThreats(tank, bullets, maze) {
        const threats = [];
        const simTime = 1.5;
        const steps = 30;
        const stepDt = simTime / steps;
        for (const b of bullets) {
            if (!b.alive) continue;
            let bx = b.x, by = b.y, bvx = b.vx, bvy = b.vy;
            let bounces = b.bounces || 0;
            for (let i = 0; i < steps; i++) {
                const nx = bx + bvx * stepDt;
                const ny = by + bvy * stepDt;
                // 检测墙壁反弹
                if (bounces < BULLET_MAX_BOUNCES) {
                    for (const w of maze.walls) {
                        if (w.type === 'h') {
                            const wy = w.y1;
                            if ((by <= wy && ny >= wy) || (by >= wy && ny <= wy)) {
                                const t = (wy - by) / (bvy * stepDt);
                                const hx = bx + bvx * stepDt * t;
                                if (hx >= Math.min(w.x1, w.x2) && hx <= Math.max(w.x1, w.x2)) {
                                    bvy = -bvy;
                                    bounces++;
                                    break;
                                }
                            }
                        } else {
                            const wx = w.x1;
                            if ((bx <= wx && nx >= wx) || (bx >= wx && nx <= wx)) {
                                const t = (wx - bx) / (bvx * stepDt);
                                const hy = by + bvy * stepDt * t;
                                if (hy >= Math.min(w.y1, w.y2) && hy <= Math.max(w.y1, w.y2)) {
                                    bvx = -bvx;
                                    bounces++;
                                    break;
                                }
                            }
                        }
                    }
                }
                bx += bvx * stepDt;
                by += bvy * stepDt;
                const dist = vecDist({ x: bx, y: by }, { x: tank.x, y: tank.y });
                if (dist < 40) {
                    threats.push({ x: bx, y: by, vx: bvx, vy: bvy, time: (i + 1) * stepDt });
                    break;
                }
            }
        }
        return threats;
    }

    _findNearest(tank, enemies) {
        let best = null, bestDist = Infinity;
        for (const e of enemies) {
            const d = vecDist(tank, e);
            if (d < bestDist) { bestDist = d; best = e; }
        }
        return best;
    }

    _canShootAt(tank, target, maze) {
        // 直射检测
        const dx = target.x - tank.x, dy = target.y - tank.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const dir = { x: dx / dist, y: dy / dist };
        // 检查路径上是否有墙
        for (const w of maze.walls) {
            const t = this._rayWallHit(tank, dir, w);
            if (t > 0 && t < dist) return false;
        }
        return true;
    }

    _rayWallHit(origin, dir, wall) {
        if (wall.type === 'h') {
            if (Math.abs(dir.y) < 1e-10) return -1;
            const t = (wall.y1 - origin.y) / dir.y;
            if (t < 0) return -1;
            const hx = origin.x + dir.x * t;
            if (hx >= Math.min(wall.x1, wall.x2) && hx <= Math.max(wall.x1, wall.x2)) return t;
        } else {
            if (Math.abs(dir.x) < 1e-10) return -1;
            const t = (wall.x1 - origin.x) / dir.x;
            if (t < 0) return -1;
            const hy = origin.y + dir.y * t;
            if (hy >= Math.min(wall.y1, wall.y2) && hy <= Math.max(wall.y1, wall.y2)) return t;
        }
        return -1;
    }

    _dodge(dt, tank, threats, maze) {
        this.state = AI_STATE.DODGING;

        // 多威胁加权平均：按 1/time 加权，计算综合威胁方向
        let avgVx = 0, avgVy = 0;
        for (const t of threats) {
            const w = 1 / (t.time + 0.01);
            const vLen = Math.sqrt(t.vx * t.vx + t.vy * t.vy) || 1;
            avgVx += (t.vx / vLen) * w;
            avgVy += (t.vy / vLen) * w;
        }
        const aLen = Math.sqrt(avgVx * avgVx + avgVy * avgVy) || 1;
        avgVx /= aLen;
        avgVy /= aLen;

        // 两个垂直方向
        const perp1X = -avgVy, perp1Y = avgVx;
        const perp2X = avgVy, perp2Y = -avgVx;

        const checkDist = 30;
        const p1x = tank.x + perp1X * checkDist, p1y = tank.y + perp1Y * checkDist;
        const p2x = tank.x + perp2X * checkDist, p2y = tank.y + perp2Y * checkDist;

        const clear1 = this._isPathClear(tank, { x: p1x, y: p1y }, maze.walls, null);
        const clear2 = this._isPathClear(tank, { x: p2x, y: p2y }, maze.walls, null);

        let dodgeX, dodgeY;
        if (clear1 && clear2) {
            // 两个都通，选离最近威胁更远的方向
            const t0 = threats[0];
            const d1 = vecDist({ x: p1x, y: p1y }, { x: t0.x, y: t0.y });
            const d2 = vecDist({ x: p2x, y: p2y }, { x: t0.x, y: t0.y });
            if (d1 >= d2) { dodgeX = perp1X; dodgeY = perp1Y; }
            else { dodgeX = perp2X; dodgeY = perp2Y; }
        } else if (clear1) {
            dodgeX = perp1X; dodgeY = perp1Y;
        } else if (clear2) {
            dodgeX = perp2X; dodgeY = perp2Y;
        } else {
            // 两个都被挡，沿子弹来向后退（远离子弹）
            dodgeX = -avgVx; dodgeY = -avgVy;
        }

        const targetAngle = Math.atan2(dodgeY, dodgeX);
        this._steerToward(dt, tank, targetAngle);
        tank.input.forward = true;
        tank.input.fire = false;
    }

    _aimAndShoot(dt, tank, target, maze) {
        const dx = target.x - tank.x, dy = target.y - tank.y;
        let targetAngle = Math.atan2(dy, dx);
        // 加入瞄准抖动
        targetAngle += randFloat(-this.params.aimJitter, this.params.aimJitter);
        this._aimAtAngle(dt, tank, targetAngle);
    }

    _aimAtAngle(dt, tank, targetAngle) {
        const diff = angleDiff(tank.angle, targetAngle);
        if (Math.abs(diff) < 0.15) {
            this.state = AI_STATE.SHOOTING;
            tank.input.forward = false;
            tank.input.fire = this.shootCooldown <= 0 && this.reactionTimer <= 0;
            if (tank.input.fire) {
                this.shootCooldown = this.params.shootCooldown;
                this.reactionTimer = this.params.reactionTime;
            }
        } else {
            this.state = AI_STATE.AIMING;
            tank.input.fire = false;
        }
        this._steerToward(dt, tank, targetAngle);
    }

    _pursue(dt, tank, target, maze) {
        this.state = AI_STATE.PURSUING;
        if (this.thinkTimer <= 0) {
            this.path = this._findPath(tank, target, maze);
            this.pathIndex = 0;
            this.thinkTimer = 0.5;
        }
        if (this.path.length > 0 && this.pathIndex < this.path.length) {
            const wp = this.path[this.pathIndex];
            const dist = vecDist(tank, wp);
            if (dist < 20) {
                this.pathIndex++;
            } else {
                const angle = Math.atan2(wp.y - tank.y, wp.x - tank.x);
                this._steerToward(dt, tank, angle);
                tank.input.forward = true;
            }
        } else {
            // 直接朝目标走
            const angle = Math.atan2(target.y - tank.y, target.x - tank.x);
            this._steerToward(dt, tank, angle);
            tank.input.forward = true;
        }
        // 途中如果能射击就射击（直射或反弹）
        if (this._canShootAt(tank, target, maze) && this.shootCooldown <= 0) {
            const da = angleDiff(tank.angle, Math.atan2(target.y - tank.y, target.x - tank.x));
            if (Math.abs(da) < 0.3) {
                tank.input.fire = true;
                this.shootCooldown = this.params.shootCooldown;
            }
        } else if (this._cachedRicochet && this.shootCooldown <= 0) {
            // 行进间反弹射击：额外检查移动预测安全性
            if (this._isReturnPathSafeWhileMoving(tank, this._cachedRicochet)) {
                const da = angleDiff(tank.angle, this._cachedRicochet.angle);
                if (Math.abs(da) < 0.15) {
                    tank.input.fire = true;
                    this.shootCooldown = this.params.shootCooldown;
                }
            }
        }
    }

    _wander(dt, tank, maze) {
        this.state = AI_STATE.WANDERING;
        if (!this.wanderTarget || vecDist(tank, this.wanderTarget) < 25 || this.thinkTimer <= 0) {
            const col = Math.floor(Math.random() * COLS);
            const row = Math.floor(Math.random() * ROWS);
            this.wanderTarget = cellCenter(row, col);
            this.path = this._findPath(tank, this.wanderTarget, maze);
            this.pathIndex = 0;
            this.thinkTimer = 2;
        }
        if (this.path.length > 0 && this.pathIndex < this.path.length) {
            const wp = this.path[this.pathIndex];
            if (vecDist(tank, wp) < 20) this.pathIndex++;
            else {
                const angle = Math.atan2(wp.y - tank.y, wp.x - tank.x);
                this._steerToward(dt, tank, angle);
                tank.input.forward = true;
            }
        }
    }

    // ===== 反弹射击系统 =====

    _mirrorAcrossWall(point, wall) {
        if (wall.type === 'h') {
            return { x: point.x, y: 2 * wall.y1 - point.y };
        } else {
            return { x: 2 * wall.x1 - point.x, y: point.y };
        }
    }

    _isNearPath(point, from, to, threshold) {
        const dx = to.x - from.x, dy = to.y - from.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) return vecDist(point, from) < threshold;
        const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lenSq));
        const projX = from.x + t * dx, projY = from.y + t * dy;
        const distSq = (point.x - projX) * (point.x - projX) + (point.y - projY) * (point.y - projY);
        return distSq < threshold * threshold;
    }

    _isReturnPathSafeWhileMoving(tank, ricochet) {
        const fwd = { x: Math.cos(tank.angle), y: Math.sin(tank.angle) };
        const speed = tank.speed || 120;
        for (const leg of ricochet.returnLegs) {
            const startDist = leg.startDist || ricochet.leg1;
            const legDx = leg.to.x - leg.from.x, legDy = leg.to.y - leg.from.y;
            const legLen = Math.sqrt(legDx * legDx + legDy * legDy);
            const endDist = startDist + legLen;
            // 采样 3 个时间点：leg 开始、中间、结束
            for (const d of [startDist, (startDist + endDist) / 2, endDist]) {
                const t = d / BULLET_SPEED;
                const px = tank.x + fwd.x * speed * t;
                const py = tank.y + fwd.y * speed * t;
                if (this._isNearPath({ x: px, y: py }, leg.from, leg.to, 25)) {
                    return false;
                }
            }
        }
        return true;
    }

    _isPathClear(from, to, walls, excludeWall) {
        const dx = to.x - from.x, dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1e-6) return true;
        const dir = { x: dx / dist, y: dy / dist };
        for (const w of walls) {
            if (w === excludeWall) continue;
            const t = this._rayWallHit(from, dir, w);
            if (t > 1 && t < dist - 1) return false;
        }
        return true;
    }

    _getNearbyWalls(pos, maze, maxRange) {
        maxRange = maxRange || 400;
        const r2 = maxRange * maxRange;
        const result = [];
        for (const w of maze.walls) {
            // 墙段中点距离过滤
            const mx = (w.x1 + w.x2) / 2, my = (w.y1 + w.y2) / 2;
            const dx = mx - pos.x, dy = my - pos.y;
            if (dx * dx + dy * dy <= r2) result.push(w);
        }
        return result;
    }

    _getRayWallIntersection(origin, dir, wall) {
        // 返回交点坐标和参数 t，或 null
        if (wall.type === 'h') {
            if (Math.abs(dir.y) < 1e-10) return null;
            const t = (wall.y1 - origin.y) / dir.y;
            if (t < 1) return null;
            const hx = origin.x + dir.x * t;
            if (hx >= Math.min(wall.x1, wall.x2) - 0.5 && hx <= Math.max(wall.x1, wall.x2) + 0.5) {
                return { x: hx, y: wall.y1, t };
            }
        } else {
            if (Math.abs(dir.x) < 1e-10) return null;
            const t = (wall.x1 - origin.x) / dir.x;
            if (t < 1) return null;
            const hy = origin.y + dir.y * t;
            if (hy >= Math.min(wall.y1, wall.y2) - 0.5 && hy <= Math.max(wall.y1, wall.y2) + 0.5) {
                return { x: wall.x1, y: hy, t };
            }
        }
        return null;
    }

    _findRicochetShot(tank, target, maze) {
        const bounceDepth = this.params.bounceDepth;
        if (bounceDepth < 1) return null;

        const walls = this._getNearbyWalls(tank, maze);
        const allWalls = maze.walls;
        let best = null;
        const MAX_PATH = 600;
        const EARLY_EXIT = 300;

        // 1-bounce
        for (const w of walls) {
            const mirrored = this._mirrorAcrossWall(target, w);
            const dx = mirrored.x - tank.x, dy = mirrored.y - tank.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1e-6 || dist > MAX_PATH) continue;
            const dir = { x: dx / dist, y: dy / dist };

            // 找到射线与反弹墙的交点
            const hit = this._getRayWallIntersection(tank, dir, w);
            if (!hit) continue;

            const bouncePoint = { x: hit.x, y: hit.y };
            const leg1 = hit.t;
            const leg2dx = target.x - bouncePoint.x, leg2dy = target.y - bouncePoint.y;
            const leg2 = Math.sqrt(leg2dx * leg2dx + leg2dy * leg2dy);
            const pathLen = leg1 + leg2;

            if (pathLen > MAX_PATH) continue;
            if (best && pathLen >= best.pathLen) continue;

            // 验证两段路径无墙阻挡
            if (!this._isPathClear(tank, bouncePoint, allWalls, w)) continue;
            if (!this._isPathClear(bouncePoint, target, allWalls, w)) continue;

            // 反弹后路径是否经过自己
            if (this._isNearPath(tank, bouncePoint, target, 25)) continue;

            // 检查反弹角度不指向自身（反弹后方向应朝向目标而非回来）
            const toTarget = Math.atan2(target.y - bouncePoint.y, target.x - bouncePoint.x);
            const toTank = Math.atan2(tank.y - bouncePoint.y, tank.x - bouncePoint.x);
            if (Math.abs(angleDiff(toTarget, toTank)) < 0.2) continue;

            const angle = Math.atan2(dy, dx);
            best = { angle, pathLen, leg1, returnLegs: [{ from: bouncePoint, to: target, startDist: leg1 }] };
            if (pathLen < EARLY_EXIT) return best;
        }

        // 2-bounce（仅在 bounceDepth >= 2 且 1-bounce 无解时）
        if (bounceDepth >= 2 && !best) {
            for (let i = 0; i < walls.length; i++) {
                const w1 = walls[i];
                // M1 = 目标关于 w1 的镜像
                const m1 = this._mirrorAcrossWall(target, w1);
                for (let j = 0; j < walls.length; j++) {
                    if (i === j) continue;
                    const w2 = walls[j];
                    // 两面墙不能同类型同位置
                    if (w1.type === w2.type) {
                        if (w1.type === 'h' && w1.y1 === w2.y1) continue;
                        if (w1.type === 'v' && w1.x1 === w2.x1) continue;
                    }
                    // M2 = M1 关于 w2 的镜像
                    const m2 = this._mirrorAcrossWall(m1, w2);
                    const dx = m2.x - tank.x, dy = m2.y - tank.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 1e-6 || dist > MAX_PATH) continue;
                    const dir = { x: dx / dist, y: dy / dist };

                    // 第一次反弹：射线与 w2 的交点
                    const hit1 = this._getRayWallIntersection(tank, dir, w2);
                    if (!hit1) continue;
                    const bp1 = { x: hit1.x, y: hit1.y };

                    // 第二次反弹方向：从 bp1 到 m1（镜像目标关于 w1）
                    const d2x = m1.x - bp1.x, d2y = m1.y - bp1.y;
                    const d2len = Math.sqrt(d2x * d2x + d2y * d2y);
                    if (d2len < 1e-6) continue;
                    const dir2 = { x: d2x / d2len, y: d2y / d2len };

                    // 第二次反弹：射线与 w1 的交点
                    const hit2 = this._getRayWallIntersection(bp1, dir2, w1);
                    if (!hit2) continue;
                    const bp2 = { x: hit2.x, y: hit2.y };

                    const leg1 = hit1.t;
                    const leg2 = hit2.t;
                    const leg3dx = target.x - bp2.x, leg3dy = target.y - bp2.y;
                    const leg3 = Math.sqrt(leg3dx * leg3dx + leg3dy * leg3dy);
                    const pathLen = leg1 + leg2 + leg3;

                    if (pathLen > MAX_PATH) continue;
                    if (best && pathLen >= best.pathLen) continue;

                    // 验证三段路径
                    if (!this._isPathClear(tank, bp1, allWalls, w2)) continue;
                    if (!this._isPathClear(bp1, bp2, allWalls, w1)) continue;
                    if (!this._isPathClear(bp2, target, allWalls, w1)) continue;

                    // 反弹后路径是否经过自己
                    if (this._isNearPath(tank, bp1, bp2, 25)) continue;
                    if (this._isNearPath(tank, bp2, target, 25)) continue;

                    const angle = Math.atan2(dy, dx);
                    best = { angle, pathLen, leg1, returnLegs: [{ from: bp1, to: bp2, startDist: leg1 }, { from: bp2, to: target, startDist: leg1 + leg2 }] };
                    if (pathLen < EARLY_EXIT) return best;
                }
            }
        }

        return best;
    }

    _tryRicochetShot(dt, tank, target, maze) {
        if (this.params.bounceDepth < 1) return false;

        // 节流：每 0.3s 重新计算
        if (this._ricochetTimer <= 0) {
            this._cachedRicochet = this._findRicochetShot(tank, target, maze);
            this._ricochetTimer = 0.3;
        }

        if (!this._cachedRicochet) return false;

        // 加入瞄准抖动
        const angle = this._cachedRicochet.angle + randFloat(-this.params.aimJitter, this.params.aimJitter);
        this._aimAtAngle(dt, tank, angle);
        return true;
    }

    _steerToward(dt, tank, targetAngle) {
        const diff = angleDiff(tank.angle, targetAngle);
        tank.input.left = diff < -0.05;
        tank.input.right = diff > 0.05;
    }

    _findPath(from, to, maze) {
        const sc = this._toCell(from);
        const ec = this._toCell(to);
        if (!sc || !ec) return [];
        if (sc.r === ec.r && sc.c === ec.c) return [to];
        const keyFn = (r, c) => r * COLS + c;
        const open = [{ r: sc.r, c: sc.c, g: 0, f: 0, parent: null }];
        const closed = new Set();
        const gMap = new Map();
        gMap.set(keyFn(sc.r, sc.c), 0);
        const heuristic = (r, c) => Math.abs(r - ec.r) + Math.abs(c - ec.c);
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        while (open.length > 0) {
            open.sort((a, b) => a.f - b.f);
            const cur = open.shift();
            const ck = keyFn(cur.r, cur.c);
            if (closed.has(ck)) continue;
            closed.add(ck);
            if (cur.r === ec.r && cur.c === ec.c) {
                const path = [];
                let node = cur;
                while (node) { path.unshift(cellCenter(node.r, node.c)); node = node.parent; }
                return path;
            }
            for (const [dr, dc] of dirs) {
                const nr = cur.r + dr, nc = cur.c + dc;
                if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
                const nk = keyFn(nr, nc);
                if (closed.has(nk)) continue;
                if (hasWallBetween(maze, cur.r, cur.c, nr, nc)) continue;
                const ng = cur.g + 1;
                if (gMap.has(nk) && gMap.get(nk) <= ng) continue;
                gMap.set(nk, ng);
                open.push({ r: nr, c: nc, g: ng, f: ng + heuristic(nr, nc), parent: cur });
            }
        }
        return [];
    }

    _toCell(pos) {
        const c = Math.floor((pos.x - MAZE_OFFSET_X) / CELL_SIZE);
        const r = Math.floor((pos.y - MAZE_OFFSET_Y) / CELL_SIZE);
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
        return { r, c };
    }
}
