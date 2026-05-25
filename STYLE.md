# LUXOR Project Style Guide

This document outlines the visual identity, styling specifications, and animation patterns for the **LUXOR Tactical Operations Dashboard**.

## 1. Core Aesthetic
The project utilizes a **Cyberpunk / Tactical Terminal** aesthetic. It is designed to feel like a high-tech military or "netrunner" interface, characterized by dark backgrounds, neon accents, CRT-style scanlines, and digital glitch effects.

## 2. Color Palette

### Base Colors
| Name | Hex Code | Usage |
| :--- | :--- | :--- |
| **Gold** | `#b8a800` | Primary accents, brand logos, active states |
| **Gold Dim** | `#6b6200` | Subtle accents, secondary text |
| **Gold Glow** | `#e8d400` | Bright highlights, pulsed effects |
| **Purple** | `#7a059e` | Borders, primary highlights |
| **Purple Bright** | `#a020c8` | High-visibility highlights, sub-headers |
| **Purple Dim** | `#3d0050` | Low-contrast borders, dark accents |
| **Cyan** | `#00e5c8` | Status OK, active signals, scanbeams |
| **Danger** | `#c0392b` | Errors, hostile entities, critical alerts |
| **Warn** | `#d4890a` | Cautions, mid-tier alerts |

### Backgrounds
| Name | Hex Code | Usage |
| :--- | :--- | :--- |
| **BG Deep** | `#0a0c12` | Global background |
| **BG Panel** | `#141824` | Main sidebar, headers |
| **BG Card** | `#1a1f2e` | UI components, cards, modules |
| **Border** | `#2a2f45` | Standard dividers and component borders |

### Typography Colors
| Name | Hex Code | Usage |
| :--- | :--- | :--- |
| **Text** | `#d4d0b0` | Main body text |
| **Text Dim** | `#6b6860` | Secondary/Meta information |

---

## 3. Typography

- **Headers & Logos**: `Orbitron` (900/700/400)
- **Main UI & Body**: `Rajdhani` (400/600/700)
- **Data & Mono**: `Share Tech Mono`, `CyberFont` (Custom Dystopian Font), `Consolas`
- **Fallbacks**: `sans-serif`, `monospace`

---

## 4. Visual Effects & Overlays

### CRT Effects
- **Scanlines**: A global `body::before` overlay using a repeating linear gradient creates fine horizontal lines across the viewport.
- **Scanbeam**: A moving horizontal gradient (`scanline` animation) travels down the screen every 8 seconds to simulate a screen refresh.

### Animations
- **Glitch**: `glitchSlide` uses `clip-path` and `translateX` to create sharp, digital distortion on logos.
- **Pulse**: `pulseGold` and `sp-lock-pulse` apply oscillating `text-shadow` or `box-shadow` to create a glowing effect.
- **Flicker**: A subtle opacity animation used during boot sequences to simulate an unstable power supply or older hardware.
- **Tab In**: Components enter the view with a slight `translateY(20px)` and a `fadeIn`.
- **Border Spin**: The navbar top border features a 3-color gradient that "spins" using `background-position`.

---

## 5. UI Components

### Navigation (Sidebar)
- **Width**: `200px` (standard desktop).
- **Mobile**: Collapses into a hamburger menu; slides in from the left when active.
- **Style**: Dark panel with a persistent animated top border and 2px solid border on active links.

### Cards & Modules
- **Design**: `BG Card` background, `1px solid var(--border)`.
- **Hover**: Cards lift slightly (`-2px`), border changes to `var(--purple)`, and a sliding gradient underline expands from the left.

### Form Elements
- **Inputs**: Transparent background, `var(--gold)` text, mono font.
- **Buttons**: Square/slightly rounded corners, hover transitions involving background opacity shifts and border color changes.

### Map Elements (AssetMap)
- **Markers**:
    - **HQ**: Diamond shape (`rotate(45deg)`).
    - **Outpost**: Triangle shape (`clip-path`).
    - **Naval**: Circle with an inner ring.
- **Mission Pulse**: Active mission markers pulse with a heavy purple glow.
- **Routes**: Dashed paths that animate using `stroke-dashoffset`.

---

## 6. Layout Specifications

- **Main Content**: Offset by `--navbar-w` (200px) on desktop.
- **Responsive Breakpoints**:
    - **900px**: Grid adjustment for tool cards.
    - **768px**: Mobile shift. Navbar becomes hidden/collapsible. Main padding increases.
    - **400px**: Small phone optimizations.

---

## 7. Global Reset & Defaults
- **Box Sizing**: `border-box` for all elements.
- **Scrollbars**: Thin (`5px`), dark grey/purple-dim theme.
- **Selection**: High-contrast highlight (Cyan or Gold depending on context).
