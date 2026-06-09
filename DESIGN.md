---
version: 2.0
name: กองทุนไทย Research Dashboard — Design System
description: A clean, data-forward financial dashboard for Thai mutual fund research. The base atmosphere is a cool slate canvas with a deep blue brand primary. Typography runs Noto Sans Thai + Inter throughout — Thai-first, readable, functional. Brand voltage comes from the blue/white pairing. Semantic color coding is used extensively for financial data (positive green, negative red, risk levels). The hero is a split layout with a live data preview card on the right, proving product value before the user scrolls. The footer is dark slate-900 — a strong visual close to every page.

colors:
  # Core
  background: "#F8FAFC"       # slate-50 — page floor
  foreground: "#0F172A"       # slate-900 — primary text
  card: "#FFFFFF"             # white — card surface
  border: "#E2E8F0"           # slate-200 — all dividers

  # Brand
  primary: "#1D4ED8"          # blue-700 — CTAs, links, active states
  primary-hover: "#1E40AF"    # blue-800 — button press

  # Text scale
  text-heading: "#0F172A"     # slate-900
  text-body: "#1E293B"        # slate-800 (implicit — body default)
  text-secondary: "#475569"   # slate-600 — nav links, descriptions
  text-muted: "#64748B"       # slate-500 — captions, placeholders
  text-subtle: "#94A3B8"      # slate-400 — fine print, timestamps

  # Semantic — financial data
  positive: "#16A34A"         # green-600 — gains, upward returns
  positive-emerald: "#059669" # emerald-600 — gains on dark surfaces (hero preview card)
  negative: "#DC2626"         # red-600 — losses, downward returns
  warning: "#F59E0B"          # amber-500 — disclaimers, risk alerts

  # Surface accents
  muted-bg: "#F1F5F9"         # slate-100 — secondary buttons, hover bg
  blue-tint: "#EFF6FF"        # blue-50 — icon backgrounds, active nav item bg
  blue-icon: "#2563EB"        # blue-600 — icon color inside blue-50 wrappers
  amber-tint: "#FFFBEB"       # amber-50 — disclaimer banners
  amber-border: "#FDE68A"     # amber-200 — disclaimer banner border

  # Hero gradient
  hero-from: "#1D4ED8"        # blue-700
  hero-to: "#1E3A8A"          # blue-900

  # Footer (dark)
  footer-bg: "#0F172A"        # slate-900
  footer-border: "#1E293B"    # slate-800 — internal dividers
  footer-text: "#94A3B8"      # slate-400 — body text
  footer-text-subtle: "#475569" # slate-600 — fine print / copyright
  footer-link-hover: "#FFFFFF"  # white — link hover on dark

typography:
  font-family: "'Noto Sans Thai', 'Inter', -apple-system, sans-serif"
  # Thai content takes priority — Noto Sans Thai loaded first.
  # Inter handles all Latin characters (fund codes, English labels).

  h1:
    fontSize: 30–48px          # responsive: text-3xl sm:text-4xl lg:text-5xl
    fontWeight: 700
    lineHeight: tight (1.25)   # leading-tight
    letterSpacing: tight       # tracking-tight (-0.025em) — REQUIRED at large sizes
    color: white on hero, slate-900 on canvas
  h2:
    fontSize: 24px             # text-2xl
    fontWeight: 700
    letterSpacing: tight       # tracking-tight
    color: slate-900
  h3 / card-title:
    fontSize: 16px             # text-base
    fontWeight: 600
    color: slate-900
  body:
    fontSize: 16px             # text-base
    fontWeight: 400
    lineHeight: 1.55
    color: slate-800
  body-sm:
    fontSize: 14px             # text-sm
    fontWeight: 400
    color: slate-500–700
  caption:
    fontSize: 12px             # text-xs
    fontWeight: 400–600
    color: slate-400–500
  label-uppercase:
    fontSize: 14px             # text-sm
    fontWeight: 600
    letterSpacing: wide (tracking-wide)
    textTransform: uppercase
    color: matches section icon color (blue-700 or amber-600)

rounded:
  sm: rounded-md (6px)
  default: rounded-lg (8px)
  card: rounded-xl (12px)
  hero-preview: rounded-2xl (16px)
  pill: rounded-full

