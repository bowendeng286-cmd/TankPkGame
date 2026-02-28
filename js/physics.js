// ===== 2D 刚体物理引擎 =====

// 检测点是否在扩展 OBB 内部，返回 { depth, normal } 或 null
function _pointVsExpandedOBB(px, py, cx, cy, angle, hw, hh, expand) {
    const cosA = Math.cos(-angle), sinA = Math.sin(-angle);
    const dx = px - cx, dy = py - cy;
    const lx = dx * cosA - dy * sinA;
    const ly = dx * sinA + dy * cosA;
    const ehw = hw + expand, ehh = hh + expand;

    // 点不在扩展矩形内
    if (lx < -ehw || lx > ehw || ly < -ehh || ly > ehh) return null;

    // 计算四个面的穿透深度，取最小的
    const depths = [
        { d: ehw - lx, nx: 1, ny: 0 },   // 右面
        { d: lx + ehw, nx: -1, ny: 0 },   // 左面
        { d: ehh - ly, nx: 0, ny: 1 },    // 下面
        { d: ly + ehh, nx: 0, ny: -1 },   // 上面
    ];
    let best = null;
    for (const f of depths) {
        if (f.d < 0) return null;
        if (!best || f.d < best.d) best = f;
    }
    if (!best || best.d < 0.01) return null;

    // 将法线从局部坐标转回世界坐标
    const cosR = Math.cos(angle), sinR = Math.sin(angle);
    const wnx = best.nx * cosR - best.ny * sinR;
    const wny = best.nx * sinR + best.ny * cosR;
    return { depth: best.d, normal: { x: -wnx, y: -wny } };
}

// ===== 坦克-墙体碰撞（刚体物理） =====
function resolveTankWallPhysics(tank, walls) {
    const mazeLeft = MAZE_OFFSET_X;
    const mazeTop = MAZE_OFFSET_Y;
    const mazeRight = MAZE_OFFSET_X + COLS * CELL_SIZE;
    const mazeBottom = MAZE_OFFSET_Y + ROWS * CELL_SIZE;
    const halfThick = WALL_THICKNESS / 2 + 1.5;

    // --- 边界碰撞（每次重新获取碰撞点） ---
    {
        const allCorners = tank.getAllCollisionCorners();
        for (const corner of allCorners) {
            const rx = corner.x - tank.x;
            const ry = corner.y - tank.y;

            if (corner.x < mazeLeft) {
                const depth = mazeLeft - corner.x;
                _applyWallImpulse(tank, { x: 1, y: 0 }, depth, rx, ry);
            }
            if (corner.x > mazeRight) {
                const depth = corner.x - mazeRight;
                _applyWallImpulse(tank, { x: -1, y: 0 }, depth, rx, ry);
            }
            if (corner.y < mazeTop) {
                const depth = mazeTop - corner.y;
                _applyWallImpulse(tank, { x: 0, y: 1 }, depth, rx, ry);
            }
            if (corner.y > mazeBottom) {
                const depth = corner.y - mazeBottom;
                _applyWallImpulse(tank, { x: 0, y: -1 }, depth, rx, ry);
            }
        }
    }

    // --- 内墙碰撞 ---
    const hw = TANK_W / 2, hh = TANK_H / 2;
    const bx0 = hw - 2, bhh = BARREL_WIDTH / 2;
    // 炮管 OBB 中心偏移（局部坐标）
    const barrelCenterLocalX = bx0 + BARREL_LENGTH / 2;
    const barrelHW = BARREL_LENGTH / 2;

    for (const wall of walls) {
        const wa = { x: wall.x1, y: wall.y1 };
        const wb = { x: wall.x2, y: wall.y2 };

        // (A) 坦克采样点 vs 墙段
        const corners = tank.getAllCollisionCorners();
        for (const corner of corners) {
            const closest = closestPointOnSegment(corner, wa, wb);
            const dx = corner.x - closest.x;
            const dy = corner.y - closest.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < halfThick * halfThick && distSq > 0.0001) {
                const dist = Math.sqrt(distSq);
                const depth = halfThick - dist;
                const normal = { x: dx / dist, y: dy / dist };
                const rx = corner.x - tank.x;
                const ry = corner.y - tank.y;
                _applyWallImpulse(tank, normal, depth, rx, ry);
            }
        }

        // (B) 墙端点 vs 坦克 OBB（反向检测，覆盖凹槽）
        const wallEndpoints = [wa, wb];
        for (const ep of wallEndpoints) {
            // 检测墙端点是否在车体 OBB 内
            const bodyHit = _pointVsExpandedOBB(ep.x, ep.y, tank.x, tank.y, tank.angle, hw, hh, halfThick);
            if (bodyHit) {
                const rx = ep.x - tank.x;
                const ry = ep.y - tank.y;
                _applyWallImpulse(tank, bodyHit.normal, bodyHit.depth, rx, ry);
            }
            // 检测墙端点是否在炮管 OBB 内
            const cosA = Math.cos(tank.angle), sinA = Math.sin(tank.angle);
            const bcx = tank.x + barrelCenterLocalX * cosA;
            const bcy = tank.y + barrelCenterLocalX * sinA;
            const barrelHit = _pointVsExpandedOBB(ep.x, ep.y, bcx, bcy, tank.angle, barrelHW, bhh, halfThick);
            if (barrelHit) {
                const rx = ep.x - tank.x;
                const ry = ep.y - tank.y;
                _applyWallImpulse(tank, barrelHit.normal, barrelHit.depth, rx, ry);
            }
        }
    }
}

