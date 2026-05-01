var ALL_MODES = [
    { key: '1pvai', players: 1, ai: 1 },
    { key: '2p', players: 2, ai: 0 },
    { key: '2pvai', players: 2, ai: 1 },
    { key: '3p', players: 3, ai: 0 },
    { key: '1pv2ai', players: 1, ai: 2 },
];

function getAvailableModes(input) {
    if (input && input.touchEnabled) {
        return ALL_MODES.filter((mode) => mode.players !== 3);
    }
    return ALL_MODES;
}

var MODES = ALL_MODES;
var WIN_SCORES = [3, 5, 7, 10];
var DIFFICULTIES = ['easy', 'medium', 'hard'];
var SINGLE_PLAYER_CONTROL_OPTIONS = ['keyboard_arrows', 'keyboard_wasd', 'mouse'];
const SINGLE_PLAYER_CONTROL_STORAGE_KEY = 'tankgame_single_player_control';

function loadSinglePlayerControlMode() {
    try {
        const saved = localStorage.getItem(SINGLE_PLAYER_CONTROL_STORAGE_KEY);
        if (SINGLE_PLAYER_CONTROL_OPTIONS.indexOf(saved) !== -1) {
            return saved;
        }
    } catch (e) {
        console.warn('[Menu] Failed to load single player control mode:', e);
    }
    return SINGLE_PLAYER_CONTROL_OPTIONS[0];
}

function saveSinglePlayerControlMode(mode) {
    if (SINGLE_PLAYER_CONTROL_OPTIONS.indexOf(mode) === -1) return;
    try {
        localStorage.setItem(SINGLE_PLAYER_CONTROL_STORAGE_KEY, mode);
    } catch (e) {
        console.warn('[Menu] Failed to save single player control mode:', e);
    }
}

class Menu {
    constructor() {
        this.modeIndex = 0;
        this.scoreIndex = 1;
        this.diffIndex = 1;
        this.row = 0;
        this.maxRow = 4;

        this.done = false;
        this.result = null;
        this.page = 'main';
        this.settingsRow = 0;
        this.settingsMaxRow = 2;
        this.openSettings = false;
        this.openControlsConfig = false;
        this.singleControlIndex = SINGLE_PLAYER_CONTROL_OPTIONS.indexOf(loadSinglePlayerControlMode());
        if (this.singleControlIndex < 0) this.singleControlIndex = 0;

        this._input = null;
        this._prevKeys = new Set();
        this._onTouchEnd = null;
    }

    activate(input) {
        this.done = false;
        this.result = null;
        this.page = 'main';
        this.openSettings = false;
        this.openControlsConfig = false;
        this._input = input;
        this._prevKeys = new Set();

        this._refreshAvailableModes();

        this.settingsMaxRow = this._getSettingsItems().length - 1;
        this._refreshTouchEndBinding();
    }

    deactivate() {
        this._unbindTouchEndBinding();
    }

    _refreshAvailableModes() {
        const currentModeKey = MODES[this.modeIndex] ? MODES[this.modeIndex].key : (ALL_MODES[0] ? ALL_MODES[0].key : '1pvai');
        MODES = getAvailableModes(this._input);
        const nextIndex = MODES.findIndex((mode) => mode.key === currentModeKey);
        this.modeIndex = nextIndex >= 0 ? nextIndex : 0;
    }

    _unbindTouchEndBinding() {
        if (this._onTouchEnd && this._input && this._input._canvas) {
            this._input._canvas.removeEventListener('touchend', this._onTouchEnd);
        }
        this._onTouchEnd = null;
    }

    _refreshTouchEndBinding() {
        const input = this._input;
        const shouldBind = !!(input && input.touchEnabled && input._canvas);
        if (!shouldBind) {
            this._unbindTouchEndBinding();
            return;
        }

        if (this._onTouchEnd) return;

        this._onTouchEnd = (e) => {
            if (typeof gameState !== 'undefined' &&
                gameState.current !== STATE.MENU &&
                gameState.current !== STATE.SETTINGS) {
                return;
            }

            e.preventDefault();
            if (!e.changedTouches.length) return;

            const pos = input._touchToCanvasCoords(e.changedTouches[0]);
            if (this.page === 'main') {
                this._handleMainTouch(pos.x, pos.y);
            } else {
                this._handleSettingsTouch(pos.x, pos.y);
            }
        };
        input._canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
    }

