# SeeTest design direction

Source: proposed by the agent, reviewed and approved by the owner on 2026-10-29. Owner overrides are marked.

**Design Read:** a children's visual-attention exam, taken on phones, tablets and laptops in a classroom, in a calm paper-worksheet style.
Dial: ENERGY 2 / RHYTHM 1 / MOTION 1. RHYTHM 1 is deliberate: every exam screen does one task.

## Personality
Warm, encouraging classroom worksheet, not a tech product. One focal point per screen: the picture or drawing.

## Colour (2 core + 1 accent)
- Paper `#FBF8F1` (dark theme: `#1B1A17`), ink dark blue-grey (dark theme: warm off-white).
- One accent, orange `#C2410C` (dark theme lighter). Used only on the main button and the current question.
- Red is for errors only.

## Surfaces
Flat and paper-like, 2px ink-tinted outlines. No glass, blur, glow, gradients or all-pill shapes.
Radius: cards 16px, buttons and inputs 12px, question-number bubbles circular (they are numbers).
The main button has a solid pressable bottom edge that sinks when pressed: the only shadow, because it marks "press me".

## Type
Nunito (rounded, easy for children to read), bundled with the site (`public/fonts/`), system font as fallback. Body about 20px.
Targets at least 56px high.

## Voice
Short, warm, plain. "Take your time." "You finished." No buzzwords.

## Motion
Press and hover feedback, plus a short pop when a tap lands on a picture. No looping or floating animation. Respects reduced motion.

## Owner override (R-04 / antislop-ui "Emoji as Decoration")
The owner chose to keep a few emoji. Limit: one emoji per screen heading (bucket, wrench, cycle on questions; waving hand on welcome;
party popper on finish). None in buttons or lists, none animated.

## Themes
Light by default; dark follows the device setting. Both must pass contrast and be checked in the browser.
