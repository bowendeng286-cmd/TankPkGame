class InputManager {
    constructor() {
        this.keys = new Set();
        // 鼠标状态（canvas 逻辑坐标）
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseDown = false;
        this._canvas = null;

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
    }

    // 绑定 canvas 以启用鼠标坐标转换
    bindCanvas(cvs) {
        this._canvas = cvs;
        cvs.addEventListener('mousemove', this._onMouseMove);
        cvs.addEventListener('mousedown', this._onMouseDown);
        cvs.addEventListener('mouseup', this._onMouseUp);
        cvs.addEventListener('contextmenu', this._onContextMenu);
    }

    _updateMousePos(e) {
        if (!this._canvas) return;
        const rect = this._canvas.getBoundingClientRect();
        this.mouseX = (e.clientX - rect.left) * (this._canvas.width / rect.width);
        this.mouseY = (e.clientY - rect.top) * (this._canvas.height / rect.height);
    }

    isDown(code) { return this.keys.has(code); }
    reset() { this.keys.clear(); this.mouseDown = false; }
    destroy() {
        window.removeEventListener('keydown', this._onDown);
        window.removeEventListener('keyup', this._onUp);
        if (this._canvas) {
            this._canvas.removeEventListener('mousemove', this._onMouseMove);
            this._canvas.removeEventListener('mousedown', this._onMouseDown);
            this._canvas.removeEventListener('mouseup', this._onMouseUp);
            this._canvas.removeEventListener('contextmenu', this._onContextMenu);
        }
    }
}
