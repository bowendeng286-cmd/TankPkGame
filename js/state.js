const STATE = {
    MENU: 'MENU',
    SETTINGS: 'SETTINGS',
    CONTROLS_CONFIG: 'CONTROLS_CONFIG',
    PLAYING: 'PLAYING',
    ROUND_PAUSE: 'ROUND_PAUSE',
    GAME_OVER: 'GAME_OVER',
};

class GameState {
    constructor() {
        this.current = STATE.MENU;
        this.pauseTimer = 0;
        this.roundMessage = '';
        this.winScore = 5;
    }
    transitionTo(state, msg) {
        this.current = state;
        if (msg) this.roundMessage = msg;
    }
    update(dt) {
        if (this.current === STATE.ROUND_PAUSE) {
            this.pauseTimer -= dt;
            if (this.pauseTimer <= 0) return true; // pause done
        }
        return false;
    }
    startPause(duration, msg) {
        this.current = STATE.ROUND_PAUSE;
        this.pauseTimer = duration;
        this.roundMessage = msg || '';
    }
}
