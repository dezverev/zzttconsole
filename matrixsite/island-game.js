// The Whispering Isle — A Zork-like text adventure engine
// Game state is persisted to localStorage so the player resumes where they left off.

const SAVE_KEY = 'whisperingIsle_save';

// Island data is set by island-data-inline.js (loaded before this script) as window.ISLAND_DATA

class WhisperingIsle {
  constructor(container) {
    this.container = container;
    this.data = null;
    this.state = null;
    this.outputEl = null;
    this.inputEl = null;
    this.commandHistory = [];
    this.historyIndex = -1;
    this.init();
  }

  async init() {
    this.buildUI();
    await this.loadData();
    this.loadState();
    this.printTitle();
    this.look();
    this.inputEl.focus();
  }

  buildUI() {
    this.container.innerHTML = '';
    this.container.style.cssText = `
      background: transparent; color: #00ff41; font-family: 'Courier New', monospace;
      font-size: 14px; line-height: 1.6; height: 100vh; display: flex; flex-direction: column;
      padding: 0; margin: 0; overflow: hidden;
    `;

    this.outputEl = document.createElement('div');
    this.outputEl.id = 'game-output';
    this.outputEl.style.cssText = `
      flex: 1; overflow-y: auto; padding: 20px; white-space: pre-wrap; word-wrap: break-word;
    `;

    const inputRow = document.createElement('div');
    inputRow.style.cssText = `
      display: flex; align-items: center; padding: 10px 20px; border-top: 1px solid #003300;
      background: rgba(5, 5, 5, 0.7);
    `;

    const prompt = document.createElement('span');
    prompt.textContent = '> ';
    prompt.style.color = '#00ff41';

    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.id = 'game-input';
    this.inputEl.autocomplete = 'off';
    this.inputEl.style.cssText = `
      flex: 1; background: transparent; border: none; outline: none;
      color: #00ff41; font-family: 'Courier New', monospace; font-size: 14px;
      caret-color: #00ff41;
    `;

    this.inputEl.addEventListener('keydown', (e) => this.handleKey(e));

    inputRow.appendChild(prompt);
    inputRow.appendChild(this.inputEl);
    this.container.appendChild(this.outputEl);
    this.container.appendChild(inputRow);
  }

  async loadData() {
    this.data = window.ISLAND_DATA;
  }

