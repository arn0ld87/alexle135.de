/**
 * WebContainer Linux Command Shims
 *
 * Provides Node.js shim scripts that implement Linux commands for jsh.
 * These are mounted to /bin and made executable in the WebContainer environment.
 *
 * @module shimCommands
 */

/**
 * Creates a shim file object for WebContainer
 * @param script - The Node.js script content
 * @returns File object with contents
 */
const createShim = (script: string) => ({
  file: { contents: script },
});

/**
 * Linux command shims for WebContainer jsh environment
 * Each command is a Node.js script that simulates Linux behavior
 */
export const SHIM_COMMANDS = {
  whoami: createShim(`#!/usr/bin/env node
console.log('visitor');`),

  pwd: createShim(`#!/usr/bin/env node
console.log(process.cwd());`),

  ls: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const showHidden = args.includes('-a') || args.includes('-la') || args.includes('-al') || args.includes('-l');
const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
const targetDir = args.find(a => !a.startsWith('-')) || '.';

try {
    const files = fs.readdirSync(targetDir);
    let filtered = files.filter(f => showHidden || !f.startsWith('.'));
    if (showHidden && !filtered.includes('.')) {
        filtered = ['.', '..', ...filtered];
    }
    
    if (showLong) {
        filtered.forEach(f => {
            if (f === '.' || f === '..') {
                console.log('drwxr-xr-x  2 visitor visitor 4096 Dec  4 12:00 ' + f);
                return;
            }
            try {
                const fullPath = targetDir === '.' ? f : targetDir + '/' + f;
                const stat = fs.statSync(fullPath);
                const isDir = stat.isDirectory();
                const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
                const size = String(stat.size).padStart(5);
                console.log(perms + '  1 visitor visitor ' + size + ' Dec  4 12:00 ' + f);
            } catch { console.log('-rw-r--r--  1 visitor visitor     0 Dec  4 12:00 ' + f); }
        });
    } else {
        const formatted = filtered.map(f => {
            if (f === '.' || f === '..') return f;
            try {
                const fullPath = targetDir === '.' ? f : targetDir + '/' + f;
                const stat = fs.statSync(fullPath);
                return stat.isDirectory() ? f + '/' : f;
            } catch { return f; }
        });
        console.log(formatted.join('    '));
    }
} catch (err) {
    console.error('ls: cannot access ' + targetDir + ': No such file or directory');
    process.exit(1);
}`),

  cat: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args.length === 0) { console.error('cat: missing file operand'); process.exit(1); }
try {
    console.log(fs.readFileSync(args[0], 'utf8'));
} catch (err) {
    console.error('cat: ' + args[0] + ': No such file or directory');
    process.exit(1);
}`),

  mkdir: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args.length === 0) { console.error('mkdir: missing operand'); process.exit(1); }
const recursive = args.includes('-p');
const dir = args.find(a => !a.startsWith('-'));
try { fs.mkdirSync(dir, { recursive }); } catch (err) {
    console.error('mkdir: cannot create directory: ' + err.message);
    process.exit(1);
}`),

  touch: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args.length === 0) { console.error('touch: missing file operand'); process.exit(1); }
try { fs.writeFileSync(args[0], '', { flag: 'a' }); } catch (err) {
    console.error('touch: cannot touch ' + args[0]);
    process.exit(1);
}`),

  rm: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args.length === 0) { console.error('rm: missing operand'); process.exit(1); }
const recursive = args.includes('-r') || args.includes('-rf');
const target = args.find(a => !a.startsWith('-'));
try {
    if (recursive) { fs.rmSync(target, { recursive: true, force: true }); }
    else { fs.unlinkSync(target); }
} catch (err) { console.error('rm: cannot remove ' + target); process.exit(1); }`),

  cp: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
if (args.length < 2) { console.error('cp: missing operand'); process.exit(1); }
try { fs.copyFileSync(args[0], args[1]); } catch (err) {
    console.error('cp: cannot copy ' + args[0]);
    process.exit(1);
}`),

  mv: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
if (args.length < 2) { console.error('mv: missing operand'); process.exit(1); }
try { fs.renameSync(args[0], args[1]); } catch (err) {
    console.error('mv: cannot move ' + args[0]);
    process.exit(1);
}`),

  echo: createShim(`#!/usr/bin/env node
