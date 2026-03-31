function initMaze3dRain(columns, rows, fontSize, resolution) {
    const RES = Math.max(1, Math.min(4, resolution || 1));
    const COLS = 80 * RES;
    const TROWS = 40 * RES;

    let boardStartCol = Math.floor(columns / 2) - Math.floor(COLS / 2);
    let boardStartRow = Math.floor(rows / 2) - Math.floor(TROWS / 2);

    const matrixChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()*&^%';

    // Colors
    const WALL_NS_COLOR = '#33e5ff';
    const WALL_EW_COLOR = '#00b8d4';
    const FLOOR_COLOR = '#3a8a3a';
    const FLOOR_NEAR_COLOR = '#55cc55';
    const CEILING_COLOR = '#252568';
    const CEILING_NEAR_COLOR = '#353590';

    const ENEMY_COLOR = '#ff4757';
    const ENEMY_FAST_COLOR = '#ff7b00';
    const ENEMY_TANK_COLOR = '#a35dff';
    const HEAL_COLOR = '#00ff6a';

    // Map (1 = wall, 0 = empty)
    const MAP_W = 16;
    const MAP_H = 16;
    const worldMap = [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1],
        [1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1],
        [1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ];

    // Player state
    let posX = 8.0, posY = 8.0;
    let dirX = -1.0, dirY = 0.0;
    let planeX = 0.0, planeY = 0.66;

    let hp = 10, maxHp = 10;
    let score = 0;
    let kills = 0;
    let wave = 1;
    let gameTime = 0;
    let damageFlash = 0; // ticks of red screen flash

    let gameRunning = false;
    let gameOverState = false;
    let destroyed = false;
    let paused = false;
    let animFrameId = null;
    let lastTick = 0;
    const tickSpeed = 33;
    const keysDown = new Set();

    // Framebuffer
    let fb = new Array(COLS * TROWS);
    for (let i = 0; i < fb.length; i++) fb[i] = { char: ' ', color: '#000' };

    // Z-buffer for sprite occlusion
    let zBuffer = new Float64Array(COLS);

    let prevOccupiedKeys = new Set();

    // Gun state
    let gunFrame = 0;
    let gunFrameTimer = 0;
    const GUN_FRAME_DURATION = 3;

    let pointerLocked = false;
    let pendingMouseDX = 0;
    let pendingMouseDY = 0;
    let pitchOffset = 0;
    const MAX_PITCH = Math.floor(TROWS * 0.6);
    const ENABLE_VERTICAL_LOOK = false;

    const MOVE_SPEED = 0.08;
    const ROT_SPEED = 0.04;
    const MOUSE_SENSITIVITY = 0.003;
    const PITCH_SENSITIVITY = 0.5;

    // Enemies
    let enemies = [];
    let spawnCooldown = 0;
    let spawnRate = 90; // ticks between spawns

    // Health pickups
    let pickups = [];

    function resize(newCols, newRows) {
        boardStartCol = Math.floor(newCols / 2) - Math.floor(COLS / 2);
        boardStartRow = Math.floor(newRows / 2) - Math.floor(TROWS / 2);
    }

    function startGame() {
        posX = 8.0; posY = 8.0;
        dirX = -1.0; dirY = 0.0;
        planeX = 0.0; planeY = 0.66;
        hp = 10; maxHp = 10;
        score = 0; kills = 0; wave = 1; gameTime = 0;
        damageFlash = 0;
        enemies = [];
        pickups = [];
        spawnCooldown = 60;
        spawnRate = 90;
        gunFrame = 0;
        gameOverState = false;
        gameRunning = true;
        paused = false;
        lastTick = performance.now();
        gameLoop(lastTick);
    }

    function tryMove(nx, ny) {
        const margin = 0.2;
        if (worldMap[Math.floor(ny)][Math.floor(nx + margin)] === 0 &&
            worldMap[Math.floor(ny)][Math.floor(nx - margin)] === 0 &&
            worldMap[Math.floor(ny + margin)][Math.floor(nx)] === 0 &&
            worldMap[Math.floor(ny - margin)][Math.floor(nx)] === 0) {
            posX = nx; posY = ny;
        } else {
            if (worldMap[Math.floor(posY)][Math.floor(nx + margin)] === 0 &&
                worldMap[Math.floor(posY)][Math.floor(nx - margin)] === 0) {
                posX = nx;
            }
            if (worldMap[Math.floor(ny + margin)][Math.floor(posX)] === 0 &&
                worldMap[Math.floor(ny - margin)][Math.floor(posX)] === 0) {
                posY = ny;
            }
        }
    }

    function rotate(angle) {
        const oldDirX = dirX;
        dirX = dirX * Math.cos(angle) - dirY * Math.sin(angle);
        dirY = oldDirX * Math.sin(angle) + dirY * Math.cos(angle);
        const oldPlaneX = planeX;
        planeX = planeX * Math.cos(angle) - planeY * Math.sin(angle);
        planeY = oldPlaneX * Math.sin(angle) + planeY * Math.cos(angle);
    }

    function handleInput() {
        if (!gameRunning) return;

        if (keysDown.has('w') || keysDown.has('W') || keysDown.has('ArrowUp')) {
            tryMove(posX + dirX * MOVE_SPEED, posY + dirY * MOVE_SPEED);
        }
        if (keysDown.has('s') || keysDown.has('S') || keysDown.has('ArrowDown')) {
            tryMove(posX - dirX * MOVE_SPEED, posY - dirY * MOVE_SPEED);
        }
        if (keysDown.has('a') || keysDown.has('A')) {
            tryMove(posX - dirY * MOVE_SPEED, posY + dirX * MOVE_SPEED);
        }
        if (keysDown.has('d') || keysDown.has('D')) {
            tryMove(posX + dirY * MOVE_SPEED, posY - dirX * MOVE_SPEED);
        }

        if (keysDown.has('ArrowLeft')) rotate(ROT_SPEED);
        if (keysDown.has('ArrowRight')) rotate(-ROT_SPEED);

        if (pendingMouseDX !== 0) {
            rotate(-pendingMouseDX * MOUSE_SENSITIVITY);
            pendingMouseDX = 0;
        }
        if (ENABLE_VERTICAL_LOOK && pendingMouseDY !== 0) {
            pitchOffset -= pendingMouseDY * PITCH_SENSITIVITY;
            pitchOffset = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitchOffset));
        }
        pendingMouseDY = 0;
    }

    // ── Enemies ──

    function spawnEnemy() {
        // Spawn from a random edge cell that's open
        const edges = [];
        for (let x = 1; x < MAP_W - 1; x++) {
            if (worldMap[1][x] === 0) edges.push({ x: x + 0.5, y: 1.5 });
            if (worldMap[MAP_H - 2][x] === 0) edges.push({ x: x + 0.5, y: MAP_H - 1.5 });
        }
        for (let y = 1; y < MAP_H - 1; y++) {
            if (worldMap[y][1] === 0) edges.push({ x: 1.5, y: y + 0.5 });
            if (worldMap[y][MAP_W - 2] === 0) edges.push({ x: MAP_W - 1.5, y: y + 0.5 });
        }
        if (edges.length === 0) return;

        const spot = edges[Math.floor(Math.random() * edges.length)];
        // Don't spawn too close to player
        const dx = spot.x - posX, dy = spot.y - posY;
        if (dx * dx + dy * dy < 9) return;

        let type = 'normal';
        if (gameTime > 600 && Math.random() < 0.3) type = 'fast';
        if (gameTime > 1200 && Math.random() < 0.2) type = 'tank';

        const eHp = type === 'tank' ? 3 + Math.floor(wave / 3) : type === 'fast' ? 1 : 1 + Math.floor(wave / 5);
        const speed = type === 'fast' ? 0.04 : type === 'tank' ? 0.015 : 0.025;
        const dmg = type === 'tank' ? 2 : 1;
        const char = type === 'fast' ? 'F' : type === 'tank' ? 'T' : 'X';

        enemies.push({
            x: spot.x, y: spot.y,
            hp: eHp, maxHp: eHp,
            type, speed, dmg, char,
            hitFlash: 0,
        });
    }

    function updateEnemies() {
        for (const e of enemies) {
            if (e.hitFlash > 0) e.hitFlash--;

            // Move toward player with simple pathfinding
            const dx = posX - e.x;
            const dy = posY - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.01) continue;

            const mx = (dx / dist) * e.speed;
            const my = (dy / dist) * e.speed;

            // Try to move, slide along walls
            const margin = 0.15;
            let nx = e.x + mx, ny = e.y + my;
            const mi = Math.floor(ny), mj = Math.floor(nx);
            if (mi >= 0 && mi < MAP_H && mj >= 0 && mj < MAP_W && worldMap[mi][mj] === 0) {
                e.x = nx; e.y = ny;
            } else {
                // Try sliding
                const mx2 = Math.floor(e.y), mj2 = Math.floor(nx);
                if (mj2 >= 0 && mj2 < MAP_W && worldMap[mx2][mj2] === 0) e.x = nx;
                const mi2 = Math.floor(ny), mj3 = Math.floor(e.x);
                if (mi2 >= 0 && mi2 < MAP_H && worldMap[mi2][mj3] === 0) e.y = ny;
            }

            // Hit player
            if (dist < 0.5) {
                hp -= e.dmg;
                damageFlash = 6;
                e.hp = 0; // enemy dies on contact
                score += 5;
                if (hp <= 0) {
                    hp = 0;
                    gameRunning = false;
                    gameOverState = true;
                }
            }
        }

        // Remove dead enemies, drop pickups
        enemies = enemies.filter(e => {
            if (e.hp <= 0) {
                kills++;
                // 15% chance health drop
                if (Math.random() < 0.15) {
                    pickups.push({ x: e.x, y: e.y, type: 'health', life: 300 });
                }
                return false;
            }
            return true;
        });
    }

    function updateSpawns() {
        spawnCooldown--;
        if (spawnCooldown <= 0) {
            const count = 1 + Math.floor(wave / 2);
            for (let i = 0; i < count; i++) spawnEnemy();
            spawnCooldown = Math.max(15, spawnRate - wave * 3);
        }

        // Wave progression every 10 kills
        const newWave = 1 + Math.floor(kills / 10);
        if (newWave > wave) {
            wave = newWave;
            spawnRate = Math.max(20, 90 - wave * 5);
        }
    }

    function updatePickups() {
        pickups = pickups.filter(p => {
            p.life--;
            if (p.life <= 0) return false;
            const dx = posX - p.x, dy = posY - p.y;
            if (dx * dx + dy * dy < 0.6) {
                if (p.type === 'health') {
                    hp = Math.min(hp + 3, maxHp);
                }
                return false;
            }
            return true;
        });
    }

    // ── Shooting ──

    function fireGun() {
        if (gunFrame !== 0 || !gameRunning) return;
        gunFrame = 1;
        gunFrameTimer = GUN_FRAME_DURATION;

        // Hitscan: cast ray in look direction
        const rayDirX = dirX;
        const rayDirY = dirY;

        let closestEnemy = null;
        let closestDist = Infinity;

        for (const e of enemies) {
            // Vector from player to enemy
            const ex = e.x - posX;
            const ey = e.y - posY;

            // Project onto look direction
            const dot = ex * rayDirX + ey * rayDirY;
            if (dot <= 0) continue; // behind us

            // Perpendicular distance from ray to enemy center
            const perpX = ex - rayDirX * dot;
            const perpY = ey - rayDirY * dot;
            const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

            // Hit radius scales with distance (crosshair tolerance)
            const hitRadius = 0.4 + dot * 0.02;
            if (perpDist < hitRadius && dot < closestDist) {
                // Check wall occlusion with a quick ray march
                if (!isWallBetween(posX, posY, e.x, e.y)) {
                    closestDist = dot;
                    closestEnemy = e;
                }
            }
        }

        if (closestEnemy) {
            closestEnemy.hp--;
            closestEnemy.hitFlash = 4;
            if (closestEnemy.hp <= 0) {
                score += 10;
            }
        }
    }

    function isWallBetween(x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.ceil(dist * 3);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const cx = Math.floor(x1 + dx * t);
            const cy = Math.floor(y1 + dy * t);
            if (cx >= 0 && cx < MAP_W && cy >= 0 && cy < MAP_H && worldMap[cy][cx] === 1) {
                return true;
            }
        }
        return false;
    }

    // ── Rendering ──

    function renderFrame() {
        // Clear framebuffer
        for (let i = 0; i < fb.length; i++) {
            fb[i].char = ' ';
            fb[i].color = '#000';
        }

        const halfH = TROWS / 2 + pitchOffset;

        // Wall raycasting pass (fills zBuffer)
        for (let x = 0; x < COLS; x++) {
            const cameraX = 2 * x / COLS - 1;
            const rayDirX = dirX + planeX * cameraX;
            const rayDirY = dirY + planeY * cameraX;

            let mapX = Math.floor(posX);
            let mapY = Math.floor(posY);

            const deltaDistX = Math.abs(rayDirX) < 1e-10 ? 1e10 : Math.abs(1 / rayDirX);
            const deltaDistY = Math.abs(rayDirY) < 1e-10 ? 1e10 : Math.abs(1 / rayDirY);

            let stepX, stepY, sideDistX, sideDistY;

            if (rayDirX < 0) { stepX = -1; sideDistX = (posX - mapX) * deltaDistX; }
            else { stepX = 1; sideDistX = (mapX + 1 - posX) * deltaDistX; }
            if (rayDirY < 0) { stepY = -1; sideDistY = (posY - mapY) * deltaDistY; }
            else { stepY = 1; sideDistY = (mapY + 1 - posY) * deltaDistY; }

            let hit = 0, side = 0;
            while (hit === 0) {
                if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
                else { sideDistY += deltaDistY; mapY += stepY; side = 1; }
                if (mapX < 0 || mapX >= MAP_W || mapY < 0 || mapY >= MAP_H) { hit = 1; break; }
                if (worldMap[mapY][mapX] > 0) hit = 1;
            }

            let perpWallDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
            if (perpWallDist < 0.01) perpWallDist = 0.01;
            zBuffer[x] = perpWallDist;

            const lineHeight = Math.floor(TROWS / perpWallDist);
            let drawStart = Math.floor(-lineHeight / 2 + halfH);
            let drawEnd = Math.floor(lineHeight / 2 + halfH);
            if (drawStart < 0) drawStart = 0;
            if (drawEnd >= TROWS) drawEnd = TROWS - 1;

            let wallX = side === 0 ? posY + perpWallDist * rayDirY : posX + perpWallDist * rayDirX;
            wallX -= Math.floor(wallX);

            const wallColor = side === 0 ? WALL_NS_COLOR : WALL_EW_COLOR;
            const wallBrightness = Math.max(0.5, 1.0 - perpWallDist * 0.04);
            const darkWallColor = darkenColor(wallColor, wallBrightness);
            const isEdge = wallX < 0.05 || wallX > 0.95;
            const edgeColor = isEdge ? darkenColor(wallColor, wallBrightness * 0.6) : darkWallColor;

            for (let y = 0; y < TROWS; y++) {
                const idx = y * COLS + x;
                if (y < drawStart) {
                    const ceilDist = (TROWS - y) / TROWS;
                    fb[idx].char = '.';
                    fb[idx].color = ceilDist > 0.6 ? CEILING_NEAR_COLOR : CEILING_COLOR;
                } else if (y <= drawEnd) {
                    const texY = (y - drawStart) / (drawEnd - drawStart + 1);
                    const brickY = (texY * 4) - Math.floor(texY * 4);
                    const isMortar = brickY < 0.08 || isEdge;
                    fb[idx].char = isMortar ? '.' : '#';
                    fb[idx].color = isMortar ? edgeColor : darkWallColor;
                } else {
                    const floorDist = y / TROWS;
                    const floorCharIdx = Math.floor((1 - floorDist) * 6);
                    const floorChars = '.:-=+#';
                    fb[idx].char = floorChars[Math.max(0, Math.min(5, floorCharIdx))];
                    fb[idx].color = floorDist > 0.7 ? FLOOR_NEAR_COLOR : FLOOR_COLOR;
                }
            }
        }

        // Sprite pass — draw enemies and pickups
        renderSprites();

        // Damage flash overlay
        if (damageFlash > 0) {
            for (let i = 0; i < fb.length; i++) {
                if (fb[i].color !== '#000') {
                    fb[i].color = blendColor(fb[i].color, '#ff0000', 0.3);
                }
            }
        }

        // HUD
        drawHUD();

        // Crosshair (in base-res coordinates, drawn as blocks)
        const cx = Math.floor(COLS / 2 / RES);
        const cy = Math.floor(TROWS / 2 / RES);
        setFBBlock(cx, cy, '+', '#ffffff');
        setFBBlock(cx - 1, cy, '-', '#888888');
        setFBBlock(cx + 1, cy, '-', '#888888');
        setFBBlock(cx, cy - 1, '|', '#888888');
        setFBBlock(cx, cy + 1, '|', '#888888');

        // Minimap
        drawMinimap();

        // Gun
        drawGun();

        // Title / game over overlay (rows in base-res coords: 40/2 = 20 center)
        const midR = 20;
        if (!gameRunning && !gameOverState) {
            drawCenteredText('DOOM RAIN', midR - 4, '#ff4757');
            drawCenteredText('SURVIVE THE HORDE', midR - 2, '#888');
            drawCenteredText('CLICK TO START', midR + 1, '#fff');
            drawCenteredText('WASD MOVE  MOUSE AIM  CLICK/SPACE SHOOT', midR + 3, '#555');
        }
        if (gameOverState) {
            drawCenteredText('YOU DIED', midR - 3, '#ff4757');
            drawCenteredText('KILLS: ' + kills, midR - 1, '#ff7b00');
            drawCenteredText('SCORE: ' + score, midR, '#00d4ff');
            drawCenteredText('WAVE: ' + wave, midR + 1, '#ffe138');
            drawCenteredText('CLICK TO RESTART', midR + 3, '#fff');
        }
    }

    function drawCenteredText(text, baseRow, color) {
        const baseCX = Math.floor(COLS / 2 / RES);
        const startX = baseCX - Math.floor(text.length / 2);
        for (let i = 0; i < text.length; i++) {
            setFBBlock(startX + i, baseRow, text[i], color);
        }
    }

    function renderSprites() {
        // Collect all sprites (enemies + pickups)
        const sprites = [];
        for (const e of enemies) {
            sprites.push({ x: e.x, y: e.y, char: e.char, type: e.type, hitFlash: e.hitFlash, isEnemy: true });
        }
        for (const p of pickups) {
            sprites.push({ x: p.x, y: p.y, char: '+', type: 'health', isEnemy: false });
        }

        // Sort back to front
        sprites.sort((a, b) => {
            const da = (a.x - posX) * (a.x - posX) + (a.y - posY) * (a.y - posY);
            const db = (b.x - posX) * (b.x - posX) + (b.y - posY) * (b.y - posY);
            return db - da;
        });

        const halfH = TROWS / 2 + pitchOffset;

        for (const spr of sprites) {
            // Transform sprite position to camera space
            const sx = spr.x - posX;
            const sy = spr.y - posY;
            const invDet = 1.0 / (planeX * dirY - dirX * planeY);
            const transformX = invDet * (dirY * sx - dirX * sy);
            const transformY = invDet * (-planeY * sx + planeX * sy);

            if (transformY <= 0.1) continue; // behind camera

            const spriteScreenX = Math.floor((COLS / 2) * (1 + transformX / transformY));
            const spriteHeight = Math.abs(Math.floor(TROWS / transformY));
            const drawStartY = Math.max(0, Math.floor(-spriteHeight / 2 + halfH));
            const drawEndY = Math.min(TROWS - 1, Math.floor(spriteHeight / 2 + halfH));

            const spriteWidth = Math.abs(Math.floor(TROWS / transformY)) / 2;
            const drawStartX = Math.max(0, Math.floor(spriteScreenX - spriteWidth / 2));
            const drawEndX = Math.min(COLS - 1, Math.floor(spriteScreenX + spriteWidth / 2));

            let color;
            if (spr.isEnemy) {
                if (spr.hitFlash > 0) {
                    color = '#ffffff';
                } else if (spr.type === 'fast') {
                    color = ENEMY_FAST_COLOR;
                } else if (spr.type === 'tank') {
                    color = ENEMY_TANK_COLOR;
                } else {
                    color = ENEMY_COLOR;
                }
            } else {
                color = HEAL_COLOR;
            }

            // Darken by distance
            const brightness = Math.max(0.5, 1.0 - transformY * 0.05);
            const drawColor = spr.hitFlash > 0 ? color : darkenColor(color, brightness);

            for (let x = drawStartX; x <= drawEndX; x++) {
                if (transformY < zBuffer[x]) {
                    for (let y = drawStartY; y <= drawEndY; y++) {
                        // Simple sprite shape — denser in the middle
                        const relX = (x - spriteScreenX) / (spriteWidth / 2 + 0.01);
                        const relY = (y - (drawStartY + drawEndY) / 2) / (spriteHeight / 2 + 0.01);
                        // Rough diamond/circle shape
                        if (Math.abs(relX) + Math.abs(relY) < 1.2) {
                            const ch = spr.isEnemy ? spr.char : '+';
                            setFB(x, y, ch, drawColor);
                        }
                    }
                }
            }
        }
    }

    function drawHUD() {
        // HP bar top-right of viewport (base-res coords)
        const hpX = 80 - 20;
        const hpY = 1;

        const hpText = 'HP ';
        for (let i = 0; i < hpText.length; i++) setFBBlock(hpX + i, hpY, hpText[i], '#888');
        const filled = Math.ceil((hp / maxHp) * 10);
        for (let i = 0; i < 10; i++) {
            const ch = i < filled ? '#' : '.';
            const col = hp <= 3 ? '#ff4757' : '#00ff6a';
            setFBBlock(hpX + hpText.length + i, hpY, ch, i < filled ? col : '#333');
        }

        // Score / kills / wave
        const scoreText = 'K:' + kills + ' W:' + wave + ' S:' + score;
        for (let i = 0; i < scoreText.length; i++) {
            setFBBlock(hpX + i, hpY + 1, scoreText[i], '#888');
        }
    }

    function drawMinimap() {
        const mmSize = 11;
        const mmOffX = 1;
        const mmOffY = 1;

        // Background + border (in base-res coords, drawn as blocks)
        for (let my = -1; my <= mmSize; my++) {
            for (let mx = -1; mx <= mmSize; mx++) {
                if (my === -1 || my === mmSize || mx === -1 || mx === mmSize) {
                    setFBBlock(mmOffX + mx, mmOffY + my, '.', '#333');
                }
            }
        }

        const half = Math.floor(mmSize / 2);

        for (let my = 0; my < mmSize; my++) {
            for (let mx = 0; mx < mmSize; mx++) {
                const wmx = Math.floor(posX) - half + mx;
                const wmy = Math.floor(posY) - half + my;
                let ch = ' ', col = '#111';
                if (wmx >= 0 && wmx < MAP_W && wmy >= 0 && wmy < MAP_H) {
                    if (worldMap[wmy][wmx] === 1) { ch = '#'; col = '#4a4a6a'; }
                    else { ch = '.'; col = '#1a1a1a'; }
                }

                // Show enemies on minimap
                for (const e of enemies) {
                    if (Math.floor(e.x) === wmx && Math.floor(e.y) === wmy) {
                        ch = e.char;
                        col = e.type === 'fast' ? ENEMY_FAST_COLOR : e.type === 'tank' ? ENEMY_TANK_COLOR : ENEMY_COLOR;
                    }
                }

                // Show pickups
                for (const p of pickups) {
                    if (Math.floor(p.x) === wmx && Math.floor(p.y) === wmy) {
                        ch = '+'; col = HEAL_COLOR;
                    }
                }

                setFBBlock(mmOffX + mx, mmOffY + my, ch, col);
            }
        }

        // Player at center
        setFBBlock(mmOffX + half, mmOffY + half, '@', '#fff');

        // Direction indicator — draw a line of dots in look direction
        for (let d = 1; d <= 3; d++) {
            const fx = Math.round(half + dirX * d);
            const fy = Math.round(half + dirY * d);
            if (fx >= 0 && fx < mmSize && fy >= 0 && fy < mmSize) {
                const wmx = Math.floor(posX) - half + fx;
                const wmy = Math.floor(posY) - half + fy;
                if (wmx >= 0 && wmx < MAP_W && wmy >= 0 && wmy < MAP_H && worldMap[wmy][wmx] === 0) {
                    setFBBlock(mmOffX + fx, mmOffY + fy, '.', '#00d4ff');
                }
            }
        }
    }

    // ── Gun sprites ──

    const GUN_IDLE = [
        '     ___     ',
        '    |   |    ',
        '    |   |    ',
        '   _|   |_   ',
        '  |  ___  |  ',
        '  | |   | |  ',
        '  | |   | |  ',
        '__|_|   |_|__',
        '|            |',
        '|   ______   |',
        '|  |      |  |',
        '|__|      |__|',
    ];

    const GUN_FIRE1 = [
        '    \\|X|/    ',
        '   --*X*--   ',
        '    /|X|\\    ',
        '     |X|     ',
        '     |_|     ',
        '   _|   |_   ',
        '  |  ___  |  ',
        '  | |   | |  ',
        '  | |   | |  ',
        '__|_|   |_|__',
        '|            |',
        '|   ______   |',
        '|  |      |  |',
        '|__|      |__|',
    ];

    const GUN_FIRE2 = [
        '      *      ',
        '     |X|     ',
        '     |_|     ',
        '   _|   |_   ',
        '  |  ___  |  ',
        '  | |   | |  ',
        '  | |   | |  ',
        '__|_|   |_|__',
        '|            |',
        '|   ______   |',
        '|  |      |  |',
        '|__|      |__|',
    ];

    const GUN_SPRITES = [GUN_IDLE, GUN_FIRE1, GUN_FIRE2, GUN_IDLE];

    const GUN_COLOR = '#8888aa';
    const GUN_HIGHLIGHT = '#aaaacc';
    const MUZZLE_COLOR = '#ffaa00';
    const MUZZLE_BRIGHT = '#ffff44';

    function drawGun() {
        const sprite = GUN_SPRITES[gunFrame];
        const spriteH = sprite.length;
        const spriteW = Math.max(...sprite.map(s => s.length));

        // Base-res coords: center horizontally, anchor to bottom
        const baseCX = Math.floor(80 / 2) - Math.floor(spriteW / 2);
        const baseCY = 40 - spriteH;

        for (let row = 0; row < spriteH; row++) {
            const line = sprite[row];
            for (let col = 0; col < line.length; col++) {
                const ch = line[col];
                if (ch === ' ') continue;
                let color = GUN_COLOR;
                if (ch === '*' || ch === 'X') color = gunFrame > 0 ? MUZZLE_BRIGHT : GUN_HIGHLIGHT;
                else if (ch === '/' || ch === '\\' || ch === '-') color = gunFrame > 0 ? MUZZLE_COLOR : GUN_COLOR;
                else if (ch === '_' || ch === '|') color = GUN_HIGHLIGHT;
                setFBBlock(baseCX + col, baseCY + row, ch, color);
            }
        }
    }

    // ── Utilities ──

    function setFB(x, y, char, color) {
        if (x < 0 || x >= COLS || y < 0 || y >= TROWS) return;
        fb[y * COLS + x] = { char, color };
    }

    // Draw a RES×RES block for HUD elements so they stay the same visual size
    function setFBBlock(bx, by, char, color) {
        for (let dy = 0; dy < RES; dy++) {
            for (let dx = 0; dx < RES; dx++) {
                setFB(bx * RES + dx, by * RES + dy, char, color);
            }
        }
    }

    function darkenColor(hex, brightness) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return '#' + Math.floor(r * brightness).toString(16).padStart(2, '0') +
                     Math.floor(g * brightness).toString(16).padStart(2, '0') +
                     Math.floor(b * brightness).toString(16).padStart(2, '0');
    }

    function blendColor(hex1, hex2, t) {
        const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
        const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
        const r = Math.floor(r1 * (1 - t) + r2 * t);
        const g = Math.floor(g1 * (1 - t) + g2 * t);
        const b = Math.floor(b1 * (1 - t) + b2 * t);
        return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
    }

    // ── Game loop ──

    function tick() {
        if (!gameRunning) return;
        handleInput();
        gameTime++;

        if (damageFlash > 0) damageFlash--;

        // Animate gun
        if (gunFrame > 0) {
            gunFrameTimer--;
            if (gunFrameTimer <= 0) {
                gunFrame++;
                if (gunFrame >= GUN_SPRITES.length) gunFrame = 0;
                gunFrameTimer = GUN_FRAME_DURATION;
            }
        }

        updateEnemies();
        updateSpawns();
        updatePickups();
        renderFrame();
    }

    function gameLoop(timestamp) {
        if (destroyed) return;
        if (paused) return;

        if (!gameRunning) {
            // Still render title/game over screen
            renderFrame();
        }

        if (timestamp - lastTick > tickSpeed) {
            if (gameRunning) tick();
            lastTick = timestamp;
        }
        animFrameId = requestAnimationFrame(gameLoop);
    }

    function onKeyDown(e) {
        if (destroyed) return;
        keysDown.add(e.key);

        if (e.key === 'p' || e.key === 'P') {
            if (gameRunning) {
                paused = !paused;
                if (!paused) { lastTick = performance.now(); requestAnimationFrame(gameLoop); }
            }
        }

        if (e.key === ' ' && gameRunning) {
            fireGun();
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
    }

    function onKeyUp(e) {
        keysDown.delete(e.key);
    }

    function onMouseMove(e) {
        if (pointerLocked) {
            pendingMouseDX += e.movementX;
            pendingMouseDY += e.movementY;
        }
    }

    function onMouseDown(e) {
        if (destroyed) return;
        const canvas = document.getElementById('matrixCanvas');
        if (!pointerLocked) {
            if (canvas) canvas.requestPointerLock();
            // Start/restart game on first click
            if (!gameRunning) {
                startGame();
            }
        } else {
            if (!gameRunning) {
                startGame();
            } else {
                fireGun();
            }
        }
    }

    function onPointerLockChange() {
        const canvas = document.getElementById('matrixCanvas');
        pointerLocked = document.pointerLockElement === canvas;
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('pointerlockchange', onPointerLockChange);

    // Show title screen
    lastTick = performance.now();
    renderFrame();
    animFrameId = requestAnimationFrame(gameLoop);

    function getCellOverride(col, row) {
        const bx = col - boardStartCol;
        const by = row - boardStartRow;
        if (bx < 0 || bx >= COLS || by < 0 || by >= TROWS) return null;
        const cell = fb[by * COLS + bx];
        if (cell.char === ' ' && cell.color === '#000') return null;
        return { char: cell.char, color: cell.color };
    }

    function getInfoEntries() {
        const entries = [];
        const infoCol = boardStartCol + COLS + 2;
        let infoRow = boardStartRow + 2;

        entries.push({ text: 'DOOM RAIN', row: infoRow, col: infoCol, color: '#ff4757' });
        infoRow += 2;
        entries.push({ text: 'WASD MOVE', row: infoRow, col: infoCol, color: '#555' });
        infoRow += 1;
        entries.push({ text: 'MOUSE AIM', row: infoRow, col: infoCol, color: '#555' });
        infoRow += 1;
        entries.push({ text: 'CLICK SHOOT', row: infoRow, col: infoCol, color: '#555' });
        infoRow += 2;
        entries.push({ text: '~ TO EXIT', row: infoRow, col: infoCol, color: '#555' });

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
        for (let y = 0; y < TROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                const cell = fb[y * COLS + x];
                if (cell.char !== ' ' || cell.color !== '#000') {
                    cells.push({ col: boardStartCol + x, row: boardStartRow + y, color: cell.color, char: cell.char });
                }
            }
        }
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
        fullClear: true,
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
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('pointerlockchange', onPointerLockChange);
            if (pointerLocked) document.exitPointerLock();
        }
    };
}