    update() {
        if (this.page === 'main') {
            this._updateMain();
        } else {
            this._updateSettings();
        }
    }

    _updateMain() {
        const input = this._input;
        const justPressed = (code) => {
            const down = input.isDown(code);
            const was = this._prevKeys.has(code);
            if (down && !was) {
                this._prevKeys.add(code);
                return true;
            }
            if (!down) this._prevKeys.delete(code);
            return false;
        };

        const upPressed = justPressed('ArrowUp') || justPressed('KeyW');
        const downPressed = justPressed('ArrowDown') || justPressed('KeyS');
        const leftPressed = justPressed('ArrowLeft') || justPressed('KeyA');
        const rightPressed = justPressed('ArrowRight') || justPressed('KeyD');
        const confirmPressed = justPressed('Enter') || justPressed('Space');

        if (upPressed) this.row = Math.max(0, this.row - 1);
        if (downPressed) this.row = Math.min(this.maxRow, this.row + 1);

        if (leftPressed) this._changeMainOption(this.row, -1);
        if (rightPressed) this._changeMainOption(this.row, 1);

        if (confirmPressed) {
            if (this.row === 3) this._startGame();
            if (this.row === 4) this._openSettings();
        }
    }

    _updateSettings() {
        const input = this._input;
        const items = this._getSettingsItems();
        const justPressed = (code) => {
            const down = input.isDown(code);
            const was = this._prevKeys.has(code);
            if (down && !was) {
                this._prevKeys.add(code);
                return true;
            }
            if (!down) this._prevKeys.delete(code);
            return false;
        };

        const upPressed = justPressed('ArrowUp') || justPressed('KeyW');
        const downPressed = justPressed('ArrowDown') || justPressed('KeyS');
        const leftPressed = justPressed('ArrowLeft') || justPressed('KeyA');
        const rightPressed = justPressed('ArrowRight') || justPressed('KeyD');
        const confirmPressed = justPressed('Enter') || justPressed('Space');
        const escPressed = justPressed('Escape');

        this.settingsMaxRow = items.length - 1;
        if (upPressed) this.settingsRow = Math.max(0, this.settingsRow - 1);
        if (downPressed) this.settingsRow = Math.min(this.settingsMaxRow, this.settingsRow + 1);

        if (leftPressed) this._changeSettingsOption(this.settingsRow, -1);
        if (rightPressed) this._changeSettingsOption(this.settingsRow, 1);

        if (confirmPressed) {
            const selectedItem = items[this.settingsRow];
            this._activateSettingsItem(selectedItem);
        }

        if (escPressed) this._closeSettings();
    }

    _changeMainOption(row, direction) {
        if (row === 0) this.modeIndex = (this.modeIndex + direction + MODES.length) % MODES.length;
        if (row === 1) this.scoreIndex = (this.scoreIndex + direction + WIN_SCORES.length) % WIN_SCORES.length;
        if (row === 2) this.diffIndex = (this.diffIndex + direction + DIFFICULTIES.length) % DIFFICULTIES.length;
    }

    _changeSettingsOption(row, direction) {
        const item = this._getSettingsItems()[row];
        if (!item || item.kind !== 'adjust') return;

        if (item.setting === 'language') {
            if (direction < 0) I18n.prevLang();
            else I18n.nextLang();
        }
        if (item.setting === 'theme') Theme.toggle();
        if (item.setting === 'singleControl') this._cycleSinglePlayerControl(direction);
    }

    _startGame() {
        const mode = MODES[this.modeIndex];
        this.result = {
            humanCount: mode.players,
            aiCount: mode.ai,
            winScore: WIN_SCORES[this.scoreIndex],
            difficulty: DIFFICULTIES[this.diffIndex],
            singleControlMode: this._getSinglePlayerControlMode(),
        };
        this.done = true;
    }

