// ===== 国际化 =====
const I18N_LANGS = ['zh', 'en'];

const I18N_DICT = {
    // 菜单标题
    title:        { zh: '坦克大战', en: 'TANK TROUBLE' },
    subtitle:     { zh: 'H5 网页版', en: 'H5 Edition' },

    // 菜单选项标签
    mode:         { zh: '模式', en: 'Mode' },
    winScore:     { zh: '胜利分数', en: 'Win Score' },
    aiDifficulty: { zh: 'AI 难度', en: 'AI Difficulty' },
    startGame:    { zh: '[ 开始游戏 ]', en: '[ START GAME ]' },
    settings:     { zh: '[ 设  置 ]', en: '[ SETTINGS ]' },

    // 模式名称
    '1pvai':      { zh: '1人 vs AI', en: '1 Player vs AI' },
    '2p':         { zh: '2人对战', en: '2 Players' },
    '2pvai':      { zh: '2人 + AI', en: '2 Players + AI' },
    '3p':         { zh: '3人对战', en: '3 Players' },
    '1pv2ai':     { zh: '1人 vs 2AI', en: '1 Player vs 2 AI' },

    // 难度
    easy:         { zh: '简单', en: 'EASY' },
    medium:       { zh: '中等', en: 'MEDIUM' },
    hard:         { zh: '困难', en: 'HARD' },

    // 操作提示
    controls:     { zh: 'P1: 方向键+M  |  P2: WASD+空格  |  P3: 鼠标', en: 'P1: Arrow Keys + M  |  P2: WASD + Space  |  P3: Mouse' },
    navHint:      { zh: '↑↓ 选择  |  ←→ 切换  |  回车确认', en: '↑↓ Navigate  |  ←→ Change  |  Enter Start' },

    // 设置页面
    settingsTitle:{ zh: '设  置', en: 'SETTINGS' },
    language:     { zh: '语言', en: 'Language' },
    langName:     { zh: '中文', en: 'English' },
    theme:        { zh: '主题', en: 'Theme' },
    themeLight:   { zh: '亮色模式', en: 'Light Mode' },
    themeDark:    { zh: '深色模式', en: 'Dark Mode' },
    back:         { zh: '[ 返  回 ]', en: '[ BACK ]' },

    // 游戏内消息
    scores:       { zh: '得分！', en: 'scores!' },
    draw:         { zh: '平局！', en: 'Draw!' },
    winsGame:     { zh: '赢得比赛！', en: 'WINS THE GAME!' },
    pressEnter:   { zh: '按 回车键 继续', en: 'Press Enter to continue' },
    ai:           { zh: 'AI', en: 'AI' },
};

const I18n = {
    lang: 'zh',

    init() {
        const saved = localStorage.getItem('tankgame_lang');
        if (saved && I18N_LANGS.indexOf(saved) !== -1) {
            this.lang = saved;
        }
    },

    setLang(lang) {
        this.lang = lang;
        localStorage.setItem('tankgame_lang', lang);
    },

    nextLang() {
        const idx = (I18N_LANGS.indexOf(this.lang) + 1) % I18N_LANGS.length;
        this.setLang(I18N_LANGS[idx]);
    },

    prevLang() {
        const idx = (I18N_LANGS.indexOf(this.lang) - 1 + I18N_LANGS.length) % I18N_LANGS.length;
        this.setLang(I18N_LANGS[idx]);
    }
};

function t(key) {
    const entry = I18N_DICT[key];
    if (!entry) return key;
    return entry[I18n.lang] || entry['en'] || key;
}

I18n.init();
