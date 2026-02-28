// ===== 主题管理系统 =====

const THEMES = {
    light: {
        bg: '#F5F0E1',
        wall: '#333333',
        grid: '#E8E0D0',
        tanks: ['#E74C3C', '#3498DB', '#2ECC71'],
        outline: '#222222',
        bullet: '#222222',
        text: {
            primary: '#333333',
            secondary: '#555555',
            hint: '#888888'
        }
    },
    dark: {
        bg: '#2B2B2B',
        wall: '#B8B8B8',
        grid: '#3A3A3A',
        tanks: ['#E57368', '#6BB6E8', '#5FD68D'],
        outline: '#E8E8E8',
        bullet: '#E8E8E8',
        text: {
            primary: '#E0E0E0',
            secondary: '#B0B0B0',
            hint: '#888888'
        }
    }
};

const Theme = {
    current: 'light',
    colors: null,

    init() {
        // 从 localStorage 读取用户偏好
        const saved = localStorage.getItem('tankgame_theme');
        if (saved && THEMES[saved]) {
            this.current = saved;
        }
        this.colors = THEMES[this.current];
    },

    setTheme(name) {
        if (!THEMES[name]) return;
        this.current = name;
        this.colors = THEMES[name];
        localStorage.setItem('tankgame_theme', name);
    },

    toggle() {
        const newTheme = this.current === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }
};

// 初始化主题
Theme.init();
