import React from 'react';
import BaseMissionTerminal from './BaseMissionTerminal';

/**
 * Linux/Docker/Git Mission Terminal
 * Wrapper um BaseMissionTerminal für Linux-basierte Missionen
 */
export default function MissionTerminal() {
  return <BaseMissionTerminal mode="linux" />;
}
