# Design: Make My Marriage

## System

Modern-minimal wedding SaaS with a warm editorial guest experience. Preserve the forest identity and existing fonts. Organizer screens prioritize coordination; the public website prioritizes the date, ceremony time and directions.

## Source of truth

`web/src/styles/tokens.css` defines colors, fonts, spacing and motion. Consume tokens rather than literal colors or font declarations. Manrope is for controls, labels and data. Newsreader is for major editorial headings. Noto Sans Devanagari is the Hindi glyph fallback.

## Surfaces

Ivory page, white working surfaces, pale sage secondary regions, forest primary actions, restrained clay emphasis. Use red/yellow/green alongside explicit work status text. Cards have 16px corners; controls have 9px corners. Borders separate information; avoid gratuitous nested cards and shadows.

## Hierarchy

Sentence-case labels without tracking. No promotional eyebrow above each heading. Date and time must remain prominent on both the organizer overview and guest website. Keep the live IST countdown as days, hours, minutes and seconds; no analog clock.

## Copy

Use labels that name the work: department progress, pending dues, guest invitations. Empty states explain what is missing and how to add it. Avoid repeated slogans, generic promises and implementation details in user-facing forms. Keep Hindi blessings in invitations. Mark homepage examples as samples; never present decorative artwork as a real map, vendor or wedding record.

## Layout

Cap public containers at 1360px and retain a responsive organizer sidebar. Forms use clear grouped fields. Tables, function timelines and department lists carry the content; the interface does not invent user records, metrics, reviews or working future features.

## Controls

One forest primary button. White secondary buttons. Visible labels, inline feedback, keyboard focus, native form controls and dialog behavior. Minimum 44px touch targets for important actions.

## Motion

Short color/transform/opacity transitions on interaction, no decorative loops. Respect reduced-motion preferences. Data remains visible while fetching.

## Preserved behavior

Session authentication, CSRF, role-scoped navigation and APIs, invitation sending, conflict handling, function visibility, department assignments and all existing loading, empty and error states.

## Exports

`web/src/styles/tokens.css`, `web/src/styles/base.css` and page-specific stylesheets.
