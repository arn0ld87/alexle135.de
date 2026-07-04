---
title: 'Ansible: Wie ich aufgehört hab, Server manuell einzurichten'
summary: 'Nach dem dritten Server hatte ich keine Lust mehr auf die gleichen 20 Befehle. Ansible macht das jetzt für mich.'
publishedAt: 2025-11-21
tags:
  - Ansible
  - DevOps
  - Automatisierung
  - Linux
  - Tutorial
heroImage: /images/blog/server-automatisierung-ansible.webp
author: Alexander Schneider
---

## Das Problem

Jedes Mal wenn ich einen Server aufsetze: System updaten, Benutzer anlegen, SSH absichern, Firewall konfigurieren, Docker installieren...

Nach dem dritten Mal wird's nervig. Nach dem zehnten ist es Zeitverschwendung.

Und ich vergess immer irgendwas. Mal ist die Firewall falsch, mal fehlt ein Package.

## Warum nicht ein Bash-Script?

War mein erster Gedanke. Aber Bash-Scripte haben ein Problem: Sie sind nicht idempotent.

Wenn du `echo "text" >> /etc/config` zweimal ausführst, hast du die Zeile doppelt drin.

Ansible checkt vorher, ob die Zeile schon da ist. Wenn ja, macht es nichts. Wenn nein, fügt es sie hinzu.

Das heißt: Du kannst ein Playbook nach einem Abbruch neu starten und es macht da weiter, wo es aufgehört hat.

## Installation

Ansible läuft auf deinem Rechner, nicht auf dem Server. Du brauchst nur SSH-Zugang.

```bash
# Ubuntu/Debian
sudo apt install ansible -y

# macOS
brew install ansible
```

Check:

```bash
ansible --version
```

## Die Basics

### Inventory – Welche Server?

```ini
# inventory.ini
[webserver]
192.168.1.100

[database]
192.168.1.101

[all:vars]
ansible_user=alex
ansible_ssh_private_key_file=~/.ssh/id_ed25519
```

### Playbook – Was soll passieren?

```yaml
# setup.yml
---
- name: Basis-Setup
  hosts: all
  become: yes

  tasks:
    - name: System updaten
      apt:
        update_cache: yes
        upgrade: dist

    - name: Packages installieren
      apt:
        name:
          - curl
          - git
          - htop
        state: present
```

### Ausführen

```bash
ansible-playbook -i inventory.ini setup.yml
```

Das war's.

## Mein Server-Setup Playbook

Das nutze ich für jeden neuen Server:

```yaml
# secure-server.yml
---
- name: Server absichern
  hosts: all
  become: yes

  vars:
    admin_user: alex

  tasks:
    # System updaten
    - name: Packages updaten
      apt:
        update_cache: yes
        upgrade: dist
        autoremove: yes

    # Admin-User
    - name: User anlegen
      user:
        name: '{{ admin_user }}'
        groups: sudo
        shell: /bin/bash

    - name: SSH-Key hinterlegen
      authorized_key:
        user: '{{ admin_user }}'
        key: "{{ lookup('file', '~/.ssh/id_ed25519.pub') }}"

    # SSH absichern
    - name: Root-Login deaktivieren
      lineinfile:
        path: /etc/ssh/sshd_config
        regexp: '^PermitRootLogin'
        line: 'PermitRootLogin no'
      notify: SSH neu starten

    - name: Passwort-Login deaktivieren
      lineinfile:
        path: /etc/ssh/sshd_config
        regexp: '^PasswordAuthentication'
        line: 'PasswordAuthentication no'
      notify: SSH neu starten

    # Firewall
    - name: UFW installieren
      apt:
        name: ufw
        state: present

    - name: SSH erlauben
      ufw:
        rule: allow
        port: '22'
        proto: tcp

    - name: UFW aktivieren
      ufw:
        state: enabled
        policy: deny

    # Fail2Ban
    - name: Fail2Ban installieren
      apt:
        name: fail2ban
        state: present

    - name: Fail2Ban starten
      service:
        name: fail2ban
        state: started
        enabled: yes

  handlers:
    - name: SSH neu starten
      service:
        name: sshd
        state: restarted
```

