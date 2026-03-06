const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// 全屏Canvas + 游戏区域居中
function fitCanvas() {
    // Canvas物理尺寸 = 窗口尺寸
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // 计算游戏区域缩放和偏移（保持宽高比，居中显示）
    const scaleX = window.innerWidth / CANVAS_W;
    const scaleY = window.innerHeight / CANVAS_H;
    VIEWPORT_SCALE = Math.min(scaleX, scaleY);
    VIEWPORT_OFFSET_X = (window.innerWidth - CANVAS_W * VIEWPORT_SCALE) / 2;
    VIEWPORT_OFFSET_Y = (window.innerHeight - CANVAS_H * VIEWPORT_SCALE) / 2;
    
    // 更新触摸控制器布局（如果已初始化）
    if (typeof input !== 'undefined' && input && input.touchEnabled && config) {
        input.updateLayout(config.humanCount);
    }
}

const input = new InputManager();
input.bindCanvas(canvas);
const renderer = new Renderer(ctx);
const particles = new ParticleSystem();
const gameState = new GameState();
const menu = new Menu();
const controlsConfigUI = new ControlsConfigUI();

// 初始化完成后再设置resize监听和首次调用
window.addEventListener('resize', fitCanvas);
fitCanvas();

var maze = null;
var tanks = [];
var bullets = [];
var aiControllers = [];
var muzzleFlashes = []; // {x, y, timer}
var config = null;
var pendingVictoryTimer = null; // 胜利缓冲倒计时（null=未激活）
var pendingWinnerId = -1;       // 缓冲期触发时最后存活坦克ID（-1=无人存活）

// ===== 初始化回合 =====
function startRound() {
    maze = generateMaze();
    bullets = [];
    muzzleFlashes = [];
    particles.clear();
    pendingVictoryTimer = null;
    pendingWinnerId = -1;
    // 生成重生点（间距≥3格）
    const spawns = _generateSpawns(tanks.length);
    tanks.forEach((t, i) => {
        t.respawn(spawns[i].x, spawns[i].y, randFloat(0, Math.PI * 2));
    });
    aiControllers.forEach(({ ctrl }) => {
        ctrl.state = 0;
        ctrl.path = [];
        ctrl.thinkTimer = 0;
        ctrl.shootCooldown = 0;
    });
}

function _generateSpawns(count) {
    const positions = [];
    const allCells = [];
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            allCells.push({ r, c });
    shuffle(allCells);

    for (const cell of allCells) {
        const pos = cellCenter(cell.r, cell.c);
        let ok = true;
        for (const p of positions) {
            const cellDist = Math.abs(cell.r - Math.floor((p.y - MAZE_OFFSET_Y) / CELL_SIZE))
                           + Math.abs(cell.c - Math.floor((p.x - MAZE_OFFSET_X) / CELL_SIZE));
            if (cellDist < SPAWN_MIN_DIST) { ok = false; break; }
        }
        if (ok) positions.push(pos);
        if (positions.length >= count) break;
    }
    // fallback
    while (positions.length < count) {
        const cell = allCells[positions.length];
        positions.push(cellCenter(cell.r, cell.c));
    }
    return positions;
}

// ===== 开始游戏 =====
function startGame(cfg) {
    menu.deactivate();  // 移除菜单的触摸事件监听器
    input.reset();
    config = cfg;
    gameState.winScore = cfg.winScore;
    tanks = [];
    aiControllers = [];
    const total = cfg.humanCount + cfg.aiCount;
    
    // 更新触摸控制器布局
    if (input.touchEnabled) {
        input.updateLayout(cfg.humanCount);
    }
    
    for (let i = 0; i < total; i++) {
        const t = new Tank(0, 0, 0, Theme.colors.tanks[i % Theme.colors.tanks.length], i);
        t.isAI = i >= cfg.humanCount;
        // Player 3 (index 2) 使用鼠标控制
        if (i === 2 && !t.isAI) t.mouseControl = true;
        tanks.push(t);
    }
    for (let i = cfg.humanCount; i < total; i++) {
        aiControllers.push({ tank: tanks[i], ctrl: new AIController(cfg.difficulty) });
    }
    gameState.transitionTo(STATE.PLAYING);
    startRound();
}

