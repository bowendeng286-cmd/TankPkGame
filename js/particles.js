class Particle {
    constructor(x, y, color) {
        const angle = randFloat(0, Math.PI * 2);
        const speed = randFloat(40, 150);
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = randFloat(0.8, 2.0);
        this.size = randFloat(2, 6);
        this.color = color;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.97;
        this.vy *= 0.97;
        this.life -= this.decay * dt;
    }
    get alive() { return this.life > 0; }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }
    emit(x, y, color, count) {
        count = count || DEATH_PARTICLES;
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (!this.particles[i].alive) this.particles.splice(i, 1);
        }
    }
    draw(ctx) {
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }
    get active() { return this.particles.length > 0; }
    clear() { this.particles = []; }
}
