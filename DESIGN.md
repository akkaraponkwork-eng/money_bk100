---
name: moneybk100
description: A streamlined dashboard to track, visualize, and export personnel payments.
colors:
  primary: "#1e40af"
  primary-hover: "#1e3a8a"
  primary-gradient: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)"
  success: "#059669"
  success-gradient: "linear-gradient(135deg, #059669 0%, #047857 100%)"
  danger: "#dc2626"
  danger-gradient: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)"
  warning: "#d97706"
  background: "#f8fafc"
  surface: "rgba(255, 255, 255, 0.85)"
  surface-hover: "rgba(255, 255, 255, 0.95)"
  text-primary: "#0f172a"
  text-secondary: "#64748b"
  text-muted: "#94a3b8"
  border: "rgba(0, 0, 0, 0.08)"
typography:
  body:
    fontFamily: "'Outfit', -apple-system, sans-serif"
rounded:
  default: "20px"
  pill: "99px"
spacing:
  sm: "8px"
  md: "10px"
  lg: "16px"
  xl: "24px"
components:
  btn-primary:
    backgroundColor: "{colors.primary-gradient}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  btn-ghost:
    backgroundColor: "rgba(255, 255, 255, 0.6)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
---

# Design System: moneybk100

## Overview

**Creative North Star: "The Glass Dashboard"**

Clean, breezy, and softly elevated. The interface relies heavily on layered and floating surfaces, utilizing glass-like blur effects (`backdrop-filter`) to create a sense of depth without harsh lines. The overall feel is soft, approachable, and tactile, leaning into large corner radii, pill-shaped buttons, and vivid gradient accents against a soft neutral background. 

**Key Characteristics:**
- Soft, glassmorphism-inspired surfaces
- Vivid gradient accents for primary actions and data states
- Heavily rounded (20px to 99px) form language
- Radial mesh-like background gradients

## Colors

Vivid Blue and Soft Neutral. The palette centers on a deep, confident blue accent against clean, off-white slate backgrounds.

### Primary
- **Vivid Blue Gradient** (`linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)`): Used for primary calls to action, active states, and dominant dashboard cards.
- **Deep Cobalt** (#1e40af): Solid fallback and text accent for primary interactions.

### Secondary
- **Success Green** (#059669): Used for positive indicators and paid statuses.
- **Danger Red** (#dc2626): Used for destructive actions and unpaid alerts.

### Neutral
- **Soft Slate Background** (#f8fafc): The foundation of the page, acting as the base for floating glass cards.
- **Translucent Surface** (`rgba(255, 255, 255, 0.85)`): The background color for all elevated cards.
- **Primary Text** (#0f172a): High-contrast dark navy/slate for readability.

### Named Rules
**The Glass Background Rule.** Solid white surfaces are forbidden. All elevated cards must use translucent whites (`rgba(255, 255, 255, 0.85)`) paired with `backdrop-filter: blur(12px)` to maintain the "Glass Dashboard" aesthetic.

## Typography

**Display/Body Font:** 'Outfit', -apple-system, sans-serif

**Character:** Friendly, geometric, and modern. Outfit provides a clean, easily legible aesthetic that pairs well with heavily rounded UI elements.

### Hierarchy
- **Header** (700, 1.6rem): Page titles and primary section headers.
- **Body** (400, 1rem, 1.6 line-height): Standard data and paragraph text.
- **Button/Tab** (600, 0.95rem): Interactive text; slightly bolder for confidence.
- **Badge** (700, 0.8rem, uppercase, 0.5px letter-spacing): Small semantic labels.

## Layout

The layout follows a centered column structure (`max-width: 680px`), ensuring high readability and a focused, mobile-friendly experience. Content is padded (20px) and spaced loosely, giving the floating cards room to breathe over the radial gradient background.

## Elevation & Depth

Layered and floating, using soft glass shadows and blur to separate content from the background. 

### Shadow Vocabulary
- **Ambient Glass Shadow** (`0 10px 40px -10px rgba(0, 0, 0, 0.05)`): Applied to all resting cards to lift them gently off the background.
- **Hover Lift** (`0 20px 40px -10px rgba(0, 0, 0, 0.08)`): Used when cards or primary buttons are hovered, accompanied by a slight upward translation (`translateY(-4px)`).

### Named Rules
**The Blur over Border Rule.** Depth is created by optical blur, not by thick borders. Card borders remain a subtle `rgba(0, 0, 0, 0.08)` to frame the blur effect, never as a structural element itself.

## Shapes

Soft, approachable, and tactile. The UI avoids sharp 90-degree corners entirely. Containers use a very generous `20px` radius, while interactive elements (buttons, tabs, badges) go all the way to a full pill shape (`99px`).

## Components

### Buttons
- **Shape:** Pill-shaped (99px)
- **Primary:** Vivid Blue Gradient (`btn-primary`), padded at `10px 20px`, accompanied by a soft drop shadow.
- **Hover / Focus:** Translates upward slightly (`translateY(-1px)`) with an intensified shadow.
- **Ghost:** Semi-transparent white (`rgba(255, 255, 255, 0.6)`) with a delicate white border, used for secondary actions.

### Cards / Containers
- **Corner Style:** Large (20px)
- **Background:** Translucent white (`rgba(255, 255, 255, 0.85)`) with a 12px blur.
- **Shadow Strategy:** Ambient Glass Shadow.
- **Border:** Subtle 8% opacity black.
- **Internal Padding:** Comfortable (24px).

### Tabs
- **Style:** Pill-shaped active state inside a pill-shaped translucent container. 
- **Active:** Solid white background with primary text color and a subtle shadow.

### Badges
- **Style:** Pill-shaped (14px padding horizontal), using 15% opacity backgrounds tinted to their semantic color (Success/Danger) with bold uppercase text.

## Do's and Don'ts

### Do:
- **Do** use `rgba()` for surface colors and combine them with `backdrop-filter: blur(12px)`.
- **Do** use a `20px` border-radius for structural cards and `99px` (pill) for interactive elements like buttons and tabs.
- **Do** use the `Outfit` font for all text to maintain the modern, approachable feel.

### Don't:
- **Don't** use solid, opaque backgrounds for cards or primary surfaces.
- **Don't** use sharp corners (`0px` or `4px` radii) on any UI elements.
- **Don't** use flat, singular colors for primary buttons—always use the established linear gradients.
