function initVimRain(columns, rows, fontSize, filename) {
    const COLS = 70;
    const TROWS = 30;

    let boardStartCol = Math.floor(columns / 2) - Math.floor(COLS / 2);
    let boardStartRow = Math.floor(rows / 2) - Math.floor(TROWS / 2);

    const TEXT_COLS = COLS - 5;
    const TEXT_ROWS = TROWS - 2;

    let destroyed = false;
    let prevOccupiedKeys = new Set();

    let fb = new Array(COLS * TROWS);
    for (let i = 0; i < fb.length; i++) fb[i] = { char: ' ', color: '#000' };

    // ══════════════════════════════════════
    // State
    // ══════════════════════════════════════

    let mode = 'normal'; // normal, insert, replace, visual, visualline, visualblock, command
    let lines = [''];
    let cursorRow = 0;
    let cursorCol = 0;
    let desiredCol = 0; // remembered column for j/k
    let scrollTop = 0;
    let cmdBuffer = '';
    let statusMsg = '';
    let statusTimer = 0;
    let currentFile = filename || 'untitled';
    let modified = false;
    let lastSearch = '';
    let searchDirection = 1;

    // Settings
    let settings = {
        hlsearch: true,
        ignorecase: false,
        autoindent: true,
        wrap: true,
        tabstop: 4,
        number: true,
        syntax: true,
    };
    // Load saved settings
    try {
        const saved = JSON.parse(localStorage.getItem('zztt-vim-settings'));
        if (saved) Object.assign(settings, saved);
    } catch(e) {}

    // Undo/redo
    let undoStack = [];
    let redoStack = [];
    const maxUndo = 100;

    // Registers: map of char -> { text, isLine }
    let registers = {};
    try { const r = JSON.parse(localStorage.getItem('zztt-vim-registers')); if (r) registers = r; } catch(e) {}
    let currentRegister = ''; // pending "x register selection
    let lastYankRegister = ''; // "0 always holds last yank

    // Marks: map of char -> { row, col }
    let marks = {};
    try { const m = JSON.parse(localStorage.getItem('zztt-vim-marks')); if (m) marks = m; } catch(e) {}

    // Macros: map of char -> [keys], recording state
    let macros = {};
    try { const m = JSON.parse(localStorage.getItem('zztt-vim-macros')); if (m) macros = m; } catch(e) {}
    let macroRecording = ''; // register being recorded into, '' = not recording
    let macroKeys = [];
    let lastMacroRegister = '';

    // Pending operator: d, y, c, >, <, g~, gu, gU
    let pendingOp = '';
    let pendingCount = 1;
    let countBuffer = '';

    // g prefix
    let gPending = false;

    // z prefix
    let zPending = false;

    // Waiting for char: r, f, F, t, T
    let waitingForChar = '';

    // Waiting for text object qualifier: i or a (after operator)
    let waitingForTextObjQual = ''; // 'i' or 'a'

    // Waiting for register: after "
    let waitingForRegister = false;

    // Waiting for mark set: after m
    let waitingForMarkSet = false;

    // Waiting for mark jump: after ' or `
    let waitingForMarkJump = '';

    // Visual mode
    let visualStart = null;

    // Find char
    let lastFindChar = '';
    let lastFindDir = 1;
    let lastFindTill = false;

    // Dot repeat
    let lastChange = null;
    let recording = false;
    let recordedKeys = [];
    let replaying = false;

    // Command history
    let cmdHistory = [];
    let cmdHistoryIdx = -1;
    let cmdHistoryDraft = '';

    // Word completion
    let completionActive = false;
    let completionList = [];
    let completionIdx = 0;
    let completionStart = 0;

    // Load file
    loadFile(currentFile);

    // ══════════════════════════════════════
    // Undo / Redo
    // ══════════════════════════════════════

    function saveUndo() {
        undoStack.push({ lines: lines.map(l => l), cursorRow, cursorCol });
        if (undoStack.length > maxUndo) undoStack.shift();
        redoStack = [];
    }

    function undo() {
        if (undoStack.length === 0) { setStatus('Already at oldest change'); return; }
        redoStack.push({ lines: lines.map(l => l), cursorRow, cursorCol });
        const s = undoStack.pop();
        lines = s.lines; cursorRow = s.cursorRow; cursorCol = s.cursorCol;
        clampCursor(); modified = true;
    }

    function redo() {
        if (redoStack.length === 0) { setStatus('Already at newest change'); return; }
        undoStack.push({ lines: lines.map(l => l), cursorRow, cursorCol });
        const s = redoStack.pop();
        lines = s.lines; cursorRow = s.cursorRow; cursorCol = s.cursorCol;
        clampCursor(); modified = true;
    }

    // ══════════════════════════════════════
    // File I/O
    // ══════════════════════════════════════

    function loadFile(name) {
        currentFile = name;
        const saved = localStorage.getItem('zztt-vim-' + name);
        if (saved !== null) {
            lines = saved.split('\n');
            if (lines.length === 0) lines = [''];
            setStatus('"' + name + '" ' + lines.length + 'L');
        } else {
            lines = [''];
            setStatus('"' + name + '" [New File]');
        }
        cursorRow = 0; cursorCol = 0; desiredCol = 0; scrollTop = 0;
        modified = false; undoStack = []; redoStack = [];
    }

    function saveFile(name) {
        if (name) currentFile = name;
        localStorage.setItem('zztt-vim-' + currentFile, lines.join('\n'));
        modified = false;
        setStatus('"' + currentFile + '" ' + lines.length + 'L written');
    }

    function setStatus(msg) { statusMsg = msg; statusTimer = 90; }

    // ══════════════════════════════════════
    // Registers
    // ══════════════════════════════════════

    function setRegister(text, isLine) {
        const reg = currentRegister || '"';
        registers[reg] = { text, isLine };
        registers['"'] = { text, isLine }; // unnamed always updated
        if (currentRegister === '' || currentRegister === '"') {
            // Shift numbered registers for deletes
            for (let i = 9; i > 1; i--) {
                if (registers[String(i - 1)]) registers[String(i)] = registers[String(i - 1)];
            }
            registers['1'] = { text, isLine };
        }
        currentRegister = '';
        localStorage.setItem('zztt-vim-registers', JSON.stringify(registers));
    }

    function setYankRegister(text, isLine) {
        const reg = currentRegister || '"';
        registers[reg] = { text, isLine };
        registers['"'] = { text, isLine };
        registers['0'] = { text, isLine }; // "0 always holds last yank
        currentRegister = '';
        localStorage.setItem('zztt-vim-registers', JSON.stringify(registers));
    }

    function getRegister() {
        const reg = currentRegister || '"';
        currentRegister = '';
        return registers[reg] || { text: '', isLine: false };
    }

    // ══════════════════════════════════════
    // Cursor & Scroll
    // ══════════════════════════════════════

    function clampCursor() {
        if (cursorRow < 0) cursorRow = 0;
        if (cursorRow >= lines.length) cursorRow = lines.length - 1;
        const maxCol = (mode === 'insert' || mode === 'replace') ? lines[cursorRow].length : Math.max(0, lines[cursorRow].length - 1);
        if (cursorCol > maxCol) cursorCol = maxCol;
        if (cursorCol < 0) cursorCol = 0;

        if (cursorRow < scrollTop) scrollTop = cursorRow;
        let usedRows = 0;
        for (let i = scrollTop; i <= cursorRow && i < lines.length; i++) {
            usedRows += screenLinesFor(i);
        }
        while (usedRows > TEXT_ROWS && scrollTop < cursorRow) {
            usedRows -= screenLinesFor(scrollTop);
            scrollTop++;
        }
    }

    function screenLinesFor(lineIdx) {
        if (!settings.wrap) return 1;
        return Math.max(1, Math.ceil((lines[lineIdx].length + 1) / TEXT_COLS));
    }

    function getCount() {
        const n = parseInt(countBuffer) || 1;
        countBuffer = '';
        return n;
    }

    function updateDesiredCol() { desiredCol = cursorCol; }

    // Screen position helpers
    function getScreenTopLine() { return scrollTop; }
    function getScreenBottomLine() {
        let r = scrollTop, used = 0;
        while (r < lines.length && used < TEXT_ROWS) {
            used += screenLinesFor(r);
            r++;
        }
        return Math.min(r - 1, lines.length - 1);
    }
    function getScreenMiddleLine() {
        return Math.floor((getScreenTopLine() + getScreenBottomLine()) / 2);
    }

    // ══════════════════════════════════════
    // Motion helpers
    // ══════════════════════════════════════

    function isWordChar(ch) { return /[a-zA-Z0-9_]/.test(ch); }
    function isWORDChar(ch) { return ch !== ' ' && ch !== '\t'; }

    function wordForward(row, col) {
        const line = lines[row];
        let c = col;
        if (c < line.length && isWordChar(line[c])) {
            while (c < line.length && isWordChar(line[c])) c++;
        } else if (c < line.length && isWORDChar(line[c]) && !isWordChar(line[c])) {
            while (c < line.length && !isWordChar(line[c]) && isWORDChar(line[c])) c++;
        }
        while (c < line.length && line[c] === ' ') c++;
        if (c >= line.length && row < lines.length - 1) return { row: row + 1, col: 0 };
        return { row, col: Math.min(c, Math.max(0, line.length - 1)) };
    }

    function WORDForward(row, col) {
        const line = lines[row];
        let c = col;
        while (c < line.length && isWORDChar(line[c])) c++;
        while (c < line.length && !isWORDChar(line[c])) c++;
        if (c >= line.length && row < lines.length - 1) return { row: row + 1, col: 0 };
        return { row, col: Math.min(c, Math.max(0, line.length - 1)) };
    }

    function wordEnd(row, col) {
        let r = row, c = col + 1;
        if (c >= lines[r].length) { if (r < lines.length - 1) { r++; c = 0; } else return { row: r, col: Math.max(0, lines[r].length - 1) }; }
        const line = lines[r];
        while (c < line.length && line[c] === ' ') c++;
        if (c < line.length && isWordChar(line[c])) { while (c + 1 < line.length && isWordChar(line[c + 1])) c++; }
        else if (c < line.length) { while (c + 1 < line.length && !isWordChar(line[c + 1]) && isWORDChar(line[c + 1])) c++; }
        return { row: r, col: c };
    }

    function wordBack(row, col) {
        let r = row, c = col - 1;
        if (c < 0) { if (r > 0) { r--; c = lines[r].length - 1; } else return { row: 0, col: 0 }; }
        const line = lines[r];
        while (c > 0 && line[c] === ' ') c--;
        if (isWordChar(line[c])) { while (c > 0 && isWordChar(line[c - 1])) c--; }
        else { while (c > 0 && !isWordChar(line[c - 1]) && isWORDChar(line[c - 1])) c--; }
        return { row: r, col: c };
    }

    function paragraphForward(row) {
        let r = row + 1;
        while (r < lines.length && lines[r].trim() !== '') r++;
        while (r < lines.length && lines[r].trim() === '') r++;
        return Math.min(r, lines.length - 1);
    }

    function paragraphBack(row) {
        let r = row - 1;
        while (r > 0 && lines[r].trim() !== '') r--;
        while (r > 0 && lines[r - 1].trim() === '') r--;
        return Math.max(r, 0);
    }

    function findMatchingBracket(row, col) {
        const pairs = { '(': ')', ')': '(', '{': '}', '}': '{', '[': ']', ']': '[', '<': '>', '>': '<' };
        const openers = '({[<';
        const ch = lines[row][col];
        if (!pairs[ch]) {
            // Search forward on the line for a bracket
            for (let c = col; c < lines[row].length; c++) {
                if (pairs[lines[row][c]]) { col = c; break; }
            }
            if (!pairs[lines[row][col]]) return null;
        }
        const startCh = lines[row][col];
        const target = pairs[startCh];
        const dir = openers.includes(startCh) ? 1 : -1;
        let depth = 0, r = row, c = col;
        while (r >= 0 && r < lines.length) {
            const line = lines[r];
            while (c >= 0 && c < line.length) {
                if (line[c] === startCh) depth++;
                if (line[c] === target) depth--;
                if (depth === 0) return { row: r, col: c };
                c += dir;
            }
            r += dir;
            if (r >= 0 && r < lines.length) c = dir === 1 ? 0 : lines[r].length - 1;
        }
        return null;
    }

    function findCharOnLine(ch, dir, till, row, col) {
        const line = lines[row];
        let c = col + dir;
        while (c >= 0 && c < line.length) {
            if (line[c] === ch) return till ? c - dir : c;
            c += dir;
        }
        return -1;
    }

    // ══════════════════════════════════════
    // Text Objects
    // ══════════════════════════════════════

    function getTextObject(qual, obj) {
        // qual: 'i' (inner) or 'a' (around)
        // Returns { startRow, startCol, endRow, endCol, linewise } or null
        const inner = qual === 'i';

        // Word
        if (obj === 'w') {
            const line = lines[cursorRow];
            let start = cursorCol, end = cursorCol;
            if (isWordChar(line[cursorCol])) {
                while (start > 0 && isWordChar(line[start - 1])) start--;
                while (end < line.length - 1 && isWordChar(line[end + 1])) end++;
            } else if (isWORDChar(line[cursorCol])) {
                while (start > 0 && !isWordChar(line[start - 1]) && isWORDChar(line[start - 1])) start--;
                while (end < line.length - 1 && !isWordChar(line[end + 1]) && isWORDChar(line[end + 1])) end++;
            } else {
                while (start > 0 && line[start - 1] === ' ') start--;
                while (end < line.length - 1 && line[end + 1] === ' ') end++;
            }
            if (!inner) {
                while (end < line.length - 1 && line[end + 1] === ' ') end++;
            }
            return { startRow: cursorRow, startCol: start, endRow: cursorRow, endCol: end };
        }

        // WORD
        if (obj === 'W') {
            const line = lines[cursorRow];
            let start = cursorCol, end = cursorCol;
            if (isWORDChar(line[cursorCol])) {
                while (start > 0 && isWORDChar(line[start - 1])) start--;
                while (end < line.length - 1 && isWORDChar(line[end + 1])) end++;
            }
            if (!inner) {
                while (end < line.length - 1 && line[end + 1] === ' ') end++;
            }
            return { startRow: cursorRow, startCol: start, endRow: cursorRow, endCol: end };
        }

        // Paragraph
        if (obj === 'p') {
            let startR = cursorRow, endR = cursorRow;
            if (lines[cursorRow].trim() === '') {
                while (startR > 0 && lines[startR - 1].trim() === '') startR--;
                while (endR < lines.length - 1 && lines[endR + 1].trim() === '') endR++;
            } else {
                while (startR > 0 && lines[startR - 1].trim() !== '') startR--;
                while (endR < lines.length - 1 && lines[endR + 1].trim() !== '') endR++;
            }
            if (!inner) {
                while (endR < lines.length - 1 && lines[endR + 1].trim() === '') endR++;
            }
            return { startRow: startR, startCol: 0, endRow: endR, endCol: lines[endR].length - 1, linewise: true };
        }

        // Brackets / quotes
        const bracketPairs = {
            '(': ['(', ')'], ')': ['(', ')'], 'b': ['(', ')'],
            '{': ['{', '}'], '}': ['{', '}'], 'B': ['{', '}'],
            '[': ['[', ']'], ']': ['[', ']'],
            '<': ['<', '>'], '>': ['<', '>'],
        };
        const quotePairs = { '"': '"', "'": "'", '`': '`' };

        if (bracketPairs[obj]) {
            const [open, close] = bracketPairs[obj];
            return findEnclosing(open, close, inner);
        }

        if (quotePairs[obj]) {
            return findQuoteObject(quotePairs[obj], inner);
        }

        return null;
    }

    function findEnclosing(open, close, inner) {
        // Search backward for unmatched open
        let depth = 0;
        let sr = cursorRow, sc = cursorCol;
        let found = false;

        // Search backward
        outer: for (let r = cursorRow; r >= 0; r--) {
            const line = lines[r];
            const startC = r === cursorRow ? cursorCol : line.length - 1;
            for (let c = startC; c >= 0; c--) {
                if (line[c] === close && !(r === cursorRow && c === cursorCol)) depth++;
                if (line[c] === open) {
                    if (depth === 0) { sr = r; sc = c; found = true; break outer; }
                    depth--;
                }
            }
        }
        if (!found) return null;

        // Search forward for matching close
        depth = 0;
        let er = sr, ec = sc;
        found = false;
        outer2: for (let r = sr; r < lines.length; r++) {
            const line = lines[r];
            const startC = r === sr ? sc : 0;
            for (let c = startC; c < line.length; c++) {
                if (line[c] === open && !(r === sr && c === sc)) depth++;
                if (line[c] === close) {
                    if (depth === 0) { er = r; ec = c; found = true; break outer2; }
                    depth--;
                }
            }
        }
        if (!found) return null;

        if (inner) {
            // Exclude the brackets
            sc++;
            if (sc >= lines[sr].length) { sr++; sc = 0; }
            ec--;
            if (ec < 0) { er--; ec = lines[er].length - 1; }
        }
        return { startRow: sr, startCol: sc, endRow: er, endCol: ec };
    }

    function findQuoteObject(quote, inner) {
        const line = lines[cursorRow];
        // Find the quote boundaries on the current line
        let start = -1, end = -1;

        // If cursor is on a quote, figure out if it's opening or closing
        const positions = [];
        for (let c = 0; c < line.length; c++) {
            if (line[c] === quote && (c === 0 || line[c - 1] !== '\\')) {
                positions.push(c);
            }
        }

        // Find the pair that contains cursor
        for (let i = 0; i < positions.length - 1; i += 2) {
            if (positions[i] <= cursorCol && positions[i + 1] >= cursorCol) {
                start = positions[i];
                end = positions[i + 1];
                break;
            }
        }
        // If not found, try finding next pair after cursor
        if (start === -1) {
            for (let i = 0; i < positions.length - 1; i += 2) {
                if (positions[i] > cursorCol) {
                    start = positions[i];
                    end = positions[i + 1];
                    break;
                }
            }
        }

        if (start === -1 || end === -1) return null;

        if (inner) {
            return { startRow: cursorRow, startCol: start + 1, endRow: cursorRow, endCol: end - 1 };
        }
        return { startRow: cursorRow, startCol: start, endRow: cursorRow, endCol: end };
    }

    // ══════════════════════════════════════
    // Visual mode helpers
    // ══════════════════════════════════════

    function getVisualRange() {
        if (!visualStart) return null;
        let sr = visualStart.row, sc = visualStart.col;
        let er = cursorRow, ec = cursorCol;
        if (sr > er || (sr === er && sc > ec)) {
            [sr, er] = [er, sr]; [sc, ec] = [ec, sc];
        }
        return { startRow: sr, startCol: sc, endRow: er, endCol: ec };
    }

    function getVisualText() {
        const range = getVisualRange();
        if (!range) return '';
        if (mode === 'visualline') return lines.slice(range.startRow, range.endRow + 1).join('\n');
        if (range.startRow === range.endRow) return lines[range.startRow].slice(range.startCol, range.endCol + 1);
        let text = lines[range.startRow].slice(range.startCol);
        for (let r = range.startRow + 1; r < range.endRow; r++) text += '\n' + lines[r];
        text += '\n' + lines[range.endRow].slice(0, range.endCol + 1);
        return text;
    }

    function deleteVisualRange(yank) {
        const range = getVisualRange();
        if (!range) return;
        saveUndo();

        const text = getVisualText();
        const isLine = mode === 'visualline';

        if (yank !== false) {
            setRegister(text, isLine);
        }

        if (mode === 'visualline') {
            lines.splice(range.startRow, range.endRow - range.startRow + 1);
            if (lines.length === 0) lines = [''];
            cursorRow = Math.min(range.startRow, lines.length - 1);
            cursorCol = 0;
        } else if (mode === 'visualblock') {
            const sc = Math.min(visualStart.col, cursorCol);
            const ec = Math.max(visualStart.col, cursorCol);
            const sr = Math.min(visualStart.row, cursorRow);
            const er = Math.max(visualStart.row, cursorRow);
            for (let r = sr; r <= er && r < lines.length; r++) {
                lines[r] = lines[r].slice(0, sc) + lines[r].slice(Math.min(ec + 1, lines[r].length));
            }
            cursorRow = sr; cursorCol = sc;
        } else {
            if (range.startRow === range.endRow) {
                lines[range.startRow] = lines[range.startRow].slice(0, range.startCol) + lines[range.startRow].slice(range.endCol + 1);
            } else {
                lines[range.startRow] = lines[range.startRow].slice(0, range.startCol) + lines[range.endRow].slice(range.endCol + 1);
                lines.splice(range.startRow + 1, range.endRow - range.startRow);
            }
            cursorRow = range.startRow; cursorCol = range.startCol;
        }
        modified = true;
        mode = 'normal'; visualStart = null;
        clampCursor();
    }

    // ══════════════════════════════════════
    // Operator + motion / text object
    // ══════════════════════════════════════

    function applyOperatorMotion(op, target) {
        if (!target) { pendingOp = ''; return; }
        let sr = cursorRow, sc = cursorCol, er = target.row, ec = target.col;
        let linewise = target.linewise || false;

        if (sr > er || (sr === er && sc > ec)) { [sr, er] = [er, sr]; [sc, ec] = [ec, sc]; }

        saveUndo();

        if (op === 'd' || op === 'c') {
            let text;
            if (linewise) {
                text = lines.slice(sr, er + 1).join('\n');
                setRegister(text, true);
                lines.splice(sr, er - sr + 1);
                if (lines.length === 0) lines = [''];
                cursorRow = Math.min(sr, lines.length - 1);
                cursorCol = 0;
            } else if (sr === er) {
                text = lines[sr].slice(sc, ec + 1);
                setRegister(text, false);
                lines[sr] = lines[sr].slice(0, sc) + lines[sr].slice(ec + 1);
                cursorRow = sr; cursorCol = sc;
            } else {
                text = lines[sr].slice(sc);
                for (let r = sr + 1; r < er; r++) text += '\n' + lines[r];
                text += '\n' + lines[er].slice(0, ec + 1);
                setRegister(text, false);
                lines[sr] = lines[sr].slice(0, sc) + lines[er].slice(ec + 1);
                lines.splice(sr + 1, er - sr);
                cursorRow = sr; cursorCol = sc;
            }
            modified = true;
            if (op === 'c') { mode = 'insert'; setStatus('-- INSERT --'); }
        } else if (op === 'y') {
            let text;
            if (linewise) {
                text = lines.slice(sr, er + 1).join('\n');
                setYankRegister(text, true);
            } else if (sr === er) {
                text = lines[sr].slice(sc, ec + 1);
                setYankRegister(text, false);
            } else {
                text = lines[sr].slice(sc);
                for (let r = sr + 1; r < er; r++) text += '\n' + lines[r];
                text += '\n' + lines[er].slice(0, ec + 1);
                setYankRegister(text, false);
            }
            setStatus('yanked');
        } else if (op === 'g~') {
            // Toggle case
            for (let r = sr; r <= er; r++) {
                const startC = r === sr ? sc : 0;
                const endC = r === er ? ec : lines[r].length - 1;
                let newLine = lines[r].split('');
                for (let c = startC; c <= endC && c < newLine.length; c++) {
                    newLine[c] = newLine[c] === newLine[c].toUpperCase() ? newLine[c].toLowerCase() : newLine[c].toUpperCase();
                }
                lines[r] = newLine.join('');
            }
            modified = true;
        } else if (op === 'gu') {
            for (let r = sr; r <= er; r++) {
                const startC = r === sr ? sc : 0;
                const endC = r === er ? ec : lines[r].length - 1;
                let newLine = lines[r].split('');
                for (let c = startC; c <= endC && c < newLine.length; c++) newLine[c] = newLine[c].toLowerCase();
                lines[r] = newLine.join('');
            }
            modified = true;
        } else if (op === 'gU') {
            for (let r = sr; r <= er; r++) {
                const startC = r === sr ? sc : 0;
                const endC = r === er ? ec : lines[r].length - 1;
                let newLine = lines[r].split('');
                for (let c = startC; c <= endC && c < newLine.length; c++) newLine[c] = newLine[c].toUpperCase();
                lines[r] = newLine.join('');
            }
            modified = true;
        }

        pendingOp = '';
        clampCursor();
    }

    function applyOperatorTextObj(op, qual, obj) {
        const range = getTextObject(qual, obj);
        if (!range) { pendingOp = ''; waitingForTextObjQual = ''; return; }
        applyOperatorMotion(op, {
            row: range.endRow, col: range.endCol,
            linewise: range.linewise,
            _startRow: range.startRow, _startCol: range.startCol
        });
        // Fix: operator motion uses cursorRow/Col as start, but text objects define their own start
        // We need to handle this properly
    }

    // Proper text object operator application
    function applyOpOnRange(op, sr, sc, er, ec, linewise) {
        if (sr > er || (sr === er && sc > ec)) { [sr, er] = [er, sr]; [sc, ec] = [ec, sc]; }
        saveUndo();

        if (op === 'd' || op === 'c') {
            let text;
            if (linewise) {
                text = lines.slice(sr, er + 1).join('\n');
                setRegister(text, true);
                lines.splice(sr, er - sr + 1);
                if (lines.length === 0) lines = [''];
                cursorRow = Math.min(sr, lines.length - 1);
                cursorCol = op === 'c' ? (lines[cursorRow].match(/^\s*/)?.[0]?.length || 0) : 0;
            } else {
                if (sr === er) {
                    text = lines[sr].slice(sc, ec + 1);
                    setRegister(text, false);
                    lines[sr] = lines[sr].slice(0, sc) + lines[sr].slice(ec + 1);
                } else {
                    text = lines[sr].slice(sc);
                    for (let r = sr + 1; r < er; r++) text += '\n' + lines[r];
                    text += '\n' + lines[er].slice(0, ec + 1);
                    setRegister(text, false);
                    lines[sr] = lines[sr].slice(0, sc) + lines[er].slice(ec + 1);
                    lines.splice(sr + 1, er - sr);
                }
                cursorRow = sr; cursorCol = sc;
            }
            modified = true;
            if (op === 'c') { mode = 'insert'; setStatus('-- INSERT --'); }
        } else if (op === 'y') {
            let text;
            if (linewise) { text = lines.slice(sr, er + 1).join('\n'); setYankRegister(text, true); }
            else if (sr === er) { text = lines[sr].slice(sc, ec + 1); setYankRegister(text, false); }
            else {
                text = lines[sr].slice(sc);
                for (let r = sr + 1; r < er; r++) text += '\n' + lines[r];
                text += '\n' + lines[er].slice(0, ec + 1);
                setYankRegister(text, false);
            }
            setStatus('yanked');
        } else if (op === 'g~' || op === 'gu' || op === 'gU') {
            for (let r = sr; r <= er; r++) {
                const cStart = r === sr ? sc : 0;
                const cEnd = r === er ? ec : lines[r].length - 1;
                let chars = lines[r].split('');
                for (let c = cStart; c <= cEnd && c < chars.length; c++) {
                    if (op === 'g~') chars[c] = chars[c] === chars[c].toUpperCase() ? chars[c].toLowerCase() : chars[c].toUpperCase();
                    else if (op === 'gu') chars[c] = chars[c].toLowerCase();
                    else chars[c] = chars[c].toUpperCase();
                }
                lines[r] = chars.join('');
            }
            modified = true;
        }
        pendingOp = '';
        clampCursor();
    }

    // ══════════════════════════════════════
    // Search
    // ══════════════════════════════════════

    function searchForward(term) {
        if (!term) return;
        const ci = settings.ignorecase;
        const t = ci ? term.toLowerCase() : term;
        for (let r = cursorRow; r < lines.length; r++) {
            const line = ci ? lines[r].toLowerCase() : lines[r];
            const start = r === cursorRow ? cursorCol + 1 : 0;
            const idx = line.indexOf(t, start);
            if (idx !== -1) { cursorRow = r; cursorCol = idx; clampCursor(); return; }
        }
        for (let r = 0; r <= cursorRow; r++) {
            const line = ci ? lines[r].toLowerCase() : lines[r];
            const idx = line.indexOf(t);
            if (idx !== -1) { cursorRow = r; cursorCol = idx; clampCursor(); setStatus('search wrapped'); return; }
        }
        setStatus('Pattern not found: ' + term);
    }

    function searchBackward(term) {
        if (!term) return;
        const ci = settings.ignorecase;
        const t = ci ? term.toLowerCase() : term;
        for (let r = cursorRow; r >= 0; r--) {
            const line = ci ? lines[r].toLowerCase() : lines[r];
            const end = r === cursorRow ? cursorCol - 1 : line.length;
            const idx = line.lastIndexOf(t, end);
            if (idx !== -1) { cursorRow = r; cursorCol = idx; clampCursor(); return; }
        }
        for (let r = lines.length - 1; r >= cursorRow; r--) {
            const line = ci ? lines[r].toLowerCase() : lines[r];
            const idx = line.lastIndexOf(t);
            if (idx !== -1) { cursorRow = r; cursorCol = idx; clampCursor(); setStatus('search wrapped'); return; }
        }
        setStatus('Pattern not found: ' + term);
    }

    function getWordUnderCursor() {
        const line = lines[cursorRow];
        if (!line || cursorCol >= line.length || !isWordChar(line[cursorCol])) return null;
        let s = cursorCol, e = cursorCol;
        while (s > 0 && isWordChar(line[s - 1])) s--;
        while (e < line.length - 1 && isWordChar(line[e + 1])) e++;
        return line.slice(s, e + 1);
    }

    // ══════════════════════════════════════
    // Word Completion (Ctrl-n / Ctrl-p)
    // ══════════════════════════════════════

    function gatherCompletions() {
        const line = lines[cursorRow];
        let start = cursorCol - 1;
        while (start >= 0 && isWordChar(line[start])) start--;
        start++;
        const prefix = line.slice(start, cursorCol);
        if (prefix.length === 0) return [];

        completionStart = start;
        const words = new Set();
        for (const l of lines) {
            const matches = l.match(/[a-zA-Z_]\w*/g);
            if (matches) for (const w of matches) {
                if (w.startsWith(prefix) && w !== prefix) words.add(w);
            }
        }
        return [...words].sort();
    }

    function applyCompletion() {
        if (completionList.length === 0) return;
        const word = completionList[completionIdx];
        lines[cursorRow] = lines[cursorRow].slice(0, completionStart) + word + lines[cursorRow].slice(cursorCol);
        cursorCol = completionStart + word.length;
        modified = true;
    }

    // ══════════════════════════════════════
    // Key Handling
    // ══════════════════════════════════════

    function onKeyDown(e) {
        if (destroyed) return;

        // Record macro keys
        if (macroRecording && macroRecording !== '?' && !replaying) {
            if (!(e.key === 'q' && mode === 'normal' && !pendingOp && !gPending)) {
                macroKeys.push({ key: e.key, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey });
            }
        }
        if (recording && !replaying) recordedKeys.push({ key: e.key, ctrlKey: e.ctrlKey });

        if (mode === 'command') handleCommandKey(e);
        else if (mode === 'insert') handleInsertKey(e);
        else if (mode === 'replace') handleReplaceKey(e);
        else handleNormalKey(e);

        renderFrame();
        e.preventDefault();
        e.stopPropagation();
    }

    // ── Command mode ──

    function handleCommandKey(e) {
        if (e.key === 'Escape') { mode = 'normal'; cmdBuffer = ''; cmdHistoryIdx = -1; return; }
        if (e.key === 'Enter') {
            const cmd = cmdBuffer;
            cmdBuffer = '';
            if (cmd && (cmdHistory.length === 0 || cmdHistory[cmdHistory.length - 1] !== cmd)) {
                cmdHistory.push(cmd);
            }
            cmdHistoryIdx = -1;
            executeCommand(cmd);
            if (mode === 'command') mode = 'normal';
            return;
        }
        if (e.key === 'Backspace') {
            cmdBuffer = cmdBuffer.slice(0, -1);
            if (cmdBuffer === '') { mode = 'normal'; cmdHistoryIdx = -1; }
            return;
        }
        if (e.key === 'ArrowUp') {
            if (cmdHistory.length === 0) return;
            if (cmdHistoryIdx === -1) { cmdHistoryDraft = cmdBuffer; cmdHistoryIdx = cmdHistory.length - 1; }
            else if (cmdHistoryIdx > 0) cmdHistoryIdx--;
            cmdBuffer = cmdHistory[cmdHistoryIdx];
            return;
        }
        if (e.key === 'ArrowDown') {
            if (cmdHistoryIdx === -1) return;
            if (cmdHistoryIdx < cmdHistory.length - 1) { cmdHistoryIdx++; cmdBuffer = cmdHistory[cmdHistoryIdx]; }
            else { cmdHistoryIdx = -1; cmdBuffer = cmdHistoryDraft; }
            return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) cmdBuffer += e.key;
    }

    function executeCommand(cmd) {
        // Parse line range prefix
        let rangeStart = -1, rangeEnd = -1;
        let rest = cmd.trim();

        const rangeMatch = rest.match(/^(%|(\d+|\.)?(,(\d+|\$|\.))?)(.*)$/);
        if (rangeMatch) {
            if (rangeMatch[1] === '%') {
                rangeStart = 0; rangeEnd = lines.length - 1;
                rest = rangeMatch[5].trim();
            } else if (rangeMatch[2] || rangeMatch[4]) {
                rangeStart = rangeMatch[2] === '.' ? cursorRow : (parseInt(rangeMatch[2]) - 1) || cursorRow;
                if (rangeMatch[4]) {
                    rangeEnd = rangeMatch[4] === '$' ? lines.length - 1 : rangeMatch[4] === '.' ? cursorRow : parseInt(rangeMatch[4]) - 1;
                } else {
                    rangeEnd = rangeStart;
                }
                rest = rangeMatch[5].trim();
            }
        }

        const parts = rest.split(/\s+/);
        const c = parts[0];

        if (c === 'q' || c === 'q!') {
            if (modified && c !== 'q!') { setStatus('No write since last change (add ! to override)'); return; }
            if (vimQuitCallback) vimQuitCallback();
        } else if (c === 'w') {
            saveFile(parts[1]);
        } else if (c === 'wq' || c === 'x') {
            saveFile(parts[1]);
            if (vimQuitCallback) vimQuitCallback();
        } else if (c === 'e') {
            if (parts[1]) loadFile(parts[1]); else setStatus('No file name');
        } else if (c === 'ls') {
            const files = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k.startsWith('zztt-vim-') && !k.includes('settings')) files.push(k.slice(9));
            }
            setStatus(files.length ? files.join(' ') : 'No saved files');
        } else if (c === 'reg' || c === 'registers') {
            let msg = '';
            for (const r of ['"', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f']) {
                if (registers[r]) {
                    const t = registers[r].text.slice(0, 20).replace(/\n/g, '\\n');
                    msg += '"' + r + ': ' + t + '  ';
                }
            }
            setStatus(msg || 'Registers empty');
        } else if (c === 'marks') {
            let msg = '';
            for (const m of Object.keys(marks).sort()) {
                msg += "'" + m + ':' + (marks[m].row + 1) + ':' + marks[m].col + '  ';
            }
            setStatus(msg || 'No marks');
        } else if (c === 'set') {
            const setting = parts[1];
            if (!setting) {
                setStatus(Object.entries(settings).map(([k, v]) => k + '=' + v).join(' '));
            } else if (setting.startsWith('no')) {
                const name = setting.slice(2);
                if (name in settings) { settings[name] = false; saveSettings(); setStatus(setting); }
                else setStatus('Unknown option: ' + setting);
            } else if (setting.includes('=')) {
                const [name, val] = setting.split('=');
                if (name in settings) { settings[name] = isNaN(Number(val)) ? val : Number(val); saveSettings(); setStatus(setting); }
                else setStatus('Unknown option: ' + name);
            } else if (setting in settings) {
                if (typeof settings[setting] === 'boolean') { settings[setting] = true; saveSettings(); setStatus(setting); }
                else setStatus(setting + '=' + settings[setting]);
            } else {
                setStatus('Unknown option: ' + setting);
            }
        } else if (c === 'noh' || c === 'nohlsearch') {
            lastSearch = '';
        } else if (c === 'help') {
            setStatus('hjkl wbeWBE 0$^ fFtT;, {}% HML gg G :N | iIaAoOsScCrR | dycpPxXDCJu Ctrl-r | v V Ctrl-v | /? nN*# | :w :q :e :s :set :reg :marks :ls :copilot qa @a .');
        } else if (c === 'copilot') {
            const prompt = parts.slice(1).join(' ');
            if (!prompt) {
                setStatus('Usage: :copilot <prompt>');
            } else {
                setStatus('copilot thinking...');
                fetch('/api/copilot', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ prompt })
                })
                .then(r => r.json())
                .then(data => {
                    const text = data.response || data.error || 'no response';
                    const newLines = text.split('\n');
                    saveUndo();
                    lines.splice(cursorRow + 1, 0, ...newLines);
                    cursorRow = cursorRow + 1;
                    cursorCol = 0;
                    modified = true;
                    setStatus(newLines.length + ' lines inserted');
                    renderFrame();
                })
                .catch(err => {
                    setStatus('copilot error: ' + err.message);
                    renderFrame();
                });
            }
        } else if (/^!/.test(c)) {
            setStatus('Shell commands not available in this environment');
        } else if (/^\d+$/.test(c) && rangeStart === -1) {
            cursorRow = Math.max(0, Math.min(parseInt(c) - 1, lines.length - 1));
            cursorCol = 0; clampCursor();
        } else if (rest.startsWith('/')) {
            lastSearch = rest.slice(1); searchDirection = 1; searchForward(lastSearch);
        } else if (rest.startsWith('?')) {
            lastSearch = rest.slice(1); searchDirection = -1; searchBackward(lastSearch);
        } else if (rest.startsWith('s/') || rest.startsWith('s!')) {
            executeSubstitute(rest, rangeStart, rangeEnd);
        } else if (c === 'd' && rangeStart >= 0) {
            saveUndo();
            const s = Math.max(0, rangeStart), e = Math.min(lines.length - 1, rangeEnd);
            const text = lines.slice(s, e + 1).join('\n');
            setRegister(text, true);
            lines.splice(s, e - s + 1);
            if (lines.length === 0) lines = [''];
            cursorRow = Math.min(s, lines.length - 1); modified = true;
        } else if (c === 'y' && rangeStart >= 0) {
            const s = Math.max(0, rangeStart), e = Math.min(lines.length - 1, rangeEnd);
            setYankRegister(lines.slice(s, e + 1).join('\n'), true);
            setStatus((e - s + 1) + ' lines yanked');
        } else if (rest === '' && rangeStart >= 0) {
            // Just a line number or range — go to it
            cursorRow = Math.max(0, Math.min(rangeEnd, lines.length - 1));
            cursorCol = 0; clampCursor();
        } else {
            setStatus('Not an editor command: ' + cmd);
        }
    }

    function executeSubstitute(cmd, rangeStart, rangeEnd) {
        const delim = cmd[1];
        const parts = cmd.slice(2).split(delim);
        if (parts.length < 2) { setStatus('Invalid substitute'); return; }
        const find = parts[0], replace = parts[1], flags = parts[2] || '';
        const global = flags.includes('g');
        const ci = flags.includes('i') || settings.ignorecase;

        saveUndo();
        let count = 0;
        const startR = rangeStart >= 0 ? rangeStart : cursorRow;
        const endR = rangeEnd >= 0 ? rangeEnd : cursorRow;

        for (let r = startR; r <= endR && r < lines.length; r++) {
            if (global) {
                const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g' + (ci ? 'i' : ''));
                const newLine = lines[r].replace(regex, replace);
                if (newLine !== lines[r]) { count++; lines[r] = newLine; }
            } else {
                const idx = ci ? lines[r].toLowerCase().indexOf(find.toLowerCase()) : lines[r].indexOf(find);
                if (idx !== -1) {
                    lines[r] = lines[r].slice(0, idx) + replace + lines[r].slice(idx + find.length);
                    count++;
                }
            }
        }
        modified = count > 0;
        setStatus(count + ' substitution(s)');
    }

    function saveSettings() {
        localStorage.setItem('zztt-vim-settings', JSON.stringify(settings));
    }

    // ── Insert mode ──

    function handleInsertKey(e) {
        if (completionActive) {
            if (e.key === 'Escape') { completionActive = false; return; }
            if (e.ctrlKey && (e.key === 'n' || e.key === 'p')) {
                completionIdx = (completionIdx + (e.key === 'n' ? 1 : -1) + completionList.length) % completionList.length;
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                applyCompletion();
                completionActive = false;
                return;
            }
            completionActive = false;
            // Fall through to normal insert handling
        }

        if (e.key === 'Escape') {
            mode = 'normal';
            cursorCol = Math.max(0, cursorCol - 1);
            clampCursor();
            if (recording) { lastChange = { keys: recordedKeys.slice(0, -1) }; recording = false; }
            return;
        }

        if (e.ctrlKey && e.key === 'n') {
            completionList = gatherCompletions();
            if (completionList.length > 0) { completionActive = true; completionIdx = 0; }
            return;
        }
        if (e.ctrlKey && e.key === 'p') {
            completionList = gatherCompletions();
            if (completionList.length > 0) { completionActive = true; completionIdx = completionList.length - 1; }
            return;
        }

        if (e.key === 'Backspace') {
            if (cursorCol > 0) {
                lines[cursorRow] = lines[cursorRow].slice(0, cursorCol - 1) + lines[cursorRow].slice(cursorCol);
                cursorCol--;
            } else if (cursorRow > 0) {
                cursorCol = lines[cursorRow - 1].length;
                lines[cursorRow - 1] += lines[cursorRow];
                lines.splice(cursorRow, 1); cursorRow--;
            }
            modified = true; return;
        }
        if (e.key === 'Delete') {
            if (cursorCol < lines[cursorRow].length) {
                lines[cursorRow] = lines[cursorRow].slice(0, cursorCol) + lines[cursorRow].slice(cursorCol + 1);
                modified = true;
            }
            return;
        }
        if (e.key === 'Enter') {
            const before = lines[cursorRow].slice(0, cursorCol);
            const after = lines[cursorRow].slice(cursorCol);
            const indent = settings.autoindent ? (before.match(/^\s*/)[0]) : '';
            lines[cursorRow] = before;
            lines.splice(cursorRow + 1, 0, indent + after);
            cursorRow++; cursorCol = indent.length;
            modified = true; return;
        }
        if (e.key === 'Tab') {
            const spaces = ' '.repeat(settings.tabstop);
            lines[cursorRow] = lines[cursorRow].slice(0, cursorCol) + spaces + lines[cursorRow].slice(cursorCol);
            cursorCol += settings.tabstop; modified = true; return;
        }
        if (e.key === 'ArrowLeft') { cursorCol = Math.max(0, cursorCol - 1); return; }
        if (e.key === 'ArrowRight') { cursorCol = Math.min(lines[cursorRow].length, cursorCol + 1); return; }
        if (e.key === 'ArrowUp') { cursorRow = Math.max(0, cursorRow - 1); clampCursor(); return; }
        if (e.key === 'ArrowDown') { cursorRow = Math.min(lines.length - 1, cursorRow + 1); clampCursor(); return; }
        if (e.ctrlKey && e.key === 'w') {
            let c = cursorCol - 1;
            while (c > 0 && lines[cursorRow][c - 1] === ' ') c--;
            while (c > 0 && lines[cursorRow][c - 1] !== ' ') c--;
            lines[cursorRow] = lines[cursorRow].slice(0, c) + lines[cursorRow].slice(cursorCol);
            cursorCol = c; modified = true; return;
        }
        if (e.ctrlKey && e.key === 'u') {
            lines[cursorRow] = lines[cursorRow].slice(cursorCol);
            cursorCol = 0; modified = true; return;
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            lines[cursorRow] = lines[cursorRow].slice(0, cursorCol) + e.key + lines[cursorRow].slice(cursorCol);
            cursorCol++; modified = true;
        }
    }

    // ── Replace mode ──

    function handleReplaceKey(e) {
        if (e.key === 'Escape') { mode = 'normal'; cursorCol = Math.max(0, cursorCol - 1); clampCursor(); return; }
        if (e.key === 'Backspace') { cursorCol = Math.max(0, cursorCol - 1); return; }
        if (e.key === 'ArrowLeft') { cursorCol = Math.max(0, cursorCol - 1); return; }
        if (e.key === 'ArrowRight') { cursorCol = Math.min(lines[cursorRow].length - 1, cursorCol + 1); return; }
        if (e.key === 'ArrowUp') { cursorRow = Math.max(0, cursorRow - 1); clampCursor(); return; }
        if (e.key === 'ArrowDown') { cursorRow = Math.min(lines.length - 1, cursorRow + 1); clampCursor(); return; }
        if (e.key === 'Enter') {
            lines[cursorRow] = lines[cursorRow].slice(0, cursorCol);
            const after = cursorCol < lines[cursorRow].length ? lines[cursorRow].slice(cursorCol + 1) : '';
            lines.splice(cursorRow + 1, 0, after);
            cursorRow++; cursorCol = 0; modified = true; return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            const line = lines[cursorRow];
            if (cursorCol < line.length) lines[cursorRow] = line.slice(0, cursorCol) + e.key + line.slice(cursorCol + 1);
            else lines[cursorRow] += e.key;
            cursorCol++; modified = true;
        }
    }

    // ── Normal mode ──

    function handleNormalKey(e) {
        const key = e.key;

        // ── Register selection ──
        if (waitingForRegister) {
            waitingForRegister = false;
            if (key.length === 1) currentRegister = key;
            return;
        }

        // ── Mark set ──
        if (waitingForMarkSet) {
            waitingForMarkSet = false;
            if (key.length === 1 && /[a-zA-Z]/.test(key)) {
                marks[key] = { row: cursorRow, col: cursorCol };
                localStorage.setItem('zztt-vim-marks', JSON.stringify(marks));
                setStatus('mark ' + key + ' set');
            }
            return;
        }

        // ── Mark jump ──
        if (waitingForMarkJump) {
            const jumpType = waitingForMarkJump;
            waitingForMarkJump = '';
            if (key.length === 1 && marks[key]) {
                cursorRow = marks[key].row;
                cursorCol = jumpType === '`' ? marks[key].col : 0;
                clampCursor(); updateDesiredCol();
            } else {
                setStatus('Mark not set: ' + key);
            }
            return;
        }

        // ── Macro recording start/stop (must come before z/g prefix checks) ──
        if (macroRecording === '?') {
            if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
                macroRecording = key; macroKeys = [];
                setStatus('recording @' + key);
            } else {
                macroRecording = '';
            }
            return;
        }
        if (key === 'q' && macroRecording && macroRecording !== '?') {
            macros[macroRecording] = macroKeys.slice();
            lastMacroRegister = macroRecording;
            localStorage.setItem('zztt-vim-macros', JSON.stringify(macros));
            setStatus('recorded @' + macroRecording);
            macroRecording = ''; macroKeys = [];
            return;
        }

        // ── Waiting for char (r, f, F, t, T) ──
        if (waitingForChar) {
            if (key === 'Escape') { waitingForChar = ''; pendingOp = ''; return; }
            if (key.length !== 1) return;

            if (waitingForChar === 'r') {
                saveUndo();
                const count = getCount() || 1;
                for (let i = 0; i < count && cursorCol + i < lines[cursorRow].length; i++) {
                    lines[cursorRow] = lines[cursorRow].slice(0, cursorCol + i) + key + lines[cursorRow].slice(cursorCol + i + 1);
                }
                modified = true; waitingForChar = ''; return;
            }

            if ('fFtT'.includes(waitingForChar)) {
                const dir = (waitingForChar === 'f' || waitingForChar === 't') ? 1 : -1;
                const till = (waitingForChar === 't' || waitingForChar === 'T');
                lastFindChar = key; lastFindDir = dir; lastFindTill = till;
                const pos = findCharOnLine(key, dir, till, cursorRow, cursorCol);
                if (pos !== -1) {
                    if (pendingOp) {
                        applyOpOnRange(pendingOp, cursorRow, cursorCol, cursorRow, pos, false);
                    } else {
                        cursorCol = pos; updateDesiredCol();
                    }
                }
                waitingForChar = ''; return;
            }
            waitingForChar = ''; return;
        }

        // ── Text object qualifier ──
        if (waitingForTextObjQual) {
            const qual = waitingForTextObjQual;
            waitingForTextObjQual = '';
            const range = getTextObject(qual, key);
            if (range) {
                if (pendingOp) {
                    applyOpOnRange(pendingOp, range.startRow, range.startCol, range.endRow, range.endCol, range.linewise);
                }
            } else {
                pendingOp = '';
            }
            return;
        }

        // ── z prefix ──
        if (zPending) {
            zPending = false;
            if (key === 't') { scrollTop = cursorRow; return; }
            if (key === 'z') {
                let target = cursorRow - Math.floor(TEXT_ROWS / 2);
                scrollTop = Math.max(0, target); return;
            }
            if (key === 'b') {
                let target = cursorRow - TEXT_ROWS + 1;
                scrollTop = Math.max(0, target); return;
            }
            return;
        }

        // ── g prefix ──
        if (gPending) {
            gPending = false;
            if (key === 'g') {
                // gg — go to top (or line N with count)
                const cnt = parseInt(countBuffer) || 0;
                countBuffer = '';
                cursorRow = cnt > 0 ? Math.min(cnt - 1, lines.length - 1) : 0;
                cursorCol = 0; clampCursor(); updateDesiredCol(); return;
            }
            if (key === 'j') {
                // gj — move down by display line (for wrapped lines)
                cursorRow = Math.min(lines.length - 1, cursorRow + 1);
                clampCursor(); return;
            }
            if (key === 'k') {
                cursorRow = Math.max(0, cursorRow - 1);
                clampCursor(); return;
            }
            if (key === 'd') {
                // gd — search for word under cursor (simple "go to definition")
                const word = getWordUnderCursor();
                if (word) { lastSearch = word; searchDirection = 1; cursorRow = 0; cursorCol = 0; searchForward(word); }
                return;
            }
            if (key === 'f') {
                // gf — open file under cursor
                const word = getWordUnderCursor();
                if (word) loadFile(word);
                return;
            }
            if (key === '~' && pendingOp === '') {
                // g~ — toggle case operator
                pendingOp = 'g~'; return;
            }
            if (key === 'u' && pendingOp === '') {
                pendingOp = 'gu'; return;
            }
            if (key === 'U' && pendingOp === '') {
                pendingOp = 'gU'; return;
            }
            // g~ g~, gu u, gU U — whole line
            if (key === '~' && pendingOp === 'g~') {
                applyOpOnRange('g~', cursorRow, 0, cursorRow, lines[cursorRow].length - 1, false);
                return;
            }
            return;
        }

        // ── Number prefix ──
        if (key >= '1' && key <= '9' && !pendingOp) { countBuffer += key; return; }
        if (key === '0' && countBuffer.length > 0) { countBuffer += key; return; }

        const count = (key !== '0' || countBuffer.length > 0) ? getCount() : 1;
        if (key !== '0') countBuffer = '';

        // ── Prefixes ──
        if (key === 'g' && !pendingOp) { gPending = true; return; }
        if (key === 'g' && pendingOp) {
            // Could be operator g (e.g., dgg)
            gPending = true; return;
        }
        if (key === 'z') { zPending = true; return; }
        if (key === '"') { waitingForRegister = true; return; }
        if (key === 'm') { waitingForMarkSet = true; return; }
        if (key === "'" || key === '`') { waitingForMarkJump = key; return; }

        // ── Visual mode toggles ──
        if (key === 'v' && mode === 'normal') { mode = 'visual'; visualStart = { row: cursorRow, col: cursorCol }; return; }
        if (key === 'V' && mode === 'normal') { mode = 'visualline'; visualStart = { row: cursorRow, col: 0 }; return; }
        if (e.ctrlKey && key === 'v' && mode === 'normal') { mode = 'visualblock'; visualStart = { row: cursorRow, col: cursorCol }; return; }
        if (key === 'v' && mode === 'visual') { mode = 'normal'; visualStart = null; return; }
        if (key === 'V' && mode === 'visualline') { mode = 'normal'; visualStart = null; return; }
        if (key === 'v' && mode === 'visualline') { mode = 'visual'; return; }
        if (key === 'V' && mode === 'visual') { mode = 'visualline'; return; }
        if (key === 'Escape') {
            if (mode !== 'normal') { mode = 'normal'; visualStart = null; }
            pendingOp = ''; waitingForChar = ''; waitingForTextObjQual = ''; gPending = false; zPending = false;
            return;
        }

        // ── Visual mode operations ──
        if ((mode === 'visual' || mode === 'visualline' || mode === 'visualblock') && (key === 'd' || key === 'x')) { deleteVisualRange(); return; }
        if ((mode === 'visual' || mode === 'visualline' || mode === 'visualblock') && key === 'y') {
            setYankRegister(getVisualText(), mode === 'visualline');
            setStatus('yanked');
            mode = 'normal'; visualStart = null; return;
        }
        if ((mode === 'visual' || mode === 'visualline') && key === 'c') {
            deleteVisualRange(); mode = 'insert'; setStatus('-- INSERT --'); return;
        }
        if ((mode === 'visual' || mode === 'visualline' || mode === 'visualblock') && key === '>') {
            const range = getVisualRange();
            if (range) { saveUndo(); for (let r = range.startRow; r <= range.endRow; r++) lines[r] = ' '.repeat(settings.tabstop) + lines[r]; modified = true; }
            mode = 'normal'; visualStart = null; return;
        }
        if ((mode === 'visual' || mode === 'visualline' || mode === 'visualblock') && key === '<') {
            const range = getVisualRange();
            if (range) { saveUndo(); const re = new RegExp('^ {1,' + settings.tabstop + '}'); for (let r = range.startRow; r <= range.endRow; r++) lines[r] = lines[r].replace(re, ''); modified = true; }
            mode = 'normal'; visualStart = null; return;
        }
        if ((mode === 'visual' || mode === 'visualline') && key === '~') {
            const range = getVisualRange();
            if (range) {
                saveUndo();
                for (let r = range.startRow; r <= range.endRow; r++) {
                    const sc = (mode === 'visualline' || r !== range.startRow) ? 0 : range.startCol;
                    const ec = (mode === 'visualline' || r !== range.endRow) ? lines[r].length - 1 : range.endCol;
                    let chars = lines[r].split('');
                    for (let c = sc; c <= ec && c < chars.length; c++) {
                        chars[c] = chars[c] === chars[c].toUpperCase() ? chars[c].toLowerCase() : chars[c].toUpperCase();
                    }
                    lines[r] = chars.join('');
                }
                modified = true;
            }
            mode = 'normal'; visualStart = null; return;
        }
        if ((mode === 'visual' || mode === 'visualline') && key === 'U') {
            const range = getVisualRange();
            if (range) {
                saveUndo();
                for (let r = range.startRow; r <= range.endRow; r++) {
                    const sc = (mode === 'visualline' || r !== range.startRow) ? 0 : range.startCol;
                    const ec = (mode === 'visualline' || r !== range.endRow) ? lines[r].length - 1 : range.endCol;
                    let chars = lines[r].split('');
                    for (let c = sc; c <= ec && c < chars.length; c++) chars[c] = chars[c].toUpperCase();
                    lines[r] = chars.join('');
                }
                modified = true;
            }
            mode = 'normal'; visualStart = null; return;
        }
        if ((mode === 'visual' || mode === 'visualline') && key === 'u') {
            const range = getVisualRange();
            if (range) {
                saveUndo();
                for (let r = range.startRow; r <= range.endRow; r++) {
                    const sc = (mode === 'visualline' || r !== range.startRow) ? 0 : range.startCol;
                    const ec = (mode === 'visualline' || r !== range.endRow) ? lines[r].length - 1 : range.endCol;
                    let chars = lines[r].split('');
                    for (let c = sc; c <= ec && c < chars.length; c++) chars[c] = chars[c].toLowerCase();
                    lines[r] = chars.join('');
                }
                modified = true;
            }
            mode = 'normal'; visualStart = null; return;
        }
        // Visual block insert
        if (mode === 'visualblock' && (key === 'I' || key === 'A')) {
            // TODO: block insert is complex, just enter insert for now
            mode = 'normal'; visualStart = null;
            mode = 'insert'; setStatus('-- INSERT --'); return;
        }

        // ── Doubled operators (dd, yy, cc, >>, <<) ──
        if (pendingOp === 'd' && key === 'd') {
            saveUndo();
            const delLines = [];
            for (let i = 0; i < pendingCount && cursorRow < lines.length; i++) {
                delLines.push(lines[cursorRow]);
                if (lines.length === 1) { lines[0] = ''; break; }
                lines.splice(cursorRow, 1);
                if (cursorRow >= lines.length) cursorRow = lines.length - 1;
            }
            setRegister(delLines.join('\n'), true);
            modified = true; pendingOp = ''; clampCursor(); return;
        }
        if (pendingOp === 'y' && key === 'y') {
            const yankLines = [];
            for (let i = 0; i < pendingCount && cursorRow + i < lines.length; i++) yankLines.push(lines[cursorRow + i]);
            setYankRegister(yankLines.join('\n'), true);
            setStatus(yankLines.length + ' line(s) yanked');
            pendingOp = ''; return;
        }
        if (pendingOp === 'c' && key === 'c') {
            saveUndo();
            setRegister(lines[cursorRow], true);
            const indent = lines[cursorRow].match(/^\s*/)[0];
            lines[cursorRow] = indent; cursorCol = indent.length;
            modified = true; pendingOp = '';
            mode = 'insert'; setStatus('-- INSERT --'); return;
        }
        if (pendingOp === '>' && key === '>') {
            saveUndo();
            for (let i = 0; i < pendingCount && cursorRow + i < lines.length; i++) lines[cursorRow + i] = ' '.repeat(settings.tabstop) + lines[cursorRow + i];
            modified = true; pendingOp = ''; return;
        }
        if (pendingOp === '<' && key === '<') {
            saveUndo();
            const re = new RegExp('^ {1,' + settings.tabstop + '}');
            for (let i = 0; i < pendingCount && cursorRow + i < lines.length; i++) lines[cursorRow + i] = lines[cursorRow + i].replace(re, '');
            modified = true; pendingOp = ''; return;
        }
        // g~g~, guu, gUU — whole line
        if (pendingOp === 'g~' && key === '~') { applyOpOnRange('g~', cursorRow, 0, cursorRow, lines[cursorRow].length - 1); return; }
        if (pendingOp === 'gu' && key === 'u') { applyOpOnRange('gu', cursorRow, 0, cursorRow, lines[cursorRow].length - 1); return; }
        if (pendingOp === 'gU' && key === 'U') { applyOpOnRange('gU', cursorRow, 0, cursorRow, lines[cursorRow].length - 1); return; }

        // ── Operator + motion ──
        if (pendingOp) {
            // Text object qualifiers
            if (key === 'i' || key === 'a') {
                waitingForTextObjQual = key; return;
            }
            // Find char
            if ('fFtT'.includes(key)) { waitingForChar = key; return; }
            // g prefix for motions like gg
            if (key === 'g') { gPending = true; return; }

            // Standard motions
            let target = null;
            if (key === 'h' || key === 'ArrowLeft') target = { row: cursorRow, col: Math.max(0, cursorCol - count) };
            else if (key === 'l' || key === 'ArrowRight') target = { row: cursorRow, col: Math.min(lines[cursorRow].length - 1, cursorCol + count) };
            else if (key === 'j' || key === 'ArrowDown') target = { row: Math.min(lines.length - 1, cursorRow + count), col: cursorCol, linewise: true };
            else if (key === 'k' || key === 'ArrowUp') target = { row: Math.max(0, cursorRow - count), col: cursorCol, linewise: true };
            else if (key === 'w') {
                // cw/cW is special in vim: acts like ce/cE (doesn't include trailing space)
                if (pendingOp === 'c') {
                    let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) p = wordEnd(p.row, p.col); target = p;
                } else {
                    let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) p = wordForward(p.row, p.col); if (p.row === cursorRow) p.col = Math.max(cursorCol, p.col - 1); target = p;
                }
            }
            else if (key === 'W') {
                if (pendingOp === 'c') {
                    let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) p = wordEnd(p.row, p.col); target = p;
                } else {
                    let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) p = WORDForward(p.row, p.col); if (p.row === cursorRow) p.col = Math.max(cursorCol, p.col - 1); target = p;
                }
            }
            else if (key === 'e') { let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) p = wordEnd(p.row, p.col); target = p; }
            else if (key === 'b') { let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) p = wordBack(p.row, p.col); target = p; }
            else if (key === '0') target = { row: cursorRow, col: 0 };
            else if (key === '$') target = { row: cursorRow, col: Math.max(0, lines[cursorRow].length - 1) };
            else if (key === '^') { const m = lines[cursorRow].match(/^\s*/); target = { row: cursorRow, col: m ? m[0].length : 0 }; }
            else if (key === 'G') target = { row: lines.length - 1, col: 0, linewise: true };
            else if (key === '%') { const m = findMatchingBracket(cursorRow, cursorCol); if (m) target = m; }
            else if (key === '{') target = { row: paragraphBack(cursorRow), col: 0, linewise: true };
            else if (key === '}') target = { row: paragraphForward(cursorRow), col: 0, linewise: true };

            if (target) {
                if (target.linewise) {
                    const sr = Math.min(cursorRow, target.row), er = Math.max(cursorRow, target.row);
                    applyOpOnRange(pendingOp, sr, 0, er, lines[er].length - 1, true);
                } else {
                    applyOpOnRange(pendingOp, cursorRow, cursorCol, target.row, target.col, false);
                }
            } else {
                pendingOp = '';
            }
            return;
        }

        // ── Start operators ──
        if ('dyc'.includes(key) && mode === 'normal') { pendingOp = key; pendingCount = count; return; }
        if ((key === '>' || key === '<') && mode === 'normal') { pendingOp = key; pendingCount = count; return; }

        // ── Movement ──
        if (key === 'h' || key === 'ArrowLeft') { for (let i = 0; i < count; i++) cursorCol--; clampCursor(); updateDesiredCol(); return; }
        if (key === 'l' || key === 'ArrowRight') { for (let i = 0; i < count; i++) cursorCol++; clampCursor(); updateDesiredCol(); return; }
        if (key === 'j' || key === 'ArrowDown') {
            cursorRow = Math.min(lines.length - 1, cursorRow + count);
            cursorCol = desiredCol; clampCursor(); return;
        }
        if (key === 'k' || key === 'ArrowUp') {
            cursorRow = Math.max(0, cursorRow - count);
            cursorCol = desiredCol; clampCursor(); return;
        }
        if (key === 'w') { let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) p = wordForward(p.row, p.col); cursorRow = p.row; cursorCol = p.col; clampCursor(); updateDesiredCol(); return; }
        if (key === 'W') { let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) p = WORDForward(p.row, p.col); cursorRow = p.row; cursorCol = p.col; clampCursor(); updateDesiredCol(); return; }
        if (key === 'e') { let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) p = wordEnd(p.row, p.col); cursorRow = p.row; cursorCol = p.col; clampCursor(); updateDesiredCol(); return; }
        if (key === 'b') { let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) p = wordBack(p.row, p.col); cursorRow = p.row; cursorCol = p.col; clampCursor(); updateDesiredCol(); return; }
        if (key === 'B') { let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) { let c = p.col - 1; if (c < 0 && p.row > 0) { p.row--; c = lines[p.row].length - 1; } while (c > 0 && !isWORDChar(lines[p.row][c])) c--; while (c > 0 && isWORDChar(lines[p.row][c - 1])) c--; p.col = c; } cursorRow = p.row; cursorCol = p.col; clampCursor(); updateDesiredCol(); return; }
        if (key === 'E') { let p = { row: cursorRow, col: cursorCol }; for (let i = 0; i < count; i++) { let r = p.row, c = p.col + 1; if (c >= lines[r].length) { if (r < lines.length - 1) { r++; c = 0; } } while (c < lines[r].length && !isWORDChar(lines[r][c])) c++; while (c + 1 < lines[r].length && isWORDChar(lines[r][c + 1])) c++; p = { row: r, col: c }; } cursorRow = p.row; cursorCol = p.col; clampCursor(); updateDesiredCol(); return; }

        if (key === '0') { cursorCol = 0; updateDesiredCol(); return; }
        if (key === '$') { cursorCol = Math.max(0, lines[cursorRow].length - 1); updateDesiredCol(); return; }
        if (key === '^') { const m = lines[cursorRow].match(/^\s*/); cursorCol = m ? m[0].length : 0; updateDesiredCol(); clampCursor(); return; }
        if (key === '_') { const m = lines[cursorRow].match(/^\s*/); cursorCol = m ? m[0].length : 0; updateDesiredCol(); return; }

        if (key === 'G') { cursorRow = count > 1 ? Math.min(count - 1, lines.length - 1) : lines.length - 1; cursorCol = 0; clampCursor(); updateDesiredCol(); return; }
        if (key === '{') { for (let i = 0; i < count; i++) cursorRow = paragraphBack(cursorRow); cursorCol = 0; clampCursor(); updateDesiredCol(); return; }
        if (key === '}') { for (let i = 0; i < count; i++) cursorRow = paragraphForward(cursorRow); cursorCol = 0; clampCursor(); updateDesiredCol(); return; }
        if (key === '%') { const m = findMatchingBracket(cursorRow, cursorCol); if (m) { cursorRow = m.row; cursorCol = m.col; clampCursor(); updateDesiredCol(); } return; }

        if (key === 'H') { cursorRow = getScreenTopLine(); cursorCol = 0; clampCursor(); updateDesiredCol(); return; }
        if (key === 'M') { cursorRow = getScreenMiddleLine(); cursorCol = 0; clampCursor(); updateDesiredCol(); return; }
        if (key === 'L') { cursorRow = getScreenBottomLine(); cursorCol = 0; clampCursor(); updateDesiredCol(); return; }

        if ('fFtT'.includes(key)) { waitingForChar = key; return; }
        if (key === ';') { if (lastFindChar) { const p = findCharOnLine(lastFindChar, lastFindDir, lastFindTill, cursorRow, cursorCol); if (p !== -1) { cursorCol = p; updateDesiredCol(); } } return; }
        if (key === ',') { if (lastFindChar) { const p = findCharOnLine(lastFindChar, -lastFindDir, lastFindTill, cursorRow, cursorCol); if (p !== -1) { cursorCol = p; updateDesiredCol(); } } return; }

        // ── Scrolling ──
        if (e.ctrlKey && key === 'd') { cursorRow = Math.min(lines.length - 1, cursorRow + Math.floor(TEXT_ROWS / 2)); cursorCol = desiredCol; clampCursor(); return; }
        if (e.ctrlKey && key === 'u') { cursorRow = Math.max(0, cursorRow - Math.floor(TEXT_ROWS / 2)); cursorCol = desiredCol; clampCursor(); return; }
        if (e.ctrlKey && key === 'f') { cursorRow = Math.min(lines.length - 1, cursorRow + TEXT_ROWS); cursorCol = desiredCol; clampCursor(); return; }
        if (e.ctrlKey && key === 'b') { cursorRow = Math.max(0, cursorRow - TEXT_ROWS); cursorCol = desiredCol; clampCursor(); return; }
        if (e.ctrlKey && key === 'e') { scrollTop = Math.min(lines.length - 1, scrollTop + 1); return; }
        if (e.ctrlKey && key === 'y') { scrollTop = Math.max(0, scrollTop - 1); return; }
        if (e.ctrlKey && key === 'r') { redo(); return; }

        // ── Macros ──
        if (key === 'q' && !macroRecording) {
            // Start recording — next key is the register
            setStatus('recording...');
            // We need to wait for the next key
            macroRecording = '?'; macroKeys = [];
            return;
        }
        // (macro q start for non-recording handled below in editing section)
        if (key === '@') {
            // Play macro — need next key for register
            waitingForMacroPlay = true;
            return;
        }

        // ── Editing ──
        if (key === 'i') { saveUndo(); recording = true; recordedKeys = []; mode = 'insert'; setStatus('-- INSERT --'); return; }
        if (key === 'a') { saveUndo(); recording = true; recordedKeys = []; cursorCol = Math.min(cursorCol + 1, lines[cursorRow].length); mode = 'insert'; setStatus('-- INSERT --'); return; }
        if (key === 'A') { saveUndo(); recording = true; recordedKeys = []; cursorCol = lines[cursorRow].length; mode = 'insert'; setStatus('-- INSERT --'); return; }
        if (key === 'I') { saveUndo(); recording = true; recordedKeys = []; const m = lines[cursorRow].match(/^\s*/); cursorCol = m ? m[0].length : 0; mode = 'insert'; setStatus('-- INSERT --'); return; }
        if (key === 'o') { saveUndo(); recording = true; recordedKeys = []; const indent = settings.autoindent ? lines[cursorRow].match(/^\s*/)[0] : ''; lines.splice(cursorRow + 1, 0, indent); cursorRow++; cursorCol = indent.length; mode = 'insert'; modified = true; setStatus('-- INSERT --'); return; }
        if (key === 'O') { saveUndo(); recording = true; recordedKeys = []; const indent = settings.autoindent ? lines[cursorRow].match(/^\s*/)[0] : ''; lines.splice(cursorRow, 0, indent); cursorCol = indent.length; mode = 'insert'; modified = true; setStatus('-- INSERT --'); return; }
        if (key === 'R') { saveUndo(); mode = 'replace'; setStatus('-- REPLACE --'); return; }
        if (key === 'r') { waitingForChar = 'r'; return; }
        if (key === 's') { saveUndo(); if (lines[cursorRow].length > 0) { setRegister(lines[cursorRow][cursorCol], false); lines[cursorRow] = lines[cursorRow].slice(0, cursorCol) + lines[cursorRow].slice(cursorCol + 1); modified = true; } mode = 'insert'; setStatus('-- INSERT --'); return; }
        if (key === 'S') { saveUndo(); setRegister(lines[cursorRow], true); const indent = settings.autoindent ? lines[cursorRow].match(/^\s*/)[0] : ''; lines[cursorRow] = indent; cursorCol = indent.length; modified = true; mode = 'insert'; setStatus('-- INSERT --'); return; }
        if (key === 'C') { saveUndo(); setRegister(lines[cursorRow].slice(cursorCol), false); lines[cursorRow] = lines[cursorRow].slice(0, cursorCol); modified = true; mode = 'insert'; setStatus('-- INSERT --'); return; }
        if (key === 'D') { saveUndo(); setRegister(lines[cursorRow].slice(cursorCol), false); lines[cursorRow] = lines[cursorRow].slice(0, cursorCol); modified = true; clampCursor(); return; }

        if (key === 'x') {
            if (lines[cursorRow].length > 0) {
                saveUndo();
                let deleted = '';
                for (let i = 0; i < count && cursorCol < lines[cursorRow].length; i++) {
                    deleted += lines[cursorRow][cursorCol];
                    lines[cursorRow] = lines[cursorRow].slice(0, cursorCol) + lines[cursorRow].slice(cursorCol + 1);
                }
                setRegister(deleted, false);
                clampCursor(); modified = true;
            }
            return;
        }
        if (key === 'X') {
            if (cursorCol > 0) {
                saveUndo(); let deleted = '';
                for (let i = 0; i < count && cursorCol > 0; i++) {
                    cursorCol--;
                    deleted = lines[cursorRow][cursorCol] + deleted;
                    lines[cursorRow] = lines[cursorRow].slice(0, cursorCol) + lines[cursorRow].slice(cursorCol + 1);
                }
                setRegister(deleted, false);
                clampCursor(); modified = true;
            }
            return;
        }

        // ~ toggle case at cursor
        if (key === '~') {
            saveUndo();
            for (let i = 0; i < count && cursorCol < lines[cursorRow].length; i++) {
                const ch = lines[cursorRow][cursorCol];
                const toggled = ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
                lines[cursorRow] = lines[cursorRow].slice(0, cursorCol) + toggled + lines[cursorRow].slice(cursorCol + 1);
                cursorCol++;
            }
            clampCursor(); updateDesiredCol(); modified = true; return;
        }

        // p/P — paste
        if (key === 'p') {
            saveUndo();
            const reg = getRegister();
            if (reg.isLine) {
                const pasteLines = reg.text.split('\n');
                lines.splice(cursorRow + 1, 0, ...pasteLines);
                cursorRow++; cursorCol = 0;
            } else {
                lines[cursorRow] = lines[cursorRow].slice(0, cursorCol + 1) + reg.text + lines[cursorRow].slice(cursorCol + 1);
                cursorCol += reg.text.length;
            }
            modified = true; clampCursor(); updateDesiredCol(); return;
        }
        if (key === 'P') {
            saveUndo();
            const reg = getRegister();
            if (reg.isLine) {
                const pasteLines = reg.text.split('\n');
                lines.splice(cursorRow, 0, ...pasteLines);
                cursorCol = 0;
            } else {
                lines[cursorRow] = lines[cursorRow].slice(0, cursorCol) + reg.text + lines[cursorRow].slice(cursorCol);
            }
            modified = true; clampCursor(); updateDesiredCol(); return;
        }

        if (key === 'u' && mode === 'normal') { undo(); return; }
        if (key === 'J') {
            if (cursorRow < lines.length - 1) {
                saveUndo();
                const joinCol = lines[cursorRow].length;
                lines[cursorRow] += ' ' + lines[cursorRow + 1].trimStart();
                lines.splice(cursorRow + 1, 1);
                cursorCol = joinCol; modified = true;
            }
            return;
        }

        // . — dot repeat
        if (key === '.') {
            if (lastChange && lastChange.keys.length > 0) {
                replaying = true;
                saveUndo();
                for (const k of lastChange.keys) {
                    const fake = { key: k.key || k, ctrlKey: k.ctrlKey || false, shiftKey: k.shiftKey || false, metaKey: false, preventDefault() {}, stopPropagation() {} };
                    if (mode === 'insert') handleInsertKey(fake);
                    else if (mode === 'replace') handleReplaceKey(fake);
                    else handleNormalKey(fake);
                }
                replaying = false;
            }
            return;
        }

        // n/N — search
        if (key === 'n') { if (lastSearch) { (searchDirection === 1 ? searchForward : searchBackward)(lastSearch); updateDesiredCol(); } return; }
        if (key === 'N') { if (lastSearch) { (searchDirection === 1 ? searchBackward : searchForward)(lastSearch); updateDesiredCol(); } return; }
        if (key === '*') { const w = getWordUnderCursor(); if (w) { lastSearch = w; searchDirection = 1; searchForward(w); } return; }
        if (key === '#') { const w = getWordUnderCursor(); if (w) { lastSearch = w; searchDirection = -1; searchBackward(w); } return; }

        // Enter command mode
        if (key === ':') { mode = 'command'; cmdBuffer = ''; cmdHistoryIdx = -1; return; }
        if (key === '/') { mode = 'command'; cmdBuffer = '/'; cmdHistoryIdx = -1; return; }
        if (key === '?') { mode = 'command'; cmdBuffer = '?'; cmdHistoryIdx = -1; return; }
    }

    // ── Macro playback ──
    let waitingForMacroPlay = false;

    const origHandleNormalKey = handleNormalKey;
    const wrappedHandleNormalKey = function(e) {
        if (waitingForMacroPlay) {
            waitingForMacroPlay = false;
            const reg = e.key === '@' ? lastMacroRegister : e.key;
            if (macros[reg]) {
                lastMacroRegister = reg;
                replaying = true;
                for (const k of macros[reg]) {
                    const fake = { key: k.key, ctrlKey: k.ctrlKey || false, shiftKey: k.shiftKey || false, metaKey: false, preventDefault() {}, stopPropagation() {} };
                    if (mode === 'insert') handleInsertKey(fake);
                    else if (mode === 'replace') handleReplaceKey(fake);
                    else if (mode === 'command') handleCommandKey(fake);
                    else handleNormalKey(fake);
                    renderFrame();
                }
                replaying = false;
            } else {
                setStatus('No macro in register ' + reg);
            }
            return;
        }
        origHandleNormalKey(e);
    };
    handleNormalKey = wrappedHandleNormalKey;

    // ══════════════════════════════════════
    // Syntax Highlighting
    // ══════════════════════════════════════

    const KEYWORDS = new Set(['function','const','let','var','if','else','for','while','do','return','switch','case','break','continue','new','delete','typeof','instanceof','in','of','class','extends','import','export','default','from','try','catch','finally','throw','async','await','yield','this','super','null','undefined','true','false','void','static','get','set']);

    function getSyntaxColor(line, col) {
        if (!settings.syntax) return null;

        // Check if inside a string
        let inString = false, stringChar = '';
        for (let c = 0; c < col; c++) {
            if (!inString && (line[c] === '"' || line[c] === "'" || line[c] === '`') && (c === 0 || line[c - 1] !== '\\')) {
                inString = true; stringChar = line[c];
            } else if (inString && line[c] === stringChar && line[c - 1] !== '\\') {
                inString = false;
            }
        }
        if (inString) return '#ce9178'; // orange for strings
        if ((line[col] === '"' || line[col] === "'" || line[col] === '`')) return '#ce9178';

        // Check if in a comment
        const slashSlash = line.indexOf('//');
        if (slashSlash !== -1 && col >= slashSlash) return '#6a9955'; // green for comments

        // Check for numbers
        if (/[0-9]/.test(line[col]) && (col === 0 || !isWordChar(line[col - 1]))) return '#b5cea8';

        // Check for keywords
        if (isWordChar(line[col])) {
            let start = col, end = col;
            while (start > 0 && isWordChar(line[start - 1])) start--;
            while (end < line.length - 1 && isWordChar(line[end + 1])) end++;
            const word = line.slice(start, end + 1);
            if (KEYWORDS.has(word)) return '#569cd6'; // blue for keywords
        }

        return null;
    }

    // ══════════════════════════════════════
    // Rendering
    // ══════════════════════════════════════

    function renderFrame() {
        for (let i = 0; i < fb.length; i++) { fb[i].char = ' '; fb[i].color = '#000'; }

        if (statusTimer > 0) statusTimer--;

        // Search highlights
        let searchHL = {};
        if (lastSearch && settings.hlsearch) {
            const ci = settings.ignorecase;
            const t = ci ? lastSearch.toLowerCase() : lastSearch;
            for (let r = scrollTop; r < lines.length && r < scrollTop + TEXT_ROWS + 20; r++) {
                const line = ci ? lines[r].toLowerCase() : lines[r];
                let idx = 0;
                while ((idx = line.indexOf(t, idx)) !== -1) {
                    for (let c = 0; c < lastSearch.length; c++) searchHL[r + ',' + (idx + c)] = true;
                    idx++;
                }
            }
        }

        // Draw text
        let screenRow = 0;
        let cursorSR = -1, cursorSC = -1;
        let lineIdx = scrollTop;

        while (screenRow < TEXT_ROWS && lineIdx < lines.length) {
            const line = lines[lineIdx];
            const wrappedRows = settings.wrap ? Math.max(1, Math.ceil((line.length + 1) / TEXT_COLS)) : 1;

            // Line numbers
            if (settings.number) {
                const numStr = String(lineIdx + 1).padStart(3, ' ') + ' ';
                for (let c = 0; c < numStr.length; c++) setFB(c, screenRow, numStr[c], lineIdx === cursorRow ? '#aaa' : '#888');
            }

            for (let wrap = 0; wrap < wrappedRows && screenRow < TEXT_ROWS; wrap++) {
                const charStart = wrap * TEXT_COLS;
                if (wrap > 0 && settings.number) setFB(4, screenRow, '\\', '#7a7aaa');

                const maxC = settings.wrap ? TEXT_COLS : Math.min(TEXT_COLS, line.length - charStart);
                for (let sc = 0; sc < maxC && charStart + sc < line.length; sc++) {
                    const c = charStart + sc;
                    const isVis = isInSelection(lineIdx, c);
                    const isSrch = searchHL[lineIdx + ',' + c];
                    let color = '#00d4ff';
                    const synColor = getSyntaxColor(line, c);
                    if (synColor) color = synColor;
                    if (isVis) color = '#ffffff';
                    else if (isSrch) color = '#ffe138';
                    setFB(5 + sc, screenRow, line[c], color);
                }

                if (lineIdx === cursorRow) {
                    if (cursorCol >= charStart && cursorCol < charStart + TEXT_COLS) {
                        cursorSR = screenRow; cursorSC = cursorCol - charStart;
                    }
                    if (cursorCol === line.length && cursorCol >= charStart && cursorCol < charStart + TEXT_COLS) {
                        cursorSR = screenRow; cursorSC = cursorCol - charStart;
                    }
                }
                screenRow++;
            }
            lineIdx++;
        }
        while (screenRow < TEXT_ROWS) { setFB(0, screenRow, '~', '#7a7aaa'); screenRow++; }

        // Cursor
        if (cursorSR >= 0 && cursorSR < TEXT_ROWS) {
            const cx = 5 + cursorSC;
            const ch = cursorCol < lines[cursorRow].length ? lines[cursorRow][cursorCol] : ' ';
            if (mode === 'insert') setFB(cx, cursorSR, '|', '#fff');
            else if (mode === 'replace') { setFB(cx, cursorSR, ch === ' ' ? '_' : ch, '#ff4757'); }
            else { setFB(cx, cursorSR, ch === ' ' ? '_' : ch, '#00ff00'); }
        }

        // Completion popup
        if (completionActive && completionList.length > 0) {
            const popupRow = (cursorSR || 0) + 1;
            const popupCol = 5 + (cursorSC || 0);
            const maxShow = Math.min(5, completionList.length);
            for (let i = 0; i < maxShow; i++) {
                const word = completionList[(completionIdx - Math.min(completionIdx, 2) + i) % completionList.length];
                const isSel = ((completionIdx - Math.min(completionIdx, 2) + i) % completionList.length) === completionIdx;
                for (let c = 0; c < word.length && popupCol + c < COLS; c++) {
                    setFB(popupCol + c, popupRow + i, word[c], isSel ? '#000' : '#bbb');
                }
            }
        }

        // Status line
        const sRow = TROWS - 2;
        for (let c = 0; c < COLS; c++) setFB(c, sRow, ' ', '#222');

        const fileStr = ' ' + currentFile + (modified ? ' [+]' : '');
        for (let c = 0; c < fileStr.length && c < COLS; c++) setFB(c, sRow, fileStr[c], '#aaa');

        const modeNames = { normal: ' NORMAL ', insert: ' INSERT ', replace: ' REPLACE ', visual: ' VISUAL ', visualline: ' V-LINE ', visualblock: ' V-BLOCK ', command: ' COMMAND ' };
        const modeColors = { normal: '#bbb', insert: '#00d4ff', replace: '#ff4757', visual: '#a35dff', visualline: '#a35dff', visualblock: '#a35dff', command: '#ffe138' };
        const modeStr = modeNames[mode] || '';
        const modeStart = fileStr.length + 1;
        for (let c = 0; c < modeStr.length; c++) setFB(modeStart + c, sRow, modeStr[c], modeColors[mode] || '#bbb');

        if (macroRecording && macroRecording !== '?') {
            const recStr = ' @' + macroRecording;
            for (let c = 0; c < recStr.length; c++) setFB(modeStart + modeStr.length + c, sRow, recStr[c], '#ff4757');
        }

        const posStr = (cursorRow + 1) + ':' + (cursorCol + 1) + '  ' + lines.length + 'L ';
        const posStart = COLS - posStr.length;
        for (let c = 0; c < posStr.length; c++) setFB(posStart + c, sRow, posStr[c], '#bbb');

        if (pendingOp) setFB(posStart - 3, sRow, pendingOp.length > 1 ? pendingOp[1] : pendingOp, '#ffe138');

        // Command/message line
        const cRow = TROWS - 1;
        if (mode === 'command') {
            const t = ':' + cmdBuffer + '_';
            for (let c = 0; c < t.length && c < COLS; c++) setFB(c, cRow, t[c], '#fff');
        } else if (waitingForChar) {
            setFB(0, cRow, waitingForChar, '#ffe138'); setFB(1, cRow, '?', '#ffe138');
        } else if (waitingForMacroPlay) {
            setFB(0, cRow, '@', '#ffe138'); setFB(1, cRow, '?', '#ffe138');
        } else if (statusTimer > 0 && statusMsg) {
            for (let c = 0; c < statusMsg.length && c < COLS; c++) setFB(c, cRow, statusMsg[c], '#bbb');
        }
    }

    function isInSelection(row, col) {
        if (!visualStart) return false;
        if (mode === 'visualline') {
            const sr = Math.min(visualStart.row, cursorRow), er = Math.max(visualStart.row, cursorRow);
            return row >= sr && row <= er;
        }
        if (mode === 'visualblock') {
            const sr = Math.min(visualStart.row, cursorRow), er = Math.max(visualStart.row, cursorRow);
            const sc = Math.min(visualStart.col, cursorCol), ec = Math.max(visualStart.col, cursorCol);
            return row >= sr && row <= er && col >= sc && col <= ec;
        }
        // visual (characterwise)
        let sr = visualStart.row, sc = visualStart.col, er = cursorRow, ec = cursorCol;
        if (sr > er || (sr === er && sc > ec)) { [sr, er] = [er, sr]; [sc, ec] = [ec, sc]; }
        if (row < sr || row > er) return false;
        if (row === sr && row === er) return col >= sc && col <= ec;
        if (row === sr) return col >= sc;
        if (row === er) return col <= ec;
        return true;
    }

    function setFB(x, y, char, color) {
        if (x < 0 || x >= COLS || y < 0 || y >= TROWS) return;
        fb[y * COLS + x] = { char, color };
    }

    // ══════════════════════════════════════
    // Interface
    // ══════════════════════════════════════

    let vimQuitCallback = null;

    document.addEventListener('keydown', onKeyDown, true);
    renderFrame();

    function resize(nc, nr) {
        boardStartCol = Math.floor(nc / 2) - Math.floor(COLS / 2);
        boardStartRow = Math.floor(nr / 2) - Math.floor(TROWS / 2);
    }

    function getCellOverride(col, row) {
        const bx = col - boardStartCol, by = row - boardStartRow;
        if (bx < 0 || bx >= COLS || by < 0 || by >= TROWS) return null;
        const cell = fb[by * COLS + bx];
        if (cell.char === ' ' && cell.color === '#000') return null;
        return { char: cell.char, color: cell.color };
    }

    return {
        get boardStartCol() { return boardStartCol; },
        get boardStartRow() { return boardStartRow; },
        COLS, TROWS,
        fullClear: true,
        resize,
        getCellOverride,
        getInfoEntries() {
            const e = [], ic = boardStartCol + COLS + 2;
            let ir = boardStartRow + 2;
            e.push({ text: 'VIM', row: ir, col: ic, color: '#00d4ff' }); ir += 2;
            e.push({ text: ':q QUIT', row: ir, col: ic, color: '#888' }); ir++;
            e.push({ text: ':w SAVE', row: ir, col: ic, color: '#888' }); ir++;
            e.push({ text: ':e FILE', row: ir, col: ic, color: '#888' }); ir++;
            e.push({ text: ':help KEYS', row: ir, col: ic, color: '#888' }); ir += 2;
            e.push({ text: ':set OPT', row: ir, col: ic, color: '#888' }); ir++;
            e.push({ text: ':reg', row: ir, col: ic, color: '#888' }); ir++;
            e.push({ text: ':marks', row: ir, col: ic, color: '#888' }); ir++;
            return e;
        },
        getBorderOverride(col, row) {
            const bx = col - boardStartCol, by = row - boardStartRow;
            if (col === boardStartCol - 1 && by >= 0 && by < TROWS) return { char: '|', color: '#7a7aaa' };
            if (col === boardStartCol + COLS && by >= 0 && by < TROWS) return { char: '|', color: '#7a7aaa' };
            if (row === boardStartRow + TROWS && bx >= -1 && bx <= COLS) return { char: '-', color: '#7a7aaa' };
            if (row === boardStartRow - 1 && bx >= -1 && bx <= COLS) return { char: '-', color: '#7a7aaa' };
            return null;
        },
        getOccupiedCells() {
            const cells = [];
            for (let y = 0; y < TROWS; y++) for (let x = 0; x < COLS; x++) {
                const c = fb[y * COLS + x];
                if (c.char !== ' ' || c.color !== '#000') cells.push({ col: boardStartCol + x, row: boardStartRow + y, color: c.color, char: c.char });
            }
            const ck = new Set(cells.map(c => c.col + ',' + c.row));
            const stale = [];
            for (const k of prevOccupiedKeys) { if (!ck.has(k)) { const [c, r] = k.split(',').map(Number); stale.push({ col: c, row: r }); } }
            prevOccupiedKeys = ck; cells.stale = stale;
            return cells;
        },
        set onQuit(cb) { vimQuitCallback = cb; },
        // Test harness — expose internals for testing
        _test: {
            getState() { return { mode, lines: lines.slice(), cursorRow, cursorCol, modified, currentFile, registers: {...registers}, marks: {...marks}, scrollTop }; },
            sendKeys(keys) {
                for (const k of keys) {
                    const fake = { key: k, ctrlKey: false, shiftKey: false, metaKey: false, preventDefault() {}, stopPropagation() {} };
                    onKeyDown(fake);
                }
            },
            sendKey(key, opts) {
                const fake = { key, ctrlKey: opts?.ctrl || false, shiftKey: opts?.shift || false, metaKey: false, preventDefault() {}, stopPropagation() {} };
                onKeyDown(fake);
            },
            setLines(newLines) { lines = newLines.slice(); cursorRow = 0; cursorCol = 0; clampCursor(); },
            setCursor(row, col) { cursorRow = row; cursorCol = col; desiredCol = col; clampCursor(); },
        },
        destroy() {
            destroyed = true;
            document.removeEventListener('keydown', onKeyDown, true);
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initVimRain };
}
