var AI_STATE = { IDLE: 0, PURSUING: 1, AIMING: 2, SHOOTING: 3, DODGING: 4, WANDERING: 5 };

class AIController {
    constructor(difficulty) {
        this.params = AI_DIFFICULTY[difficulty] || AI_DIFFICULTY.medium;
        this.state = AI_STATE.IDLE;
        this.target = null;
        this.path = [];
        this.pathIndex = 0;
        this.reactionTimer = 0;
        this.shootCooldown = 0;
        this.wanderTarget = null;
        this.dodgeDir = 0;
        this.thinkTimer = 0;
        this._cachedRicochet = null;
        this._ricochetTimer = 0;
        this._lastDodgeDir = null;
        this._dodgeCommitTime = 0;
        this._dodgeElapsed = 0;
        this._dodgeOrigin = null;
        this._dodgeStartAngle = null;
        this._threatGraceTime = 0;
        this._threatMemory = null;
        this._attackStallTime = 0;
        this._repositionTarget = null;
        this._repositionTime = 0;
        this._repositionCooldown = 0;
        this._lastTankPos = null;
        this._lastTargetId = -1;
        this._turnLock = 0;
        this._lastDodgeAction = null;
        this._currentThreatForecasts = [];
    }

    update(dt, tank, tanks, bullets, maze) {
        if (!tank.alive) return;
        this.reactionTimer -= dt;
        this.shootCooldown -= dt;
        this.thinkTimer -= dt;
        this._ricochetTimer -= dt;
        this._threatGraceTime = Math.max(0, this._threatGraceTime - dt);
        this._repositionTime = Math.max(0, this._repositionTime - dt);
        this._repositionCooldown = Math.max(0, this._repositionCooldown - dt);

        const frameMove = this._lastTankPos ? vecDist(tank, this._lastTankPos) : Infinity;
        this._lastTankPos = { x: tank.x, y: tank.y };

        const threatData = this._assessThreats(tank, bullets, maze);
        this._currentThreatForecasts = threatData.forecasts;
        let threats = this._stabilizeThreats(dt, threatData.threats);
        const enemies = tanks.filter(t => t.alive && t.id !== tank.id);
        const nearest = this._findNearest(tank, enemies);
        this._syncTargetTracking(nearest);

        if (this._shouldDodge(threats)) {
            this._dodge(dt, tank, threats, maze);
            return;
        }

        this._lastDodgeAction = null;

        if (threats.length === 0) {
            this._lastDodgeDir = null;
            this._dodgeOrigin = null;
            this._dodgeStartAngle = null;
        }

        if (nearest && this._shouldContinueReposition(tank)) {
            this._pursue(dt, tank, this._repositionTarget, maze, nearest);
            return;
        }

        const directShot = nearest && this._canShootAt(tank, nearest, maze);
        const ricochetShot = !directShot && nearest ? this._getRicochetShot(tank, nearest, maze) : null;

        if (directShot && this._shouldStartAttackReposition(dt, frameMove, tank, nearest, maze, 'direct')) {
            this._pursue(dt, tank, this._repositionTarget, maze, nearest);
        } else if (directShot) {
            this._aimAndShoot(dt, tank, nearest);
        } else if (ricochetShot && this._shouldStartAttackReposition(dt, frameMove, tank, nearest, maze, 'ricochet')) {
            this._pursue(dt, tank, this._repositionTarget, maze, nearest);
        } else if (ricochetShot) {
            this._tryRicochetShot(dt, tank, nearest, maze, ricochetShot);
        } else if (nearest) {
            this._attackStallTime = 0;
            this._pursue(dt, tank, nearest, maze);
        } else {
            this._attackStallTime = 0;
            this._clearReposition();
            this._wander(dt, tank, maze);
        }
    }

    _assessThreats(tank, bullets, maze) {
        const threats = [];
        const forecasts = [];
        const forecastTime = Math.max(this._getThreatLookahead(), this._getDodgePlanDepth() * this._getDodgePlanStep());
        const forecastRange = this._getDodgePlanRange();
        for (const b of bullets) {
            if (!b.alive) continue;
            if (b.ownerId === tank.id && (b.bounces || 0) === 0) continue;

            const trace = traceBulletSegments(b, maze.walls, forecastTime);
            if (!this._tracePassesNearTank(trace, tank, forecastRange)) continue;

            forecasts.push({ bullet: b, trace });
            for (const segment of trace.segments) {
                const hit = this._segmentHitsTankBody(segment, tank);
                if (!hit) continue;

                const time = segment.t0 + (segment.t1 - segment.t0) * hit.t;
                threats.push({
                    bullet: b,
                    time,
                    point: { x: hit.x, y: hit.y },
                    vx: segment.vx,
                    vy: segment.vy,
                    urgent: time <= this._getUrgentThreatTime()
                });
                break;
            }
        }

        threats.sort((a, b) => a.time - b.time);
        return { threats, forecasts };
    }

    _findNearest(tank, enemies) {
        let best = null;
        let bestDist = Infinity;
        for (const e of enemies) {
            const d = vecDist(tank, e);
            if (d < bestDist) {
                bestDist = d;
                best = e;
            }
        }
        return best;
    }

    _getParam(name, fallback) {
        return this.params[name] != null ? this.params[name] : fallback;
    }

    _getThreatLookahead() {
        return this._getParam('threatLookahead', AI_THREAT_LOOKAHEAD);
    }

    _getUrgentThreatTime() {
        return this._getParam('urgentThreatTime', AI_URGENT_THREAT_TIME);
    }

    _getDodgePreviewDist() {
        return this._getParam('dodgePreviewDist', AI_DODGE_PREVIEW_DIST);
    }

    _getDodgeCommitTime() {
        return this._getParam('dodgeCommitTime', AI_DODGE_COMMIT_TIME);
    }

