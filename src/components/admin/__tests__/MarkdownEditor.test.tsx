import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarkdownEditor from '../MarkdownEditor';

describe('MarkdownEditor', () => {
  // Regressionsschutz für Audit-Befund F-02: Der Submit-Handler in
  // src/pages/admin/posts/[id].astro findet den Editor ausschliesslich über
  // `textarea[name="content"]`. Fehlte das Attribut, lief der Selector ins
  // Leere und jeder Speichervorgang schrieb still den alten Body zurueck.
  it('exponiert die Textarea unter dem vom Post-Editor erwarteten Selector', () => {
    render(<MarkdownEditor initialValue="# Hallo" />);

    const field = document.querySelector<HTMLTextAreaElement>('textarea[name="content"]');

    expect(field).not.toBeNull();
    expect(field?.value).toBe('# Hallo');
  });

  it('spiegelt Eingaben in genau dem Feld, das der Submit-Handler ausliest', async () => {
    const user = userEvent.setup();
    render(<MarkdownEditor initialValue="" />);

    await user.type(screen.getByRole('textbox'), 'neuer Text');

    const field = document.querySelector<HTMLTextAreaElement>('textarea[name="content"]');
    expect(field?.value).toBe('neuer Text');
  });

  it('reicht Änderungen an onChange durch', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    render(<MarkdownEditor initialValue="" onChange={(v) => seen.push(v)} />);

    await user.type(screen.getByRole('textbox'), 'ab');

    expect(seen).toEqual(['a', 'ab']);
  });
});
