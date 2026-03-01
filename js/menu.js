var ALL_MODES = [
    { key: '1pvai', players: 1, ai: 1 },
    { key: '2p', players: 2, ai: 0 },
    { key: '2pvai', players: 2, ai: 1 },
    { key: '3p', players: 3, ai: 0 },
    { key: '1pv2ai', players: 1, ai: 2 },
];

// 根据设备类型过滤模式
function getAvailableModes(input) {
    if (input && input.isTouchDevice) {
        // 手机端过滤掉3人模式
        return ALL_MODES.filter(m => m.players !== 3);
    }
    return ALL_MODES;
}

var MODES = ALL_MODES; // 默认全部模式
var WIN_SCORES = [3, 5, 7, 10];
var DIFFICULTIES = ['easy', 'medium', 'hard'];

class Menu {
    constructor() {
        this.modeIndex = 0;
        this.scoreIndex = 1; // default 5
        this.diffIndex = 1;  // default medium
        this.row = 0;        // 0=mode, 1=score, 2=diff, 3=start, 4=settings
        this.maxRow = 4;
        this._onKey = null;
        this.done = false;
        this.result = null;
        this.page = 'main'; // 'main' or 'settings'
        this.settingsRow = 0;   // 0=language, 1=theme, 2=back
        this.settingsMaxRow = 2;
        this.openSettings = false; // 信号：通知 main.js 切换到 SETTINGS 状态
        this._onTouchEnd = null;  // 触摸事件处理器
    }

    activate(input) {
        this.done = false;
        this.result = null;
        this.openSettings = false;
        this.page = 'main';
        this._input = input;
        this._prevKeys = new Set();
        
        // 根据设备类型更新可用模式
        MODES = getAvailableModes(input);
        // 确保当前选择的模式索引有效
        if (this.modeIndex >= MODES.length) {
            this.modeIndex = 0;
        }
        
        // 绑定触摸事件
        if (input.isTouchDevice && input._canvas) {
            this._onTouchEnd = (e) => {
                e.preventDefault();
                if (e.changedTouches.length > 0) {
                    const touch = e.changedTouches[0];
                    const pos = input._touchToCanvasCoords(touch);
                    
                    if (this.page === 'main') {
                        this._handleMainTouch(pos.x, pos.y);
                    } else if (this.page === 'settings') {
                        this._handleSettingsTouch(pos.x, pos.y);
                    }
                }
            };
            input._canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
        }
    }
    
    deactivate() {
        // 移除触摸事件监听
        if (this._onTouchEnd && this._input && this._input._canvas) {
            this._input._canvas.removeEventListener('touchend', this._onTouchEnd);
            this._onTouchEnd = null;
        }
    }

    update() {
        if (this.page === 'main') {
            this._updateMain();
        } else if (this.page === 'settings') {
            this._updateSettings();
        }
    }

