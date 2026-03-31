function initTetris(container) {
    container.innerHTML = `
        <div class="game-container">
            <canvas id="board" class="main-board" width="300" height="600"></canvas>
            <div class="side-panel">
                <div class="panel-box">
                    <h3>NEXT</h3>
                    <canvas id="next-piece" width="120" height="120"></canvas>
                </div>
                <div class="panel-box">
                    <h3>SCORE</h3>
                    <div id="score" class="info-text">0</div>
                </div>
                <div class="panel-box">
                    <h3>LEVEL</h3>
                    <div id="level" class="info-text">1</div>
                </div>
                <div class="panel-box">
                    <h3>LINES</h3>
                    <div id="lines" class="info-text">0</div>
                </div>
                <button id="start-btn">START</button>
                <div class="panel-box controls">
                    <span>&larr;&rarr;</span> Move<br>
                    <span>&uarr;</span> Rotate<br>
                    <span>&darr;</span> Soft Drop<br>
                    <span>Space</span> Hard Drop<br>
                    <span>P</span> Pause
                </div>
            </div>
        </div>
    `;

    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = 30;
    const NEXT_BLOCK_SIZE = 30;

    const canvas = container.querySelector('#board');
    const ctx = canvas.getContext('2d');
    const nextCanvas = container.querySelector('#next-piece');
    const nextCtx = nextCanvas.getContext('2d');

    const scoreElement = container.querySelector('#score');
    const levelElement = container.querySelector('#level');
    const linesElement = container.querySelector('#lines');
    const startBtn = container.querySelector('#start-btn');

    const COLORS = [
        null,
        '#00f5ff', '#ffe138', '#ff7b00', '#a35dff',
        '#00ff6a', '#ff4757', '#3880ff'
    ];

    const SHAPES = [
        null,
        [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
        [[2,2],[2,2]],
        [[0,3,0],[3,3,3],[0,0,0]],
        [[0,4,4],[4,4,0],[0,0,0]],
        [[5,5,0],[0,5,5],[0,0,0]],
        [[6,0,0],[6,6,6],[0,0,0]],
        [[0,0,7],[7,7,7],[0,0,0]]
    ];

    let board = [];
    let currentPiece = null;
    let nextPieceType = null;
    let score = 0;
    let level = 1;
    let lines = 0;
    let gameRunning = false;
    let paused = false;
    let dropInterval = 1000;
    let lastDrop = 0;
    let destroyed = false;

    function createBoard() {
        return Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    }

    function createPiece(type) {
        const shape = SHAPES[type].map(row => [...row]);
        return {
            type, shape,
            x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2),
            y: 0
        };
    }

    function randomPieceType() {
        return Math.floor(Math.random() * 7) + 1;
    }

    function drawBlock(context, x, y, colorIndex, size) {
        if (colorIndex === 0) return;
        context.fillStyle = COLORS[colorIndex];
        context.fillRect(x * size, y * size, size - 1, size - 1);
        context.fillStyle = 'rgba(255,255,255,0.3)';
        context.fillRect(x * size, y * size, size - 1, 3);
        context.fillRect(x * size, y * size, 3, size - 1);
        context.fillStyle = 'rgba(0,0,0,0.3)';
        context.fillRect(x * size + size - 4, y * size, 3, size - 1);
        context.fillRect(x * size, y * size + size - 4, size - 1, 3);
    }

    function drawBoard() {
        ctx.fillStyle = 'rgba(15, 15, 26, 0.9)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1a1a2e';
        for (let i = 0; i <= COLS; i++) {
            ctx.beginPath(); ctx.moveTo(i * BLOCK_SIZE, 0);
            ctx.lineTo(i * BLOCK_SIZE, canvas.height); ctx.stroke();
        }
        for (let i = 0; i <= ROWS; i++) {
            ctx.beginPath(); ctx.moveTo(0, i * BLOCK_SIZE);
            ctx.lineTo(canvas.width, i * BLOCK_SIZE); ctx.stroke();
        }
        for (let y = 0; y < ROWS; y++)
            for (let x = 0; x < COLS; x++)
                drawBlock(ctx, x, y, board[y][x], BLOCK_SIZE);
        if (currentPiece) {
            for (let y = 0; y < currentPiece.shape.length; y++)
                for (let x = 0; x < currentPiece.shape[y].length; x++)
                    if (currentPiece.shape[y][x])
                        drawBlock(ctx, currentPiece.x + x, currentPiece.y + y,
                            currentPiece.shape[y][x], BLOCK_SIZE);
        }
    }

    function drawNextPiece() {
        nextCtx.fillStyle = 'rgba(15, 15, 26, 0.9)';
        nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
        if (!nextPieceType) return;
        const shape = SHAPES[nextPieceType];
        const offsetX = (4 - shape[0].length) / 2;
        const offsetY = (4 - shape.length) / 2;
        for (let y = 0; y < shape.length; y++)
            for (let x = 0; x < shape[y].length; x++)
                if (shape[y][x])
                    drawBlock(nextCtx, offsetX + x, offsetY + y, shape[y][x], NEXT_BLOCK_SIZE);
    }

    function isValid(piece, offsetX = 0, offsetY = 0) {
        for (let y = 0; y < piece.shape.length; y++)
            for (let x = 0; x < piece.shape[y].length; x++)
                if (piece.shape[y][x]) {
                    const newX = piece.x + x + offsetX;
                    const newY = piece.y + y + offsetY;
                    if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
                    if (newY >= 0 && board[newY][newX]) return false;
                }
        return true;
    }

    function rotate(piece) {
        const rotated = piece.shape[0].map((_, i) =>
            piece.shape.map(row => row[i]).reverse()
        );
        return { ...piece, shape: rotated };
    }

    function placePiece() {
        for (let y = 0; y < currentPiece.shape.length; y++)
            for (let x = 0; x < currentPiece.shape[y].length; x++)
                if (currentPiece.shape[y][x]) {
                    const boardY = currentPiece.y + y;
                    const boardX = currentPiece.x + x;
                    if (boardY >= 0) board[boardY][boardX] = currentPiece.shape[y][x];
                }
    }

    function clearLines() {
        let linesCleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
            if (board[y].every(cell => cell !== 0)) {
                board.splice(y, 1);
                board.unshift(Array(COLS).fill(0));
                linesCleared++; y++;
            }
        }
        if (linesCleared > 0) {
            const points = [0, 100, 300, 500, 800];
            score += points[linesCleared] * level;
            lines += linesCleared;
            level = Math.floor(lines / 10) + 1;
            dropInterval = Math.max(100, 1000 - (level - 1) * 100);
            updateDisplay();
        }
    }

    function updateDisplay() {
        scoreElement.textContent = score;
        levelElement.textContent = level;
        linesElement.textContent = lines;
    }

    function spawnPiece() {
        const type = nextPieceType || randomPieceType();
        nextPieceType = randomPieceType();
        currentPiece = createPiece(type);
        if (!isValid(currentPiece)) gameOver();
        drawNextPiece();
    }

    function gameOver() {
        gameRunning = false;
        startBtn.textContent = 'START';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        ctx.font = '18px Arial';
        ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 40);
    }

    function resetGame() {
        board = createBoard();
        score = 0; level = 1; lines = 0;
        dropInterval = 1000;
        nextPieceType = randomPieceType();
        updateDisplay();
    }

    function gameLoop(timestamp) {
        if (destroyed || !gameRunning || paused) return;
        if (timestamp - lastDrop > dropInterval) {
            if (isValid(currentPiece, 0, 1)) {
                currentPiece.y++;
            } else {
                placePiece(); clearLines(); spawnPiece();
            }
            lastDrop = timestamp;
        }
        drawBoard();
        requestAnimationFrame(gameLoop);
    }

    function startGame() {
        resetGame(); spawnPiece();
        gameRunning = true; paused = false;
        startBtn.textContent = 'RESTART';
        lastDrop = performance.now();
        requestAnimationFrame(gameLoop);
    }

    function onKeyDown(e) {
        if (destroyed) return;
        if (!gameRunning || (paused && e.key !== 'p' && e.key !== 'P')) return;
        switch (e.key) {
            case 'ArrowLeft':
                if (isValid(currentPiece, -1, 0)) currentPiece.x--;
                break;
            case 'ArrowRight':
                if (isValid(currentPiece, 1, 0)) currentPiece.x++;
                break;
            case 'ArrowDown':
                if (isValid(currentPiece, 0, 1)) { currentPiece.y++; score += 1; updateDisplay(); }
                break;
            case 'ArrowUp':
                const rotated = rotate(currentPiece);
                if (isValid(rotated)) currentPiece = rotated;
                else if (isValid(rotate(rotated))) currentPiece = rotate(rotate(rotated));
                else if (isValid(rotate(rotate(rotate(rotated))))) currentPiece = rotate(rotate(rotate(rotated)));
                break;
            case ' ':
                e.preventDefault();
                while (isValid(currentPiece, 0, 1)) { currentPiece.y++; score += 2; }
                placePiece(); clearLines(); spawnPiece(); updateDisplay();
                break;
            case 'p': case 'P':
                paused = !paused;
                if (!paused) { lastDrop = performance.now(); requestAnimationFrame(gameLoop); }
                else {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#fff'; ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center';
                    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
                }
                break;
        }
        if (!paused) drawBoard();
    }

    document.addEventListener('keydown', onKeyDown);
    startBtn.addEventListener('click', startGame);

    board = createBoard();
    drawBoard();

    return {
        destroy() {
            destroyed = true;
            gameRunning = false;
            document.removeEventListener('keydown', onKeyDown);
            container.innerHTML = '';
        }
    };
}
