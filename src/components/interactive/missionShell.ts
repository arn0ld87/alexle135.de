/**
 * Mission-Shell für den WebContainer
 *
 * `jsh` findet keine Skripte über PATH (mount() legt Dateien relativ zum Arbeitsverzeichnis ab,
 * nicht nach /bin). Deshalb läuft im Linux-Terminal eine eigene Node-Shell, die die von den
 * Missionen verlangten Befehle selbst ausführt (inkl. Pipelines, Quoting und Umleitungen).
 * Das gemountete Arbeitsverzeichnis ist für die Shell das Wurzelverzeichnis `/`; Pfade wie
 * `/var/log/auth.log` oder `/usr/local/bin/backup` aus den CTF-Missionen funktionieren so.
 *
 * Das Skript ist ein `String.raw`-Template: Es enthält genau den Quelltext, den Node später
 * liest (keine doppelten Escapes, keine Backticks und kein `${…}` im Skript).
 *
 * @module missionShell
 */

export const SHELL_PATH = '.shell/shell.js';

const SHELL_SOURCE = String.raw`
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Das gemountete Arbeitsverzeichnis ist das virtuelle Wurzelverzeichnis "/".
const root = process.cwd();
const HOME = '/home/visitor';
const HOSTNAME = 'alex-schneider.dev';
let cwd = HOME;
let oldpwd = HOME;

const BLUE = '\x1b[34m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

// Rechte und Besitzer, die das Dateisystem des WebContainers nicht abbildet (SUID für die CTF-Missionen).
const META = {
    '/usr/local/bin/backup': { mode: 0o4777, owner: 'root' },
    '/usr/bin/sudo': { mode: 0o4755, owner: 'root' },
};

const vabs = (p) => {
    if (p === '~') return HOME;
    if (p.startsWith('~/')) return path.posix.join(HOME, p.slice(2));
    return path.posix.resolve(cwd, p);
};
const real = (v) => path.join(root, v);
const rp = (p) => real(vabs(p));
const readText = (p) => fs.readFileSync(rp(p), 'utf8');
const listDir = (v) => fs.readdirSync(real(v)).filter((e) => !(v === '/' && e === '.shell')).sort((a, b) => a.localeCompare(b));
const shownCwd = () => {
    if (cwd === HOME) return '~';
    return cwd.startsWith(HOME + '/') ? '~' + cwd.slice(HOME.length) : cwd;
};
const getPrompt = () => GREEN + 'visitor@linux' + RESET + ':' + BLUE + shownCwd() + RESET + '$ ';

// Ausgabe eines Befehls: stdout und stderr getrennt, damit Pipes und 2>/dev/null funktionieren.
let chunks = [];
let stdin = null;
const write = (s) => chunks.push({ err: false, text: s });
const println = (s) => write(s + '\n');
const eprintln = (s) => chunks.push({ err: true, text: s + '\n' });

const splitArgs = (args) => ({
    flags: args.filter((a) => a.length > 1 && a.startsWith('-')).join('').replace(/-/g, ''),
    operands: args.filter((a) => !(a.length > 1 && a.startsWith('-'))),
});
const reason = (e) => (e && e.code === 'ENOENT' ? 'No such file or directory' : e && e.code === 'EEXIST' ? 'File exists' : e && e.code === 'ENOTDIR' ? 'Not a directory' : e && e.code === 'EISDIR' ? 'Is a directory' : (e && e.message) || 'error');
const globToRegex = (glob) => new RegExp('^' + glob.replace(/[.+^$(){}|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
const lines = (text) => (text === '' ? [] : text.replace(/\n$/, '').split('\n'));

// Eingabe eines Befehls: Dateien oder, ohne Dateiargument, stdin der Pipeline.
const inputsOf = (files, name) => {
    if (!files.length) return [{ file: null, text: stdin === null ? '' : stdin }];
    const found = [];
    files.forEach((f) => {
        try { found.push({ file: f, text: readText(f) }); } catch (e) { eprintln(name + ': ' + f + ': ' + reason(e)); }
    });
    return found;
};

const statOf = (v) => {
    const st = fs.statSync(real(v));
    const meta = META[v] || {};
    const isDir = st.isDirectory();
    return {
        isDir,
        size: st.size,
        mtime: st.mtime,
        mode: meta.mode !== undefined ? meta.mode : ((st.mode & 0o777) || (isDir ? 0o755 : 0o644)),
        owner: meta.owner || 'visitor',
    };
};
const modeString = (mode, isDir) => {
    const bits = 'rwxrwxrwx'.split('').map((c, i) => (mode & (1 << (8 - i)) ? c : '-'));
    if (mode & 0o4000) bits[2] = bits[2] === 'x' ? 's' : 'S';
    if (mode & 0o2000) bits[5] = bits[5] === 'x' ? 's' : 'S';
    if (mode & 0o1000) bits[8] = bits[8] === 'x' ? 't' : 'T';
    return (isDir ? 'd' : '-') + bits.join('');
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longEntry = (v, label) => {
    const st = statOf(v);
    const d = st.mtime instanceof Date ? st.mtime : new Date();
    const date = MONTHS[d.getMonth()] + ' ' + String(d.getDate()).padStart(2) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return modeString(st.mode, st.isDir) + ' 1 ' + st.owner + ' ' + st.owner + ' ' + String(st.size).padStart(6) + ' ' + date + ' ' + (st.isDir ? BLUE + label + RESET : label);
};

const copyRecursive = (from, to) => {
    if (fs.statSync(from).isDirectory()) {
        fs.mkdirSync(to, { recursive: true });
        fs.readdirSync(from).forEach((e) => copyRecursive(path.join(from, e), path.join(to, e)));
    } else {
        fs.copyFileSync(from, to);
    }
};
const intoDir = (src, dest) => {
    try {
        if (fs.statSync(dest).isDirectory()) return path.join(dest, path.basename(src));
    } catch {}
    return dest;
};

const applyChmod = (spec, file) => {
    const v = vabs(file);
    const current = statOf(v).mode;
    let mode;
    if (/^[0-7]{3,4}$/.test(spec)) {
        mode = parseInt(spec, 8);
    } else {
        const m = /^([ugoa]*)([+\-=])([rwxs]+)$/.exec(spec);
        if (!m) throw new Error('invalid mode: \'' + spec + '\'');
        const who = m[1] || 'a';
        const bits = m[3].split('').reduce((acc, c) => acc | (c === 'r' ? 4 : c === 'w' ? 2 : c === 'x' ? 1 : 0), 0);
        let mask = 0;
        if (who.includes('u') || who.includes('a')) mask |= bits << 6;
        if (who.includes('g') || who.includes('a')) mask |= bits << 3;
        if (who.includes('o') || who.includes('a')) mask |= bits;
        if (m[3].includes('s')) {
            if (who.includes('u') || who.includes('a')) mask |= 0o4000;
            if (who.includes('g') || who.includes('a')) mask |= 0o2000;
        }
        mode = m[2] === '+' ? current | mask : m[2] === '-' ? current & ~mask : mask;
    }
    fs.statSync(real(v));
    META[v] = Object.assign({}, META[v], { mode });
    try { fs.chmodSync(real(v), mode & 0o777); } catch {}
};

// awk: Muster /re/ und {print …} mit $N, $NF, $0, NR, NF und Zeichenketten; -F für das Trennzeichen.
const awkSplitTop = (expr) => {
    const parts = [];
    let current = '';
    let inString = false;
    for (const ch of expr) {
        if (ch === '"') inString = !inString;
        if (ch === ',' && !inString) { parts.push(current); current = ''; } else { current += ch; }
    }
    parts.push(current);
    return parts;
};
const awkRun = (args) => {
    let sep = null;
    let program = null;
    const files = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-F') sep = args[++i];
        else if (args[i].startsWith('-F')) sep = args[i].slice(2);
        else if (program === null) program = args[i];
        else files.push(args[i]);
    }
    if (program === null) { eprintln('awk: missing program'); return; }
    const end = /^\s*END\s*\{\s*print\s+NR\s*\}\s*$/.exec(program);
    const m = /^\s*(?:\/((?:[^\/\\]|\\.)*)\/)?\s*\{\s*print(?:\s+([\s\S]*?))?\s*;?\s*\}\s*$/.exec(program);
    if (!end && !m) { eprintln('awk: unsupported program: ' + program); return; }
    inputsOf(files, 'awk').forEach((input) => {
        const rows = lines(input.text);
        if (end) { println(String(rows.length)); return; }
        const pattern = m[1] ? new RegExp(m[1]) : null;
        const expr = m[2] === undefined ? '$0' : m[2];
        rows.forEach((row, idx) => {
            if (pattern && !pattern.test(row)) return;
            const fields = sep === null ? row.trim().split(/\s+/).filter(Boolean) : row.split(sep.length > 1 ? new RegExp(sep) : sep);
            const value = (atom) => {
                if (atom.startsWith('"')) return atom.slice(1, -1);
                if (atom === '$0') return row;
                if (atom === '$NF') return fields[fields.length - 1] || '';
                if (atom === 'NR') return String(idx + 1);
                if (atom === 'NF') return String(fields.length);
                return fields[parseInt(atom.slice(1), 10) - 1] || '';
            };
            println(awkSplitTop(expr).map((part) => (part.match(/"[^"]*"|\$NF|\$\d+|NR|NF/g) || []).map(value).join('')).join(' '));
        });
    });
};

const expandSet = (set) => {
    const chars = [];
    const raw = set.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    for (let i = 0; i < raw.length; i++) {
        if (raw[i + 1] === '-' && i + 2 < raw.length) {
            for (let c = raw.charCodeAt(i); c <= raw.charCodeAt(i + 2); c++) chars.push(String.fromCharCode(c));
            i += 2;
        } else {
            chars.push(raw[i]);
        }
    }
    return chars;
};

const fieldList = (spec) => spec.split(',').flatMap((part) => {
    const range = /^(\d*)-(\d*)$/.exec(part);
    if (!range) return [parseInt(part, 10)];
    const from = parseInt(range[1] || '1', 10);
    const to = parseInt(range[2] || '999', 10);
    return Array.from({ length: Math.min(to, 999) - from + 1 }, (_, i) => from + i);
});

const showLines = (args, which) => {
    let count = 10;
    const rest = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-n' && args[i + 1]) { count = parseInt(args[++i], 10) || 10; }
        else if (/^-n\d+$/.test(args[i])) { count = parseInt(args[i].slice(2), 10); }
        else if (/^-\d+$/.test(args[i])) { count = parseInt(args[i].slice(1), 10); }
        else if (!args[i].startsWith('-')) { rest.push(args[i]); }
    }
    inputsOf(rest, which).forEach((input) => {
        const all = lines(input.text);
        const picked = which === 'head' ? all.slice(0, count) : all.slice(Math.max(all.length - count, 0));
        picked.forEach((l) => println(l));
    });
};

const commands = {
    whoami: () => println('visitor'),
    id: () => println('uid=1000(visitor) gid=1000(visitor) groups=1000(visitor)'),
    hostname: () => println(HOSTNAME),
    pwd: () => println(cwd),
    clear: () => write('\x1b[2J\x1b[H'),
    exit: () => {
        println('exit');
        process.stdout.write(chunks.map((c) => c.text).join(''));
        process.exit(0);
    },
    date: () => println(new Date().toString()),
    uname: (args) => {
        if (args.includes('-a')) println('Linux ' + HOSTNAME + ' 5.15.0-webcontainer x86_64 GNU/Linux');
        else if (args.includes('-r')) println('5.15.0-webcontainer');
        else if (args.includes('-n')) println(HOSTNAME);
        else println('Linux');
    },
    env: () => println(['USER=visitor', 'HOME=' + HOME, 'SHELL=/bin/bash', 'PWD=' + cwd].join('\n')),
    which: (args) => {
        if (args[0] && Object.prototype.hasOwnProperty.call(commands, args[0])) println('/usr/bin/' + args[0]);
    },
    sudo: (args) => {
        if (args.includes('-l')) eprintln('Sorry, user visitor may not run sudo on ' + HOSTNAME + '.');
        else eprintln('visitor is not in the sudoers file.  This incident will be reported.');
    },
    echo: (args) => {
        const text = (args[0] === '-n' ? args.slice(1) : args).join(' ');
        const expanded = text.replace(/\$USER\b/g, 'visitor').replace(/\$HOME\b/g, HOME).replace(/\$PWD\b/g, cwd).replace(/\$SHELL\b/g, '/bin/bash');
        write(args[0] === '-n' ? expanded : expanded + '\n');
    },
    ls: (args) => {
        const { flags, operands } = splitArgs(args);
        const showAll = flags.includes('a');
        const long = flags.includes('l');
        const targets = operands.length ? operands : ['.'];
        targets.forEach((target, idx) => {
            const v = vabs(target);
            let entries;
            let dir = null;
            try {
                if (fs.statSync(real(v)).isDirectory()) {
                    dir = v;
                    entries = listDir(v).filter((e) => showAll || !e.startsWith('.'));
                    if (showAll) entries = ['.', '..'].concat(entries);
                } else {
                    entries = [target];
                }
            } catch (e) {
                eprintln('ls: cannot access \'' + target + '\': ' + reason(e));
                return;
            }
            if (targets.length > 1) println((idx ? '\n' : '') + target + ':');
            const vOf = (entry) => (dir === null ? v : path.posix.join(dir, entry));
            if (long) {
                entries.forEach((entry) => {
                    try { println(longEntry(vOf(entry), entry)); } catch { println('-rw-r--r-- 1 visitor visitor      0 Jan  1 00:00 ' + entry); }
                });
            } else if (entries.length) {
                println(entries.map((entry) => {
                    try { return statOf(vOf(entry)).isDir ? BLUE + entry + RESET : entry; } catch { return entry; }
                }).join('  '));
            }
        });
    },
    cd: (args) => {
        const target = args[0] === undefined ? '~' : args[0];
        const next = target === '-' ? oldpwd : vabs(target);
        try {
            if (!fs.statSync(real(next)).isDirectory()) {
                eprintln('bash: cd: ' + target + ': Not a directory');
                return;
            }
        } catch (e) {
            eprintln('bash: cd: ' + target + ': ' + reason(e));
            return;
        }
        oldpwd = cwd;
        cwd = next;
        if (target === '-') println(cwd);
    },
    cat: (args) => {
        const files = splitArgs(args).operands;
        inputsOf(files, 'cat').forEach((input) => write(input.text));
    },
    mkdir: (args) => {
        const { flags, operands } = splitArgs(args);
        if (!operands.length) { eprintln('mkdir: missing operand'); return; }
        operands.forEach((dir) => {
            try { fs.mkdirSync(rp(dir), { recursive: flags.includes('p') }); } catch (e) { eprintln('mkdir: cannot create directory \'' + dir + '\': ' + reason(e)); }
        });
    },
    touch: (args) => {
        const files = splitArgs(args).operands;
        if (!files.length) { eprintln('touch: missing file operand'); return; }
        files.forEach((file) => {
            try {
                const full = rp(file);
                if (fs.existsSync(full)) fs.utimesSync(full, new Date(), new Date());
                else fs.writeFileSync(full, '');
            } catch (e) { eprintln('touch: cannot touch \'' + file + '\': ' + reason(e)); }
        });
    },
    rm: (args) => {
        const { flags, operands } = splitArgs(args);
        const recursive = flags.includes('r') || flags.includes('R');
        const force = flags.includes('f');
        if (!operands.length) { eprintln('rm: missing operand'); return; }
        operands.forEach((target) => {
            try {
                const full = rp(target);
                if (fs.statSync(full).isDirectory()) {
                    if (!recursive) { eprintln('rm: cannot remove \'' + target + '\': Is a directory'); return; }
                    fs.rmSync(full, { recursive: true, force });
                } else {
                    fs.unlinkSync(full);
                }
            } catch (e) {
                if (!force) eprintln('rm: cannot remove \'' + target + '\': ' + reason(e));
            }
        });
    },
    cp: (args) => {
        const { flags, operands } = splitArgs(args);
        if (operands.length < 2) { eprintln('cp: missing file operand'); return; }
        const dest = rp(operands[operands.length - 1]);
        operands.slice(0, -1).forEach((src) => {
            try {
                const from = rp(src);
                if (fs.statSync(from).isDirectory() && !(flags.includes('r') || flags.includes('R'))) {
                    eprintln('cp: -r not specified; omitting directory \'' + src + '\'');
                    return;
                }
                copyRecursive(from, operands.length > 2 ? path.join(dest, path.basename(from)) : intoDir(from, dest));
            } catch (e) { eprintln('cp: cannot stat \'' + src + '\': ' + reason(e)); }
        });
    },
    mv: (args) => {
        const operands = splitArgs(args).operands;
        if (operands.length < 2) { eprintln('mv: missing file operand'); return; }
        const dest = rp(operands[operands.length - 1]);
        operands.slice(0, -1).forEach((src) => {
            try {
                const from = rp(src);
                fs.renameSync(from, operands.length > 2 ? path.join(dest, path.basename(from)) : intoDir(from, dest));
            } catch (e) { eprintln('mv: cannot stat \'' + src + '\': ' + reason(e)); }
        });
    },
    chmod: (args) => {
        const spec = args.find((a) => /^[0-7]{3,4}$/.test(a) || /^[ugoa]*[+\-=][rwxs]+$/.test(a));
        const files = args.filter((a) => a !== spec);
        if (!spec || !files.length) { eprintln('chmod: missing operand'); return; }
        files.forEach((file) => {
            try { applyChmod(spec, file); } catch (e) { eprintln('chmod: cannot access \'' + file + '\': ' + reason(e)); }
        });
    },
    head: (args) => showLines(args, 'head'),
    tail: (args) => showLines(args, 'tail'),
    wc: (args) => {
        const { flags, operands } = splitArgs(args);
        inputsOf(operands, 'wc').forEach((input) => {
            const counts = { l: input.text.split('\n').length - 1, w: input.text.split(/\s+/).filter(Boolean).length, c: Buffer.byteLength(input.text) };
            const picked = ['l', 'w', 'c'].filter((k) => flags.includes(k));
            println((picked.length ? picked : ['l', 'w', 'c']).map((k) => counts[k]).join(' ') + (input.file ? ' ' + input.file : ''));
        });
    },
    grep: (args) => {
        const { flags, operands } = splitArgs(args);
        if (!operands.length) { eprintln('grep: missing pattern'); return; }
        const pattern = operands[0];
        const ci = flags.includes('i') ? 'i' : '';
        let regex;
        try { regex = new RegExp(pattern, ci); } catch { regex = new RegExp(pattern.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&'), ci); }
        const walk = (p) => {
            try {
                if (!statOf(vabs(p)).isDir) return [p];
                return listDir(vabs(p)).flatMap((e) => walk(path.posix.join(p, e)));
            } catch { return [p]; }
        };
        const recursive = flags.includes('r') || flags.includes('R');
        let given = operands.slice(1);
        if (recursive) given = (given.length ? given : ['.']).flatMap(walk);
        inputsOf(given, 'grep').forEach((input) => {
            const hits = lines(input.text).map((line, i) => ({ line, n: i + 1 })).filter((h) => regex.test(h.line) !== flags.includes('v'));
            const prefix = given.length > 1 ? input.file + ':' : '';
            if (flags.includes('c')) println(prefix + hits.length);
            else hits.forEach((h) => println(prefix + (flags.includes('n') ? h.n + ':' : '') + h.line));
        });
    },
    find: (args) => {
        const valueOf = (flag) => (args.indexOf(flag) !== -1 ? args[args.indexOf(flag) + 1] : null);
        const name = valueOf('-name');
        const matcher = name ? globToRegex(name) : null;
        const type = valueOf('-type');
        const perm = valueOf('-perm');
        const start = args[0] && !args[0].startsWith('-') ? args[0] : '.';
        const permOk = (mode) => {
            if (perm === null) return true;
            const bits = parseInt(perm.replace(/^[-/]/, ''), 8);
            if (perm.startsWith('-')) return (mode & bits) === bits;
            if (perm.startsWith('/')) return (mode & bits) !== 0;
            return mode === bits;
        };
        const visit = (shown) => {
            let st;
            try { st = statOf(vabs(shown)); } catch { return; }
            const matches = (!matcher || matcher.test(path.posix.basename(shown))) && (!type || (type === 'd') === st.isDir) && permOk(st.mode);
            if (matches) println(shown);
            if (st.isDir) listDir(vabs(shown)).forEach((e) => visit(shown.replace(/\/$/, '') + '/' + e));
        };
        try { fs.statSync(rp(start)); } catch (e) { eprintln('find: \'' + start + '\': ' + reason(e)); return; }
        visit(start);
    },
    base64: (args) => {
        const { flags, operands } = splitArgs(args.filter((a) => a !== '--decode'));
        const decode = flags.includes('d') || args.includes('--decode');
        inputsOf(operands, 'base64').forEach((input) => {
            if (!decode) {
                const encoded = Buffer.from(input.text, 'utf8').toString('base64');
                encoded.match(/.{1,76}/g)?.forEach((l) => println(l));
            } else if (/^[A-Za-z0-9+/=\s]*$/.test(input.text)) {
                write(Buffer.from(input.text.replace(/\s+/g, ''), 'base64').toString('utf8'));
            } else {
                eprintln('base64: invalid input');
            }
        });
    },
    awk: (args) => awkRun(args),
    sort: (args) => {
        let numeric = false;
        let reverse = false;
        let unique = false;
        let key = null;
        const files = [];
        for (let i = 0; i < args.length; i++) {
            const a = args[i];
            if (a === '-k') key = parseInt(args[++i], 10);
            else if (/^-k\d+/.test(a)) key = parseInt(a.slice(2), 10);
            else if (a.length > 1 && a.startsWith('-')) {
                numeric = numeric || a.includes('n');
                reverse = reverse || a.includes('r');
                unique = unique || a.includes('u');
            } else files.push(a);
        }
        const keyOf = (l) => (key ? l.trim().split(/\s+/)[key - 1] || '' : l);
        const compare = (a, b) => {
            const base = numeric ? (parseFloat(keyOf(a)) || 0) - (parseFloat(keyOf(b)) || 0) : keyOf(a).localeCompare(keyOf(b));
            return base !== 0 ? base : a.localeCompare(b);
        };
        let rows = inputsOf(files, 'sort').flatMap((input) => lines(input.text));
        rows.sort((a, b) => (reverse ? -compare(a, b) : compare(a, b)));
        if (unique) rows = rows.filter((l, i) => i === 0 || compare(rows[i - 1], l) !== 0);
        rows.forEach((l) => println(l));
    },
    uniq: (args) => {
        const { flags, operands } = splitArgs(args);
        const groups = [];
        inputsOf(operands, 'uniq').forEach((input) => lines(input.text).forEach((l) => {
            if (groups.length && groups[groups.length - 1].line === l) groups[groups.length - 1].count++;
            else groups.push({ line: l, count: 1 });
        }));
        groups.filter((g) => !flags.includes('d') || g.count > 1).forEach((g) => println((flags.includes('c') ? String(g.count).padStart(7) + ' ' : '') + g.line));
    },
    cut: (args) => {
        let delimiter = '\t';
        let fieldSpec = null;
        let charSpec = null;
        const files = [];
        for (let i = 0; i < args.length; i++) {
            const a = args[i];
            if (a === '-d') delimiter = args[++i];
            else if (a.startsWith('-d')) delimiter = a.slice(2);
            else if (a === '-f') fieldSpec = args[++i];
            else if (a.startsWith('-f')) fieldSpec = a.slice(2);
            else if (a === '-c') charSpec = args[++i];
            else if (a.startsWith('-c')) charSpec = a.slice(2);
            else files.push(a);
        }
        if (fieldSpec === null && charSpec === null) { eprintln('cut: you must specify a list of bytes, characters, or fields'); return; }
        inputsOf(files, 'cut').forEach((input) => lines(input.text).forEach((l) => {
            if (charSpec !== null) println(fieldList(charSpec).map((n) => l[n - 1] || '').join(''));
            else println(l.includes(delimiter) ? fieldList(fieldSpec).map((n) => l.split(delimiter)[n - 1]).filter((f) => f !== undefined).join(delimiter) : l);
        }));
    },
    tr: (args) => {
        const { flags, operands } = splitArgs(args);
        const from = expandSet(operands[0] || '');
        const to = expandSet(operands[1] || '');
        if (!operands.length) { eprintln('tr: missing operand'); return; }
        const text = stdin === null ? '' : stdin;
        let out = '';
        for (const ch of text) {
            const idx = from.indexOf(ch);
            if (flags.includes('d')) { if (idx === -1) out += ch; }
            else if (idx === -1 || !to.length) out += ch;
            else out += to[Math.min(idx, to.length - 1)];
        }
        write(out);
    },
    help: () => {
        println('Verfügbare Befehle:');
        println(Object.keys(commands).sort().join('  '));
    },
};

// Zerlegt eine Eingabezeile in Wörter und Operatoren (| > >> < 2> 2>>); Quotes schützen Sonderzeichen.
const tokenize = (line) => {
    const tokens = [];
    let current = '';
    let started = false;
    let quote = null;
    const flush = () => {
        if (started || current) tokens.push(current);
        current = '';
        started = false;
    };
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quote) {
            if (ch === quote) quote = null;
            else if (quote === '"' && ch === '\\' && '"\\$'.includes(line[i + 1] || ' ')) current += line[++i];
            else current += ch;
        } else if (ch === '"' || ch === '\'') {
            quote = ch;
            started = true;
        } else if (ch === '\\' && i + 1 < line.length) {
            current += line[++i];
        } else if (/\s/.test(ch)) {
            flush();
        } else if (ch === '|' || ch === '>' || ch === '<') {
            let op = ch;
            if (ch === '>' && !started && (current === '2' || current === '1')) { op = current === '2' ? '2>' : '>'; current = ''; } else flush();
            if (ch === '>' && line[i + 1] === '>') { op += '>'; i++; }
            tokens.push({ op });
        } else {
            current += ch;
        }
    }
    flush();
    return tokens;
};

const runCommand = (words) => {
    const [cmd, ...args] = words;
    if (!cmd) return;
    if (cmd.includes('/')) {
        let st;
        try { st = statOf(vabs(cmd)); } catch (e) { eprintln('bash: ' + cmd + ': ' + reason(e)); return; }
        if (st.isDir) eprintln('bash: ' + cmd + ': Is a directory');
        else if (vabs(cmd) === '/usr/local/bin/backup') {
            println('root@' + HOSTNAME + ':/# ');
            println('Congratulations! You have obtained root access!');
        } else eprintln('bash: ' + cmd + ': Permission denied');
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(commands, cmd)) {
        eprintln('bash: ' + cmd + ': command not found');
        return;
    }
    try {
        commands[cmd](args);
    } catch (e) {
        eprintln(cmd + ': ' + ((e && e.message) || 'error'));
    }
};

const toTerminal = (text) => {
    if (text) process.stdout.write(text.endsWith('\n') || /\x1b\[[0-9;]*[A-Za-z]$/.test(text) ? text : text + '\n');
};
const saveTo = (file, text, append) => {
    if (file === '/dev/null') return;
    try {
        (append ? fs.appendFileSync : fs.writeFileSync)(rp(file), text);
    } catch (e) {
        toTerminal('bash: ' + file + ': ' + reason(e) + '\n');
    }
};

function executeCommand(line) {
    const tokens = tokenize(line);
    if (!tokens.length) return;
    const stages = [[]];
    tokens.forEach((t) => {
        if (typeof t !== 'string' && t.op === '|') stages.push([]);
        else stages[stages.length - 1].push(t);
    });
    const parsed = [];
    for (let s = 0; s < stages.length; s++) {
        const words = [];
        const redirect = {};
        const stage = stages[s];
        for (let i = 0; i < stage.length; i++) {
            if (typeof stage[i] === 'string') { words.push(stage[i]); continue; }
            const target = stage[++i];
            if (typeof target !== 'string') { toTerminal('bash: syntax error near unexpected token'); return; }
            redirect[stage[i - 1].op] = target;
        }
        if (!words.length) { toTerminal('bash: syntax error near unexpected token \'|\''); return; }
        parsed.push({ words, redirect });
    }
    let piped = null;
    for (let s = 0; s < parsed.length; s++) {
        const { words, redirect } = parsed[s];
        chunks = [];
        stdin = piped;
        if (redirect['<'] !== undefined) {
            try { stdin = readText(redirect['<']); } catch (e) { toTerminal('bash: ' + redirect['<'] + ': ' + reason(e)); stdin = ''; }
        }
        runCommand(words);
        const target = (plain, append) => (redirect[plain] !== undefined ? { file: redirect[plain], append: false } : redirect[append] !== undefined ? { file: redirect[append], append: true } : null);
        const outFile = target('>', '>>');
        const errFile = target('2>', '2>>');
        const mergeErr = errFile !== null && errFile.file === '&1';
        const isLast = s === parsed.length - 1;
        const text = (err) => chunks.filter((c) => c.err === err).map((c) => c.text).join('');
        const outText = text(false) + (mergeErr ? text(true) : '');
        if (errFile && !mergeErr) saveTo(errFile.file, text(true), errFile.append);
        if (outFile) saveTo(outFile.file, outText, outFile.append);
        const toTerm = (c) => (c.err && !mergeErr ? !errFile : isLast && !outFile);
        toTerminal(chunks.filter(toTerm).map((c) => c.text).join(''));
        piped = outFile ? '' : outText;
    }
}

console.log(GREEN + 'Linux-Übungsumgebung bereit.' + RESET + ' Tippe help für die verfügbaren Befehle.\n');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    prompt: getPrompt(),
});

rl.on('line', (line) => {
    try {
        executeCommand(line);
    } catch (e) {
        toTerminal('bash: ' + ((e && e.message) || 'error'));
    }
    rl.setPrompt(getPrompt());
    rl.prompt();
});
rl.on('SIGINT', () => {
    process.stdout.write('^C\n');
    rl.write(null, { ctrl: true, name: 'u' });
    rl.prompt();
});
rl.on('close', () => process.exit(0));

rl.prompt();
`;