    _updateMain() {
        const input = this._input;
        const justPressed = (code) => {
            const down = input.isDown(code);
            const was = this._prevKeys.has(code);
            if (down && !was) { this._prevKeys.add(code); return true; }
            if (!down) this._prevKeys.delete(code);
            return false;
        };

        // 键盘输入
        let upPressed = justPressed('ArrowUp') || justPressed('KeyW');
        let downPressed = justPressed('ArrowDown') || justPressed('KeyS');
        let leftPressed = justPressed('ArrowLeft') || justPressed('KeyA');
        let rightPressed = justPressed('ArrowRight') || justPressed('KeyD');
        let confirmPressed = justPressed('Enter') || justPressed('Space');

        if (upPressed) this.row = Math.max(0, this.row - 1);
        if (downPressed) this.row = Math.min(this.maxRow, this.row + 1);

        if (leftPressed) {
            if (this.row === 0) this.modeIndex = (this.modeIndex - 1 + MODES.length) % MODES.length;
            if (this.row === 1) this.scoreIndex = (this.scoreIndex - 1 + WIN_SCORES.length) % WIN_SCORES.length;
            if (this.row === 2) this.diffIndex = (this.diffIndex - 1 + DIFFICULTIES.length) % DIFFICULTIES.length;
        }
        if (rightPressed) {
            if (this.row === 0) this.modeIndex = (this.modeIndex + 1) % MODES.length;
            if (this.row === 1) this.scoreIndex = (this.scoreIndex + 1) % WIN_SCORES.length;
            if (this.row === 2) this.diffIndex = (this.diffIndex + 1) % DIFFICULTIES.length;
        }
        if (confirmPressed) {
            if (this.row === 3) {
                // START GAME
                const mode = MODES[this.modeIndex];
                this.result = {
                    humanCount: mode.players,
                    aiCount: mode.ai,
                    winScore: WIN_SCORES[this.scoreIndex],
                    difficulty: DIFFICULTIES[this.diffIndex],
                };
                this.done = true;
            } else if (this.row === 4) {
                // SETTINGS
                this.page = 'settings';
                this.settingsRow = 0;
                this.openSettings = true;
            }
        }
    }

    _updateSettings() {
        const input = this._input;
        const justPressed = (code) => {
            const down = input.isDown(code);
            const was = this._prevKeys.has(code);
            if (down && !was) { this._prevKeys.add(code); return true; }
            if (!down) this._prevKeys.delete(code);
            return false;
        };

        // 键盘输入
        let upPressed = justPressed('ArrowUp') || justPressed('KeyW');
        let downPressed = justPressed('ArrowDown') || justPressed('KeyS');
        let leftPressed = justPressed('ArrowLeft') || justPressed('KeyA');
        let rightPressed = justPressed('ArrowRight') || justPressed('KeyD');
        let confirmPressed = justPressed('Enter') || justPressed('Space');
        let escPressed = justPressed('Escape');

        if (upPressed) this.settingsRow = Math.max(0, this.settingsRow - 1);
        if (downPressed) this.settingsRow = Math.min(this.settingsMaxRow, this.settingsRow + 1);

        if (leftPressed) {
            if (this.settingsRow === 0) I18n.prevLang();
            if (this.settingsRow === 1) Theme.toggle();
        }
        if (rightPressed) {
            if (this.settingsRow === 0) I18n.nextLang();
            if (this.settingsRow === 1) Theme.toggle();
        }
        if (confirmPressed) {
            if (this.settingsRow === this.settingsMaxRow) {
                // BACK
                this.page = 'main';
                this.openSettings = false;
            }
        }
        if (escPressed) {
            this.page = 'main';
            this.openSettings = false;
        }
    }
    
    _handleMainTouch(x, y) {
        const startY = 180;
        const gap = 55;
        const rowHeight = 40;
        
        // 检测点击的菜单行
        for (let i = 0; i < 5; i++) {
            const itemY = startY + i * gap;
            if (y >= itemY - rowHeight/2 && y <= itemY + rowHeight/2) {
                this.row = i;
                
                // 可调整项（模式、分数、难度）
                if (i < 3) {
                    if (x < CANVAS_W / 2) {
                        // 左侧：减少
                        if (i === 0) this.modeIndex = (this.modeIndex - 1 + MODES.length) % MODES.length;
                        if (i === 1) this.scoreIndex = (this.scoreIndex - 1 + WIN_SCORES.length) % WIN_SCORES.length;
                        if (i === 2) this.diffIndex = (this.diffIndex - 1 + DIFFICULTIES.length) % DIFFICULTIES.length;
                    } else {
                        // 右侧：增加
                        if (i === 0) this.modeIndex = (this.modeIndex + 1) % MODES.length;
                        if (i === 1) this.scoreIndex = (this.scoreIndex + 1) % WIN_SCORES.length;
                        if (i === 2) this.diffIndex = (this.diffIndex + 1) % DIFFICULTIES.length;
                    }
                }
                // 按钮项（开始游戏、设置）
                else {
                    if (i === 3) {
                        // START GAME
                        const mode = MODES[this.modeIndex];
                        this.result = {
                            humanCount: mode.players,
                            aiCount: mode.ai,
                            winScore: WIN_SCORES[this.scoreIndex],
                            difficulty: DIFFICULTIES[this.diffIndex],
                        };
                        this.done = true;
                    } else if (i === 4) {
                        // SETTINGS
                        this.page = 'settings';
                        this.settingsRow = 0;
                    }
                }
                break;
            }
        }
    }
    
