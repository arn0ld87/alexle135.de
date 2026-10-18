import LinuxMissions from '../missions/LinuxMissions';

/**
 * Linux- und Git-Missionen auf echtem Linux im Browser (v86).
 * Windows-Missionen laufen als Simulation über WindowsMissionTerminal.
 */
export default function MissionTerminal() {
  return <LinuxMissions />;
}
