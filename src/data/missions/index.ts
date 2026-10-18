// Reihenfolge der Missionen: so stehen sie in der Liste, so springt `mission next` weiter.
// Je Mission eine Datei `<nr>-<slug>.ts`; gemeinsame Bausteine in shared.ts.
import type { V86Mission } from '../../lib/missions/missionTypes';
import { linuxBasics } from './01-linux-grundlagen';
import { linuxFiles } from './02-linux-dateien';
import { linuxCtfHiddenTreasure } from './03-linux-versteckt';
import { linuxCtfLogDetective } from './04-linux-logs';
import { linuxCtfPrivesc } from './05-linux-rechte';
import { gitBasics } from './06-git-grundlagen';
import { gitBranching } from './07-git-branching';
import { gitCtfRewind } from './08-git-historie';

export const v86Missions: V86Mission[] = [
  linuxBasics,
  linuxFiles,
  linuxCtfHiddenTreasure,
  linuxCtfLogDetective,
  linuxCtfPrivesc,
  gitBasics,
  gitBranching,
  gitCtfRewind,
];

export const getV86MissionById = (id: string): V86Mission | undefined =>
  v86Missions.find((m) => m.id === id);