    _handleSettingsTouch(x, y) {
        const startY = 200;
        const gap = 60;
        const rowHeight = 40;
        
        // 检测点击的设置行
        for (let i = 0; i < 3; i++) {
            const itemY = startY + i * gap;
            if (y >= itemY - rowHeight/2 && y <= itemY + rowHeight/2) {
                this.settingsRow = i;
                
                // 可调整项（语言、主题）
                if (i < 2) {
                    if (x < CANVAS_W / 2) {
                        // 左侧：减少
                        if (i === 0) I18n.prevLang();
                        if (i === 1) Theme.toggle();
                    } else {
                        // 右侧：增加
                        if (i === 0) I18n.nextLang();
                        if (i === 1) Theme.toggle();
                    }
                }
                // 返回按钮
                else if (i === 2) {
                    this.page = 'main';
                    this.openSettings = false;
                }
                break;
            }
        }
    }

    draw(ctx) {
        if (this.page === 'main') {
            this._drawMain(ctx);
        } else if (this.page === 'settings') {
            this._drawSettings(ctx);
        }
    }

    _drawMain(ctx) {
        ctx.fillStyle = Theme.colors.bg;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.textAlign = 'center';
        // Title
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
            if (items[i].value) {
                ctx.fillText(`${items[i].label}:  < ${items[i].value} >`, CANVAS_W / 2, y);
            } else {
                ctx.fillText(items[i].label, CANVAS_W / 2, y);
            }
        }

        ctx.font = '14px monospace';
        ctx.fillStyle = Theme.colors.text.hint;
        if (!this._input.touchEnabled) {
            ctx.fillText(t('controls'), CANVAS_W / 2, CANVAS_H - 40);
            ctx.fillText(t('navHint'), CANVAS_W / 2, CANVAS_H - 20);
        } else {
            // 触摸设备提示
            ctx.fillText(t('touchHint') || 'Tap to select', CANVAS_W / 2, CANVAS_H - 20);
        }
    }

    _drawSettings(ctx) {
        ctx.fillStyle = Theme.colors.bg;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.textAlign = 'center';
        // Title
        ctx.font = 'bold 40px monospace';
        ctx.fillStyle = Theme.colors.text.primary;
        ctx.fillText(t('settingsTitle'), CANVAS_W / 2, 100);

        const startY = 200;
        const gap = 70;
        const items = [
            { label: t('language'), value: t('langName') },
            { label: t('theme'), value: t(Theme.current === 'light' ? 'themeLight' : 'themeDark') },
            { label: t('back'), value: '' },
        ];

        for (let i = 0; i < items.length; i++) {
            const y = startY + i * gap;
            const selected = i === this.settingsRow;
            ctx.font = selected ? 'bold 22px monospace' : '20px monospace';
            ctx.fillStyle = selected ? Theme.colors.tanks[0] : Theme.colors.text.secondary;
            if (items[i].value) {
                ctx.fillText(`${items[i].label}:  < ${items[i].value} >`, CANVAS_W / 2, y);
            } else {
                ctx.fillText(items[i].label, CANVAS_W / 2, y);
            }
        }

        ctx.font = '14px monospace';
        ctx.fillStyle = Theme.colors.text.hint;
        ctx.fillText(t('navHint'), CANVAS_W / 2, CANVAS_H - 20);
    }
}
