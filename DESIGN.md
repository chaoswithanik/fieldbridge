---
name: FieldBridge
colors:
  surface: '#f4fbf6'
  surface-dim: '#d4dcd7'
  surface-bright: '#f4fbf6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef5f0'
  surface-container: '#e8f0ea'
  surface-container-high: '#e3eae5'
  surface-container-highest: '#dde4df'
  on-surface: '#161d1a'
  on-surface-variant: '#424843'
  inverse-surface: '#2b322f'
  inverse-on-surface: '#ebf2ed'
  outline: '#727973'
  outline-variant: '#c1c8c2'
  surface-tint: '#456553'
  primary: '#032517'
  on-primary: '#ffffff'
  primary-container: '#1b3b2b'
  on-primary-container: '#83a590'
  inverse-primary: '#abcfb8'
  secondary: '#825500'
  on-secondary: '#ffffff'
  secondary-container: '#ffc166'
  on-secondary-container: '#774e00'
  tertiary: '#410d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#651a01'
  on-tertiary-container: '#ec7f5c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c7ebd4'
  primary-fixed-dim: '#abcfb8'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#2d4d3c'
  secondary-fixed: '#ffddb2'
  secondary-fixed-dim: '#f9bb61'
  on-secondary-fixed: '#291800'
  on-secondary-fixed-variant: '#624000'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59e'
  on-tertiary-fixed: '#3a0b00'
  on-tertiary-fixed-variant: '#7e2c10'
  background: '#f4fbf6'
  on-background: '#161d1a'
  surface-variant: '#dde4df'
typography:
  display-lg:
    fontFamily: Atma
    fontSize: 48px
    fontWeight: '500'
    lineHeight: 64px
    letterSpacing: -0.01em

  display-lg-mobile:
    fontFamily: Atma
    fontSize: 36px
    fontWeight: '500'
    lineHeight: 48px
    letterSpacing: 0em

  headline-lg:
    fontFamily: Atma
    fontSize: 34px
    fontWeight: '500'
    lineHeight: 48px
    letterSpacing: 0em

  headline-lg-mobile:
    fontFamily: Atma
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 40px
    letterSpacing: 0em

  headline-md:
    fontFamily: Anek Bangla
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 36px

  headline-sm:
    fontFamily: Anek Bangla
    fontSize: 21px
    fontWeight: '600'
    lineHeight: 30px

  body-lg:
    fontFamily: Anek Bangla
    fontSize: 19px
    fontWeight: '400'
    lineHeight: 32px

  body-md:
    fontFamily: Anek Bangla
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px

  body-sm:
    fontFamily: Anek Bangla
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px

  label-lg:
    fontFamily: Anek Bangla
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px

  label-md:
    fontFamily: Anek Bangla
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px

  label-sm:
    fontFamily: Anek Bangla
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px

  data-mono:
    fontFamily: Anek Bangla
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 22px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2.5rem
  margin-mobile: 1rem
  margin-tablet: 1.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies an authentic, premium utilitarian aesthetic tailored for direct wholesale agricultural exchange. It balances the grounded, organic reality of regional farming with the precise, high-trust operational standards required by commercial food buyers, executive chefs, and wholesale co-ops. 

The visual style merges **warm editorial clarity** with **utilitarian data density**:
- **Tone:** Grounded, trustworthy, authoritative, transparent, and resilient.
- **Visual Direction:** A synthesis of tactile earthiness and institutional rigor. The UI avoids sterile corporate SaaS tropes and overly rustic, informal craft clichés. Instead, it presents agricultural trade as a high-value commodity market rooted in environmental stewardship.
- **Emotional Response:** Buyers feel absolute confidence in lot authenticity, harvest freshness, and settlement logistics; producers feel their craft and provenance are represented with dignity.

## Colors

The color palette reflects the physical elements of agricultural commerce: deep vegetative canopies, golden cereal grains, kiln-fired terracotta, and fertile loam.

- **Primary (`#1B3B2B`):** Forest canopy green. Used for authoritative structural elements, primary actions, navigation grounding, and high-level verification indicators.
- **Secondary (`#D49B44`):** Sun-ripened wheat/amber. Deployed for harvest timelines, status milestones, prime certifications, and secondary transactional triggers.
- **Tertiary (`#C25E3E`):** Terracotta rust. Reserved for urgent actions, critical lot availability, direct dispatch logistics alerts, and freight status markers.
- **Neutral (`#1A211E`):** Crisp slate-tinted charcoal. Provides optimal contrast across all textual hierarchies, numeric readouts, and line strokes.
- **Canvas & Surface System:** 
  - Base canvas: `#FBF9F5` (Linen).
  - Surface muted: `#F4F1EA` (Pale Sand) for alternating table rows and secondary card backings.
  - Surface elevated: `#FFFFFF` (Pure White) strictly for actionable cards and interactive modals.
  - Border baseline: `#E2DDD3` (Warm Oat) for subtle, non-distracting containment lines.

## Typography

The typographic hierarchy combines the expressive, culturally distinctive character of Atma with the structured legibility and functional precision of Anek Bangla.

- Editorial Headings (Atma): Used for marketplace categories, producer stories, lot titles, and primary panel headings. Its expressive Bengali letterforms introduce a distinctive editorial personality, creating a sense of cultural authenticity, heritage, and craftsmanship while establishing a strong visual identity.

