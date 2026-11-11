# Small Town Systems: design system ("Building blocks", A v3)

The site is built around the logo cube. One cube is one page, so the price list is drawn in cubes. Everything else stays quiet: one typeface, one action color, concrete-grey pages, white cards. The tokens below live as CSS variables in `public/css/site.css`; pages use the names, never raw values.

The direction comes from the concept Eli picked (A, Building blocks). No outside reference sites were compared; the UXKIN library was not connected.

## Color

| Token | Value | Role |
| --- | --- | --- |
| `--page` | `#EEF1F1` | Page background (concrete) |
| `--paper` | `#FFFFFF` | Cards, the form |
| `--ink` | `#1E2327` | Text, dark buttons |
| `--muted` | `#535D66` | Secondary text. 5.9:1 on page, 6.7:1 on white |
| `--line` | `#D3D9DB` | Decorative borders and rules only |
| `--control` | `#848E95` | Borders of inputs and checkboxes. 3.3:1 on white |
| `--teal` | `#0B5C67` | Cube top. Primary buttons and links (7.7:1 white on teal) |
| `--teal-dark` | `#08454D` | Hover, the monthly price figure |
| `--tint` | `#E1EDEE` | Monthly price box, selected chip, focus halo |
| `--steel` | `#3A3F44` | Cube left face. The dark Office systems card |
| `--steel-2` | `#5B6268` | Cube right face |
| `--on-dark` | `#E8ECEE` | Text on `--steel` |
| `--accent-on-dark` | `#8CCBD3` | Markers on `--steel` |
| `--draft` | `#B26A00` | Dotted underline on draft prices and lists, nothing else |
| `--error` | `#A12C1F` | Form errors |

The cube's faces are always `#0B5C67`, `#3A3F44` and `#5B6268`, and its letters always white. No gradients, no dark mode.

## Typography

One family: **Sora**, self-hosted as one variable file (`public/fonts/sora-latin-v17.woff2`, weights 300 to 700, SIL Open Font License in `public/fonts/OFL.txt`). It is preloaded and set to `font-display: optional`, with fallback faces sized to Sora's width and line metrics (Arial or Liberation Sans, and Roboto on Android). Sora shows whenever it arrives in time for the first paint, and the font can never cause a layout shift.

| Use | Size | Weight | Line height | Tracking |
| --- | --- | --- | --- | --- |
| Home headline (h1) | 27 to 56px, sized to its column so its three set lines never rewrap | 700 | 1.06 | -0.035em |
| Page title (h1) | 42 to 88px | 700 | 0.95 | -0.05em |
| Section title (h2) | 30 to 48px | 700 | 1.05 | -0.035em |
| Card title (h3) | 20px, 24 to 30px in service cards | 600 to 700 | 1.25 | -0.015em |
| Big price | 34 to 42px | 700 | 1.05 | -0.045em |
| Lead | 19 to 24px | 300 | 1.42 | 0 |
| Body | 17px | 400 | 1.6 | 0 |
| Small and labels | 13 to 15px | 400 to 600 | 1.5 | 0 |

Sentence case everywhere. No all-caps labels and no eyebrow text above headings. Text lines stay under about 75 characters. In Sora a CSS `ch` is wider than an average letter, so caps are set around 48 to 56ch.

## Spacing and shape

- Spacing steps of 4 and 8: 8, 12, 16, 24, 32, 48. Sections are separated by `--section` (64 to 120px).
- Content width `--wrap` 1160px, with side space `--side-space` of 16 to 40px.
- Radius: `--r-lg` 28px (cards), `--r-md` 18px (inner boxes, small cards), `--r-sm` 12px (inputs), and 999px for pills and buttons.
- Shadows: only on the phone frame. Cubes get a soft cast shadow and a thin model base instead.

## Components

- **Header**: cube and name on the left, Websites and Prices, and a teal "Get a price" button. On phones the two links drop to a second row. Office systems is linked from the footer only.
- **Buttons**: primary (teal), light (white, on dark or teal bands), and a text link (`.link-more`, underlined, 44px tall). Every "Get a price" is teal or, on a teal band, white.
- **Home hero**: a three-line headline ("Websites built for / your business. / Kept running for you."), one muted line on who it is for, the starting price in bold, "Get a price". Beside it, the signature picture: a small website and its phone version as an isometric model built from the logo cube. True isometric on the logo's own grid, cubes in the logo's three face colors with light edges (like the price models), the real logo cube as the site's logo, and a stepped pyramid of cubes as its picture (the phone shows the same pyramid, smaller). The page reads in the direction of the T on the logo's top. One inline SVG; its space is reserved with an aspect ratio, so it never shifts the layout.
- **Bands, for rhythm**: the page alternates grey (`--page`), a full-width dark band (`--ink`) for the Keim proof, a full-width white band (`--paper`) for prices, a small rounded `--steel` band for office systems, and a full-width teal band to close inner pages. The Keim devices overlap from the dark band into the next one.
- **Lists, not boxes**: "what you get" and "what we set up" are ruled lists (2px ink rule above each item). Fine print (monthly list, terms) is the same.
- **Price card**: a cube model (one cube per page) on a model base, the plan name, "Up to N pages", then "To build, paid once" (white box, big figure) and "Then every month" (tinted box, smaller teal figure). Custom shows a dashed cube.
- **How it works**: three numbered teal stops on one line (a vertical line on phones). No cards.
- **Get a price form**: two steps. Checkbox chips (square marks) for needs, radio chips (round marks) for plan and best way to reach. Without JavaScript both steps show as one form.
- **Device frames**: a browser frame (grey bar, three dots) and a phone frame (dark bezel). Used for the real Keim screenshots and the office-system examples.
- **Footer**: cube and name, one line about the business, links including Office systems.

## Motion

- Once on load: the hero picture builds itself (about 2.5 seconds). The page settles, each piece drops in and settles with one small spring, cubes bottom layer first, the phone last. Nothing loops.
- On a computer, pointing at the hero picture lifts its pieces a few pixels, the cubes in a short ripple.
- Once on view: the price cubes stack up, bottom row first; the Keim devices slide in.
- On scroll: the hero picture's layers drift apart a little (the phone most).
- Now and then: the header cube hops (never spins).
- Reduced motion: nothing moves; everything is shown in its final place. If the motion script fails to load, the page shows everything after 3 seconds.

## Imagery

- The cube (exact geometry from `public/img/sts-cube.svg`) and cube models drawn from it. No icon set and no illustrations.
- Real screenshots of the Keim site, on a computer and a phone. No stock photos.
- The office-system phones are drawn in HTML and labelled "Example".