// ===== 读取人类输入 =====
function readHumanInput() {
    for (let i = 0; i < Math.min(config.humanCount, tanks.length); i++) {
        const t = tanks[i];
        if (!t.alive) { t.input = { forward:false, backward:false, left:false, right:false, fire:false }; continue; }

        // 触摸控制（支持双玩家）
        if (input.touchEnabled && i < 2) {
            const joystick = input.joysticks[i];
            const fireButton = input.fireButtons[i];
            
            if (joystick.active) {
                // 摇杆激活：处理移动和旋转
                t._mouseTargetAngle = joystick.angle;
                
                // 使用摇杆的死区参数：死区内只旋转不移动
                if (joystick.distance <= joystick.deadZone) {
                    // 死区内：只旋转，不移动
                    t.input.forward = false;
                } else {
                    // 死区外：旋转 + 移动
                    t.input.forward = true;
                }
                
                t.input.backward = false;
                t.input.left = false;
                t.input.right = false;
                t.mouseControl = true;
            } else {
                // 摇杆未激活：坦克静止
                t.input.forward = false;
                t.input.backward = false;
                t.input.left = false;
                t.input.right = false;
                t.mouseControl = false;
            }
            
            // 开火按钮独立处理（无论摇杆是否激活）
            t.input.fire = fireButton.active;
            continue;
        }

        // Player 3 鼠标控制
        if (t.mouseControl) {
            const dx = input.mouseX - t.x;
            const dy = input.mouseY - t.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // 鼠标模式：记录目标角度，由物理力矩驱动旋转
            t._mouseTargetAngle = Math.atan2(dy, dx);
            t.input.forward = dist > MOUSE_DEAD_ZONE;
            t.input.backward = false;
            t.input.left = false;
            t.input.right = false;
            t.input.fire = input.mouseDown;
            continue;
        }

        // 键盘控制
        const km = KEY_MAPS[i];
        t.input.forward  = input.isDown(km.up);
        t.input.backward = input.isDown(km.down);
        t.input.left     = input.isDown(km.left);
        t.input.right    = input.isDown(km.right);
        t.input.fire     = input.isDown(km.fire);
    }
}