// 对单个接触点施加墙壁碰撞冲量 + 位置修正
function _applyWallImpulse(tank, normal, depth, rx, ry) {
    // 始终先做位置修正（无论速度方向如何，穿透就必须推出）
    const correction = Math.max(depth - POSITION_SLOP, 0) * POSITION_CORRECTION;
    tank.x += correction * normal.x;
    tank.y += correction * normal.y;

    // 接触点速度
    const vel = tank.velocityAtPoint(rx, ry);
    const vn = vel.x * normal.x + vel.y * normal.y;

    // 只在穿入方向（vn < 0）时施加冲量
    if (vn >= 0) return;

    // 计算有效质量（考虑力臂）
    const rnCross = rx * normal.y - ry * normal.x;
    const effectiveMass = tank.invMass + rnCross * rnCross * tank.invInertia;

    // 法线冲量
    const jn = -(1 + WALL_RESTITUTION) * vn / effectiveMass;
    if (jn <= 0) return;

    tank.applyImpulse(jn * normal.x, jn * normal.y, rx, ry);

    // 摩擦冲量（切线方向）
    const tangent = { x: -normal.y, y: normal.x };
    const vt = vel.x * tangent.x + vel.y * tangent.y;
    const rtCross = rx * tangent.y - ry * tangent.x;
    const effectiveMassT = tank.invMass + rtCross * rtCross * tank.invInertia;
    let jt = -vt / effectiveMassT;
    // 库仑摩擦限制
    const maxFriction = WALL_FRICTION_COEFF * jn;
    jt = clamp(jt, -maxFriction, maxFriction);
    tank.applyImpulse(jt * tangent.x, jt * tangent.y, rx, ry);
}

// ===== 坦克-坦克碰撞（刚体物理 SAT） =====
function resolveTankTankPhysics(a, b) {
    if (!a.alive || !b.alive) return;

    // SAT 检测（使用车体矩形）
    const cornersA = a.getCorners();
    const cornersB = b.getCorners();
    const axes = [...a.getAxes(), ...b.getAxes()];

    let minOverlap = Infinity;
    let minAxis = null;

    for (const axis of axes) {
        const projA = _project(cornersA, axis);
        const projB = _project(cornersB, axis);
        const overlap = Math.min(projA.max - projB.min, projB.max - projA.min);
        if (overlap <= 0) return; // 无碰撞
        if (overlap < minOverlap) {
            minOverlap = overlap;
            minAxis = axis;
        }
    }

    // 确保法线从 A 指向 B
    const d = { x: b.x - a.x, y: b.y - a.y };
    if (vecDot(d, minAxis) < 0) {
        minAxis = { x: -minAxis.x, y: -minAxis.y };
    }

    const normal = minAxis;
    const depth = minOverlap;

    // 碰撞点近似为两个矩形中心连线的中点
    const contactX = (a.x + b.x) / 2;
    const contactY = (a.y + b.y) / 2;

    const raX = contactX - a.x;
    const raY = contactY - a.y;
    const rbX = contactX - b.x;
    const rbY = contactY - b.y;

    // 相对速度
    const velA = a.velocityAtPoint(raX, raY);
    const velB = b.velocityAtPoint(rbX, rbY);
    const relVel = { x: velA.x - velB.x, y: velA.y - velB.y };
    const vn = relVel.x * normal.x + relVel.y * normal.y;

    // 正在分离则跳过
    if (vn > 0) {
        // 仍需位置修正
        const correction = Math.max(depth - POSITION_SLOP, 0) * POSITION_CORRECTION * 0.5;
        a.x -= correction * normal.x;
        a.y -= correction * normal.y;
        b.x += correction * normal.x;
        b.y += correction * normal.y;
        return;
    }

    // 有效质量
    const raCrossN = raX * normal.y - raY * normal.x;
    const rbCrossN = rbX * normal.y - rbY * normal.x;
    const effectiveMass = a.invMass + b.invMass
        + raCrossN * raCrossN * a.invInertia
        + rbCrossN * rbCrossN * b.invInertia;

    // 法线冲量
    const jn = -(1 + TANK_RESTITUTION) * vn / effectiveMass;

    a.applyImpulse(jn * normal.x, jn * normal.y, raX, raY);
    b.applyImpulse(-jn * normal.x, -jn * normal.y, rbX, rbY);

    // 摩擦冲量
    const tangent = { x: -normal.y, y: normal.x };
    const vt = relVel.x * tangent.x + relVel.y * tangent.y;
    const raCrossT = raX * tangent.y - raY * tangent.x;
    const rbCrossT = rbX * tangent.y - rbY * tangent.x;
    const effectiveMassT = a.invMass + b.invMass
        + raCrossT * raCrossT * a.invInertia
        + rbCrossT * rbCrossT * b.invInertia;

    let jt = -vt / effectiveMassT;
    const maxFriction = TANK_FRICTION_COEFF * jn;
    jt = clamp(jt, -maxFriction, maxFriction);

    a.applyImpulse(jt * tangent.x, jt * tangent.y, raX, raY);
    b.applyImpulse(-jt * tangent.x, -jt * tangent.y, rbX, rbY);

    // 位置修正
    const correction = Math.max(depth - POSITION_SLOP, 0) * POSITION_CORRECTION;
    const totalInvMass = a.invMass + b.invMass;
    if (totalInvMass > 0) {
        const ratio = correction / totalInvMass;
        a.x -= normal.x * ratio * a.invMass;
        a.y -= normal.y * ratio * a.invMass;
        b.x += normal.x * ratio * b.invMass;
        b.y += normal.y * ratio * b.invMass;
    }
}

