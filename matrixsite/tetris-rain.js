// Tetris rendered entirely through the matrix rain.
// Returns { getCellOverride(col, row), destroy() }
// getCellOverride returns { char, color } for occupied cells, or null.

function initTetrisRain(columns, rows, fontSize) {
    const COLS = 10;
    const TROWS = 20;

    // Center the board on the rain grid (recalculated on resize)
    let boardStartCol = Math.floor(columns / 2) - Math.floor(COLS / 2);
    let boardStartRow = Math.floor(rows / 2) - Math.floor(TROWS / 2);

    function resize(newCols, newRows) {
        boardStartCol = Math.floor(newCols / 2) - Math.floor(COLS / 2);
        boardStartRow = Math.floor(newRows / 2) - Math.floor(TROWS / 2);
    }

    const COLORS = [
        null,
        '#00f5ff', // I
        '#ffe138', // O
        '#ff7b00', // T
        '#a35dff', // S
        '#ff69b4', // Z - pink
        '#ff4757', // J
        '#3880ff'  // L
    ];

    const matrixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()*&^%';

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

    let board = Array(TROWS).fill(null).map(() => Array(COLS).fill(0));
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
    let gameOverState = false;
    let animFrameId = null;

    function createPiece(type) {
        const shape = SHAPES[type].map(r => [...r]);
        return {
            type, shape,
            x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2),
            y: 0
        };
    }

    function randomType() { return Math.floor(Math.random() * 7) + 1; }

    function isValid(piece, ox = 0, oy = 0) {
        for (let y = 0; y < piece.shape.length; y++)
            for (let x = 0; x < piece.shape[y].length; x++)
                if (piece.shape[y][x]) {
                    const nx = piece.x + x + ox;
                    const ny = piece.y + y + oy;
                    if (nx < 0 || nx >= COLS || ny >= TROWS) return false;
                    if (ny >= 0 && board[ny][nx]) return false;
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
                    const by = currentPiece.y + y;
                    const bx = currentPiece.x + x;
                    if (by >= 0) board[by][bx] = currentPiece.shape[y][x];
                }
    }

    function clearLines() {
        let cleared = 0;
        for (let y = TROWS - 1; y >= 0; y--) {
            if (board[y].every(c => c !== 0)) {
                board.splice(y, 1);
                board.unshift(Array(COLS).fill(0));
                cleared++; y++;
            }
        }
        if (cleared > 0) {
            score += [0, 100, 300, 500, 800][cleared] * level;
            lines += cleared;
            level = Math.floor(lines / 10) + 1;
            dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        }
    }

    function spawnPiece() {
        const type = nextPieceType || randomType();
        nextPieceType = randomType();
        currentPiece = createPiece(type);
        if (!isValid(currentPiece)) {
            gameRunning = false;
            gameOverState = true;
        }
    }

    function startGame() {
        board = Array(TROWS).fill(null).map(() => Array(COLS).fill(0));
        score = 0; level = 1; lines = 0;
        dropInterval = 1000;
        gameOverState = false;
        nextPieceType = randomType();
        spawnPiece();
        gameRunning = true;
        paused = false;
        lastDrop = performance.now();
        gameLoop(lastDrop);
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
        animFrameId = requestAnimationFrame(gameLoop);
    }

    function onKeyDown(e) {
        if (destroyed) return;

        // Space to start/restart when not running
        if (!gameRunning && !paused) {
            if (e.key === ' ') { e.preventDefault(); startGame(); return; }
            return;
        }
        if (paused && e.key !== 'p' && e.key !== 'P') return;

        switch (e.key) {
            case 'ArrowLeft':
                if (isValid(currentPiece, -1, 0)) currentPiece.x--;
                break;
            case 'ArrowRight':
                if (isValid(currentPiece, 1, 0)) currentPiece.x++;
                break;
            case 'ArrowDown':
                if (isValid(currentPiece, 0, 1)) { currentPiece.y++; score += 1; }
                break;
            case 'ArrowUp':
                const r = rotate(currentPiece);
                if (isValid(r)) currentPiece = r;
                else if (isValid(rotate(r))) currentPiece = rotate(rotate(r));
                else if (isValid(rotate(rotate(rotate(r))))) currentPiece = rotate(rotate(rotate(r)));
                break;
            case ' ':
                e.preventDefault();
                while (isValid(currentPiece, 0, 1)) { currentPiece.y++; score += 2; }
                placePiece(); clearLines(); spawnPiece();
                break;
            case 'p': case 'P':
                paused = !paused;
                if (!paused) { lastDrop = performance.now(); requestAnimationFrame(gameLoop); }
                break;
        }
    }

    document.addEventListener('keydown', onKeyDown);

    // Returns cell override for the rain renderer
    function getCellOverride(col, row) {
        const bx = col - boardStartCol;
        const by = row - boardStartRow;

        // Outside the board area
        if (bx < 0 || bx >= COLS || by < 0 || by >= TROWS) return null;

        // Check current piece
        if (currentPiece && gameRunning) {
            const px = bx - currentPiece.x;
            const py = by - currentPiece.y;
            if (px >= 0 && px < currentPiece.shape[0].length &&
                py >= 0 && py < currentPiece.shape.length &&
                currentPiece.shape[py][px]) {
                const t = currentPiece.shape[py][px];
                return { char: matrixChars.charAt(Math.floor(Math.random() * matrixChars.length)), color: COLORS[t] };
            }
        }

        // Check placed blocks
        if (board[by][bx]) {
            const t = board[by][bx];
            return { char: matrixChars.charAt(Math.floor(Math.random() * matrixChars.length)), color: COLORS[t] };
        }

        return null;
    }

    // Returns info text entries for the rain to display
    function getInfoEntries() {
        const entries = [];
        const infoCol = boardStartCol + COLS + 2;
        let infoRow = boardStartRow + 2;

        entries.push({ text: 'SCORE', row: infoRow, col: infoCol, color: '#888' });
        entries.push({ text: String(score), row: infoRow + 1, col: infoCol, color: '#00d4ff' });
        infoRow += 3;
        entries.push({ text: 'LEVEL', row: infoRow, col: infoCol, color: '#888' });
        entries.push({ text: String(level), row: infoRow + 1, col: infoCol, color: '#00d4ff' });
        infoRow += 3;
        entries.push({ text: 'LINES', row: infoRow, col: infoCol, color: '#888' });
        entries.push({ text: String(lines), row: infoRow + 1, col: infoCol, color: '#00d4ff' });
        infoRow += 3;
        entries.push({ text: 'ESC TO EXIT', row: infoRow, col: infoCol, color: '#555' });

        if (!gameRunning && !gameOverState) {
            entries.push({ text: 'PRESS SPACE', row: boardStartRow + Math.floor(TROWS / 2), col: boardStartCol, color: '#fff' });
        }

        if (gameOverState) {
            entries.push({ text: 'GAME OVER', row: boardStartRow + Math.floor(TROWS / 2) - 1, col: boardStartCol, color: '#ff4757' });
            entries.push({ text: 'PRESS SPACE', row: boardStartRow + Math.floor(TROWS / 2) + 1, col: boardStartCol, color: '#fff' });
        }

        if (paused) {
            entries.push({ text: 'PAUSED', row: boardStartRow + Math.floor(TROWS / 2), col: boardStartCol + 2, color: '#fff' });
        }

        return entries;
    }

    // Border cells for the board outline
    function getBorderOverride(col, row) {
        const bx = col - boardStartCol;
        const by = row - boardStartRow;

        // Left border
        if (col === boardStartCol - 1 && by >= 0 && by < TROWS) return { char: '|', color: '#4a4a6a' };
        // Right border
        if (col === boardStartCol + COLS && by >= 0 && by < TROWS) return { char: '|', color: '#4a4a6a' };
        // Bottom border
        if (row === boardStartRow + TROWS && bx >= -1 && bx <= COLS) return { char: '-', color: '#4a4a6a' };
        // Top border
        if (row === boardStartRow - 1 && bx >= -1 && bx <= COLS) return { char: '-', color: '#4a4a6a' };

        return null;
    }

    // Returns all occupied cells (placed blocks + current piece) for glow sustain
    function getOccupiedCells() {
        const cells = [];

        // Placed blocks
        for (let by = 0; by < TROWS; by++)
            for (let bx = 0; bx < COLS; bx++)
                if (board[by][bx]) {
                    cells.push({
                        col: boardStartCol + bx,
                        row: boardStartRow + by,
                        color: COLORS[board[by][bx]]
                    });
                }

        // Current piece
        if (currentPiece && gameRunning) {
            for (let py = 0; py < currentPiece.shape.length; py++)
                for (let px = 0; px < currentPiece.shape[py].length; px++)
                    if (currentPiece.shape[py][px]) {
                        cells.push({
                            col: boardStartCol + currentPiece.x + px,
                            row: boardStartRow + currentPiece.y + py,
                            color: COLORS[currentPiece.shape[py][px]]
                        });
                    }
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