// ===== 游戏更新 =====
function updateGame(dt) {
    readHumanInput();

    // AI 更新
    for (const { tank, ctrl } of aiControllers) {
        if (!tank.alive) continue;
        tank.input = { forward:false, backward:false, left:false, right:false, fire:false };
        ctrl.update(dt, tank, tanks, bullets, maze);
    }

    // 坦克更新（线性移动 + 冲量碰撞）
    for (const t of tanks) {
        if (!t.alive) continue;

        // 射击
        if (t.input.fire && t.canShoot()) {
            const muzzle = t.getMuzzle();
            bullets.push(new Bullet(muzzle.x, muzzle.y, t.angle, t.id));
            t.resetShootTimer();
            muzzleFlashes.push({ x: muzzle.x, y: muzzle.y, timer: 0.08 });
        }

        // 1. 计算输入期望的角速度
        let inputOmega;
        if (t.mouseControl) {
            const targetAngle = t._mouseTargetAngle || t.angle;
            const diff = angleDiff(t.angle, targetAngle);
            const MAX_MOUSE_OMEGA = TANK_TURN_SPEED * 3;
            inputOmega = clamp(diff * 8, -MAX_MOUSE_OMEGA, MAX_MOUSE_OMEGA);
        } else {
            inputOmega = 0;
            if (t.input.left) inputOmega = -t.turnSpeed;
            if (t.input.right) inputOmega = t.turnSpeed;
        }

        // 2. 混合：输入角速度 + 碰撞残余角速度（保留碰撞弹开效果）
        let collisionOmega = (t.omega - (t._lastInputOmega || 0)) * 0.3;
        // 碰撞残余与输入方向相反时丢弃（避免累积阻力导致转不动）
        if (inputOmega !== 0 && collisionOmega !== 0 && Math.sign(collisionOmega) !== Math.sign(inputOmega)) {
            collisionOmega = 0;
        }
        t.omega = inputOmega + collisionOmega;
        t._lastInputOmega = inputOmega;

        // 3. 预测式炮管防穿墙：如果旋转后炮管会碰墙，限制 omega
        if (t.omega !== 0 && maze) {
            const predictedAngle = t.angle + t.omega * dt;
            if (wouldBarrelCollide(t, predictedAngle, maze.walls)) {
                t.omega = findMaxSafeOmega(t, t.omega, dt, maze.walls);
            }
        }

        // 4. 设移动速度（混合输入 + 碰撞残余）
        const collisionVx = t.vx - (t._lastInputVx || 0);
        const collisionVy = t.vy - (t._lastInputVy || 0);

        let move = 0;
        if (t.input.forward) move = 1;
        else if (t.input.backward) move = -0.6;

        let inputVx, inputVy;
        if (move !== 0) {
            inputVx = Math.cos(t.angle) * t.speed * move;
            inputVy = Math.sin(t.angle) * t.speed * move;
        } else {
            inputVx = 0;
            inputVy = 0;
        }

        // 混合：输入速度 + 碰撞残余（衰减保留，让坦克旋转时自然滑离墙壁）
        t.vx = inputVx + collisionVx * 0.3;
        t.vy = inputVy + collisionVy * 0.3;
        t._lastInputVx = inputVx;
        t._lastInputVy = inputVy;

        // 碰撞残余很小时清零，避免无限漂移
        if (move === 0 && Math.abs(t.vx) < 0.5 && Math.abs(t.vy) < 0.5) {
            t.vx = 0;
            t.vy = 0;
        }

        // 3. 速度积分 → 更新位置和角度
        t.integrateVelocity(dt);

        // 4. 冷却计时
        t.update(dt);
    }

    // 5. 碰撞检测与响应（迭代多次）
    for (let iter = 0; iter < PHYSICS_ITERATIONS; iter++) {
        for (const t of tanks) {
            if (!t.alive) continue;
            resolveTankWallPhysics(t, maze.walls);
        }
        for (let i = 0; i < tanks.length; i++)
            for (let j = i + 1; j < tanks.length; j++)
                resolveTankTankPhysics(tanks[i], tanks[j]);
    }

    // 6. 硬约束安全网（确保绝不穿墙）
    for (const t of tanks) {
        if (!t.alive) continue;
        hardConstraintWalls(t, maze.walls);
    }

    // 子弹更新
    for (const b of bullets) {
        b.update(dt, maze.walls);
    }

    // 子弹-坦克碰撞
    for (const b of bullets) {
        if (!b.alive) continue;
        for (const t of tanks) {
            if (!t.alive) continue;
            if (bulletHitTank(b, t)) {
                b.alive = false;
                t.kill();
                particles.emit(t.x, t.y, t.color);
                renderer.shake(1);
                break;
            }
        }
    }

    // 清理死亡子弹
    bullets = bullets.filter(b => b.alive);

    // 闪光更新
    for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
        muzzleFlashes[i].timer -= dt;
        if (muzzleFlashes[i].timer <= 0) muzzleFlashes.splice(i, 1);
    }

    particles.update(dt);

    // 回合检测（带缓冲期）
    const alive = tanks.filter(t => t.alive);
    if (pendingVictoryTimer === null && alive.length <= 1 && tanks.length > 1) {
        // 启动缓冲期，记录当前最后存活者
        pendingVictoryTimer = VICTORY_GRACE_TIME;
        pendingWinnerId = alive.length === 1 ? alive[0].id : -1;
    }
    if (pendingVictoryTimer !== null) {
        pendingVictoryTimer -= dt;
        if (pendingVictoryTimer <= 0) {
            // 缓冲期结束，重新检测存活状态
            const pendingWinner = pendingWinnerId >= 0 ? tanks.find(t => t.id === pendingWinnerId) : null;
            const stillAlive = pendingWinner && pendingWinner.alive;
            if (stillAlive) {
                pendingWinner.score++;
                const winner = tanks.find(tk => tk.score >= gameState.winScore);
                if (winner) {
                    const label = winner.isAI ? t('ai') : `P${winner.id + 1}`;
                    gameState.pauseTimer = 0;
                    gameState.transitionTo(STATE.GAME_OVER, `${label} ${t('winsGame')}`);
                } else {
                    const label = pendingWinner.isAI ? t('ai') : ('P' + (pendingWinner.id + 1));
                    gameState.startPause(ROUND_PAUSE_TIME, `${label} ${t('scores')}`);
                }
            } else {
                // 最后存活者也死了，平局
                gameState.startPause(ROUND_PAUSE_TIME, t('draw'));
            }
            pendingVictoryTimer = null;
            pendingWinnerId = -1;
        }
    }
}