    _openSettings() {
        this.page = 'settings';
        this.settingsRow = 0;
        this.openSettings = true;
    }

    _closeSettings() {
        this.page = 'main';
        this.openSettings = false;
    }

    _handleMainTouch(x, y) {
        const layout = this._getTouchMainLayout();

        for (let i = 0; i < layout.options.length; i++) {
            const card = layout.options[i];
            if (!this._isInRect(x, y, card)) continue;

            this.row = i;
            if (i < 3) {
                this._changeMainOption(i, x < card.x + card.w / 2 ? -1 : 1);
            } else if (i === 3) {
                this._startGame();
            } else if (i === 4) {
                this._openSettings();
            }
            return;
        }
    }

    _handleSettingsTouch(x, y) {
        const layout = this._getTouchSettingsLayout();
        const items = this._getSettingsItems();

        for (let i = 0; i < layout.options.length; i++) {
            const card = layout.options[i];
            if (!this._isInRect(x, y, card)) continue;

            this.settingsRow = i;
            if (card.kind === 'adjust') {
                this._changeSettingsOption(i, x < card.x + card.w / 2 ? -1 : 1);
            } else {
                this._activateSettingsItem(items[i]);
            }
            return;
        }
    }

    _activateSettingsItem(item) {
        if (!item) return;
        if (item.kind === 'controls') {
            this.openControlsConfig = true;
            return;
        }
        if (item.kind === 'action' && item.action === 'switchUiMode') {
            this._switchUiMode(item.mode);
            return;
        }
        if (item.kind === 'back') {
            this._closeSettings();
        }
    }

    _switchUiMode(mode) {
        if (!this._input || typeof this._input.setUiMode !== 'function') return;
        this._input.setUiMode(mode);
        this._refreshAvailableModes();
        this.settingsMaxRow = this._getSettingsItems().length - 1;
        this.settingsRow = clamp(this.settingsRow, 0, this.settingsMaxRow);
        this._prevKeys.clear();
        this._refreshTouchEndBinding();
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = Theme.colors.bg;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.translate(VIEWPORT_OFFSET_X, VIEWPORT_OFFSET_Y);
        ctx.scale(VIEWPORT_SCALE, VIEWPORT_SCALE);

        if (this._input && this._input.touchEnabled) {
            if (this.page === 'main') this._drawTouchMain(ctx);
            else this._drawTouchSettings(ctx);
        } else {
            if (this.page === 'main') this._drawKeyboardMain(ctx);
            else this._drawKeyboardSettings(ctx);
        }

        ctx.restore();
    }

    _drawKeyboardMain(ctx) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px monospace';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.fillText(t('title'), CANVAS_W / 2, 100);
        ctx.font = '16px monospace';
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.fillText(t('subtitle'), CANVAS_W / 2, 125);

        const startY = 180;
        const gap = 55;
        const items = [
            { label: t('mode'), value: t(MODES[this.modeIndex].key) },
            { label: t('winScore'), value: String(WIN_SCORES[this.scoreIndex]) },
            { label: t('aiDifficulty'), value: t(DIFFICULTIES[this.diffIndex]) },
            { label: t('startGame'), value: '' },
            { label: t('settings'), value: '' },
        ];

        for (let i = 0; i < items.length; i++) {
            const y = startY + i * gap;
            const selected = i === this.row;
            ctx.font = selected ? 'bold 22px monospace' : '20px monospace';
            ctx.fillStyle = selected ? Theme.colors.tanks[0] : Theme.colors.text.secondary;
            if (items[i].value) ctx.fillText(`${items[i].label}:  < ${items[i].value} >`, CANVAS_W / 2, y);
            else ctx.fillText(items[i].label, CANVAS_W / 2, y);
        }

