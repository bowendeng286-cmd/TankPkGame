class ControlsConfigUI {
    constructor() {
        this.mode = 'single';
        this.selectedPlayer = 0;
        this.config = null;
        this.tempConfig = null;

        this.dragTarget = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.longPressTimer = 0;
        this.isDragging = false;

        this.showPanel = false;
        this.panelTarget = null;
        this.panelSlider = null;
        this.panelSnapshot = null;

        this.done = false;
        this.saved = false;
        this._input = null;
        this._onTouchStart = null;
        this._onTouchMove = null;
        this._onTouchEnd = null;
        this._onTouchCancel = null;
    }

    activate(input) {
        this.done = false;
        this.saved = false;
        this._input = input;
        const surface = this._getSurfaceSize();
        this.config = ControlsSettings.load(surface.width, surface.height);
        this.tempConfig = JSON.parse(JSON.stringify(this.config));
        this.mode = 'single';
        this.selectedPlayer = 0;

        this.dragTarget = null;
        this.longPressTimer = 0;
        this.isDragging = false;
        this.showPanel = false;
        this.panelTarget = null;
        this.panelSlider = null;
        this.panelSnapshot = null;

        if (input._canvas) {
            this._onTouchStart = (e) => this._handleTouchStart(e);
            this._onTouchMove = (e) => this._handleTouchMove(e);
            this._onTouchEnd = (e) => this._handleTouchEnd(e);
            this._onTouchCancel = (e) => this._handleTouchEnd(e);

            input._canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
            input._canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
            input._canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
            input._canvas.addEventListener('touchcancel', this._onTouchCancel, { passive: false });
        }
    }

    deactivate() {
        if (this._input && this._input._canvas) {
            if (this._onTouchStart) this._input._canvas.removeEventListener('touchstart', this._onTouchStart);
            if (this._onTouchMove) this._input._canvas.removeEventListener('touchmove', this._onTouchMove);
            if (this._onTouchEnd) this._input._canvas.removeEventListener('touchend', this._onTouchEnd);
            if (this._onTouchCancel) this._input._canvas.removeEventListener('touchcancel', this._onTouchCancel);
        }

        this._onTouchStart = null;
        this._onTouchMove = null;
        this._onTouchEnd = null;
        this._onTouchCancel = null;
    }

    update(dt) {
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

        const pos = this._input._touchToCanvasCoords(e.touches[0]);

        if (this.showPanel && this.panelTarget) {
            const slider = this._checkSliderHit(pos.x, pos.y);
            if (slider) {
                this.panelSlider = { param: slider.param, dragging: true };
                this._updateSlider(pos.x);
                return;
            }

            const buttons = this._getPanelButtons();
            if (this._isInRect(pos.x, pos.y, buttons.confirm)) {
                this._closePanel(true);
                return;
            }
            if (this._isInRect(pos.x, pos.y, buttons.cancel)) {
                this._closePanel(false);
                return;
            }
            return;
        }

        const controller = this._getControllerAt(pos.x, pos.y);
        if (controller) {
            this.dragTarget = controller;
            this.dragStartX = pos.x;
            this.dragStartY = pos.y;

            const previewCfg = this._getPreviewControllerConfig(controller, this._getLayout().preview);
            this.dragOffsetX = pos.x - previewCfg.x;
            this.dragOffsetY = pos.y - previewCfg.y;
            this.longPressTimer = 0.3;
            this.isDragging = false;
            return;
        }

        this._checkButtonClick(pos.x, pos.y);
    }

    _handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length !== 1) return;

        const pos = this._input._touchToCanvasCoords(e.touches[0]);

        if (this.panelSlider && this.panelSlider.dragging) {
            this._updateSlider(pos.x);
            return;
        }

        if (this.isDragging && this.dragTarget) {
            const bounds = this._getLayout().preview;
            const surface = this._getSurfaceSize();
            const cfg = this._getControllerConfig(this.dragTarget);
            const radius = this.dragTarget.type === 'joystick' ? cfg.outerRadius : cfg.radius;
            const mappedPos = this._previewToSurfacePoint(pos.x - this.dragOffsetX, pos.y - this.dragOffsetY, bounds);
            const clamped = ControlsSettings.clampPosition(
                mappedPos.x,
                mappedPos.y,
                radius,
                surface.width,
                surface.height
            );
            cfg.x = clamped.x;
            cfg.y = clamped.y;
            return;
        }

        if (this.dragTarget && !this.isDragging) {
            const dx = pos.x - this.dragStartX;
            const dy = pos.y - this.dragStartY;
            if (Math.sqrt(dx * dx + dy * dy) > 10) this.longPressTimer = 0;
        }
    }

    _handleTouchEnd(e) {
        e.preventDefault();

        if (this.panelSlider && this.panelSlider.dragging) {
            this.panelSlider.dragging = false;
            this.panelSlider = null;
            return;
        }

        if (this.isDragging && this.dragTarget) {
            this.isDragging = false;
            this.dragTarget = null;
            this.longPressTimer = 0;
            return;
        }

        if (this.dragTarget && this.longPressTimer > 0) {
            this._openPanel(this.dragTarget);
        }

        this.dragTarget = null;
        this.longPressTimer = 0;
        this.isDragging = false;
    }

    _openPanel(target) {
        this.showPanel = true;
        this.panelTarget = { type: target.type, player: target.player };
        this.panelSlider = null;
        this.panelSnapshot = JSON.parse(JSON.stringify(this._getControllerConfig(target)));
    }

    _closePanel(commit) {
        if (!commit && this.panelTarget && this.panelSnapshot) {
            const cfg = this._getControllerConfig(this.panelTarget);
            Object.assign(cfg, JSON.parse(JSON.stringify(this.panelSnapshot)));
        }

        this.showPanel = false;
        this.panelTarget = null;
        this.panelSlider = null;
        this.panelSnapshot = null;
    }

    _getSurfaceSize() {
        if (this._input && this._input._canvas) {
            return {
                width: this._input._canvas.width,
                height: this._input._canvas.height
            };
        }

        return {
            width: getTouchReferenceWidth(),
            height: getTouchReferenceHeight()
        };
    }

    _surfaceToPreviewPoint(x, y, bounds) {
        const surface = this._getSurfaceSize();
        return {
            x: bounds.x + (x / surface.width) * bounds.w,
            y: bounds.y + (y / surface.height) * bounds.h
        };
    }

    _previewToSurfacePoint(x, y, bounds) {
        const surface = this._getSurfaceSize();
        return {
            x: ((x - bounds.x) / bounds.w) * surface.width,
            y: ((y - bounds.y) / bounds.h) * surface.height
        };
    }

    _surfaceToPreviewRadius(radius, bounds) {
        const surface = this._getSurfaceSize();
        return radius * Math.min(bounds.w / surface.width, bounds.h / surface.height);
    }

    _projectJoystickToPreview(config, bounds) {
        const point = this._surfaceToPreviewPoint(config.x, config.y, bounds);
        const scale = this._surfaceToPreviewRadius(1, bounds);
        return {
            x: point.x,
            y: point.y,
            outerRadius: config.outerRadius * scale,
            innerRadius: config.innerRadius * scale,
            maxDistance: config.maxDistance * scale,
            deadZone: config.deadZone * scale
        };
    }

    _projectFireButtonToPreview(config, bounds) {
        const point = this._surfaceToPreviewPoint(config.x, config.y, bounds);
        return {
            x: point.x,
            y: point.y,
            radius: this._surfaceToPreviewRadius(config.radius, bounds)
        };
    }

    _getPreviewControllerConfig(target, bounds) {
        const cfg = this._getControllerConfig(target);
        return target.type === 'joystick'
            ? this._projectJoystickToPreview(cfg, bounds)
            : this._projectFireButtonToPreview(cfg, bounds);
    }

    _getLayout() {
        return {
            modeButtons: {
                single: { x: CANVAS_W / 2 - 152, y: 104, w: 136, h: 42, radius: 18 },
                dual: { x: CANVAS_W / 2 + 16, y: 104, w: 136, h: 42, radius: 18 }
            },
            preview: { x: 24, y: 84, w: CANVAS_W - 48, h: 500, radius: 30 },
            guide: { x: 170, y: 448, w: 500, h: 68, radius: 20 },
            actions: {
                reset: { x: 198, y: 530, w: 130, h: 42, radius: 18 },
                save: { x: 355, y: 530, w: 130, h: 42, radius: 18 },
                back: { x: 512, y: 530, w: 130, h: 42, radius: 18 }
            }
        };
    }

    _getPanelLayout() {
        const isJoystick = this.panelTarget && this.panelTarget.type === 'joystick';
        const w = 360;
        const h = isJoystick ? 250 : 210;
        const x = CANVAS_W / 2 - w / 2;
        const y = CANVAS_H / 2 - h / 2;
        const trackX = x + 32;
        const trackW = w - 64;
        const sizeSliderY = y + 104;
        const deadZoneSliderY = y + 158;
        const buttonY = y + h - 52;

        return {
            x,
            y,
            w,
            h,
            radius: 24,
            sliders: {
                size: { x: trackX, y: sizeSliderY, w: trackW },
                deadZone: { x: trackX, y: deadZoneSliderY, w: trackW }
            },
            buttons: {
                confirm: { x: x + 44, y: buttonY, w: 118, h: 38, radius: 16 },
                cancel: { x: x + w - 162, y: buttonY, w: 118, h: 38, radius: 16 }
            }
        };
    }

    _getPanelButtons() {
        return this._getPanelLayout().buttons;
    }

    _checkSliderHit(x, y) {
        if (!this.panelTarget) return null;

        const panel = this._getPanelLayout();
        if (x >= panel.sliders.size.x && x <= panel.sliders.size.x + panel.sliders.size.w &&
            Math.abs(y - panel.sliders.size.y) <= 18) {
            return { param: 'size' };
        }

        if (this.panelTarget.type === 'joystick' &&
            x >= panel.sliders.deadZone.x && x <= panel.sliders.deadZone.x + panel.sliders.deadZone.w &&
            Math.abs(y - panel.sliders.deadZone.y) <= 18) {
            return { param: 'deadZone' };
        }

        return null;
    }

    _updateSlider(x) {
        if (!this.panelSlider || !this.panelTarget) return;

        const panel = this._getPanelLayout();
        const slider = this.panelSlider.param === 'deadZone' ? panel.sliders.deadZone : panel.sliders.size;
        const ratio = clamp((x - slider.x) / slider.w, 0, 1);
        const cfg = this._getControllerConfig(this.panelTarget);

        if (this.panelSlider.param === 'size') {
            if (this.panelTarget.type === 'joystick') {
                const value = Math.round(lerp(JOYSTICK_OUTER_RADIUS_MIN, JOYSTICK_OUTER_RADIUS_MAX, ratio));
                cfg.outerRadius = ControlsSettings.clampJoystickRadius(value);
                cfg.innerRadius = Math.round(cfg.outerRadius * 0.42);
                cfg.maxDistance = Math.round(cfg.outerRadius * 0.83);
                cfg.deadZone = ControlsSettings.clampDeadZone(cfg.deadZone);
            } else {
                const value = Math.round(lerp(FIRE_BUTTON_RADIUS_MIN, FIRE_BUTTON_RADIUS_MAX, ratio));
                cfg.radius = ControlsSettings.clampFireButtonRadius(value);
            }
        } else {
            const value = Math.round(lerp(JOYSTICK_DEAD_ZONE_MIN, JOYSTICK_DEAD_ZONE_MAX, ratio));
            cfg.deadZone = ControlsSettings.clampDeadZone(value);
        }
    }

    _checkButtonClick(x, y) {
        const layout = this._getLayout();

        if (this._isInRect(x, y, layout.modeButtons.single)) {
            this.mode = 'single';
            this.showPanel = false;
            this.panelTarget = null;
            this.panelSnapshot = null;
            return;
        }
        if (this._isInRect(x, y, layout.modeButtons.dual)) {
            this.mode = 'dual';
            this.showPanel = false;
            this.panelTarget = null;
            this.panelSnapshot = null;
            return;
        }

        if (this._isInRect(x, y, layout.actions.reset)) {
            const surface = this._getSurfaceSize();
            this.tempConfig = ControlsSettings.getDefault(surface.width, surface.height);
            this.showPanel = false;
            this.panelTarget = null;
            this.panelSlider = null;
            this.panelSnapshot = null;
            return;
        }

        if (this._isInRect(x, y, layout.actions.save)) {
            const surface = this._getSurfaceSize();
            this.config = JSON.parse(JSON.stringify(this.tempConfig));
            ControlsSettings.save(this.config, surface.width, surface.height);
            this.saved = true;
            this.done = true;
            return;
        }

        if (this._isInRect(x, y, layout.actions.back)) {
            this.done = true;
        }
    }

    _getControllerAt(x, y) {
        const cfg = this.mode === 'single' ? this.tempConfig.singlePlayer : this.tempConfig.dualPlayer;
        const bounds = this._getLayout().preview;
        const hitPadding = 24;

        if (this.mode === 'single') {
            const joystick = this._projectJoystickToPreview(cfg.joystick, bounds);
            const fireButton = this._projectFireButtonToPreview(cfg.fireButton, bounds);
            if (vecDist(vec2(x, y), vec2(joystick.x, joystick.y)) <= joystick.outerRadius + hitPadding) {
                return { type: 'joystick', player: 0 };
            }
            if (vecDist(vec2(x, y), vec2(fireButton.x, fireButton.y)) <= fireButton.radius + hitPadding) {
                return { type: 'fire', player: 0 };
            }
            return null;
        }

        for (let player = 0; player < 2; player++) {
            const playerCfg = player === 0 ? cfg.player1 : cfg.player2;
            const joystick = this._projectJoystickToPreview(playerCfg.joystick, bounds);
            const fireButton = this._projectFireButtonToPreview(playerCfg.fireButton, bounds);
            if (vecDist(vec2(x, y), vec2(joystick.x, joystick.y)) <= joystick.outerRadius + hitPadding) {
                return { type: 'joystick', player };
            }
            if (vecDist(vec2(x, y), vec2(fireButton.x, fireButton.y)) <= fireButton.radius + hitPadding) {
                return { type: 'fire', player };
            }
        }

        return null;
    }

    _getControllerConfig(target) {
        const cfg = this.mode === 'single' ? this.tempConfig.singlePlayer : this.tempConfig.dualPlayer;
        if (this.mode === 'single') {
            return target.type === 'joystick' ? cfg.joystick : cfg.fireButton;
        }

        const playerCfg = target.player === 0 ? cfg.player1 : cfg.player2;
        return target.type === 'joystick' ? playerCfg.joystick : playerCfg.fireButton;
    }

    draw(ctx) {
        const layout = this._getLayout();

        ctx.save();
        ctx.fillStyle = Theme.colors.bg;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.translate(VIEWPORT_OFFSET_X, VIEWPORT_OFFSET_Y);
        ctx.scale(VIEWPORT_SCALE, VIEWPORT_SCALE);

        TouchUI.drawTitle(ctx, t('controlsTitle'), t('controlsSubtitle'), Theme.colors.tanks[0], 36);
        this._drawModeButton(ctx, layout.modeButtons.single, t('singleMode'), this.mode === 'single', Theme.colors.tanks[0]);
        this._drawModeButton(ctx, layout.modeButtons.dual, t('dualMode'), this.mode === 'dual', Theme.colors.tanks[1]);
        this._drawPreview(ctx, layout.preview);
        this._drawGuideBox(ctx, layout.guide);
        this._drawActionButton(ctx, layout.actions.reset, t('resetDefault'), 'reset');
        this._drawActionButton(ctx, layout.actions.save, t('save'), 'save');
        this._drawActionButton(ctx, layout.actions.back, t('back'), 'back');

        if (this.showPanel && this.panelTarget) {
            this._drawPanel(ctx);
        }

        ctx.restore();
    }

    _drawModeButton(ctx, rect, text, selected, accentColor) {
        TouchUI.drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
            radius: rect.radius,
            fill: selected ? colorWithAlpha(accentColor, Theme.current === 'dark' ? 0.24 : 0.18) : TouchUI.surfaceSoftFill(1),
            border: selected ? colorWithAlpha(accentColor, 0.52) : TouchUI.surfaceStroke(1),
            inset: TouchUI.innerStroke(1),
            shadow: false,
            glowColor: selected ? colorWithAlpha(accentColor, 0.2) : null,
            glowWidth: 2
        });

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = selected ? 'bold 15px monospace' : '14px monospace';
        ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2);
        ctx.restore();
    }

    _drawPreview(ctx, bounds) {
        TouchUI.drawPanel(ctx, bounds.x, bounds.y, bounds.w, bounds.h, {
            radius: bounds.radius,
            fill: TouchUI.surfaceFill(0.98),
            border: colorWithAlpha(Theme.colors.tanks[0], 0.22),
            inset: TouchUI.innerStroke(1),
            shadowBlur: 24,
            shadowOffsetY: 8
        });

        ctx.save();
        roundedRectPath(ctx, bounds.x, bounds.y, bounds.w, bounds.h, bounds.radius);
        ctx.clip();
        TouchUI.drawDottedGrid(ctx, bounds.x, bounds.y, bounds.w, bounds.h, { alpha: 0.12 });

        const wash = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + bounds.h);
        wash.addColorStop(0, colorWithAlpha(Theme.colors.tanks[0], 0.08));
        wash.addColorStop(0.4, colorWithAlpha(Theme.colors.tanks[1], 0.04));
        wash.addColorStop(1, colorWithAlpha(Theme.colors.tanks[0], 0));
        ctx.fillStyle = wash;
        ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
        ctx.restore();

        TouchUI.drawPill(ctx, bounds.x + 20, bounds.y + 16, 118, 26, t('previewArea'), {
            accentColor: Theme.colors.tanks[0],
            textColor: Theme.colors.text.primary,
            fillOpacity: 0.12,
            borderOpacity: 0.3
        });

        TouchUI.drawPill(ctx, bounds.x + bounds.w - 156, bounds.y + 16, 136, 26, t(this.mode === 'single' ? 'singleMode' : 'dualMode'), {
            accentColor: this.mode === 'single' ? Theme.colors.tanks[0] : Theme.colors.tanks[1],
            textColor: Theme.colors.text.primary,
            fillOpacity: 0.12,
            borderOpacity: 0.3
        });

        this._drawAlignmentGuides(ctx, bounds);
        this._drawControllers(ctx, bounds);
    }

    _drawAlignmentGuides(ctx, bounds) {
        if (!(this.isDragging && this.dragTarget)) return;

        const cfg = this._getPreviewControllerConfig(this.dragTarget, bounds);
        const accent = TouchUI.playerColor(this.dragTarget.player);

        ctx.save();
        roundedRectPath(ctx, bounds.x, bounds.y, bounds.w, bounds.h, bounds.radius);
        ctx.clip();
        ctx.strokeStyle = colorWithAlpha(accent, 0.45);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(bounds.x, cfg.y);
        ctx.lineTo(bounds.x + bounds.w, cfg.y);
        ctx.moveTo(cfg.x, bounds.y);
        ctx.lineTo(cfg.x, bounds.y + bounds.h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    _drawControllers(ctx, bounds) {
        const cfg = this.mode === 'single' ? this.tempConfig.singlePlayer : this.tempConfig.dualPlayer;
        const previewBounds = bounds || this._getLayout().preview;

        if (this.mode === 'single') {
            this._drawJoystick(ctx, this._projectJoystickToPreview(cfg.joystick, previewBounds), 0);
            this._drawFireButton(ctx, this._projectFireButtonToPreview(cfg.fireButton, previewBounds), 0);
            return;
        }

        this._drawJoystick(ctx, this._projectJoystickToPreview(cfg.player1.joystick, previewBounds), 0);
        this._drawFireButton(ctx, this._projectFireButtonToPreview(cfg.player1.fireButton, previewBounds), 0);
        this._drawJoystick(ctx, this._projectJoystickToPreview(cfg.player2.joystick, previewBounds), 1);
        this._drawFireButton(ctx, this._projectFireButtonToPreview(cfg.player2.fireButton, previewBounds), 1);
    }

    _drawJoystick(ctx, config, playerIndex) {
        const accent = TouchUI.playerColor(playerIndex);
        const deepAccent = TouchUI.playerDeepColor(playerIndex);
        const focus = this._isControllerFocused('joystick', playerIndex);

        ctx.save();
        if (focus && this.isDragging) {
            ctx.shadowColor = colorWithAlpha(accent, 0.34);
            ctx.shadowBlur = 22;
            ctx.shadowOffsetY = 6;
        }

        ctx.globalAlpha = focus && this.isDragging ? 0.94 : 0.86;

        ctx.beginPath();
        ctx.arc(config.x, config.y, config.outerRadius + 6, 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha(accent, focus ? 0.12 : 0.06);
        ctx.fill();

        const base = ctx.createRadialGradient(
            config.x - config.outerRadius * 0.2,
            config.y - config.outerRadius * 0.25,
            config.outerRadius * 0.1,
            config.x,
            config.y,
            config.outerRadius
        );
        base.addColorStop(0, Theme.current === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)');
        base.addColorStop(1, Theme.current === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)');
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(config.x, config.y, config.outerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = colorWithAlpha(accent, focus ? 0.88 : 0.54);
        ctx.lineWidth = focus ? 2.5 : 2;
        ctx.stroke();

        if (config.deadZone > 0) {
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = Theme.current === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.18)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(config.x, config.y, config.deadZone, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        const head = ctx.createRadialGradient(
            config.x - config.innerRadius * 0.35,
            config.y - config.innerRadius * 0.35,
            config.innerRadius * 0.1,
            config.x,
            config.y,
            config.innerRadius
        );
        head.addColorStop(0, lightenColor(accent, 0.28));
        head.addColorStop(1, deepAccent);
        ctx.fillStyle = head;
        ctx.beginPath();
        ctx.arc(config.x, config.y, config.innerRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(config.x - config.innerRadius * 0.24, config.y - config.innerRadius * 0.24, config.innerRadius * 0.26, 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha('#FFFFFF', 0.26);
        ctx.fill();
        ctx.restore();

        TouchUI.drawPill(ctx, config.x - 32, config.y + config.outerRadius + 12, 64, 24, `P${playerIndex + 1} MOVE`, {
            accentColor: accent,
            textColor: Theme.colors.text.primary,
            font: 'bold 11px monospace',
            fillOpacity: focus ? 0.16 : 0.1,
            borderOpacity: focus ? 0.4 : 0.22
        });

        this._drawLongPressRing(ctx, config.x, config.y, config.outerRadius + 12, playerIndex, 'joystick');
    }

    _drawFireButton(ctx, config, playerIndex) {
        const accent = TouchUI.playerColor(playerIndex);
        const focus = this._isControllerFocused('fire', playerIndex);

        ctx.save();
        if (focus && this.isDragging) {
            ctx.shadowColor = colorWithAlpha(accent, 0.28);
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 6;
        }

        ctx.globalAlpha = focus && this.isDragging ? 0.94 : 0.9;

        ctx.beginPath();
        ctx.arc(config.x, config.y, config.radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha(accent, focus ? 0.12 : 0.05);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(config.x, config.y, config.radius + 2, 0, Math.PI * 2);
        ctx.fillStyle = Theme.current === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)';
        ctx.fill();

        const core = ctx.createRadialGradient(
            config.x - config.radius * 0.3,
            config.y - config.radius * 0.35,
            config.radius * 0.08,
            config.x,
            config.y,
            config.radius
        );
        core.addColorStop(0, '#FF8A73');
        core.addColorStop(0.55, '#E95B42');
        core.addColorStop(1, '#922012');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(config.x, config.y, config.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(config.x - config.radius * 0.24, config.y - config.radius * 0.28, config.radius * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = colorWithAlpha('#FFFFFF', 0.24);
        ctx.fill();

        ctx.strokeStyle = colorWithAlpha(accent, focus ? 0.72 : 0.38);
        ctx.lineWidth = focus ? 2.5 : 2;
        ctx.beginPath();
        ctx.arc(config.x, config.y, config.radius + 2, 0, Math.PI * 2);
        ctx.stroke();

        TouchUI.drawCrosshair(ctx, config.x, config.y, Math.max(16, config.radius * 0.38), colorWithAlpha('#FFFFFF', 0.88), 2.5);
        ctx.restore();

        TouchUI.drawPill(ctx, config.x - 30, config.y + config.radius + 12, 60, 24, `P${playerIndex + 1} FIRE`, {
            accentColor: accent,
            textColor: Theme.colors.text.primary,
            font: 'bold 11px monospace',
            fillOpacity: focus ? 0.16 : 0.1,
            borderOpacity: focus ? 0.4 : 0.22
        });

        this._drawLongPressRing(ctx, config.x, config.y, config.radius + 12, playerIndex, 'fire');
    }

    _drawLongPressRing(ctx, x, y, radius, playerIndex, type) {
        if (!(this.longPressTimer > 0 && this.dragTarget &&
            this.dragTarget.type === type &&
            this.dragTarget.player === playerIndex)) {
            return;
        }

        const progress = 1 - (this.longPressTimer / 0.3);
        const accent = TouchUI.playerColor(playerIndex);

        ctx.save();
        ctx.strokeStyle = colorWithAlpha(accent, 0.88);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
        ctx.restore();
    }

    _drawGuideBox(ctx, rect) {
        TouchUI.drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
            radius: rect.radius,
            fill: TouchUI.surfaceFill(0.9),
            border: TouchUI.surfaceStroke(1),
            inset: TouchUI.innerStroke(1),
            shadow: false
        });

        const steps = [
            `1  ${t('tapToOpenPanel')}`,
            `2  ${t('longPressToDrag')}`,
            `3  ${t('dragToMove')}`
        ];

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = Theme.colors.text.secondary;
        ctx.font = '12px monospace';
        for (let i = 0; i < steps.length; i++) {
            ctx.fillText(steps[i], rect.x + 22, rect.y + 22 + i * 16);
        }
        ctx.restore();
    }

    _drawActionButton(ctx, rect, text, type) {
        const label = this._plainLabel(text);
        const palette = {
            reset: { fill: '#E3A33A', border: '#D18912' },
            save: { fill: Theme.colors.tanks[2] || '#3BAA57', border: darkenColor(Theme.colors.tanks[2] || '#3BAA57', 0.2) },
            back: { fill: Theme.current === 'dark' ? '#545454' : '#E0D6C2', border: Theme.current === 'dark' ? '#737373' : '#B5A78A' }
        }[type];

        TouchUI.drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
            radius: rect.radius,
            fill: colorWithAlpha(palette.fill, Theme.current === 'dark' ? 0.26 : 0.32),
            border: colorWithAlpha(palette.border, 0.58),
            inset: TouchUI.innerStroke(1),
            shadow: false,
            glowColor: type === 'save' ? colorWithAlpha(palette.border, 0.16) : null
        });

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = 'bold 15px monospace';
        ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
        ctx.restore();
    }

    _drawPanel(ctx) {
        const panel = this._getPanelLayout();
        const isJoystick = this.panelTarget.type === 'joystick';
        const cfg = this._getControllerConfig(this.panelTarget);
        const accent = TouchUI.playerColor(this.panelTarget.player);

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.46)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.restore();

        TouchUI.drawPanel(ctx, panel.x, panel.y, panel.w, panel.h, {
            radius: panel.radius,
            fill: Theme.current === 'dark' ? 'rgba(22,22,22,0.96)' : 'rgba(255,249,238,0.97)',
            border: colorWithAlpha(accent, 0.42),
            inset: TouchUI.innerStroke(1),
            shadowBlur: 26,
            shadowOffsetY: 10,
            glowColor: colorWithAlpha(accent, 0.14),
            glowWidth: 2
        });

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = 'bold 21px monospace';
        ctx.fillText(isJoystick ? t('joystickSize') : t('buttonSize'), panel.x + panel.w / 2, panel.y + 24);
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.font = '12px monospace';
        ctx.fillText(`P${this.panelTarget.player + 1} - ${t(this.mode === 'single' ? 'singleMode' : 'dualMode')}`, panel.x + panel.w / 2, panel.y + 54);
        ctx.restore();

        this._drawSlider(ctx, panel.sliders.size, isJoystick ? t('joystickSize') : t('buttonSize'), isJoystick ? cfg.outerRadius : cfg.radius,
            isJoystick ? JOYSTICK_OUTER_RADIUS_MIN : FIRE_BUTTON_RADIUS_MIN,
            isJoystick ? JOYSTICK_OUTER_RADIUS_MAX : FIRE_BUTTON_RADIUS_MAX,
            accent);

        if (isJoystick) {
            this._drawSlider(ctx, panel.sliders.deadZone, t('deadZone'), cfg.deadZone,
                JOYSTICK_DEAD_ZONE_MIN, JOYSTICK_DEAD_ZONE_MAX, accent);
        }

        this._drawPanelButton(ctx, panel.buttons.confirm, t('confirm'), accent, true);
        this._drawPanelButton(ctx, panel.buttons.cancel, t('cancel'), accent, false);
    }

    _drawPanelButton(ctx, rect, text, accent, primary) {
        TouchUI.drawPanel(ctx, rect.x, rect.y, rect.w, rect.h, {
            radius: rect.radius,
            fill: primary
                ? colorWithAlpha(accent, Theme.current === 'dark' ? 0.24 : 0.2)
                : TouchUI.surfaceSoftFill(1),
            border: primary ? colorWithAlpha(accent, 0.48) : TouchUI.surfaceStroke(1),
            inset: TouchUI.innerStroke(1),
            shadow: false
        });

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = 'bold 14px monospace';
        ctx.fillText(this._plainLabel(text), rect.x + rect.w / 2, rect.y + rect.h / 2);
        ctx.restore();
    }

    _drawSlider(ctx, rect, label, value, min, max, accent) {
        const ratio = max === min ? 0 : clamp((value - min) / (max - min), 0, 1);
        const knobX = rect.x + rect.w * ratio;
        const trackH = 10;

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = 'bold 13px monospace';
        ctx.fillText(label, rect.x, rect.y - 22);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = Theme.current === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.16)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const tickX = rect.x + (rect.w / 4) * i;
            ctx.beginPath();
            ctx.moveTo(tickX, rect.y + 12);
            ctx.lineTo(tickX, rect.y + 18);
            ctx.stroke();
        }
        ctx.restore();

        TouchUI.drawPanel(ctx, rect.x, rect.y - trackH / 2, rect.w, trackH, {
            radius: trackH / 2,
            fill: Theme.current === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)',
            border: 'transparent',
            inset: 'transparent',
            shadow: false,
            lineWidth: 0
        });

        if (ratio > 0) {
            const progress = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y);
            progress.addColorStop(0, colorWithAlpha(lightenColor(accent, 0.08), 0.75));
            progress.addColorStop(1, colorWithAlpha(darkenColor(accent, 0.12), 0.78));
            TouchUI.drawPanel(ctx, rect.x, rect.y - trackH / 2, Math.max(trackH, rect.w * ratio), trackH, {
                radius: trackH / 2,
                fill: progress,
                border: 'transparent',
                inset: 'transparent',
                shadow: false,
                lineWidth: 0
            });
        }

        TouchUI.drawPill(ctx, knobX - 22, rect.y - 40, 44, 24, String(Math.round(value)), {
            accentColor: accent,
            textColor: Theme.colors.text.primary,
            font: 'bold 12px monospace',
            fillOpacity: 0.16,
            borderOpacity: 0.36
        });

        ctx.save();
        ctx.shadowColor = TouchUI.shadow(1);
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;

        const knobGrad = ctx.createRadialGradient(
            knobX - 4, rect.y - 4, 2,
            knobX, rect.y, 13
        );
        knobGrad.addColorStop(0, '#FFFFFF');
        knobGrad.addColorStop(1, Theme.current === 'dark' ? '#D6D6D6' : '#E7DFD2');
        ctx.fillStyle = knobGrad;
        ctx.beginPath();
        ctx.arc(knobX, rect.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = colorWithAlpha(accent, 0.4);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    _isControllerFocused(type, playerIndex) {
        const isDragTarget = this.dragTarget &&
            this.dragTarget.type === type &&
            this.dragTarget.player === playerIndex;
        const isPanelTarget = this.panelTarget &&
            this.panelTarget.type === type &&
            this.panelTarget.player === playerIndex;
        return !!(isDragTarget || isPanelTarget);
    }

    _plainLabel(text) {
        return text.replace(/\[/g, '').replace(/\]/g, '').trim();
    }

    _isInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    }
}
