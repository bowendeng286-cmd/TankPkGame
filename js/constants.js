// ===== 迷宫 =====
const COLS = 13;
const ROWS = 9;
const CELL_SIZE = 60;
const WALL_THICKNESS = 4;
const CANVAS_W = (COLS + 1) * CELL_SIZE;   // 840
const CANVAS_H = (ROWS + 1) * CELL_SIZE + 20; // 620
const MAZE_OFFSET_X = CELL_SIZE / 2;
const MAZE_OFFSET_Y = CELL_SIZE / 2;
const WALL_REMOVE_RATIO = 0.42;

// ===== 坦克 =====
const TANK_W = 28;
const TANK_H = 22;
const TANK_SPEED = 120;        // px/s
const TANK_TURN_SPEED = 3.0;   // rad/s
const BARREL_LENGTH = 16;
const BARREL_WIDTH = 6;

// ===== 碰撞物理 =====
const TANK_MASS = 5.0;
const TANK_INERTIA = TANK_MASS * (TANK_W * TANK_W + TANK_H * TANK_H) / 12;
const WALL_RESTITUTION = 0.15;      // 墙壁弹性系数
const WALL_FRICTION_COEFF = 0.4;    // 墙壁摩擦系数
const TANK_RESTITUTION = 0.3;       // 坦克间碰撞弹性
const TANK_FRICTION_COEFF = 0.3;    // 坦克间摩擦系数
const PHYSICS_ITERATIONS = 5;       // 碰撞迭代次数
const POSITION_CORRECTION = 0.8;    // Baumgarte 位置修正比例
const POSITION_SLOP = 0.3;          // 允许的穿透容差

// ===== 子弹 =====
const BULLET_SPEED = 200;      // px/s
const BULLET_RADIUS = 3;
const BULLET_MAX_BOUNCES = 5;
const BULLET_MAX_LIFETIME = 8; // seconds
const SHOOT_COOLDOWN = 0.5;    // seconds

// ===== 颜色 =====
// 颜色由 theme.js 中的 Theme 对象管理
// 使用 Theme.colors.bg, Theme.colors.wall 等访问

// ===== 游戏 =====
const DEFAULT_WIN_SCORE = 5;
const ROUND_PAUSE_TIME = 1.5;  // seconds
const VICTORY_GRACE_TIME = 2.5; // 胜利缓冲期（秒），期间游戏继续运行
const SPAWN_MIN_DIST = 3;      // cells apart
const DEATH_PARTICLES = 20;
const MOUSE_DEAD_ZONE = 30;    // px – 鼠标距坦克小于此距离时静止

// ===== AI =====
const AI_DIFFICULTY = {
    easy:   { reactionTime: 0.5, aimJitter: 15 * Math.PI / 180, dodgeRate: 0.50, bounceDepth: 1, shootCooldown: 1.5 },
    medium: { reactionTime: 0.3, aimJitter:  8 * Math.PI / 180, dodgeRate: 0.75, bounceDepth: 2, shootCooldown: 0.8 },
    hard:   { reactionTime: 0.1, aimJitter:  2 * Math.PI / 180, dodgeRate: 0.95, bounceDepth: 3, shootCooldown: 0.4 },
};

// ===== 按键映射 =====
const KEY_MAPS = [
    { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: 'KeyM' },
    { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'Space' },
    { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', fire: 'Numpad0' },
];
