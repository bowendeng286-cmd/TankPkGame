// ===== Maze =====
const BASE_COLS = 13;
const BASE_ROWS = 9;
const MAP_COLS_MIN = 3;
const MAP_COLS_MAX = 10;
const MAP_ROWS_MIN = 3;
const MAP_ROWS_MAX = 10;
const CELL_SIZE = 60;
const WALL_THICKNESS = 4;
const MAZE_OFFSET_X = CELL_SIZE / 2;
const MAZE_OFFSET_Y = CELL_SIZE / 2;
const WALL_REMOVE_RATIO = 0.42;

var COLS = BASE_COLS;
var ROWS = BASE_ROWS;
var CANVAS_W = 0;
var CANVAS_H = 0;
var TOUCH_JOYSTICK_P1_SINGLE_X = 0;
var TOUCH_JOYSTICK_P1_SINGLE_Y = 0;
var TOUCH_FIRE_P1_SINGLE_X = 0;
var TOUCH_FIRE_P1_SINGLE_Y = 0;
var TOUCH_JOYSTICK_P1_DUAL_X = 0;
var TOUCH_JOYSTICK_P1_DUAL_Y = 0;
var TOUCH_FIRE_P1_DUAL_X = 0;
var TOUCH_FIRE_P1_DUAL_Y = 0;
var TOUCH_JOYSTICK_P2_DUAL_X = 0;
var TOUCH_JOYSTICK_P2_DUAL_Y = 0;
var TOUCH_FIRE_P2_DUAL_X = 0;
var TOUCH_FIRE_P2_DUAL_Y = 0;

function getCanvasWidthForCols(cols) {
    return (cols + 1) * CELL_SIZE;
}

function getCanvasHeightForRows(rows) {
    return (rows + 1) * CELL_SIZE + 20;
}

function getTouchReferenceWidth() {
    if (typeof window !== 'undefined' && Number.isFinite(window.innerWidth) && window.innerWidth > 0) {
        return window.innerWidth;
    }
    return getCanvasWidthForCols(BASE_COLS);
}

function getTouchReferenceHeight() {
    if (typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0) {
        return window.innerHeight;
    }
    return getCanvasHeightForRows(BASE_ROWS);
}

function setMapSize(cols, rows) {
    const nextCols = Math.max(1, Math.floor(cols));
    const nextRows = Math.max(1, Math.floor(rows));
    COLS = nextCols;
    ROWS = nextRows;
    CANVAS_W = getCanvasWidthForCols(nextCols);
    CANVAS_H = getCanvasHeightForRows(nextRows);
    syncTouchLayoutConstants();
}

function getTouchLayoutDefaults(canvasWidth, canvasHeight) {
    const width = typeof canvasWidth === 'number' ? canvasWidth : getTouchReferenceWidth();
    const height = typeof canvasHeight === 'number' ? canvasHeight : getTouchReferenceHeight();

    return {
        singlePlayer: {
            joystick: { x: 100, y: height - 100 },
            fireButton: { x: width - 100, y: height - 100 }
        },
        dualPlayer: {
            player1: {
                joystick: { x: 100, y: 100 },
                fireButton: { x: 100, y: height - 100 }
            },
            player2: {
                joystick: { x: width - 100, y: 100 },
                fireButton: { x: width - 100, y: height - 100 }
            }
        }
    };
}

