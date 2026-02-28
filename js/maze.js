// 生成迷宫墙体线段数组
function generateMaze() {
    const cols = COLS, rows = ROWS;
    // DFS 递归回溯生成完美迷宫
    // hWalls[row][col] = true 表示 cell(row,col) 上方有水平墙
    // vWalls[row][col] = true 表示 cell(row,col) 左侧有垂直墙
    const hWalls = Array.from({ length: rows + 1 }, () => Array(cols).fill(true));
    const vWalls = Array.from({ length: rows }, () => Array(cols + 1).fill(true));
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));

    const dirs = [
        { dr: -1, dc: 0, wallType: 'h', wr: 0, wc: 0 },  // up
        { dr: 1, dc: 0, wallType: 'h', wr: 1, wc: 0 },   // down
        { dr: 0, dc: -1, wallType: 'v', wr: 0, wc: 0 },   // left
        { dr: 0, dc: 1, wallType: 'v', wr: 0, wc: 1 },    // right
    ];

    function dfs(r, c) {
        visited[r][c] = true;
        const order = shuffle([0, 1, 2, 3]);
        for (const di of order) {
            const d = dirs[di];
            const nr = r + d.dr, nc = c + d.dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || visited[nr][nc]) continue;
            // 移除墙
            if (d.wallType === 'h') {
                hWalls[r + d.wr][c + d.wc] = false;
            } else {
                vWalls[r + d.wr][c + d.wc] = false;
            }
            dfs(nr, nc);
        }
    }
    dfs(0, 0);

    // 随机移除 ~42% 内墙形成开放感
    const innerHWalls = [];
    for (let r = 1; r < rows; r++)
        for (let c = 0; c < cols; c++)
            if (hWalls[r][c]) innerHWalls.push({ r, c });
    const innerVWalls = [];
    for (let r = 0; r < rows; r++)
        for (let c = 1; c < cols; c++)
            if (vWalls[r][c]) innerVWalls.push({ r, c });

    shuffle(innerHWalls);
    shuffle(innerVWalls);

    const hRemove = Math.floor(innerHWalls.length * WALL_REMOVE_RATIO);
    const vRemove = Math.floor(innerVWalls.length * WALL_REMOVE_RATIO);
    for (let i = 0; i < hRemove; i++) hWalls[innerHWalls[i].r][innerHWalls[i].c] = false;
    for (let i = 0; i < vRemove; i++) vWalls[innerVWalls[i].r][innerVWalls[i].c] = false;

    // 转换为线段数组
    const ox = MAZE_OFFSET_X, oy = MAZE_OFFSET_Y;
    const walls = [];
    // 水平墙
    for (let r = 0; r <= rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!hWalls[r][c]) continue;
            const x1 = ox + c * CELL_SIZE, y1 = oy + r * CELL_SIZE;
            const x2 = ox + (c + 1) * CELL_SIZE;
            // 合并连续水平墙
            let end = c + 1;
            while (end < cols && hWalls[r][end]) { end++; }
            const x2m = ox + end * CELL_SIZE;
            walls.push({ x1, y1, x2: x2m, y2: y1, type: 'h' });
            c = end - 1; // skip merged
        }
    }
    // 垂直墙
    for (let c = 0; c <= cols; c++) {
        for (let r = 0; r < rows; r++) {
            if (!vWalls[r][c]) continue;
            const x1 = ox + c * CELL_SIZE, y1 = oy + r * CELL_SIZE;
            let end = r + 1;
            while (end < rows && vWalls[end][c]) { end++; }
            const y2m = oy + end * CELL_SIZE;
            walls.push({ x1, y1, x2: x1, y2: y2m, type: 'v' });
            r = end - 1;
        }
    }

    return { walls, hWalls, vWalls, cols, rows };
}

// 获取格子中心坐标
function cellCenter(row, col) {
    return {
        x: MAZE_OFFSET_X + (col + 0.5) * CELL_SIZE,
        y: MAZE_OFFSET_Y + (row + 0.5) * CELL_SIZE,
    };
}

// 检查两个相邻格子之间是否有墙
function hasWallBetween(maze, r1, c1, r2, c2) {
    if (r2 === r1 - 1 && c2 === c1) return maze.hWalls[r1][c1];       // up
    if (r2 === r1 + 1 && c2 === c1) return maze.hWalls[r1 + 1][c1];   // down
    if (c2 === c1 - 1 && r2 === r1) return maze.vWalls[r1][c1];       // left
    if (c2 === c1 + 1 && r2 === r1) return maze.vWalls[r1][c1 + 1];   // right
    return true;
}
