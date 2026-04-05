class Tank {
    constructor(x, y, angle, color, id) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.color = color;
        this.id = id;
        this.alive = true;
        this.score = 0;
        this.shootTimer = 0;
        this.speed = TANK_SPEED;       // AI 参考速度
        this.turnSpeed = TANK_TURN_SPEED; // AI 参考
        this.mouseControl = false;

        // 刚体物理属性
        this.vx = 0;
        this.vy = 0;
        this.omega = 0;  // 角速度 rad/s
        this._lastInputOmega = 0; // 上一帧输入分量（用于提取碰撞角速度）
        this._lastInputVx = 0;    // 上一帧输入速度分量（用于提取碰撞速度）
        this._lastInputVy = 0;
        this.mass = TANK_MASS;
        this.inertia = TANK_INERTIA;
        this.invMass = 1 / TANK_MASS;
        this.invInertia = 1 / TANK_INERTIA;

        // 控制输入 (由 input 或 AI 设置)
        this.input = { forward: false, backward: false, left: false, right: false, fire: false };
    }

    update(dt) {
        if (!this.alive) return;
        if (this.shootTimer > 0) this.shootTimer -= dt;
    }

    // ===== 碰撞物理方法 =====

    // 速度积分：更新位置
    integrateVelocity(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle += this.omega * dt;
    }

    // 在接触点施加冲量
    applyImpulse(jx, jy, rx, ry) {
        this.vx += jx * this.invMass;
        this.vy += jy * this.invMass;
        this.omega += (rx * jy - ry * jx) * this.invInertia;
    }

    // 接触点的速度（考虑角速度）
    velocityAtPoint(rx, ry) {
        return {
            x: this.vx - this.omega * ry,
            y: this.vy + this.omega * rx,
        };
    }

    // ===== 碰撞形状 =====

    canShoot() {
        return this.alive && this.shootTimer <= 0;
    }

    resetShootTimer(cd) {
        this.shootTimer = cd || SHOOT_COOLDOWN;
    }

    // 获取车体 OBB 四角点 (世界坐标)
    getCorners() {
        const hw = TANK_W / 2, hh = TANK_H / 2;
        const local = [
            { x: -hw, y: -hh }, { x: hw, y: -hh },
            { x: hw, y: hh },  { x: -hw, y: hh },
        ];
        return local.map(p => {
            const r = vecRotate(p, this.angle);
            return { x: this.x + r.x, y: this.y + r.y };
        });
    }

    // 获取炮管矩形四角点（世界坐标）
    getBarrelCorners() {
        const bx0 = TANK_W / 2 - 2;
        const bx1 = bx0 + BARREL_LENGTH;
        const bhh = BARREL_WIDTH / 2;
        const local = [
            { x: bx0, y: -bhh }, { x: bx1, y: -bhh },
            { x: bx1, y: bhh },  { x: bx0, y: bhh },
        ];
        return local.map(p => {
            const r = vecRotate(p, this.angle);
            return { x: this.x + r.x, y: this.y + r.y };
        });
    }

    // 获取所有碰撞采样点（车体角 + 炮管角 + 边缘中点，覆盖凹槽）
    getAllCollisionCorners() {
        const hw = TANK_W / 2, hh = TANK_H / 2;
        const bx0 = hw - 2;
        const bx1 = bx0 + BARREL_LENGTH;
        const bhh = BARREL_WIDTH / 2;

        // 额外采样点（局部坐标）：填充车体前脸与炮管之间的凹槽 + 各边中点
        const extras = [
            // 车体前脸上半段中点（炮管上方的暴露边缘）
            { x: hw, y: -(hh + bhh) / 2 },
            // 车体前脸下半段中点（炮管下方的暴露边缘）
            { x: hw, y: (hh + bhh) / 2 },
            // 车体前脸与炮管交界的两个拐角
            { x: hw, y: -bhh },
            { x: hw, y: bhh },
            // 炮管两侧中点
            { x: (bx0 + bx1) / 2, y: -bhh },
            { x: (bx0 + bx1) / 2, y: bhh },
            // 炮管尖端中心（提高窄角度穿墙检测率）
            { x: bx1, y: 0 },
            // 车体其余边中点
            { x: 0, y: -hh },   // 顶边中点
            { x: 0, y: hh },    // 底边中点
            { x: -hw, y: 0 },   // 后边中点
        ];

        const extraWorld = extras.map(p => {
            const r = vecRotate(p, this.angle);
            return { x: this.x + r.x, y: this.y + r.y };
        });

        return this.getCorners().concat(this.getBarrelCorners()).concat(extraWorld);
    }

    // OBB 轴
    getAxes() {
        const c = Math.cos(this.angle), s = Math.sin(this.angle);
        return [{ x: c, y: s }, { x: -s, y: c }];
    }

    // 炮口位置
    getMuzzle() {
        const r = vecRotate({ x: TANK_W / 2 + BARREL_LENGTH * 0.5, y: 0 }, this.angle);
        return { x: this.x + r.x, y: this.y + r.y };
    }

    kill() {
        this.alive = false;
    }

    respawn(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.alive = true;
        this.shootTimer = 0;
        this.vx = 0;
        this.vy = 0;
        this.omega = 0;
        this._lastInputOmega = 0;
        this._lastInputVx = 0;
        this._lastInputVy = 0;
        this.input = { forward: false, backward: false, left: false, right: false, fire: false };
    }
}
