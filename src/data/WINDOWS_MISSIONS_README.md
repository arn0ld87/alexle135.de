# Windows Terminal Missionen - Technische Dokumentation

## Übersicht

Diese Datei dokumentiert die Windows CMD/PowerShell Missionen, die zum bestehenden Terminal-Missions-System hinzugefügt wurden.

## Missionsstruktur

Alle Windows-Missionen folgen dem gleichen TypeScript-Interface wie die bestehenden Linux/Docker/Git-Missionen:

```typescript
interface Mission {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'linux' | 'docker' | 'git' | 'devops' | 'windows';
  estimatedTime: number;
  steps: MissionStep[];
  prerequisites?: string[];
}
```

## Verfügbare Windows-Missionen

### 1. Windows CMD Grundlagen (`windows-basics-1`)

- **Schwierigkeit:** beginner
- **Zeit:** 7 Minuten
- **Schritte:** 7
- **Themen:** ver, cd, dir, mkdir, set, cls, ipconfig

### 2. Windows Dateiverwaltung (`windows-files-1`)

- **Schwierigkeit:** beginner
- **Zeit:** 10 Minuten
- **Schritte:** 8
- **Themen:** mkdir, cd, echo, type, copy, attrib, tree

### 3. Windows Netzwerk-Diagnose (`windows-networking-1`)

- **Schwierigkeit:** intermediate
- **Zeit:** 12 Minuten
- **Schritte:** 8
- **Prerequisites:** windows-basics-1
- **Themen:** ipconfig /all, flushdns, ping, tracert, netstat, route, arp, nslookup

### 4. Diskpart - Datenträgerverwaltung (`windows-diskpart-1`)

- **Schwierigkeit:** advanced
- **Zeit:** 15 Minuten
- **Schritte:** 9
- **Prerequisites:** windows-basics-1, windows-files-1
- **Themen:** diskpart, list disk, list volume, select, detail

### 5. PowerShell Grundlagen (`windows-powershell-1`)

- **Schwierigkeit:** intermediate
- **Zeit:** 14 Minuten
- **Schritte:** 10
- **Prerequisites:** windows-basics-1
- **Themen:** Cmdlets, Pipeline, Get-Process, Get-Service, Get-EventLog, Filtering

### 6. Windows Expert Challenge (`windows-advanced-1`)

- **Schwierigkeit:** advanced
- **Zeit:** 20 Minuten
- **Schritte:** 12
- **Prerequisites:** windows-networking-1, windows-powershell-1, windows-diskpart-1
- **Themen:** WMIC, schtasks, Registry, Performance-Monitoring, Firewall

## Lernkurve

Die Missionen sind so konzipiert, dass sie eine natürliche Progression bieten:

```
Beginner (17 Min):
├── windows-basics-1 (7 Min)
└── windows-files-1 (10 Min)

Intermediate (26 Min):
├── windows-networking-1 (12 Min)
└── windows-powershell-1 (14 Min)

Advanced (35 Min):
├── windows-diskpart-1 (15 Min)
└── windows-advanced-1 (20 Min)
```

**Gesamtdauer:** Ca. 78 Minuten (1h 18min) für alle Windows-Missionen

## Validierung

### Typen von Validierung

1. **requiredCommand:** Exakte Übereinstimmung (case-insensitive)

   ```typescript
   requiredCommand: 'ipconfig';
   ```

2. **validationRegex:** Flexible Pattern-Matching

   ```typescript
   validationRegex: /^(mkdir|md)\s+Workspace$/i;
   ```

3. **expectedOutput:** Erwartete Ausgabe (für Simulation)

   ```typescript
   expectedOutput: 'visitor@alexle135.de';
   ```

### Regex-Patterns Explained

#### CMD Alternativen

```typescript
/^(mkdir|md)\s+Workspace$/i;
```

- Erlaubt `mkdir` oder `md`
- Case-insensitive durch `i` Flag

#### PowerShell Pipeline

```typescript
/^Get-Process\s*\|\s*Sort(-Object)?\s+CPU\s+-Desc(ending)?\s*\|\s*Select(-Object)?\s+-First\s+5$/i;
```

- Erlaubt Kurzformen: `Sort` oder `Sort-Object`
- Erlaubt `-Desc` oder `-Descending`
- Flexible Whitespace mit `\s*` und `\s+`

#### Parameter-flexible Befehle

```typescript
/^wmic\s+bios\s+get/i;
```

- Erlaubt beliebige Parameter nach `get`
- Beispiel akzeptiert: `wmic bios get manufacturer,version,serialnumber`

## Sicherheitshinweise in den Missionen

### Gefährliche Befehle (mit Warnungen versehen)

1. **Diskpart**

   ```typescript
   hint: 'Mit "select disk 1" wählst du den Datenträger. ⚠️ In der Realität vorher prüfen!';
   ```

2. **Registry-Operationen**
   - Nur `reg query` (Lesen) in den Missionen
   - Niemals `reg delete` oder `reg add` in Anfänger-Missionen

3. **WMIC product**

   ```typescript
   hint: 'Mit "wmic product get name,version" siehst du alle Programme.';
   ```

   ⚠️ HINWEIS: `wmic product` kann in echten Systemen Reparaturen triggern. In der Simulation safe.

## Integration mit bestehendem System

### missions.ts Änderungen

1. **Interface erweitert:**

   ```typescript
   category: 'linux' | 'docker' | 'git' | 'devops' | 'windows';
   ```

2. **Neue Exports:**

   ```typescript
   export const windowsBasicsMission: Mission = {
     /* ... */
   };
   export const windowsFileManagementMission: Mission = {
     /* ... */
   };
   export const windowsNetworkingMission: Mission = {
     /* ... */
   };
   export const windowsDiskpartMission: Mission = {
     /* ... */
   };
   export const windowsPowerShellMission: Mission = {
     /* ... */
   };
   export const windowsAdvancedMission: Mission = {
     /* ... */
   };
   ```

