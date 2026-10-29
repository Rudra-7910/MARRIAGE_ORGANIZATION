# Stitch reference

Project: [Make My Marriage](https://stitch.withgoogle.com/projects/880870202033707852).

Email invitation references (29 October 2026):

- Send Email Invitations: `3b957e21e44949d69351496d3002cf94`.
- Email Wedding Invitation: `41d1a20018554117b33ef8d11730f5bc`.

The sender design was reviewed through Stitch and V1 refinement edits requested there. The implementation retains its forest-green/ivory/sage palette, numbered recipient/subject/wedding cards and right-hand email preview. It uses the existing dashboard shell and real MongoDB data. Bulk/scheduled sending, artwork uploads, accommodation, RSVP, guest limits and fictional delivery confirmation from the larger mockup are excluded. There is no mock dispatch mode or asynchronous delivery confirmation; missing configuration disables Send. Preview and delivery share one escaped, inline-style HTML email template. The recipient opens the existing `/w/:publicId` wedding website; the larger recipient-page mockup is not introduced as another product.

Current wedding setup design: `d9719a1147394ec6841e8a7cf403acdb`, **Your wedding, your beginning — Onboarding**. Generated through Stitch for this implementation.

The implemented screen follows its two-step family/wedding flow, sectioned wedding form, signed-in header, forest/ivory/blush palette and three-node sidebar diagram. Fake filled names and the nonfunctional language switch from the generated reference were omitted. Create and edit share one form component.

Visual references used for the retained workspace:

- Login: `663fa6fc1c4e40849412e22d680b4df0`.
- Homepage: `dfe1fbab31864193b4aa565914b4c08b`.
- Overview: `39432d710dbd4855a4f30453552a50e3`.
- Functions: `e58e9b4a091e402fa02f5c56bf436d75`.
- Budget: `6bad3e4ef148435eb964bfa30a800462`.
- Guests: `b6b875359a3d41f7ab7978262f3b6c70`.
- Find Services: `fdef533725c94361bbf208d3db804b1f`.
- Photos: `1c7cbcdab27f4a8b805deae80d303680`.
- People & Access: `df94ba4c2bea4598b5aa73bd3f2392f3`.
- Guest Website: `aa16d73e32d344048e6a99c0e82a663a`.

The dashboard retains the original Stitch sidebar/header, attention panel, ceremony card, teams table, spending summary, updates area and nearby service discovery. All sections remain accessible after wedding creation. Sample names, vendor profiles, ratings, money amounts and task progress are omitted; unconnected features show explicit empty states. Dashboard and guest website read actual wedding details through the API. No sample records are inserted into user accounts or used as a fallback.

`web/public/images/stitch/ceremony-1.jpg` is retained only as a decorative login photograph. It is not represented as the current user's wedding photograph.

`category-*.jpg` files are illustrations from the Find Services reference, used for service categories. They do not represent actual vendors. Google Maps links use the current wedding's location; the in-app directory awaits its backend integration.