spacing:
  section-y: py-10 to py-14 (40–56px)
  card-p: p-5 or p-6 (20–24px)
  gap-grid: gap-4 to gap-6 (16–24px)
  nav-h: h-16 (64px)

components:
  logo:
    mark: ChartMark — custom SVG, 3 ascending filled bars (rx 1.5), blue-700 on navbar / blue-400 on dark footer
    wordmark: bold "กองทุนไทย" blue-700 + light "Research Dashboard" slate-400 (hidden mobile)
    never-use: generic Lucide icons (TrendingUp, BarChart) as the brand mark
  button-primary:
    backgroundColor: blue-700 (#1D4ED8)
    textColor: white
    hover: blue-800
    rounded: rounded-lg
    height: h-9 (36px default) / h-8 sm / h-10 lg / h-12 xl
    padding: px-4 py-2 default
    fontSize: text-sm, font-medium
    focusRing: ring-2 ring-blue-700
  button-outline:
    backgroundColor: white
    border: 1px slate-200
    textColor: slate-900
    hover: bg-slate-50
    rounded: rounded-lg
  button-secondary:
    backgroundColor: slate-100
    textColor: slate-900
    hover: slate-200
  button-ghost:
    backgroundColor: transparent
    textColor: slate-700
    hover: bg-slate-100
  button-cta-on-blue:
    # Used inside the CTA band (blue-700 bg) — inline element, NOT Button component
    backgroundColor: white
    textColor: blue-700
    hover: bg-blue-50
    rounded: rounded-lg
    padding: px-8 py-3.5
    fontSize: text-base, font-semibold
    note: render as <Link> with className, not <Button variant="outline"> — avoids style conflicts
  input:
    backgroundColor: white
    border: 1px slate-200
    rounded: rounded-lg
    height: h-10 (40px)
    padding: px-3 py-2
    fontSize: text-sm
    placeholder: slate-400
    focusRing: ring-2 ring-blue-700
  card:
    backgroundColor: white
    border: 1px slate-200
    rounded: rounded-xl
    shadow: shadow-sm
    padding: p-5 or p-6
    hoverLinked: hover:shadow-md hover:border-blue-200
  feature-card-icon:
    # ALL feature card icon wrappers use the same color — no per-card color variety
    backgroundColor: blue-50 (#EFF6FF)
    iconColor: blue-600 (#2563EB)
    rounded: rounded-lg
    padding: p-2.5
  badge-default:
    backgroundColor: blue-700
    textColor: white
    rounded: rounded-full
    padding: px-2.5 py-0.5
    fontSize: text-xs, font-semibold
  badge-secondary:
    backgroundColor: slate-100
    textColor: slate-800
  badge-outline:
    border: 1px slate-200
    textColor: slate-700
  badge-success:
    backgroundColor: green-100
    textColor: green-800
  badge-warning:
    backgroundColor: amber-100
    textColor: amber-800
  badge-destructive:
    backgroundColor: red-100
    textColor: red-800
  navbar:
    backgroundColor: "white/95 with backdrop-blur"
    border: border-b border-slate-200
    height: h-16 (64px)
    logo: ChartMark SVG (blue-700) + bold "กองทุนไทย" (blue-700) + "Research Dashboard" (slate-400)
    navLinks: text-slate-600, active text-blue-700
    activeNavBg: bg-blue-50 (mobile only)
    dropdown: white bg, shadow-lg, rounded-xl, slate-200 border
    ctaButton: button-primary size sm
  hero-band:
    layout: grid cols-1 lg:cols-2, items-center, gap-10 lg:gap-16
    maxWidth: max-w-7xl (full-width grid, not centered narrow)
    padding: py-14 sm:py-20
    background: bg-gradient-to-b from-blue-700 to-blue-900
    left-col: timestamp badge, h1, subtitle, FundSearch, quick-filter pills
    right-col: live preview card (hidden on mobile, lg:block)
  hero-preview-card:
    # Right column of hero — shows top 3 funds from current month
    backgroundColor: white/10 with backdrop-blur-sm
    border: border border-white/20
    rounded: rounded-2xl
    padding: p-6
    header: Trophy icon (amber-400) + "ยอดเยี่ยมเดือนนี้" uppercase amber-400 label
    rows: rounded-xl bg-white/5 hover:bg-white/10, rank number in medal colors, fund name white, AMC white/50, return emerald-400 tabular-nums
    footer: disclaimer text white/30
  hero-h1-accent:
    # The second line of the hero h1 — "เพื่อการศึกษา"
    color: text-white/80
    never-use: text-blue-200 (fails contrast on blue-700 bg)
  section-label:
    # Pattern used to open every major section — icon + uppercase text + h2
    pattern: "<Icon className='h-5 w-5 [color]'/> <span className='text-sm font-semibold [color] uppercase tracking-wide'>[label]</span>"
    rankings: Trophy icon + text-amber-600 label (amber = achievement)
    tools: BarChart2 icon + text-blue-700 label (blue = informational)
    risk: Shield icon + text-blue-700 label (blue = informational)
    h2: "text-2xl font-bold text-slate-900 tracking-tight"
  cta-band:
    backgroundColor: bg-blue-700
    textColor: white / blue-100 body
    maxWidth: max-w-4xl centered
    padding: py-14
    h2: text-2xl sm:text-3xl font-bold tracking-tight
    button: inline bg-white text-blue-700 (see button-cta-on-blue above)
  disclaimer-banner:
    backgroundColor: bg-amber-50
    border: border-t border-amber-200
    textColor: text-amber-800 text-sm
    placement: standalone section between CTA band and footer — NOT inside the footer
  footer:
    backgroundColor: bg-slate-900
    padding: py-12
    brandMark: ChartMark SVG (blue-400) + white bold wordmark
    bodyText: text-sm text-slate-400
    disclaimerText: text-xs text-slate-500 (inline, no box)
    linkColor: text-slate-400 hover:text-white
    sectionHeadings: text-xs font-semibold text-slate-400 uppercase tracking-widest
    divider: border-t border-slate-800
    copyrightText: text-xs text-slate-600
    never: amber warning box inside footer — disclaimer lives in its own section above
---

## Overview

กองทุนไทย Research Dashboard uses a **clean, data-forward slate canvas** as its base. The page floor is `slate-50` (#F8FAFC) — slightly cooler than pure white, creating subtle depth against white cards. Everything sits on white card surfaces (`#FFFFFF`) with `slate-200` hairline borders.

The brand color is **deep blue** (`#1D4ED8` — Tailwind `blue-700`). Blue is used for every interactive element: primary CTA buttons, active nav links, focus rings, and inline text links. It reads as trustworthy and financial — appropriate for a SEC-data platform.

The typography stack is **Thai-first**: Noto Sans Thai loads before Inter. All headings use `tracking-tight` at h1 and h2 sizes — this is non-negotiable at large weights. Without it, bold Thai text at 48px reads as cramped and default.

**Financial semantic colors** are the most distinctive design element: a 5-level risk color scale (green → lime → yellow → orange → red) and positive/negative return colors (green-600 / red-600 on light, emerald-600 on dark).

## Colors

### Brand
- **Primary blue** (`#1D4ED8` / `blue-700`): All primary CTAs, active nav states, focus rings, text links, brand logo on light surfaces.
- **Primary hover** (`#1E40AF` / `blue-800`): Button pressed / hover deeper state.
- **Blue-400** (`#60A5FA`): Logo mark color on dark footer only.

### Canvas & Surfaces
- **Page background** (`#F8FAFC` / `slate-50`): The default page floor. Slightly cool, never pure white.
- **Card surface** (`#FFFFFF`): All card backgrounds — pure white against slate-50 floor.
- **Blue tint** (`#EFF6FF` / `blue-50`): Feature card icon backgrounds, active mobile nav items.
- **Blue icon** (`#2563EB` / `blue-600`): Icon color inside `blue-50` wrappers — all feature card icons use this. No per-card color variation.
- **Amber tint** (`#FFFBEB` / `amber-50`): Disclaimer section only.
- **Footer dark** (`#0F172A` / `slate-900`): Footer background — strong visual closure.

### Text (light surfaces)
- **Heading** (`#0F172A` / `slate-900`): All h1–h3, card titles, bold labels.
- **Secondary** (`#475569` / `slate-600`): Nav link default state, descriptions.
- **Muted** (`#64748B` / `slate-500`): Timestamps, captions, placeholders.
- **Subtle** (`#94A3B8` / `slate-400`): Fine print ("Research Dashboard" in nav).
- **On-blue** (`#FFFFFF`): Text on blue-700 surfaces.
- **On-hero-accent** (`rgba(255,255,255,0.8)` / `text-white/80`): The "เพื่อการศึกษา" accent line in the hero h1. **Never `text-blue-200`** — contrast ratio on blue-700 bg is too low.
- **On-hero-body** (`#DBEAFE` / `blue-100`): Hero subtitle and body copy on gradient.

### Text (dark footer)
- **Footer body** (`#94A3B8` / `slate-400`): Description and body text.
- **Footer links** (`slate-400` → `white` on hover): Navigation links.
- **Footer fine print** (`#475569` / `slate-600`): Copyright line.

### Semantic — Financial Data
- **Positive / gain** (`#16A34A` / `green-600`): Return % on light surfaces.
- **Positive on dark** (`#059669` / `emerald-600`): Return % in the hero preview card on dark bg.
- **Negative / loss** (`#DC2626` / `red-600`): Downward return percentages.
- **Amber accent** (`#D97706` / `amber-600`): Section labels for achievement/rank sections (rankings, trophy moments).
- **Warning** (`#F59E0B` / `amber-500`): AlertTriangle icon, disclaimer banners.

### Risk Level Scale
| Risk | Background | Text | Border |
|---|---|---|---|
| 1–2 | green-100 | green-800 | green-200 |
| 3 | lime-100 | lime-800 | lime-200 |
| 4 | yellow-100 | yellow-800 | yellow-200 |
| 5 | orange-100 | orange-800 | orange-200 |
| 6–7 | red-100 | red-800 | red-200 |
| 8 | red-200 | red-900 | red-300 |

### Rank Medal Colors (hero preview + rankings)
- Rank 1: `text-amber-500`
- Rank 2: `text-slate-400`
- Rank 3: `text-orange-400`
- Rank 4+: `text-white/40` on dark, `text-slate-400` on light

## Typography

### Font Stack
```
font-family: 'Noto Sans Thai', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif
```

### Scale

| Use | Size | Weight | Letter Spacing | Color |
|---|---|---|---|---|
| Hero h1 | 30–48px responsive | 700 | `tracking-tight` | white |
| Section h2 | 24px | 700 | `tracking-tight` | slate-900 |
| CTA band h2 | 24–30px | 700 | `tracking-tight` | white |
| Card h3 / label | 16px | 600 | default | slate-900 |
| Section label uppercase | 14px | 600 | `tracking-wide` | blue-700 or amber-600 |
| Body default | 16px | 400 | default | slate-700–800 |
| Body sm | 14px | 400 | default | slate-500 |
| Caption | 12px | 400–600 | default | slate-400–500 |
| Footer section heading | 12px | 600 | `tracking-widest` | slate-400 uppercase |
| Return percentage | 14px | 700 | default | green-600 / red-600 (light), emerald-400 (dark) |
| Fund code badge | 12px | 700 | default | blue-700 on blue-50 bg |

### Principles
- **`tracking-tight` on all headings.** Required at h1 (48px) and h2 (24px). Omitting it makes bold Thai text look cramped.
- **No serif anywhere.** Single-family system throughout.
- **Uppercase section labels always use `tracking-wide`.** The pattern `text-sm font-semibold text-[color] uppercase tracking-wide` opens every major section.
- **`tabular-nums` on all financial figures.**

## Layout

### Spacing
- **Section vertical padding:** `py-10` (40px) data-dense; `py-12` to `py-14` marketing sections.
- **Card padding:** `p-5` compact; `p-6` content cards.
- **Grid gaps:** `gap-4` data grids; `gap-6` feature card grids.
- **Max content width:** `max-w-7xl` for hero and data sections; `max-w-4xl` for CTA/disclaimer.

### Grid
- **Hero:** `grid cols-1 lg:cols-2 gap-10 lg:gap-16` — left: copy + search; right: preview card (hidden on mobile)
- **Feature cards:** 1-up mobile → 2-up sm → 4-up lg
- **Risk cards:** 1-up mobile → 2-up sm → 4-up lg
- **Footer:** 1-up mobile → 4-col md (2 brand + 2 link columns)

### Section Rhythm
Every page follows this surface sequence (never two consecutive identical surfaces):
```
1. Hero               — blue-700→blue-900 gradient, white text
2. Data section       — bg-white, border-slate-200
3. Soft section       — bg-slate-50, border-slate-200
4. White section      — bg-white, border-slate-200 (feature cards)
5. Soft section       — bg-slate-50, border-slate-200 (risk education)
6. CTA band           — bg-blue-700, white text
7. Disclaimer banner  — bg-amber-50, border-amber-200
8. Footer             — bg-slate-900 (dark close)
```

## Components

### Logo (ChartMark)
Custom SVG — three ascending filled bars with `rx="1.5"` at positions `(1,12)`, `(7.75,7)`, `(14.5,2)` within a 20×20 viewbox. Heights 7, 12, 17px respectively.
- On light surfaces (navbar): `text-blue-700`
- On dark surfaces (footer): `text-blue-400`
- Never substitute a generic Lucide icon.

### Top Navigation
- Height: `h-16`, sticky, `bg-white/95 backdrop-blur`
- Bottom border: `border-b border-slate-200`
- Logo: ChartMark + "กองทุนไทย" (bold, blue-700) + "Research Dashboard" (slate-400, hidden mobile)
- Nav links: `text-sm font-medium text-slate-600`, active `text-blue-700`
- Mobile active: `bg-blue-50 text-blue-700`
- Dropdown: `bg-white shadow-lg rounded-xl border-slate-200`

### Buttons

| Variant | Bg | Text | Border | Hover |
|---|---|---|---|---|
| `default` | blue-700 | white | — | blue-800 |
| `outline` | white | slate-900 | slate-200 | bg-slate-50 |
| `secondary` | slate-100 | slate-900 | — | slate-200 |
| `ghost` | transparent | slate-700 | — | bg-slate-100 |
| `link` | transparent | blue-700 | — | underline |
| CTA-on-blue | white | blue-700 | — | bg-blue-50 |

CTA-on-blue is **not** a Button component variant — render as a plain `<Link>` with `className="inline-flex items-center gap-2 bg-white text-blue-700 font-semibold px-8 py-3.5 rounded-lg hover:bg-blue-50 transition-colors text-base"`.

### Hero Band
- `max-w-7xl` container with 2-column grid at lg breakpoint
- Left column: timestamp pill, h1 with `tracking-tight`, subtitle (fund count bolded white), FundSearch, quick-filter pills
- Right column (`hidden lg:block`): live preview card (`rounded-2xl bg-white/10 backdrop-blur-sm border-white/20`)
- Preview card rows: `rounded-xl bg-white/5 hover:bg-white/10` with rank medal color, fund abbr name, AMC, `text-emerald-400` return %

### Feature Cards
- Icon wrapper: **always** `inline-flex rounded-lg p-2.5 bg-blue-50 text-blue-600` — no per-card color variation
- Card: `rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-blue-200`
- Title hover: `group-hover:text-blue-700`

### Section Label Pattern
Every major section opens with:
```tsx
<div className="flex items-center gap-2 mb-1">
  <Icon className="h-5 w-5 [blue-700 or amber-500]" />
  <span className="text-sm font-semibold [blue-700 or amber-600] uppercase tracking-wide">
    [label]
  </span>
</div>
<h2 className="text-2xl font-bold text-slate-900 tracking-tight">[heading]</h2>
```
- Rankings / trophy sections → `amber-500` icon, `amber-600` text
- Informational sections → `blue-700` icon, `blue-700` text

### CTA Band
- `bg-blue-700`, `max-w-4xl` centered, `py-14`
- h2: `text-2xl sm:text-3xl font-bold tracking-tight`
- Button: inline `bg-white text-blue-700 font-semibold px-8 py-3.5 rounded-lg` (not Button component)

### Disclaimer Banner
- Standalone `<section>` between the CTA band and footer
- `bg-amber-50 border-t border-amber-200`
- `text-sm text-amber-800`, `max-w-4xl` centered
- **Never** place inside the footer

### Footer
- `bg-slate-900 py-12`
- Brand: ChartMark (blue-400) + white bold wordmark + slate-400 body copy
- Disclaimer: `text-xs text-slate-500` inline (no amber box)
- Link headings: `text-xs font-semibold text-slate-400 uppercase tracking-widest`
- Links: `text-sm text-slate-400 hover:text-white`
- Divider: `border-t border-slate-800`
- Copyright: `text-xs text-slate-600`

## Financial Data Patterns

### Return Percentages
- Positive on light: `text-emerald-600 font-semibold tabular-nums` + TrendingUp icon
- Positive on dark (hero): `text-emerald-400 font-bold tabular-nums`
- Negative: `text-red-600 font-semibold tabular-nums` + TrendingDown icon
- Format: always explicit sign (`+12.34%`)

### Risk Badges
`rounded-full border px-2 py-0.5 text-xs font-medium` with level-specific color. Numeric level bold + label text.

### Fund Code Badges
`text-xs font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5`

## Do's and Don'ts

### Do
- Use the `ChartMark` SVG as the brand logo. It is a custom asset, not a Lucide icon.
- Add `tracking-tight` to every h1 and h2. Non-negotiable.
- Use `slate-50` as the page floor, `white` for cards. Never reverse.
- Use `blue-700` for every interactive element — one brand color consistently.
- Use `blue-50` + `blue-600` for ALL feature card icon wrappers — same color for every card.
- Use `amber-500/600` only for trophy / achievement / rank section labels.
- Use `bg-slate-900` for the footer — it closes every page with visual weight.
- Place the disclaimer in its own amber-50 section above the footer, not inside the footer.
- Use the inline CTA button (`bg-white text-blue-700`) on blue surfaces — not `<Button variant="outline">`.
- Use `text-white/80` for the hero h1 accent span. Never `text-blue-200`.
- Show real live data in the hero (top-3 preview). Prove product value above the fold.
- Color-code rank 1/2/3 with amber/slate/orange — not generic numbers.

### Don't
- Don't use TrendingUp or any generic Lucide icon as the brand logo.
- Don't omit `tracking-tight` on h1/h2 — bold Thai at 48px without it looks cramped.
- Don't use different icon colors across the 4 feature cards.
- Don't put the disclaimer box inside the footer — it belongs in its own section.
- Don't use `<Button variant="outline">` for the CTA-band button — override conflicts make it look wrong.
- Don't use a white footer — it merges with the page. Footer is always `slate-900`.
- Don't repeat consecutive identical surfaces (no two white sections or two slate-50 sections in a row).
- Don't use blue for risk level badges — risk has its own green→red scale.
- Don't use `shadow-lg` on cards — `shadow-sm` rest, `shadow-md` hover only.

## Responsive Behavior

| Breakpoint | Key changes |
|---|---|
| Mobile `<768px` | Hamburger nav; hero is single-column (preview card hidden); h1 scales to text-3xl; feature grids 1-up |
| Tablet `768–1024px` | Nav stays horizontal; hero still single-column (preview card hidden below lg); feature grids 2-up |
| Desktop `≥1024px` | Full nav with dropdown; hero 2-column with preview card; feature grids 4-up |

### Touch targets
- All buttons minimum `h-8` (32px) — most `h-9`+.
- Card links: entire card tappable.
- Mobile nav items: `px-3 py-2` (~40px effective height).

## Known Patterns

### Section sequence
```
hero (blue gradient, 2-col at lg)
  ↓ bg-white — rankings + data
  ↓ bg-slate-50 — personalized CTA
  ↓ bg-white — feature cards (4-up, unified blue icons)
  ↓ bg-slate-50 — risk education (color-coded cards)
  ↓ bg-blue-700 — CTA band (inline white button)
  ↓ bg-amber-50 — disclaimer (standalone section)
  ↓ bg-slate-900 — footer (dark close)
```

### Loading skeletons
`bg-slate-200 animate-pulse rounded` — inside the same card surface as the content it replaces.

### Empty states
`text-slate-400 text-sm` centered with optional icon, inside the current surface.
