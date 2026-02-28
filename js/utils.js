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
