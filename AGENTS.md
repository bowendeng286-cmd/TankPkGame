# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## 项目概述
纯前端 HTML5 坦克对战游戏（Tank Trouble 克隆），无构建系统，直接在浏览器中运行。

## 运行方式
直接用浏览器打开 `index.html`，无需构建或安装依赖。

## 完成通知规则
- 任务真正完成后，在发送最终回复前，应触发完成通知
- 完成通知需要播放 3 声提示音，并弹出提示框告知用户任务已经完成
- 如果任务被阻塞、只完成部分内容、或仅进行分析说明，则不要触发完成通知

## 核心架构特点

### 1. 脚本加载顺序严格依赖（index.html）
**必须按以下顺序加载**，否则会出现未定义错误：
```
constants.js → theme.js → i18n.js → utils.js → state.js → controlsSettings.js 
→ input.js → maze.js → tank.js → bullet.js → particles.js → renderer.js 
→ physics.js → menu.js → controlsConfig.js → ai.js → main.js
```

### 2. 全局变量系统
- 所有常量在 `constants.js` 中定义为全局变量（无 `const`/`let`/`var` 前缀）
- 视口变换变量 `VIEWPORT_SCALE`、`VIEWPORT_OFFSET_X/Y` 使用 `var` 声明（需运行时修改）
- 游戏状态在 `main.js` 中声明为全局 `var`（`maze`、`tanks`、`bullets` 等）

### 3. 物理引擎的独特设计
**关键：输入速度与碰撞速度分离**
- 坦克的 `vx/vy/omega` 包含输入分量和碰撞残余分量
- 使用 `_lastInputVx/Vy/_lastInputOmega` 记录上一帧输入，用于提取碰撞残余
- 碰撞残余以 0.3 系数衰减保留，让坦克旋转时自然滑离墙壁
- **修改物理代码时必须保持这个分离机制**，否则会导致坦克卡墙或无法旋转

### 4. 炮管防穿墙的预测式系统
- `wouldBarrelCollide()` 纯检测函数，不修改任何状态
- `findMaxSafeOmega()` 使用二分搜索限制角速度
- 在 `main.js` 的 `updateGame()` 中，旋转前先预测，碰撞后限制 omega
- **不要在物理碰撞响应中处理炮管旋转限制**，会导致逻辑混乱

### 5. 碰撞检测的多层采样
- `getAllCollisionCorners()` 返回车体角 + 炮管角 + 边缘中点 + 凹槽拐角
- 额外采样点填充车体前脸与炮管之间的凹槽，防止墙体穿入
- **添加新碰撞形状时必须更新采样点**

### 6. 硬约束安全网（`hardConstraintWalls`）
- 在物理迭代后执行，确保绝不穿墙
- 迭代 3 次处理多面墙交汇处
- 推出位置的同时消除穿入方向的速度分量
- **这是最后防线，不要依赖它来替代正常碰撞响应**

### 7. 触摸控制的设备检测逻辑
- 优先使用 User Agent 检测（最可靠）
- 桌面系统即使有触摸 API 也判定为非触摸设备
- 小屏幕 + 触摸支持 → 触摸设备
- **不要简单用 `'ontouchstart' in window` 判断**，会误判触摸屏笔记本

### 8. 摇杆死区机制
- 死区内（`distance <= deadZone`）：只旋转不移动
- 死区外：旋转 + 移动
- 角度始终更新，距离和强度在死区内归零
- **修改摇杆逻辑时必须保持这个行为**

### 9. 胜利缓冲期系统
- 只剩一人时启动 `VICTORY_GRACE_TIME`（2.5秒）缓冲期
- 记录 `pendingWinnerId`，缓冲期结束后重新检测存活状态
- 如果最后存活者也死了 → 平局
- **不要在检测到只剩一人时立即判定胜利**

### 10. 坐标转换链
屏幕坐标 → Canvas 物理坐标 → 游戏逻辑坐标：
```javascript
canvasX = (clientX - rect.left) * (canvas.width / rect.width)
gameX = (canvasX - VIEWPORT_OFFSET_X) / VIEWPORT_SCALE
```
**所有触摸/鼠标事件必须经过这个转换**

## 代码风格
- 使用 ES6 类（`class Tank`），但不使用模块系统
- 函数式辅助工具（`utils.js` 中的 `vecAdd`、`vecRotate` 等）
- 物理引擎中的内部函数使用 `_` 前缀（如 `_applyWallImpulse`）
- 常量使用 `UPPER_SNAKE_CASE`
- 类方法使用 `camelCase`

## 常见陷阱
1. **不要在 `constants.js` 中使用 `const` 声明常量** - 会导致其他文件无法访问
2. **不要修改坦克速度时忘记更新 `_lastInputVx/Vy`** - 会破坏碰撞残余提取
3. **不要在碰撞响应中直接设置 `tank.angle`** - 应该通过 `omega` 和 `integrateVelocity()` 更新
4. **不要跳过 `fitCanvas()` 中的视口变换计算** - 触摸控制依赖这些全局变量
5. **不要在 AI 代码中假设 `tank.input` 会被保留** - 每帧开始时会被重置
