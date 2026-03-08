// ===== 控制器配置界面 =====
class ControlsConfigUI {
    constructor() {
        this.mode = 'single'; // 'single' or 'dual'
        this.selectedPlayer = 0; // 0 or 1 (for dual mode)
        this.config = null;
        this.tempConfig = null;
        
        // 拖动状态
        this.dragTarget = null; // { type: 'joystick'|'fire', player: 0|1 }
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.longPressTimer = 0;
        this.isDragging = false;
        
        // 参数面板状态
        this.showPanel = false;
        this.panelTarget = null; // { type: 'joystick'|'fire', player: 0|1 }
        this.panelSlider = null; // { param: 'size'|'deadZone', value: number, dragging: false }
        
        // 按钮状态
        this.buttons = {
            singleMode: { x: CANVAS_W/2 - 120, y: 80, w: 100, h: 35 },
            dualMode: { x: CANVAS_W/2 + 20, y: 80, w: 100, h: 35 },
            reset: { x: CANVAS_W/2 - 180, y: CANVAS_H - 60, w: 100, h: 35 },
            save: { x: CANVAS_W/2 - 50, y: CANVAS_H - 60, w: 80, h: 35 },
            back: { x: CANVAS_W/2 + 60, y: CANVAS_H - 60, w: 80, h: 35 }
        };
        
        this.done = false;
        this.saved = false;
        this._input = null;
        this._onTouchStart = null;
        this._onTouchMove = null;
        this._onTouchEnd = null;
    }

    activate(input) {
        this.done = false;
        this.saved = false;
        this._input = input;
        this.config = ControlsSettings.load();
        this.tempConfig = JSON.parse(JSON.stringify(this.config)); // 深拷贝
        this.mode = 'single';
        this.selectedPlayer = 0;
        this.showPanel = false;
        this.panelTarget = null;
        this.dragTarget = null;
        this.isDragging = false;
        
        // 绑定触摸事件
        if (input._canvas) {
            this._onTouchStart = (e) => this._handleTouchStart(e);
            this._onTouchMove = (e) => this._handleTouchMove(e);
            this._onTouchEnd = (e) => this._handleTouchEnd(e);
            
            input._canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
            input._canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
            input._canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
        }
    }

    deactivate() {
        // 移除触摸事件
        if (this._input && this._input._canvas) {
            if (this._onTouchStart) this._input._canvas.removeEventListener('touchstart', this._onTouchStart);
            if (this._onTouchMove) this._input._canvas.removeEventListener('touchmove', this._onTouchMove);
            if (this._onTouchEnd) this._input._canvas.removeEventListener('touchend', this._onTouchEnd);
        }
        this._onTouchStart = null;
        this._onTouchMove = null;
        this._onTouchEnd = null;
    }

    update(dt) {
        // 长按检测
        if (this.longPressTimer > 0) {
            this.longPressTimer -= dt;
            if (this.longPressTimer <= 0 && this.dragTarget && !this.isDragging) {
                this.isDragging = true;
            }
        }
    }

    _handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        const pos = this._input._touchToCanvasCoords(touch);
        
        // 检查参数面板滑动条
        if (this.showPanel && this.panelTarget) {
            const slider = this._checkSliderHit(pos.x, pos.y);
            if (slider) {
                this.panelSlider = { ...slider, dragging: true };
                return;
            }
            
            // 检查面板按钮
            if (this._checkPanelButton(pos.x, pos.y, 'confirm')) {
                this.showPanel = false;
                this.panelTarget = null;
                return;
            }
            if (this._checkPanelButton(pos.x, pos.y, 'cancel')) {
                // 取消：恢复原配置
                this.tempConfig = JSON.parse(JSON.stringify(this.config));
                this.showPanel = false;
                this.panelTarget = null;
                return;
            }
        }
        
        // 检查控制器点击
        const controller = this._getControllerAt(pos.x, pos.y);
        if (controller) {
            this.dragTarget = controller;
            this.dragStartX = pos.x;
            this.dragStartY = pos.y;
            
            const cfg = this._getControllerConfig(controller);
            this.dragOffsetX = pos.x - cfg.x;
            this.dragOffsetY = pos.y - cfg.y;
            
            this.longPressTimer = 0.3; // 300ms 长按
            this.isDragging = false;
            return;
        }
        