  loadState() {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        this.state = JSON.parse(saved);
        // Ensure state has all required fields (migration for older saves)
        this.state.flags = this.state.flags || {};
        this.state.journalCount = this.state.journalCount || 0;
        this.state.npcMet = this.state.npcMet || {};
        this.state.unlockedExits = this.state.unlockedExits || {};
        this.state.roomItems = this.state.roomItems || this.buildRoomItems();
        this.state.moves = this.state.moves || 0;
      } catch {
        this.state = null;
      }
    }
    if (!this.state) {
      this.state = this.newGame();
    }
  }

  newGame() {
    return {
      currentRoom: this.data.meta.startRoom,
      inventory: [],
      flags: {},
      journalCount: 0,
      npcMet: {},
      unlockedExits: {},
      roomItems: this.buildRoomItems(),
      moves: 0,
      visitedRooms: [this.data.meta.startRoom]
    };
  }

  buildRoomItems() {
    const ri = {};
    for (const [id, room] of Object.entries(this.data.rooms)) {
      ri[id] = [...(room.items || [])];
    }
    return ri;
  }

  save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
  }

  // --- Output ---
  print(text, color) {
    const span = document.createElement('span');
    span.style.color = color || '#00ff41';
    span.textContent = text + '\n';
    this.outputEl.appendChild(span);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  printStyled(text, color) {
    const span = document.createElement('span');
    span.style.color = color || '#00ff41';
    span.style.fontStyle = 'italic';
    span.textContent = text + '\n';
    this.outputEl.appendChild(span);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  printTitle() {
    const art = `
╔══════════════════════════════════════════════════╗
║                                                  ║
║          T H E   W H I S P E R I N G             ║
║                   I S L E                        ║
║                                                  ║
║     A Text Adventure Mystery                     ║
║                                                  ║
║     Type 'help' for a list of commands.          ║
║                                                  ║
╚══════════════════════════════════════════════════╝
`;
    this.print(art, '#00ccff');
    if (this.state.moves > 0) {
      this.print(`[Restored save — Move ${this.state.moves}, ${this.state.visitedRooms.length} rooms visited]\n`, '#888');
    } else {
      this.printStyled('You awaken face-down in cold surf, coughing saltwater. Splintered wood and torn canvas float around you — the remnants of your vessel. A storm... you remember a storm, and then nothing. You drag yourself onto the rocks, shivering and disoriented. You are alive. But where are you?\n', '#cccccc');
    }
  }

  // --- Input ---
  handleKey(e) {
    if (e.key === 'Enter') {
      const cmd = this.inputEl.value.trim();
      if (cmd) {
        this.commandHistory.unshift(cmd);
        this.historyIndex = -1;
        this.print('\n> ' + cmd, '#888');
        this.processCommand(cmd);
        this.save();
      }
      this.inputEl.value = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.inputEl.value = this.commandHistory[this.historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.inputEl.value = this.commandHistory[this.historyIndex];
      } else {
        this.historyIndex = -1;
        this.inputEl.value = '';
      }
    }
  }

  // --- Command Processing ---
  processCommand(raw) {
    const input = raw.toLowerCase().trim();
    const words = input.split(/\s+/);
    const verb = words[0];
    const rest = words.slice(1).join(' ');

    this.state.moves++;

    // Direction shortcuts
    const dirMap = {
      n: 'north', s: 'south', e: 'east', w: 'west',
      ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest',
      u: 'up', d: 'down'
    };

    if (dirMap[verb]) return this.go(dirMap[verb]);

    // Movement
    if (['go', 'move', 'walk', 'run', 'head', 'travel', 'climb', 'enter', 'exit'].includes(verb)) {
      const dir = rest || '';
      return this.go(dirMap[dir] || dir);
    }

    // Look
    if (['look', 'l', 'examine', 'inspect', 'search'].includes(verb)) {
      if (!rest || rest === 'around' || rest === 'room') return this.look();
      return this.examine(rest);
    }

    // Inventory
    if (['inventory', 'i', 'inv'].includes(verb)) return this.showInventory();

    // Take / Get
    if (['take', 'get', 'grab', 'pick', 'collect'].includes(verb)) {
      const target = rest.replace(/^up\s+/, '').replace(/^the\s+/, '');
      return this.take(target);
    }

    // Drop
    if (['drop', 'leave', 'discard'].includes(verb)) {
      return this.drop(rest.replace(/^the\s+/, ''));
    }

    // Talk / Ask
    if (['talk', 'speak', 'ask', 'say', 'tell', 'chat', 'greet'].includes(verb)) {
      return this.talk(rest);
    }

    // Use / Place
    if (['use', 'place', 'put', 'insert', 'apply', 'give', 'show', 'repair', 'fix'].includes(verb)) {
      return this.use(rest);
    }

    // Read
    if (['read'].includes(verb)) {
      return this.read(rest);
    }

    // Open / Unlock
    if (['open', 'unlock'].includes(verb)) {
      return this.unlock(rest);
    }

    // Light
    if (['light', 'ignite'].includes(verb)) {
      return this.lightLantern();
    }

    // Map
    if (['map'].includes(verb)) return this.showMap();

    // Journal
    if (['journal', 'journals', 'pages', 'notes'].includes(verb)) return this.showJournal();

    // Help
    if (['help', 'commands', '?'].includes(verb)) return this.showHelp();

    // Save is automatic, but confirm
    if (['save'].includes(verb)) {
      this.save();
      return this.print('Game saved.', '#888');
    }

    // Restart
    if (['restart', 'reset', 'newgame'].includes(verb)) {
      return this.confirmRestart();
    }
    if (verb === 'yes' && this.state.flags.pendingRestart) {
      delete this.state.flags.pendingRestart;
      this.state = this.newGame();
      this.save();
      this.outputEl.innerHTML = '';
      this.printTitle();
      return this.look();
    }

    // Hint
    if (['hint', 'hints'].includes(verb)) return this.showHint();

    // Wait
    if (['wait', 'z'].includes(verb)) {
      return this.print('Time passes. The whispers continue their ceaseless murmur.', '#cccccc');
    }

    // Listen
    if (['listen'].includes(verb)) return this.listen();

    // Smell
    if (['smell', 'sniff'].includes(verb)) return this.smell();

    // Score
    if (['score', 'progress'].includes(verb)) return this.showScore();

    // Xyzzy
    if (['xyzzy', 'plugh'].includes(verb)) {
      return this.print('A hollow voice says "Fool."', '#ffcc00');
    }

    // Directions as full words
    const fullDirs = ['north', 'south', 'east', 'west', 'northeast', 'northwest',
      'southeast', 'southwest', 'up', 'down', 'in', 'out',
      'left', 'right', 'back', 'front', 'across',
      'behind_waterfall', 'tower', 'cottage', 'workshop', 'storage', 'end'];
    if (fullDirs.includes(verb)) return this.go(verb);

    this.print(`I don't understand "${raw}". Type 'help' for available commands.`, '#ff6666');
  }

  // --- Actions ---
  go(direction) {
    if (!direction) {
      return this.print('Go where? Specify a direction.', '#ffcc00');
    }

    const room = this.data.rooms[this.state.currentRoom];
    if (!room) return this.print('ERROR: Room not found.', '#ff0000');

    // Check locked exits
    if (room.lockedExits && room.lockedExits[direction]) {
      const lockKey = this.state.currentRoom + ':' + direction;
      if (!this.state.unlockedExits[lockKey]) {
        const lock = room.lockedExits[direction];
        if (this.state.inventory.includes(lock.key)) {
          this.state.unlockedExits[lockKey] = true;
          const keyItem = this.data.items[lock.key];
          this.print(`You use the ${keyItem.name} to unlock the way. It swings open with a groan.`, '#00ccff');
        } else {
          return this.print(lock.message, '#ffcc00');
        }
      }
    }

    const exits = room.exits || {};
    if (!exits[direction]) {
      return this.print('You can\'t go that way.', '#ffcc00');
    }

    const targetRoom = exits[direction];
    const target = this.data.rooms[targetRoom];

    // Check requires
    if (target && this.data.rooms[targetRoom].requires) {
      // Check the requirement on the SOURCE side (jungle_marsh_edge checks before entering marsh)
    }
    if (room.requires && direction === Object.keys(room.exits).find(k => room.exits[k] === targetRoom)) {
      // Nope — requirements are on the room you're entering
    }

    // Actually check target room requirements via the source room definition
    const sourceRoom = this.data.rooms[this.state.currentRoom];
    if (sourceRoom.requires && exits[direction]) {
      // The requires on marsh_edge blocks going north
      // Check: does the current room have a requires that blocks this exit?
    }

    // Check requires on the entry point
    if (this.data.rooms[targetRoom] && this.data.rooms[targetRoom].requires) {
      const req = this.data.rooms[targetRoom].requires;
      // Only block if coming from specific direction (check if source has the requires)
    }

    // Simpler: check requires on the room we're LEAVING if it has one
    if (room.requires && !this.state.flags['passed_' + this.state.currentRoom]) {
      const req = room.requires;
      if (!this.state.inventory.includes(req.item)) {
        return this.print(req.message, '#ffcc00');
      }
      this.state.flags['passed_' + this.state.currentRoom] = true;
    }

    // Check requires on target room
    if (target && target.requires && !this.state.flags['accessed_' + targetRoom]) {
      const req = target.requires;
      if (!this.state.inventory.includes(req.item)) {
        return this.print(req.message, '#ffcc00');
      }
      this.state.flags['accessed_' + targetRoom] = true;
    }

    this.state.currentRoom = targetRoom;
    if (!this.state.visitedRooms.includes(targetRoom)) {
      this.state.visitedRooms.push(targetRoom);
    }
    this.look();
  }

  look() {
    const room = this.data.rooms[this.state.currentRoom];
    if (!room) return this.print('You are nowhere. This is a bug.', '#ff0000');

    this.print(`\n—— ${room.name} ——`, '#00ccff');
    this.print(room.description, '#cccccc');

    if (room.special && typeof room.special === 'string' && room.special !== 'radio_repair_location' && room.special !== 'endgame_altar') {
      this.printStyled(room.special, '#ffcc00');
    }

    // Show items in room
    const roomItems = this.state.roomItems[this.state.currentRoom] || [];
    if (roomItems.length > 0) {
      const itemNames = roomItems.map(id => this.data.items[id]?.name || id);
      this.print('\nYou can see: ' + itemNames.join(', '), '#aaffaa');
    }

    // Show NPC
    if (room.npc) {
      const npc = this.data.npcs[room.npc];
      if (npc) {
        // Check visibility (ghost requires journal pages)
        if (npc.requiresJournalPages && this.state.journalCount < npc.requiresJournalPages) {
          // Ghost not visible yet
        } else {
          this.print('\n' + npc.description, '#ffcc88');
        }
      }
    }

    // Show exits
    const exits = Object.keys(room.exits || {});
    if (exits.length > 0) {
      const exitDisplay = exits.map(e => {
        const lockKey = this.state.currentRoom + ':' + e;
        if (room.lockedExits && room.lockedExits[e] && !this.state.unlockedExits[lockKey]) {
          return e + ' (locked)';
        }
        return e;
      });
      this.print('\nExits: ' + exitDisplay.join(', '), '#888');
    }
  }

  examine(target) {
    // Check inventory items
    for (const id of this.state.inventory) {
      const item = this.data.items[id];
      if (item && this.matchItem(target, item.name)) {
        return this.print(item.description, '#cccccc');
      }
    }
    // Check room items
    const roomItems = this.state.roomItems[this.state.currentRoom] || [];
    for (const id of roomItems) {
      const item = this.data.items[id];
      if (item && this.matchItem(target, item.name)) {
        return this.print(item.description, '#cccccc');
      }
    }
    // Check NPC
    const room = this.data.rooms[this.state.currentRoom];
    if (room.npc) {
      const npc = this.data.npcs[room.npc];
      if (npc && this.matchItem(target, npc.name)) {
        return this.print(npc.description, '#ffcc88');
      }
    }
    this.print(`You don't see "${target}" here.`, '#ffcc00');
  }

  matchItem(input, name) {
    const lower = name.toLowerCase();
    const words = input.toLowerCase().replace(/^the\s+/, '').split(/\s+/);
    // Exact match
    if (input.toLowerCase() === lower) return true;
    // Partial: any word in input matches any word in name
    const nameWords = lower.split(/\s+/);
    return words.some(w => nameWords.some(nw => nw.includes(w) || w.includes(nw)));
  }

  take(target) {
    if (!target) return this.print('Take what?', '#ffcc00');

    const roomItems = this.state.roomItems[this.state.currentRoom] || [];
    for (let i = 0; i < roomItems.length; i++) {
      const id = roomItems[i];
      const item = this.data.items[id];
      if (item && this.matchItem(target, item.name)) {
        if (item.portable === false) {
          return this.print(`You can't take the ${item.name}.`, '#ffcc00');
        }

        // Special case: artifact
        if (id === 'artifact') {
          this.print('You carefully lift the artifact from its pedestal. The whispers surge to a crescendo, then settle into a new pattern — as if acknowledging a change in custody. The chamber dims noticeably.', '#ff88ff');
        }

        roomItems.splice(i, 1);
        this.state.inventory.push(id);

        // Track journal pages
        if (item.type === 'journal') {
          this.state.journalCount = this.state.inventory.filter(
            iid => this.data.items[iid]?.type === 'journal'
          ).length;
          this.print(`Taken: ${item.name}`, '#aaffaa');
          this.print(`[Journal pages collected: ${this.state.journalCount}/10]`, '#888');
          return;
        }

        return this.print(`Taken: ${item.name}`, '#aaffaa');
      }
    }
    this.print(`You don't see "${target}" here to take.`, '#ffcc00');
  }

  drop(target) {
    if (!target) return this.print('Drop what?', '#ffcc00');

    for (let i = 0; i < this.state.inventory.length; i++) {
      const id = this.state.inventory[i];
      const item = this.data.items[id];
      if (item && this.matchItem(target, item.name)) {
        this.state.inventory.splice(i, 1);
        if (!this.state.roomItems[this.state.currentRoom]) {
          this.state.roomItems[this.state.currentRoom] = [];
        }
        this.state.roomItems[this.state.currentRoom].push(id);

        if (item.type === 'journal') {
          this.state.journalCount = this.state.inventory.filter(
            iid => this.data.items[iid]?.type === 'journal'
          ).length;
        }

        return this.print(`Dropped: ${item.name}`, '#aaffaa');
      }
    }
    this.print(`You're not carrying "${target}".`, '#ffcc00');
  }

  showInventory() {
    if (this.state.inventory.length === 0) {
      return this.print('You are empty-handed.', '#cccccc');
    }
    this.print('You are carrying:', '#00ccff');
    for (const id of this.state.inventory) {
      const item = this.data.items[id];
      this.print('  - ' + (item ? item.name : id), '#aaffaa');
    }
  }

  talk(target) {
    const room = this.data.rooms[this.state.currentRoom];
    if (!room.npc) {
      return this.print('There\'s no one here to talk to.', '#ffcc00');
    }

    const npc = this.data.npcs[room.npc];
    if (!npc) return this.print('There\'s no one here to talk to.', '#ffcc00');

    // Check ghost visibility
    if (npc.requiresJournalPages && this.state.journalCount < npc.requiresJournalPages) {
      return this.print('The sanctum is empty. Perhaps if you knew more of the story, you might see what others cannot...', '#888');
    }

    // Parse topic from input
    const words = target.toLowerCase().replace(/^to\s+/, '').replace(/^with\s+/, '').split(/\s+/);
    // Remove NPC name words to get topic
    const npcNameWords = npc.name.toLowerCase().split(/\s+/);
    const topicWords = words.filter(w => !npcNameWords.some(nw => nw === w));
    let topic = topicWords.join(' ').replace(/^about\s+/, '').replace(/^the\s+/, '').trim();

    // Mark as met
    if (!this.state.npcMet[room.npc]) {
      this.state.npcMet[room.npc] = true;
    }

    // Special trades
    if (room.npc === 'maya' && (topic === 'net' || topic === 'fishing net')) {
      if (this.state.inventory.includes('fishing_net')) {
        // Remove net from inventory
        this.state.inventory = this.state.inventory.filter(i => i !== 'fishing_net');
        this.state.flags.maya_trade = true;
        this.state.flags.waterfall_hint = true;
        return this.print(npc.dialogue.net, '#ffcc88');
      }
    }

    if (room.npc === 'briggs' && topic === 'key') {
      if (!this.state.flags.briggs_key) {
        this.state.flags.briggs_key = true;
        this.print(npc.dialogue.key, '#ffcc88');
        this.print('\n[Captain Briggs told you about the brass key at the top of the lighthouse.]', '#888');
        return;
      }
    }

    // Find matching dialogue
    if (topic && npc.dialogue[topic]) {
      return this.print(npc.dialogue[topic], '#ffcc88');
    }

    // Try partial match
    for (const [key, text] of Object.entries(npc.dialogue)) {
      if (key === 'default') continue;
      if (topic.includes(key) || key.includes(topic)) {
        return this.print(text, '#ffcc88');
      }
    }

    // Default dialogue
    this.print(npc.dialogue.default, '#ffcc88');
    const topics = Object.keys(npc.dialogue).filter(k => k !== 'default');
    this.print(`\n[You can ask about: ${topics.join(', ')}]`, '#888');
  }

  use(target) {
    if (!target) return this.print('Use what?', '#ffcc00');

    const room = this.data.rooms[this.state.currentRoom];

    // Radio repair
    if (this.state.currentRoom === 'lighthouse_workshop' &&
        (target.includes('radio') || target.includes('tube') || target.includes('antenna') || target.includes('battery') || target.includes('repair') || target.includes('fix'))) {
      return this.repairRadio();
    }

    // Temple altar / keys
    if (this.state.currentRoom === 'temple_sanctum' &&
        (target.includes('key') || target.includes('altar') || target.includes('place') || target.includes('silence'))) {
      return this.useAltar();
    }

    // Light lantern
    if (target.includes('lantern') || target.includes('light')) {
      return this.lightLantern();
    }

    // Show tablet to Chen
    if (this.state.currentRoom === 'research_lab' && target.includes('tablet')) {
      if (this.state.inventory.includes('stone_tablet')) {
        this.state.flags.chen_decoded = true;
        const npc = this.data.npcs.chen;
        return this.print(npc.dialogue.tablet, '#ffcc88');
      }
    }

    // Show tablet to Hermit
    if (this.state.currentRoom === 'cave_hermit' && target.includes('tablet')) {
      if (this.state.inventory.includes('stone_tablet')) {
        this.state.flags.hermit_tablet = true;
        return this.print('The Hermit runs their fingers over the tablet\'s surface, reading by touch. "Yes... this tells the true history. They came from between the stars, not as conquerors but as gardeners. They planted seeds of knowledge across many worlds. The artifact is one such seed — a way to call them back when the garden was ready. But we were not ready. We are still not ready."', '#ffcc88');
      }
    }

    // Burn herbs
    if (target.includes('herb')) {
      if (this.state.inventory.includes('dried_herbs')) {
        this.state.flags.herbs_burned = true;
        return this.print('You light the dried herbs. Fragrant smoke curls upward, and the whispers recede to a distant murmur. Your mind feels clearer.', '#aaffaa');
      }
    }

    // Flare gun
    if (target.includes('flare')) {
      if (this.state.inventory.includes('flare_gun')) {
        if (this.state.flags.radio_repaired) {
          this.state.flags.flare_fired = true;
          return this.print('You fire the flare gun skyward. A brilliant red star arcs across the sky, illuminating the island in crimson light. Combined with the radio signal, rescue is certain now.', '#ff4444');
        }
        return this.print('Firing the flare now would waste it. You should wait until you have a way to communicate with rescuers.', '#ffcc00');
      }
    }

    this.print(`You're not sure how to use that here.`, '#ffcc00');
  }

  repairRadio() {
    const hasAll = this.state.inventory.includes('radio_tube') &&
                   this.state.inventory.includes('radio_antenna') &&
                   this.state.inventory.includes('radio_battery');

    if (hasAll) {
      this.state.inventory = this.state.inventory.filter(
        i => !['radio_tube', 'radio_antenna', 'radio_battery'].includes(i)
      );
      this.state.flags.radio_repaired = true;

      this.print('You carefully install the vacuum tube, connect the copper antenna, and hook up the battery. Captain Briggs watches with growing excitement.', '#aaffaa');
      this.print('\nThe radio crackles... hisses... and then, gloriously, a carrier signal. Briggs grabs the microphone with shaking hands.', '#00ccff');
      this.print('\n"It works! By God, it works! I can reach the mainland!"', '#ffcc88');

      if (this.state.flags.temple_keys_solved) {
        this.print('\n' + this.data.endings.silence_and_escape.text, '#00ff88');
        this.print('\n*** CONGRATULATIONS — THE BEST ENDING ***', '#ffcc00');
      } else {
        this.print('\n' + this.data.endings.escape_only.text, '#ffcc88');
        this.print('\n*** ENDING ACHIEVED: ESCAPE (but the beacon still whispers...) ***', '#ffcc00');
        this.print('[Hint: You can still silence the beacon for the best ending. Place the three keys in the temple altar.]', '#888');
      }
      return;
    }

    const missing = [];
    if (!this.state.inventory.includes('radio_tube')) missing.push('vacuum tube');
    if (!this.state.inventory.includes('radio_antenna')) missing.push('copper antenna');
    if (!this.state.inventory.includes('radio_battery')) missing.push('heavy battery');

    this.print(`Captain Briggs examines what you have. "Not enough yet. I still need: ${missing.join(', ')}."`, '#ffcc88');
  }

  useAltar() {
    const hasAll = this.state.inventory.includes('rusty_key') &&
                   this.state.inventory.includes('brass_key') &&
                   this.state.inventory.includes('crystal_key');

    if (!hasAll) {
      const missing = [];
      if (!this.state.inventory.includes('rusty_key')) missing.push('a key for the wave symbol (sea)');
      if (!this.state.inventory.includes('crystal_key')) missing.push('a key for the mountain symbol (earth)');
      if (!this.state.inventory.includes('brass_key')) missing.push('a key for the star symbol (sky)');
      return this.print(`The altar has three keyholes. You still need: ${missing.join(', ')}.`, '#ffcc00');
    }

    this.state.inventory = this.state.inventory.filter(
      i => !['rusty_key', 'brass_key', 'crystal_key'].includes(i)
    );
    this.state.flags.temple_keys_solved = true;

    this.print('You place the rusty key in the wave lock. It turns with a grinding sound.', '#aaffaa');
    this.print('You place the crystal key in the mountain lock. It slides in smoothly, glowing brighter.', '#aaffaa');
    this.print('You place the brass key in the star lock. It clicks into place.', '#aaffaa');
    this.print('\nThe altar vibrates. The three-circle symbol blazes with light. A deep tone — felt more than heard — reverberates through the temple, through the mountain, through the entire island.', '#00ccff');
    this.print('\nAnd then... silence. True silence. The whispers that have been your constant companion since arriving on this island... stop.', '#ffffff');

    if (this.state.flags.radio_repaired) {
      this.print('\n' + this.data.endings.silence_and_escape.text, '#00ff88');
      this.print('\n*** CONGRATULATIONS — THE BEST ENDING ***', '#ffcc00');
    } else {
      this.print('\n' + this.data.endings.silence_only.text, '#ffcc88');
      this.print('\n*** ENDING ACHIEVED: SILENCE (but you\'re still stranded...) ***', '#ffcc00');
      this.print('[Hint: Repair the radio at the lighthouse to also escape the island for the best ending.]', '#888');
    }
  }

  lightLantern() {
    if (this.state.inventory.includes('lantern')) {
      this.state.flags.lantern_lit = true;
      return this.print('You light the oil lantern. A warm glow pushes back the darkness.', '#ffcc88');
    }
    this.print('You don\'t have anything to light.', '#ffcc00');
  }

  unlock(target) {
    const room = this.data.rooms[this.state.currentRoom];
    if (!room.lockedExits) {
      return this.print('There\'s nothing to unlock here.', '#ffcc00');
    }

    for (const [dir, lock] of Object.entries(room.lockedExits)) {
      const lockKey = this.state.currentRoom + ':' + dir;
      if (this.state.unlockedExits[lockKey]) continue;
      if (this.state.inventory.includes(lock.key)) {
        this.state.unlockedExits[lockKey] = true;
        const keyItem = this.data.items[lock.key];
        return this.print(`You use the ${keyItem.name} to unlock the way. Click! It opens.`, '#aaffaa');
      }
      return this.print(lock.message + ' You don\'t have the right key.', '#ffcc00');
    }
    this.print('There\'s nothing locked here (that you can see).', '#ffcc00');
  }

  read(target) {
    // Check inventory for readable items
    for (const id of this.state.inventory) {
      const item = this.data.items[id];
      if (item && this.matchItem(target, item.name)) {
        return this.print(item.description, '#cccccc');
      }
    }
    // Check room items
    const roomItems = this.state.roomItems[this.state.currentRoom] || [];
    for (const id of roomItems) {
      const item = this.data.items[id];
      if (item && this.matchItem(target, item.name)) {
        return this.print(item.description, '#cccccc');
      }
    }
    this.print('There\'s nothing like that to read.', '#ffcc00');
  }

  listen() {
    const room = this.data.rooms[this.state.currentRoom];
    const zone = room.zone;
    const msgs = {
      beach: 'Waves crash against the rocks. Sea birds cry overhead. Beneath it all, if you listen carefully... a faint murmur, like distant voices.',
      jungle: 'The jungle hums with insect song and bird calls. Wind rustles the canopy. And underneath — always underneath — the whispers. Formless. Persistent.',
      village: 'The village is unnervingly quiet. No voices, no footsteps. Just the creak of old wood and, faintly, the omnipresent whispers drifting from somewhere inland.',
      research: 'The hum of the generator provides a mechanical backdrop. Equipment clicks and whirs. The whispers here seem to pulse in time with the machines.',
      marsh: 'Water drips. Bubbles pop in the muck. The whispers are louder here — almost words, circling you like the pale lights.',
      caves: 'The whispers echo and multiply in the stone chambers. They layer on top of each other until they become almost a chord — eerie and beautiful.',
      mountain: 'Wind howls across the exposed rock. From below, the whispers rise like heat shimmer — distorted, stretched thin by the altitude.',
      lighthouse: 'The rhythmic sweep of the lighthouse mechanism. Waves against the rocks below. Gulls. The whispers are fainter here, as if the sea air dilutes them.',
      ruins: 'The whispers are loudest here. They seem to come from the very stones — urgent, insistent, and for the first time, almost comprehensible.'
    };
    this.print(msgs[zone] || 'You listen carefully. The whispers are always there, just at the edge of hearing.', '#cccccc');
  }

  smell() {
    const room = this.data.rooms[this.state.currentRoom];
    const zone = room.zone;
    const msgs = {
      beach: 'Salt, seaweed, and the clean tang of ocean air.',
      jungle: 'Rich earth, rotting vegetation, and the sweet perfume of tropical flowers.',
      village: 'Dust, old wood, and faintly, the ghost of cooking fires long cold.',
      research: 'Chemicals, machine oil, and the ozone tang of electrical equipment.',
      marsh: 'Sulfur, decay, and stagnant water. Unpleasant.',
      caves: 'Wet stone, mineral deposits, and something metallic — almost electric.',
      mountain: 'Clean air, rock dust, and the faint sweetness of mountain flowers.',
      lighthouse: 'Lamp oil, sea spray, and pipe tobacco.',
      ruins: 'Ancient stone, dust, and a strange scent — like ozone before a thunderstorm.'
    };
    this.print(msgs[zone] || 'Nothing remarkable.', '#cccccc');
  }

  showMap() {
    const maps = this.state.inventory.filter(id => this.data.items[id]?.type === 'map');
    if (maps.length === 0) {
      return this.print('You don\'t have a map. Perhaps you can find fragments of one somewhere.', '#ffcc00');
    }

    this.print('\n—— Island Map (assembled from fragments) ——', '#00ccff');

    if (maps.includes('map_fragment_3')) {
      this.print(`
       [Summit]
          |
    [Mountain/Cliffs]---[Temple Ruins]
          |
`, '#888');
    }
    if (maps.includes('map_fragment_2')) {
      this.print(`    [Marsh]---[Caves]
       |
  [Jungle]---[Village]---[Research Station]
       |         |
`, '#888');
    }
    if (maps.includes('map_fragment_1')) {
      this.print(`  [Lighthouse]
       |
  [Coast]---[Beach/Dunes]---[Cove]
                  |
            [Rocky Shore]---[Tidepools]
`, '#888');
    }

    this.print(`\nMap fragments found: ${maps.length}/3`, '#888');
    this.print(`Rooms visited: ${this.state.visitedRooms.length}`, '#888');
  }

  showJournal() {
    const journals = this.state.inventory
      .filter(id => this.data.items[id]?.type === 'journal')
      .sort((a, b) => (this.data.items[a].number || 0) - (this.data.items[b].number || 0));

    if (journals.length === 0) {
      return this.print('You haven\'t found any journal pages yet. Dr. Voss\'s journal was scattered across the island.', '#ffcc00');
    }

    this.print(`\n—— Dr. Voss's Journal [${journals.length}/10 pages] ——\n`, '#00ccff');
    for (const id of journals) {
      const item = this.data.items[id];
      this.print(item.description + '\n', '#cccccc');
    }
  }

  showScore() {
    const journalCount = this.state.inventory.filter(id => this.data.items[id]?.type === 'journal').length;
    const mapCount = this.state.inventory.filter(id => this.data.items[id]?.type === 'map').length;
    const npcsMetCount = Object.keys(this.state.npcMet).length;
    const totalNpcs = Object.keys(this.data.npcs).length;

    this.print('\n—— Progress ——', '#00ccff');
    this.print(`Moves: ${this.state.moves}`, '#cccccc');
    this.print(`Rooms explored: ${this.state.visitedRooms.length}/${Object.keys(this.data.rooms).length}`, '#cccccc');
    this.print(`Journal pages: ${journalCount}/10`, '#cccccc');
    this.print(`Map fragments: ${mapCount}/3`, '#cccccc');
    this.print(`NPCs met: ${npcsMetCount}/${totalNpcs}`, '#cccccc');
    this.print(`Radio repaired: ${this.state.flags.radio_repaired ? 'Yes' : 'No'}`, '#cccccc');
    this.print(`Beacon silenced: ${this.state.flags.temple_keys_solved ? 'Yes' : 'No'}`, '#cccccc');

    let score = journalCount * 5 + mapCount * 3 + npcsMetCount * 5 +
      this.state.visitedRooms.length +
      (this.state.flags.radio_repaired ? 20 : 0) +
      (this.state.flags.temple_keys_solved ? 20 : 0);
    this.print(`\nScore: ${score} points`, '#ffcc00');
  }

  showHint() {
    const hints = [];
    const inv = this.state.inventory;
    const flags = this.state.flags;

    if (inv.length === 0 && this.state.moves < 5) {
      hints.push('Look around and explore. Pick up items you find. Head north from the shore to reach the beach, then into the jungle.');
    }

    if (!inv.includes('lantern') && !flags.lantern_lit) {
      hints.push('You\'ll need a light source for dark areas. Check the sea cave east of the rocky shore.');
    }

    if (!inv.includes('rusty_key') && !flags.temple_keys_solved) {
      hints.push('One of the three keys is in the tidepools on the eastern beach.');
    }

    const journalCount = inv.filter(id => this.data.items[id]?.type === 'journal').length;
    if (journalCount < 3) {
      hints.push('Dr. Voss\'s journal pages are scattered across the island. Explore thoroughly — check every room.');
    }

    if (!Object.keys(this.state.npcMet).length) {
      hints.push('Find people to talk to. There\'s an old fisherman at the village dock.');
    }

    if (inv.includes('rusty_key') && !this.state.unlockedExits['village_store:back']) {
      hints.push('Your rusty key might open something in the village. Try the general store.');
    }

    if (!flags.radio_repaired) {
      if (!inv.includes('radio_tube')) hints.push('A vacuum tube can be found in the research station lab annex.');
      if (!inv.includes('radio_antenna')) hints.push('Copper antenna wire is in the village store\'s back room (locked).');
      if (!inv.includes('radio_battery')) hints.push('A charged battery is in the research station storage building.');
    }

    if (!flags.temple_keys_solved) {
      if (!inv.includes('brass_key')) hints.push('Talk to Captain Briggs at the lighthouse about a "key". Then check the lamp room at the top.');
      if (!inv.includes('crystal_key')) hints.push('The crystal key is in the Crystal Grotto, beyond the underground lake. You need rope to cross.');
    }

    if (flags.radio_repaired && !flags.temple_keys_solved) {
      hints.push('You escaped, but can you silence the beacon too? Find all three keys for the temple altar.');
    }

    if (flags.temple_keys_solved && !flags.radio_repaired) {
      hints.push('The beacon is silent, but you\'re still stranded. Repair the radio at the lighthouse.');
    }

    if (hints.length === 0) {
      hints.push('You seem to be doing well! Keep exploring and talking to everyone.');
    }

    this.print('\n—— Hint ——', '#ffcc00');
    this.print(hints[Math.floor(Math.random() * hints.length)], '#ffcc88');
  }

  showHelp() {
    this.print(`
—— Commands ——

MOVEMENT:    north/south/east/west (or n/s/e/w)
             up/down (or u/d), in/out
             go <direction>

ACTIONS:     look (l)          — describe current room
             examine <thing>   — look closely at something
             take <item>       — pick up an item
             drop <item>       — drop an item
             inventory (i)     — show what you're carrying
             use <item>        — use an item
             open/unlock       — try to open something
             light lantern     — light the oil lantern

INTERACTION: talk <person>              — start a conversation
             talk <person> about <topic> — ask about a topic
             give/show <item>           — give or show an item

SENSES:      listen             — listen to surroundings
             smell              — smell the air

INFO:        map                — view collected map fragments
             journal            — read collected journal pages
             score              — check your progress
             hint               — get a hint
             help               — show this help

SYSTEM:      save               — save game (also auto-saves)
             restart            — start a new game

Pro tip: Talk to NPCs about everything — try keywords like
'island', 'artifact', 'keys', 'voss', 'help', 'whispers'.
`, '#00ccff');
  }

  confirmRestart() {
    this.state.flags.pendingRestart = true;
    this.print('Are you sure you want to restart? All progress will be lost. Type "yes" to confirm.', '#ff6666');
  }
}

// Boot the game when loaded
function startWhisperingIsle(container) {
  return new WhisperingIsle(container || document.body);
}
