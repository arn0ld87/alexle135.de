import { render } from '@testing-library/react';
import { Contact } from '../Contact';

describe('Contact – progressive enhancement', () => {
  it('form has action="/api/contact" and method="post"', () => {
    const { container } = render(<Contact />);
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    expect(form!.getAttribute('action')).toBe('/api/contact');
    expect(form!.getAttribute('method')).toBe('post');
  });

  it('all required fields are present by name attribute', () => {
    const { container } = render(<Contact />);
    expect(container.querySelector('[name="name"]')).not.toBeNull();
    expect(container.querySelector('[name="email"]')).not.toBeNull();
    expect(container.querySelector('[name="message"]')).not.toBeNull();
    expect(container.querySelector('[name="website"]')).not.toBeNull();
  });
});
