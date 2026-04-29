const UI_MODE_STORAGE_KEY = 'tankgame_ui_mode';

class InputManager {
    constructor() {
        this.keys = new Set();
        // 鼠标状态（canvas 逻辑坐标）
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
        this._canvas = null;

        // 触摸控制状态 - 设备能力与界面模式分离
        const hasOntouchstart = 'ontouchstart' in window;
        const hasMaxTouchPoints = navigator.maxTouchPoints > 0;
        const isTouchCapable = hasOntouchstart || hasMaxTouchPoints;
        
        // 用户代理检测（最可靠的方法）
        const ua = navigator.userAgent.toLowerCase();
        const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
        
        // 屏幕尺寸检测（移动设备通常宽度较小）
        const isMobileScreen = window.innerWidth <= 768;
        
        // 检测是否为桌面浏览器
        const isDesktopUA = /windows nt|macintosh|linux x86_64/i.test(ua) && !isMobileUA;

        this.isTouchCapable = isTouchCapable;
        this.isMobileDevice = isMobileUA || (!isDesktopUA && isMobileScreen && isTouchCapable);
        this.isDesktopLike = isDesktopUA;

        if (isMobileUA) {
            this.deviceProfile = 'mobile';
        } else if (isDesktopUA && isTouchCapable) {
            this.deviceProfile = 'touch-desktop';
        } else if (isDesktopUA) {
            this.deviceProfile = 'desktop';
        } else if (isMobileScreen && isTouchCapable) {
            this.deviceProfile = 'mobile';
        } else if (isTouchCapable) {
            this.deviceProfile = 'touch-desktop';
        } else {
            this.deviceProfile = 'desktop';
        }

        this.canUseTouchUi = this.deviceProfile === 'mobile' || this.deviceProfile === 'touch-desktop';
        this.canSwitchUiMode = this.deviceProfile === 'touch-desktop';
        this.uiMode = this._resolveInitialUiMode();
        this.isTouchDevice = this.uiMode === 'touch';
        this.touchEnabled = this.isTouchDevice;
        this._touchEventsBound = false;

        // 屏幕点击状态（用于游戏结束等场景）
        this.screenTapped = false;


        // 双玩家摇杆状态（位置动态设置）
        this.joysticks = [
            {
                active: false,
                touchId: null,
                centerX: TOUCH_JOYSTICK_P1_SINGLE_X,  // 默认单人模式位置
                centerY: TOUCH_JOYSTICK_P1_SINGLE_Y,
                currentX: 0,
                currentY: 0,
                angle: 0,
                distance: 0,
                strength: 0,
                // 可配置参数
                outerRadius: TOUCH_JOYSTICK_OUTER_RADIUS,
                innerRadius: TOUCH_JOYSTICK_INNER_RADIUS,
                maxDistance: TOUCH_JOYSTICK_MAX_DISTANCE,
                deadZone: TOUCH_JOYSTICK_DEAD_ZONE
            },
            {
                active: false,
                touchId: null,
                centerX: TOUCH_JOYSTICK_P2_DUAL_X,    // 默认双人模式位置
                centerY: TOUCH_JOYSTICK_P2_DUAL_Y,
                currentX: 0,
                currentY: 0,
                angle: 0,
                distance: 0,
                strength: 0,
                // 可配置参数
                outerRadius: TOUCH_JOYSTICK_OUTER_RADIUS,
                innerRadius: TOUCH_JOYSTICK_INNER_RADIUS,
                maxDistance: TOUCH_JOYSTICK_MAX_DISTANCE,
                deadZone: TOUCH_JOYSTICK_DEAD_ZONE
            }
        ];

        // 双玩家开火按钮状态
        this.fireButtons = [
            { active: false, touchId: null, centerX: TOUCH_FIRE_P1_SINGLE_X, centerY: TOUCH_FIRE_P1_SINGLE_Y, radius: TOUCH_FIRE_BUTTON_RADIUS },
            { active: false, touchId: null, centerX: TOUCH_FIRE_P2_DUAL_X, centerY: TOUCH_FIRE_P2_DUAL_Y, radius: TOUCH_FIRE_BUTTON_RADIUS }
        ];

        // 当前玩家数量（用于动态布局）
        this.playerCount = 1;
        this.touchJoystickHitPadding = 36;
        this.touchFireHitPadding = 34;


        this._onDown = (e) => {
            this.keys.add(e.code);
            // 阻止游戏按键的默认行为
            if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code.startsWith('Numpad')) {
                e.preventDefault();
            }
        };
        this._onUp   = (e) => { this.keys.delete(e.code); };
        window.addEventListener('keydown', this._onDown);
        window.addEventListener('keyup', this._onUp);