        // 检查按钮点击
        this._checkButtonClick(pos.x, pos.y);
    }

    _handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length !== 1) return;
        
        const touch = e.touches[0];
        const pos = this._input._touchToCanvasCoords(touch);
        
        // 拖动滑动条
        if (this.panelSlider && this.panelSlider.dragging) {
            this._updateSlider(pos.x, pos.y);
            return;
        }
        
        // 拖动控制器
        if (this.isDragging && this.dragTarget) {
            const newX = pos.x - this.dragOffsetX;
            const newY = pos.y - this.dragOffsetY;
            
            const cfg = this._getControllerConfig(this.dragTarget);
            const radius = this.dragTarget.type === 'joystick' ? cfg.outerRadius : cfg.radius;
            const clamped = ControlsSettings.clampPosition(newX, newY, radius);
            
            cfg.x = clamped.x;
            cfg.y = clamped.y;
            return;
        }
        
        // 检测拖动距离
        if (this.dragTarget && !this.isDragging) {
            const dx = pos.x - this.dragStartX;
            const dy = pos.y - this.dragStartY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 10) {
                this.longPressTimer = 0; // 取消长按
            }
        }
    }

    _handleTouchEnd(e) {
        e.preventDefault();
        
        // 结束滑动条拖动
        if (this.panelSlider && this.panelSlider.dragging) {
            this.panelSlider.dragging = false;
            return;
        }
        
        // 结束控制器拖动
        if (this.isDragging && this.dragTarget) {
            this.isDragging = false;
            this.dragTarget = null;
            this.longPressTimer = 0;
            return;
        }
        
        // 短按：显示参数面板
        if (this.dragTarget && !this.isDragging && this.longPressTimer > 0) {
            this.showPanel = true;
            this.panelTarget = this.dragTarget;
            this.panelSlider = null;
        }
        
        this.dragTarget = null;
        this.longPressTimer = 0;
        this.isDragging = false;
    }

    _getControllerAt(x, y) {
        const cfg = this.mode === 'single' ? this.tempConfig.singlePlayer : this.tempConfig.dualPlayer;
        
        if (this.mode === 'single') {
            // 检查摇杆
            const jDist = Math.sqrt((x - cfg.joystick.x) ** 2 + (y - cfg.joystick.y) ** 2);
            if (jDist < cfg.joystick.outerRadius + 20) {
                return { type: 'joystick', player: 0 };
            }
            // 检查开火键
            const fDist = Math.sqrt((x - cfg.fireButton.x) ** 2 + (y - cfg.fireButton.y) ** 2);
            if (fDist < cfg.fireButton.radius + 20) {
                return { type: 'fire', player: 0 };
            }
        } else {
            // 双人模式：检查两个玩家的控制器
            for (let p = 0; p < 2; p++) {
                const pCfg = p === 0 ? cfg.player1 : cfg.player2;
                const jDist = Math.sqrt((x - pCfg.joystick.x) ** 2 + (y - pCfg.joystick.y) ** 2);
                if (jDist < pCfg.joystick.outerRadius + 20) {
                    return { type: 'joystick', player: p };
                }
                const fDist = Math.sqrt((x - pCfg.fireButton.x) ** 2 + (y - pCfg.fireButton.y) ** 2);
                if (fDist < pCfg.fireButton.radius + 20) {
                    return { type: 'fire', player: p };
                }
            }
        }
        return null;
    }

    _getControllerConfig(target) {
        const cfg = this.mode === 'single' ? this.tempConfig.singlePlayer : this.tempConfig.dualPlayer;
        
        if (this.mode === 'single') {
            return target.type === 'joystick' ? cfg.joystick : cfg.fireButton;
        } else {
            const pCfg = target.player === 0 ? cfg.player1 : cfg.player2;
            return target.type === 'joystick' ? pCfg.joystick : pCfg.fireButton;
        }
    }

    _checkButtonClick(x, y) {
        // 模式切换按钮
        if (this._isInButton(x, y, this.buttons.singleMode)) {
            this.mode = 'single';
            this.showPanel = false;
            return;
        }
        if (this._isInButton(x, y, this.buttons.dualMode)) {
            this.mode = 'dual';
            this.showPanel = false;
            return;
        }
        
        // 底部按钮
        if (this._isInButton(x, y, this.buttons.reset)) {
            this.tempConfig = ControlsSettings.getDefault();
            this.showPanel = false;
            return;
        }
        if (this._isInButton(x, y, this.buttons.save)) {
            this.config = JSON.parse(JSON.stringify(this.tempConfig));
            ControlsSettings.save(this.config);
            this.saved = true;
            this.done = true;
            return;
        }
        if (this._isInButton(x, y, this.buttons.back)) {
            this.done = true;
            return;
        }
    }

    _isInButton(x, y, btn) {
        return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
    }

    _checkSliderHit(x, y) {
        if (!this.panelTarget) return null;
        
        const panelX = CANVAS_W / 2 - 150;
        const panelY = CANVAS_H / 2 - 100;
        const sliderY1 = panelY + 60;
        const sliderY2 = panelY + 110;
        const sliderX = panelX + 20;
        const sliderW = 260;
        
        if (x >= sliderX && x <= sliderX + sliderW) {
            if (Math.abs(y - sliderY1) < 15) {
                return { param: 'size', y: sliderY1 };
            }
            if (this.panelTarget.type === 'joystick' && Math.abs(y - sliderY2) < 15) {
                return { param: 'deadZone', y: sliderY2 };
            }
        }
        return null;
    }

    _updateSlider(x, y) {
        if (!this.panelSlider) return;
        
        const panelX = CANVAS_W / 2 - 150;
        const sliderX = panelX + 20;
        const sliderW = 260;
        
        const ratio = Math.max(0, Math.min(1, (x - sliderX) / sliderW));
        const cfg = this._getControllerConfig(this.panelTarget);
        
        if (this.panelSlider.param === 'size') {
            if (this.panelTarget.type === 'joystick') {
                const min = JOYSTICK_OUTER_RADIUS_MIN;
                const max = JOYSTICK_OUTER_RADIUS_MAX;
                cfg.outerRadius = Math.round(min + ratio * (max - min));
                cfg.innerRadius = Math.round(cfg.outerRadius * 0.42);
                cfg.maxDistance = Math.round(cfg.outerRadius * 0.83);
            } else {
                const min = FIRE_BUTTON_RADIUS_MIN;
                const max = FIRE_BUTTON_RADIUS_MAX;
                cfg.radius = Math.round(min + ratio * (max - min));
            }
        } else if (this.panelSlider.param === 'deadZone') {
            const min = JOYSTICK_DEAD_ZONE_MIN;
            const max = JOYSTICK_DEAD_ZONE_MAX;
            cfg.deadZone = Math.round(min + ratio * (max - min));
        }
    }

    _checkPanelButton(x, y, type) {
        const panelX = CANVAS_W / 2 - 150;
        const panelY = CANVAS_H / 2 - 100;
        const panelH = this.panelTarget && this.panelTarget.type === 'joystick' ? 200 : 150;
        
        const btnY = panelY + panelH - 40;
        const confirmBtn = { x: panelX + 50, y: btnY, w: 80, h: 30 };
        const cancelBtn = { x: panelX + 170, y: btnY, w: 80, h: 30 };
        
        if (type === 'confirm') return this._isInButton(x, y, confirmBtn);
        if (type === 'cancel') return this._isInButton(x, y, cancelBtn);
        return false;
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = Theme.colors.bg;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.translate(VIEWPORT_OFFSET_X, VIEWPORT_OFFSET_Y);
        ctx.scale(VIEWPORT_SCALE, VIEWPORT_SCALE);
        
        // 标题
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px monospace';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.fillText(t('controlsTitle'), CANVAS_W / 2, 40);
        
        // 副标题
        ctx.font = '14px monospace';
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.fillText(t('controlsSubtitle'), CANVAS_W / 2, 70);
        
        // 装饰线
        const lineY = 88;
        const lineW = 200;
        const grad = ctx.createLinearGradient(
            CANVAS_W/2 - lineW/2, lineY,
            CANVAS_W/2 + lineW/2, lineY
        );
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, Theme.colors.tanks[0]);
        grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(CANVAS_W/2 - lineW/2, lineY);
        ctx.lineTo(CANVAS_W/2 + lineW/2, lineY);
        ctx.stroke();
        
        // 模式切换按钮
        this._drawModeButton(ctx, this.buttons.singleMode, t('singleMode'), this.mode === 'single');
        this._drawModeButton(ctx, this.buttons.dualMode, t('dualMode'), this.mode === 'dual');
        
        // 绘制控制器预览区域
        this._drawControllers(ctx);
        
        // 操作说明
        const instructions = [
            { icon: '👆', text: t('tapToOpenPanel') },
            { icon: '⏱', text: t('longPressToDrag') },
            { icon: '✋', text: t('dragToMove') }
        ];
        
        ctx.font = '13px monospace';
        ctx.fillStyle = Theme.colors.text.secondary;
        ctx.textAlign = 'left';
        
        let instrY = CANVAS_H - 115;
        instructions.forEach((instr, i) => {
            ctx.fillText(`${i+1}. ${instr.icon} ${instr.text}`, 60, instrY);
            instrY += 22;
        });
        
        // 底部按钮
        this._drawActionButton(ctx, this.buttons.reset, t('resetDefault'), 'reset');
        this._drawActionButton(ctx, this.buttons.save, t('save'), 'save');
        this._drawActionButton(ctx, this.buttons.back, t('back'), 'back');
        
        // 参数面板
        if (this.showPanel && this.panelTarget) {
            this._drawPanel(ctx);
        }
        
        ctx.restore();
    }

    _drawModeButton(ctx, btn, text, selected) {
        const radius = 8;
        
        ctx.save();
        
        // 绘制圆角矩形路径
        ctx.beginPath();
        ctx.moveTo(btn.x + radius, btn.y);
        ctx.lineTo(btn.x + btn.w - radius, btn.y);
        ctx.quadraticCurveTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + radius);
        ctx.lineTo(btn.x + btn.w, btn.y + btn.h - radius);
        ctx.quadraticCurveTo(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - radius, btn.y + btn.h);
        ctx.lineTo(btn.x + radius, btn.y + btn.h);
        ctx.quadraticCurveTo(btn.x, btn.y + btn.h, btn.x, btn.y + btn.h - radius);
        ctx.lineTo(btn.x, btn.y + radius);
        ctx.quadraticCurveTo(btn.x, btn.y, btn.x + radius, btn.y);
        ctx.closePath();
        
        if (selected) {
            // 外发光
            ctx.shadowColor = Theme.colors.tanks[0];
            ctx.shadowBlur = 15;
            
            // 渐变填充
            const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
            grad.addColorStop(0, Theme.colors.tanks[0]);
            grad.addColorStop(1, Theme.colors.tanks[1] || Theme.colors.tanks[0]);
            ctx.fillStyle = grad;
            ctx.fill();
            
            // 高亮边框
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            // 未选中状态
            ctx.fillStyle = Theme.current === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
            ctx.fill();
            ctx.strokeStyle = Theme.colors.text.hint;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.restore();
        
        // 文字
        ctx.fillStyle = selected ? '#FFFFFF' : Theme.colors.text.secondary;
        ctx.font = selected ? 'bold 16px monospace' : '14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

    _drawActionButton(ctx, btn, text, type) {
        const radius = 8;
        const colors = {
            reset: { normal: '#FF9800', hover: '#FB8C00', icon: '↻' },
            save: { normal: '#4CAF50', hover: '#43A047', icon: '✓' },
            back: { normal: '#757575', hover: '#616161', icon: '←' }
        };
        
        const color = colors[type] || colors.back;
        
        ctx.save();
        
        // 阴影效果
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        
        // 绘制圆角矩形
        ctx.beginPath();
        ctx.moveTo(btn.x + radius, btn.y);
        ctx.lineTo(btn.x + btn.w - radius, btn.y);
        ctx.quadraticCurveTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + radius);
        ctx.lineTo(btn.x + btn.w, btn.y + btn.h - radius);
        ctx.quadraticCurveTo(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - radius, btn.y + btn.h);
        ctx.lineTo(btn.x + radius, btn.y + btn.h);
        ctx.quadraticCurveTo(btn.x, btn.y + btn.h, btn.x, btn.y + btn.h - radius);
        ctx.lineTo(btn.x, btn.y + radius);
        ctx.quadraticCurveTo(btn.x, btn.y, btn.x + radius, btn.y);
        ctx.closePath();
        
        // 按钮背景
        ctx.fillStyle = color.normal;
        ctx.fill();
        
        ctx.restore();
        
        // 图标和文字
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${color.icon} ${text}`, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

    _drawButton(ctx, btn, text, selected) {
        const radius = 8;
        
        ctx.save();
        
        if (selected) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
        }
        
        ctx.beginPath();
        ctx.moveTo(btn.x + radius, btn.y);
        ctx.lineTo(btn.x + btn.w - radius, btn.y);
        ctx.quadraticCurveTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + radius);
        ctx.lineTo(btn.x + btn.w, btn.y + btn.h - radius);
        ctx.quadraticCurveTo(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - radius, btn.y + btn.h);
        ctx.lineTo(btn.x + radius, btn.y + btn.h);
        ctx.quadraticCurveTo(btn.x, btn.y + btn.h, btn.x, btn.y + btn.h - radius);
        ctx.lineTo(btn.x, btn.y + radius);
        ctx.quadraticCurveTo(btn.x, btn.y, btn.x + radius, btn.y);
        ctx.closePath();
        
        if (selected) {
            const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
            grad.addColorStop(0, Theme.colors.tanks[0]);
            grad.addColorStop(1, Theme.colors.tanks[1] || Theme.colors.tanks[0]);
            ctx.fillStyle = grad;
            ctx.fill();
        } else {
            ctx.fillStyle = Theme.current === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
            ctx.fill();
            ctx.strokeStyle = Theme.colors.text.hint;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        ctx.restore();
        
        ctx.fillStyle = selected ? '#FFFFFF' : Theme.colors.text.secondary;
        ctx.font = selected ? 'bold 16px monospace' : '14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

    _drawControllers(ctx) {
        const cfg = this.mode === 'single' ? this.tempConfig.singlePlayer : this.tempConfig.dualPlayer;
        const x = 50, y = 130, w = CANVAS_W - 100, h = CANVAS_H - 250;
        const radius = 12;
        
        ctx.save();
        
        // 绘制圆角矩形预览区域
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        
        // 背景填充
        ctx.fillStyle = Theme.current === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        ctx.fill();
        
        // 内阴影效果（多层描边）
        for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = Theme.current === 'dark'
                ? `rgba(0,0,0,${0.15 - i * 0.05})`
                : `rgba(0,0,0,${0.1 - i * 0.03})`;
            ctx.lineWidth = 3 - i;
            ctx.stroke();
        }
        
        ctx.restore();
        
        // 点阵背景
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = Theme.colors.text.hint;
        const dotSize = 2;
        const dotGap = 30;
        for (let gx = x + dotGap; gx < x + w; gx += dotGap) {
            for (let gy = y + dotGap; gy < y + h; gy += dotGap) {
                ctx.beginPath();
                ctx.arc(gx, gy, dotSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
        
        // 区域标签
        ctx.font = '12px monospace';
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.textAlign = 'center';
        ctx.fillText(t('previewArea'), x + w/2, y + 15);
        
        // 绘制控制器
        if (this.mode === 'single') {
            this._drawJoystick(ctx, cfg.joystick, 0, false);
            this._drawFireButton(ctx, cfg.fireButton, 0, false);
        } else {
            this._drawJoystick(ctx, cfg.player1.joystick, 0, false);
            this._drawFireButton(ctx, cfg.player1.fireButton, 0, false);
            this._drawJoystick(ctx, cfg.player2.joystick, 1, false);
            this._drawFireButton(ctx, cfg.player2.fireButton, 1, false);
        }
    }

    _drawJoystick(ctx, config, playerIndex, active) {
        const isDark = Theme.current === 'dark';
        const playerColor = Theme.colors.tanks[playerIndex] || Theme.colors.tanks[0];
        const alpha = this.isDragging && this.dragTarget &&
                      this.dragTarget.type === 'joystick' &&
                      this.dragTarget.player === playerIndex ? 0.5 : 0.8;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // 拖动阴影
        if (this.isDragging && this.dragTarget &&
            this.dragTarget.type === 'joystick' &&
            this.dragTarget.player === playerIndex) {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
        }
        
        // 底座径向渐变
        const baseGrad = ctx.createRadialGradient(
            config.x, config.y, 0,
            config.x, config.y, config.outerRadius
        );
        baseGrad.addColorStop(0, isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)');
        baseGrad.addColorStop(1, isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
        ctx.fillStyle = baseGrad;
        ctx.beginPath();
        ctx.arc(config.x, config.y, config.outerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = playerColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 摇杆头光泽
        const headGrad = ctx.createRadialGradient(
            config.x - config.innerRadius * 0.3,
            config.y - config.innerRadius * 0.3,
            0,
            config.x, config.y,
            config.innerRadius
        );
        headGrad.addColorStop(0, this._lightenColor(playerColor, 0.3));
        headGrad.addColorStop(1, playerColor);
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(config.x, config.y, config.innerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 死区圆圈柔和化
        if (config.deadZone > 0) {
            ctx.globalAlpha = alpha * 0.6;
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(config.x, config.y, config.deadZone, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        // 标签
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`P${playerIndex + 1}`, config.x, config.y + config.outerRadius + 20);
        
        ctx.restore();
        
        // 长按进度环
        if (this.longPressTimer > 0 && this.dragTarget &&
            this.dragTarget.type === 'joystick' &&
            this.dragTarget.player === playerIndex) {
            const progress = 1 - (this.longPressTimer / 0.3);
            ctx.save();
            ctx.strokeStyle = Theme.colors.tanks[0];
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(config.x, config.y, config.outerRadius + 10,
                    -Math.PI/2, -Math.PI/2 + Math.PI * 2 * progress);
            ctx.stroke();
            ctx.restore();
        }
    }
    
    _lightenColor(color, amount) {
        // 简单的颜色变亮函数
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount * 255);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount * 255);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount * 255);
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }

    _drawFireButton(ctx, config, playerIndex, active) {
        const alpha = this.isDragging && this.dragTarget &&
                      this.dragTarget.type === 'fire' &&
                      this.dragTarget.player === playerIndex ? 0.5 : 0.8;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // 拖动阴影
        if (this.isDragging && this.dragTarget &&
            this.dragTarget.type === 'fire' &&
            this.dragTarget.player === playerIndex) {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
        }
        
        // 按钮阴影
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3;
        
        // 按钮渐变（增强立体感）
        const grad = ctx.createRadialGradient(
            config.x - config.radius * 0.3,
            config.y - config.radius * 0.3,
            0,
            config.x, config.y,
            config.radius
        );
        grad.addColorStop(0, '#FF8787');
        grad.addColorStop(0.6, '#FF6B6B');
        grad.addColorStop(1, '#C0392B');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(config.x, config.y, config.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 高光
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.beginPath();
        ctx.arc(
            config.x - config.radius * 0.25,
            config.y - config.radius * 0.25,
            config.radius * 0.3,
            0, Math.PI * 2
        );
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();
        
        // 边框
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(config.x, config.y, config.radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // 准星
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        const gap = 5, len = 9;
        ctx.beginPath();
        ctx.moveTo(config.x, config.y - gap);
        ctx.lineTo(config.x, config.y - gap - len);
        ctx.moveTo(config.x, config.y + gap);
        ctx.lineTo(config.x, config.y + gap + len);
        ctx.moveTo(config.x - gap, config.y);
        ctx.lineTo(config.x - gap - len, config.y);
        ctx.moveTo(config.x + gap, config.y);
        ctx.lineTo(config.x + gap + len, config.y);
        ctx.stroke();
        
        ctx.restore();
        
        // 长按进度环
        if (this.longPressTimer > 0 && this.dragTarget &&
            this.dragTarget.type === 'fire' &&
            this.dragTarget.player === playerIndex) {
            const progress = 1 - (this.longPressTimer / 0.3);
            ctx.save();
            ctx.strokeStyle = Theme.colors.tanks[0];
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(config.x, config.y, config.radius + 10,
                    -Math.PI/2, -Math.PI/2 + Math.PI * 2 * progress);
            ctx.stroke();
            ctx.restore();
        }
    }

    _drawPanel(ctx) {
        // 背景遮罩（模拟模糊效果）
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.restore();
        
        const panelX = CANVAS_W / 2 - 150;
        const panelY = CANVAS_H / 2 - 100;
        const panelW = 300;
        const panelH = this.panelTarget.type === 'joystick' ? 200 : 150;
        const radius = 16;
        
        ctx.save();
        
        // 阴影效果
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
        
        // 绘制圆角矩形面板
        ctx.beginPath();
        ctx.moveTo(panelX + radius, panelY);
        ctx.lineTo(panelX + panelW - radius, panelY);
        ctx.quadraticCurveTo(panelX + panelW, panelY, panelX + panelW, panelY + radius);
        ctx.lineTo(panelX + panelW, panelY + panelH - radius);
        ctx.quadraticCurveTo(panelX + panelW, panelY + panelH, panelX + panelW - radius, panelY + panelH);
        ctx.lineTo(panelX + radius, panelY + panelH);
        ctx.quadraticCurveTo(panelX, panelY + panelH, panelX, panelY + panelH - radius);
        ctx.lineTo(panelX, panelY + radius);
        ctx.quadraticCurveTo(panelX, panelY, panelX + radius, panelY);
        ctx.closePath();
        
        // 面板背景（毛玻璃效果）
        ctx.fillStyle = Theme.current === 'dark'
            ? 'rgba(40,40,40,0.95)'
            : 'rgba(255,255,255,0.95)';
        ctx.fill();
        
        // 面板边框发光
        ctx.shadowColor = Theme.colors.tanks[0];
        ctx.shadowBlur = 20;
        ctx.strokeStyle = Theme.colors.tanks[0];
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
        
        // 标题
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const title = this.panelTarget.type === 'joystick' ? t('joystickSize') : t('buttonSize');
        ctx.fillText(title, panelX + panelW / 2, panelY + 30);
        
        const cfg = this._getControllerConfig(this.panelTarget);
        
        // 大小滑动条
        this._drawSlider(ctx, panelX + 20, panelY + 60, 260,
            this.panelTarget.type === 'joystick' ? t('joystickSize') : t('buttonSize'),
            this.panelTarget.type === 'joystick' ? cfg.outerRadius : cfg.radius,
            this.panelTarget.type === 'joystick' ? JOYSTICK_OUTER_RADIUS_MIN : FIRE_BUTTON_RADIUS_MIN,
            this.panelTarget.type === 'joystick' ? JOYSTICK_OUTER_RADIUS_MAX : FIRE_BUTTON_RADIUS_MAX
        );
        
        // 死区滑动条（仅摇杆）
        if (this.panelTarget.type === 'joystick') {
            this._drawSlider(ctx, panelX + 20, panelY + 110, 260,
                t('deadZone'), cfg.deadZone,
                JOYSTICK_DEAD_ZONE_MIN, JOYSTICK_DEAD_ZONE_MAX
            );
        }
        
        // 按钮
        const btnY = panelY + panelH - 40;
        const btnRadius = 6;
        
        // 确认按钮
        this._drawPanelButton(ctx, panelX + 50, btnY, 80, 30, t('confirm'), true, btnRadius);
        
        // 取消按钮
        this._drawPanelButton(ctx, panelX + 170, btnY, 80, 30, t('cancel'), false, btnRadius);
    }
    
    _drawPanelButton(ctx, x, y, w, h, text, isPrimary, radius) {
        ctx.save();
        
        // 绘制圆角按钮
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        
        if (isPrimary) {
            // 主按钮：渐变填充
            const grad = ctx.createLinearGradient(x, y, x, y + h);
            grad.addColorStop(0, Theme.colors.tanks[0]);
            grad.addColorStop(1, Theme.colors.tanks[1] || Theme.colors.tanks[0]);
            ctx.fillStyle = grad;
        } else {
            // 次按钮：半透明填充
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        }
        ctx.fill();
        
        // 边框
        ctx.strokeStyle = isPrimary ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
        
        // 文字
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2);
    }

    _drawSlider(ctx, x, y, w, label, value, min, max) {
        // 标签
        ctx.fillStyle = Theme.current === 'dark' ? '#FFFFFF' : Theme.colors.text.primary;
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y - 10);
        
        // 刻度标记
        const steps = 5;
        ctx.save();
        ctx.strokeStyle = Theme.current === 'dark' ? 'rgba(255,255,255,0.3)' : Theme.colors.text.hint;
        ctx.lineWidth = 1;
        for (let i = 0; i <= steps; i++) {
            const tickX = x + (w / steps) * i;
            ctx.beginPath();
            ctx.moveTo(tickX, y + 15);
            ctx.lineTo(tickX, y + 20);
            ctx.stroke();
        }
        ctx.restore();
        
        const trackH = 8;
        const trackRadius = trackH / 2;
        
        ctx.save();
        
        // 绘制圆角轨道
        ctx.beginPath();
        ctx.moveTo(x + trackRadius, y - trackH / 2);
        ctx.lineTo(x + w - trackRadius, y - trackH / 2);
        ctx.arc(x + w - trackRadius, y, trackRadius, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(x + trackRadius, y + trackH / 2);
        ctx.arc(x + trackRadius, y, trackRadius, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        
        ctx.fillStyle = Theme.current === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
        ctx.fill();
        
        // 绘制进度条
        const ratio = (value - min) / (max - min);
        const progressW = w * ratio;
        
        if (progressW > trackRadius * 2) {
            ctx.beginPath();
            ctx.moveTo(x + trackRadius, y - trackH / 2);
            ctx.lineTo(x + progressW - trackRadius, y - trackH / 2);
            ctx.arc(x + progressW - trackRadius, y, trackRadius, -Math.PI / 2, Math.PI / 2);
            ctx.lineTo(x + trackRadius, y + trackH / 2);
            ctx.arc(x + trackRadius, y, trackRadius, Math.PI / 2, -Math.PI / 2);
            ctx.closePath();
            
            const grad = ctx.createLinearGradient(x, y, x + progressW, y);
            grad.addColorStop(0, Theme.colors.tanks[0]);
            grad.addColorStop(1, Theme.colors.tanks[1] || Theme.colors.tanks[0]);
            ctx.fillStyle = grad;
            ctx.fill();
        }
        
        ctx.restore();
        
        // 绘制滑块
        const knobRadius = 12;
        const knobX = x + w * ratio;
        
        ctx.save();
        
        // 滑块阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        
        // 滑块渐变
        const knobGrad = ctx.createRadialGradient(
            knobX - knobRadius * 0.3, y - knobRadius * 0.3, knobRadius * 0.1,
            knobX, y, knobRadius
        );
        knobGrad.addColorStop(0, '#FFFFFF');
        knobGrad.addColorStop(1, '#E0E0E0');
        ctx.fillStyle = knobGrad;
        
        ctx.beginPath();
        ctx.arc(knobX, y, knobRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 滑块边框
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
        
        // 当前值提示（在滑块上方）
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = Theme.current === 'dark' ? '#FFFFFF' : Theme.colors.text.primary;
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(value), knobX, y - 25);
    }
}
