# Slipakar branding

![Slipakar icon](icon.svg)

**Slip + akar (root).** A payslip that grows roots into your own infrastructure: every document, delivered from the ground you own.

## Logo

Both marks are hand-written SVG: no tracing, gradients or effects.

| File | Use |
| --- | --- |
| [`icon.svg`](icon.svg) | The icon. 64 x 64, lime rounded square (radius 18), a blocky ink "S" as one closed path, and a clay dot at (53, 11) |
| [`icon-192.png`](icon-192.png), [`icon-512.png`](icon-512.png) | PNG renders for app manifests, store listings and social profile images |
| [`favicon.svg`](favicon.svg) | Copy of `icon.svg` for modern browsers |
| [`favicon.ico`](favicon.ico) | 16 and 32 px renders packed in one ICO |
| [`wordmark.svg`](wordmark.svg) | "Slipakar" in live text (Bricolage Grotesque ExtraBold, -3 letter spacing) with a clay full stop. For light surfaces |
| [`wordmark-dark.svg`](wordmark-dark.svg) | Cream text with a lime full stop on the dark background. For dark surfaces |

The wordmark is live text, so it needs Bricolage Grotesque to be loaded. Without it the browser falls back to Plus Jakarta Sans, then the system font. The full stop is clay on light surfaces because lime on cream does not have enough contrast.

Contrast: ink (`#151513`) on lime (`#D4F03C`) is above 7:1.

### Rules

- Use the icon where space is tight (favicons, avatars, app tiles). Use the wordmark where the name must be read.
- Clear space: for the icon, 1/4 of its width on every side. For the wordmark, the height of its capital "S" on every side.
- Do not recolour the glyph, stretch, rotate or add effects.
- Do not place either mark on low-contrast surfaces. Use `wordmark-dark.svg` on dark backgrounds.
- The clay dot is a small accent. Do not enlarge it, move it or add more dots.
- Keep the icon at 16 px or larger.

### Favicons

The icon is the favicon for all three web apps (`apps/user-web`, `apps/admin-web`, `apps/landing-web`). Each has `public/favicon.svg`, `public/favicon.ico` (16 and 32 px) and `public/apple-touch-icon.png` (180 px), linked from its `index.html`. When the icon changes, update `favicon.svg`, `favicon.ico` and `apple-touch-icon.png` in all three.

## Design system

This is the default design system used by the landing site and the user app (the admin app follows the user app). The source of truth is the CSS tokens in `apps/user-web/src/styles.css` and `apps/landing-web/src/styles.css`.

### Brand colours

| Name | Hex | Role |
| --- | --- | --- |
| Ink | `#151513` (text), `#000000` (third colour, borders, shadows) | Text, borders, hard shadows |
| Lime | `#D4F03C` | Accent: primary buttons, highlights, selected states |
| Akar Clay | `#A87D55` light, `#D9B38F` dark | Secondary: badges, chips, secondary blocks |
| Cream | `#F7EFE7` | Light background, dark-mode text |

Text on lime or clay is always ink (`#151513`/`#000000`), in both themes. Never use lime as text colour on light surfaces.

### Theme tokens

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `#F7EFE7` | `#121210` |
| `--card` / `--popover` | `#FFFBF6` | `#1D1D1A` |
| `--foreground` | `#151513` | `#F7EFE7` |
| `--muted-foreground` | `#5E5A53` | `#A8A196` |
| `--muted` | `#EFE7DC` | `#292824` |
| `--border` / `--input` | `#E2D8CC` | `#2E2D29` |
| `--primary` (accent) | `#D4F03C` | `#D4F03C` |
| `--primary-foreground` | `#000000` | `#000000` |
| `--secondary` | `#A87D55` | `#D9B38F` |

The accent is the same lime in both themes, only neutral surfaces change. Users can change the accent, secondary and third colours per theme, and switch between the **Styled** and **Unstyled** appearance, in Profile (user app) and Preferences (admin app). Backgrounds are always plain solid colours: no gradients or patterns.

### Typography

| Use | Font | Weights |
| --- | --- | --- |
| Headings, buttons, tabs, table headers, wordmark | Bricolage Grotesque | 600 to 800 |
| Body, forms, tables | Plus Jakarta Sans | 400 to 700 |
| Code | `ui-monospace` stack | 400 to 600 |

Fonts load from Google Fonts. The web CSP allows `fonts.googleapis.com` and `fonts.gstatic.com`. System fonts are the fallback.

### Shape, borders and shadows

| Token | Value |
| --- | --- |
| `--radius-pill` | `999px` (buttons, chips, tabs, header) |
| `--radius-card` | `1rem` |
| `--radius-control` | `0.85rem` |
| `--border-width-strong` | `3px` (buttons) |
| `--border-width-card` | `2px` |
| `--shadow-hard` | `4px 4px 0` in the third colour |
| `--shadow-hover` | `4px 6px 0` (hover lifts 2px) |
| `--shadow-pressed` | `1px 1px 0` (pressed moves 3px) |

### Components

- **Primary button:** lime fill, ink text, strong ink border, hard shadow, pill. Hover lifts, press moves toward the shadow (`appPressed` directive).
- **Quiet button:** outlined, surface fill, no shadow. Used for chips, editor tools and grouped controls.
- **Grouped controls** (segmented tabs, input with button): the group owns the border and shadow, items inside do not. The password field and its Show/Hide button on the sign-in pages are one input group.
- **Links in content:** foreground colour with a persistent underline. Mode switches on the sign-in pages ("Create an account" / "Sign in") use this style instead of a button.
- **Tables:** solid accent header with ink text, card-per-row on mobile.
- **Menus:** single-line items at equal row height, no per-item borders or shadows.
- **Cards, drawers and modals:** surface fill, 2px border, rounded 1rem. Use a drawer (`app-drawer`) for long or multi-section content such as forms with many fields, details and maps. Use a centred modal (`app-modal`) for short confirmations, short information and forms with up to three fields.
- **Sign-in pages:** the header is the sidebar wordmark ("Slipakar" with the clay dot), not a logo tile.
- **Maps:** the login location map fills its drawer, marks the point in the accent error colour and has zoom in/out buttons (levels 3 to 17).
- **Icons:** Tabler icons.

### Styled and Unstyled

Styled (default) uses the pill shapes, strong borders and hard shadows above. Unstyled keeps the same colours and fonts but uses 1px borders, small radii, no hard shadows and no pressed movement. The choice is set with `data-style` on `<html>`.
