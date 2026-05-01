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
        this.mapSizeRow = 0;
        this.openSettings = false;
        this.openControlsConfig = false;
        this.singleControlIndex = SINGLE_PLAYER_CONTROL_OPTIONS.indexOf(loadSinglePlayerControlMode());
        this.mapSizeSettings = getMapSizeSettings();
        if (this.singleControlIndex < 0) this.singleControlIndex = 0;

        this._input = null;
        this._prevKeys = new Set();
        this._onTouchEnd = null;
        this._animPrevTime = this._now();
        this._pageAnim = { page: 'main', startedAt: this._animPrevTime, direction: -1 };
        this._pageAnimDuration = 0.18;
        this._selectionAnim = { main: [], settings: [], mapSize: [] };
        this._touchPulseAnim = { main: [], settings: [], mapSize: [] };
        this._touchPulseDuration = 0.18;
    }

    activate(input) {
        this.done = false;
        this.result = null;
        this.page = 'main';
        this.openSettings = false;
        this.openControlsConfig = false;
        this.mapSizeRow = 0;
        this.mapSizeSettings = getMapSizeSettings();
        this._input = input;
        this._prevKeys = new Set();

        this._refreshAvailableModes();

        this.settingsMaxRow = this._getSettingsItems().length - 1;
        this._refreshTouchEndBinding();
        this._animPrevTime = this._now();
        this._startPageAnimation('main', -1);
        this._syncSelectionAnimation(true, 1);
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

    _now() {
        return performance.now() * 0.001;
    }

    _startPageAnimation(page, direction) {
        this._pageAnim = {
            page,
            startedAt: this._now(),
            direction: direction || 1
        };
    }

    _ensureAnimList(pageKey, length) {
        const list = this._selectionAnim[pageKey] || (this._selectionAnim[pageKey] = []);
        while (list.length < length) list.push(0);
        list.length = length;

        const pulseList = this._touchPulseAnim[pageKey] || (this._touchPulseAnim[pageKey] = []);
        if (pulseList.length > length) pulseList.length = length;
        return list;
    }

    _updateSelectionAnimationFor(pageKey, length, selectedIndex, force, blend) {
        if (length <= 0) {
            this._selectionAnim[pageKey] = [];
            return;
        }
        const list = this._ensureAnimList(pageKey, length);
        const safeSelected = clamp(selectedIndex, 0, length - 1);
        for (let i = 0; i < length; i++) {
            const target = i === safeSelected ? 1 : 0;
            list[i] = force ? target : lerp(list[i], target, blend);
        }
    }

    _syncSelectionAnimation(force, blend) {
        this._updateSelectionAnimationFor('main', 5, this.row, force, blend);
        this.settingsMaxRow = this._getSettingsItems().length - 1;
        this._updateSelectionAnimationFor('settings', this._getSettingsItems().length, this.settingsRow, force, blend);
        this._updateSelectionAnimationFor('mapSize', this._getMapSizeItems().length, this.mapSizeRow, force, blend);
    }

    _tickAnimations() {
        const now = this._now();
        const dt = Math.min(Math.max(0, now - this._animPrevTime), 0.05);
        this._animPrevTime = now;
        const blend = 1 - Math.exp(-dt * 18);
        this._syncSelectionAnimation(false, blend);
    }

    _getSelectionAmount(pageKey, index) {
        const list = this._selectionAnim[pageKey] || [];
        return clamp(list[index] || 0, 0, 1);
    }

    _triggerTouchPulse(pageKey, index) {
        const pulseList = this._touchPulseAnim[pageKey] || (this._touchPulseAnim[pageKey] = []);
        pulseList[index] = this._now();
    }

    _getTouchPulseAmount(pageKey, index) {
        const pulseList = this._touchPulseAnim[pageKey] || [];
        const startedAt = pulseList[index];
        if (startedAt == null) return 0;
        const progress = (this._now() - startedAt) / this._touchPulseDuration;
        if (progress >= 1) return 0;
        return Math.sin(progress * Math.PI) * (1 - progress * 0.2);
    }

    _getPageAnimationState() {
        if (!this._pageAnim || this._pageAnim.page !== this.page) {
            return { alpha: 1, offsetX: 0 };
        }
        const progress = clamp((this._now() - this._pageAnim.startedAt) / this._pageAnimDuration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        return {
            alpha: lerp(0.38, 1, eased),
            offsetX: (1 - eased) * (this._pageAnim.direction || 1) * 18
        };
    }

    _getCardEmphasis(selectionAmount, pulseAmount) {
        return clamp(Math.max(selectionAmount, pulseAmount * 0.9), 0, 1);
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
        this._tickAnimations();
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
        const items = this._getCurrentSettingsItems();
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

        const maxRow = items.length - 1;
        const currentRow = this._getCurrentSettingsRow();
        if (this.page === 'settings') this.settingsMaxRow = maxRow;
        if (upPressed) this._setCurrentSettingsRow(Math.max(0, currentRow - 1));
        if (downPressed) this._setCurrentSettingsRow(Math.min(maxRow, currentRow + 1));

        if (leftPressed) this._changeActiveSettingsOption(this._getCurrentSettingsRow(), -1);
        if (rightPressed) this._changeActiveSettingsOption(this._getCurrentSettingsRow(), 1);

        if (confirmPressed) {
            const selectedItem = items[this._getCurrentSettingsRow()];
            this._activateSettingsItem(selectedItem);
        }

        if (escPressed) {
            if (this.page === 'mapSize') this._closeMapSizeSettings();
            else this._closeSettings();
        }
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

    _changeActiveSettingsOption(row, direction) {
        if (this.page === 'mapSize') {
            this._changeMapSizeOption(row, direction);
            return;
        }
        this._changeSettingsOption(row, direction);
    }

    _changeMapSizeOption(row, direction) {
        const item = this._getMapSizeItems()[row];
        if (!item || item.kind !== 'adjust') return;

        const next = Object.assign({}, this.mapSizeSettings);
        const isCols = item.setting === 'minCols' || item.setting === 'maxCols';
        const minValue = isCols ? MAP_COLS_MIN : MAP_ROWS_MIN;
        const maxValue = isCols ? MAP_COLS_MAX : MAP_ROWS_MAX;
        next[item.setting] = clamp(next[item.setting] + direction, minValue, maxValue);

        if (item.setting === 'minCols' && next.minCols > next.maxCols) next.maxCols = next.minCols;
        if (item.setting === 'maxCols' && next.maxCols < next.minCols) next.minCols = next.maxCols;
        if (item.setting === 'minRows' && next.minRows > next.maxRows) next.maxRows = next.minRows;
        if (item.setting === 'maxRows' && next.maxRows < next.minRows) next.minRows = next.maxRows;

        this.mapSizeSettings = normalizeMapSizeSettings(next);
        MapSizeSettings.save(this.mapSizeSettings);
    }

    _getCurrentSettingsItems() {
        return this.page === 'mapSize' ? this._getMapSizeItems() : this._getSettingsItems();
    }

    _getCurrentSettingsRow() {
        return this.page === 'mapSize' ? this.mapSizeRow : this.settingsRow;
    }

    _setCurrentSettingsRow(value) {
        if (this.page === 'mapSize') this.mapSizeRow = value;
        else this.settingsRow = value;
    }

    _getCurrentSettingsTitle() {
        return this.page === 'mapSize' ? t('mapSize') : t('settingsTitle');
    }

    _getCurrentSettingsSubtitle() {
        return this.page === 'mapSize' ? t('mapSizeSubtitle') : t('settingsSubtitle');
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
        this._startPageAnimation('settings', 1);
    }

    _openMapSizeSettings() {
        this.page = 'mapSize';
        this.mapSizeRow = 0;
        this.mapSizeSettings = getMapSizeSettings();
        this._startPageAnimation('mapSize', 1);
    }

    _closeMapSizeSettings() {
        this.page = 'settings';
        this._startPageAnimation('settings', -1);
    }

    _closeSettings() {
        this.page = 'main';
        this.openSettings = false;
        this._startPageAnimation('main', -1);
    }

    _handleMainTouch(x, y) {
        const layout = this._getTouchMainLayout();

        for (let i = 0; i < layout.options.length; i++) {
            const card = layout.options[i];
            if (!this._isInRect(x, y, card)) continue;

            this.row = i;
            this._triggerTouchPulse('main', i);
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
        const items = this._getCurrentSettingsItems();
        const pageKey = this.page;

        for (let i = 0; i < layout.options.length; i++) {
            const card = layout.options[i];
            if (!this._isInRect(x, y, card)) continue;

            this._setCurrentSettingsRow(i);
            this._triggerTouchPulse(pageKey, i);
            if (card.kind === 'adjust') {
                this._changeActiveSettingsOption(i, x < card.x + card.w / 2 ? -1 : 1);
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
        if (item.kind === 'action' && item.action === 'mapSize') {
            this._openMapSizeSettings();
            return;
        }
        if (item.kind === 'action' && item.action === 'switchUiMode') {
            this._switchUiMode(item.mode);
            return;
        }
        if (item.kind === 'back') {
            if (this.page === 'mapSize') this._closeMapSizeSettings();
            else this._closeSettings();
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

        const pageAnim = this._getPageAnimationState();
        ctx.save();
        ctx.globalAlpha *= pageAnim.alpha;
        ctx.translate(pageAnim.offsetX, 0);

        if (this._input && this._input.touchEnabled) {
            if (this.page === 'main') this._drawTouchMain(ctx);
            else this._drawTouchSettings(ctx);
        } else {
            if (this.page === 'main') this._drawKeyboardMain(ctx);
            else this._drawKeyboardSettings(ctx);
        }

        ctx.restore();
        ctx.restore();
    }

    _drawKeyboardOptionText(ctx, text, y, weight) {
        const amount = clamp(weight || 0, 0, 1);
        const drawX = Math.round(CANVAS_W / 2);
        const drawY = Math.round(y);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '20px monospace';
        ctx.fillStyle = amount > 0 ? mixColor(Theme.colors.text.secondary, Theme.colors.tanks[0], amount) : Theme.colors.text.secondary;
        if (amount > 0.001) {
            ctx.shadowColor = colorWithAlpha(Theme.colors.tanks[0], 0.35 * amount);
            ctx.shadowBlur = 6 * amount;
        }
        ctx.fillText(text, drawX, drawY);
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
            const text = items[i].value
                ? `${items[i].label}:  < ${items[i].value} >`
                : items[i].label;
            this._drawKeyboardOptionText(ctx, text, y, this._getSelectionAmount('main', i));
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
        ctx.fillText(this._getCurrentSettingsTitle(), CANVAS_W / 2, 100);
        ctx.font = '14px monospace';
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.fillText(this._getCurrentSettingsSubtitle(), CANVAS_W / 2, 126);

        const startY = 210;
        const gap = 60;
        const items = this._getCurrentSettingsItems();
        const pageKey = this.page === 'mapSize' ? 'mapSize' : 'settings';

        for (let i = 0; i < items.length; i++) {
            const y = startY + i * gap;
            const label = this._getSettingsItemLabel(items[i]);
            const value = this._getSettingsItemValue(items[i]);
            const text = value ? `${label}:  < ${value} >` : label;
            this._drawKeyboardOptionText(ctx, text, y, this._getSelectionAmount(pageKey, i));
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
            this._drawTouchOptionCard(
                ctx,
                card,
                items[i].label,
                items[i].value,
                items[i].subtitle,
                this._getSelectionAmount('main', i),
                this._getTouchPulseAmount('main', i),
                optionColors[i]
            );
        }

        for (let i = 3; i < layout.options.length; i++) {
            const card = layout.options[i];
            this._drawTouchActionCard(
                ctx,
                card,
                items[i].label,
                items[i].subtitle,
                this._getSelectionAmount('main', i),
                this._getTouchPulseAmount('main', i),
                i === 3 ? Theme.colors.tanks[0] : Theme.colors.tanks[1],
                i === 3
            );
        }

    }

    _drawTouchSettings(ctx) {
        const layout = this._getTouchSettingsLayout();
        const items = this._getCurrentSettingsItems();

        this._drawTouchBoard(ctx, layout.leftPanel, Theme.colors.tanks[1]);
        this._drawTouchBoard(ctx, layout.rightPanel, Theme.colors.tanks[0]);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = 'bold 34px monospace';
        ctx.fillText(this._getCurrentSettingsTitle(), layout.leftPanel.x + layout.leftPanel.w / 2, layout.leftPanel.y + 22);
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.font = '14px monospace';
        ctx.fillText(this._getCurrentSettingsSubtitle(), layout.leftPanel.x + layout.leftPanel.w / 2, layout.leftPanel.y + 56);
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
            const pageKey = this.page;
            const selectionAmount = this._getSelectionAmount(pageKey, i);
            const pulseAmount = this._getTouchPulseAmount(pageKey, i);
            const item = items[i];

            if (item.kind === 'adjust') {
                const label = this._getSettingsItemLabel(item);
                const value = this._getSettingsItemValue(item);
                const accent = item.setting === 'language'
                    ? Theme.colors.tanks[1]
                    : (item.setting === 'theme' ? (Theme.colors.tanks[2] || Theme.colors.tanks[0]) : Theme.colors.tanks[0]);
                const subtitle = this.page === 'mapSize' ? t('mapSizeHint') : t('touchHint');
                this._drawTouchOptionCard(ctx, card, label, value, subtitle, selectionAmount, pulseAmount, accent);
            } else if (item.kind === 'controls') {
                this._drawTouchActionCard(
                    ctx,
                    card,
                    t('controlsConfig'),
                    '',
                    selectionAmount,
                    pulseAmount,
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
                    selectionAmount,
                    pulseAmount,
                    accent,
                    false
                );
            } else {
                this._drawTouchActionCard(
                    ctx,
                    card,
                    this._plainLabel(t('back')),
                    this.page === 'mapSize' ? t('mapSizeHint') : t('touchHint'),
                    selectionAmount,
                    pulseAmount,
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

    _drawTouchOptionCard(ctx, card, label, value, subtitle, selectionAmount, pulseAmount, accentColor) {
        const emphasis = this._getCardEmphasis(selectionAmount, pulseAmount);
        const compact = card.w < 220 || card.h < 90;
        const spacious = card.h >= 108 && card.w >= 300;
        const sidePad = compact ? 10 : (spacious ? 22 : 18);
        const topTextY = compact ? 22 : (spacious ? 30 : 26);
        const subTextY = compact ? 38 : (spacious ? 50 : 46);
        const arrowW = compact ? 30 : (spacious ? 44 : 40);
        const controlH = compact ? 20 : (spacious ? 30 : 24);
        const gap = compact ? 6 : 10;
        const controlBottomPad = compact ? 10 : (spacious ? 14 : 12);
        const controlY = card.y + card.h - controlH - controlBottomPad;
        const valueW = Math.max(44, card.w - sidePad * 2 - arrowW * 2 - gap * 2);
        const valueX = card.x + sidePad + arrowW + gap;
        const labelFont = this._fitTouchCardFont(
            ctx,
            label,
            card.w - sidePad * 2,
            emphasis > 0.45
                ? (compact ? [16, 15, 14, 13] : [19, 18, 17, 16, 15, 14])
                : (compact ? [15, 14, 13] : [18, 17, 16, 15, 14]),
            true
        );
        const subtitleFont = this._fitTouchCardFont(
            ctx,
            subtitle,
            card.w - sidePad * 2,
            compact ? [10, 9] : [12, 11, 10],
            false
        );
        const valueFont = this._fitTouchCardFont(
            ctx,
            value,
            valueW - 12,
            compact ? [12, 11, 10] : [13, 12, 11],
            true
        );
        const scale = 1 + pulseAmount * 0.035;

        ctx.save();
        if (scale !== 1) {
            const cx = card.x + card.w / 2;
            const cy = card.y + card.h / 2;
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
        }

        TouchUI.drawPanel(ctx, card.x, card.y, card.w, card.h, {
            radius: card.radius,
            fill: TouchUI.surfaceSoftFill(1),
            border: TouchUI.surfaceStroke(1),
            inset: TouchUI.innerStroke(1),
            shadow: false,
            glowColor: emphasis > 0.02 ? colorWithAlpha(accentColor, 0.12 + emphasis * 0.1) : null,
            glowWidth: 2
        });

        if (emphasis > 0.01) {
            ctx.save();
            roundedRectPath(ctx, card.x, card.y, card.w, card.h, card.radius);
            ctx.fillStyle = colorWithAlpha(accentColor, lerp(Theme.current === 'dark' ? 0.04 : 0.035, Theme.current === 'dark' ? 0.14 : 0.12, emphasis));
            ctx.fill();
            ctx.strokeStyle = colorWithAlpha(accentColor, lerp(0.18, 0.52, emphasis));
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
        }

        TouchUI.drawPill(ctx, card.x + sidePad, controlY, arrowW, controlH, '<', {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: lerp(0.12, 0.2, emphasis),
            borderOpacity: lerp(0.25, 0.5, emphasis),
            font: compact ? 'bold 12px monospace' : 'bold 14px monospace'
        });
        TouchUI.drawPill(ctx, card.x + card.w - sidePad - arrowW, controlY, arrowW, controlH, '>', {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: lerp(0.12, 0.2, emphasis),
            borderOpacity: lerp(0.25, 0.5, emphasis),
            font: compact ? 'bold 12px monospace' : 'bold 14px monospace'
        });
        TouchUI.drawPill(ctx, valueX, controlY, valueW, controlH, value, {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: lerp(0.1, 0.18, emphasis),
            borderOpacity: lerp(0.22, 0.44, emphasis),
            font: valueFont
        });

        ctx.save();
        ctx.beginPath();
        ctx.rect(card.x + sidePad, card.y + 10, card.w - sidePad * 2, Math.max(20, controlY - card.y - 16));
        ctx.clip();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = labelFont;
        ctx.fillText(label, card.x + sidePad, card.y + topTextY);

        ctx.fillStyle = colorWithAlpha(Theme.colors.text.hint, lerp(0.82, 1, emphasis));
        ctx.font = subtitleFont;
        ctx.fillText(subtitle, card.x + sidePad, card.y + subTextY);
        ctx.restore();
        ctx.restore();
    }

    _drawTouchActionCard(ctx, card, label, subtitle, selectionAmount, pulseAmount, accentColor, primary) {
        const emphasis = this._getCardEmphasis(selectionAmount, pulseAmount);
        const compact = !primary && (card.h < 88 || card.w < 360);
        const spacious = !compact && card.h >= 92;
        const okW = primary ? 82 : (compact ? 62 : 76);
        const okH = primary ? 30 : (compact ? 24 : 28);
        const okX = card.x + card.w - okW - (compact ? 16 : 20);
        const okY = card.y + (compact ? 12 : 16);
        const titleX = card.x + (compact ? 18 : 22);
        const textMaxW = Math.max(80, okX - titleX - 12);
        const titleY = card.y + (primary ? 40 : (compact ? 28 : (spacious ? 34 : 28)));
        const subtitleY = card.y + (primary ? 66 : (compact ? 48 : (spacious ? 58 : 48)));
        const titleFont = this._fitTouchCardFont(
            ctx,
            label,
            textMaxW,
            primary ? [24, 22, 20, 18] : (compact ? [18, 17, 16, 15, 14] : [22, 20, 18, 16]),
            true
        );
        const subtitleFont = this._fitTouchCardFont(
            ctx,
            subtitle,
            textMaxW,
            primary ? [13, 12, 11] : (compact ? [11, 10, 9] : [12, 11, 10]),
            false
        );
        const scale = 1 + pulseAmount * 0.04;
        const baseFill = primary
            ? colorWithAlpha(accentColor, Theme.current === 'dark' ? 0.2 : 0.16)
            : TouchUI.surfaceSoftFill(1);
        const baseBorder = primary
            ? colorWithAlpha(accentColor, 0.4)
            : TouchUI.surfaceStroke(1);

        ctx.save();
        if (scale !== 1) {
            const cx = card.x + card.w / 2;
            const cy = card.y + card.h / 2;
            ctx.translate(cx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-cx, -cy);
        }

        TouchUI.drawPanel(ctx, card.x, card.y, card.w, card.h, {
            radius: card.radius,
            fill: baseFill,
            border: baseBorder,
            inset: TouchUI.innerStroke(1),
            shadow: false,
            glowColor: primary || emphasis > 0.02 ? colorWithAlpha(accentColor, 0.12 + emphasis * 0.1) : null,
            glowWidth: 2
        });

        if (emphasis > 0.01) {
            ctx.save();
            roundedRectPath(ctx, card.x, card.y, card.w, card.h, card.radius);
            ctx.fillStyle = colorWithAlpha(accentColor, lerp(primary ? 0.04 : 0.03, primary ? 0.12 : 0.1, emphasis));
            ctx.fill();
            ctx.strokeStyle = colorWithAlpha(accentColor, lerp(primary ? 0.22 : 0.16, primary ? 0.48 : 0.36, emphasis));
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.restore();
        }

        TouchUI.drawPill(ctx, okX, okY, okW, okH, 'OK', {
            accentColor,
            textColor: Theme.colors.text.primary,
            fillOpacity: lerp(primary ? 0.16 : 0.12, primary ? 0.24 : 0.18, emphasis),
            borderOpacity: lerp(primary ? 0.34 : 0.24, primary ? 0.5 : 0.36, emphasis),
            font: compact ? 'bold 11px monospace' : undefined
        });

        ctx.save();
        ctx.beginPath();
        ctx.rect(titleX, card.y + 8, textMaxW, card.h - 16);
        ctx.clip();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = titleFont;
        ctx.fillText(label, titleX, titleY);

        ctx.fillStyle = colorWithAlpha(Theme.colors.text.hint, lerp(0.82, 1, emphasis));
        ctx.font = subtitleFont;
        ctx.fillText(subtitle, titleX, subtitleY);
        ctx.restore();
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
        const items = this._getCurrentSettingsItems();
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
        const leftCardH = this.page === 'mapSize' ? 98 : 92;
        const leftGap = 12;
        const noteY = leftCardY + (leftCardH + leftGap) * Math.min(2, items.length) + 6;
        const noteH = leftPanel.y + leftPanel.h - innerPad - noteY;
        const rightCardX = rightPanel.x + innerPad;
        const rightCardW = rightPanel.w - innerPad * 2;
        const rightCount = Math.max(0, items.length - 2);
        const rightTopPad = 26;
        const rightBottomPad = 26;
        const rightGap = rightCount > 3 ? 10 : 12;
        const backH = rightCount > 3 ? 68 : 82;
        const rightNormalCount = Math.max(0, rightCount - 1);
        const rightAvailable = panelH - rightTopPad - rightBottomPad - rightGap * Math.max(0, rightCount - 1) - backH;
        const rightCardH = rightNormalCount > 0
            ? Math.max(rightCount > 3 ? 76 : 88, Math.min(96, Math.floor(rightAvailable / rightNormalCount)))
            : 96;
        const rightStartY = rightPanel.y + rightTopPad;
        const options = [];
        let nextRightY = rightStartY;

        for (let i = 0; i < items.length; i++) {
            if (i < 2) {
                options.push({ x: leftCardX, y: leftCardY + i * (leftCardH + leftGap), w: leftCardW, h: leftCardH, radius: 22, kind: items[i].kind });
            } else {
                const item = items[i];
                const h = item.kind === 'back' ? backH : rightCardH;
                options.push({ x: rightCardX, y: nextRightY, w: rightCardW, h, radius: 22, kind: item.kind });
                nextRightY += h + rightGap;
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
            { kind: 'adjust', setting: 'theme' },
            { kind: 'action', action: 'mapSize' }
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

    _getMapSizeItems() {
        return [
            { kind: 'adjust', setting: 'minCols' },
            { kind: 'adjust', setting: 'minRows' },
            { kind: 'adjust', setting: 'maxCols' },
            { kind: 'adjust', setting: 'maxRows' },
            { kind: 'back' }
        ];
    }

    _getSettingsItemLabel(item) {
        if (item.kind === 'back') return t('back');
        if (item.kind === 'controls') return t('controlsConfig');
        if (item.kind === 'action' && item.action === 'mapSize') return t('mapSize');
        if (item.kind === 'action' && item.mode === 'desktop') return t('switchToDesktopUi');
        if (item.kind === 'action' && item.mode === 'touch') return t('switchToTouchUi');
        if (item.setting === 'language') return t('language');
        if (item.setting === 'theme') return t('theme');
        if (item.setting === 'singleControl') return t('singlePlayerControl');
        if (item.setting === 'minCols') return t('mapSizeMinCols');
        if (item.setting === 'minRows') return t('mapSizeMinRows');
        if (item.setting === 'maxCols') return t('mapSizeMaxCols');
        if (item.setting === 'maxRows') return t('mapSizeMaxRows');
        return '';
    }

    _getSettingsItemValue(item) {
        if (!item || item.kind !== 'adjust') return '';
        if (item.setting === 'language') return t('langName');
        if (item.setting === 'theme') return t(Theme.current === 'light' ? 'themeLight' : 'themeDark');
        if (item.setting === 'singleControl') return t(this._getSinglePlayerControlMode());
        if (item.setting === 'minCols') return `${this.mapSizeSettings.minCols}${t('mapSizeValueSuffix')}`;
        if (item.setting === 'minRows') return `${this.mapSizeSettings.minRows}${t('mapSizeValueSuffix')}`;
        if (item.setting === 'maxCols') return `${this.mapSizeSettings.maxCols}${t('mapSizeValueSuffix')}`;
        if (item.setting === 'maxRows') return `${this.mapSizeSettings.maxRows}${t('mapSizeValueSuffix')}`;
        return '';
    }

    _getTouchSettingsActionSubtitle(item) {
        if (item.kind === 'controls') return t('controlsSubtitle');
        if (item.kind === 'action' && item.action === 'mapSize') return t('mapSizeSubtitle');
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

    _fitTouchCardFont(ctx, text, maxWidth, sizes, bold) {
        const safeText = text || '';
        const safeSizes = sizes && sizes.length ? sizes : [12];
        for (let i = 0; i < safeSizes.length; i++) {
            const font = `${bold ? 'bold ' : ''}${safeSizes[i]}px monospace`;
            ctx.font = font;
            if (ctx.measureText(safeText).width <= maxWidth) return font;
        }
        return `${bold ? 'bold ' : ''}${safeSizes[safeSizes.length - 1]}px monospace`;
    }

    _isInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
    }
}