        ctx.font = '14px monospace';
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.fillText(this._getControlsHintText(), CANVAS_W / 2, CANVAS_H - 40);
        ctx.fillText(t('navHint'), CANVAS_W / 2, CANVAS_H - 20);
    }

    _drawKeyboardSettings(ctx) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px monospace';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.fillText(t('settingsTitle'), CANVAS_W / 2, 100);

        const startY = 200;
        const gap = 60;
        const items = this._getSettingsItems();

        for (let i = 0; i < items.length; i++) {
            const y = startY + i * gap;
            const selected = i === this.settingsRow;
            ctx.font = selected ? 'bold 22px monospace' : '20px monospace';
            ctx.fillStyle = selected ? Theme.colors.tanks[0] : Theme.colors.text.secondary;
            const label = this._getSettingsItemLabel(items[i]);
            const value = this._getSettingsItemValue(items[i]);
            if (value) ctx.fillText(`${label}:  < ${value} >`, CANVAS_W / 2, y);
            else ctx.fillText(label, CANVAS_W / 2, y);
        }

        ctx.font = '14px monospace';
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.fillText(t('navHint'), CANVAS_W / 2, CANVAS_H - 20);
    }

    _drawTouchMain(ctx) {
        const layout = this._getTouchMainLayout();
        const optionColors = [Theme.colors.tanks[0], Theme.colors.tanks[1], Theme.colors.tanks[2] || Theme.colors.tanks[0]];
        const items = [
            { label: t('mode'), value: t(MODES[this.modeIndex].key), subtitle: '' },
            { label: t('winScore'), value: String(WIN_SCORES[this.scoreIndex]), subtitle: '' },
            { label: t('aiDifficulty'), value: t(DIFFICULTIES[this.diffIndex]), subtitle: '' },
            { label: this._plainLabel(t('startGame')), subtitle: `${t(MODES[this.modeIndex].key)} / ${WIN_SCORES[this.scoreIndex]}` },
            { label: this._plainLabel(t('settings')), subtitle: t('settingsSubtitle') },
        ];

        this._drawTouchBoard(ctx, layout.leftPanel, Theme.colors.tanks[1]);
        this._drawTouchBoard(ctx, layout.rightPanel, Theme.colors.tanks[0]);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = 'bold 42px monospace';
        ctx.fillText(t('title'), layout.leftPanel.x + layout.leftPanel.w / 2, layout.leftPanel.y + 26);
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.font = '14px monospace';
        ctx.fillText(t('subtitle'), layout.leftPanel.x + layout.leftPanel.w / 2, layout.leftPanel.y + 68);
        const lineY = layout.leftPanel.y + 96;
        const lineW = Math.min(250, layout.leftPanel.w - 72);
        const grad = ctx.createLinearGradient(
            layout.leftPanel.x + layout.leftPanel.w / 2 - lineW / 2, lineY,
            layout.leftPanel.x + layout.leftPanel.w / 2 + lineW / 2, lineY
        );
        grad.addColorStop(0, colorWithAlpha(Theme.colors.tanks[1], 0));
        grad.addColorStop(0.5, colorWithAlpha(Theme.colors.tanks[1], 0.95));
        grad.addColorStop(1, colorWithAlpha(Theme.colors.tanks[1], 0));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(layout.leftPanel.x + layout.leftPanel.w / 2 - lineW / 2, lineY);
        ctx.lineTo(layout.leftPanel.x + layout.leftPanel.w / 2 + lineW / 2, lineY);
        ctx.stroke();
        ctx.restore();

        for (let i = 0; i < 3; i++) {
            const card = layout.options[i];
            this._drawTouchOptionCard(ctx, card, items[i].label, items[i].value, items[i].subtitle, i === this.row, optionColors[i]);
        }

        for (let i = 3; i < layout.options.length; i++) {
            const card = layout.options[i];
            this._drawTouchActionCard(ctx, card, items[i].label, items[i].subtitle, i === this.row, i === 3 ? Theme.colors.tanks[0] : Theme.colors.tanks[1], i === 3);
        }

    }

    _drawTouchSettings(ctx) {
        const layout = this._getTouchSettingsLayout();
        const items = this._getSettingsItems();

        this._drawTouchBoard(ctx, layout.leftPanel, Theme.colors.tanks[1]);
        this._drawTouchBoard(ctx, layout.rightPanel, Theme.colors.tanks[0]);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = 'bold 34px monospace';
        ctx.fillText(t('settingsTitle'), layout.leftPanel.x + layout.leftPanel.w / 2, layout.leftPanel.y + 22);
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.font = '14px monospace';
        ctx.fillText(t('settingsSubtitle'), layout.leftPanel.x + layout.leftPanel.w / 2, layout.leftPanel.y + 56);
        const lineY = layout.leftPanel.y + 82;
        const lineW = Math.min(220, layout.leftPanel.w - 56);
        const grad = ctx.createLinearGradient(
            layout.leftPanel.x + layout.leftPanel.w / 2 - lineW / 2, lineY,
            layout.leftPanel.x + layout.leftPanel.w / 2 + lineW / 2, lineY
        );
        grad.addColorStop(0, colorWithAlpha(Theme.colors.tanks[1], 0));
        grad.addColorStop(0.5, colorWithAlpha(Theme.colors.tanks[1], 0.95));
        grad.addColorStop(1, colorWithAlpha(Theme.colors.tanks[1], 0));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(layout.leftPanel.x + layout.leftPanel.w / 2 - lineW / 2, lineY);
        ctx.lineTo(layout.leftPanel.x + layout.leftPanel.w / 2 + lineW / 2, lineY);
        ctx.stroke();
        ctx.restore();

        for (let i = 0; i < layout.options.length; i++) {
            const card = layout.options[i];
            const selected = i === this.settingsRow;
            const item = items[i];

            if (item.kind === 'adjust') {
                const label = this._getSettingsItemLabel(item);
                const value = this._getSettingsItemValue(item);
                const accent = item.setting === 'language'
                    ? Theme.colors.tanks[1]
                    : (item.setting === 'theme' ? (Theme.colors.tanks[2] || Theme.colors.tanks[0]) : Theme.colors.tanks[0]);
                this._drawTouchOptionCard(ctx, card, label, value, t('touchHint'), selected, accent);
            } else if (item.kind === 'controls') {
                this._drawTouchActionCard(
                    ctx,
                    card,
                    t('controlsConfig'),
                    '',
                    selected,
                    Theme.colors.tanks[0],
                    false
                );
            } else if (item.kind === 'action') {
                const accent = item.mode === 'desktop' ? (Theme.colors.tanks[2] || Theme.colors.tanks[0]) : Theme.colors.tanks[0];
                this._drawTouchActionCard(
                    ctx,
                    card,
                    this._plainLabel(this._getSettingsItemLabel(item)),
                    this._getTouchSettingsActionSubtitle(item),
                    selected,
                    accent,
                    false
                );
            } else {
                this._drawTouchActionCard(
                    ctx,
                    card,
                    this._plainLabel(t('back')),
                    t('touchHint'),
                    selected,
                    Theme.colors.text.secondary,
                    false
                );
            }
        }
    }


    _drawTouchBoard(ctx, board, accentColor) {
        TouchUI.drawPanel(ctx, board.x, board.y, board.w, board.h, {
            radius: board.radius,
            fill: TouchUI.surfaceFill(0.98),
            border: colorWithAlpha(accentColor, 0.22),
            inset: TouchUI.innerStroke(1),
            shadowBlur: 24,
            shadowOffsetY: 8
        });

        ctx.save();
        roundedRectPath(ctx, board.x, board.y, board.w, board.h, board.radius);
        ctx.clip();
        TouchUI.drawDottedGrid(ctx, board.x, board.y, board.w, board.h, { alpha: 0.12 });

        const band = ctx.createLinearGradient(board.x, board.y, board.x, board.y + board.h);
        band.addColorStop(0, colorWithAlpha(accentColor, 0.08));
        band.addColorStop(0.4, colorWithAlpha(accentColor, 0.02));
        band.addColorStop(1, colorWithAlpha(accentColor, 0));
        ctx.fillStyle = band;
        ctx.fillRect(board.x, board.y, board.w, board.h);
        ctx.restore();
    }

    _drawTouchOptionCard(ctx, card, label, value, subtitle, selected, accentColor) {
        const fill = selected
            ? colorWithAlpha(accentColor, Theme.current === 'dark' ? 0.14 : 0.12)
            : TouchUI.surfaceSoftFill(1);
        const border = selected
            ? colorWithAlpha(accentColor, 0.5)
            : TouchUI.surfaceStroke(1);
        const compact = card.w < 220;
        const spacious = card.h >= 108;
        const sidePad = compact ? 12 : (spacious ? 22 : 18);
        const topTextY = compact ? 24 : (spacious ? 30 : 26);
        const subTextY = compact ? 42 : (spacious ? 50 : 46);
        const arrowW = compact ? 34 : (spacious ? 44 : 40);
        const controlH = compact ? 22 : (spacious ? 30 : 24);
        const gap = compact ? 8 : 10;
        const controlY = card.y + card.h - (compact ? 32 : (spacious ? 44 : 38));
        const valueW = Math.max(44, card.w - sidePad * 2 - arrowW * 2 - gap * 2);
        const valueX = card.x + sidePad + arrowW + gap;

        TouchUI.drawPanel(ctx, card.x, card.y, card.w, card.h, {
            radius: card.radius,
            fill,
            border,
            inset: TouchUI.innerStroke(selected ? 0.9 : 1),
            shadow: false,
            glowColor: selected ? colorWithAlpha(accentColor, 0.18) : null,
            glowWidth: 2
        });

        TouchUI.drawPill(ctx, card.x + sidePad, controlY, arrowW, controlH, '<', {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: selected ? 0.2 : 0.12,
            borderOpacity: selected ? 0.5 : 0.25,
            font: compact ? 'bold 13px monospace' : 'bold 14px monospace'
        });
        TouchUI.drawPill(ctx, card.x + card.w - sidePad - arrowW, controlY, arrowW, controlH, '>', {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: selected ? 0.2 : 0.12,
            borderOpacity: selected ? 0.5 : 0.25,
            font: compact ? 'bold 13px monospace' : 'bold 14px monospace'
        });
        TouchUI.drawPill(ctx, valueX, controlY, valueW, controlH, value, {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: selected ? 0.18 : 0.1,
            borderOpacity: selected ? 0.44 : 0.22,
            font: compact ? 'bold 12px monospace' : 'bold 13px monospace'
        });

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = selected
            ? (compact ? 'bold 16px monospace' : 'bold 19px monospace')
            : (compact ? 'bold 15px monospace' : 'bold 18px monospace');
        ctx.fillText(label, card.x + sidePad, card.y + topTextY);

        ctx.fillStyle = Theme.colors.text.hint;
        ctx.font = compact ? '11px monospace' : '12px monospace';
        ctx.fillText(subtitle, card.x + sidePad, card.y + subTextY);
        ctx.restore();
    }

    _drawTouchActionCard(ctx, card, label, subtitle, selected, accentColor, primary) {
        const fill = primary
            ? colorWithAlpha(accentColor, Theme.current === 'dark' ? 0.26 : 0.2)
            : (selected ? colorWithAlpha(accentColor, 0.12) : TouchUI.surfaceSoftFill(1));
        const border = primary
            ? colorWithAlpha(accentColor, 0.48)
            : (selected ? colorWithAlpha(accentColor, 0.36) : TouchUI.surfaceStroke(1));
        const spacious = card.h >= 92;
        const okW = primary ? 82 : 76;
        const okH = primary ? 30 : 28;
        const okX = card.x + card.w - okW - 20;
        const okY = card.y + 16;
        const titleY = card.y + (primary ? 40 : (spacious ? 34 : 28));
        const subtitleY = card.y + (primary ? 66 : (spacious ? 58 : 48));

        TouchUI.drawPanel(ctx, card.x, card.y, card.w, card.h, {
            radius: card.radius,
            fill,
            border,
            inset: TouchUI.innerStroke(1),
            shadow: false,
            glowColor: primary || selected ? colorWithAlpha(accentColor, 0.18) : null,
            glowWidth: 2
        });

        TouchUI.drawPill(ctx, okX, okY, okW, okH, 'OK', {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: primary ? 0.2 : 0.12,
            borderOpacity: primary ? 0.44 : 0.24
        });

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = primary ? 'bold 24px monospace' : (spacious ? 'bold 22px monospace' : 'bold 20px monospace');
        ctx.fillText(label, card.x + 22, titleY);

        ctx.fillStyle = Theme.colors.text.hint;
        ctx.font = primary ? '13px monospace' : '12px monospace';
        ctx.fillText(subtitle, card.x + 22, subtitleY);
        ctx.restore();
    }

    _getTouchMainLayout() {
        const framePad = 18;
        const panelGap = 18;
        const contentX = framePad;
        const contentY = 16;
        const contentW = CANVAS_W - framePad * 2;
        const panelH = CANVAS_H - 32;
        const leftW = Math.max(430, Math.min(540, contentW * 0.61));
        const rightW = contentW - leftW - panelGap;
        const leftPanel = { x: contentX, y: contentY, w: leftW, h: panelH, radius: 28 };
        const rightPanel = { x: leftPanel.x + leftPanel.w + panelGap, y: contentY, w: rightW, h: panelH, radius: 28 };
        const footer = { x: contentX, y: contentY + panelH + 14, w: contentW, h: 46, radius: 18 };
        const leftPad = 20;
        const titleSpace = 124;
        const gridGap = 14;
        const leftGridX = leftPanel.x + leftPad;
        const leftGridY = leftPanel.y + titleSpace;
        const leftGridW = leftPanel.w - leftPad * 2;
        const smallW = (leftGridW - gridGap) / 2;
        const topCardH = 108;
        const wideCardY = leftGridY + topCardH + 14;
        const wideCardH = Math.max(126, leftPanel.y + leftPanel.h - leftPad - wideCardY);
        const noteY = wideCardY + wideCardH + 14;
        const noteH = leftPanel.y + leftPanel.h - leftPad - noteY;
        const actionPad = 18;
        const actionX = rightPanel.x + actionPad;
        const actionW = rightPanel.w - actionPad * 2;
        const primaryY = rightPanel.y + actionPad;
        const primaryH = Math.floor((rightPanel.h - actionPad * 2 - 16) * 0.66);
        const secondaryY = primaryY + primaryH + 16;
        const secondaryH = rightPanel.y + rightPanel.h - actionPad - secondaryY;

        return {
            leftPanel,
            rightPanel,
            note: { x: leftGridX, y: noteY, w: leftGridW, h: Math.max(52, noteH), radius: 20 },
            cta: { x: rightPanel.x, y: rightPanel.y, w: rightPanel.w, h: rightPanel.h, radius: rightPanel.radius },
            footer,
            options: [
                { x: leftGridX, y: leftGridY, w: smallW, h: topCardH, radius: 22 },
                { x: leftGridX + smallW + gridGap, y: leftGridY, w: smallW, h: topCardH, radius: 22 },
                { x: leftGridX, y: wideCardY, w: leftGridW, h: wideCardH, radius: 22 },
                { x: actionX, y: primaryY, w: actionW, h: primaryH, radius: 22 },
                { x: actionX, y: secondaryY, w: actionW, h: secondaryH, radius: 22 }
            ]
        };
    }


    _getTouchSettingsLayout() {
        const items = this._getSettingsItems();
        const contentX = 40;
        const contentY = 90;
        const contentW = CANVAS_W - 80;
        const leftW = Math.min(380, Math.max(300, contentW * 0.48));
        const rightW = contentW - leftW - 16;
        const panelH = 384;
        const leftPanel = { x: contentX, y: contentY, w: leftW, h: panelH, radius: 28 };
        const rightPanel = { x: leftPanel.x + leftPanel.w + 16, y: contentY, w: rightW, h: panelH, radius: 28 };
        const footer = { x: contentX, y: contentY + panelH + 14, w: contentW, h: 46, radius: 18 };
        const innerPad = 18;
        const leftCardX = leftPanel.x + innerPad;
        const leftCardW = leftPanel.w - innerPad * 2;
        const leftCardY = leftPanel.y + 108;
        const leftCardH = 92;
        const leftGap = 12;
        const noteY = leftCardY + (leftCardH + leftGap) * Math.min(2, items.length) + 6;
        const noteH = leftPanel.y + leftPanel.h - innerPad - noteY;
        const rightCardX = rightPanel.x + innerPad;
        const rightCardW = rightPanel.w - innerPad * 2;
        const rightStartY = rightPanel.y + 26;
        const rightGap = 12;
        const options = [];

        for (let i = 0; i < items.length; i++) {
            if (i < 2) {
                options.push({ x: leftCardX, y: leftCardY + i * (leftCardH + leftGap), w: leftCardW, h: leftCardH, radius: 22, kind: items[i].kind });
            } else {
                const item = items[i];
                const h = item.kind === 'back' ? 82 : 96;
                const offsetIndex = i - 2;
                const y = rightStartY + offsetIndex * (96 + rightGap);
                options.push({ x: rightCardX, y, w: rightCardW, h, radius: 22, kind: item.kind });
            }
        }

        return {
            leftPanel,
            rightPanel,
            note: { x: leftCardX, y: noteY, w: leftCardW, h: Math.max(52, noteH), radius: 20 },
            footer,
            options
        };
    }

    _getSettingsItems() {
        const items = [
            { kind: 'adjust', setting: 'language' },
            { kind: 'adjust', setting: 'theme' }
        ];

        if (this._input && this._input.touchEnabled) {
            items.push({ kind: 'controls' });
            if (this._input.canSwitchUiMode) {
                items.push({ kind: 'action', action: 'switchUiMode', mode: 'desktop' });
            }
        } else {
            items.push({ kind: 'adjust', setting: 'singleControl' });
            if (this._input && this._input.canSwitchUiMode) {
                items.push({ kind: 'action', action: 'switchUiMode', mode: 'touch' });
            }
        }

        items.push({ kind: 'back' });
        return items;
    }

    _getSettingsItemLabel(item) {
        if (item.kind === 'back') return t('back');
        if (item.kind === 'controls') return t('controlsConfig');
        if (item.kind === 'action' && item.mode === 'desktop') return t('switchToDesktopUi');
        if (item.kind === 'action' && item.mode === 'touch') return t('switchToTouchUi');
        if (item.setting === 'language') return t('language');
        if (item.setting === 'theme') return t('theme');
        if (item.setting === 'singleControl') return t('singlePlayerControl');
        return '';
    }

    _getSettingsItemValue(item) {
        if (!item || item.kind !== 'adjust') return '';
        if (item.setting === 'language') return t('langName');
        if (item.setting === 'theme') return t(Theme.current === 'light' ? 'themeLight' : 'themeDark');
        if (item.setting === 'singleControl') return t(this._getSinglePlayerControlMode());
        return '';
    }

    _getTouchSettingsActionSubtitle(item) {
        if (item.kind === 'controls') return t('controlsSubtitle');
        if (item.kind === 'action' && item.mode === 'desktop') return t('switchToDesktopUiHint');
        if (item.kind === 'action' && item.mode === 'touch') return t('switchToTouchUiHint');
        return t('touchHint');
    }

    _getSinglePlayerControlMode() {
        return SINGLE_PLAYER_CONTROL_OPTIONS[this.singleControlIndex] || SINGLE_PLAYER_CONTROL_OPTIONS[0];
    }

    _cycleSinglePlayerControl(direction) {
        const total = SINGLE_PLAYER_CONTROL_OPTIONS.length;
        this.singleControlIndex = (this.singleControlIndex + direction + total) % total;
        saveSinglePlayerControlMode(this._getSinglePlayerControlMode());
    }

    _getControlsHintText() {
        const mode = MODES[this.modeIndex];
        if (!mode || mode.players !== 1) return t('controls');

        const hintKeyByMode = {
            keyboard_arrows: 'singleControlsArrows',
            keyboard_wasd: 'singleControlsWasd',
            mouse: 'singleControlsMouse'
        };
        const hintKey = hintKeyByMode[this._getSinglePlayerControlMode()] || 'singleControlsArrows';
        return t(hintKey);
    }

    _plainLabel(text) {
        return text.replace(/\[/g, '').replace(/\]/g, '').trim();
    }

    _isInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    }
}