3. **allMissions Array erweitert:**

   ```typescript
   export const allMissions: Mission[] = [
     // ... existing missions
     windowsBasicsMission,
     windowsFileManagementMission,
     windowsNetworkingMission,
     windowsDiskpartMission,
     windowsPowerShellMission,
     windowsAdvancedMission,
   ];
   ```

### Bestehende Helper-Funktionen (kompatibel)

```typescript
getMissionById('windows-basics-1');
getMissionsByCategory('windows');
getMissionsByDifficulty('advanced');
```

## Terminal-Simulation Anforderungen

Die Windows-Missionen erfordern folgende Erweiterungen der Terminal-Emulation:

### CMD Emulation

1. **Grundbefehle:**
   - `ver`, `cd`, `dir`, `mkdir/md`, `set`, `cls`
   - `echo`, `type`, `copy`, `attrib`, `tree`

2. **Netzwerk:**
   - `ipconfig` (inkl. `/all`, `/flushdns`)
   - `ping`, `tracert`, `netstat`, `route`, `arp`, `nslookup`

3. **System:**
   - `systeminfo`, `wmic`, `schtasks`, `reg query`

### PowerShell Emulation

1. **Variablen:**
   - `$PSVersionTable`

2. **Core Cmdlets:**
   - `Get-Command`, `Get-Help`
   - `Get-Process`, `Get-Service`
   - `Get-EventLog`, `Get-ComputerInfo`
   - `Get-ChildItem`, `Get-Content`
   - `Get-NetAdapter`, `Get-WindowsUpdateLog`

3. **Pipeline-Operatoren:**
   - `|` (Pipe)
   - `Sort-Object`, `Where-Object`, `Select-Object`

4. **Parameter-Aliase:**
   - `Sort` ↔ `Sort-Object`
   - `Where` ↔ `Where-Object`
   - `Select` ↔ `Select-Object`
   - `-Desc` ↔ `-Descending`

### Diskpart Context

Spezielle Anforderung: **Kontextwechsel**

```cmd
C:\> diskpart
DISKPART> list disk
DISKPART> exit
C:\>
```

Die Simulation muss zwischen CMD-Kontext und DISKPART-Kontext wechseln können.

## Testing-Strategie

### Unit Tests (empfohlen)

```typescript
describe('Windows Missions', () => {
  it('should validate mkdir command', () => {
    const step = windowsBasicsMission.steps[3];
    expect(step.validationRegex?.test('mkdir Workspace')).toBe(true);
    expect(step.validationRegex?.test('md Workspace')).toBe(true);
    expect(step.validationRegex?.test('MKDIR WORKSPACE')).toBe(true);
  });

  it('should validate PowerShell pipeline', () => {
    const step = windowsPowerShellMission.steps[4];
    const valid = 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 5';
    const validShort = 'Get-Process | Sort CPU -Desc | Select -First 5';

    expect(step.validationRegex?.test(valid)).toBe(true);
    expect(step.validationRegex?.test(validShort)).toBe(true);
  });
});
```

### E2E Tests

1. Mission komplett durchspielen
2. Hints anzeigen
3. Falsche Eingaben → Feedback
4. Richtige Eingaben → Next Step
5. Mission abschließen

## Erweiterungsmöglichkeiten

### Geplante zukünftige Missionen

1. **Active Directory Basics**
   - `Get-ADUser`, `Get-ADGroup`, `Add-ADGroupMember`

2. **Windows Server Administration**
   - `Install-WindowsFeature`, `Get-WindowsFeature`
   - IIS-Management

3. **Batch Scripting**
   - Variablen, Schleifen, Bedingungen
   - .bat File-Erstellung

4. **PowerShell Scripting Advanced**
   - Funktionen, Module, Error-Handling
   - Remote-Verwaltung mit `Invoke-Command`

5. **Windows Security**
   - Berechtigungen (`icacls`)
   - Firewall-Regeln erstellen/ändern
   - BitLocker-Verwaltung

## Brand Alignment (Alexle135)

### Tonalität in Descriptions/Hints

- ✅ **Direkt & Praktisch:** "Nutze X um Y zu machen"
- ✅ **Lernfördernd:** Nicht nur "Was" sondern auch "Warum"
- ✅ **Sicherheitsbewusst:** Warnungen bei gefährlichen Befehlen
- ✅ **Realistisch:** Echte IT-Szenarien

### Beispiele

**Gut:**

> "Der Befehl \"ipconfig /all\" zeigt extended Netzwerkinformationen. Im IT-Support brauchst du das täglich."

**Vermeiden:**

> "Type ipconfig /all"

### CMO-Approved Messaging

- Fokus auf **Praxisnutzen**
- **Keine** unnötigen akademischen Erklärungen
- **Klare** Erfolgsmetriken (Zeit, Schwierigkeit)
- **Sicherheit** immer erwähnen wo relevant

## Change Log

### Version 1.0.0 (2025-11-24)

- ✅ 6 Windows-Missionen hinzugefügt
- ✅ Category 'windows' zum Interface hinzugefügt
- ✅ Blog-Artikel erstellt
- ✅ Dokumentation erstellt
- ⏳ Terminal-Emulation noch anzupassen
- ⏳ Hero-Image generieren

## Kontakt

**Maintainer:** Alexander Schneider (alexle135)
**Projekt:** Terminal Missionen
**Website:** [alex-schneider.dev](https://alex-schneider.dev)

Bei Fragen zu den Windows-Missionen: [Kontaktformular](/kontakt/)
