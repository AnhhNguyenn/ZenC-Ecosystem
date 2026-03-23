# Pragmatic SaaS Design System Guidelines

This UI framework enforces extreme discipline. The goal is to look like Stripe, Linear, or Vercel.

## 1. Spacing Discipline (The 8px Grid System)
Do NOT use random padding like `13px` or `19px`. Use the central SCSS tokens ONLY.
- `--spacing-xs: 8px;`
- `--spacing-sm: 12px;`
- `--spacing-md: 16px;` (Component internal padding)
- `--spacing-card-pad: 20px;` (Standard Card internal padding)
- `--spacing-lg: 24px;` (Card gap)
- `--spacing-xl: 32px;` (Section gap)
- `--spacing-2xl: 48px;` (Page boundary)

## 2. Loading Strategy: Skeletons, Not Spinners!
Spinners cause Layout Shifts (CLS) and make the app feel slow. 
Always use a Skeleton block that perfectly matches the final card dimensions to trick the brain into perceiving an instant loading state.

## 3. High-End CSS Architecture
- **Soft Shadows:** Do not use default black blur shadows. We use multi-layered soft `< 0.1` opacity shadows defined in `tokens/_shadows.scss`.
- **Glass Highlights:** Cards must use our `linear-gradient` trick to catch light on their top edge.
- **Micro-Interactions:** Elevate elements gracefully on hover (`translateY(-2px)`) with a snappy 0.15s ease.

## 4. 70/30 Layout Structure
The standard Dashboard/Metric container follows a focus pattern:
- 70% width for the main content block (e.g. Line Chart table).
- 30% width for secondary actions/panels.
- Max 4 Metric Cards per row!

No "God Pages": `page.tsx` must just assemble `<StatsSection />` and `<MainFeature />`—never more than 200 lines.
