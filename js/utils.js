// ===== 向量运算 =====
function vec2(x, y) { return { x, y }; }
function vecAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function vecSub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function vecScale(v, s) { return { x: v.x * s, y: v.y * s }; }
function vecDot(a, b) { return a.x * b.x + a.y * b.y; }
function vecLen(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
function vecDist(a, b) { return vecLen(vecSub(a, b)); }
function vecNorm(v) {
    const l = vecLen(v);
    return l > 0 ? { x: v.x / l, y: v.y / l } : { x: 0, y: 0 };
}
function vecPerp(v) { return { x: -v.y, y: v.x }; }
function vecRotate(v, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

// ===== 几何工具 =====
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
}

// 线段最近点
function closestPointOnSegment(p, a, b) {
    const ab = vecSub(b, a);
    const len2 = vecDot(ab, ab);
    if (len2 === 0) return { ...a };
    const t = clamp(vecDot(vecSub(p, a), ab) / len2, 0, 1);
    return vecAdd(a, vecScale(ab, t));
}

// 射线-线段交点 (返回 t 参数, -1 表示无交点)
function raySegmentIntersect(origin, dir, a, b) {
    const d = vecSub(b, a);
    const denom = dir.x * d.y - dir.y * d.x;
    if (Math.abs(denom) < 1e-10) return -1;
    const t = ((a.x - origin.x) * d.y - (a.y - origin.y) * d.x) / denom;
    const u = ((a.x - origin.x) * dir.y - (a.y - origin.y) * dir.x) / denom;
    if (t >= 0 && u >= 0 && u <= 1) return t;
    return -1;
}

// ===== RNG =====
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.random() * (max - min) + min; }
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randInt(0, i);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function parseColor(color) {
    if (typeof color !== 'string') return null;

    const hex = color.trim();
    if (hex[0] === '#') {
        let value = hex.slice(1);
        if (value.length === 3) {
            value = value.split('').map((ch) => ch + ch).join('');
        }
        if (value.length !== 6) return null;
        return {
            r: parseInt(value.slice(0, 2), 16),
            g: parseInt(value.slice(2, 4), 16),
            b: parseInt(value.slice(4, 6), 16),
            a: 1
        };
    }

    const match = hex.match(/^rgba?\(([^)]+)\)$/i);
    if (!match) return null;

    const parts = match[1].split(',').map((part) => parseFloat(part.trim()));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;

    return {
        r: clamp(parts[0], 0, 255),
        g: clamp(parts[1], 0, 255),
        b: clamp(parts[2], 0, 255),
        a: parts.length > 3 ? clamp(parts[3], 0, 1) : 1
    };
}

function colorWithAlpha(color, alpha) {
    const parsed = parseColor(color);
    if (!parsed) return color;
    return `rgba(${Math.round(parsed.r)}, ${Math.round(parsed.g)}, ${Math.round(parsed.b)}, ${clamp(alpha, 0, 1)})`;
}

function mixColor(colorA, colorB, t) {
    const a = parseColor(colorA);
    const b = parseColor(colorB);
    if (!a || !b) return colorA;

    const ratio = clamp(t, 0, 1);
    return `rgb(${Math.round(lerp(a.r, b.r, ratio))}, ${Math.round(lerp(a.g, b.g, ratio))}, ${Math.round(lerp(a.b, b.b, ratio))})`;
}

function lightenColor(color, amount) {
    return mixColor(color, '#FFFFFF', amount);
}

function darkenColor(color, amount) {
    return mixColor(color, '#000000', amount);
}

