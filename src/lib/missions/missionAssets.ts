// Adressen der VM-Assets unter /missions/linux/ (gebaut von scripts/mission-image/build.sh).
// Die Rootfs-Dateien sind inhaltsadressiert. Index, Savestate und BIOS haben feste Namen und
// bekommen die Build-Version als Query (#388): Ein Edge-Cache kann sonst einen alten Index zu
// neuen Rootfs-Dateien liefern, dann hängt das Terminal bis zum Ablauf des Caches.

export const MISSION_ASSET_BASE = '/missions/linux/';

export const FIXED_ASSETS = [
  'alpine-fs.json',
  'alpine-state.bin.zst',
  'seabios.bin',
  'vgabios.bin',
] as const;

export type FixedAsset = (typeof FIXED_ASSETS)[number];

export function missionAssetUrl(name: FixedAsset, version: string | undefined): string {
  const url = `${MISSION_ASSET_BASE}${name}`;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}
