// Alle Staffeln, je Staffel eine Datei `staffel-<n>.ts` (#395, D11).
import type { Staffel } from '../../lib/missions/staffelTypes';
import { staffel1 } from './staffel-1';

export const staffeln: Staffel[] = [staffel1];

export const getStaffelById = (id: string): Staffel | undefined =>
  staffeln.find((s) => s.id === id);
