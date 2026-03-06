// ===== 控制器配置管理 =====
class ControlsSettings {
    static STORAGE_KEY = 'tankgame_controls';
    static VERSION = 1;

    // 获取默认配置
    static getDefault() {
        return {
            version: this.VERSION,
            singlePlayer: {
                joystick: {
                    x: TOUCH_JOYSTICK_P1_SINGLE_X,
                    y: TOUCH_JOYSTICK_P1_SINGLE_Y,
                    outerRadius: TOUCH_JOYSTICK_OUTER_RADIUS,
                    innerRadius: TOUCH_JOYSTICK_INNER_RADIUS,
                    maxDistance: TOUCH_JOYSTICK_MAX_DISTANCE,
                    deadZone: TOUCH_JOYSTICK_DEAD_ZONE
                },
                fireButton: {
                    x: TOUCH_FIRE_P1_SINGLE_X,
                    y: TOUCH_FIRE_P1_SINGLE_Y,
                    radius: TOUCH_FIRE_BUTTON_RADIUS
                }
            },
            dualPlayer: {
                player1: {
                    joystick: {
                        x: TOUCH_JOYSTICK_P1_DUAL_X,
                        y: TOUCH_JOYSTICK_P1_DUAL_Y,
                        outerRadius: TOUCH_JOYSTICK_OUTER_RADIUS,
                        innerRadius: TOUCH_JOYSTICK_INNER_RADIUS,
                        maxDistance: TOUCH_JOYSTICK_MAX_DISTANCE,
                        deadZone: TOUCH_JOYSTICK_DEAD_ZONE
                    },
                    fireButton: {
                        x: TOUCH_FIRE_P1_DUAL_X,
                        y: TOUCH_FIRE_P1_DUAL_Y,
                        radius: TOUCH_FIRE_BUTTON_RADIUS
                    }
                },
                player2: {
                    joystick: {
                        x: TOUCH_JOYSTICK_P2_DUAL_X,
                        y: TOUCH_JOYSTICK_P2_DUAL_Y,
                        outerRadius: TOUCH_JOYSTICK_OUTER_RADIUS,
                        innerRadius: TOUCH_JOYSTICK_INNER_RADIUS,
                        maxDistance: TOUCH_JOYSTICK_MAX_DISTANCE,
                        deadZone: TOUCH_JOYSTICK_DEAD_ZONE
                    },
                    fireButton: {
                        x: TOUCH_FIRE_P2_DUAL_X,
                        y: TOUCH_FIRE_P2_DUAL_Y,
                        radius: TOUCH_FIRE_BUTTON_RADIUS
                    }
                }
            }
        };
    }

    // 从 localStorage 加载配置
    static load() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (!saved) return this.getDefault();

            const config = JSON.parse(saved);
            
            // 版本检查和迁移
            if (!config.version || config.version < this.VERSION) {
                return this.migrate(config);
            }

            // 验证配置
            if (this.validate(config)) {
                return config;
            } else {
                console.warn('[ControlsSettings] Invalid config, using default');
                return this.getDefault();
            }
        } catch (e) {
            console.error('[ControlsSettings] Failed to load config:', e);
            return this.getDefault();
        }
    }

    // 保存配置到 localStorage
    static save(config) {
        try {
            config.version = this.VERSION;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
            return true;
        } catch (e) {
            console.error('[ControlsSettings] Failed to save config:', e);
            return false;
        }
    }

    // 重置为默认配置
    static reset() {
        const defaultConfig = this.getDefault();
        this.save(defaultConfig);
        return defaultConfig;
    }

    // 验证配置有效性
    static validate(config) {
        if (!config || typeof config !== 'object') return false;

        // 验证单人模式配置
        if (!this.validatePlayerConfig(config.singlePlayer)) return false;

        // 验证双人模式配置
        if (!config.dualPlayer || typeof config.dualPlayer !== 'object') return false;
        if (!this.validatePlayerConfig(config.dualPlayer.player1)) return false;
        if (!this.validatePlayerConfig(config.dualPlayer.player2)) return false;

        return true;
    }

    // 验证单个玩家配置
    static validatePlayerConfig(playerConfig) {
        if (!playerConfig || typeof playerConfig !== 'object') return false;

        // 验证摇杆配置
        const j = playerConfig.joystick;
        if (!j || typeof j !== 'object') return false;
        if (typeof j.x !== 'number' || typeof j.y !== 'number') return false;
        if (typeof j.outerRadius !== 'number' || typeof j.innerRadius !== 'number') return false;
        if (typeof j.maxDistance !== 'number' || typeof j.deadZone !== 'number') return false;

        // 验证开火按钮配置
        const f = playerConfig.fireButton;
        if (!f || typeof f !== 'object') return false;
        if (typeof f.x !== 'number' || typeof f.y !== 'number') return false;
        if (typeof f.radius !== 'number') return false;

        return true;
    }

    // 迁移旧版本配置
    static migrate(oldConfig) {
        console.log('[ControlsSettings] Migrating config to version', this.VERSION);
        const defaultConfig = this.getDefault();
        
        // 简单策略：合并旧配置和默认配置
        return {
            ...defaultConfig,
            ...oldConfig,
            version: this.VERSION
        };
    }

    // 应用配置到 InputManager
    static applyToInput(input, config, playerCount) {
        if (!input || !config) return;

        const mode = playerCount === 1 ? 'singlePlayer' : 'dualPlayer';
        
        if (mode === 'singlePlayer') {
            const cfg = config.singlePlayer;
            this.applyJoystickConfig(input.joysticks[0], cfg.joystick);
            this.applyFireButtonConfig(input.fireButtons[0], cfg.fireButton);
        } else {
            const cfg = config.dualPlayer;
            this.applyJoystickConfig(input.joysticks[0], cfg.player1.joystick);
            this.applyFireButtonConfig(input.fireButtons[0], cfg.player1.fireButton);
            this.applyJoystickConfig(input.joysticks[1], cfg.player2.joystick);
            this.applyFireButtonConfig(input.fireButtons[1], cfg.player2.fireButton);
        }
    }

    // 应用摇杆配置
    static applyJoystickConfig(joystick, config) {
        joystick.centerX = config.x;
        joystick.centerY = config.y;
        joystick.currentX = config.x;
        joystick.currentY = config.y;
        joystick.outerRadius = config.outerRadius;
        joystick.innerRadius = config.innerRadius;
        joystick.maxDistance = config.maxDistance;
        joystick.deadZone = config.deadZone;
    }

    // 应用开火按钮配置
    static applyFireButtonConfig(fireButton, config) {
        fireButton.centerX = config.x;
        fireButton.centerY = config.y;
        fireButton.radius = config.radius;
    }

    // 不限制位置，允许放在画布任何地方
    static clampPosition(x, y, radius) {
        return { x, y };
    }

    // 限制参数在有效范围内
    static clampJoystickRadius(value) {
        return Math.max(JOYSTICK_OUTER_RADIUS_MIN, Math.min(JOYSTICK_OUTER_RADIUS_MAX, value));
    }

    static clampDeadZone(value) {
        return Math.max(JOYSTICK_DEAD_ZONE_MIN, Math.min(JOYSTICK_DEAD_ZONE_MAX, value));
    }

    static clampFireButtonRadius(value) {
        return Math.max(FIRE_BUTTON_RADIUS_MIN, Math.min(FIRE_BUTTON_RADIUS_MAX, value));
    }
}