export const buildCustomShell = () => `#!/usr/bin/env node${SHELL_SOURCE}`;

const WELCOME_TEXT =
  'Willkommen im interaktiven Terminal von alex-schneider.dev!\nHier kannst du echte Linux-Befehle üben.\n';

const AUTH_LOG = [
  'Jan 28 14:32:45 server sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2',
  'Jan 28 14:32:48 server sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2',
  'Jan 28 14:32:51 server sshd[1234]: Failed password for root from 192.168.1.100 port 22 ssh2',
  'Jan 28 14:33:12 server sshd[1235]: Accepted password for admin from 192.168.1.100 port 22 ssh2',
  '',
].join('\n');

/**
 * Dateisystem des Linux-Terminals; wird ins Arbeitsverzeichnis des WebContainers gemountet und
 * erscheint in der Shell als `/` (Inhalte wie im Mock-Modus, MockLinuxSystem).
 */
export const MISSION_FILES = {
  '.shell': {
    directory: {
      'shell.js': { file: { contents: buildCustomShell() } },
    },
  },
  home: {
    directory: {
      visitor: {
        directory: {
          'welcome.txt': { file: { contents: WELCOME_TEXT } },
          '.secret': { file: { contents: 'U3VwZXJTZWNyZXQxMjM=\n' } },
          'README.md': { file: { contents: '# README\nThis is a test file.\n' } },
        },
      },
    },
  },
  var: {
    directory: {
      log: {
        directory: {
          'auth.log': { file: { contents: AUTH_LOG } },
        },
      },
    },
  },
  usr: {
    directory: {
      local: {
        directory: {
          bin: { directory: { backup: { file: { contents: 'BINARY_DATA' } } } },
        },
      },
      bin: { directory: { sudo: { file: { contents: 'BINARY_DATA' } } } },
    },
  },
};

export interface CommandTracker {
  /** Verarbeitet eine Eingabe von xterm und meldet jede abgeschickte Zeile. */
  feed(data: string): void;
}

/**
 * Verfolgt die getippten Zeichen für die Missionsprüfung (die Shell selbst läuft im
 * WebContainer). Escape-Sequenzen (Pfeiltasten etc.) werden ignoriert, Rücktaste und
 * eingefügter Text werden berücksichtigt.
 */
export function createCommandTracker(onLine: (command: string) => void): CommandTracker {
  let buffer = '';
  return {
    feed(data) {
      if (data.startsWith('\x1b')) return;
      for (const char of data) {
        if (char === '\r' || char === '\n') {
          const command = buffer.trim();
          buffer = '';
          if (command) onLine(command);
        } else if (char === '\x7f' || char === '\b') {
          buffer = buffer.slice(0, -1);
        } else if (char === '\x15' || char === '\x03') {
          buffer = '';
        } else if (char >= ' ') {
          buffer += char;
        }
      }
    },
  };
}