// ===== 子弹-坦克碰撞 (圆 vs OBB) =====
function bulletHitTank(bullet, tank) {
    if (!bullet.alive || !tank.alive) return false;
    const dx = bullet.x - tank.x;
    const dy = bullet.y - tank.y;
    const c = Math.cos(-tank.angle), s = Math.sin(-tank.angle);
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    const hw = TANK_W / 2, hh = TANK_H / 2;
    const cx = Math.max(-hw, Math.min(hw, lx));
    const cy = Math.max(-hh, Math.min(hh, ly));
    const distSq = (lx - cx) * (lx - cx) + (ly - cy) * (ly - cy);
    return distSq <= bullet.radius * bullet.radius;
}

// ===== 硬约束位置修正（安全网，确保绝不穿墙） =====
function hardConstraintWalls(tank, walls) {
    const mazeLeft = MAZE_OFFSET_X;
    const mazeTop = MAZE_OFFSET_Y;
    const mazeRight = MAZE_OFFSET_X + COLS * CELL_SIZE;
    const mazeBottom = MAZE_OFFSET_Y + ROWS * CELL_SIZE;
    const halfThick = WALL_THICKNESS / 2 + 1.5;
    const hw = TANK_W / 2, hh = TANK_H / 2;
    const bx0 = hw - 2;
    const barrelCenterLocalX = bx0 + BARREL_LENGTH / 2;
    const barrelHW = BARREL_LENGTH / 2;
    const bhh = BARREL_WIDTH / 2;

    // 辅助：推出并消除穿入速度
    function _hardPush(nx, ny, pushDist) {
        tank.x += nx * pushDist;
        tank.y += ny * pushDist;
        const vDotN = tank.vx * nx + tank.vy * ny;
        if (vDotN < 0) {
            tank.vx -= vDotN * nx;
            tank.vy -= vDotN * ny;
        }
    }

    // 迭代3次确保多面墙交汇处也能完全推出
    for (let iter = 0; iter < 3; iter++) {
        const allCorners = tank.getAllCollisionCorners();

        // --- 边界硬约束 ---
        for (const corner of allCorners) {
            if (corner.x < mazeLeft) tank.x += mazeLeft - corner.x;
            if (corner.x > mazeRight) tank.x += mazeRight - corner.x;
            if (corner.y < mazeTop) tank.y += mazeTop - corner.y;
            if (corner.y > mazeBottom) tank.y += mazeBottom - corner.y;
        }

        // --- 内墙硬约束 ---
        for (const wall of walls) {
            const wa = { x: wall.x1, y: wall.y1 };
            const wb = { x: wall.x2, y: wall.y2 };

            // (A) 坦克采样点 vs 墙段
            const corners = tank.getAllCollisionCorners();
            for (const c of corners) {
                const closest = closestPointOnSegment(c, wa, wb);
                const dx = c.x - closest.x;
                const dy = c.y - closest.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < halfThick * halfThick && distSq > 0.0001) {
                    const dist = Math.sqrt(distSq);
                    _hardPush(dx / dist, dy / dist, halfThick - dist);
                }
            }

            // (B) 墙端点 vs 坦克 OBB（反向检测）
            const endpoints = [wa, wb];
            for (const ep of endpoints) {
                const bodyHit = _pointVsExpandedOBB(ep.x, ep.y, tank.x, tank.y, tank.angle, hw, hh, halfThick);
                if (bodyHit) {
                    _hardPush(bodyHit.normal.x, bodyHit.normal.y, bodyHit.depth);
                }
                const cosA = Math.cos(tank.angle), sinA = Math.sin(tank.angle);
                const bcx = tank.x + barrelCenterLocalX * cosA;
                const bcy = tank.y + barrelCenterLocalX * sinA;
                const barrelHit = _pointVsExpandedOBB(ep.x, ep.y, bcx, bcy, tank.angle, barrelHW, bhh, halfThick);
                if (barrelHit) {
                    _hardPush(barrelHit.normal.x, barrelHit.normal.y, barrelHit.depth);
                }
            }
        }
    }
}

