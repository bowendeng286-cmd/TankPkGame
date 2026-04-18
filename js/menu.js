var ALL_MODES = [
    { key: '1pvai', players: 1, ai: 1 },
    { key: '2p', players: 2, ai: 0 },
    { key: '2pvai', players: 2, ai: 1 },
    { key: '3p', players: 3, ai: 0 },
    { key: '1pv2ai', players: 1, ai: 2 },
];

function getAvailableModes(input) {
    if (input && input.isTouchDevice) {
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

        MODES = getAvailableModes(input);
        if (this.modeIndex >= MODES.length) this.modeIndex = 0;

        this.settingsMaxRow = this._getSettingsItems().length - 1;

        if (input.isTouchDevice && input._canvas) {
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
    }

    deactivate() {
        if (this._onTouchEnd && this._input && this._input._canvas) {
            this._input._canvas.removeEventListener('touchend', this._onTouchEnd);
        }
        this._onTouchEnd = null;
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
            if (selectedItem && selectedItem.kind === 'controls') {
                this.openControlsConfig = true;
                return;
            }
            if (selectedItem && selectedItem.kind === 'back') {
                this._closeSettings();
            }
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

        for (let i = 0; i < layout.options.length; i++) {
            const card = layout.options[i];
            if (!this._isInRect(x, y, card)) continue;

            this.settingsRow = i;
            if (card.kind === 'adjust') {
                this._changeSettingsOption(i, x < card.x + card.w / 2 ? -1 : 1);
            } else if (card.kind === 'controls') {
                this.openControlsConfig = true;
            } else if (card.kind === 'back') {
                this._closeSettings();
            }
            return;
        }
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
        TouchUI.drawTitle(ctx, t('title'), t('subtitle'), Theme.colors.tanks[0], 40);
        this._drawTouchBoard(ctx, layout.board, Theme.colors.tanks[0]);

        const optionColors = [Theme.colors.tanks[0], Theme.colors.tanks[1], Theme.colors.tanks[2] || Theme.colors.tanks[0]];
        const items = [
            { label: t('mode'), value: t(MODES[this.modeIndex].key), subtitle: t('touchHint') },
            { label: t('winScore'), value: String(WIN_SCORES[this.scoreIndex]), subtitle: t('touchHint') },
            { label: t('aiDifficulty'), value: t(DIFFICULTIES[this.diffIndex]), subtitle: t('touchHint') },
            { label: this._plainLabel(t('startGame')), subtitle: `${t(MODES[this.modeIndex].key)} / ${WIN_SCORES[this.scoreIndex]}` },
            { label: this._plainLabel(t('settings')), subtitle: t('settingsSubtitle') },
        ];

        for (let i = 0; i < layout.options.length; i++) {
            const card = layout.options[i];
            if (i < 3) {
                this._drawTouchOptionCard(ctx, card, items[i].label, items[i].value, items[i].subtitle, i === this.row, optionColors[i]);
            } else {
                this._drawTouchActionCard(ctx, card, items[i].label, items[i].subtitle, i === this.row, i === 3 ? Theme.colors.tanks[0] : Theme.colors.tanks[1], i === 3);
            }
        }

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.font = '13px monospace';
        ctx.fillText(t('touchHint'), CANVAS_W / 2, 565);
        ctx.restore();
    }

    _drawTouchSettings(ctx) {
        const layout = this._getTouchSettingsLayout();
        TouchUI.drawTitle(ctx, t('settingsTitle'), t('settingsSubtitle'), Theme.colors.tanks[1], 42);
        this._drawTouchBoard(ctx, layout.board, Theme.colors.tanks[1]);

        for (let i = 0; i < layout.options.length; i++) {
            const card = layout.options[i];
            const selected = i === this.settingsRow;

            if (card.kind === 'adjust') {
                const label = i === 0 ? t('language') : t('theme');
                const value = i === 0 ? t('langName') : t(Theme.current === 'light' ? 'themeLight' : 'themeDark');
                const accent = i === 0 ? Theme.colors.tanks[1] : Theme.colors.tanks[2] || Theme.colors.tanks[0];
                this._drawTouchOptionCard(ctx, card, label, value, t('touchHint'), selected, accent);
            } else if (card.kind === 'controls') {
                this._drawTouchActionCard(
                    ctx,
                    card,
                    t('controlsConfig'),
                    t('controlsSubtitle'),
                    selected,
                    Theme.colors.tanks[0],
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

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.font = '13px monospace';
        ctx.fillText(t('touchHint'), CANVAS_W / 2, 560);
        ctx.restore();
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

        TouchUI.drawPanel(ctx, card.x, card.y, card.w, card.h, {
            radius: card.radius,
            fill,
            border,
            inset: TouchUI.innerStroke(selected ? 0.9 : 1),
            shadow: false,
            glowColor: selected ? colorWithAlpha(accentColor, 0.18) : null,
            glowWidth: 2
        });

        TouchUI.drawPill(ctx, card.x + 18, card.y + 15, 34, 28, '<', {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: selected ? 0.2 : 0.12,
            borderOpacity: selected ? 0.5 : 0.25
        });
        TouchUI.drawPill(ctx, card.x + card.w - 52, card.y + 15, 34, 28, '>', {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: selected ? 0.2 : 0.12,
            borderOpacity: selected ? 0.5 : 0.25
        });
        TouchUI.drawPill(ctx, card.x + card.w - 240, card.y + 15, 170, 28, value, {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: selected ? 0.18 : 0.1,
            borderOpacity: selected ? 0.44 : 0.22
        });

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = selected ? 'bold 18px monospace' : 'bold 17px monospace';
        ctx.fillText(label, card.x + 72, card.y + 27);

        ctx.fillStyle = Theme.colors.text.hint;
        ctx.font = '12px monospace';
        ctx.fillText(subtitle, card.x + 72, card.y + 47);
        ctx.restore();
    }

    _drawTouchActionCard(ctx, card, label, subtitle, selected, accentColor, primary) {
        const fill = primary
            ? colorWithAlpha(accentColor, Theme.current === 'dark' ? 0.26 : 0.2)
            : (selected ? colorWithAlpha(accentColor, 0.12) : TouchUI.surfaceSoftFill(1));
        const border = primary
            ? colorWithAlpha(accentColor, 0.48)
            : (selected ? colorWithAlpha(accentColor, 0.36) : TouchUI.surfaceStroke(1));

        TouchUI.drawPanel(ctx, card.x, card.y, card.w, card.h, {
            radius: card.radius,
            fill,
            border,
            inset: TouchUI.innerStroke(1),
            shadow: false,
            glowColor: primary || selected ? colorWithAlpha(accentColor, 0.18) : null,
            glowWidth: 2
        });

        TouchUI.drawPill(ctx, card.x + card.w - 112, card.y + 14, 82, 28, 'OK', {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: primary ? 0.2 : 0.12,
            borderOpacity: primary ? 0.44 : 0.24
        });

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = 'bold 20px monospace';
        ctx.fillText(label, card.x + 28, card.y + 28);

        ctx.fillStyle = Theme.colors.text.hint;
        ctx.font = '12px monospace';
        ctx.fillText(subtitle, card.x + 28, card.y + 48);
        ctx.restore();
    }

    _getTouchMainLayout() {
        const board = { x: 58, y: 134, w: CANVAS_W - 116, h: 424, radius: 28 };
        const cardX = board.x + 22;
        const cardW = board.w - 44;
        const cardH = 64;
        const gap = 14;
        const firstY = board.y + 22;

        return {
            board,
            options: [
                { x: cardX, y: firstY, w: cardW, h: cardH, radius: 22 },
                { x: cardX, y: firstY + (cardH + gap), w: cardW, h: cardH, radius: 22 },
                { x: cardX, y: firstY + (cardH + gap) * 2, w: cardW, h: cardH, radius: 22 },
                { x: cardX, y: firstY + (cardH + gap) * 3 + 10, w: cardW, h: 56, radius: 20 },
                { x: cardX, y: firstY + (cardH + gap) * 3 + 78, w: cardW, h: 56, radius: 20 }
            ]
        };
    }

    _getTouchSettingsLayout() {
        const board = { x: 58, y: 148, w: CANVAS_W - 116, h: 394, radius: 28 };
        const cardX = board.x + 22;
        const cardW = board.w - 44;
        const cardH = 64;
        const gap = 14;
        const firstY = board.y + 26;
        const options = [
            { x: cardX, y: firstY, w: cardW, h: cardH, radius: 22, kind: 'adjust' },
            { x: cardX, y: firstY + (cardH + gap), w: cardW, h: cardH, radius: 22, kind: 'adjust' }
        ];

        let actionY = firstY + (cardH + gap) * 2 + 8;
        if (this._input && this._input.isTouchDevice) {
            options.push({ x: cardX, y: actionY, w: cardW, h: 62, radius: 22, kind: 'controls' });
            actionY += 76;
        }
        options.push({ x: cardX, y: actionY, w: cardW, h: 56, radius: 20, kind: 'back' });

        return { board, options };
    }

    _getSettingsItems() {
        const items = [
            { kind: 'adjust', setting: 'language' },
            { kind: 'adjust', setting: 'theme' }
        ];

        if (this._input && this._input.isTouchDevice) {
            items.push({ kind: 'controls' });
        } else {
            items.push({ kind: 'adjust', setting: 'singleControl' });
        }

        items.push({ kind: 'back' });
        return items;
    }

    _getSettingsItemLabel(item) {
        if (item.kind === 'back') return t('back');
        if (item.kind === 'controls') return t('controlsConfig');
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
