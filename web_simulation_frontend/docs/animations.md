# Animation Implementation

## Libraries
- GSAP `^3.12.5` for high-performance timeline and entrance animations.
- CSS transitions for micro-interactions (hover/press) to limit JS workload.

## Animated Elements
- App header: fade and slide-in via GSAP timeline on initial load.
- Controls panel: GSAP slide-in after header for perceptible hierarchy.
- Canvas container: GSAP fade/slide-in to communicate readiness.
- Tooltip: CSS transition for opacity; position updated via mouse events.
- Buttons: CSS hover transitions for transform and shadow; press state uses transform only.
- Arrows: vector-based canvas arrows animated via requestAnimationFrame using cubic-bezier(0.4, 0, 0.2, 1) easing for smooth motion. Head draws in last 15% of travel for clarity.

## GSAP Details
- Timeline defaults: ease `power2.out`, duration `0.6`.
- Entrance order: app opacity → header → controls → canvas container.
- 60fps: animates `opacity` and `transform` only; avoids layout-affecting properties.

## Arrow Animation
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` implemented in JS for progress over time.
- Vector rendering: canvas line stroke thickness scales with cell size; shadows add subtle glow.
- Interaction feedback: highlight pulse on arrow arrival with brief fade-out using same easing.
- Performance: single-pass redraw per frame; avoids heavy paints on the main thread.

## Accessibility
- Respects `prefers-reduced-motion` (CSS transitions are subtle, no looping JS animations).
- Spinner has `role=alert` and `aria-live="polite"` with textual label for AT.

## Performance Notes
- Avoids animating canvas draw operations; canvas drawing remains synchronous.
- Uses `will-change: transform` on frequently hovered elements.
- Keeps animation payload minimal and one-off on load.