// ===== 绘制 =====
function drawGame() {
    renderer.clear();
    renderer.drawGrid();
    renderer.drawWalls(maze.walls);
    for (const t of tanks) renderer.drawTank(t);
    for (const b of bullets) renderer.drawBullet(b);
    for (const f of muzzleFlashes) renderer.drawMuzzleFlash(f.x, f.y);
    particles.draw(ctx);
    renderer.drawScoreboardTop(tanks);
    
    // 绘制触摸控制器（支持双玩家）
    if (input.touchEnabled && gameState.current === STATE.PLAYING) {
        for (let i = 0; i < Math.min(config.humanCount, 2); i++) {
            renderer.drawTouchJoystick(input.joysticks[i], i);
            renderer.drawTouchFireButton(input.fireButtons[i], tanks[i], i);
        }
    }
    
    if (gameState.current === STATE.ROUND_PAUSE || gameState.current === STATE.GAME_OVER) {
        renderer.drawRoundMessage(gameState.roundMessage, gameState.current === STATE.GAME_OVER, input.isTouchDevice);
    }
    renderer.endFrame();
}

// ===== 主循环 =====
var lastTime = 0;
menu.activate(input);

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    switch (gameState.current) {
        case STATE.MENU:
            menu.update();
            menu.draw(ctx);
            if (menu.done) startGame(menu.result);
            if (menu.openSettings) {
                gameState.transitionTo(STATE.SETTINGS);
                menu.openSettings = false;
            }
            break;
        case STATE.SETTINGS:
            menu.update();
            menu.draw(ctx);
            if (menu.openControlsConfig) {
                gameState.transitionTo(STATE.CONTROLS_CONFIG);
                controlsConfigUI.activate(input);
                menu.openControlsConfig = false;
            }
            if (menu.page === 'main') {
                gameState.transitionTo(STATE.MENU);
            }
            break;
        case STATE.CONTROLS_CONFIG:
            controlsConfigUI.update(dt);
            controlsConfigUI.draw(ctx);
            if (controlsConfigUI.done) {
                controlsConfigUI.deactivate();
                // 如果保存了配置，重新加载到 input
                if (controlsConfigUI.saved && config) {
                    input.updateLayout(config.humanCount);
                }
                gameState.transitionTo(STATE.SETTINGS);
            }
            break;
        case STATE.PLAYING:
            updateGame(dt);
            drawGame();
            break;
        case STATE.ROUND_PAUSE:
            particles.update(dt);
            drawGame();
            if (gameState.update(dt)) {
                startRound();
                gameState.transitionTo(STATE.PLAYING);
            }
            break;
        case STATE.GAME_OVER:
            gameState.pauseTimer += dt;
            drawGame();
            // 按 Enter 或点击屏幕返回菜单 (延迟0.5s防误触)
            if ((input.isDown('Enter') || input.consumeScreenTap()) && gameState.pauseTimer > 0.5) {
                input.reset();
                gameState.transitionTo(STATE.MENU);
                menu.activate(input);
            }
            break;
    }
    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
