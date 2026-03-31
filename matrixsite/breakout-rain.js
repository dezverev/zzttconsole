function initBreakoutRain(columns, rows, fontSize) {
    const COLS = 20;
    const TROWS = 25;
    const BRICK_ROWS = 5;
    const BRICKS_PER_ROW = 10;
    const PADDLE_WIDTH = 5;

    let boardStartCol = Math.floor(columns / 2) - Math.floor(COLS / 2);
    let boardStartRow = Math.floor(rows / 2) - Math.floor(TROWS / 2);

    const matrixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()*&^%';

    const BRICK_COLORS = [
        '#ff4757', // red
        '#ff7b00', // orange
        '#ffe138', // yellow
        '#3880ff', // blue
        '#a35dff', // purple
    ];
    const BRICK_POINTS = [5, 4, 3, 2, 1];

    let bricks = [];
    let paddleX = 0;
    const paddleRow = TROWS - 2;
    let ballX = 0, ballY = 0, dx = 0, dy = 0;
    let score = 0;
    let lives = 3;
    let bricksLeft = 0;
    let gameRunning = false;
    let paused = false;
    let destroyed = false;
    let gameOverState = false;
    let winState = false;
    let ballSpeed = 80;
    let lastTick = 0;
    let animFrameId = null;
    const keysDown = new Set();

    function initBricks() {
        bricks = [];
        bricksLeft = 0;
        for (let r = 0; r < BRICK_ROWS; r++) {
            bricks[r] = [];
            for (let c = 0; c < BRICKS_PER_ROW; c++) {
                bricks[r][c] = 1;
                bricksLeft++;
            }
        }
    }

    function resetBall() {
        ballX = paddleX + Math.floor(PADDLE_WIDTH / 2);
        ballY = paddleRow - 1;
        dx = (Math.random() > 0.5 ? 1 : -1);
        dy = -1;
    }

    function resize(newCols, newRows) {
        boardStartCol = Math.floor(newCols / 2) - Math.floor(COLS / 2);
        boardStartRow = Math.floor(newRows / 2) - Math.floor(TROWS / 2);
    }

    let mouseCol = -1;

    function onMouseMove(e) {
        if (destroyed) return;
        const col = Math.floor(e.clientX / fontSize) - boardStartCol;
        mouseCol = col - Math.floor(PADDLE_WIDTH / 2);
    }

    document.addEventListener('mousemove', onMouseMove);

    function movePaddle() {
        if (keysDown.has('ArrowLeft') && paddleX > 0) paddleX--;
        if (keysDown.has('ArrowRight') && paddleX < COLS - PADDLE_WIDTH) paddleX++;
        // Mouse control
        if (mouseCol >= 0) {
            paddleX = Math.max(0, Math.min(COLS - PADDLE_WIDTH, mouseCol));
        }
    }

    function getBrickAt(x, y) {
        // Bricks occupy rows 1-5, each brick is 2 cells wide
        const brickRow = y - 1;
        const brickCol = Math.floor(x / 2);
        if (brickRow >= 0 && brickRow < BRICK_ROWS && brickCol >= 0 && brickCol < BRICKS_PER_ROW) {
            if (bricks[brickRow][brickCol]) {
                return { row: brickRow, col: brickCol };
            }
        }
        return null;
    }

    function moveBall() {
        const prevX = ballX, prevY = ballY;
        ballX += dx;
        ballY += dy;

        // Wall collisions
        if (ballX < 0) { ballX = 0; dx = Math.abs(dx); }
        if (ballX >= COLS) { ballX = COLS - 1; dx = -Math.abs(dx); }
        if (ballY < 0) { ballY = 0; dy = Math.abs(dy); }

        // Bottom - lose life
        if (ballY >= TROWS) {
            lives--;
            if (lives <= 0) {
                gameRunning = false;
                gameOverState = true;
                return;
            }
            resetBall();
            return;
        }

        // Paddle collision
        const bx = Math.floor(ballX), by = Math.floor(ballY);
        if (by === paddleRow && bx >= paddleX && bx < paddleX + PADDLE_WIDTH && dy > 0) {
            dy = -Math.abs(dy);
            // Angle based on hit position
            const hitPos = (ballX - paddleX) / PADDLE_WIDTH; // 0 to 1
            dx = (hitPos - 0.5) * 3; // -1.5 to 1.5
            if (Math.abs(dx) < 0.3) dx = dx >= 0 ? 0.3 : -0.3;
            return;
        }

        // Brick collision
        const brick = getBrickAt(bx, by);
        if (brick) {
            bricks[brick.row][brick.col] = 0;
            score += BRICK_POINTS[brick.row];
            bricksLeft--;

            // Determine reflection direction
            const prevBrick = getBrickAt(Math.floor(prevX), Math.floor(prevY));
            if (Math.floor(prevY) !== by) {
                dy = -dy;
            } else {
                dx = -dx;
            }

            // Speed up slightly
            ballSpeed = Math.max(40, ballSpeed - 0.5);

            // Win check
            if (bricksLeft <= 0) {
                gameRunning = false;
                winState = true;
            }
        }
    }

    function startGame() {
        initBricks();
        score = 0; lives = 3;
        ballSpeed = 80;
        gameOverState = false;
        winState = false;
        paddleX = Math.floor(COLS / 2) - Math.floor(PADDLE_WIDTH / 2);
        resetBall();
        gameRunning = true;
        paused = false;
        lastTick = performance.now();
        gameLoop(lastTick);
    }

    function gameLoop(timestamp) {
        if (destroyed || !gameRunning || paused) return;
        if (timestamp - lastTick > ballSpeed) {
            movePaddle();
            moveBall();
            lastTick = timestamp;
        }
        animFrameId = requestAnimationFrame(gameLoop);
    }

    function onKeyDown(e) {
        if (destroyed) return;
        keysDown.add(e.key);

        if (!gameRunning && !paused) {
            if (e.key === ' ') { e.preventDefault(); startGame(); return; }
            return;
        }
        if (e.key === ' ') e.preventDefault();
        if (e.key === 'p' || e.key === 'P') {
            paused = !paused;
            if (!paused) { lastTick = performance.now(); requestAnimationFrame(gameLoop); }
        }
    }

    function onKeyUp(e) {
        keysDown.delete(e.key);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    function randChar() {
        return matrixChars.charAt(Math.floor(Math.random() * matrixChars.length));
    }

    function getCellOverride(col, row) {
        const bx = col - boardStartCol;
        const by = row - boardStartRow;
        if (bx < 0 || bx >= COLS || by < 0 || by >= TROWS) return null;

        // Ball
        if (gameRunning && bx === Math.floor(ballX) && by === Math.floor(ballY)) {
            return { char: randChar(), color: '#fff' };
        }

        // Paddle
        if (by === paddleRow && bx >= paddleX && bx < paddleX + PADDLE_WIDTH) {
            return { char: randChar(), color: '#00d4ff' };
        }

        // Bricks
        const brickRow = by - 1;
        const brickCol = Math.floor(bx / 2);
        if (brickRow >= 0 && brickRow < BRICK_ROWS && brickCol >= 0 && brickCol < BRICKS_PER_ROW) {
            if (bricks[brickRow] && bricks[brickRow][brickCol]) {
                return { char: randChar(), color: BRICK_COLORS[brickRow] };
            }
        }

        return null;
    }

    function getInfoEntries() {
        const entries = [];
        const infoCol = boardStartCol + COLS + 2;
        let infoRow = boardStartRow + 2;

        entries.push({ text: 'SCORE', row: infoRow, col: infoCol, color: '#888' });
        entries.push({ text: String(score), row: infoRow + 1, col: infoCol, color: '#00d4ff' });
        infoRow += 3;
        entries.push({ text: 'LIVES', row: infoRow, col: infoCol, color: '#888' });
        entries.push({ text: String(lives), row: infoRow + 1, col: infoCol, color: '#00d4ff' });
        infoRow += 3;
        entries.push({ text: 'ESC TO EXIT', row: infoRow, col: infoCol, color: '#555' });

        if (!gameRunning && !gameOverState && !winState) {
            entries.push({ text: 'PRESS SPACE', row: boardStartRow + Math.floor(TROWS / 2), col: boardStartCol + 5, color: '#fff' });
        }
        if (gameOverState) {
            entries.push({ text: 'GAME OVER', row: boardStartRow + Math.floor(TROWS / 2) - 1, col: boardStartCol + 6, color: '#ff4757' });
            entries.push({ text: 'PRESS SPACE', row: boardStartRow + Math.floor(TROWS / 2) + 1, col: boardStartCol + 5, color: '#fff' });
        }
        if (winState) {
            entries.push({ text: 'YOU WIN!', row: boardStartRow + Math.floor(TROWS / 2) - 1, col: boardStartCol + 7, color: '#ffe138' });
            entries.push({ text: 'PRESS SPACE', row: boardStartRow + Math.floor(TROWS / 2) + 1, col: boardStartCol + 5, color: '#fff' });
        }
        if (paused) {
            entries.push({ text: 'PAUSED', row: boardStartRow + Math.floor(TROWS / 2), col: boardStartCol + 7, color: '#fff' });
        }

        return entries;
    }

    function getBorderOverride(col, row) {
        const bx = col - boardStartCol;
        const by = row - boardStartRow;

        if (col === boardStartCol - 1 && by >= 0 && by < TROWS) return { char: '|', color: '#4a4a6a' };
        if (col === boardStartCol + COLS && by >= 0 && by < TROWS) return { char: '|', color: '#4a4a6a' };
        if (row === boardStartRow + TROWS && bx >= -1 && bx <= COLS) return { char: '-', color: '#4a4a6a' };
        if (row === boardStartRow - 1 && bx >= -1 && bx <= COLS) return { char: '-', color: '#4a4a6a' };

        return null;
    }

    function getOccupiedCells() {
        const cells = [];

        // Bricks
        for (let r = 0; r < BRICK_ROWS; r++)
            for (let c = 0; c < BRICKS_PER_ROW; c++)
                if (bricks[r] && bricks[r][c]) {
                    const bx1 = c * 2;
                    const bx2 = c * 2 + 1;
                    const by = r + 1;
                    cells.push({ col: boardStartCol + bx1, row: boardStartRow + by, color: BRICK_COLORS[r] });
                    cells.push({ col: boardStartCol + bx2, row: boardStartRow + by, color: BRICK_COLORS[r] });
                }

        // Paddle
        for (let i = 0; i < PADDLE_WIDTH; i++) {
            cells.push({ col: boardStartCol + paddleX + i, row: boardStartRow + paddleRow, color: '#00d4ff' });
        }

        // Ball
        if (gameRunning) {
            cells.push({ col: boardStartCol + Math.floor(ballX), row: boardStartRow + Math.floor(ballY), color: '#fff' });
        }

        return cells;
    }

    return {
        get boardStartCol() { return boardStartCol; },
        get boardStartRow() { return boardStartRow; },
        COLS,
        TROWS,
        resize,
        getCellOverride,
        getInfoEntries,
        getBorderOverride,
        getOccupiedCells,
        destroy() {
            destroyed = true;
            gameRunning = false;
            if (animFrameId) cancelAnimationFrame(animFrameId);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
            document.removeEventListener('mousemove', onMouseMove);
        }
    };
}
