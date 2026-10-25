// Savestate des Bildschirm-Images: wie scripts/mission-image/build-state.mjs, zusätzlich
// --vga-memory-mb (der Savestate enthält den VGA-Speicher) und ein vorgewärmter Bildschirm.
// Bootet das Missions-Image headless in v86 bis zum Prompt und schreibt den
// Savestate (Fast-Start im Browser). Aufruf (im Dockerfile-Stage `state`):
//   node build-state.mjs --assets DIR --memory-mb 128 --vga-memory-mb 8 --out DATEI
// Der Savestate ist an memory_size, cmdline und die v86-Version gebunden; die
// Werte müssen mit denen der Browser-Seite übereinstimmen.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { V86 } from 'v86';

const { values } = parseArgs({
  options: {
    assets: { type: 'string' },
    'memory-mb': { type: 'string', default: '128' },
    'vga-memory-mb': { type: 'string', default: '8' },
    out: { type: 'string' },
  },
});

const PROMPT = 'azubi@alex-schneider:~$ ';
// Der Prompt ist farbig (#398); verglichen wird der Text ohne ANSI-Steuersequenzen.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, 'g');
const CMDLINE =
  'rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on';
const BOOT_TIMEOUT_MS = 1_200_000;
// Bildschirm vorwärmen: Xorg läuft im Savestate schon, bildbeleg, feh, pcmanfm und mousepad waren
// einmal offen, ihre Dateien liegen im Page-Cache und kommen im Browser nicht mehr über 9p.
const WARM = [
  'bildschirm >/dev/null',
  'w() { for i in $(seq 600); do xwininfo -root -tree 2>/dev/null | grep -q "$1" && return 0; sleep 0.5; done; return 1; }',
  `s=$SECONDS; echo Probe | bildbeleg /tmp/probe.png; echo "@@T bildbeleg $((SECONDS-s))"`,
  `s=$SECONDS; feh /tmp/probe.png >/dev/null 2>&1 & w '"feh'; echo "@@T feh $((SECONDS-s))"`,
  `s=$SECONDS; until ls "$XDG_RUNTIME_DIR"/pcmanfm-socket* >/dev/null 2>&1; do sleep 1; done; echo "@@T pcmanfm-daemon $((SECONDS-s))"`,
  `s=$SECONDS; pcmanfm ~ >/dev/null 2>&1; w '"azubi"'; echo "@@T pcmanfm $((SECONDS-s))"`,
  `s=$SECONDS; mousepad >/dev/null 2>&1 & w Mousepad; echo "@@T mousepad $((SECONDS-s))"`,
  'sleep 5; free -m | sed "s/^/@@F /"',
  'pkill -x feh -n; pkill -x mousepad; rm -f /tmp/probe.png; sleep 3; history -c; echo @@WA""RM@@',
].join('; ');

const emulator = new V86({
  bios: { url: path.join(values.assets, 'seabios.bin') },
  vga_bios: { url: path.join(values.assets, 'vgabios.bin') },
  wasm_path: fileURLToPath(import.meta.resolve('v86/build/v86.wasm')),
  autostart: true,
  memory_size: Number(values['memory-mb']) * 1024 * 1024,
  vga_memory_size: Number(values['vga-memory-mb']) * 1024 * 1024,
  uart1: true,
  bzimage_initrd_from_filesystem: true,
  cmdline: CMDLINE,
  filesystem: {
    baseurl: path.join(values.assets, 'alpine-rootfs-flat'),
    basefs: path.join(values.assets, 'alpine-fs.json'),
  },
});

let serial0 = '';
let serial1 = '';
const startedAt = Date.now();
const bootTimer = setTimeout(() => {
  console.error('Boot-Timeout. serial0:\n' + serial0 + '\nserial1:\n' + serial1);
  process.exit(1);
}, BOOT_TIMEOUT_MS);

let saving = false;
let warming = false;
let stateRequested = false;
// Prompt (serial0) und HELLO des Agenten (serial1) kommen in beliebiger Reihenfolge;
// deshalb nach jedem Byte auf beiden Kanälen prüfen.
function maybeSave() {
  if (saving || !serial0.replace(ANSI, '').endsWith(PROMPT) || !serial1.includes('HELLO 1\n'))
    return;
  if (!warming) {
    warming = true;
    console.log(`Prompt nach ${((Date.now() - startedAt) / 1000).toFixed(1)} s, wärme Bildschirm vor`);
    serial0 = '';
    emulator.serial_send_bytes(0, new TextEncoder().encode(WARM + '\n'));
    return;
  }
  if (!serial0.includes('@@WARM@@')) return;
  for (const m of serial0.replace(ANSI, '').matchAll(/^@@[TF] (.*)$/gm)) console.log(`Vorwärmen: ${m[1]}`);
  saving = true;
  console.log(
    `Prompt und Agent nach ${((Date.now() - startedAt) / 1000).toFixed(1)} s (Emulation + Laden)`
  );
  // Page-Cache leeren, damit der Savestate klein bleibt; über den versteckten Kanal,
  // damit nichts im sichtbaren Terminal landet. Vorher den Antwortkanal für `mission` der
  // Azubi-Shell anlegen (#421): Sonst lädt der erste Aufruf im Browser mkfifo über 9p nach.
  const script = Buffer.from(
    [
      'for p in $(pgrep -u azubi bash); do',
      '  f=/run/mission/reply.r$p',
      '  [ -p "$f" ] || { mkfifo -m 600 "$f" && chown azubi:azubi "$f"; }',
      'done',
      // Kein drop_caches: Der Page-Cache mit den GUI-Dateien ist hier der Zweck.
      'sync',
    ].join('\n')
  ).toString('base64');
  emulator.serial_send_bytes(1, new TextEncoder().encode(`RUN drop ${script}\n`));
}

emulator.add_listener('serial0-output-byte', (byte) => {
  serial0 += String.fromCharCode(byte);
  maybeSave();
});

emulator.add_listener('serial1-output-byte', (byte) => {
  serial1 += String.fromCharCode(byte);
  maybeSave();
});

emulator.add_listener('serial1-output-byte', async () => {
  if (!saving || stateRequested || !/^RES drop 0 /m.test(serial1)) return;
  stateRequested = true;
  setTimeout(async () => {
    const state = await emulator.save_state();
    fs.writeFileSync(values.out, new Uint8Array(state));
    console.log(`Savestate roh: ${(state.byteLength / 1024 / 1024).toFixed(1)} MiB`);
    clearTimeout(bootTimer);
    emulator.destroy();
    process.exit(0);
  }, 2_000);
});
