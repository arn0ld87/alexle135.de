/**
 * Rehype-Plugin: gibt GFM-Task-List-Checkboxen ein aria-label.
 *
 * remark-gfm rendert `- [ ] Text` als <input type="checkbox" disabled>
 * ohne zugängliches Label (axe: "label", critical). Dieses Plugin setzt
 * den Textinhalt des umgebenden <li> als aria-label. Bewusst ohne
 * Dependencies (kein unist-util-visit).
 */

function textOf(node) {
  if (node.type === 'text') return node.value;
  // Verschachtelte Listen gehören nicht ins aria-label des Eltern-Items.
  if (node.tagName === 'ul' || node.tagName === 'ol') return '';
  return (node.children ?? []).map(textOf).join('');
}

function visit(node) {
  const className = node.properties?.className;
  const isTaskListItem =
    node.tagName === 'li' && Array.isArray(className) && className.includes('task-list-item');

  if (isTaskListItem) {
    for (const child of node.children ?? []) {
      if (
        child.tagName === 'input' &&
        child.properties?.type === 'checkbox' &&
        !child.properties.ariaLabel
      ) {
        const label = textOf(node).trim();
        if (label) child.properties.ariaLabel = label;
      }
    }
  }

  for (const child of node.children ?? []) visit(child);
}

export default function rehypeTaskListLabels() {
  return (tree) => visit(tree);
}