console.log(process.argv.slice(2).join(' '));`),

  clear: createShim(`#!/usr/bin/env node
console.log('\\x1b[2J\\x1b[0f');`),

  date: createShim(`#!/usr/bin/env node
console.log(new Date().toString());`),

  uptime: createShim(`#!/usr/bin/env node
console.log(' 00:00:00 up 0 days,  0:00,  1 user,  load average: 0.00, 0.01, 0.05');`),

  hostname: createShim(`#!/usr/bin/env node
console.log('linux');`),

  uname: createShim(`#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.includes('-a')) {
    console.log('Linux 5.15.0-generic x86_64 GNU/Linux');
} else if (args.includes('-m')) {
    console.log('x86_64');
} else if (args.includes('-r')) {
    console.log('5.15.0-generic');
} else if (args.includes('-s')) {
    console.log('Linux');
} else {
    console.log('Linux');
}`),

  node: createShim(`#!/usr/bin/env node
const { execSync } = require('child_process');
try {
    const result = execSync(process.argv.slice(2).join(' '), { encoding: 'utf8' });
    console.log(result);
} catch (err) {
    console.error(err.message);
    process.exit(1);
}`),

  npm: createShim(`#!/usr/bin/env node
const { execSync } = require('child_process');
try {
    const result = execSync('npm ' + process.argv.slice(2).join(' '), { encoding: 'utf8', stdio: 'inherit' });
} catch (err) {
    process.exit(1);
}`),

  npx: createShim(`#!/usr/bin/env node
const { execSync } = require('child_process');
try {
    const result = execSync('npx ' + process.argv.slice(2).join(' '), { encoding: 'utf8', stdio: 'inherit' });
} catch (err) {
    process.exit(1);
}`),

  python3: createShim(`#!/usr/bin/env node
const { execSync } = require('child_process');
try {
    const result = execSync('python3 ' + process.argv.slice(2).join(' '), { encoding: 'utf8', stdio: 'inherit' });
} catch (err) {
    process.exit(1);
}`),

  pip3: createShim(`#!/usr/bin/env node
const { execSync } = require('child_process');
try {
    const result = execSync('pip3 ' + process.argv.slice(2).join(' '), { encoding: 'utf8', stdio: 'inherit' });
} catch (err) {
    process.exit(1);
}`),

  curl: createShim(`#!/usr/bin/env node
const https = require('https');
const http = require('http');
const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('-'));
if (!url) { console.error('curl: no URL specified'); process.exit(1); }
const lib = url.startsWith('https') ? https : http;
lib.get(url, (res) => {
    res.on('data', (chunk) => process.stdout.write(chunk));
    res.on('end', () => console.log());
}).on('error', (err) => console.error('curl: ' + err.message));`),

  wget: createShim(`#!/usr/bin/env node
const https = require('https');
const http = require('http');
const fs = require('fs');
const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('-'));
if (!url) { console.error('wget: missing URL'); process.exit(1); }
const filename = args.find(a => a.startsWith('-O')) ? args[args.indexOf('-O') + 1] : url.split('/').pop() || 'index.html';
const lib = url.startsWith('https') ? https : http;
lib.get(url, (res) => {
    const file = fs.createWriteStream(filename);
    res.pipe(file);
    file.on('finish', () => { file.close(); console.log(filename + ' saved'); });
}).on('error', (err) => { fs.unlinkSync(filename); console.error('wget: ' + err.message); });`),

  ps: createShim(`#!/usr/bin/env node
console.log('PID TTY          TIME CMD');
console.log('  1 ?        00:00:00 jsh');
console.log('  7 ?        00:00:00 node');
console.log(' 15 ?        00:00:00 ps');`),

  kill: createShim(`#!/usr/bin/env node
console.log('kill: simulated - no process actually killed');`),

  top: createShim(`#!/usr/bin/env node