    _getThreatPadding() {
        return this._getParam('threatPadding', 0);
    }

    _getDodgeWallBuffer() {
        return this._getParam('dodgeWallBuffer', 0);
    }

    _getDodgePlanStep() {
        return this._getParam('dodgePlanStep', AI_DODGE_PLAN_STEP);
    }

    _getDodgePlanDepth() {
        return this._getParam('dodgePlanDepth', AI_DODGE_PLAN_DEPTH);
    }

    _getDodgePlanBeam() {
        return this._getParam('dodgePlanBeam', AI_DODGE_PLAN_BEAM);
    }

    _getDodgePlanRange() {
        return this._getParam('dodgePlanRange', AI_DODGE_PLAN_RANGE);
    }

    _getDodgeSafetyMargin() {
        return this._getParam('dodgeSafetyMargin', AI_DODGE_SAFETY_MARGIN);
    }

    _getDodgeActionSwitchPenalty() {
        return this._getParam('dodgeActionSwitchPenalty', AI_DODGE_ACTION_SWITCH_PENALTY);
    }

    _getDodgeReversePenalty() {
        return this._getParam('dodgeReversePenalty', AI_DODGE_REVERSE_PENALTY);
    }

    _getDodgeIdlePenalty() {
        return this._getParam('dodgeIdlePenalty', AI_DODGE_IDLE_PENALTY);
    }

    _getDodgeWallPenalty() {
        return this._getParam('dodgeWallPenalty', AI_DODGE_WALL_PENALTY);
    }

    _getDodgeBarrelLimitPenalty() {
        return this._getParam('dodgeBarrelLimitPenalty', AI_DODGE_BARREL_LIMIT_PENALTY);
    }

    _getThreatGraceTime() {
        return this._getParam('threatGraceTime', AI_DODGE_THREAT_GRACE);
    }

    _getDodgeMoveReadyAngle() {
        return this._getParam('dodgeMoveReadyAngle', AI_DODGE_MOVE_READY_ANGLE);
    }

    _getDirectHoldTime() {
        return this._getParam('maxDirectHoldTime', Infinity);
    }

    _getRicochetHoldTime() {
        return this._getParam('maxRicochetHoldTime', Infinity);
    }

    _getRepositionCooldown() {
        return this._getParam('repositionCooldown', 1.2);
    }

    _canShootAt(tank, target, maze) {
        return this._isPathClear(tank, target, maze.walls, null);
    }

    _rayWallHit(origin, dir, wall) {
        if (wall.type === 'h') {
            if (Math.abs(dir.y) < 1e-10) return -1;
            const t = (wall.y1 - origin.y) / dir.y;
            if (t < 0) return -1;
            const hx = origin.x + dir.x * t;
            if (hx >= Math.min(wall.x1, wall.x2) && hx <= Math.max(wall.x1, wall.x2)) return t;
        } else {
            if (Math.abs(dir.x) < 1e-10) return -1;
            const t = (wall.x1 - origin.x) / dir.x;
            if (t < 0) return -1;
            const hy = origin.y + dir.y * t;
            if (hy >= Math.min(wall.y1, wall.y2) && hy <= Math.max(wall.y1, wall.y2)) return t;
        }
        return -1;
    }

    _segmentHitsTankBody(segment, tank) {
        const cosA = Math.cos(-tank.angle);
        const sinA = Math.sin(-tank.angle);
        const startDx = segment.x1 - tank.x;
        const startDy = segment.y1 - tank.y;
        const endDx = segment.x2 - tank.x;
        const endDy = segment.y2 - tank.y;
        const start = {
            x: startDx * cosA - startDy * sinA,
            y: startDx * sinA + startDy * cosA
        };
        const end = {
            x: endDx * cosA - endDy * sinA,
            y: endDx * sinA + endDy * cosA
        };

        const hitT = this._intersectSegmentExpandedAABB(
            start,
            end,
            TANK_W / 2 + BULLET_RADIUS + this._getThreatPadding(),
            TANK_H / 2 + BULLET_RADIUS + this._getThreatPadding()
        );
        if (hitT === null) return null;

        return {
            t: hitT,
            x: segment.x1 + (segment.x2 - segment.x1) * hitT,
            y: segment.y1 + (segment.y2 - segment.y1) * hitT
        };
    }

    _intersectSegmentExpandedAABB(start, end, halfW, halfH) {
        if (start.x >= -halfW && start.x <= halfW && start.y >= -halfH && start.y <= halfH) {
            return 0;
        }

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        let tMin = 0;
        let tMax = 1;

        if (Math.abs(dx) < 1e-10) {
            if (start.x < -halfW || start.x > halfW) return null;
        } else {
            const tx1 = (-halfW - start.x) / dx;
            const tx2 = (halfW - start.x) / dx;
            tMin = Math.max(tMin, Math.min(tx1, tx2));
            tMax = Math.min(tMax, Math.max(tx1, tx2));
            if (tMin > tMax) return null;
        }

        if (Math.abs(dy) < 1e-10) {
            if (start.y < -halfH || start.y > halfH) return null;
        } else {
            const ty1 = (-halfH - start.y) / dy;
            const ty2 = (halfH - start.y) / dy;
            tMin = Math.max(tMin, Math.min(ty1, ty2));
            tMax = Math.min(tMax, Math.max(ty1, ty2));
            if (tMin > tMax) return null;
        }

        if (tMin < 0 || tMin > 1) return null;
        return tMin;
    }

    _normalizeDir(dir) {
        const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        if (len < 1e-6) return null;
        return { x: dir.x / len, y: dir.y / len };
    }

    _clearReposition() {
        this._repositionTarget = null;
        this._repositionTime = 0;
    }

