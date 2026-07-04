# Design System: alexle135 v2

## 1. Core Principles

- **Dark Mode First:** The primary aesthetic is dark, sleek, and developer-focused.
- **Blue & Glass:** Uses `brand-blue` (#3b82f6) for primary actions and glassmorphism for depth.
- **Content-First:** Typography and spacing guide the user; decoration is secondary.
- **Motion:** Subtle, meaningful interactions (hover, focus, page transitions).

## 2. Design Tokens

### Colors

| Token            | Value                       | Usage                                   |
| :--------------- | :-------------------------- | :-------------------------------------- |
| `brand-blue-400` | `#60a5fa`                   | Hover states, accents                   |
| `brand-blue-500` | `#3b82f6`                   | **Primary Brand Color**, Buttons, Links |
| `brand-blue-600` | `#2563eb`                   | Active states, focus rings              |
| `surface-glass`  | `rgba(255, 255, 255, 0.05)` | Card backgrounds                        |
| `surface-border` | `rgba(255, 255, 255, 0.1)`  | Card borders                            |
| `bg-dark`        | `#0a0a0a`                   | Main background                         |
| `text-primary`   | `#ffffff`                   | Headings, primary text                  |
| `text-muted`     | `#9ca3af`                   | Secondary text, captions                |

### Typography

- **Font Family Sans:** System Stack (`-apple-system`, `BlinkMacSystemFont`, etc.) - Clean, legible.
- **Font Family Mono:** `Fira Code`, `JetBrains Mono` - Tech/Code feel.
- **Scale:**
  - `h1`: 2.5rem - 4rem (Hero)
  - `h2`: 2rem - 3rem (Section Headers)
  - `h3`: 1.5rem - 2rem (Card Titles)
  - `body`: 1rem - 1.125rem (Readability is key)

### Spacing & Layout

- **Container:** Max-width `1280px` (standard), `768px` (text-heavy/blog).
- **Grid:** 12-column grid for main layouts.
- **Spacing Scale:** Tailwind default (`p-4`, `m-8`, etc.).

### Effects

- **Glassmorphism:**
  - `.glass-panel`: Backdrop blur 12px, white/5% bg, white/10% border.
- **Shadows:**
  - `shadow-glow`: Blue-tinted shadow for active elements.

## 3. Component Standards

### Buttons

- **Primary:** Solid Blue (`bg-brand-blue-500`), White Text, Rounded-md. Hover: Lighter Blue.
- **Secondary:** Glass (`bg-white/5`), Border (`border-white/10`). Hover: White/10.
- **Ghost:** Transparent, Text-only. Hover: Background tint.

### Cards

- Standard Card: `.glass-panel` style. Rounded-xl. Padding-6.
- Interactive Card: Hover lift (`-translate-y-1`), border brightening.

### Forms

- Inputs: Dark background (`bg-black/20`), Border (`border-white/10`).
- Focus: `ring-2 ring-brand-blue-500`.
- Labels: `text-sm text-muted`.

## 4. Copy Rules

- **Tone:** Professional, direct, enthusiastic but grounded.
- **Headlines:** Action-oriented ("Build better software", not "Welcome to my site").
- **Structure:** Short paragraphs, bullet points for scannability.
- **Language:** German (Primary), English (Tech terms/Code).

## 5. Do's & Don'ts

- **DO:** Use `brand-blue` sparingly for focus.
- **DO:** Ensure high contrast for text.
- **DON'T:** Use gradient text for body copy.
- **DON'T:** Overuse glassmorphism (max 2 layers: background > card > element).