function roundedRectPath(ctx, x, y, w, h, radius) {
    const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

const TouchUI = {
    playerColor(index) {
        return Theme.colors.tanks[index] || Theme.colors.tanks[0];
    },

    playerDeepColor(index) {
        return darkenColor(this.playerColor(index), 0.26);
    },

    surfaceFill(alpha = 1) {
        return Theme.current === 'dark'
            ? colorWithAlpha('#181818', 0.84 * alpha)
            : colorWithAlpha('#FFF7E8', 0.92 * alpha);
    },

    surfaceSoftFill(alpha = 1) {
        return Theme.current === 'dark'
            ? colorWithAlpha('#FFFFFF', 0.06 * alpha)
            : colorWithAlpha('#000000', 0.045 * alpha);
    },

    surfaceStroke(alpha = 1) {
        return Theme.current === 'dark'
            ? colorWithAlpha('#FFFFFF', 0.12 * alpha)
            : colorWithAlpha('#000000', 0.11 * alpha);
    },

    innerStroke(alpha = 1) {
        return Theme.current === 'dark'
            ? colorWithAlpha('#FFFFFF', 0.05 * alpha)
            : colorWithAlpha('#FFFFFF', 0.55 * alpha);
    },

    shadow(alpha = 1) {
        return Theme.current === 'dark'
            ? colorWithAlpha('#000000', 0.42 * alpha)
            : colorWithAlpha('#000000', 0.18 * alpha);
    },

    drawTitle(ctx, title, subtitle, accentColor, titleY = 42) {
        const accent = accentColor || Theme.colors.tanks[0];

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.fillStyle = Theme.colors.text.primary;
        ctx.font = 'bold 42px monospace';
        ctx.fillText(title, CANVAS_W / 2, titleY);

        ctx.fillStyle = Theme.colors.text.hint;
        ctx.font = '14px monospace';
        ctx.fillText(subtitle, CANVAS_W / 2, titleY + 34);

        const lineY = titleY + 58;
        const lineW = 240;
        const grad = ctx.createLinearGradient(
            CANVAS_W / 2 - lineW / 2, lineY,
            CANVAS_W / 2 + lineW / 2, lineY
        );
        grad.addColorStop(0, colorWithAlpha(accent, 0));
        grad.addColorStop(0.5, colorWithAlpha(accent, 0.95));
        grad.addColorStop(1, colorWithAlpha(accent, 0));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(CANVAS_W / 2 - lineW / 2, lineY);
        ctx.lineTo(CANVAS_W / 2 + lineW / 2, lineY);
        ctx.stroke();

        ctx.restore();
    },

    drawPanel(ctx, x, y, w, h, options = {}) {
        const radius = options.radius || 18;
        const fill = options.fill || this.surfaceFill(options.fillAlpha || 1);
        const border = options.border || this.surfaceStroke(options.borderAlpha || 1);
        const inset = options.inset || this.innerStroke(options.insetAlpha || 1);
        const shadow = options.shadow === false ? null : (options.shadowColor || this.shadow(options.shadowAlpha || 1));
        const glow = options.glowColor || null;

        ctx.save();
        if (shadow) {
            ctx.shadowColor = shadow;
            ctx.shadowBlur = options.shadowBlur || 18;
            ctx.shadowOffsetY = options.shadowOffsetY || 6;
        }
        roundedRectPath(ctx, x, y, w, h, radius);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.restore();

        ctx.save();
        roundedRectPath(ctx, x, y, w, h, radius);
        ctx.strokeStyle = border;
        ctx.lineWidth = options.lineWidth || 1.5;
        ctx.stroke();

        roundedRectPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, Math.max(0, radius - 1.5));
        ctx.strokeStyle = inset;
        ctx.lineWidth = 1;
        ctx.stroke();

        if (glow) {
            roundedRectPath(ctx, x, y, w, h, radius);
            ctx.strokeStyle = glow;
            ctx.lineWidth = options.glowWidth || 2;
            ctx.stroke();
        }
        ctx.restore();
    },

    drawPill(ctx, x, y, w, h, text, options = {}) {
        this.drawPanel(ctx, x, y, w, h, {
            radius: options.radius || Math.min(h / 2, 14),
            fill: options.fill || colorWithAlpha(options.accentColor || Theme.colors.tanks[0], options.fillOpacity || 0.16),
            border: options.border || colorWithAlpha(options.accentColor || Theme.colors.tanks[0], options.borderOpacity || 0.42),
            inset: options.inset || colorWithAlpha('#FFFFFF', Theme.current === 'dark' ? 0.04 : 0.35),
            shadow: false,
            lineWidth: 1.2
        });

        ctx.save();
        ctx.fillStyle = options.textColor || Theme.colors.text.primary;
        ctx.font = options.font || 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2 + (options.textOffsetY || 0));
        ctx.restore();
    },

    drawDottedGrid(ctx, x, y, w, h, options = {}) {
        const gap = options.gap || 28;
        const radius = options.radius || 1.5;
        const fill = options.fill || Theme.colors.text.hint;
        const alpha = options.alpha || 0.14;

        ctx.save();
        ctx.fillStyle = fill;
        ctx.globalAlpha = alpha;
        for (let px = x + gap; px < x + w; px += gap) {
            for (let py = y + gap; py < y + h; py += gap) {
                ctx.beginPath();
                ctx.arc(px, py, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    },

    drawCrosshair(ctx, x, y, size, color, centerRadius = 2.5) {
        const gap = size * 0.3;
        const len = size * 0.45;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y - gap);
        ctx.lineTo(x, y - gap - len);
        ctx.moveTo(x, y + gap);
        ctx.lineTo(x, y + gap + len);
        ctx.moveTo(x - gap, y);
        ctx.lineTo(x - gap - len, y);
        ctx.moveTo(x + gap, y);
        ctx.lineTo(x + gap + len, y);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, centerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
};