// ===== 炮管碰撞预测（纯检测，不修改任何状态） =====
// 检测坦克在给定角度下炮管是否会与墙体/边界碰撞
function wouldBarrelCollide(tank, testAngle, walls) {
    const mazeLeft = MAZE_OFFSET_X;
    const mazeTop = MAZE_OFFSET_Y;
    const mazeRight = MAZE_OFFSET_X + COLS * CELL_SIZE;
    const mazeBottom = MAZE_OFFSET_Y + ROWS * CELL_SIZE;
    // 使用比碰撞系统更紧的检测半径（仅防止真正穿入，不在"接近"时就阻止）
    const halfThick = WALL_THICKNESS / 2;

    // 计算假设角度下的炮管采样点（局部坐标 → 世界坐标）
    const hw = TANK_W / 2;
    const bx0 = hw - 2;
    const bx1 = bx0 + BARREL_LENGTH;
    const bhh = BARREL_WIDTH / 2;
    const cosA = Math.cos(testAngle), sinA = Math.sin(testAngle);

    // 炮管关键采样点（局部坐标）
    const localPoints = [
        { x: bx0, y: -bhh }, { x: bx1, y: -bhh },  // 炮管两个远端角
        { x: bx1, y: bhh },  { x: bx0, y: bhh },    // 炮管两个近端角
        { x: bx1, y: 0 },                             // 尖端中心
        { x: (bx0 + bx1) / 2, y: -bhh },             // 侧面中点
        { x: (bx0 + bx1) / 2, y: bhh },
    ];

    // 转换到世界坐标
    const worldPoints = localPoints.map(p => ({
        x: tank.x + p.x * cosA - p.y * sinA,
        y: tank.y + p.x * sinA + p.y * cosA,
    }));

    // 检测边界
    for (const wp of worldPoints) {
        if (wp.x < mazeLeft || wp.x > mazeRight || wp.y < mazeTop || wp.y > mazeBottom) {
            return true;
        }
    }

    // 检测内墙
    for (const wall of walls) {
        const wa = { x: wall.x1, y: wall.y1 };
        const wb = { x: wall.x2, y: wall.y2 };
        for (const wp of worldPoints) {
            const closest = closestPointOnSegment(wp, wa, wb);
            const dx = wp.x - closest.x, dy = wp.y - closest.y;
            if (dx * dx + dy * dy < halfThick * halfThick) {
                return true;
            }
        }
    }

    return false;
}

// 二分搜索找到最大安全角速度（不导致炮管穿墙）
function findMaxSafeOmega(tank, desiredOmega, dt, walls) {
    // 如果当前角度已经碰撞，允许旋转（碰撞系统会处理位置推出）
    // 只有当旋转会让情况变得更糟时才限制
    if (wouldBarrelCollide(tank, tank.angle, walls)) return desiredOmega;

    let lo = 0, hi = desiredOmega;

    // 8次二分足够精确（精度 ≈ |desiredOmega| / 256）
    for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        const testAngle = tank.angle + mid * dt;
        if (wouldBarrelCollide(tank, testAngle, walls)) {
            hi = mid;
        } else {
            lo = mid;
        }
    }
    return lo;
}

// ===== 辅助函数 =====
function _project(corners, axis) {
    let min = Infinity, max = -Infinity;
    for (const c of corners) {
        const p = vecDot(c, axis);
        if (p < min) min = p;
        if (p > max) max = p;
    }
    return { min, max };
}

// 兼容旧接口（AI 等可能调用）
function resolveTankWallCollisions(tank, walls) {
    resolveTankWallPhysics(tank, walls);
}

function resolveTankTankCollision(a, b) {
    resolveTankTankPhysics(a, b);
}
