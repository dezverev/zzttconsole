function initSurvivorRain(columns, rows, fontSize) {
    const COLS = 30;
    const TROWS = 25;

    let boardStartCol = Math.floor(columns / 2) - Math.floor(COLS / 2);
    let boardStartRow = Math.floor(rows / 2) - Math.floor(TROWS / 2);

    const matrixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()*&^%';

    const PLAYER_COLOR = '#fff';
    const ENEMY_COLOR = '#ff4757';
    const ENEMY_FAST_COLOR = '#ff7b00';
    const ENEMY_TANK_COLOR = '#a35dff';
    const PROJECTILE_COLOR = '#00f5ff';
    const XP_COLOR = '#ffe138';
    const HEAL_COLOR = '#00ff6a';

    let player = { x: 0, y: 0, hp: 10, maxHp: 10 };
    let enemies = [];
    let projectiles = [];
    let xpGems = [];
    let healDrops = [];
    const XP_MAGNET_RANGE = 5;
    let score = 0;
    let kills = 0;
    let level = 1;
    let xp = 0;
    let xpToNext = 5;
    let gameTime = 0; // in ticks
    let fireRate = 12; // ticks between shots
    let fireCooldown = 0;
    let projSpeed = 1;
    let projDamage = 1;
    let projCount = 1; // number of projectiles per volley
    let spawnRate = 60; // ticks between spawns
    let spawnCooldown = 0;

    let prevOccupiedKeys = new Set();

    let gameRunning = false;
    let paused = false;
    let destroyed = false;
    let gameOverState = false;
    let tickSpeed = 100;
    let lastTick = 0;
    let animFrameId = null;
    const keysDown = new Set();

    // Level up state
    let levelUpActive = false;
    let levelUpChoices = [];
    let levelUpSelection = 0;

    const UPGRADES = [
        { name: 'FIRE RATE+', desc: 'SHOOT FASTER', apply() { fireRate = Math.max(4, fireRate - 2); } },
        { name: 'DAMAGE+', desc: 'MORE DAMAGE', apply() { projDamage++; } },
        { name: 'MULTI SHOT', desc: 'MORE BULLETS', apply() { projCount = Math.min(8, projCount + 1); } },
        { name: 'MAX HP+', desc: 'MORE HEALTH', apply() { player.maxHp += 3; player.hp = Math.min(player.hp + 3, player.maxHp); } },
        { name: 'HEAL', desc: 'RESTORE HP', apply() { player.hp = player.maxHp; } },
        { name: 'SPEED+', desc: 'MOVE FASTER', apply() { tickSpeed = Math.max(50, tickSpeed - 10); } },
    ];

    function resize(newCols, newRows) {
        boardStartCol = Math.floor(newCols / 2) - Math.floor(COLS / 2);
        boardStartRow = Math.floor(newRows / 2) - Math.floor(TROWS / 2);
    }

    function startGame() {
        player = { x: Math.floor(COLS / 2), y: Math.floor(TROWS / 2), hp: 10, maxHp: 10 };
        enemies = [];
        projectiles = [];
        xpGems = [];
        healDrops = [];
        score = 0; kills = 0; level = 1; xp = 0; xpToNext = 5;
        gameTime = 0;
        fireRate = 12; fireCooldown = 0;
        projSpeed = 1; projDamage = 1; projCount = 1;
        spawnRate = 60; spawnCooldown = 0;
        tickSpeed = 100;
        gameOverState = false;
        levelUpActive = false;
        gameRunning = true;
        paused = false;
        lastTick = performance.now();
        gameLoop(lastTick);
    }

    function spawnEnemy() {
        // Spawn from a random edge
        let x, y;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { x = 0; y = Math.floor(Math.random() * TROWS); }
        else if (side === 1) { x = COLS - 1; y = Math.floor(Math.random() * TROWS); }
        else if (side === 2) { x = Math.floor(Math.random() * COLS); y = 0; }
        else { x = Math.floor(Math.random() * COLS); y = TROWS - 1; }

        // Enemy types based on game time
        let type = 'normal';
        if (gameTime > 600 && Math.random() < 0.3) type = 'fast';
        if (gameTime > 1200 && Math.random() < 0.2) type = 'tank';

        const hp = type === 'tank' ? 3 + Math.floor(gameTime / 600) : 1;
        const speed = type === 'fast' ? 2 : 1;
        const char = type === 'fast' ? 'F' : type === 'tank' ? 'T' : 'X';
        enemies.push({ x, y, hp, type, speed, moveCd: 0, char });
    }

    function findClosestEnemy() {
        let closest = null, minDist = Infinity;
        for (const e of enemies) {
            const d = Math.abs(e.x - player.x) + Math.abs(e.y - player.y);
            if (d < minDist) { minDist = d; closest = e; }
        }
        return closest;
    }

    function aimAt(fromX, fromY, toX, toY) {
        const ddx = toX - fromX;
        const ddy = toY - fromY;
        const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        // Normalize to length ~1.5 so it moves roughly 1-2 cells per tick
        return { dx: (ddx / len) * 1.5, dy: (ddy / len) * 1.5 };
    }

    function fireProjectiles() {
        const target = findClosestEnemy();
        if (!target) return;

        // Main projectile toward closest enemy
        const aim = aimAt(player.x, player.y, target.x, target.y);
        projectiles.push({ fx: player.x, fy: player.y, dx: aim.dx, dy: aim.dy, dmg: projDamage, life: 20 });

        // Extra projectiles spread around
        const angles = [
            { dx: 1.5, dy: 0 }, { dx: -1.5, dy: 0 }, { dx: 0, dy: 1.5 }, { dx: 0, dy: -1.5 },
            { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
        ];
        for (let i = 1; i < projCount; i++) {
            const a = angles[(i - 1) % angles.length];
            projectiles.push({ fx: player.x, fy: player.y, dx: a.dx, dy: a.dy, dmg: projDamage, life: 20 });
        }
    }

    function movePlayer() {
        let nx = player.x, ny = player.y;
        if (keysDown.has('ArrowLeft') || keysDown.has('a') || keysDown.has('A')) nx--;
        if (keysDown.has('ArrowRight') || keysDown.has('d') || keysDown.has('D')) nx++;
        if (keysDown.has('ArrowUp') || keysDown.has('w') || keysDown.has('W')) ny--;
        if (keysDown.has('ArrowDown') || keysDown.has('s') || keysDown.has('S')) ny++;
        player.x = Math.max(0, Math.min(COLS - 1, nx));
        player.y = Math.max(0, Math.min(TROWS - 1, ny));
    }

    function tick() {
        gameTime++;
        movePlayer();

        // Magnetize XP gems toward player
        for (const g of xpGems) {
            const ddx = player.x - g.x;
            const ddy = player.y - g.y;
            const dist = Math.abs(ddx) + Math.abs(ddy);
            if (dist > 0 && dist <= XP_MAGNET_RANGE) {
                if (Math.abs(ddx) > Math.abs(ddy)) {
                    g.x += ddx > 0 ? 1 : -1;
                } else {
                    g.y += ddy > 0 ? 1 : -1;
                }
            }
        }

        // Collect XP gems
        xpGems = xpGems.filter(g => {
            if (g.x === player.x && g.y === player.y) {
                xp++;
                if (xp >= xpToNext) {
                    xp = 0;
                    level++;
                    xpToNext = Math.floor(xpToNext * 1.5);
                    showLevelUp();
                }
                return false;
            }
            return true;
        });

        // Collect health potions
        healDrops = healDrops.filter(h => {
            if (h.x === player.x && h.y === player.y) {
                player.hp = Math.min(player.hp + 3, player.maxHp);
                return false;
            }
            return true;
        });

        // Fire
        fireCooldown--;
        if (fireCooldown <= 0) {
            fireProjectiles();
            fireCooldown = fireRate;
        }

        // Move projectiles
        projectiles = projectiles.filter(p => {
            p.fx += p.dx;
            p.fy += p.dy;
            p.life--;
            const px = Math.floor(p.fx);
            const py = Math.floor(p.fy);
            if (px < 0 || px >= COLS || py < 0 || py >= TROWS || p.life <= 0) return false;

            // Hit enemies
            for (let i = enemies.length - 1; i >= 0; i--) {
                if (enemies[i].x === px && enemies[i].y === py) {
                    enemies[i].hp -= p.dmg;
                    if (enemies[i].hp <= 0) {
                        // Drop XP
                        xpGems.push({ x: enemies[i].x, y: enemies[i].y });
                        // 15% chance to drop health potion
                        if (Math.random() < 0.15) {
                            healDrops.push({ x: enemies[i].x, y: enemies[i].y });
                        }
                        enemies.splice(i, 1);
                        kills++;
                        score += 10;
                    }
                    return false; // projectile consumed
                }
            }
            return true;
        });

        // Move enemies toward player
        for (const e of enemies) {
            e.moveCd--;
            if (e.moveCd > 0) continue;
            e.moveCd = e.speed === 2 ? 1 : 2;

            const ddx = player.x - e.x;
            const ddy = player.y - e.y;
            if (Math.abs(ddx) > Math.abs(ddy)) {
                e.x += ddx > 0 ? 1 : -1;
            } else if (ddy !== 0) {
                e.y += ddy > 0 ? 1 : -1;
            }

            // Hit player
            if (e.x === player.x && e.y === player.y) {
                player.hp--;
                e.hp = 0;
                enemies = enemies.filter(en => en.hp > 0);
                if (player.hp <= 0) {
                    gameRunning = false;
                    gameOverState = true;
                    return;
                }
            }
        }

        // Spawn enemies
        spawnCooldown--;
        if (spawnCooldown <= 0) {
            const count = 1 + Math.floor(gameTime / 300);
            for (let i = 0; i < count; i++) spawnEnemy();
            spawnCooldown = Math.max(10, spawnRate - Math.floor(gameTime / 50));
        }

        // Expire old pickups
        if (xpGems.length > 50) xpGems = xpGems.slice(-50);
        if (healDrops.length > 20) healDrops = healDrops.slice(-20);
    }

    function showLevelUp() {
        levelUpActive = true;
        paused = true;
        // Pick 3 random upgrades
        const shuffled = [...UPGRADES].sort(() => Math.random() - 0.5);
        levelUpChoices = shuffled.slice(0, 3);
        levelUpSelection = 0;
    }

    function selectUpgrade(idx) {
        levelUpChoices[idx].apply();
        levelUpActive = false;
        levelUpChoices = [];
        paused = false;
        lastTick = performance.now();
        requestAnimationFrame(gameLoop);
    }

    function gameLoop(timestamp) {
        if (destroyed || !gameRunning || paused) return;
        if (timestamp - lastTick > tickSpeed) {
            tick();
            lastTick = timestamp;
        }
        animFrameId = requestAnimationFrame(gameLoop);
    }

    function onKeyDown(e) {
        if (destroyed) return;
        keysDown.add(e.key);

        if (levelUpActive) {
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                levelUpSelection = (levelUpSelection - 1 + levelUpChoices.length) % levelUpChoices.length;
            } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                levelUpSelection = (levelUpSelection + 1) % levelUpChoices.length;
            } else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                selectUpgrade(levelUpSelection);
            }
            return;
        }

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

        // Player
        if (bx === player.x && by === player.y) {
            return { char: '@', color: PLAYER_COLOR };
        }

        // Projectiles
        for (const p of projectiles) {
            if (Math.floor(p.fx) === bx && Math.floor(p.fy) === by) {
                return { char: randChar(), color: PROJECTILE_COLOR };
            }
        }

        // Enemies
        for (const e of enemies) {
            if (e.x === bx && e.y === by) {
                const color = e.type === 'fast' ? ENEMY_FAST_COLOR :
                              e.type === 'tank' ? ENEMY_TANK_COLOR : ENEMY_COLOR;
                return { char: e.char, color };
            }
        }

        // XP gems
        for (const g of xpGems) {
            if (g.x === bx && g.y === by) {
                return { char: randChar(), color: XP_COLOR };
            }
        }

        // Health potions
        for (const h of healDrops) {
            if (h.x === bx && h.y === by) {
                return { char: '+', color: HEAL_COLOR };
            }
        }

        return null;
    }

    function getInfoEntries() {
        const entries = [];
        const infoCol = boardStartCol + COLS + 2;
        let infoRow = boardStartRow + 2;

        entries.push({ text: 'HP', row: infoRow, col: infoCol, color: '#888' });
        const hpBar = '#'.repeat(player.hp) + '.'.repeat(Math.max(0, player.maxHp - player.hp));
        entries.push({ text: hpBar, row: infoRow + 1, col: infoCol, color: player.hp <= 3 ? '#ff4757' : '#00ff6a' });
        infoRow += 3;

        entries.push({ text: 'LVL ' + level, row: infoRow, col: infoCol, color: '#ffe138' });
        const xpBar = '[' + '='.repeat(Math.floor((xp / xpToNext) * 8)) + ' '.repeat(8 - Math.floor((xp / xpToNext) * 8)) + ']';
        entries.push({ text: xpBar, row: infoRow + 1, col: infoCol, color: '#888' });
        infoRow += 3;

        entries.push({ text: 'KILLS', row: infoRow, col: infoCol, color: '#888' });
        entries.push({ text: String(kills), row: infoRow + 1, col: infoCol, color: '#ff4757' });
        infoRow += 3;

        entries.push({ text: 'SCORE', row: infoRow, col: infoCol, color: '#888' });
        entries.push({ text: String(score), row: infoRow + 1, col: infoCol, color: '#00d4ff' });
        infoRow += 3;

        entries.push({ text: 'ESC TO EXIT', row: infoRow, col: infoCol, color: '#555' });

        if (!gameRunning && !gameOverState) {
            entries.push({ text: 'PRESS SPACE', row: boardStartRow + Math.floor(TROWS / 2), col: boardStartCol + 10, color: '#fff' });
            entries.push({ text: 'WASD TO MOVE', row: boardStartRow + Math.floor(TROWS / 2) + 2, col: boardStartCol + 9, color: '#555' });
            entries.push({ text: 'AUTO ATTACK', row: boardStartRow + Math.floor(TROWS / 2) + 3, col: boardStartCol + 10, color: '#555' });
        }

        if (gameOverState) {
            entries.push({ text: 'GAME OVER', row: boardStartRow + Math.floor(TROWS / 2) - 2, col: boardStartCol + 11, color: '#ff4757' });
            entries.push({ text: 'SCORE ' + score, row: boardStartRow + Math.floor(TROWS / 2), col: boardStartCol + 12, color: '#00d4ff' });
            entries.push({ text: 'KILLS ' + kills, row: boardStartRow + Math.floor(TROWS / 2) + 1, col: boardStartCol + 12, color: '#ff4757' });
            entries.push({ text: 'PRESS SPACE', row: boardStartRow + Math.floor(TROWS / 2) + 3, col: boardStartCol + 10, color: '#fff' });
        }

        if (levelUpActive) {
            const midRow = boardStartRow + Math.floor(TROWS / 2) - 3;
            entries.push({ text: 'LEVEL UP!', row: midRow, col: boardStartCol + 11, color: '#ffe138' });
            entries.push({ text: 'CHOOSE UPGRADE', row: midRow + 1, col: boardStartCol + 8, color: '#888' });
            for (let i = 0; i < levelUpChoices.length; i++) {
                const sel = i === levelUpSelection ? '>' : ' ';
                const color = i === levelUpSelection ? '#fff' : '#888';
                entries.push({
                    text: sel + ' ' + levelUpChoices[i].name,
                    row: midRow + 3 + i * 2,
                    col: boardStartCol + 9,
                    color
                });
                entries.push({
                    text: '  ' + levelUpChoices[i].desc,
                    row: midRow + 4 + i * 2,
                    col: boardStartCol + 9,
                    color: '#555'
                });
            }
        }

        if (paused && !levelUpActive) {
            entries.push({ text: 'PAUSED', row: boardStartRow + Math.floor(TROWS / 2), col: boardStartCol + 12, color: '#fff' });
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

        // Player
        cells.push({ col: boardStartCol + player.x, row: boardStartRow + player.y, color: PLAYER_COLOR });

        // Enemies
        for (const e of enemies) {
            const color = e.type === 'fast' ? ENEMY_FAST_COLOR :
                          e.type === 'tank' ? ENEMY_TANK_COLOR : ENEMY_COLOR;
            cells.push({ col: boardStartCol + e.x, row: boardStartRow + e.y, color, char: e.char });
        }

        // Projectiles
        for (const p of projectiles) {
            cells.push({ col: boardStartCol + Math.floor(p.fx), row: boardStartRow + Math.floor(p.fy), color: PROJECTILE_COLOR });
        }

        // XP gems
        for (const g of xpGems) {
            cells.push({ col: boardStartCol + g.x, row: boardStartRow + g.y, color: XP_COLOR });
        }

        // Health potions
        for (const h of healDrops) {
            cells.push({ col: boardStartCol + h.x, row: boardStartRow + h.y, color: HEAL_COLOR });
        }

        // Track which cells are occupied now vs last frame
        const currentKeys = new Set(cells.map(c => c.col + ',' + c.row));
        const stale = [];
        for (const key of prevOccupiedKeys) {
            if (!currentKeys.has(key)) {
                const [col, row] = key.split(',').map(Number);
                stale.push({ col, row });
            }
        }
        prevOccupiedKeys = currentKeys;

        cells.stale = stale;
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
        }
    };
}
