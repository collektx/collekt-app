---
name: liquid-glass-design-guard
description: >-
  Enforces Collekt's signature liquid-glass aesthetic, velvet matte obsidian dark theme,
  mobile-first responsive standards, and prevents glare or specular reflection regressions.
---

# Liquid-Glass Design System & Theme Guard

Use this skill to inspect CSS and HTML changes to ensure visual consistency, accessibility, and zero-glare dark mode aesthetics across mobile and desktop.

## Core Design Tokens & Rules

1. **Velvet Matte Obsidian Dark Theme**:
   - Canvas background: `#071311` (deep obsidian emerald).
   - Card surfaces: `#0c1d1a` or `rgba(12, 28, 25, 0.90)`.
   - Border lines: `rgba(255, 255, 255, 0.07)`.
   - **No Specular Bevel Glare**: Never use white `inset` shadows with opacity above `0.10` in dark mode. Harsh `inset 0 1.5px ... rgba(255,255,255,0.95)` is strictly prohibited.
   - Hide artificial glare elements (`.lens-specular-crescent`, `.lens-caustic-ring`) in dark mode.

2. **Mobile Hamburger Menu Protection**:
   - The topbar mobile navigation toggle `#sidebarToggle` must always retain `sidebar-toggle-btn` class.
   - Never assign `.theme-btn` to `#sidebarToggle`.
   - Ensure the icon contains exactly 3 SVG `<line>` elements with visible stroke (`#0D9488` in light, `#2DD4BF` in dark mode).

3. **Responsive Breakpoints**:
   - Mobile: `<= 900px` (sidebar collapses into drawer, bottom floating dock or mobile topbar active).
   - Desktop: `> 900px` (sidebar permanently visible on left, topbar hamburger hidden).

## UI Quality Audit Checklist

- [ ] No high-contrast white reflection bands across dark cards.
- [ ] Text contrast meets WCAG AA standards (minimum 4.5:1 for body copy).
- [ ] Modals and sheets use `backdrop-filter: blur(20px)` with subtle border outlines.
- [ ] Interactive touch targets on mobile are at least 44x44px.
