---
name: Kinetic Commerce
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#4c4732'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#7d775f'
  outline-variant: '#cec6aa'
  surface-tint: '#6c5e00'
  primary: '#6c5e00'
  on-primary: '#ffffff'
  primary-container: '#ffe100'
  on-primary-container: '#726300'
  inverse-primary: '#e1c700'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e2'
  on-secondary-container: '#646464'
  tertiary: '#00696c'
  on-tertiary: '#ffffff'
  tertiary-container: '#00f9fe'
  on-tertiary-container: '#006f71'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe330'
  primary-fixed-dim: '#e1c700'
  on-primary-fixed: '#211c00'
  on-primary-fixed-variant: '#514700'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#2efaff'
  tertiary-fixed-dim: '#00dce1'
  on-tertiary-fixed: '#002021'
  on-tertiary-fixed-variant: '#004f51'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '800'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.01em
  label-xs:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '700'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 16px
  gutter: 12px
  stack-sm: 4px
  stack-md: 8px
  stack-lg: 16px
  section-gap: 32px
---

## Brand & Style
The design system is engineered for the high-velocity world of quick commerce, where speed, reliability, and accessibility are paramount. The brand personality is energetic, dependable, and ultra-efficient, designed to evoke a "deliver-it-now" emotional response.

The design style is a hybrid of **Modern Corporate** and **High-Contrast Bold**. It utilizes heavy whitespace to manage information density, ensuring that product discovery and checkout flows feel frictionless. The aesthetic is "fast and casual," leaning on bright, high-signaling colors to guide the user through a rapid-fire shopping experience while maintaining a clean, systematic structure that minimizes cognitive load.

## Colors
The palette is built on high-contrast foundations to ensure maximum legibility in outdoor or high-glare environments.

- **Primary (Electric Yellow):** Used for primary actions, highlights, and brand reinforcement. It acts as the "go" signal for the user.
- **Secondary (Deep Black):** Provides the structural grounding. Used for primary text, iconography, and high-emphasis buttons.
- **Neutral:** A range of cool grays used for backgrounds and subtle borders to keep the UI clean and decluttered.
- **Semantic Green:** Specifically used for "delivery in minutes" indicators and success states to build trust.

## Typography
The system uses **Inter** for its exceptional legibility and systematic feel. 

- **Headlines:** Use heavy weights (700-800) with tight letter spacing to create a sense of urgency and importance.
- **Body:** Standard weights for descriptions, ensuring that price points and product titles are easily scannable.
- **Price Display:** Price points should always use a slightly heavier weight than the surrounding body text to ensure they are the primary focal point of product cards.

## Layout & Spacing
The layout follows a **fluid grid** model optimized for mobile-first commerce. 

- **Grid:** A 4-column grid for mobile and a 12-column grid for desktop.
- **Margins:** A consistent 16px lateral margin is maintained across all screens to prevent content from touching the edge.
- **Vertical Spacing:** Elements are stacked in multiples of 4px. Use 8px for related items and 16px for distinct components.
- **Safe Areas:** Adhere strictly to iOS status bar and home indicator regions to ensure a native, premium feel.

## Elevation & Depth
This design system prioritizes **flat, high-contrast surfaces** over complex shadows. 

- **Tonal Layers:** Backgrounds use a light neutral (#F3F4F6), while interactive cards use a pure white (#FFFFFF) to pop forward.
- **Outlines:** Use thin (1px), low-contrast borders (#E5E7EB) for secondary cards instead of shadows.
- **Elevated Actions:** Only the primary "Add to Cart" or "Checkout" floating bars use a soft, large-radius ambient shadow (0px 10px 30px rgba(0,0,0,0.08)) to indicate they sit above the content scroll.

## Shapes
The shape language is friendly and modern. 

- **Cards:** Product and category cards must use a minimum radius of 16px (`rounded-lg` or `rounded-xl` per the variable mapping) to maintain the "soft" approachable aesthetic.
- **Buttons:** Primary buttons use a slightly smaller radius (12px) to feel more precise, while search bars and certain tags use fully rounded pill shapes.

## Components

### Buttons & Navigation
- **Primary Button:** Solid Black background with White text or Primary Yellow with Black text. 16px rounded corners.
- **Bottom Navigation:** A fixed-position bar featuring 6 items. Icons are 24px line-art style with 1.5px stroke weight.
  - **Bistro Pill:** The "Bistro" item is treated as a high-contrast pill-shaped button within the bar (Primary Yellow background) to differentiate food delivery from standard commerce.
- **Status Bar:** Standard iOS-style typography and iconography for time, battery, and signal.

### Input Fields
- **Search Bar:** Large, pill-shaped (32px radius) with a subtle 1px border. Includes a leading "Search" icon and a trailing "Mic" icon.

### Cards
- **Product Card:** White background, 16px corner radius. Image occupies the top 60%, followed by Title, Weight/Size, and Price. 
- **The "Add" Button:** A prominent square or small pill button located at the bottom right of product cards, using a White background with a Green border/text to signify "Add".

### Specialized Elements
- **Ambulance/Emergency:** Use a specific red-tinted icon within the navigation to denote high-priority health services.
- **Chips:** Small, rounded-pill tags used for "Bestseller," "Organic," or "New" labels, using high-contrast fills.