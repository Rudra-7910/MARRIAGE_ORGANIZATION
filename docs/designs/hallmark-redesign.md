# UI reference

Use [design.md](../../design.md) for design rules and `web/src/styles/tokens.css` for colors, spacing, typography and motion.

Manrope is the interface font. Newsreader is used for editorial headings; Noto Sans Devanagari supports Hindi. Forest is the primary action color, with ivory, white and sage surfaces and restrained clay accents.

## Page priorities

| Area | Show first |
| --- | --- |
| Homepage | What the product does, how to start, and clearly marked invitation examples. |
| Account pages | The form and useful help; guests are told to use their invitation link. |
| Setup | Family details, followed by the wedding date, ceremony time, venue and contact. |
| Organizer overview | Saved couple names, date, venue and IST countdown, followed by budget, department progress and invitations. |
| Planning | Function timings, work status, deadlines, last updates and attention requests. |
| Budget | Agreed costs, paid amounts, pending dues and payment history. |
| Guests | Family entries, invitation status and the individual email preview. |
| Photos | Pending review, approved/rejected photos and guest upload links. |
| Services | Real provider profiles, location filters, reviews and contact actions. |
| Guest website | Date, ceremony time, directions, countdown and family contact, followed by functions, updates and approved photos. |

## Copy and imagery

Use functional headings and specific instructions. Empty states should name what is missing and offer a relevant action. Keep Hindi blessings in wedding invitations. Mark homepage examples as samples and do not invent wedding records, ratings or statistics.

Existing local wedding photography is decorative. It must not appear to be a photo of the user’s couple or venue. The venue section shows the saved address and opens Google Maps for directions; it does not display an imitation map.

## Interaction

Keep visible focus states, labelled controls and 44px touch targets. Product-preview tabs support arrow-key navigation. Dialogs use native modal behavior. Closed mobile navigation is inert. Motion respects reduced-motion settings.

Private budget and guest data remain restricted by both API authorization and role-scoped rendering. Design changes must preserve session checks, CSRF, conflict handling, invitation retry rules and loading/error states.
