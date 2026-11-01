# Small Town Systems: design system ("Building blocks", A v2)

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

One family: **Sora**, self-hosted as one variable file (`public/fonts/sora-latin-v17.woff2`, weights 300 to 700, SIL Open Font License in `public/fonts/OFL.txt`).

| Use | Size | Weight | Line height | Tracking |
| --- | --- | --- | --- | --- |
| Hero name (lockup) | 44 to 128px (`10.4vw`) | 700 | 0.9 | -0.05em |
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

- **Header**: cube and name on the left, three links, and a teal "Get a price" button. On phones the links drop to a second row; nothing is hidden behind a menu.
- **Buttons**: primary (teal), line (ink outline), and a text link (`.link-more`, underlined, 44px tall). One style per job: every "Get a price" is teal.
- **Hero lockup** (home only): the cube and "Small Town Systems" as one unit. The cube's top meets the cap height of the first line and its bottom sits on the baseline of the second. On load the cube settles into place once; after that it hops a little now and then. With reduced motion, nothing moves.
- **Price card**: a cube model (one cube per page) on a model base, the plan name, "Up to N pages", then two separate boxes: "To build, paid once" (outlined, big figure) and "Then every month" (tinted, smaller teal figure). Custom shows a dashed cube.
- **Service cards**: Websites on white and wider, Office systems on `--steel`. Three or four benefits each, with a link to the detail page.
- **Get a price form**: two steps. Step one has four chips; step two has the fields. Without JavaScript both steps show as one form.
- **Phone frame**: dark bezel and a soft shadow. Used for the real Keim screenshot and the office-system examples.
- **Footer**: cube and name, one line about the business, the same links as the header.

## Imagery

- The cube (exact geometry from `public/img/sts-cube.svg`) and cube models drawn from it. No icon set and no illustrations.
- Real photos only: Keim's building and a real screenshot of the Keim site. No stock photos.
- The office-system phones are drawn in HTML and labelled "Example".