function syncTouchLayoutConstants() {
    const layout = getTouchLayoutDefaults();
    TOUCH_JOYSTICK_P1_SINGLE_X = layout.singlePlayer.joystick.x;
    TOUCH_JOYSTICK_P1_SINGLE_Y = layout.singlePlayer.joystick.y;
    TOUCH_FIRE_P1_SINGLE_X = layout.singlePlayer.fireButton.x;
    TOUCH_FIRE_P1_SINGLE_Y = layout.singlePlayer.fireButton.y;

    TOUCH_JOYSTICK_P1_DUAL_X = layout.dualPlayer.player1.joystick.x;
    TOUCH_JOYSTICK_P1_DUAL_Y = layout.dualPlayer.player1.joystick.y;
    TOUCH_FIRE_P1_DUAL_X = layout.dualPlayer.player1.fireButton.x;
    TOUCH_FIRE_P1_DUAL_Y = layout.dualPlayer.player1.fireButton.y;

    TOUCH_JOYSTICK_P2_DUAL_X = layout.dualPlayer.player2.joystick.x;
    TOUCH_JOYSTICK_P2_DUAL_Y = layout.dualPlayer.player2.joystick.y;
    TOUCH_FIRE_P2_DUAL_X = layout.dualPlayer.player2.fireButton.x;
    TOUCH_FIRE_P2_DUAL_Y = layout.dualPlayer.player2.fireButton.y;
}

setMapSize(BASE_COLS, BASE_ROWS);

// ===== Viewport =====
var VIEWPORT_SCALE = 1;
var VIEWPORT_OFFSET_X = 0;
var VIEWPORT_OFFSET_Y = 0;

// ===== Tank =====
const TANK_W = 28;
const TANK_H = 22;
const TANK_SPEED = 120;
const TANK_TURN_SPEED = 3.0;
const BARREL_LENGTH = 16;
const BARREL_WIDTH = 6;

// ===== Physics =====
const TANK_MASS = 5.0;
const TANK_INERTIA = TANK_MASS * (TANK_W * TANK_W + TANK_H * TANK_H) / 12;
const WALL_RESTITUTION = 0.15;
const WALL_FRICTION_COEFF = 0.4;
const TANK_RESTITUTION = 0.3;
const TANK_FRICTION_COEFF = 0.3;
const PHYSICS_ITERATIONS = 5;
const POSITION_CORRECTION = 0.8;
const POSITION_SLOP = 0.3;

// ===== Bullet =====
const BULLET_SPEED = 200;
const BULLET_RADIUS = 3;
const BULLET_MAX_BOUNCES = 5;
const BULLET_MAX_LIFETIME = 8;
const SHOOT_COOLDOWN = 0.5;

// ===== Laser =====
const LASER_SPEED = 520;
const LASER_BEAM_WIDTH = 6;
const LASER_RADIUS = LASER_BEAM_WIDTH / 2;
const LASER_TAIL_LENGTH = 90;
const LASER_PREVIEW_MAX_BOUNCES = 5;
const LASER_MAX_BOUNCES = 10;
const LASER_PREVIEW_LINE_WIDTH = 3;
const LASER_SHOT_LINE_WIDTH = 3;
const LASER_RENDER_HEAD_RADIUS = 8;
const LASER_BOUNCE_FLASH_TIME = 0.12;

// ===== Pickup =====
const PICKUP_RADIUS = 14;
const PICKUP_FIRST_SPAWN_DELAY = 6;
const PICKUP_RESPAWN_INTERVAL = 10;
const PICKUP_MAX_ACTIVE = 2;
const PICKUP_LAND_DURATION = 0.45;
const PICKUP_DROP_HEIGHT = 20;
const PICKUP_SPAWN_WALL_BUFFER = 18;
const PICKUP_SPAWN_TANK_BUFFER = 52;
const PICKUP_SPAWN_PICKUP_BUFFER = 54;

// ===== Game =====
const DEFAULT_WIN_SCORE = 5;
const ROUND_PAUSE_TIME = 1.5;
const VICTORY_GRACE_TIME = 2.5;
const SPAWN_MIN_DIST = 3;
const DEATH_PARTICLES = 20;
const MOUSE_DEAD_ZONE = 30;

// ===== Touch =====
const TOUCH_JOYSTICK_OUTER_RADIUS = 60;
const TOUCH_JOYSTICK_INNER_RADIUS = 25;
const TOUCH_JOYSTICK_MAX_DISTANCE = 50;
const TOUCH_JOYSTICK_DEAD_ZONE = 5;

