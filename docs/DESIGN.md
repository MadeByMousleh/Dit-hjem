# Strømblik design system

Updated: 2026-10-24. Applies to Expo web, Android and iOS.

This is Strømblik's design specification, inspired by MobilePay's restrained blue identity. It is not an official MobilePay specification. Runtime tokens live in `src/styles/theme.ts`. The shared palette and primary card surfaces now implement this guide; some older compact controls still need individual refinement.

## Colours and surfaces

| Role | Target colour | Use |
| --- | --- | --- |
| Page background | `#F5F5F2` | App canvas, scrolling pages, modal background |
| Surface | `#FFFFFF` | Cards, inputs, bottom navigation |
| Main text | `#3C3246` | Headings, body text, important values |
| Secondary text | `#6158A4` | Supporting descriptions, captions |
| Brand accent | `#5A78FF` | Selected icons, focus indicators, decorative accents |
| Action blue | `#4158D8` | Primary buttons and small actionable text |
| Pressed action | `#3548B8` | Pressed primary buttons |
| Soft accent | `#EEF1FF` | Selected icon tiles, secondary button backgrounds |
| Border | `#E8E8EE` | Subtle card outlines and separators |
| Input border | `#8D8798` | Visible input boundaries |
| Error | `#B42318` | Failed operations and invalid fields |
| Error surface | `#FFF1F0` | Error message background |

MobilePay's published button guidelines identify `#5A78FF` and `#3C3246`. The other colours above are our choices. Use a darker action blue for white text on normal-size buttons; brand blue is not automatically suitable for every text/background pairing.

Keep most of the screen neutral. Use blue to identify interaction and selection. Avoid large blue panels, strong shadows and a different saturated colour for every category. Errors must include a readable message or icon, not just colour.

## Buttons and interaction states

| Kind | Background | Label / icon | Border |
| --- | --- | --- | --- |
| Primary | Action blue | White | None |
| Primary pressed | Pressed action | White | None |
| Secondary | Soft accent | Action blue | None |
| Secondary pressed | `#E1E7FF` | Action blue | None |
| Quiet / text | Transparent | Action blue | None |
| Destructive | White | Error | Error |

- Minimum touch target: 48 × 48 logical pixels; icon-only controls need an accessible label.
- Standard button: at least 48 high, 20 horizontal padding, 14 corner radius, 16 semibold label.
- Show a progress indicator while saving; prevent duplicate submissions.
- Disabled controls use a neutral surface and muted label, and expose the disabled state to accessibility APIs.
- Web keyboard focus uses a visible 2 px brand-blue outline with a 2 px offset.
- Verify normal text contrast of at least 4.5:1 and essential UI boundaries of at least 3:1. Large text may use 3:1.

## Layout, cards and navigation

- Spacing scale: 4, 8, 12, 16, 20, 24, 32 and 48.
- Mobile page padding: 20; card padding: 20; gap between cards: 16.
- Cards use white surfaces, a subtle border and a 24 px radius, with 20 px internal padding. Use spacing to establish hierarchy.
- The UI is completely flat: no shadows, elevation or decorative glow layers; a restrained chart-area fill and gold negative-price markers are deliberate exceptions. Separate content with neutral surfaces and whitespace.
- Inputs use a 12 px radius and a persistent visible label. Place errors below the relevant field.
- Category cards live under **Mit hjem**: El, Varme, Bil, Apparater and Affald. Use one consistent icon treatment.
- Affald opens a dedicated collection page. Notification preferences belong under **Profil → Notifikationer**, using the same row, switch and modal editor as other alerts.
- Bottom navigation uses a white surface, a subtle top divider and a soft-blue selected icon tile. Respect safe-area insets.
- Allow text wrapping and system font scaling. Do not truncate important dates, amounts or error messages.

## Typography

### MobilePay font research

Playtype identifies **Paytype – Mobilepay** as a bespoke typeface commissioned for MobilePay in 2017. MobilePay's established brand guide also names Paytype. This confirms the historical brand typeface, not the exact font in every screen of the latest app redesign.

No publicly licensed Paytype font package or approved font files were found during this research. Do not extract font files from MobilePay's website or app. Using their brand materials as reference does not establish permission to embed their fonts in Strømblik.

**Selected app font: Nunito.** It provides the soft rounded appearance requested by the user and is distributed under the SIL Open Font License. It is our visual alternative, not MobilePay's Paytype. All existing DM Sans body and Fraunces heading references now use Nunito. `src/screens/AppScreen.tsx` loads locally bundled regular (400), medium (500), semibold (600) and bold (700) fonts through `@expo-google-fonts/nunito`.

Use regular for body text, medium for navigation and supporting emphasis, semibold for headings and bold for buttons and important labels. The font licence is included by the package in `LICENSE_FONT`; no runtime Google Fonts request is required.

If the project later chooses licensed Paytype instead:

1. Add the approved fonts and their licence evidence to the repository.
2. Register actual available weights with `expo-font` for both native and web.
3. Centralize font families in the theme and update existing family references; merely loading a font does not change existing screens.
4. Verify Danish characters (`æ`, `ø`, `å`), currency, dates, wrapping and large system text before release.

| Role | Size / line height | Weight |
| --- | --- | --- |
| Page title | 30 / 36 | Semibold |
| Section title | 22 / 28 | Semibold |
| Card title | 18 / 24 | Bold |
| Body | 14 / 20 | Regular |
| Button | 16 / 20 | Semibold |
| Supporting text | 12 / 18 | Regular |
| Eyebrow | 11 / 16 | Bold, restrained letter spacing |

The scale is our specification, not a measurement of MobilePay's app. Use available font weights rather than assuming a custom font includes every weight.

## Icons

Hugeicons **Stroke Rounded** is the intended common icon style. It supports Expo / React Native through `@hugeicons/react-native`, `@hugeicons/core-free-icons` and `react-native-svg` (already installed).

- Normal size: 24; compact controls: 20; stroke width: 1.75–2.
- Use main text colour for neutral icons and action blue for selected controls.
- Use explicit icon imports and a shared app icon component; avoid mixing multiple icon styles on a screen.
- Free Stroke Rounded and paid Pro styles are separate choices. Pro requires its own licence.
- All app icons now render through `src/components/AppIcon.tsx` using Hugeicons Stroke Rounded. Existing semantic icon names map to explicitly imported Hugeicons assets; individual package subpaths avoid importing the full icon catalogue. SVG icons require no icon-font loading. Selected navigation uses the same rounded stroke style with colour/background emphasis.

## References

- [MobilePay button colours](https://www.mobilepay.dk/-/media/mobilepay-global/material-bank-global/brandguidelines/mobilepay-button-guidelines.pdf)
- [Paytype commission, Playtype](https://playtype.com/commission/mobilepay/)
- [Nunito source and licence](https://github.com/google/fonts/tree/main/ofl/nunito)
- [Established MobilePay brand guide](https://mobilepay.fi/-/media/mobilepay-global/material-bank-global/brandguidelines/mobilepay-brandguide.pdf)
- [Current official brand resources](https://brand.vippsmobilepay.com/)
- [Hugeicons React Native documentation](https://hugeicons.com/docs/integrations/react-native/overview)

This guide does not establish authenticated UI verification, native font rendering, or notification delivery. Those require separate checks when implementing the design.
