class InputManager {
    constructor() {
        this.keys = new Set();
        // 鼠标状态（canvas 逻辑坐标）
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
        this._canvas = null;

        // 触摸控制状态
        this.isTouchDevice = ('ontouchstart' in window) ||
                             (navigator.maxTouchPoints > 0) ||
                             (navigator.msMaxTouchPoints > 0);
        this.touchEnabled = this.isTouchDevice;
        
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
                strength: 0
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
                strength: 0
            }
        ];

        // 双玩家开火按钮状态
        this.fireButtons = [
            { active: false, touchId: null, centerX: TOUCH_FIRE_P1_SINGLE_X, centerY: TOUCH_FIRE_P1_SINGLE_Y },
            { active: false, touchId: null, centerX: TOUCH_FIRE_P2_DUAL_X, centerY: TOUCH_FIRE_P2_DUAL_Y }
        ];

        // 当前玩家数量（用于动态布局）
        this.playerCount = 1;


        this._onDown = (e) => {
            console.log('[INPUT] keydown:', e.code);
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

    // 绑定 canvas 以启用鼠标和触摸坐标转换
    bindCanvas(cvs) {
        this._canvas = cvs;
        cvs.addEventListener('mousemove', this._onMouseMove);
        cvs.addEventListener('mousedown', this._onMouseDown);
        cvs.addEventListener('mouseup', this._onMouseUp);
        cvs.addEventListener('contextmenu', this._onContextMenu);

        // 绑定触摸事件
        if (this.isTouchDevice) {
            cvs.addEventListener('touchstart', this._onTouchStart, { passive: false });
            cvs.addEventListener('touchmove', this._onTouchMove, { passive: false });
            cvs.addEventListener('touchend', this._onTouchEnd, { passive: false });
            cvs.addEventListener('touchcancel', this._onTouchCancel, { passive: false });
        }
    }

    // 根据玩家数量更新控制器布局
    updateLayout(playerCount) {
        this.playerCount = playerCount;
        
        if (playerCount === 1) {
            // 单人模式：左下+右下
            this.joysticks[0].centerX = TOUCH_JOYSTICK_P1_SINGLE_X;
            this.joysticks[0].centerY = TOUCH_JOYSTICK_P1_SINGLE_Y;
            this.joysticks[0].currentX = TOUCH_JOYSTICK_P1_SINGLE_X;
            this.joysticks[0].currentY = TOUCH_JOYSTICK_P1_SINGLE_Y;
            
            this.fireButtons[0].centerX = TOUCH_FIRE_P1_SINGLE_X;
            this.fireButtons[0].centerY = TOUCH_FIRE_P1_SINGLE_Y;
        } else {
            // 双人模式：四角布局
            // P1: 左上摇杆 + 左下开火
            this.joysticks[0].centerX = TOUCH_JOYSTICK_P1_DUAL_X;
            this.joysticks[0].centerY = TOUCH_JOYSTICK_P1_DUAL_Y;
            this.joysticks[0].currentX = TOUCH_JOYSTICK_P1_DUAL_X;
            this.joysticks[0].currentY = TOUCH_JOYSTICK_P1_DUAL_Y;
            
            this.fireButtons[0].centerX = TOUCH_FIRE_P1_DUAL_X;
            this.fireButtons[0].centerY = TOUCH_FIRE_P1_DUAL_Y;
            
            // P2: 右上摇杆 + 右下开火
            this.joysticks[1].centerX = TOUCH_JOYSTICK_P2_DUAL_X;
            this.joysticks[1].centerY = TOUCH_JOYSTICK_P2_DUAL_Y;
            this.joysticks[1].currentX = TOUCH_JOYSTICK_P2_DUAL_X;
            this.joysticks[1].currentY = TOUCH_JOYSTICK_P2_DUAL_Y;
            
            this.fireButtons[1].centerX = TOUCH_FIRE_P2_DUAL_X;
            this.fireButtons[1].centerY = TOUCH_FIRE_P2_DUAL_Y;
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

    // 触摸坐标转换为 canvas 逻辑坐标
    _touchToCanvasCoords(touch) {
        if (!this._canvas) return { x: 0, y: 0 };
        const rect = this._canvas.getBoundingClientRect();
        // 屏幕坐标 -> Canvas坐标 -> 游戏坐标
        const canvasX = (touch.clientX - rect.left) * (this._canvas.width / rect.width);
        const canvasY = (touch.clientY - rect.top) * (this._canvas.height / rect.height);
        const x = (canvasX - VIEWPORT_OFFSET_X) / VIEWPORT_SCALE;
        const y = (canvasY - VIEWPORT_OFFSET_Y) / VIEWPORT_SCALE;
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
        if (this._distance(x, y, this.joysticks[0].centerX, this.joysticks[0].centerY) < TOUCH_JOYSTICK_OUTER_RADIUS + 30) {
            return { player: 0, type: 'joystick' };
        }
        // 检查P1开火按钮区域
        if (this._distance(x, y, this.fireButtons[0].centerX, this.fireButtons[0].centerY) < TOUCH_FIRE_BUTTON_RADIUS + 30) {
            return { player: 0, type: 'fire' };
        }
        
        // 双人模式才检查P2
        if (this.playerCount >= 2) {
            // 检查P2摇杆区域
            if (this._distance(x, y, this.joysticks[1].centerX, this.joysticks[1].centerY) < TOUCH_JOYSTICK_OUTER_RADIUS + 30) {
                return { player: 1, type: 'joystick' };
            }
            // 检查P2开火按钮区域
            if (this._distance(x, y, this.fireButtons[1].centerX, this.fireButtons[1].centerY) < TOUCH_FIRE_BUTTON_RADIUS + 30) {
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
            const pos = this._touchToCanvasCoords(touch);

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
            const pos = this._touchToCanvasCoords(touch);

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

        // 死区处理
        if (distance < TOUCH_JOYSTICK_DEAD_ZONE) {
            joystick.currentX = joystick.centerX;
            joystick.currentY = joystick.centerY;
            joystick.distance = 0;
            joystick.strength = 0;
            joystick.angle = 0;
            return;
        }

        // 限制最大距离
        const clampedDistance = Math.min(distance, TOUCH_JOYSTICK_MAX_DISTANCE);
        const ratio = clampedDistance / distance;

        joystick.currentX = joystick.centerX + dx * ratio;
        joystick.currentY = joystick.centerY + dy * ratio;
        joystick.angle = Math.atan2(dy, dx);
        joystick.distance = clampedDistance;
        joystick.strength = clampedDistance / TOUCH_JOYSTICK_MAX_DISTANCE;
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
    
    reset() {
        this.keys.clear();
        this.mouseDown = false;
        this.screenTapped = false;
        
        // 重置触摸状态
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

    destroy() {
        window.removeEventListener('keydown', this._onDown);
        window.removeEventListener('keyup', this._onUp);
        if (this._canvas) {
            this._canvas.removeEventListener('mousemove', this._onMouseMove);
            this._canvas.removeEventListener('mousedown', this._onMouseDown);
            this._canvas.removeEventListener('mouseup', this._onMouseUp);
            this._canvas.removeEventListener('contextmenu', this._onContextMenu);
            
            // 移除触摸事件
            if (this.isTouchDevice) {
                this._canvas.removeEventListener('touchstart', this._onTouchStart);
                this._canvas.removeEventListener('touchmove', this._onTouchMove);
                this._canvas.removeEventListener('touchend', this._onTouchEnd);
                this._canvas.removeEventListener('touchcancel', this._onTouchCancel);
            }
        }
    }
}