console.log('top - 00:00:00 up 0 days,  0:00,  1 user,  load average: 0.00, 0.01, 0.05');
console.log('Tasks: 1 total,   1 running,   0 sleeping,   0 stopped,   0 zombie');
console.log('%Cpu(s):  0.0 us,  0.0 sy,  0.0 ni,100.0 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st');
console.log('MiB Mem :  16000.0 total,  14000.0 free,   1000.0 used,   1000.0 buff/ cache');
console.log('MiB Swap:      0.0 total,      0.0 free,      0.0 used.  15000.0 avail Mem ');
console.log('');
console.log('  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND');
console.log('    1 visitor   20   0    1000    500    400 S   0.0   0.0   0:00.01 jsh');
console.log('Press Ctrl+C to exit');`),

  free: createShim(`#!/usr/bin/env node
console.log('              total        used        free      shared  buff/cache   available');
console.log('Mem:        16000000     1000000    14000000      10000     1000000    15000000');
console.log('Swap:              0           0           0');`),

  df: createShim(`#!/usr/bin/env node
console.log('Filesystem     1K-blocks      Used Available Use% Mounted on');
console.log('/dev/sda1      100000000  50000000  50000000  50% /');`),

  du: createShim(`#!/usr/bin/env node
const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('-')) || '.';
console.log('64\\t' + target);`),

  find: createShim(`#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const startPath = args.find(a => !a.startsWith('-')) || '.';
const nameArg = args[args.indexOf('-name') + 1];

function findFiles(dir: string, pattern: string): string[] {
    let results: string[] = [];
    try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
            if (entry.startsWith('.') && !pattern.includes('*')) continue;
            const fullPath = path.join(dir, entry);
            if (pattern && entry.includes(pattern.replace(/\\*/g, ''))) {
                results.push(fullPath);
            } else if (!pattern) {
                results.push(fullPath);
            }
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    results = results.concat(findFiles(fullPath, pattern));
                }
            } catch {}
        }
    } catch {}
    return results;
}

const files = findFiles(startPath, nameArg);
files.forEach(f => console.log(f));`),

  grep: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const pattern = args.find(a => !a.startsWith('-'));
const file = args[args.length - 1];
if (!pattern || !file) { console.error('grep: usage: grep PATTERN FILE'); process.exit(1); }
try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\\n');
    const regex = new RegExp(pattern, 'i');
    lines.forEach(line => { if (regex.test(line)) console.log(line); });
} catch (err) { console.error('grep: ' + err.message); }`),

  head: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('-'));
const lines = args.includes('-n') ? parseInt(args[args.indexOf('-n') + 1]) : 10;
if (!file) { console.error('head: missing file operand'); process.exit(1); }
try {
    const content = fs.readFileSync(file, 'utf8').split('\\n').slice(0, lines).join('\\n');
    console.log(content);
} catch (err) { console.error('head: ' + err.message); }`),

  tail: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('-'));
const lines = args.includes('-n') ? parseInt(args[args.indexOf('-n') + 1]) : 10;
if (!file) { console.error('tail: missing file operand'); process.exit(1); }
try {
    const content = fs.readFileSync(file, 'utf8').split('\\n').slice(-lines).join('\\n');
    console.log(content);
} catch (err) { console.error('tail: ' + err.message); }`),

  wc: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('-'));
if (!file) { console.error('wc: missing file operand'); process.exit(1); }
try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\\n').length;
    const words = content.split(/\\s+/).length;
    const bytes = Buffer.byteLength(content);
    console.log(lines + ' ' + words + ' ' + bytes + ' ' + file);
} catch (err) { console.error('wc: ' + err.message); }`),

  sort: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('-'));
if (!file) { console.error('sort: missing file operand'); process.exit(1); }
try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\\n').sort();
    console.log(lines.join('\\n'));
} catch (err) { console.error('sort: ' + err.message); }`),

  uniq: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('-'));
