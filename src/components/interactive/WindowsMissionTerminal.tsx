import React from 'react';
import BaseMissionTerminal from './BaseMissionTerminal';

/**
 * Windows CMD/PowerShell Mission Terminal
 * Wrapper um BaseMissionTerminal für Windows-basierte Missionen
 */
export default function WindowsMissionTerminal() {
  return <BaseMissionTerminal mode="windows" />;
}