**Was das macht:**

1. System updaten
2. Admin-User mit SSH-Key anlegen
3. Root-Login und Passwort-Auth deaktivieren
4. Firewall: Nur SSH erlauben
5. Fail2Ban gegen Brute-Force

Ausführen:

```bash
ansible-playbook -i inventory.ini secure-server.yml
```

5 Minuten. Server ist sicher. Reproduzierbar.

## Fehler, die ich gemacht hab

### SSH-Key nicht gefunden

```
FAILED! => {"msg": "could not locate file in lookup: ~/.ssh/id_ed25519.pub"}
```

**Problem:** Ansible hat den Pfad nicht expanded.

**Lösung:** Den Key vorher generieren ([SSH-Keys einrichten](/blog/ssh-keys-einrichten-linux/)).

### Permission denied

```
fatal: [192.168.1.100]: UNREACHABLE!
```

**Problem:** SSH-Key nicht im Agent oder falscher User.

**Lösung:**

```bash
ssh-add ~/.ssh/id_ed25519
```

Oder im Inventory explizit angeben:

```ini
ansible_user=alex
ansible_ssh_private_key_file=~/.ssh/id_ed25519
```

### Playbook hängt bei apt

**Problem:** Interaktive Abfrage blockiert.

**Lösung:**

```yaml
- apt:
    name: package
  environment:
    DEBIAN_FRONTEND: noninteractive
```

## Variablen auslagern

Statt alles im Playbook:

```yaml
# group_vars/all.yml
admin_user: alex
ssh_port: 22
timezone: Europe/Berlin
```

Dann im Playbook:

```yaml
user:
  name: '{{ admin_user }}'
```

## Templates

Für dynamische Configs:

```jinja
# templates/nginx.conf.j2
server {
    listen 80;
    server_name {{ domain }};
}
```

Im Playbook:

```yaml
- name: Nginx-Config deployen
  template:
    src: nginx.conf.j2
    dest: /etc/nginx/sites-available/{{ domain }}
```

## Tipps

### Check-Mode

Trockenlauf ohne Änderungen:

```bash
ansible-playbook setup.yml --check
```

### Tags

```yaml
- name: Docker installieren
  apt:
    name: docker.io
  tags: docker
```

Nur Docker-Tasks:

```bash
ansible-playbook setup.yml --tags docker
```

### Idempotenz testen

Führs zweimal aus. Beim zweiten Mal sollte `changed=0` stehen:

```
PLAY RECAP
server1 : ok=12   changed=0
```

## Ansible Galaxy

Fertige Roles von anderen:

```bash
ansible-galaxy install geerlingguy.docker
```

Im Playbook:

```yaml
- hosts: all
  roles:
    - geerlingguy.docker
```

Spart Zeit. Aber: Vorher anschauen was die Role macht.

## Projektstruktur

So sieht mein Ansible-Repo aus:

```
ansible/
├── inventory/
│   ├── production.ini
│   └── staging.ini
├── group_vars/
│   └── all.yml
├── playbooks/
│   ├── setup.yml
│   └── deploy.yml
└── README.md
```

Alles in Git. Wenn ein Server stirbt, hab ich in Minuten einen neuen.

## Fazit

Ansible hat meine Server-Verwaltung verändert. Statt 30 Minuten manuelle Konfiguration brauch ich 5 – und das Ergebnis ist jedes Mal identisch.

Fang klein an. Ein Playbook für dein Basis-Setup. Dann schrittweise erweitern.

**Weiterlesen:**

- [SSH-Keys einrichten](/blog/ssh-keys-einrichten-linux/)
- [Docker Compose Stacks](/blog/docker-compose-beispiele/)
- [Docker auf Ubuntu installieren](/blog/docker-ubuntu-setup/)

Bei Fragen: [schneider@alexle135.de](mailto:schneider@alexle135.de)