    _tracePassesNearTank(trace, tank, maxRange) {
        const limitSq = maxRange * maxRange;
        for (const segment of trace.segments) {
            const closest = closestPointOnSegment(
                { x: tank.x, y: tank.y },
                { x: segment.x1, y: segment.y1 },
                { x: segment.x2, y: segment.y2 }
            );
            const dx = closest.x - tank.x;
            const dy = closest.y - tank.y;
            if (dx * dx + dy * dy <= limitSq) return true;
        }
        return false;
    }

    _sampleTraceAtTime(trace, time) {
        for (const segment of trace.segments) {
            if (time < segment.t0 - 1e-6) break;
            if (time <= segment.t1 + 1e-6) {
                const span = segment.t1 - segment.t0;
                const t = span > 1e-6 ? clamp((time - segment.t0) / span, 0, 1) : 1;
                return {
                    x: lerp(segment.x1, segment.x2, t),
                    y: lerp(segment.y1, segment.y2, t)
                };
            }
        }
        return null;
    }

    _pointThreatMargin(pose, point, padding) {
        const cosA = Math.cos(-pose.angle);
        const sinA = Math.sin(-pose.angle);
        const dx = point.x - pose.x;
        const dy = point.y - pose.y;
        const lx = dx * cosA - dy * sinA;
        const ly = dx * sinA + dy * cosA;
        const halfW = TANK_W / 2 + BULLET_RADIUS + padding;
        const halfH = TANK_H / 2 + BULLET_RADIUS + padding;
        const qx = Math.abs(lx) - halfW;
        const qy = Math.abs(ly) - halfH;
        const ox = Math.max(qx, 0);
        const oy = Math.max(qy, 0);
        return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0);
    }

    _getDodgeActionSet() {
        return [
            { move: 1, turn: -1 },
            { move: 1, turn: 1 },
            { move: 1, turn: 0 },
            { move: -1, turn: -1 },
            { move: -1, turn: 1 },
            { move: 0, turn: -1 },
            { move: 0, turn: 1 },
            { move: -1, turn: 0 },
            { move: 0, turn: 0 }
        ];
    }

    _sameDodgeAction(a, b) {
        return !!a && !!b && a.move === b.move && a.turn === b.turn;
    }

    _getDodgeActionPenalty(previousAction, action) {
        let penalty = 0;
        if (previousAction) {
            if (previousAction.move !== action.move) penalty += this._getDodgeActionSwitchPenalty();
            if (previousAction.turn !== action.turn) penalty += this._getDodgeActionSwitchPenalty() * 0.75;
        }
        if (action.move < 0) penalty += this._getDodgeReversePenalty();
        if (action.move === 0) penalty += this._getDodgeIdlePenalty();
        return penalty;
    }

    _compareDodgePlans(a, b) {
        if (Math.abs(a.worstMargin - b.worstMargin) > 1e-6) return b.worstMargin - a.worstMargin;
        return b.score - a.score;
    }

    _simulateDodgeAction(tank, startState, action, dt, maze) {
        const substeps = 3;
        const subDt = dt / substeps;
        const speed = tank.speed || TANK_SPEED;
        const moveScale = action.move > 0 ? 1 : (action.move < 0 ? -0.6 : 0);
        const samples = [];
        let pose = {
            x: startState.x,
            y: startState.y,
            angle: startState.angle,
            time: startState.time
        };
        let wallPenalty = 0;
        let barrelPenalty = 0;

        for (let i = 0; i < substeps; i++) {
            let omega = action.turn * tank.turnSpeed;
            if (omega !== 0) {
                const previewTank = { x: pose.x, y: pose.y, angle: pose.angle };
                const predictedAngle = pose.angle + omega * subDt;
                if (wouldBarrelCollide(previewTank, predictedAngle, maze.walls)) {
                    const limitedOmega = findMaxSafeOmega(previewTank, omega, subDt, maze.walls);
                    if (Math.abs(limitedOmega - omega) > 1e-4) barrelPenalty += this._getDodgeBarrelLimitPenalty();
                    omega = limitedOmega;
                }
            }

            const nextPose = {
                x: pose.x + Math.cos(pose.angle) * speed * moveScale * subDt,
                y: pose.y + Math.sin(pose.angle) * speed * moveScale * subDt,
                angle: pose.angle + omega * subDt,
                time: pose.time + subDt
            };

            if (this._tankPoseHitsMaze(tank, nextPose.x, nextPose.y, nextPose.angle, maze, 0)) {
                return { valid: false, scorePenalty: 1000, samples };
            }

            if (this._getDodgeWallBuffer() > 0 && this._tankPoseHitsMaze(tank, nextPose.x, nextPose.y, nextPose.angle, maze, this._getDodgeWallBuffer())) {
                wallPenalty += this._getDodgeWallPenalty();
            }

            samples.push(nextPose);
            pose = nextPose;
        }

        return {
            valid: true,
            endState: pose,
            samples,
            scorePenalty: wallPenalty + barrelPenalty
        };
    }

    _scoreDodgeSamples(samples, forecasts) {
        let worstMargin = Infinity;
        let totalMargin = 0;
        for (const sample of samples) {
            let localMargin = this._getDodgeSafetyMargin() + 24;
            for (const forecast of forecasts) {
                const point = this._sampleTraceAtTime(forecast.trace, sample.time);
                if (!point) continue;
                localMargin = Math.min(localMargin, this._pointThreatMargin(sample, point, this._getDodgeSafetyMargin()));
            }
            worstMargin = Math.min(worstMargin, localMargin);
            totalMargin += localMargin;
        }
        if (!isFinite(worstMargin)) worstMargin = this._getDodgeSafetyMargin() + 24;
        return { worstMargin, totalMargin };
    }

    _planDodgeActions(tank, maze, forecasts) {
        const actions = this._getDodgeActionSet();
        const depth = this._getDodgePlanDepth();
        const step = this._getDodgePlanStep();
        const beamWidth = this._getDodgePlanBeam();
        let beam = [{
            state: { x: tank.x, y: tank.y, angle: tank.angle, time: 0 },
            actions: [],
            worstMargin: Infinity,
            score: 0
        }];

        for (let depthIndex = 0; depthIndex < depth; depthIndex++) {
            const nextBeam = [];
            for (const node of beam) {
                const previousAction = node.actions.length > 0 ? node.actions[node.actions.length - 1] : this._lastDodgeAction;
                for (const action of actions) {
                    const sim = this._simulateDodgeAction(tank, node.state, action, step, maze);
                    if (!sim.valid) continue;

                    const threatScore = this._scoreDodgeSamples(sim.samples, forecasts);
                    const transitionPenalty = this._getDodgeActionPenalty(previousAction, action);
                    nextBeam.push({
                        state: sim.endState,
                        actions: node.actions.concat([{ move: action.move, turn: action.turn }]),
                        worstMargin: Math.min(node.worstMargin, threatScore.worstMargin),
                        score: node.score + threatScore.totalMargin * 3 - transitionPenalty - sim.scorePenalty
                    });
                }
            }

            if (nextBeam.length === 0) break;
            nextBeam.sort((a, b) => this._compareDodgePlans(a, b));
            beam = nextBeam.slice(0, beamWidth);
        }

        if (beam.length === 0) return null;
        beam.sort((a, b) => this._compareDodgePlans(a, b));
        return beam[0];
    }

    _applyDodgeAction(tank, action) {
        tank.input.forward = action.move > 0;
        tank.input.backward = action.move < 0;
        tank.input.left = action.turn < 0;
        tank.input.right = action.turn > 0;
        tank.input.fire = false;
    }

    _copyThreats(threats) {
        return threats.map(threat => ({
            bullet: threat.bullet,
            time: threat.time,
            point: { x: threat.point.x, y: threat.point.y },
            vx: threat.vx,
            vy: threat.vy,
            urgent: threat.urgent
        }));
    }

    _stabilizeThreats(dt, threats) {
        if (threats.length > 0) {
            this._threatGraceTime = this._getThreatGraceTime();
            this._threatMemory = this._copyThreats(threats);
            return threats;
        }

        if (this._threatGraceTime <= 0 || !this._threatMemory || !this._lastDodgeAction) {
            this._threatMemory = null;
            return threats;
        }

        this._threatMemory = this._threatMemory.map(threat => {
            const time = threat.time + dt;
            return {
                bullet: threat.bullet,
                time,
                point: { x: threat.point.x, y: threat.point.y },
                vx: threat.vx,
                vy: threat.vy,
                urgent: time <= this._getUrgentThreatTime()
            };
        });

        return this._threatMemory;
    }

    _syncTargetTracking(nearest) {
        const nextTargetId = nearest ? nearest.id : -1;
        if (nextTargetId === this._lastTargetId) return;

        this._lastTargetId = nextTargetId;
        this._attackStallTime = 0;
        this._clearReposition();
        this._cachedRicochet = null;
        this._ricochetTimer = 0;
        this._turnLock = 0;
        this._lastDodgeAction = null;
    }

    _shouldDodge(threats) {
        if (threats.length === 0) return false;
        if (this.params.alwaysDodge) return true;

        const leadTime = threats[0].time;
        if (leadTime <= this._getUrgentThreatTime()) return true;

        const dodgeWindow = this.params.dodgeWindow;
        if (dodgeWindow != null && leadTime <= dodgeWindow) return true;

        return Math.random() < this.params.dodgeRate;
    }

    _shouldContinueReposition(tank) {
        if (!this._repositionTarget) return false;
        if (this._repositionTime <= 0 || vecDist(tank, this._repositionTarget) < 22) {
            this._clearReposition();
            this._attackStallTime = 0;
            return false;
        }
        return true;
    }

    _shouldStartAttackReposition(dt, frameMove, tank, target, maze, mode) {
        if (this._repositionTarget || this._repositionCooldown > 0) {
            this._attackStallTime = Math.max(0, this._attackStallTime - dt);
            return false;
        }

        if (frameMove > AI_ATTACK_STALL_MOVE_EPS) {
            this._attackStallTime = Math.max(0, this._attackStallTime - dt * 2);
            return false;
        }

        if (mode === 'direct' && vecDist(tank, target) < CELL_SIZE * 2.5) {
            this._attackStallTime = Math.max(0, this._attackStallTime - dt);
            return false;
        }

        const holdTime = mode === 'ricochet' ? this._getRicochetHoldTime() : this._getDirectHoldTime();
        if (!isFinite(holdTime)) return false;

        this._attackStallTime += dt;
        if (this._attackStallTime < holdTime) return false;

        this._attackStallTime = 0;
        const repositionTarget = this._chooseAttackRepositionTarget(tank, target, maze);
        if (!repositionTarget) {
            this._repositionCooldown = this._getRepositionCooldown();
            return false;
        }

        this._repositionTarget = repositionTarget;
        this._repositionTime = clamp(vecDist(tank, repositionTarget) / (tank.speed || TANK_SPEED) + 0.5, 0.9, 2.4);
        this._repositionCooldown = this._getRepositionCooldown();
        this._cachedRicochet = null;
        this._ricochetTimer = 0;
        this.thinkTimer = 0;
        this.path = [];
        this.pathIndex = 0;
        return true;
    }

    _chooseAttackRepositionTarget(tank, target, maze) {
        const targetCell = this._toCell(target);
        const selfCell = this._toCell(tank);
        if (!targetCell) return null;

        const currentDir = this._normalizeDir({ x: tank.x - target.x, y: tank.y - target.y });
        let best = null;
        let bestScore = -Infinity;

        for (let radius = 1; radius <= AI_ATTACK_REPOSITION_RADIUS; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    if (Math.abs(dr) + Math.abs(dc) !== radius) continue;

                    const r = targetCell.r + dr;
                    const c = targetCell.c + dc;
                    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
                    if (selfCell && r === selfCell.r && c === selfCell.c) continue;

                    const point = cellCenter(r, c);
                    if (vecDist(tank, point) < CELL_SIZE * 0.9) continue;

                    const path = this._findPath(tank, point, maze);
                    if (path.length === 0) continue;

                    const shotAngle = Math.atan2(target.y - point.y, target.x - point.x);
                    if (this._tankPoseHitsMaze(tank, point.x, point.y, shotAngle, maze, this._getDodgeWallBuffer())) continue;

                    const hasShot = this._canShootAt(point, target, maze);
                    const targetDir = this._normalizeDir({ x: point.x - target.x, y: point.y - target.y });
                    const flank = currentDir && targetDir ? 1 - Math.abs(vecDot(currentDir, targetDir)) : 0;
                    const distToTarget = vecDist(point, target);

                    let score = -path.length * 10 - distToTarget * 0.04 + flank * 40;
                    if (hasShot) score += 80;
                    if (distToTarget < vecDist(tank, target)) score += 15;

                    if (score > bestScore) {
                        bestScore = score;
                        best = point;
                    }
                }
            }
        }

        return best;
    }

    _tankPoseHitsMaze(tank, x, y, angle, maze, extraBuffer) {
        const oldX = tank.x;
        const oldY = tank.y;
        const oldAngle = tank.angle;

        tank.x = x;
        tank.y = y;
        tank.angle = angle;
        const hit = this._tankTouchesMaze(tank, maze, extraBuffer);
        tank.x = oldX;
        tank.y = oldY;
        tank.angle = oldAngle;
        return hit;
    }

    _tankTouchesMaze(tank, maze, extraBuffer) {
        const mazeLeft = MAZE_OFFSET_X;
        const mazeTop = MAZE_OFFSET_Y;
        const mazeRight = MAZE_OFFSET_X + COLS * CELL_SIZE;
        const mazeBottom = MAZE_OFFSET_Y + ROWS * CELL_SIZE;
        const halfThick = WALL_THICKNESS / 2 + 1.5 + (extraBuffer || 0);
        const hw = TANK_W / 2;
        const hh = TANK_H / 2;
        const bx0 = hw - 2;
        const barrelCenterLocalX = bx0 + BARREL_LENGTH / 2;
        const barrelHW = BARREL_LENGTH / 2;
        const bhh = BARREL_WIDTH / 2;
        const allCorners = tank.getAllCollisionCorners();

        for (const corner of allCorners) {
            if (corner.x < mazeLeft || corner.x > mazeRight || corner.y < mazeTop || corner.y > mazeBottom) {
                return true;
            }
        }

        const cosA = Math.cos(tank.angle);
        const sinA = Math.sin(tank.angle);
        const barrelCenterX = tank.x + barrelCenterLocalX * cosA;
        const barrelCenterY = tank.y + barrelCenterLocalX * sinA;

        for (const wall of maze.walls) {
            const wa = { x: wall.x1, y: wall.y1 };
            const wb = { x: wall.x2, y: wall.y2 };

            for (const corner of allCorners) {
                const closest = closestPointOnSegment(corner, wa, wb);
                const dx = corner.x - closest.x;
                const dy = corner.y - closest.y;
                if (dx * dx + dy * dy < halfThick * halfThick) {
                    return true;
                }
            }

            for (const endpoint of [wa, wb]) {
                if (_pointVsExpandedOBB(endpoint.x, endpoint.y, tank.x, tank.y, tank.angle, hw, hh, halfThick)) {
                    return true;
                }
                if (_pointVsExpandedOBB(endpoint.x, endpoint.y, barrelCenterX, barrelCenterY, tank.angle, barrelHW, bhh, halfThick)) {
                    return true;
                }
            }
        }

        return false;
    }

    _shouldBreakDodgeLock(tank, threats, maze) {
        if (!this._lastDodgeDir) return true;
        if (!isFinite(this._scoreDodgeDirection(tank, this._lastDodgeDir, threats, maze))) return true;
        if (!this._dodgeOrigin) return false;
        if (this._dodgeElapsed < AI_DODGE_STUCK_TIME) return false;
        const moved = vecDist(tank, this._dodgeOrigin);
        const startAngle = this._dodgeStartAngle == null ? tank.angle : this._dodgeStartAngle;
        const turned = Math.abs(angleDiff(startAngle, tank.angle));
        return moved < AI_DODGE_STUCK_DISTANCE && turned < AI_DODGE_STUCK_ANGLE;
    }

    _scoreDodgeDirection(tank, dir, threats, maze) {
        if (!dir) return -Infinity;

        const previewDist = this._getDodgePreviewDist() * (dir.backward ? 0.8 : 1);
        const targetAngle = dir.backward ? Math.atan2(-dir.y, -dir.x) : Math.atan2(dir.y, dir.x);
        const wallBuffer = this._getDodgeWallBuffer();
        const moveReadyAngle = this._getDodgeMoveReadyAngle();
        const turnDiff = angleDiff(tank.angle, targetAngle);
        const turnAbs = Math.abs(turnDiff);
        const startMoveFraction = turnAbs <= moveReadyAngle
            ? 0
            : clamp((turnAbs - moveReadyAngle) / Math.PI, 0.18, 0.55);
        let score = 0;

        for (const fraction of [0.25, 0.5, 0.75, 1]) {
            const turnProgress = startMoveFraction > 1e-6 ? Math.min(1, fraction / startMoveFraction) : 1;
            const sampleAngle = tank.angle + turnDiff * turnProgress;
            const moveProgress = startMoveFraction > 0 && fraction <= startMoveFraction
                ? 0
                : (startMoveFraction > 0 ? (fraction - startMoveFraction) / (1 - startMoveFraction) : fraction);
            const sample = {
                x: tank.x + dir.x * previewDist * clamp(moveProgress, 0, 1),
                y: tank.y + dir.y * previewDist * clamp(moveProgress, 0, 1)
            };
            if (this._tankPoseHitsMaze(tank, sample.x, sample.y, sampleAngle, maze, wallBuffer)) {
                return -Infinity;
            }

            for (const threat of threats) {
                score += vecDist(sample, threat.point) * (0.5 + fraction) / (threat.time + 0.05);
            }
        }

        score -= turnAbs * 28;
        if (dir.backward && !threats[0].urgent) score *= 0.88;

        if (this._lastDodgeDir) {
            const dot = dir.x * this._lastDodgeDir.x + dir.y * this._lastDodgeDir.y;
            if (dot > 0.9) score += 45;
            else if (dot > 0.6) score += 20;
            else if (dot < -0.2) score -= 40;
        }

        return score;
    }

    _dodge(dt, tank, threats, maze) {
        this.state = AI_STATE.DODGING;

        const plannerMaze = {
            walls: this._getNearbyWalls(tank, maze, this._getDodgePlanRange())
        };
        const plan = this._planDodgeActions(tank, plannerMaze, this._currentThreatForecasts);
        const action = plan && plan.actions.length > 0
            ? plan.actions[0]
            : (this._lastDodgeAction || { move: -1, turn: 0 });

        this._lastDodgeAction = { move: action.move, turn: action.turn };
        this._lastDodgeDir = null;
        this._dodgeOrigin = null;
        this._dodgeStartAngle = null;
        this._applyDodgeAction(tank, action);
    }

    _executeDodgeMove(tank, dir) {
        const targetAngle = dir.backward ? Math.atan2(-dir.y, -dir.x) : Math.atan2(dir.y, dir.x);
        this._steerToward(0, tank, targetAngle);
        const diff = Math.abs(angleDiff(tank.angle, targetAngle));
        const moveReady = dir.backward || diff < this._getDodgeMoveReadyAngle();
        tank.input.forward = moveReady && !dir.backward;
        tank.input.backward = moveReady && !!dir.backward;
        tank.input.fire = false;
    }

    _aimAndShoot(dt, tank, target) {
        const dx = target.x - tank.x;
        const dy = target.y - tank.y;
        let targetAngle = Math.atan2(dy, dx);
        targetAngle += randFloat(-this.params.aimJitter, this.params.aimJitter);
        this._aimAtAngle(dt, tank, targetAngle);
    }

    _aimAtAngle(dt, tank, targetAngle) {
        const diff = angleDiff(tank.angle, targetAngle);
        if (Math.abs(diff) < 0.15) {
            this.state = AI_STATE.SHOOTING;
            tank.input.forward = false;
            tank.input.fire = this.shootCooldown <= 0 && this.reactionTimer <= 0;
            if (tank.input.fire) {
                this.shootCooldown = this.params.shootCooldown;
                this.reactionTimer = this.params.reactionTime;
            }
        } else {
            this.state = AI_STATE.AIMING;
            tank.input.fire = false;
        }
        this._steerToward(dt, tank, targetAngle);
    }

    _pursue(dt, tank, target, maze, shootTarget) {
        this.state = AI_STATE.PURSUING;
        const attackTarget = shootTarget || target;
        if (this.thinkTimer <= 0) {
            this.path = this._findPath(tank, target, maze);
            this.pathIndex = 0;
            this.thinkTimer = 0.5;
        }

        if (this.path.length > 0 && this.pathIndex < this.path.length) {
            const wp = this.path[this.pathIndex];
            const dist = vecDist(tank, wp);
            if (dist < 20) {
                this.pathIndex++;
            } else {
                const angle = Math.atan2(wp.y - tank.y, wp.x - tank.x);
                this._steerToward(dt, tank, angle);
                tank.input.forward = true;
            }
        } else {
            const angle = Math.atan2(target.y - tank.y, target.x - tank.x);
            this._steerToward(dt, tank, angle);
            tank.input.forward = true;
        }

        if (attackTarget && this._canShootAt(tank, attackTarget, maze) && this.shootCooldown <= 0) {
            const da = angleDiff(tank.angle, Math.atan2(attackTarget.y - tank.y, attackTarget.x - tank.x));
            if (Math.abs(da) < 0.3) {
                tank.input.fire = true;
                this.shootCooldown = this.params.shootCooldown;
            }
        } else if (this._cachedRicochet && this.shootCooldown <= 0) {
            if (this._isReturnPathSafeWhileMoving(tank, this._cachedRicochet)) {
                const da = angleDiff(tank.angle, this._cachedRicochet.angle);
                if (Math.abs(da) < 0.15) {
                    tank.input.fire = true;
                    this.shootCooldown = this.params.shootCooldown;
                }
            }
        }
    }

    _wander(dt, tank, maze) {
        this.state = AI_STATE.WANDERING;
        if (!this.wanderTarget || vecDist(tank, this.wanderTarget) < 25 || this.thinkTimer <= 0) {
            const col = Math.floor(Math.random() * COLS);
            const row = Math.floor(Math.random() * ROWS);
            this.wanderTarget = cellCenter(row, col);
            this.path = this._findPath(tank, this.wanderTarget, maze);
            this.pathIndex = 0;
            this.thinkTimer = 2;
        }

        if (this.path.length > 0 && this.pathIndex < this.path.length) {
            const wp = this.path[this.pathIndex];
            if (vecDist(tank, wp) < 20) this.pathIndex++;
            else {
                const angle = Math.atan2(wp.y - tank.y, wp.x - tank.x);
                this._steerToward(dt, tank, angle);
                tank.input.forward = true;
            }
        }
    }

    _mirrorAcrossWall(point, wall) {
        if (wall.type === 'h') {
            return { x: point.x, y: 2 * wall.y1 - point.y };
        }
        return { x: 2 * wall.x1 - point.x, y: point.y };
    }

    _isNearPath(point, from, to, threshold) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-6) return vecDist(point, from) < threshold;
        const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lenSq));
        const projX = from.x + t * dx;
        const projY = from.y + t * dy;
        const distSq = (point.x - projX) * (point.x - projX) + (point.y - projY) * (point.y - projY);
        return distSq < threshold * threshold;
    }

    _isReturnPathSafeWhileMoving(tank, ricochet) {
        const fwd = { x: Math.cos(tank.angle), y: Math.sin(tank.angle) };
        const speed = tank.speed || 120;
        for (const leg of ricochet.returnLegs) {
            const startDist = leg.startDist || ricochet.leg1;
            const legDx = leg.to.x - leg.from.x;
            const legDy = leg.to.y - leg.from.y;
            const legLen = Math.sqrt(legDx * legDx + legDy * legDy);
            const endDist = startDist + legLen;
            for (const d of [startDist, (startDist + endDist) / 2, endDist]) {
                const t = d / BULLET_SPEED;
                const px = tank.x + fwd.x * speed * t;
                const py = tank.y + fwd.y * speed * t;
                if (this._isNearPath({ x: px, y: py }, leg.from, leg.to, 25)) {
                    return false;
                }
            }
        }
        return true;
    }

    _isPathClear(from, to, walls, excludeWall) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1e-6) return true;
        const dir = { x: dx / dist, y: dy / dist };
        for (const w of walls) {
            if (w === excludeWall) continue;
            const t = this._rayWallHit(from, dir, w);
            if (t > 1 && t < dist - 1) return false;
        }
        return true;
    }

    _getNearbyWalls(pos, maze, maxRange) {
        maxRange = maxRange || 400;
        const r2 = maxRange * maxRange;
        const result = [];
        for (const w of maze.walls) {
            const mx = (w.x1 + w.x2) / 2;
            const my = (w.y1 + w.y2) / 2;
            const dx = mx - pos.x;
            const dy = my - pos.y;
            if (dx * dx + dy * dy <= r2) result.push(w);
        }
        return result;
    }

    _getRayWallIntersection(origin, dir, wall) {
        if (wall.type === 'h') {
            if (Math.abs(dir.y) < 1e-10) return null;
            const t = (wall.y1 - origin.y) / dir.y;
            if (t < 1) return null;
            const hx = origin.x + dir.x * t;
            if (hx >= Math.min(wall.x1, wall.x2) - 0.5 && hx <= Math.max(wall.x1, wall.x2) + 0.5) {
                return { x: hx, y: wall.y1, t };
            }
        } else {
            if (Math.abs(dir.x) < 1e-10) return null;
            const t = (wall.x1 - origin.x) / dir.x;
            if (t < 1) return null;
            const hy = origin.y + dir.y * t;
            if (hy >= Math.min(wall.y1, wall.y2) - 0.5 && hy <= Math.max(wall.y1, wall.y2) + 0.5) {
                return { x: wall.x1, y: hy, t };
            }
        }
        return null;
    }

    _findRicochetShot(tank, target, maze) {
        const bounceDepth = this.params.bounceDepth;
        if (bounceDepth < 1) return null;

        const walls = this._getNearbyWalls(tank, maze);
        const allWalls = maze.walls;
        let best = null;
        const MAX_PATH = 600;
        const EARLY_EXIT = 300;

        for (const w of walls) {
            const mirrored = this._mirrorAcrossWall(target, w);
            const dx = mirrored.x - tank.x;
            const dy = mirrored.y - tank.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1e-6 || dist > MAX_PATH) continue;
            const dir = { x: dx / dist, y: dy / dist };

            const hit = this._getRayWallIntersection(tank, dir, w);
            if (!hit) continue;

            const bouncePoint = { x: hit.x, y: hit.y };
            const leg1 = hit.t;
            const leg2dx = target.x - bouncePoint.x;
            const leg2dy = target.y - bouncePoint.y;
            const leg2 = Math.sqrt(leg2dx * leg2dx + leg2dy * leg2dy);
            const pathLen = leg1 + leg2;

            if (pathLen > MAX_PATH) continue;
            if (best && pathLen >= best.pathLen) continue;
            if (!this._isPathClear(tank, bouncePoint, allWalls, w)) continue;
            if (!this._isPathClear(bouncePoint, target, allWalls, w)) continue;
            if (this._isNearPath(tank, bouncePoint, target, 25)) continue;

            const toTarget = Math.atan2(target.y - bouncePoint.y, target.x - bouncePoint.x);
            const toTank = Math.atan2(tank.y - bouncePoint.y, tank.x - bouncePoint.x);
            if (Math.abs(angleDiff(toTarget, toTank)) < 0.2) continue;

            const angle = Math.atan2(dy, dx);
            best = {
                angle,
                pathLen,
                leg1,
                returnLegs: [{ from: bouncePoint, to: target, startDist: leg1 }]
            };
            if (pathLen < EARLY_EXIT) return best;
        }

        if (bounceDepth >= 2 && !best) {
            for (let i = 0; i < walls.length; i++) {
                const w1 = walls[i];
                const m1 = this._mirrorAcrossWall(target, w1);
                for (let j = 0; j < walls.length; j++) {
                    if (i === j) continue;
                    const w2 = walls[j];
                    if (w1.type === w2.type) {
                        if (w1.type === 'h' && w1.y1 === w2.y1) continue;
                        if (w1.type === 'v' && w1.x1 === w2.x1) continue;
                    }

                    const m2 = this._mirrorAcrossWall(m1, w2);
                    const dx = m2.x - tank.x;
                    const dy = m2.y - tank.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 1e-6 || dist > MAX_PATH) continue;
                    const dir = { x: dx / dist, y: dy / dist };

                    const hit1 = this._getRayWallIntersection(tank, dir, w2);
                    if (!hit1) continue;
                    const bp1 = { x: hit1.x, y: hit1.y };

                    const d2x = m1.x - bp1.x;
                    const d2y = m1.y - bp1.y;
                    const d2len = Math.sqrt(d2x * d2x + d2y * d2y);
                    if (d2len < 1e-6) continue;
                    const dir2 = { x: d2x / d2len, y: d2y / d2len };

                    const hit2 = this._getRayWallIntersection(bp1, dir2, w1);
                    if (!hit2) continue;
                    const bp2 = { x: hit2.x, y: hit2.y };

                    const leg1 = hit1.t;
                    const leg2 = hit2.t;
                    const leg3dx = target.x - bp2.x;
                    const leg3dy = target.y - bp2.y;
                    const leg3 = Math.sqrt(leg3dx * leg3dx + leg3dy * leg3dy);
                    const pathLen = leg1 + leg2 + leg3;

                    if (pathLen > MAX_PATH) continue;
                    if (best && pathLen >= best.pathLen) continue;
                    if (!this._isPathClear(tank, bp1, allWalls, w2)) continue;
                    if (!this._isPathClear(bp1, bp2, allWalls, w1)) continue;
                    if (!this._isPathClear(bp2, target, allWalls, w1)) continue;
                    if (this._isNearPath(tank, bp1, bp2, 25)) continue;
                    if (this._isNearPath(tank, bp2, target, 25)) continue;

                    const angle = Math.atan2(dy, dx);
                    best = {
                        angle,
                        pathLen,
                        leg1,
                        returnLegs: [
                            { from: bp1, to: bp2, startDist: leg1 },
                            { from: bp2, to: target, startDist: leg1 + leg2 }
                        ]
                    };
                    if (pathLen < EARLY_EXIT) return best;
                }
            }
        }

        return best;
    }

    _getRicochetShot(tank, target, maze) {
        if (this.params.bounceDepth < 1) return null;

        if (this._ricochetTimer <= 0) {
            this._cachedRicochet = this._findRicochetShot(tank, target, maze);
            this._ricochetTimer = 0.3;
        }

        return this._cachedRicochet;
    }

    _tryRicochetShot(dt, tank, target, maze, ricochetShot) {
        const shot = ricochetShot || this._getRicochetShot(tank, target, maze);
        if (!shot) return false;

        const angle = shot.angle + randFloat(-this.params.aimJitter, this.params.aimJitter);
        this._aimAtAngle(dt, tank, angle);
        return true;
    }

    _steerToward(dt, tank, targetAngle) {
        const diff = angleDiff(tank.angle, targetAngle);

        if (this._turnLock < 0) {
            if (diff > -AI_TURN_LOCK_EXIT_ANGLE) this._turnLock = 0;
        } else if (this._turnLock > 0) {
            if (diff < AI_TURN_LOCK_EXIT_ANGLE) this._turnLock = 0;
        }

        if (this._turnLock === 0) {
            if (diff < -AI_TURN_LOCK_ENTER_ANGLE) this._turnLock = -1;
            else if (diff > AI_TURN_LOCK_ENTER_ANGLE) this._turnLock = 1;
        }

        tank.input.left = this._turnLock < 0;
        tank.input.right = this._turnLock > 0;
    }

    _findPath(from, to, maze) {
        const sc = this._toCell(from);
        const ec = this._toCell(to);
        if (!sc || !ec) return [];
        if (sc.r === ec.r && sc.c === ec.c) return [to];

        const keyFn = (r, c) => r * COLS + c;
        const open = [{ r: sc.r, c: sc.c, g: 0, f: 0, parent: null }];
        const closed = new Set();
        const gMap = new Map();
        gMap.set(keyFn(sc.r, sc.c), 0);
        const heuristic = (r, c) => Math.abs(r - ec.r) + Math.abs(c - ec.c);
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

        while (open.length > 0) {
            open.sort((a, b) => a.f - b.f);
            const cur = open.shift();
            const ck = keyFn(cur.r, cur.c);
            if (closed.has(ck)) continue;
            closed.add(ck);

            if (cur.r === ec.r && cur.c === ec.c) {
                const path = [];
                let node = cur;
                while (node) {
                    path.unshift(cellCenter(node.r, node.c));
                    node = node.parent;
                }
                return path;
            }

            for (const [dr, dc] of dirs) {
                const nr = cur.r + dr;
                const nc = cur.c + dc;
                if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
                const nk = keyFn(nr, nc);
                if (closed.has(nk)) continue;
                if (hasWallBetween(maze, cur.r, cur.c, nr, nc)) continue;
                const ng = cur.g + 1;
                if (gMap.has(nk) && gMap.get(nk) <= ng) continue;
                gMap.set(nk, ng);
                open.push({ r: nr, c: nc, g: ng, f: ng + heuristic(nr, nc), parent: cur });
            }
        }

        return [];
    }

    _toCell(pos) {
        const c = Math.floor((pos.x - MAZE_OFFSET_X) / CELL_SIZE);
        const r = Math.floor((pos.y - MAZE_OFFSET_Y) / CELL_SIZE);
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
        return { r, c };
    }
}