        // 鼠标事件
        this._onMouseMove = (e) => { this._updateMousePos(e); };
        this._onMouseDown = (e) => { if (e.button === 0) this.mouseDown = true; };
        this._onMouseUp   = (e) => { if (e.button === 0) this.mouseDown = false; };
        this._onContextMenu = (e) => { e.preventDefault(); };

        // 触摸事件
        this._onTouchStart = (e) => { this._handleTouchStart(e); };
        this._onTouchMove = (e) => { this._handleTouchMove(e); };
        this._onTouchEnd = (e) => { this._handleTouchEnd(e); };
        this._onTouchCancel = (e) => { this._handleTouchEnd(e); };
    }

    _resolveInitialUiMode() {
        if (this.deviceProfile === 'mobile') return 'touch';
        if (this.deviceProfile === 'desktop') return 'desktop';

        try {
            const saved = localStorage.getItem(UI_MODE_STORAGE_KEY);
            if (saved === 'touch' || saved === 'desktop') {
                return saved;
            }
        } catch (e) {
            console.warn('[InputManager] Failed to load UI mode:', e);
        }

        return 'touch';
    }

    _saveUiMode(mode) {
        if (!this.canSwitchUiMode) return;
        try {
            localStorage.setItem(UI_MODE_STORAGE_KEY, mode);
        } catch (e) {
            console.warn('[InputManager] Failed to save UI mode:', e);
        }
    }

    _bindTouchEvents() {
        if (!this._canvas || this._touchEventsBound) return;
        this._canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
        this._canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
        this._canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
        this._canvas.addEventListener('touchcancel', this._onTouchCancel, { passive: false });
        this._touchEventsBound = true;
    }

    _unbindTouchEvents() {
        if (!this._canvas || !this._touchEventsBound) return;
        this._canvas.removeEventListener('touchstart', this._onTouchStart);
        this._canvas.removeEventListener('touchmove', this._onTouchMove);
        this._canvas.removeEventListener('touchend', this._onTouchEnd);
        this._canvas.removeEventListener('touchcancel', this._onTouchCancel);
        this._touchEventsBound = false;
        this._resetTouchState();
    }

    refreshTouchBindings() {
        if (this.touchEnabled) this._bindTouchEvents();
        else this._unbindTouchEvents();
    }

    setUiMode(mode) {
        let nextMode = mode === 'desktop' ? 'desktop' : 'touch';

        if (this.deviceProfile === 'mobile') nextMode = 'touch';
        if (this.deviceProfile === 'desktop') nextMode = 'desktop';

        const changed = this.uiMode !== nextMode;
        this.uiMode = nextMode;
        this.isTouchDevice = this.uiMode === 'touch';
        this.touchEnabled = this.isTouchDevice;

        if (this.canSwitchUiMode) {
            this._saveUiMode(this.uiMode);
        }

        this.refreshTouchBindings();
        return changed;
    }

    // 绑定 canvas 以启用鼠标和触摸坐标转换
    bindCanvas(cvs) {
        this._canvas = cvs;
        cvs.addEventListener('mousemove', this._onMouseMove);
        cvs.addEventListener('mousedown', this._onMouseDown);
        cvs.addEventListener('mouseup', this._onMouseUp);
        cvs.addEventListener('contextmenu', this._onContextMenu);

        this.refreshTouchBindings();
    }

    // 根据玩家数量更新控制器布局
    updateLayout(playerCount) {
        this.playerCount = playerCount;
        const layoutWidth = this._canvas ? this._canvas.width : getTouchReferenceWidth();
        const layoutHeight = this._canvas ? this._canvas.height : getTouchReferenceHeight();
        
        // 从配置加载
        if (typeof ControlsSettings !== 'undefined') {
            const config = ControlsSettings.load(layoutWidth, layoutHeight);
            ControlsSettings.applyToInput(this, config, playerCount);
        } else {
            // 降级：使用默认值
            const layout = getTouchLayoutDefaults(layoutWidth, layoutHeight);
            if (playerCount === 1) {
                // 单人模式：左下+右下
                this.joysticks[0].centerX = layout.singlePlayer.joystick.x;
                this.joysticks[0].centerY = layout.singlePlayer.joystick.y;
                this.joysticks[0].currentX = layout.singlePlayer.joystick.x;
                this.joysticks[0].currentY = layout.singlePlayer.joystick.y;
                
                this.fireButtons[0].centerX = layout.singlePlayer.fireButton.x;
                this.fireButtons[0].centerY = layout.singlePlayer.fireButton.y;
            } else {
                // 双人模式：四角布局
                // P1: 左上摇杆 + 左下开火
                this.joysticks[0].centerX = layout.dualPlayer.player1.joystick.x;
                this.joysticks[0].centerY = layout.dualPlayer.player1.joystick.y;
                this.joysticks[0].currentX = layout.dualPlayer.player1.joystick.x;
                this.joysticks[0].currentY = layout.dualPlayer.player1.joystick.y;
                
                this.fireButtons[0].centerX = layout.dualPlayer.player1.fireButton.x;
                this.fireButtons[0].centerY = layout.dualPlayer.player1.fireButton.y;
                
                // P2: 右上摇杆 + 右下开火
                this.joysticks[1].centerX = layout.dualPlayer.player2.joystick.x;
                this.joysticks[1].centerY = layout.dualPlayer.player2.joystick.y;
                this.joysticks[1].currentX = layout.dualPlayer.player2.joystick.x;
                this.joysticks[1].currentY = layout.dualPlayer.player2.joystick.y;
                
                this.fireButtons[1].centerX = layout.dualPlayer.player2.fireButton.x;
                this.fireButtons[1].centerY = layout.dualPlayer.player2.fireButton.y;
            }
        }
    }

    _updateMousePos(e) {
        if (!this._canvas) return;
        const rect = this._canvas.getBoundingClientRect();
        // 屏幕坐标 -> Canvas坐标 -> 游戏坐标
        const canvasX = (e.clientX - rect.left) * (this._canvas.width / rect.width);
        const canvasY = (e.clientY - rect.top) * (this._canvas.height / rect.height);
        this.mouseX = (canvasX - VIEWPORT_OFFSET_X) / VIEWPORT_SCALE;
        this.mouseY = (canvasY - VIEWPORT_OFFSET_Y) / VIEWPORT_SCALE;
    }

    _touchToCanvasPixels(touch) {
        if (!this._canvas) return { x: 0, y: 0 };
        const rect = this._canvas.getBoundingClientRect();
        return {
            x: (touch.clientX - rect.left) * (this._canvas.width / rect.width),
            y: (touch.clientY - rect.top) * (this._canvas.height / rect.height)
        };
    }

    // 触摸坐标转换为 canvas 逻辑坐标
    _touchToCanvasCoords(touch) {
        const canvasPos = this._touchToCanvasPixels(touch);
        const x = (canvasPos.x - VIEWPORT_OFFSET_X) / VIEWPORT_SCALE;
        const y = (canvasPos.y - VIEWPORT_OFFSET_Y) / VIEWPORT_SCALE;
        return { x, y };
    }

    // 辅助方法：计算两点距离
    _distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // 判断触摸点属于哪个玩家的控制器（游戏界面）
    _getTouchController(x, y) {
        // 检查P1摇杆区域
        if (this._distance(x, y, this.joysticks[0].centerX, this.joysticks[0].centerY) < this.joysticks[0].outerRadius + this.touchJoystickHitPadding) {
            return { player: 0, type: 'joystick' };
        }
        // 检查P1开火按钮区域
        if (this._distance(x, y, this.fireButtons[0].centerX, this.fireButtons[0].centerY) < this.fireButtons[0].radius + this.touchFireHitPadding) {
            return { player: 0, type: 'fire' };
        }
        
        // 双人模式才检查P2
        if (this.playerCount >= 2) {
            // 检查P2摇杆区域
            if (this._distance(x, y, this.joysticks[1].centerX, this.joysticks[1].centerY) < this.joysticks[1].outerRadius + this.touchJoystickHitPadding) {
                return { player: 1, type: 'joystick' };
            }
            // 检查P2开火按钮区域
            if (this._distance(x, y, this.fireButtons[1].centerX, this.fireButtons[1].centerY) < this.fireButtons[1].radius + this.touchFireHitPadding) {
                return { player: 1, type: 'fire' };
            }
        }
        
        return null;
    }


    // 处理触摸开始
    _handleTouchStart(e) {
        if (!this.touchEnabled) return;
        e.preventDefault();

        // 标记屏幕被点击（用于游戏结束等场景）
        this.screenTapped = true;

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const pos = this._touchToCanvasPixels(touch);

            // 检查游戏控制器
            const controller = this._getTouchController(pos.x, pos.y);
            if (controller) {
                if (controller.type === 'joystick') {
                    const joystick = this.joysticks[controller.player];
                    if (!joystick.active) {
                        joystick.active = true;
                        joystick.touchId = touch.identifier;
                        joystick.currentX = joystick.centerX;
                        joystick.currentY = joystick.centerY;
                        joystick.angle = 0;
                        joystick.distance = 0;
                        joystick.strength = 0;
                    }
                } else if (controller.type === 'fire') {
                    const fireBtn = this.fireButtons[controller.player];
                    if (!fireBtn.active) {
                        fireBtn.active = true;
                        fireBtn.touchId = touch.identifier;
                    }
                }
            }
        }
    }

    // 处理触摸移动
    _handleTouchMove(e) {
        if (!this.touchEnabled) return;
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const pos = this._touchToCanvasPixels(touch);

            // 更新摇杆
            for (let p = 0; p < 2; p++) {
                if (this.joysticks[p].active && touch.identifier === this.joysticks[p].touchId) {
                    this._updateJoystick(p, pos.x, pos.y);
                }
            }
        }
    }

    // 处理触摸结束
    _handleTouchEnd(e) {
        if (!this.touchEnabled) return;
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            // 清除摇杆
            for (let p = 0; p < 2; p++) {
                if (this.joysticks[p].active && touch.identifier === this.joysticks[p].touchId) {
                    this.joysticks[p].active = false;
                    this.joysticks[p].touchId = null;
                    this.joysticks[p].currentX = this.joysticks[p].centerX;
                    this.joysticks[p].currentY = this.joysticks[p].centerY;
                    this.joysticks[p].distance = 0;
                    this.joysticks[p].strength = 0;
                }
            }

            // 清除开火按钮
            for (let p = 0; p < 2; p++) {
                if (this.fireButtons[p].active && touch.identifier === this.fireButtons[p].touchId) {
                    this.fireButtons[p].active = false;
                    this.fireButtons[p].touchId = null;
                }
            }

        }
    }

    // 更新固定摇杆状态
    _updateJoystick(playerIndex, currentX, currentY) {
        const joystick = this.joysticks[playerIndex];
        const dx = currentX - joystick.centerX;
        const dy = currentY - joystick.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 始终更新角度（用于旋转）
        joystick.angle = Math.atan2(dy, dx);

        // 限制最大距离（先计算，死区内外都需要）
        const clampedDistance = Math.min(distance, joystick.maxDistance);
        const ratio = distance > 0 ? (clampedDistance / distance) : 0;

        // 转子位置始终跟随手指（去除吸附）
        joystick.currentX = joystick.centerX + dx * ratio;
        joystick.currentY = joystick.centerY + dy * ratio;

        // 死区处理：仅影响逻辑数值，不影响视觉位置
        if (distance < joystick.deadZone) {
            // 死区内：只旋转不移动（distance/strength 归零）
            joystick.distance = 0;
            joystick.strength = 0;
        } else {
            // 死区外：正常移动
            joystick.distance = clampedDistance;
            joystick.strength = clampedDistance / joystick.maxDistance;
        }
    }

    isDown(code) { return this.keys.has(code); }
    
    // 检查并消费屏幕点击状态
    consumeScreenTap() {
        if (this.screenTapped) {
            this.screenTapped = false;
            return true;
        }
        return false;
    }
    
    _resetTouchState() {
        for (let i = 0; i < 2; i++) {
            this.joysticks[i].active = false;
            this.joysticks[i].touchId = null;
            this.joysticks[i].currentX = this.joysticks[i].centerX;
            this.joysticks[i].currentY = this.joysticks[i].centerY;
            this.joysticks[i].distance = 0;
            this.joysticks[i].strength = 0;
            
            this.fireButtons[i].active = false;
            this.fireButtons[i].touchId = null;
        }
    }

    reset() {
        this.keys.clear();
        this.mouseDown = false;
        this.screenTapped = false;
        this._resetTouchState();
    }

    destroy() {
        window.removeEventListener('keydown', this._onDown);
        window.removeEventListener('keyup', this._onUp);
        if (this._canvas) {
            this._canvas.removeEventListener('mousemove', this._onMouseMove);
            this._canvas.removeEventListener('mousedown', this._onMouseDown);
            this._canvas.removeEventListener('mouseup', this._onMouseUp);
            this._canvas.removeEventListener('contextmenu', this._onContextMenu);

            this._unbindTouchEvents();
        }
    }
}
