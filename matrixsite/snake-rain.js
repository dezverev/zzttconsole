function initSnakeRain(columns, rows, fontSize) {
    const COLS = 20;
    const TROWS = 20;

    let boardStartCol = Math.floor(columns / 2) - Math.floor(COLS / 2);
    let boardStartRow = Math.floor(rows / 2) - Math.floor(TROWS / 2);

    const matrixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()*&^%';

    const SNAKE_COLOR = '#00d4ff';
    const HEAD_COLOR = '#fff';
    const FOOD_COLOR = '#ff4757';

    let snake = [];
    let direction = { x: 1, y: 0 };
    let nextDirection = { x: 1, y: 0 };
    let food = null;
    let score = 0;
    let highScore = 0;
    let gameRunning = false;
    let paused = false;
    let destroyed = false;
    let gameOverState = false;
    let tickSpeed = 150;
    let lastTick = 0;
    let animFrameId = null;

    function resize(newCols, newRows) {
        boardStartCol = Math.floor(newCols / 2) - Math.floor(COLS / 2);
        boardStartRow = Math.floor(newRows / 2) - Math.floor(TROWS / 2);
    }

    function spawnFood() {
        const free = [];
        for (let y = 0; y < TROWS; y++)
            for (let x = 0; x < COLS; x++) {
                if (!snake.some(s => s.x === x && s.y === y)) {
                    free.push({ x, y });
                }
            }
        if (free.length === 0) return;
        food = free[Math.floor(Math.random() * free.length)];
    }

    function startGame() {
        const midX = Math.floor(COLS / 2);
        const midY = Math.floor(TROWS / 2);
        snake = [
            { x: midX, y: midY },
            { x: midX - 1, y: midY },
            { x: midX - 2, y: midY },
        ];
        direction = { x: 1, y: 0 };
        nextDirection = { x: 1, y: 0 };
        score = 0;
        tickSpeed = 150;
        gameOverState = false;
        spawnFood();
        gameRunning = true;
        paused = false;
        lastTick = performance.now();
        gameLoop(lastTick);
    }

    function moveSnake() {
        direction = nextDirection;
        const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

        // Wall collision — death
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= TROWS) {
            gameRunning = false;
            gameOverState = true;
            if (score > highScore) highScore = score;
            return;
        }

        // Self collision
        if (snake.some(s => s.x === head.x && s.y === head.y)) {
            gameRunning = false;
            gameOverState = true;
            if (score > highScore) highScore = score;
            return;
        }

        snake.unshift(head);

        // Eat food
        if (food && head.x === food.x && head.y === food.y) {
            score++;
            // Speed up slightly
            tickSpeed = Math.max(60, tickSpeed - 3);
            spawnFood();
        } else {
            snake.pop();
        }
    }

    function gameLoop(timestamp) {
        if (destroyed || !gameRunning || paused) return;
        if (timestamp - lastTick > tickSpeed) {
            moveSnake();
            lastTick = timestamp;
        }
        animFrameId = requestAnimationFrame(gameLoop);
    }

    function onKeyDown(e) {
        if (destroyed) return;

        if (!gameRunning && !paused) {
            if (e.key === ' ') { e.preventDefault(); startGame(); return; }
            return;
        }
        if (e.key === ' ') e.preventDefault();

        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W':
                if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
                break;
            case 'ArrowDown': case 's': case 'S':
                if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
                break;
            case 'ArrowLeft': case 'a': case 'A':
                if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
                break;
            case 'ArrowRight': case 'd': case 'D':
                if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
                break;
            case 'p': case 'P':
                paused = !paused;
                if (!paused) { lastTick = performance.now(); requestAnimationFrame(gameLoop); }
                break;
        }
    }

    document.addEventListener('keydown', onKeyDown);

    function randChar() {
        return matrixChars.charAt(Math.floor(Math.random() * matrixChars.length));
    }

    function getCellOverride(col, row) {
        const bx = col - boardStartCol;
        const by = row - boardStartRow;
        if (bx < 0 || bx >= COLS || by < 0 || by >= TROWS) return null;

        // Food
        if (food && bx === food.x && by === food.y) {
            return { char: randChar(), color: FOOD_COLOR };
        }

        // Snake
        for (let i = 0; i < snake.length; i++) {
            if (snake[i].x === bx && snake[i].y === by) {
                return { char: randChar(), color: i === 0 ? HEAD_COLOR : SNAKE_COLOR };
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
        entries.push({ text: 'BEST', row: infoRow, col: infoCol, color: '#888' });
        entries.push({ text: String(highScore), row: infoRow + 1, col: infoCol, color: '#ffe138' });
        infoRow += 3;
        entries.push({ text: 'WASD/ARROWS', row: infoRow, col: infoCol, color: '#555' });
        infoRow += 2;
        entries.push({ text: 'ESC TO EXIT', row: infoRow, col: infoCol, color: '#555' });

        if (!gameRunning && !gameOverState) {
            entries.push({ text: 'PRESS SPACE', row: boardStartRow + Math.floor(TROWS / 2), col: boardStartCol + 5, color: '#fff' });
        }
        if (gameOverState) {
            entries.push({ text: 'GAME OVER', row: boardStartRow + Math.floor(TROWS / 2) - 1, col: boardStartCol + 6, color: '#ff4757' });
            entries.push({ text: 'SCORE ' + score, row: boardStartRow + Math.floor(TROWS / 2), col: boardStartCol + 7, color: '#00d4ff' });
            entries.push({ text: 'PRESS SPACE', row: boardStartRow + Math.floor(TROWS / 2) + 2, col: boardStartCol + 5, color: '#fff' });
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

        // Food
        if (food) {
            cells.push({ col: boardStartCol + food.x, row: boardStartRow + food.y, color: FOOD_COLOR });
        }

        // Snake
        for (let i = 0; i < snake.length; i++) {
            cells.push({
                col: boardStartCol + snake[i].x,
                row: boardStartRow + snake[i].y,
                color: i === 0 ? HEAD_COLOR : SNAKE_COLOR
            });
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
        }
    };
}