- Interface & Operational Data (Anek Bangla): Selected for its clean, contemporary letterforms and excellent readability across dense interface layouts. It powers navigation, product descriptions, transactional grids, labels, and operational information. Critical agricultural attributes—such as Minimum Order Quantities (MOQs), metric tonnage, price per hundredweight (cwt), moisture content percentages, and logistics timelines—must always activate tabular figures (`font-variant-numeric: tabular-nums`) to maintain consistent numerical alignment across high-density transactional displays.

## Layout & Spacing

The layout is built upon an 8-point baseline grid governed by structured container widths designed to manage heavy marketplace inventory.

- **Grid Structure:** 
  - **Desktop (≥ 1280px):** 12-column fluid grid, max container width 1440px, `margin` of `2.5rem`, `gutter` of `1.5rem`.
  - **Tablet (768px - 1279px):** 8-column fluid grid, `margin` of `1.75rem`, `gutter` of `1.25rem`.
  - **Mobile (< 768px):** 4-column fluid grid, `margin` of `1rem`, `gutter` of `1rem`.

- **Density Rules:** Data-dense surfaces (such as wholesale manifest tables, contract terms, and freight breakdown panels) drop their vertical padding to `space-sm` while maintaining horizontal padding at `space-md`. Promotional showcase lots and farm narrative blocks expand their spacing to `space-xl` to let provenance imagery breathe.

## Elevation & Depth

Visual hierarchy uses a disciplined **warm tonal layering** model rather than deep artificial drop shadows, reinforcing tactile, real-world utility.

- **Surface Tiers:**
  - **Tier 0 (App Canvas):** `#FBF9F5` (Warm linen base).
  - **Tier 1 (Surface Standard):** `#FFFFFF` bordered with a 1px solid line (`#E2DDD3`).
  - **Tier 2 (Interactive Floating / Hover):** `#FFFFFF` paired with an organic, sun-diffused ambient shadow: `box-shadow: 0 4px 16px -2px rgba(27, 59, 43, 0.06), 0 2px 6px -1px rgba(27, 59, 43, 0.04)`.
  - **Tier 3 (Modals / Escrow Overlays):** `#FFFFFF` paired with an authoritative, deep grounding elevation: `box-shadow: 0 12px 32px -4px rgba(26, 33, 30, 0.12), 0 4px 12px -2px rgba(26, 33, 30, 0.06)`.

- **Dividers & Outlines:** Outlines are quiet and textural. Instead of high-contrast stark borders, dividers use `#E2DDD3` to echo natural deckle edges and structured invoices.

## Shapes

The shape system utilizes soft, structured corners that bridge modern industrial trade software with approachable pastoral warmth.

- **Baseline Geometry:** Structural components, commodity cards, filter sheets, and input fields use an 8px radius (`0.5rem`).
- **Containers & Modules:** Wholesale lot cards, freight tracker containers, and verified producer badges utilize `rounded-lg` (16px / `1rem`) and `rounded-xl` (24px / `1.5rem`).
- **Pill Exception:** Pure pill radii (`9999px`) are strictly reserved for operational status tokens, certification stamps (e.g., ROC, Organic), and quantitative distance badges to make them instantly recognizable against square modular layouts.

## Components

### Buttons & Interactive Controls
- **Primary Action (Direct Escrow / Order Placement):** Deep Forest Green (`#1B3B2B`) background with crisp `#FFFFFF` text. Subtle hover shift to `#244D38`. Padding: `0.75rem 1.5rem`, typography: `label-lg`.
- **Secondary Action (Sample Request / Message Grower):** Transparent fill with a 1.5px border of `#1B3B2B`, text in `#1B3B2B`. Hover state applies a 5% tint of linen overlay.
- **Tertiary Action (Logistics Details / Spec Sheets):** Bare text in `#1B3B2B` with an animated 1px underline in `#D49B44`.

### Verification Badges & Quality Indicators
- **Certification Badges (USDA Organic, Regenerative, Non-GMO):** Pill containers (`rounded-full`) with a muted neutral background (`#F4F1EA`), a subtle border (`#E2DDD3`), and dark slate text (`#1A211E`). An inline 8px dot indicator uses `#1B3B2B` to signal verified blockchain/escrow provenance.
- **Quality Grade Indicators:** Compact pill with a warm amber tint (`background: #FEF7EC; color: #9A6615; border: 1px solid #F3DEB2`). Typographic scale: `label-sm`, set in uppercase with tracked spacing.
- **Distance & Dispatch Badges:** Left-anchored pill utilizing terracotta accents (`background: #FAF0EC; color: #9E3F23; border: 1px solid #ECC6B8`) detailing radius (e.g., `"42 miles away • Direct Dispatch"`).

### Commodity & Lot Cards
- **Construction:** Elevated white container (`#FFFFFF`), `rounded-xl`, encased by a 1px border (`#E2DDD3`).
- **Internal Structure:** Two-part architecture:
  1. *Visual Header:* Provenance photography (field, lot, harvest box) paired with floating certification pills at the top corner.
  2. *Data Grid:* 2-column tabular readout using `Anek Bangla` with `tabular-nums` for Minimum Order Quantity (MOQ), current remaining volume (MT / lbs), harvest date, and tiered unit pricing.

### Inputs, Toggles & Filter Selectors
- **Input Fields:** Crisp `#FFFFFF` surface with a 1px solid `#E2DDD3` border, shifting to `#1B3B2B` (2px focus ring) on interaction. Labels sit above inputs in `label-md` using `#1A211E`.
- **Freight & Escrow Toggles:** Segmented tactile pill controls with an active white thumb against a `#EBE6DC` track, utilizing smooth cubic-bezier transitions to ensure clear transactional intent.