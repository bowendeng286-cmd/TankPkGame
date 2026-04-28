// ===== Touch control settings =====
class ControlsSettings {
    static STORAGE_KEY = 'tankgame_controls';
    static VERSION = 4;

    static getDefault(surfaceWidth, surfaceHeight) {
        const width = this._resolveWidth(surfaceWidth);
        const height = this._resolveHeight(surfaceHeight);
        return this._buildAbsoluteConfig(width, height);
    }

    static load(surfaceWidth, surfaceHeight) {
        const width = this._resolveWidth(surfaceWidth);
        const height = this._resolveHeight(surfaceHeight);

        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (!saved) return this.getDefault(width, height);

            const raw = JSON.parse(saved);
            let config;

            if (!raw.version || raw.version < this.VERSION) {
                config = this.migrate(raw, width, height);
                this.save(config, width, height);
            } else {
                config = this._fromStoredConfig(raw, width, height);
            }

            if (this.validate(config)) {
                return config;
            }

            console.warn('[ControlsSettings] Invalid config, using default');
            return this.getDefault(width, height);
        } catch (e) {
            console.error('[ControlsSettings] Failed to load config:', e);
            return this.getDefault(width, height);
        }
    }

    static save(config, surfaceWidth, surfaceHeight) {
        try {
            if (!this.validate(config)) {
                console.warn('[ControlsSettings] Refusing to save invalid config');
                return false;
            }

            const stored = this._toStoredConfig(config);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
            return true;
        } catch (e) {
            console.error('[ControlsSettings] Failed to save config:', e);
            return false;
        }
    }

    static reset(surfaceWidth, surfaceHeight) {
        const defaultConfig = this.getDefault(surfaceWidth, surfaceHeight);
        this.save(defaultConfig, surfaceWidth, surfaceHeight);
        return defaultConfig;
    }

    static validate(config) {
        if (!config || typeof config !== 'object') return false;
        if (!this.validatePlayerConfig(config.singlePlayer)) return false;
        if (!config.dualPlayer || typeof config.dualPlayer !== 'object') return false;
        if (!this.validatePlayerConfig(config.dualPlayer.player1)) return false;
        if (!this.validatePlayerConfig(config.dualPlayer.player2)) return false;
        return true;
    }

    static validatePlayerConfig(playerConfig) {
        if (!playerConfig || typeof playerConfig !== 'object') return false;

        const joystick = playerConfig.joystick;
        if (!joystick || typeof joystick !== 'object') return false;
        if (!Number.isFinite(joystick.x) || !Number.isFinite(joystick.y)) return false;
        if (!Number.isFinite(joystick.outerRadius) || !Number.isFinite(joystick.innerRadius)) return false;
        if (!Number.isFinite(joystick.maxDistance) || !Number.isFinite(joystick.deadZone)) return false;

        const fireButton = playerConfig.fireButton;
        if (!fireButton || typeof fireButton !== 'object') return false;
        if (!Number.isFinite(fireButton.x) || !Number.isFinite(fireButton.y)) return false;
        if (!Number.isFinite(fireButton.radius)) return false;

        return true;
    }

    static migrate(oldConfig, surfaceWidth, surfaceHeight) {
        console.log('[ControlsSettings] Migrating config to version', this.VERSION);
        const legacyWidth = getCanvasWidthForCols(BASE_COLS);
        const legacyHeight = getCanvasHeightForRows(BASE_ROWS);
        const legacyDefaults = this._buildAbsoluteConfig(legacyWidth, legacyHeight);

        const legacyRuntimeConfig = {
            version: this.VERSION,
            singlePlayer: {
                joystick: this._migrateJoystickConfig(
                    oldConfig && oldConfig.singlePlayer ? oldConfig.singlePlayer.joystick : null,
                    legacyDefaults.singlePlayer.joystick,
                    legacyWidth,
                    legacyHeight
                ),
                fireButton: this._migrateFireButtonConfig(
                    oldConfig && oldConfig.singlePlayer ? oldConfig.singlePlayer.fireButton : null,
                    legacyDefaults.singlePlayer.fireButton,
                    legacyWidth,
                    legacyHeight
                ),
            },
            dualPlayer: {
                player1: {
                    joystick: this._migrateJoystickConfig(
                        oldConfig && oldConfig.dualPlayer && oldConfig.dualPlayer.player1 ? oldConfig.dualPlayer.player1.joystick : null,
                        legacyDefaults.dualPlayer.player1.joystick,
                        legacyWidth,
                        legacyHeight
                    ),
                    fireButton: this._migrateFireButtonConfig(
                        oldConfig && oldConfig.dualPlayer && oldConfig.dualPlayer.player1 ? oldConfig.dualPlayer.player1.fireButton : null,
                        legacyDefaults.dualPlayer.player1.fireButton,
                        legacyWidth,
                        legacyHeight
                    ),
                },
                player2: {
                    joystick: this._migrateJoystickConfig(
                        oldConfig && oldConfig.dualPlayer && oldConfig.dualPlayer.player2 ? oldConfig.dualPlayer.player2.joystick : null,
                        legacyDefaults.dualPlayer.player2.joystick,
                        legacyWidth,
                        legacyHeight
                    ),
                    fireButton: this._migrateFireButtonConfig(
                        oldConfig && oldConfig.dualPlayer && oldConfig.dualPlayer.player2 ? oldConfig.dualPlayer.player2.fireButton : null,
                        legacyDefaults.dualPlayer.player2.fireButton,
                        legacyWidth,
                        legacyHeight
                    ),
                }
            }
        };

        const stored = this._toStoredConfig(legacyRuntimeConfig);
        return this._fromStoredConfig(
            stored,
            this._resolveWidth(surfaceWidth),
            this._resolveHeight(surfaceHeight)
        );
    }

    static applyToInput(input, config, playerCount) {
        if (!input) return;

        const runtimeConfig = this.validate(config) ? config : this.getDefault();

        if (playerCount === 1) {
            this.applyJoystickConfig(input.joysticks[0], runtimeConfig.singlePlayer.joystick);
            this.applyFireButtonConfig(input.fireButtons[0], runtimeConfig.singlePlayer.fireButton);
            return;
        }

        this.applyJoystickConfig(input.joysticks[0], runtimeConfig.dualPlayer.player1.joystick);
        this.applyFireButtonConfig(input.fireButtons[0], runtimeConfig.dualPlayer.player1.fireButton);
        this.applyJoystickConfig(input.joysticks[1], runtimeConfig.dualPlayer.player2.joystick);
        this.applyFireButtonConfig(input.fireButtons[1], runtimeConfig.dualPlayer.player2.fireButton);
    }

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

    static applyFireButtonConfig(fireButton, config) {
        fireButton.centerX = config.x;
        fireButton.centerY = config.y;
        fireButton.radius = config.radius;
    }

    static clampPosition(x, y, radius, maxWidth, maxHeight) {
        const width = this._resolveWidth(maxWidth);
        const height = this._resolveHeight(maxHeight);
        const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
        const maxX = Math.max(safeRadius, width - safeRadius);
        const maxY = Math.max(safeRadius, height - safeRadius);
        return {
            x: clamp(x, safeRadius, maxX),
            y: clamp(y, safeRadius, maxY)
        };
    }

    static clampJoystickRadius(value) {
        return Math.max(JOYSTICK_OUTER_RADIUS_MIN, Math.min(JOYSTICK_OUTER_RADIUS_MAX, value));
    }

    static clampDeadZone(value) {
        return Math.max(JOYSTICK_DEAD_ZONE_MIN, Math.min(JOYSTICK_DEAD_ZONE_MAX, value));
    }

    static clampFireButtonRadius(value) {
        return Math.max(FIRE_BUTTON_RADIUS_MIN, Math.min(FIRE_BUTTON_RADIUS_MAX, value));
    }

    static _buildAbsoluteConfig(canvasWidth, canvasHeight) {
        const layout = getTouchLayoutDefaults(canvasWidth, canvasHeight);
        return {
            version: this.VERSION,
            singlePlayer: {
                joystick: {
                    x: layout.singlePlayer.joystick.x,
                    y: layout.singlePlayer.joystick.y,
                    outerRadius: TOUCH_JOYSTICK_OUTER_RADIUS,
                    innerRadius: TOUCH_JOYSTICK_INNER_RADIUS,
                    maxDistance: TOUCH_JOYSTICK_MAX_DISTANCE,
                    deadZone: TOUCH_JOYSTICK_DEAD_ZONE
                },
                fireButton: {
                    x: layout.singlePlayer.fireButton.x,
                    y: layout.singlePlayer.fireButton.y,
                    radius: TOUCH_FIRE_BUTTON_RADIUS
                }
            },
            dualPlayer: {
                player1: {
                    joystick: {
                        x: layout.dualPlayer.player1.joystick.x,
                        y: layout.dualPlayer.player1.joystick.y,
                        outerRadius: TOUCH_JOYSTICK_OUTER_RADIUS,
                        innerRadius: TOUCH_JOYSTICK_INNER_RADIUS,
                        maxDistance: TOUCH_JOYSTICK_MAX_DISTANCE,
                        deadZone: TOUCH_JOYSTICK_DEAD_ZONE
                    },
                    fireButton: {
                        x: layout.dualPlayer.player1.fireButton.x,
                        y: layout.dualPlayer.player1.fireButton.y,
                        radius: TOUCH_FIRE_BUTTON_RADIUS
                    }
                },
                player2: {
                    joystick: {
                        x: layout.dualPlayer.player2.joystick.x,
                        y: layout.dualPlayer.player2.joystick.y,
                        outerRadius: TOUCH_JOYSTICK_OUTER_RADIUS,
                        innerRadius: TOUCH_JOYSTICK_INNER_RADIUS,
                        maxDistance: TOUCH_JOYSTICK_MAX_DISTANCE,
                        deadZone: TOUCH_JOYSTICK_DEAD_ZONE
                    },
                    fireButton: {
                        x: layout.dualPlayer.player2.fireButton.x,
                        y: layout.dualPlayer.player2.fireButton.y,
                        radius: TOUCH_FIRE_BUTTON_RADIUS
                    }
                }
            }
        };
    }

    static _toStoredConfig(config) {
        return {
            version: this.VERSION,
            singlePlayer: {
                joystick: this._encodeJoystick(config.singlePlayer.joystick),
                fireButton: this._encodeFireButton(config.singlePlayer.fireButton)
            },
            dualPlayer: {
                player1: {
                    joystick: this._encodeJoystick(config.dualPlayer.player1.joystick),
                    fireButton: this._encodeFireButton(config.dualPlayer.player1.fireButton)
                },
                player2: {
                    joystick: this._encodeJoystick(config.dualPlayer.player2.joystick),
                    fireButton: this._encodeFireButton(config.dualPlayer.player2.fireButton)
                }
            }
        };
    }

    static _fromStoredConfig(storedConfig, canvasWidth, canvasHeight) {
        const defaults = this._buildAbsoluteConfig(canvasWidth, canvasHeight);
        return {
            version: this.VERSION,
            singlePlayer: {
                joystick: this._decodeJoystick(storedConfig && storedConfig.singlePlayer ? storedConfig.singlePlayer.joystick : null, defaults.singlePlayer.joystick, canvasWidth, canvasHeight),
                fireButton: this._decodeFireButton(storedConfig && storedConfig.singlePlayer ? storedConfig.singlePlayer.fireButton : null, defaults.singlePlayer.fireButton, canvasWidth, canvasHeight)
            },
            dualPlayer: {
                player1: {
                    joystick: this._decodeJoystick(storedConfig && storedConfig.dualPlayer && storedConfig.dualPlayer.player1 ? storedConfig.dualPlayer.player1.joystick : null, defaults.dualPlayer.player1.joystick, canvasWidth, canvasHeight),
                    fireButton: this._decodeFireButton(storedConfig && storedConfig.dualPlayer && storedConfig.dualPlayer.player1 ? storedConfig.dualPlayer.player1.fireButton : null, defaults.dualPlayer.player1.fireButton, canvasWidth, canvasHeight)
                },
                player2: {
                    joystick: this._decodeJoystick(storedConfig && storedConfig.dualPlayer && storedConfig.dualPlayer.player2 ? storedConfig.dualPlayer.player2.joystick : null, defaults.dualPlayer.player2.joystick, canvasWidth, canvasHeight),
                    fireButton: this._decodeFireButton(storedConfig && storedConfig.dualPlayer && storedConfig.dualPlayer.player2 ? storedConfig.dualPlayer.player2.fireButton : null, defaults.dualPlayer.player2.fireButton, canvasWidth, canvasHeight)
                }
            }
        };
    }

    static _encodeJoystick(config) {
        return {
            x: config.x,
            y: config.y,
            outerRadius: config.outerRadius,
            innerRadius: config.innerRadius,
            maxDistance: config.maxDistance,
            deadZone: config.deadZone
        };
    }

    static _encodeFireButton(config) {
        return {
            x: config.x,
            y: config.y,
            radius: config.radius
        };
    }

    static _decodeJoystick(config, fallback, canvasWidth, canvasHeight) {
        if (config && Number.isFinite(config.x) && Number.isFinite(config.y)) {
            return {
                x: this._coerceNumber(config.x, fallback.x),
                y: this._coerceNumber(config.y, fallback.y),
                outerRadius: this._coerceNumber(config.outerRadius, fallback.outerRadius),
                innerRadius: this._coerceNumber(config.innerRadius, fallback.innerRadius),
                maxDistance: this._coerceNumber(config.maxDistance, fallback.maxDistance),
                deadZone: this._coerceNumber(config.deadZone, fallback.deadZone),
            };
        }

        return {
            x: this._fromRatio(config ? config.xRatio : null, canvasWidth, fallback.x),
            y: this._fromRatio(config ? config.yRatio : null, canvasHeight, fallback.y),
            outerRadius: this._coerceNumber(config ? config.outerRadius : null, fallback.outerRadius),
            innerRadius: this._coerceNumber(config ? config.innerRadius : null, fallback.innerRadius),
            maxDistance: this._coerceNumber(config ? config.maxDistance : null, fallback.maxDistance),
            deadZone: this._coerceNumber(config ? config.deadZone : null, fallback.deadZone),
        };
    }

    static _decodeFireButton(config, fallback, canvasWidth, canvasHeight) {
        if (config && Number.isFinite(config.x) && Number.isFinite(config.y)) {
            return {
                x: this._coerceNumber(config.x, fallback.x),
                y: this._coerceNumber(config.y, fallback.y),
                radius: this._coerceNumber(config.radius, fallback.radius),
            };
        }

        return {
            x: this._fromRatio(config ? config.xRatio : null, canvasWidth, fallback.x),
            y: this._fromRatio(config ? config.yRatio : null, canvasHeight, fallback.y),
            radius: this._coerceNumber(config ? config.radius : null, fallback.radius),
        };
    }

    static _mergeJoystickAbsolute(source, fallback) {
        return {
            x: this._coerceNumber(source ? source.x : null, fallback.x),
            y: this._coerceNumber(source ? source.y : null, fallback.y),
            outerRadius: this._coerceNumber(source ? source.outerRadius : null, fallback.outerRadius),
            innerRadius: this._coerceNumber(source ? source.innerRadius : null, fallback.innerRadius),
            maxDistance: this._coerceNumber(source ? source.maxDistance : null, fallback.maxDistance),
            deadZone: this._coerceNumber(source ? source.deadZone : null, fallback.deadZone),
        };
    }

    static _mergeFireButtonAbsolute(source, fallback) {
        return {
            x: this._coerceNumber(source ? source.x : null, fallback.x),
            y: this._coerceNumber(source ? source.y : null, fallback.y),
            radius: this._coerceNumber(source ? source.radius : null, fallback.radius),
        };
    }

    static _migrateJoystickConfig(source, fallback, legacyWidth, legacyHeight) {
        if (source && (Number.isFinite(source.xRatio) || Number.isFinite(source.yRatio))) {
            return {
                x: this._fromRatio(source.xRatio, legacyWidth, fallback.x),
                y: this._fromRatio(source.yRatio, legacyHeight, fallback.y),
                outerRadius: this._coerceNumber(source.outerRadius, fallback.outerRadius),
                innerRadius: this._coerceNumber(source.innerRadius, fallback.innerRadius),
                maxDistance: this._coerceNumber(source.maxDistance, fallback.maxDistance),
                deadZone: this._coerceNumber(source.deadZone, fallback.deadZone),
            };
        }

        return this._mergeJoystickAbsolute(source, fallback);
    }

    static _migrateFireButtonConfig(source, fallback, legacyWidth, legacyHeight) {
        if (source && (Number.isFinite(source.xRatio) || Number.isFinite(source.yRatio))) {
            return {
                x: this._fromRatio(source.xRatio, legacyWidth, fallback.x),
                y: this._fromRatio(source.yRatio, legacyHeight, fallback.y),
                radius: this._coerceNumber(source.radius, fallback.radius),
            };
        }

        return this._mergeFireButtonAbsolute(source, fallback);
    }

    static _toRatio(value, size) {
        if (!Number.isFinite(value) || !Number.isFinite(size) || size === 0) return 0;
        return value / size;
    }

    static _fromRatio(ratio, size, fallback) {
        if (!Number.isFinite(ratio) || !Number.isFinite(size)) return fallback;
        return ratio * size;
    }

    static _coerceNumber(value, fallback) {
        return Number.isFinite(value) ? value : fallback;
    }

    static _resolveWidth(width) {
        return Number.isFinite(width) && width > 0 ? width : getTouchReferenceWidth();
    }

    static _resolveHeight(height) {
        return Number.isFinite(height) && height > 0 ? height : getTouchReferenceHeight();
    }
}