const JOYSTICK_OUTER_RADIUS_MIN = 40;
const JOYSTICK_OUTER_RADIUS_MAX = 80;
const JOYSTICK_DEAD_ZONE_MIN = 0;
const JOYSTICK_DEAD_ZONE_MAX = 40;
const FIRE_BUTTON_RADIUS_MIN = 30;
const FIRE_BUTTON_RADIUS_MAX = 60;

const TOUCH_FIRE_BUTTON_RADIUS = 45;

const TOUCH_TARGET_OMEGA_MULTIPLIER = 4.5;
const TOUCH_ROTATION_THRESHOLD = 15;
const TOUCH_MOVEMENT_THRESHOLD = 70;
const JOYSTICK_SENSITIVITY = 1.2;
const TOUCH_CONTROL_OPACITY = 0.4;

// ===== AI =====
const AI_THREAT_LOOKAHEAD = 2.0;
const AI_URGENT_THREAT_TIME = 0.8;
const AI_DODGE_THREAT_GRACE = 0.18;
const AI_TURN_LOCK_ENTER_ANGLE = 0.12;
const AI_TURN_LOCK_EXIT_ANGLE = 0.03;
const AI_DODGE_PLAN_STEP = 0.12;
const AI_DODGE_PLAN_DEPTH = 3;
const AI_DODGE_PLAN_BEAM = 4;
const AI_DODGE_PLAN_RANGE = 220;
const AI_DODGE_SAFETY_MARGIN = 4;
const AI_DODGE_ACTION_SWITCH_PENALTY = 8;
const AI_DODGE_REVERSE_PENALTY = 4;
const AI_DODGE_IDLE_PENALTY = 3;
const AI_DODGE_WALL_PENALTY = 18;
const AI_DODGE_BARREL_LIMIT_PENALTY = 6;
const AI_ATTACK_STALL_MOVE_EPS = 6;
const AI_ATTACK_REPOSITION_RADIUS = 3;
const AI_DIFFICULTY = {
    easy: {
        reactionTime: 0.5,
        aimJitter: 15 * Math.PI / 180,
        dodgeRate: 0.50,
        bounceDepth: 1,
        shootCooldown: 1.5,
    },
    medium: {
        reactionTime: 0.3,
        aimJitter: 8 * Math.PI / 180,
        dodgeRate: 0.80,
        bounceDepth: 2,
        shootCooldown: 0.8,
        threatLookahead: 2.4,
        urgentThreatTime: 0.95,
        dodgePreviewDist: 72,
        dodgeCommitTime: 0.22,
        threatPadding: 4,
        dodgeWallBuffer: 2,
        dodgePlanDepth: 4,
        dodgePlanBeam: 5,
        dodgePlanRange: 250,
        dodgeSafetyMargin: 6,
        dodgeActionSwitchPenalty: 10,
        maxDirectHoldTime: 1.8,
        maxRicochetHoldTime: 1.1,
        repositionCooldown: 1.2,
    },
    hard: {
        reactionTime: 0.02,
        aimJitter: 0.5 * Math.PI / 180,
        dodgeRate: 0.90,
        alwaysDodge: true,
        bounceDepth: 3,
        shootCooldown: 0.35,
        threatLookahead: 3.0,
        urgentThreatTime: 1.1,
        dodgeWindow: 1.6,
        dodgePreviewDist: 90,
        dodgeCommitTime: 0.42,
        threatPadding: 8,
        dodgeWallBuffer: 5,
        dodgePlanDepth: 5,
        dodgePlanBeam: 6,
        dodgePlanRange: 280,
        dodgeSafetyMargin: 10,
        dodgeActionSwitchPenalty: 12,
        dodgeWallPenalty: 24,
        maxDirectHoldTime: 1.1,
        maxRicochetHoldTime: 0.65,
        repositionCooldown: 0.8,
    },
};

// ===== Keyboard =====
const KEY_MAPS = [
    { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: 'KeyM' },
    { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'Space' },
    { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', fire: 'Numpad0' },
];
