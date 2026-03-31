// The Whispering Isle — Text adventure rendered in matrix rain grid
// Uses the same cellOverrideProvider interface as tetris/snake/breakout

function initIslandRain(columns, rows, fontSize) {
  const COLS = Math.min(70, columns - 6);
  const TROWS = Math.min(rows - 4, rows - 4);

  let boardStartCol = Math.floor(columns / 2) - Math.floor(COLS / 2);
  let boardStartRow = 2;

  const SAVE_KEY = 'whisperingIsle_save';
  let destroyed = false;

  // ── Display buffer ──
  // Each cell: { char, color }
  let displayBuffer = {}; // key: "localCol,localRow" => { char, color }
  let outputLines = [];   // array of { text, color } lines
  let scrollOffset = 0;
  let inputText = '';
  let commandHistory = [];
  let historyIndex = -1;
  let cursorBlink = true;
  let blinkTimer = setInterval(() => { cursorBlink = !cursorBlink; }, 500);

  // ── Game data (loaded from window.ISLAND_DATA) ──
  const data = window.ISLAND_DATA;
  let state = null;

  // ── Init ──
  loadState();
  if (state.moves === 0) {
    addOutput('', '#00ff41');
    addOutput('  T H E   W H I S P E R I N G   I S L E', '#00ccff');
    addOutput('  A Text Adventure Mystery', '#00ccff');
    addOutput('', '#00ff41');
    addOutput("  Type 'help' for commands.", '#888');
    addOutput('', '#00ff41');
    addOutput('You awaken face-down in cold surf, coughing saltwater.', '#cccccc');
    addOutput('Splintered wood and torn canvas float around you —', '#cccccc');
    addOutput('the remnants of your vessel. You are alive.', '#cccccc');
    addOutput('But where are you?', '#cccccc');
    addOutput('', '#00ff41');
  } else {
    addOutput(`[Restored — Move ${state.moves}, ${state.visitedRooms.length} rooms visited]`, '#888');
    addOutput('', '#00ff41');
  }
  doLook();
  rebuildDisplay();

  // ── State management ──
  function newGame() {
    return {
      currentRoom: data.meta.startRoom,
      inventory: [],
      flags: {},
      journalCount: 0,
      npcMet: {},
      unlockedExits: {},
      roomItems: buildRoomItems(),
      moves: 0,
      visitedRooms: [data.meta.startRoom]
    };
  }

  function buildRoomItems() {
    const ri = {};
    for (const [id, room] of Object.entries(data.rooms)) {
      ri[id] = [...(room.items || [])];
    }
    return ri;
  }

  function loadState() {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        state = JSON.parse(saved);
        state.flags = state.flags || {};
        state.journalCount = state.journalCount || 0;
        state.npcMet = state.npcMet || {};
        state.unlockedExits = state.unlockedExits || {};
        state.roomItems = state.roomItems || buildRoomItems();
        state.moves = state.moves || 0;
        state.visitedRooms = state.visitedRooms || [];
      } catch { state = null; }
    }
    if (!state) state = newGame();
  }

  function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  // ── Output ──
  function addOutput(text, color) {
    // Word-wrap to fit COLS - 2 (leaving 1 char margin each side)
    const maxW = COLS - 2;
    if (text.length === 0) {
      outputLines.push({ text: '', color: color || '#00ff41' });
      return;
    }
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      if (line.length + word.length + (line.length ? 1 : 0) > maxW) {
        if (line.length > 0) outputLines.push({ text: line, color: color || '#00ff41' });
        line = word;
      } else {
        line = line.length ? line + ' ' + word : word;
      }
    }
    if (line.length > 0) outputLines.push({ text: line, color: color || '#00ff41' });
  }

  // ── Rebuild display buffer ──
  function rebuildDisplay() {
    displayBuffer = {};
    const viewRows = TROWS - 2; // top border + bottom input line

    // Calculate visible output area (leave 1 row for input at bottom)
    const outputAreaRows = viewRows - 1;

    // Scroll: show the last N lines of output
    const totalLines = outputLines.length;
    const maxScroll = Math.max(0, totalLines - outputAreaRows);
    scrollOffset = Math.min(scrollOffset, maxScroll);
    const startLine = Math.max(0, totalLines - outputAreaRows - scrollOffset);

    // Render output lines
    for (let r = 0; r < outputAreaRows; r++) {
      const lineIdx = startLine + r;
      if (lineIdx >= totalLines) break;
      const line = outputLines[lineIdx];
      for (let c = 0; c < line.text.length && c < COLS - 2; c++) {
        displayBuffer[(c + 1) + ',' + r] = { char: line.text[c], color: line.color };
      }
    }

    // Render input line at bottom
    const inputRow = viewRows;
    const promptStr = '> ' + inputText + (cursorBlink ? '_' : ' ');
    for (let c = 0; c < promptStr.length && c < COLS - 2; c++) {
      displayBuffer[(c + 1) + ',' + inputRow] = { char: promptStr[c], color: '#00ff41' };
    }
  }

  // ── Cell override interface (called by matrix rain renderer) ──
  function getCellOverride(col, row) {
    const lc = col - boardStartCol;
    const lr = row - boardStartRow;
    if (lc < 0 || lc >= COLS || lr < 0 || lr >= TROWS) return null;

    const cell = displayBuffer[lc + ',' + lr];
    if (cell) return { char: cell.char, color: cell.color };

    // Dim the interior
    return null;
  }

  function getInfoEntries() {
    return [];
  }

  function getBorderOverride(col, row) {
    const lc = col - boardStartCol;
    const lr = row - boardStartRow;

    if (col === boardStartCol - 1 && lr >= 0 && lr < TROWS) return { char: '|', color: '#4a4a6a' };
    if (col === boardStartCol + COLS && lr >= 0 && lr < TROWS) return { char: '|', color: '#4a4a6a' };
    if (row === boardStartRow - 1 && lc >= -1 && lc <= COLS) return { char: '-', color: '#4a4a6a' };
    if (row === boardStartRow + TROWS && lc >= -1 && lc <= COLS) return { char: '-', color: '#4a4a6a' };
    return null;
  }

  function getOccupiedCells() {
    const cells = [];
    for (const [key, cell] of Object.entries(displayBuffer)) {
      const [lc, lr] = key.split(',').map(Number);
      cells.push({ col: boardStartCol + lc, row: boardStartRow + lr, color: cell.color, char: cell.char });
    }
    return cells;
  }

  function resize(newCols, newRows) {
    boardStartCol = Math.floor(newCols / 2) - Math.floor(COLS / 2);
    boardStartRow = 2;
    rebuildDisplay();
  }

  // ── Keyboard ──
  function onKeyDown(e) {
    if (destroyed) return;

    if (e.key === 'Escape') return; // let parent handle
    if (e.key === '~' || (e.key === '`' && e.shiftKey)) return; // let parent handle

    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = inputText.trim();
      if (cmd) {
        commandHistory.unshift(cmd);
        historyIndex = -1;
        addOutput('> ' + cmd, '#888');
        processCommand(cmd);
        save();
      }
      inputText = '';
      scrollOffset = 0;
      rebuildDisplay();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      inputText = inputText.slice(0, -1);
      rebuildDisplay();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        inputText = commandHistory[historyIndex];
        rebuildDisplay();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        inputText = commandHistory[historyIndex];
      } else {
        historyIndex = -1;
        inputText = '';
      }
      rebuildDisplay();
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      scrollOffset = Math.min(scrollOffset + (TROWS - 4), Math.max(0, outputLines.length - (TROWS - 3)));
      rebuildDisplay();
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      scrollOffset = Math.max(0, scrollOffset - (TROWS - 4));
      rebuildDisplay();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      inputText += e.key;
      rebuildDisplay();
    }
  }

  document.addEventListener('keydown', onKeyDown);

  // Blink cursor refresh
  let refreshTimer = setInterval(() => {
    if (!destroyed) rebuildDisplay();
  }, 500);

  // ── Command processing ──
  function processCommand(raw) {
    const input = raw.toLowerCase().trim();
    const words = input.split(/\s+/);
    const verb = words[0];
    const rest = words.slice(1).join(' ');

    state.moves++;

    const dirMap = {
      n: 'north', s: 'south', e: 'east', w: 'west',
      ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest',
      u: 'up', d: 'down'
    };

    if (dirMap[verb]) return doGo(dirMap[verb]);

    if (['go', 'move', 'walk', 'run', 'head', 'travel', 'climb', 'enter', 'exit'].includes(verb)) {
      return doGo(dirMap[rest] || rest || '');
    }
    if (['look', 'l'].includes(verb)) {
      if (!rest || rest === 'around' || rest === 'room') return doLook();
      return doExamine(rest);
    }
    if (['examine', 'inspect', 'search', 'x'].includes(verb)) return doExamine(rest || 'room');
    if (['inventory', 'i', 'inv'].includes(verb)) return doInventory();
    if (['take', 'get', 'grab', 'pick', 'collect'].includes(verb)) return doTake(rest.replace(/^up\s+/, '').replace(/^the\s+/, ''));
    if (['drop', 'leave', 'discard'].includes(verb)) return doDrop(rest.replace(/^the\s+/, ''));
    if (['talk', 'speak', 'ask', 'say', 'tell', 'chat', 'greet'].includes(verb)) return doTalk(rest);
    if (['use', 'place', 'put', 'insert', 'apply', 'give', 'show', 'repair', 'fix'].includes(verb)) return doUse(rest);
    if (['read'].includes(verb)) return doRead(rest);
    if (['open', 'unlock'].includes(verb)) return doUnlock(rest);
    if (['light', 'ignite'].includes(verb)) return doLight();
    if (['map'].includes(verb)) return doMap();
    if (['journal', 'journals', 'pages', 'notes'].includes(verb)) return doJournal();
    if (['help', 'commands', '?'].includes(verb)) return doHelp();
    if (['save'].includes(verb)) { save(); return out('Game saved.', '#888'); }
    if (['restart', 'reset', 'newgame'].includes(verb)) return doRestart();
    if (verb === 'yes' && state.flags.pendingRestart) {
      delete state.flags.pendingRestart;
      state = newGame(); save(); outputLines = [];
      out('Game restarted.', '#00ccff');
      return doLook();
    }
    if (['hint', 'hints'].includes(verb)) return doHint();
    if (['wait', 'z'].includes(verb)) return out('Time passes. The whispers continue.', '#cccccc');
    if (['listen'].includes(verb)) return doListen();
    if (['smell', 'sniff'].includes(verb)) return doSmell();
    if (['score', 'progress'].includes(verb)) return doScore();
    if (['xyzzy', 'plugh'].includes(verb)) return out('A hollow voice says "Fool."', '#ffcc00');

    const fullDirs = ['north','south','east','west','northeast','northwest','southeast','southwest',
      'up','down','in','out','left','right','back','front','across',
      'behind_waterfall','tower','cottage','workshop','storage','end'];
    if (fullDirs.includes(verb)) return doGo(verb);

    out('I don\'t understand "' + raw + '". Type \'help\'.', '#ff6666');
  }

  function out(text, color) { addOutput(text, color || '#00ff41'); }

  function matchItem(input, name) {
    const lower = name.toLowerCase();
    if (input.toLowerCase() === lower) return true;
    const words = input.toLowerCase().replace(/^the\s+/, '').split(/\s+/);
    const nameWords = lower.split(/\s+/);
    return words.some(w => nameWords.some(nw => nw.includes(w) || w.includes(nw)));
  }

  // ── Actions ──
  function doGo(direction) {
    if (!direction) return out('Go where?', '#ffcc00');
    const room = data.rooms[state.currentRoom];
    if (!room) return out('ERROR: Room not found.', '#ff0000');

    if (room.lockedExits && room.lockedExits[direction]) {
      const lockKey = state.currentRoom + ':' + direction;
      if (!state.unlockedExits[lockKey]) {
        const lock = room.lockedExits[direction];
        if (state.inventory.includes(lock.key)) {
          state.unlockedExits[lockKey] = true;
          out('You use the ' + data.items[lock.key].name + ' to unlock the way.', '#00ccff');
        } else {
          return out(lock.message, '#ffcc00');
        }
      }
    }

    const exits = room.exits || {};
    if (!exits[direction]) return out('You can\'t go that way.', '#ffcc00');
    const targetId = exits[direction];
    const target = data.rooms[targetId];

    if (room.requires && !state.flags['passed_' + state.currentRoom]) {
      if (!state.inventory.includes(room.requires.item)) return out(room.requires.message, '#ffcc00');
      state.flags['passed_' + state.currentRoom] = true;
    }
    if (target && target.requires && !state.flags['accessed_' + targetId]) {
      if (!state.inventory.includes(target.requires.item)) return out(target.requires.message, '#ffcc00');
      state.flags['accessed_' + targetId] = true;
    }

    state.currentRoom = targetId;
    if (!state.visitedRooms.includes(targetId)) state.visitedRooms.push(targetId);
    doLook();
  }

  function doLook() {
    const room = data.rooms[state.currentRoom];
    if (!room) return out('You are nowhere.', '#ff0000');
    out('', '#00ff41');
    out('-- ' + room.name + ' --', '#00ccff');
    out(room.description, '#cccccc');

    const roomItems = state.roomItems[state.currentRoom] || [];
    if (roomItems.length > 0) {
      const names = roomItems.map(id => data.items[id]?.name || id);
      out('You see: ' + names.join(', '), '#aaffaa');
    }

    if (room.npc) {
      const npc = data.npcs[room.npc];
      if (npc) {
        if (npc.requiresJournalPages && state.journalCount < npc.requiresJournalPages) {
          // hidden
        } else {
          out(npc.description, '#ffcc88');
        }
      }
    }

    const exits = Object.keys(room.exits || {});
    if (exits.length > 0) {
      const disp = exits.map(e => {
        const lk = state.currentRoom + ':' + e;
        if (room.lockedExits && room.lockedExits[e] && !state.unlockedExits[lk]) return e + ' (locked)';
        return e;
      });
      out('Exits: ' + disp.join(', '), '#888');
    }
  }

  function doExamine(target) {
    for (const id of state.inventory) {
      const item = data.items[id];
      if (item && matchItem(target, item.name)) return out(item.description, '#cccccc');
    }
    const ri = state.roomItems[state.currentRoom] || [];
    for (const id of ri) {
      const item = data.items[id];
      if (item && matchItem(target, item.name)) return out(item.description, '#cccccc');
    }
    const room = data.rooms[state.currentRoom];
    if (room.npc) {
      const npc = data.npcs[room.npc];
      if (npc && matchItem(target, npc.name)) return out(npc.description, '#ffcc88');
    }
    out('You don\'t see "' + target + '" here.', '#ffcc00');
  }

  function doTake(target) {
    if (!target) return out('Take what?', '#ffcc00');
    const ri = state.roomItems[state.currentRoom] || [];
    for (let i = 0; i < ri.length; i++) {
      const id = ri[i];
      const item = data.items[id];
      if (item && matchItem(target, item.name)) {
        if (item.portable === false) return out('You can\'t take that.', '#ffcc00');
        if (id === 'artifact') out('The whispers surge as you lift the artifact...', '#ff88ff');
        ri.splice(i, 1);
        state.inventory.push(id);
        if (item.type === 'journal') {
          state.journalCount = state.inventory.filter(i => data.items[i]?.type === 'journal').length;
          out('Taken: ' + item.name, '#aaffaa');
          return out('[Journal pages: ' + state.journalCount + '/10]', '#888');
        }
        return out('Taken: ' + item.name, '#aaffaa');
      }
    }
    out('You don\'t see "' + target + '" here.', '#ffcc00');
  }

  function doDrop(target) {
    if (!target) return out('Drop what?', '#ffcc00');
    for (let i = 0; i < state.inventory.length; i++) {
      const id = state.inventory[i];
      const item = data.items[id];
      if (item && matchItem(target, item.name)) {
        state.inventory.splice(i, 1);
        if (!state.roomItems[state.currentRoom]) state.roomItems[state.currentRoom] = [];
        state.roomItems[state.currentRoom].push(id);
        if (item.type === 'journal') {
          state.journalCount = state.inventory.filter(i => data.items[i]?.type === 'journal').length;
        }
        return out('Dropped: ' + item.name, '#aaffaa');
      }
    }
    out('You\'re not carrying that.', '#ffcc00');
  }

  function doInventory() {
    if (state.inventory.length === 0) return out('You are empty-handed.', '#cccccc');
    out('Carrying:', '#00ccff');
    for (const id of state.inventory) {
      out('  - ' + (data.items[id]?.name || id), '#aaffaa');
    }
  }

  function doTalk(target) {
    const room = data.rooms[state.currentRoom];
    if (!room.npc) return out('No one here to talk to.', '#ffcc00');
    const npc = data.npcs[room.npc];
    if (!npc) return out('No one here to talk to.', '#ffcc00');

    if (npc.requiresJournalPages && state.journalCount < npc.requiresJournalPages) {
      return out('The sanctum feels empty. Perhaps if you knew more of the story...', '#888');
    }

    const words = target.toLowerCase().replace(/^to\s+/, '').replace(/^with\s+/, '').split(/\s+/);
    const npcWords = npc.name.toLowerCase().split(/\s+/);
    const topicWords = words.filter(w => !npcWords.some(nw => nw === w));
    let topic = topicWords.join(' ').replace(/^about\s+/, '').replace(/^the\s+/, '').trim();

    state.npcMet[room.npc] = true;

    // Special trades
    if (room.npc === 'maya' && (topic === 'net' || topic === 'fishing net') && state.inventory.includes('fishing_net')) {
      state.inventory = state.inventory.filter(i => i !== 'fishing_net');
      state.flags.maya_trade = true;
      state.flags.waterfall_hint = true;
      return out(npc.dialogue.net, '#ffcc88');
    }
    if (room.npc === 'briggs' && topic === 'key' && !state.flags.briggs_key) {
      state.flags.briggs_key = true;
      out(npc.dialogue.key, '#ffcc88');
      return out('[Briggs told you about the brass key at the lighthouse top.]', '#888');
    }

    if (topic && npc.dialogue[topic]) return out(npc.dialogue[topic], '#ffcc88');
    for (const [key, text] of Object.entries(npc.dialogue)) {
      if (key === 'default') continue;
      if (topic.includes(key) || key.includes(topic)) return out(text, '#ffcc88');
    }

    out(npc.dialogue.default, '#ffcc88');
    const topics = Object.keys(npc.dialogue).filter(k => k !== 'default');
    out('[Ask about: ' + topics.join(', ') + ']', '#888');
  }

  function doUse(target) {
    if (!target) return out('Use what?', '#ffcc00');

    if (state.currentRoom === 'lighthouse_workshop' &&
        (target.includes('radio') || target.includes('tube') || target.includes('antenna') || target.includes('battery') || target.includes('repair') || target.includes('fix'))) {
      return doRepairRadio();
    }
    if (state.currentRoom === 'temple_sanctum' &&
        (target.includes('key') || target.includes('altar') || target.includes('place') || target.includes('silence'))) {
      return doUseAltar();
    }
    if (target.includes('lantern') || target.includes('light')) return doLight();
    if (state.currentRoom === 'research_lab' && target.includes('tablet') && state.inventory.includes('stone_tablet')) {
      state.flags.chen_decoded = true;
      return out(data.npcs.chen.dialogue.tablet, '#ffcc88');
    }
    if (state.currentRoom === 'cave_hermit' && target.includes('tablet') && state.inventory.includes('stone_tablet')) {
      state.flags.hermit_tablet = true;
      return out('The Hermit reads the tablet by touch. "They came from between the stars, not as conquerors but as gardeners. The artifact is a seed — a way to call them back. But we were not ready."', '#ffcc88');
    }
    if (target.includes('herb') && state.inventory.includes('dried_herbs')) {
      state.flags.herbs_burned = true;
      return out('You burn the herbs. The whispers recede. Your mind clears.', '#aaffaa');
    }
    if (target.includes('flare') && state.inventory.includes('flare_gun')) {
      if (state.flags.radio_repaired) {
        state.flags.flare_fired = true;
        return out('A brilliant red star arcs across the sky!', '#ff4444');
      }
      return out('Waste of a flare. Wait until you can signal someone.', '#ffcc00');
    }
    out('Not sure how to use that here.', '#ffcc00');
  }

  function doRepairRadio() {
    const has = state.inventory.includes('radio_tube') && state.inventory.includes('radio_antenna') && state.inventory.includes('radio_battery');
    if (!has) {
      const m = [];
      if (!state.inventory.includes('radio_tube')) m.push('vacuum tube');
      if (!state.inventory.includes('radio_antenna')) m.push('copper antenna');
      if (!state.inventory.includes('radio_battery')) m.push('heavy battery');
      return out('Briggs: "Still need: ' + m.join(', ') + '."', '#ffcc88');
    }
    state.inventory = state.inventory.filter(i => !['radio_tube','radio_antenna','radio_battery'].includes(i));
    state.flags.radio_repaired = true;
    out('You install the parts. The radio crackles to life!', '#aaffaa');
    out('Briggs: "It works! I can reach the mainland!"', '#ffcc88');
    if (state.flags.temple_keys_solved) {
      out('', '#00ff41');
      out(data.endings.silence_and_escape.text, '#00ff88');
      out('*** BEST ENDING ***', '#ffcc00');
    } else {
      out('', '#00ff41');
      out(data.endings.escape_only.text, '#ffcc88');
      out('*** ENDING: ESCAPE ***', '#ffcc00');
      out('[You can still silence the beacon for the best ending.]', '#888');
    }
  }

  function doUseAltar() {
    const has = state.inventory.includes('rusty_key') && state.inventory.includes('brass_key') && state.inventory.includes('crystal_key');
    if (!has) {
      const m = [];
      if (!state.inventory.includes('rusty_key')) m.push('wave/sea key');
      if (!state.inventory.includes('crystal_key')) m.push('mountain/earth key');
      if (!state.inventory.includes('brass_key')) m.push('star/sky key');
      return out('The altar has three keyholes. Still need: ' + m.join(', '), '#ffcc00');
    }
    state.inventory = state.inventory.filter(i => !['rusty_key','brass_key','crystal_key'].includes(i));
    state.flags.temple_keys_solved = true;
    out('Rusty key turns in the wave lock...', '#aaffaa');
    out('Crystal key slides into the mountain lock...', '#aaffaa');
    out('Brass key clicks into the star lock...', '#aaffaa');
    out('', '#00ff41');
    out('The altar blazes with light. A deep tone resonates through the entire island.', '#00ccff');
    out('And then... silence. True silence. The whispers stop.', '#ffffff');
    if (state.flags.radio_repaired) {
      out('', '#00ff41');
      out(data.endings.silence_and_escape.text, '#00ff88');
      out('*** BEST ENDING ***', '#ffcc00');
    } else {
      out('', '#00ff41');
      out(data.endings.silence_only.text, '#ffcc88');
      out('*** ENDING: SILENCE ***', '#ffcc00');
      out('[Repair the lighthouse radio to also escape.]', '#888');
    }
  }

  function doLight() {
    if (state.inventory.includes('lantern')) {
      state.flags.lantern_lit = true;
      return out('You light the lantern. Warm glow pushes back darkness.', '#ffcc88');
    }
    out('You have nothing to light.', '#ffcc00');
  }

  function doUnlock() {
    const room = data.rooms[state.currentRoom];
    if (!room.lockedExits) return out('Nothing to unlock here.', '#ffcc00');
    for (const [dir, lock] of Object.entries(room.lockedExits)) {
      const lk = state.currentRoom + ':' + dir;
      if (state.unlockedExits[lk]) continue;
      if (state.inventory.includes(lock.key)) {
        state.unlockedExits[lk] = true;
        return out('Unlocked with ' + data.items[lock.key].name + '. Click!', '#aaffaa');
      }
      return out(lock.message + ' You lack the key.', '#ffcc00');
    }
    out('Nothing locked here.', '#ffcc00');
  }

  function doRead(target) {
    for (const id of state.inventory) {
      const item = data.items[id];
      if (item && matchItem(target, item.name)) return out(item.description, '#cccccc');
    }
    const ri = state.roomItems[state.currentRoom] || [];
    for (const id of ri) {
      const item = data.items[id];
      if (item && matchItem(target, item.name)) return out(item.description, '#cccccc');
    }
    out('Nothing like that to read.', '#ffcc00');
  }

  function doMap() {
    const maps = state.inventory.filter(id => data.items[id]?.type === 'map');
    if (!maps.length) return out('You have no map fragments.', '#ffcc00');
    out('-- Island Map --', '#00ccff');
    if (maps.includes('map_fragment_3')) {
      out('  [Summit]', '#888');
      out('     |', '#888');
      out('  [Mountain]---[Temple Ruins]', '#888');
      out('     |', '#888');
    }
    if (maps.includes('map_fragment_2')) {
      out('  [Marsh]---[Caves]', '#888');
      out('     |', '#888');
      out('  [Jungle]---[Village]---[Research]', '#888');
      out('     |', '#888');
    }
    if (maps.includes('map_fragment_1')) {
      out('  [Lighthouse]', '#888');
      out('     |', '#888');
      out('  [Coast]---[Beach]---[Cove]', '#888');
      out('               |', '#888');
      out('          [Shore]---[Tidepools]', '#888');
    }
    out('Fragments: ' + maps.length + '/3  Rooms: ' + state.visitedRooms.length, '#888');
  }

  function doJournal() {
    const j = state.inventory.filter(id => data.items[id]?.type === 'journal')
      .sort((a, b) => (data.items[a].number || 0) - (data.items[b].number || 0));
    if (!j.length) return out('No journal pages found yet.', '#ffcc00');
    out('-- Dr. Voss\'s Journal [' + j.length + '/10] --', '#00ccff');
    for (const id of j) out(data.items[id].description, '#cccccc');
  }

  function doHelp() {
    out('-- Commands --', '#00ccff');
    out('MOVE: n/s/e/w/u/d, in, out, go <dir>', '#cccccc');
    out('LOOK: look, examine <thing>', '#cccccc');
    out('ITEMS: take/drop <item>, inventory (i)', '#cccccc');
    out('USE: use <item>, open/unlock, light', '#cccccc');
    out('TALK: talk <person> about <topic>', '#cccccc');
    out('INFO: map, journal, score, hint, help', '#cccccc');
    out('OTHER: listen, smell, read, wait', '#cccccc');
    out('SYS: save, restart', '#cccccc');
    out('SCROLL: PageUp/PageDown', '#cccccc');
    out('EXIT: ~ or Escape to return to ZZTT', '#cccccc');
  }

  function doRestart() {
    state.flags.pendingRestart = true;
    out('Restart? All progress lost. Type "yes".', '#ff6666');
  }

  function doHint() {
    const inv = state.inventory;
    const flags = state.flags;
    const hints = [];
    if (inv.length === 0 && state.moves < 10) hints.push('Explore! Pick up items. Head north.');
    if (!inv.includes('lantern')) hints.push('Find a light in the sea cave (east of shore).');
    if (!inv.includes('rusty_key') && !flags.temple_keys_solved) hints.push('Check the tidepools for a key.');
    if (!Object.keys(state.npcMet).length) hints.push('Find Old Maro at the village dock.');
    if (inv.includes('rusty_key') && !state.unlockedExits['village_store:back']) hints.push('Use rusty key at the village store.');
    if (!flags.radio_repaired) {
      if (!inv.includes('radio_tube')) hints.push('Vacuum tube: research lab annex.');
      if (!inv.includes('radio_antenna')) hints.push('Antenna: village store back room.');
      if (!inv.includes('radio_battery')) hints.push('Battery: research storage.');
    }
    if (!flags.temple_keys_solved) {
      if (!inv.includes('brass_key')) hints.push('Ask Briggs about "key". Check lighthouse top.');
      if (!inv.includes('crystal_key')) hints.push('Crystal key: Crystal Grotto past the underground lake. Need rope.');
    }
    if (!hints.length) hints.push('Keep exploring and talking to everyone!');
    out('-- Hint --', '#ffcc00');
    out(hints[Math.floor(Math.random() * hints.length)], '#ffcc88');
  }

  function doListen() {
    const zone = data.rooms[state.currentRoom]?.zone;
    const msgs = {
      beach: 'Waves crash. Beneath it all... faint whispers.',
      jungle: 'Insects, birds, wind. And underneath — the whispers.',
      village: 'Eerie quiet. Creaking wood. Faint whispers from inland.',
      research: 'Generator hum. Equipment clicks. Whispers pulse with the machines.',
      marsh: 'Dripping water. Bubbles. The whispers are louder here.',
      caves: 'Whispers echo and multiply into an eerie chord.',
      mountain: 'Wind howls. Whispers rise distorted from below.',
      lighthouse: 'Lamp mechanism sweeps. Gulls cry. Whispers are fainter here.',
      ruins: 'Whispers loudest here — urgent, almost comprehensible.'
    };
    out(msgs[zone] || 'The whispers are always there.', '#cccccc');
  }

  function doSmell() {
    const zone = data.rooms[state.currentRoom]?.zone;
    const msgs = {
      beach: 'Salt and seaweed.', jungle: 'Rich earth and flowers.',
      village: 'Dust and old wood.', research: 'Chemicals and ozone.',
      marsh: 'Sulfur and decay.', caves: 'Wet stone and metal.',
      mountain: 'Clean air and wildflowers.', lighthouse: 'Lamp oil and pipe tobacco.',
      ruins: 'Ancient dust and ozone.'
    };
    out(msgs[zone] || 'Nothing remarkable.', '#cccccc');
  }

  function doScore() {
    const jc = state.inventory.filter(id => data.items[id]?.type === 'journal').length;
    const mc = state.inventory.filter(id => data.items[id]?.type === 'map').length;
    const nc = Object.keys(state.npcMet).length;
    out('-- Progress --', '#00ccff');
    out('Moves: ' + state.moves + '  Rooms: ' + state.visitedRooms.length + '/' + Object.keys(data.rooms).length, '#cccccc');
    out('Journal: ' + jc + '/10  Maps: ' + mc + '/3  NPCs: ' + nc + '/6', '#cccccc');
    out('Radio: ' + (state.flags.radio_repaired ? 'Yes' : 'No') + '  Beacon: ' + (state.flags.temple_keys_solved ? 'Silent' : 'Active'), '#cccccc');
    const score = jc * 5 + mc * 3 + nc * 5 + state.visitedRooms.length +
      (state.flags.radio_repaired ? 20 : 0) + (state.flags.temple_keys_solved ? 20 : 0);
    out('Score: ' + score, '#ffcc00');
  }

  // ── Return provider interface ──
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
      clearInterval(blinkTimer);
      clearInterval(refreshTimer);
      document.removeEventListener('keydown', onKeyDown);
    }
  };
}
