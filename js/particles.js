class Particle {
    constructor(config) {
        this.x = config.x;
        this.y = config.y;
        this.vx = config.vx || 0;
        this.vy = config.vy || 0;
        this.life = config.life != null ? config.life : 1;
        this.maxLife = this.life;
        this.decay = config.decay != null ? config.decay : 1;
        this.size = config.size != null ? config.size : 4;
        this.grow = config.grow || 0;
        this.color = config.color || '#FFFFFF';
        this.shape = config.shape || 'square';
        this.lineWidth = config.lineWidth || 2;
        this.angle = config.angle || 0;
        this.spin = config.spin || 0;
        this.drag = config.drag != null ? config.drag : 0.97;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= this.drag;
        this.vy *= this.drag;
        this.size += this.grow * dt;
        this.angle += this.spin * dt;
        this.life -= this.decay * dt;
    }

    draw(ctx) {
        const alpha = clamp(this.life / Math.max(this.maxLife, 1e-6), 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.shape === 'ring') {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.lineWidth;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(0, this.size), 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.shape === 'circle') {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(0, this.size), 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        }

        ctx.restore();
    }

    get alive() {
        return this.life > 0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit(x, y, color, count, options) {
        const total = count || DEATH_PARTICLES;
        const extra = options || {};
        for (let i = 0; i < total; i++) {
            const angle = randFloat(0, Math.PI * 2);
            const speed = randFloat(extra.minSpeed || 40, extra.maxSpeed || 150);
            this.particles.push(new Particle({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: randFloat(extra.minLife || 0.6, extra.maxLife || 1.1),
                decay: randFloat(extra.minDecay || 0.8, extra.maxDecay || 2.0),
                size: randFloat(extra.minSize || 2, extra.maxSize || 6),
                color,
                shape: extra.shape || 'square',
                drag: extra.drag != null ? extra.drag : 0.97,
                grow: extra.grow || 0,
                spin: randFloat(-(extra.maxSpin || 0), extra.maxSpin || 0)
            }));
        }
    }

    emitPickupLanding(x, y) {
        for (let i = 0; i < 14; i++) {
            const angle = randFloat(0, Math.PI * 2);
            const speed = randFloat(18, 72);
            this.particles.push(new Particle({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed * 0.55 - randFloat(8, 24),
                life: randFloat(0.35, 0.6),
                decay: randFloat(1.5, 2.4),
                size: randFloat(2, 5),
                color: Theme.current === 'dark' ? '#B7AA95' : '#85715A',
                shape: 'circle',
                drag: 0.92,
                grow: 8
            }));
        }

        this.particles.push(new Particle({
            x,
            y,
            life: 0.28,
            decay: 3.4,
            size: 8,
            grow: 140,
            color: colorWithAlpha('#FFF4C2', Theme.current === 'dark' ? 0.85 : 0.6),
            shape: 'ring',
            lineWidth: 3
        }));
    }

    emitLaserBounce(x, y) {
        for (let i = 0; i < 8; i++) {
            const angle = randFloat(0, Math.PI * 2);
            const speed = randFloat(30, 120);
            this.particles.push(new Particle({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: randFloat(0.12, 0.22),
                decay: randFloat(4.8, 7.5),
                size: randFloat(1.8, 3.4),
                color: '#FFF2A8',
                shape: 'circle',
                drag: 0.9,
                grow: 10
            }));
        }

        this.particles.push(new Particle({
            x,
            y,
            life: LASER_BOUNCE_FLASH_TIME,
            decay: 8.4,
            size: 4,
            grow: 110,
            color: colorWithAlpha('#FFF9D8', 0.95),
            shape: 'ring',
            lineWidth: 2.5
        }));
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (!this.particles[i].alive) this.particles.splice(i, 1);
        }
    }

    draw(ctx) {
        for (const particle of this.particles) {
            particle.draw(ctx);
        }
        ctx.globalAlpha = 1;
    }

    get active() {
        return this.particles.length > 0;
    }

    clear() {
        this.particles = [];
    }
}