if (!file) { console.error('uniq: missing file operand'); process.exit(1); }
try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\\n');
    const unique = lines.filter((line, i) => i === 0 || line !== lines[i - 1]);
    console.log(unique.join('\\n'));
} catch (err) { console.error('uniq: ' + err.message); }`),

  cut: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('-'));
const delim = args.includes('-d') ? args[args.indexOf('-d') + 1] : '\\t';
const fields = args.includes('-f') ? args[args.indexOf('-f') + 1].split(',').map(Number) : [1];
if (!file) { console.error('cut: missing file operand'); process.exit(1); }
try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\\n');
    lines.forEach(line => {
        const parts = line.split(delim);
        console.log(fields.map(f => parts[f - 1]).join(delim));
    });
} catch (err) { console.error('cut: ' + err.message); }`),

  awk: createShim(`#!/usr/bin/env node
console.log('awk: simplified implementation');
const args = process.argv.slice(2);
const pattern = args.includes('-F') ? args[args.indexOf('-F') + 1] : ' ';
const file = args.find(a => !a.startsWith('-') && a !== args[args.indexOf('-F') + 1]);
if (!file) { console.error('awk: missing file operand'); process.exit(1); }
try {
    const fs = require('fs');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\\n');
    lines.forEach(line => console.log(line));
} catch (err) { console.error('awk: ' + err.message); }`),

  sed: createShim(`#!/usr/bin/env node
console.log('sed: simplified implementation');
const args = process.argv.slice(2);
const expression = args.find(a => a.startsWith('s/'));
const file = args.find(a => !a.startsWith('-') && !a.startsWith('s/'));
if (!file) { console.error('sed: missing file operand'); process.exit(1); }
try {
    const fs = require('fs');
    const content = fs.readFileSync(file, 'utf8');
    console.log(content);
} catch (err) { console.error('sed: ' + err.message); }`),

  chmod: createShim(`#!/usr/bin/env node
console.log('chmod: simulated - permissions changed');`),

  chown: createShim(`#!/usr/bin/env node
console.log('chown: simulated - ownership changed');`),

  ln: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const target = args[args.length - 2];
const link = args[args.length - 1];
if (!target || !link) { console.error('ln: missing operand'); process.exit(1); }
try {
    if (args.includes('-s')) { fs.symlinkSync(target, link); }
    else { fs.linkSync(target, link); }
} catch (err) { console.error('ln: ' + err.message); }`),

  readlink: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const link = args[0];
if (!link) { console.error('readlink: missing operand'); process.exit(1); }
try {
    const target = fs.readlinkSync(link);
    console.log(target);
} catch (err) { console.error('readlink: ' + err.message); }`),

  basename: createShim(`#!/usr/bin/env node
const path = require('path');
const args = process.argv.slice(2);
const file = args[0];
if (!file) { console.error('basename: missing operand'); process.exit(1); }
console.log(path.basename(file));`),

  dirname: createShim(`#!/usr/bin/env node
const path = require('path');
const args = process.argv.slice(2);
const file = args[0];
if (!file) { console.error('dirname: missing operand'); process.exit(1); }
console.log(path.dirname(file));`),

  realpath: createShim(`#!/usr/bin/env node
const path = require('path');
const args = process.argv.slice(2);
const file = args[0];
if (!file) { console.error('realpath: missing operand'); process.exit(1); }
console.log(path.resolve(file));`),

  file: createShim(`#!/usr/bin/env node
const fs = require('fs');
const args = process.argv.slice(2);
const file = args[0];
if (!file) { console.error('file: missing operand'); process.exit(1); }
try {
    const stat = fs.statSync(file);
    if (stat.isDirectory()) console.log(file + ': directory');
    else if (stat.isFile()) console.log(file + ': regular file');
    else console.log(file + ': unknown');
} catch (err) { console.error('file: ' + err.message); }`),

  which: createShim(`#!/usr/bin/env node
const args = process.argv.slice(2);
const cmd = args[0];
if (!cmd) { console.error('which: missing operand'); process.exit(1); }
console.log('/bin/' + cmd);`),

  env: createShim(`#!/usr/bin/env node
console.log('USER=visitor');
console.log('HOME=/home/visitor');
console.log('SHELL=/bin/jsh');
console.log('PATH=/bin:/usr/bin:/usr/local/bin');
console.log('PWD=' + process.cwd());
console.log('LANG=de_DE.UTF-8');`),

  export: createShim(`#!/usr/bin/env node
// Simulated export
const args = process.argv.slice(2).join(' ');
if (!args) {
    console.log('declare -x HOME="/home/visitor"');
    console.log('declare -x PATH="/bin:/usr/bin:/usr/local/bin"');
    console.log('declare -x USER="visitor"');
}`),
};
