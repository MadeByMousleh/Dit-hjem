# Strømblik — design audit and exact motion specification

**Date:** 24 October 2026<br>
**Baseline:** app 1.0.112, Android versionCode 113; current source plus the isolated APK source in `.tmp/property-model-apk-release`.<br>
**Deliverable:** implementation backlog and motion specification. See section 9 for delivered changes and remaining sign-off; original findings describe the 1.0.112 baseline.

## 1. Scope and evidence

This is a screen-by-screen source audit of the active consumer experience: introduction/setup, login/recovery, Overblik, widgets, El, Mit hjem/property tabs, heating, waste and Profile. It also specifies the animation system needed to make those screens feel coherent and polished.

It cannot establish **every possible visual defect** on every device. The last captured phone screen was the introduction (`.tmp/el-layout-112.png`); a complete authenticated visual walkthrough of 1.0.112 was not completed. Findings below explicitly distinguish source-confirmed inconsistencies from visual checks still required. Do not mark a screen visually approved from a TypeScript check.

Evidence codes:

- **C — confirmed in source:** the behavior/style is present in the inspected implementation. Its severity on a particular screen size may still need measurement.
- **V — visually observed:** visible in the captured phone introduction.
- **R — review required:** plausible risk requiring a device check; not an established bug.
- **D — design decision:** a prescribed improvement, rather than a factual defect.

Priority:

- **P0:** misleading state, blocked core flow, or release blocker. Resolve before release.
- **P1:** necessary for a professional, consistent everyday experience.
- **P2:** refinement and expressive motion after P0/P1.

The latest electricity cleanup is a useful foundation. Do **not** reintroduce a spot-price card on El, chart-type selectors, widget colour/size controls for fixed widgets, watts for baseline, or one-year-at-a-time annual totals. Keep the gold negative-price treatment and user-defined price thresholds. Bil, Apparater, SmartThings and Hus & sol remain paused; their presence in the repository is not a reason to restore their navigation.

### Source index

Paths in the issue tables are relative to `src/`; symbols and style names are supplied because line numbers change during implementation.

| Area | Primary implementation |
| --- | --- |
| Design foundations | `styles/cards.ts`, `styles/theme.ts`, `styles/appStyles.ts`, `../docs/DESIGN.md` |
| App entry and onboarding | `screens/AppScreen.tsx`, `screens/AccountSetup.tsx`, `screens/LoginScreen.tsx`, `components/EnergyVaultGate.tsx` |
| Dashboard/navigation | `screens/DashboardScreen.tsx`, `screens/SecondaryTabsScreen.tsx`, `components/BottomTabs.tsx`, `components/HomeCategories.tsx` |
| Widgets | `components/ElectricityWidgets.tsx`, `components/DraggableWidgetList.tsx`, `components/ResizableWidget.tsx`, `utils/widgetAppearance.ts` |
| Charts | `components/PriceChart.tsx`, `components/InteractiveEnergyChart.tsx`, `components/ElectricityUsageChart.tsx`, `components/ElectricityDailyCurve.tsx`, `components/NegativePriceBar.tsx` |
| Electricity cards | `components/MonthlyUsageCard.tsx`, `components/ElectricityBaselineCard.tsx`, `components/ElectricityPatternsCard.tsx`, `components/ElectricityPriceShareCard.tsx`, `components/ElectricityPriceCard.tsx`, `components/ElectricityDetailsCard.tsx` |
| Property | `components/HomePropertyPage.tsx`, `components/HomeElectricityCard.tsx`, `components/HomePhotoGallery.tsx`, `components/HomeRoofDetails.tsx`, `components/HomeParcelDetails.tsx`, `components/HomeParcelMap.tsx`, `components/HomeFloorPlans.tsx` |
| Heating/waste/profile | `components/HeatingPage.tsx`, `components/HeatingUsageCard.tsx`, `components/WasteCollectionCard.tsx`, `components/ProfilePage.tsx`, `components/WasteReminderSetting.tsx` |
| Shared interactions | `components/HapticPressable.tsx`, `utils/barScrub.ts`, `components/UsageDatePicker.tsx`, `components/PriceModeFields.tsx`, `components/PriceLimitFields.tsx` |

## 2. The intended visual direction

**Calm Danish home-and-energy app.** Warm off-white canvas, white surfaces, clear purple-black typography, restrained blue actions, rounded stroke icons. The introduction supplies the memorable visual moment through the existing dimensional illustrations. Daily screens earn their quality through hierarchy, legible numbers, useful feedback and predictable transitions.

Keep the existing palette and Nunito. Do not add another font, generic glass effects, rainbow card backgrounds, decorative gradients on forms, bouncing numbers, or confetti for ordinary actions. A subtle chart area fill and the requested gold negative-price accents are deliberate exceptions to a flat interface; document them rather than maintaining a contradictory “no gradients anywhere” rule.

### Exact layout and type contract

All sizes below are **logical React Native units**, not physical pixels. Text uses normal system font scaling.

| Token | Required value/use |
| --- | --- |
| Page horizontal padding | 20 on phones; centre content in a 760 maximum-width column on larger screens |
| Card padding | 20, consistently; image cards may be edge-to-edge above a 20-padded text section |
| Card radius | 24 |
| Card-to-card gap | 16; choose parent `gap` OR child `marginBottom`, never both |
| Section-to-section gap | 24 |
| Spacing scale | 4, 8, 12, 16, 20, 24, 32, 48; arbitrary values require an optical/layout reason |
| Card title → subtitle | 4 |
| Header block → first content block | 16 |
| Label → value | 4 |
| Related rows | 8 |
| Separate groups inside a card | 16 |
| Form label → input → helper | 8 then 4 |
| Form field group → next group | 16 |
| Card content → footer/action | 16 |
| Nested metric surface | 16 padding, 16 radius, neutral `paper` background |
| Primary/secondary button | minimum height 48, horizontal padding 16, radius 14; fill vs soft surface identifies priority |
| Input | minimum height 52, radius 12, horizontal padding 16; persistent label |
| Icon touch box | minimum 48 × 48; icon itself 20 or 24 |
| Bottom sheet | top corners 24, content padding 20, handle 36 × 4, minimum bottom padding `max(safeArea,16)` |
| Introduction headline | Nunito 700, 38/44; use 32/38 on short/narrow layouts, not text auto-shrink |
| Page title | Nunito 600, 30/36 |
| Section title | Nunito 600, 22/28 |
| Card title | Nunito 700, 18/24; align existing `cards.ts` and the older design guide |
| Body / meaningful explanation | Nunito 400, 14/20; onboarding and lengthy form instructions may use 16/24 |
| Buttons/row actions | Nunito 600, 14/20; primary onboarding CTA 16/22 |
| Secondary metadata | Nunito 400, 12/18; do not put essential instructions below 12 |
| Chart axis labels | 11 minimum; selected value/date also exists outside the graphic at readable size |
| Large metric | Nunito 700, 32/40; tabular numerals where supported |
| Secondary metric | Nunito 700, 24/32 |
| Units | 14/20, baseline-aligned with metric; keep unit and number together |
| Bottom-tab label | 12/16, maximum two lines |
| Stroke icons | Hugeicons Stroke Rounded, normal 24, compact 20, consistent visual weight |

Do not globally enlarge every label. A chart tick, explanatory paragraph, primary number and footer have different roles. Consistency means the same role receives the same treatment.

## 3. Exact issue register

Each row is a separate fix. Motion references resolve to the exact recipes in section 5. “None” means the element should stay still; animation is not the remedy.

### A. Foundations and shared behavior

| ID / priority / evidence | Current issue and source | Required fix and acceptance criterion | Motion |
| --- | --- | --- | --- |
| F01 · P1 · C | `docs/DESIGN.md` allows 20 and 24 card padding and specifies type weights/sizes different from `styles/cards.ts`. | Make section 2 the single token contract; update guide and code together. All active standard cards reference shared tokens; deliberate image/compact exceptions are named. | None |
| F02 · P1 · C | Token adoption is partial: heating, Profile, roof, floorplans and photo titles still use independent 17/20/22 sizes and 18/24 outer margins. | Migrate active cards and titles by semantic role. A side-by-side screenshot has aligned content edges and consistent 16 gaps. | None |
| F03 · P1 · C | Important helper/footer text remains 9–11 in chart, Profile, heating and old `appStyles` styles. | Essential helper text 12/18; chart ticks ≥11. Read at normal phone distance without zooming. | None |
| F04 · P1 · C | Some text, e.g. parcel loading/error rows and form inputs, omits the Nunito family. React Native Text does not inherit a global font automatically. | Add shared `AppText`/input styles or explicit tokens. No accidental platform-default font in active flows. | None |
| F05 · P1 · C | Button radii range from 12 through 24, with unrelated fill/soft/text treatment (`LoginScreen`, `AccountSetup`, `ProfilePage`, `HomeFloorPlans`). | Standard button variants with normal/loading/disabled/pressed states. One main CTA per task. | M01, M09 |
| F06 · P1 · C | 36/42/44 controls and unpadded text actions fall below the project's 48 target: `UsageDatePicker`, `PriceChart`, roof retry, floorplan delete and property back. | Increase hit area without making every icon visually huge. Check overlapping hit regions in calendars and chart controls. | M01 |
| F07 · P1 · C | `HapticPressable` vibrates on press-in, while BottomTabs, HomeCategories, Profile and several other flows use raw Pressable. A gesture cancelled into scrolling can already have vibrated. | Shared interaction policy: activation haptic for buttons; one tick per chart selection change; drag pickup/drop haptics. No duplicate buzz from wrapper + handler. | M01, M05, M11, M13 |
| F08 · P1 · C | `InteractiveEnergyChart.select` calls `tickSelection`, and `ElectricityUsageChart.selectBar` calls it again for the same selected point. | Let one layer own selection feedback. Exactly one haptic when crossing to a new point, none while staying on it. | M11 |
| F09 · P1 · C | Feedback is scattered between opacity changes, raw Pressables, inline errors and several modal implementations. | Shared Button, InlineStatus, EmptyState, Sheet and ConfirmDialog components. Use the same visual and motion state language. | M01, M06–M10 |
| F10 · P1 · C | Fixed heights and SVG text do not automatically adapt to accessibility font sizes (`ElectricityWidgets`, `InteractiveEnergyChart`). | Use measured/content-driven card height and readable external selected values. At 200% text, no essential content is cropped. Chart geometry can remain fixed-height. | None |
| F11 · P1 · R | Contrast of pale selected/unselected chart colours, gold accents and low-opacity disabled labels needs measurement in context. | Measure text and meaningful graphics against their actual surfaces. Keep signed numbers and selection outlines so colour is supplementary. Do not claim failure without measurement. | None |
| F12 · P1 · C | Active pages mount through conditional rendering/keyed screens rather than a shared transition system (`DashboardScreen`, `SecondaryTabsScreen`). | Predictable tab vs drill-in transitions, preserved scroll and clear back behavior. Reopening a page must not replay every card entrance. | M04, M05 |
| F13 · P2 · C | Animation timings are distributed across local components; no shared motion token set. | Create a shared motion module with recipes below and a single reduced-motion setting subscription. | All |

### B. Introduction, account setup and login

| ID / priority / evidence | Current issue and source | Required fix and acceptance criterion | Motion |
| --- | --- | --- | --- |
| O01 · P0 · C/V | `screens/AppScreen.tsx` still sets `FORCE_ONBOARDING_PREVIEW = true`; the phone returned to introduction after the latest install. | Disable forced preview in release builds. Returning configured accounts go to Overblik; genuinely incomplete setup remains resumable. Test cold start, upgrade and logout/login. | M02 only for actual first run |
| O02 · P1 · V/R | Last phone image shows white system-status text on a pale blue introduction background. Contrast is visibly weak; source ownership of that style needs tracing. | Set status-bar foreground explicitly for each onboarding background. Time, battery and connectivity remain readable. | None |
| O03 · P1 · C/D | The hero loops between +4 and −7 units with rotation every five seconds, including setup steps (`AccountSetup`). This competes with form focus. | Keep a controlled hero reveal, then one short settling/float sequence on marketing slides only. Stop decorative motion when a field is focused or keyboard opens. | M02 |
| O04 · P1 · C | Introduction/setup typography and buttons use a separate 32/38 headline, 16/20 radius vocabulary; the transition into the main app feels like a different product. | Preserve expressive intro art, unify colours, type family, action shapes, spacing and icons. First dashboard frame visibly belongs to the same app. | M02, M03 |
| O05 · P1 · C | Footer “next” is predominantly an arrow while skip is a text action; setup uses a five-dot indicator (`AccountSetup`). | Marketing may retain the arrow with accessible “Næste”; task steps show a labelled CTA and “Trin X af Y”. Persist actual completion, not just the page index. | M03, M09 |
| O06 · P1 · R | Large hero/headline plus fixed footer needs short-screen, large-text and keyboard verification. | At 320-wide/short height and 200% text, fields, error and next action remain reachable without overlap. Reduce art space before reducing essential text. | M15 |
| O07 · P1 · C | Address suggestions appear/disappear without shared loading, selected and no-match treatments. Setup and Profile use different suggestion row styles. | Shared address field and results list; selected address becomes one compact confirmed row with Change. Never replace a typed address silently. | M16 |
| O08 · P1 · C | Provider connection help in `EncryptedEnergyControls` includes a long technical recovery explanation inline. | Default view: provider, short benefit, one connect/check CTA and status. Put exceptional authorization instructions behind “Problemer med forbindelsen?”. | M09, M17 |
| O09 · P1 · C | Login modes have 42-height choices and input styling without a specified font; login and vault cards differ from setup forms. | Shared form controls, persistent field labels, 48 touch targets and consistent inline validation. Preserve secure recovery flows. | M01, M09, M15 |
| O10 · P2 · D | Setup completion currently lacks a defined end-to-dashboard visual handoff. | One small confirmation check and useful next action, then reveal dashboard content. Do not invent saving/import completion to finish the animation. | M18, M04 |

### C. Navigation, dashboard and widgets

| ID / priority / evidence | Current issue and source | Required fix and acceptance criterion | Motion |
| --- | --- | --- | --- |
| N01 · P1 · C | All-caps `STRØMBLIK` masthead on detail pages competes with page title and back link; property uses a different header. | Dashboard keeps compact brand. Details use back + one page title; Profile/property use the same header geometry. No stacked redundant titles. | M04 |
| N02 · P1 · C | “Mit hjem” opens another “Mit hjem”; heating is “Varme” in categories but “Vand og varme” in bottom navigation. | Keep the requested bottom-tab name Mit hjem; name its property destination “Boligen”. Use “Varme” if no water experience is supplied. Confirm product scope before changing the latter. | None |
| N03 · P1 · C | Bottom-tab labels are 10/12; selected icon treatment snaps; buttons use raw Pressable (`BottomTabs`). | 12/16 labels, shared activation haptic, subtle selection-pill transition. Long labels remain readable at increased text size. | M05 |
| N04 · P1 · C | `HomeCategories` still describes El as “Forbrug, priser og din elaftale” after prices moved to Overblik. | Use “Forbrug, mønstre og din elaftale”. Align card description with its destination. | None |
| N05 · P0 · C | Dashboard banner says “eksempelpriser vises” while widget price data is withheld for `isSample` (`DashboardScreen`, `useElectricityWidgetData`). | Distinguish loading, unavailable and stale real data. Never claim sample prices are on screen when they are not. For blocked supplier resolution show its actionable reason. | M07, M10 |
| N06 · P1 · C | `ElectricityWidgets` combines card style, fixed height, span height, padding overrides and overflow hiding. `widgetAppearance` fixes price chart rows at 40 and usage at 48. | Measure fixed-card content and allocate grid height accordingly; no empty lower block or clipped footer. Preserve fixed normal size and full-width charts. | M13 |
| N07 · P1 · C | Shared spot-price styles exist, but widget header, absolute settings control and wrapper remain separately built. Sharing style objects does not guarantee exact layout. | One reusable price-card composition including header/settings/content/footer. Preview and dashboard must render the same component. | M01, M06 |
| N08 · P1 · C | Widget titles remain 12/16 in some overrides while full price title uses the shared 18/24 style; metric widths rely on auto-shrink. | Define compact-stat vs full-chart card variants. Full chart titles 18/24, compact labels 14/20. Wrap/reflow important values before shrinking. | None |
| N09 · P1 · C | Long-press, selection overlay, settings icon and drag handle create several competing edit entry points (`DraggableWidgetList`, `ElectricityWidgets`). | Normal mode: one settings icon per configurable card. Long-press enters clearly labelled arrangement mode with Done. Keep fixed-size cards non-resizable. | M13 |
| N10 · P1 · C | Widget catalogue keeps “Fastgør til Overblik, El eller begge sider” although some widgets now only offer Overblik. | Explain available destination per card; label fixed cards already on El as “Vises allerede under El”. Do not show a disabled mystery option. | M01, M10 |
| N11 · P1 · R | Removing the last dashboard widget can leave a sparse screen with one button. | Intentional empty dashboard: title, short explanation, choose-widgets CTA, optional static example outline clearly marked as preview. No fabricated data. | M10 |
| N12 · P2 · D | Initial dashboard arrival lacks a single curated entrance sequence. | Reveal above-fold cards once with restrained stagger; keep stored content visible on revisits and background refresh. | M08 |

### D. Electricity and chart details

| ID / priority / evidence | Current issue and source | Required fix and acceptance criterion | Motion |
| --- | --- | --- | --- |
| E01 · P1 · C | New ordering is implemented, but the month summary title and comparison badge compete in a horizontal row (`MonthlyUsageCard`). | At narrow widths stack badge below the title or next to metadata, not against wrapped heading. Keep main number prominent. | None |
| E02 · P1 · C | “Måned”, “År”, “Årstotal” mix period granularity with comparison; annual totals now contain several years. | Labels: “Dag”, “Måned”, “År”, “Alle år”, retaining existing semantics. Alle år has no per-year navigation arrows. | M12 |
| E03 · P1 · C | Usage totals start unselected but graph receives index 0 (`selectedIndex < 0 ? 0 : selectedIndex`), visually selecting a bar while headline shows all-period total. | Support no selection or select a default point and show its value. Headline, marker and accessible value must refer to the same thing. | M11 |
| E04 · P1 · C | `InteractiveEnergyChart` exposes point index through accessibilityValue and date/label, but omits the numeric kWh from the accessible text. | Announce date/hour, actual value, unit and missing/partial status. Increment/decrement adjusts one point. | M11 |
| E05 · P1 · C | A fixed set of at most five axis labels can omit the selected year/hour, and every graph repeats “Træk i prikken for at vælge”. | Always expose selected label in the readable summary; show a one-time scrub hint, retained via accessibilityHint. No persistent instructional footer once learned. | M11 |
| E06 · P1 · C | Line/area SVG label fonts do not share the app typography; tiny labels plus unsized text can render differently from cards. | Use supported Nunito font mapping and external labels where necessary. Verify Danish date formatting and units at three widths. | None |
| E07 · P1 · C | Daily-curve highlight uses an end index `start+3`; when the peak window starts at 21, end=24 exceeds a plot whose last x index is 23. | Represent hour-interval edges explicitly and clamp to the plot. 21–24 highlight ends at the right boundary. Separately decide whether a midnight-crossing window is useful. | M11 |
| E08 · P1 · C/R | Daily curve has no onScrubChange propagation to the containing page; the El usage card also does not currently pass its available scrub callback. | Propagate gesture ownership so the page does not move while the handle is being dragged. Verify diagonal swipes still scroll when not scrubbing. | M11 |
| E09 · P1 · C | Peak-hour sentence can enumerate many separate hour labels (`ElectricityPatternsCard`). | Collapse consecutive hours into ranges. Show one strongest range; move full detail behind an expander. Do not imply unsupported precision. | M14 |
| E10 · P1 · C | Daily curve uses 24 metric text, baseline/summary use 32, while metadata is 10. Not all differences are semantic. | Apply primary/secondary metric roles deliberately; daily selected value 24/32, main summary 32/40, metadata 12/18. | M11 |
| E11 · P1 · C | Baseline helper and method caveat are always displayed together; the electricity page combines many explanatory notes. | Keep “Estimeret i rolige perioder” visible; move method/solar caveat into “Om grundforbrug”. Keep kWh pr. døgn and preliminary status visible. | M14 |
| E12 · P1 · C | Cheap-hour card's waiting animation uses repeated animated columns, while loading and insufficient data have different meanings. | Separate “fetching saved data”, “need 7 complete days” and “price archive unavailable”. Keep honest day count; no countdown implying a guaranteed unlock date. | M07, M19 |
| E13 · P0 · C | `PriceLimitFields` labels thresholds as including net/afgifter, but raw spot display applies the same limits to raw prices in `PriceChart` and the price widget. | Choose and document one basis. Recommended: thresholds follow display mode and label that basis; store separate defaults/values if necessary. Colour, legend and displayed price must agree. | M12 |
| E14 · P1 · C | Price footer/netselskab is 10/14, despite being necessary to understand the amount; footer is two long lines. | Two compact 12/18 rows: pricing basis and company/area. Longer tariff explanation goes behind information action. Do not claim exact bill totals. | M14 |
| E15 · P1 · C | Price settings anchor is positioned using `top:-52`; content/header changes can misalign it. | Make settings part of the header's normal layout. Minimum 48 hit area and no overlap at large text. | M06 |
| E16 · P1 · C | Negative bars animate height from zero again when height changes; each spark has its own loop/subscription (`NegativePriceBar`). | Shared motion clock, visible-screen gating, preserve stable zero baseline and update from current height. Retain gold and a restrained spark above every negative bar. | M20 |
| E17 · P1 · C | Price and consumption use different date-arrow sizes, tabs and sheet/editor behavior. | Share period-navigation controls, spacing and hit areas; keep different graph types where their data requires it. | M06, M12 |
| E18 · P1 · C | Elaftale form still has 9–10 labels, varying input shells and a dense supplier modal (`ElectricityPriceCard`). | Shared labelled inputs, searchable sheet, conditional fields and one save CTA. Keep previous agreement dates safe and keyboard-visible. | M06, M09, M15, M16 |
| E19 · P1 · C | Eloplysninger is a two-column grid of long identifiers and technical field names. | Default: supplier, address and meter identity. Expand technical details; permit ID wrap/copy. Small viewport switches to single column. | M14 |

### E. Property / Mit hjem

| ID / priority / evidence | Current issue and source | Required fix and acceptance criterion | Motion |
| --- | --- | --- | --- |
| H01 · P1 · C | Property uses an additional page title, full address hero, explanatory sentence and tab strip before the first card. | One compact header, two-line address maximum with expand, then tabs. Remove redundant introductory copy. Essential house summary should be reachable quickly. | M04 |
| H02 · P1 · C | Horizontal tabs hide their scrollbar and the last “Plantegning” tab can sit offscreen with no explicit overflow cue. | Visible partial next tab or subtle edge cue; automatically reveal selected tab. Tab changes should not reset the entire page abruptly to top. | M12 |
| H03 · P1 · C | Photo title is 22, roof/floorplan titles 20, shared property/electricity titles 18. | Apply shared 18/24 card title. Image credit remains 12/18; data value follows metric hierarchy. | None |
| H04 · P1 · C | Photo controls, directions, external viewer and retry share one busy section (`HomePhotoGallery`). | Main image, compact direction selector, one expand action. Put official viewer link/credit in a secondary row. Keep approximate address marker honest. | M21 |
| H05 · P1 · C | Photo fullscreen modal has fixed paddingTop 48 instead of safe-area-aware placement. | Safe-area close control, dark/photo-appropriate viewing surface, contained image and caption. Verify portrait/landscape. | M21 |
| H06 · P1 · C | Property loading can append a spinner card above cached content; roof shows spinner and calculating text. | Keep cached geometry/content stationary, show subtle update status. On first load reserve the actual summary/roof layout. | M07 |
| H07 · P1 · C | Roof material/area/slope is a vertical label/value list with gaps 10/14; retry has no explicit touch box. | Three consistent fact rows or responsive metric tiles; short “ca.” labels, one secondary refresh action with 48 hit area. | M07, M09 |
| H08 · P1 · C | Parcel fallback uses unstyled Text and weak separation between error and retry (`HomeParcelDetails`). | Shared empty/error card with Nunito, concise reason and one retry button. Loading, missing parcel and request failure are distinct. | M07, M10 |
| H09 · P1 · C/R | House fact tiles use percentage widths and large text; long supplier names/unknown values may exceed comfortable widths. | Responsive single-column fallback, wrapping values and consistent metric padding. Verify with long company/address strings, not just the current home. | None |
| H10 · P1 · C | Floorplans shows upload, empty copy and generic “Arbejder…” using one busy flag; document open/delete use small text controls. | Distinct uploading/opening/deleting feedback, document thumbnail/icon, type/size/date metadata and clear primary action. Do not invent upload percentage. | M09, M22 |
| H11 · P1 · C | Floorplan image preview is an inline fixed 420-height image; PDF opens an external/native share flow, producing inconsistent preview expectations. | Clearly label “Vis billede” and “Åbn PDF”; full-screen image preview with pinch and safe close. Preserve native PDF options where required. | M21, M22 |
| H12 · P1 · C | Destructive floorplan confirmation is an inline “Ja, slet” row using normal action colour. | Named-file confirmation, neutral Cancel and clearly destructive Delete. Preserve visible document until deletion succeeds; remove only on server confirmation. | M23 |

### F. Heating, waste and Profile

| ID / priority / evidence | Current issue and source | Required fix and acceptance criterion | Motion |
| --- | --- | --- | --- |
| P01 · P1 · C | Heating cards retain 18/24 outer gaps, 20/24 padding, 17 titles and 10–11 metadata (`HeatingPage`, `HeatingUsageCard`). | Adopt shared card tokens. Electricity and heating should feel like sections of one app. | None |
| P02 · P1 · C | Heating periods use blue-filled selected tabs, round 42 arrows and “Større graf” controls unlike the simplified electricity controls. | Shared segmented/date controls; display all useful chart data by default with a clearly separate optional detail viewer only if needed. | M12 |
| P03 · P1 · C | Heating overview combines annual panel, multiple metric tiles, refresh, progress and technical customer detail. | Consumption first, comparison next, temperatures third, connection/customer detail last. Hide secondary technical fields behind disclosure. | M14 |
| P04 · P1 · C | Waste empty state uses “Tilføj din adresse” for every no-events/no-error result; no-events can also mean a valid address with no upcoming collection. | Distinct missing address, loading, unsupported source, failure and no-upcoming-events states. Action must match the reason. | M07, M10 |
| P05 · P1 · C | Waste event rows can repeat category title and provider title; all rows have equal emphasis. | Emphasize next date/category, group same-day collections, demote descriptive provider text. Relative “I morgen” must retain the actual date. | M08 |
| P06 · P1 · C | Profile has separate 31/37 title, 20 card titles, 24 margins and 9–11 labels. | Adopt shared page/card/form hierarchy, with identity → home/address → connections → notifications → account actions. | M04 |
| P07 · P1 · C | Profile's custom switch thumb jumps using `alignSelf`, with spinner occupying its place. | Shared switch with animated thumb, accessible switch semantics, pending indicator outside thumb. Only show success after setting is saved; rollback on error. | M24 |
| P08 · P1 · C | Notification editors use pageSheet/slide while other settings use centred fade modals and inline editors. | One sheet pattern for short settings; full screen for long workflows. Consistent header, Cancel/Save behavior and unsaved-change handling. | M06, M09 |
| P09 · P1 · C/R | Threshold editors, agreement forms, login and floorplan controls have different keyboard handling. | Verify each field with keyboard open, decimal comma, Android back, landscape and error text. Focused field + label + error + save remain reachable. | M15 |
| P10 · P2 · D | Saved/account updates need a shared quiet success treatment instead of scattered text/spinners. | Inline check + “Gemt”, retaining original context. Avoid a modal for every save. | M09 |

### G. Cross-screen release checks

| ID / priority / evidence | Current issue and source | Required fix and acceptance criterion | Motion |
| --- | --- | --- | --- |
| Q01 · P1 · C | Error strings include a literal `Pr?v igen.` in the rejected settings-save path in `PriceChart`. PowerShell output can also look garbled without the file being corrupt. | Audit actual UTF-8 strings, not terminal mojibake. Check æ/ø/å, minus signs, ellipsis, currency and superscripts in rendered UI. | M10 |
| Q02 · P1 · C/R | Most loading states use standalone spinners, with inconsistent space reservation. | Shared first-load skeletons and in-place refresh states. No blank flashing or card movement caused solely by loading. Measure, do not assume every spinner causes a jump. | M07 |
| Q03 · P1 · R | Large-text, screen-reader, keyboard-focus and reduced-motion coverage is incomplete. | Complete the matrix in section 7 on the actual build. Label controls and preserve non-visual chart selection. | All reduced variants |
| Q04 · P1 · C | Root and isolated APK source differ; an import/status mismatch was caught during 1.0.112 assembly. | Audit the actual packaged screens before sign-off. One reviewed change set must drive the built app. Never sign off root-only visuals. | None |
| Q05 · P2 · D | Paused integrations have legacy design surfaces, but they are outside the current user journey. | Keep paused. When resumed, audit charger, Tesla, SmartThings, devices, 3D and valuation against this contract before enabling navigation. | M04, M09 as baseline; separate feature specs |

## 4. Screen composition to implement

### First run

1. Native splash: brand only; retain native launch behavior.
2. Three marketing slides: one illustration, headline, short description, progress, next/skip.
3. Account/home setup: one task per step; art becomes secondary while typing.
4. Provider permissions: concise status and real authorization action.
5. One completion confirmation → dashboard.

### Overblik

Compact brand/header → user's pinned cards → optional quiet “Tilpas overblik”. Preserve user ordering. Spot-price card stays here. Do not automatically rearrange user pins each launch. Initial empty account gets a clear choose-widgets state rather than fake household figures.

### El

Page title → month summary → full usage chart → patterns group (baseline, daily curve, weekday comparison) → cheap-hour share → optional nonduplicate widgets → agreement → expandable meter details → widget management. Keep loading/error states local to their cards. No separate spot-price card.

### Mit hjem

Category screen: Boligen, El, Varme, Affald. Property: compact address header, discoverable tabs, photo/house summary/electricity overview. Detail tabs share the same header/content edges. Put data provenance in short metadata or disclosures, not repeated technical paragraphs.

### Profile

Identity → address/home → connected services → notification settings → sign-out/account actions. Avoid a new large “hero” treatment in each section.

## 5. Exact animation recipes

### Shared timing, easing and safety

These are **target design values**, not existing behavior or measured performance promises.

- `standard = cubic-bezier(0.20, 0, 0, 1)`.
- `enter = cubic-bezier(0.16, 1, 0.30, 1)`.
- `exit = cubic-bezier(0.40, 0, 1, 1)`.
- `linear = cubic-bezier(0, 0, 1, 1)`.
- `settleSpring = stiffness 320, damping 32, mass 0.8, overshootClamping true`; settle based on physical values, not an invented exact spring duration.
- Reduced motion: remove translate/scale/rotation/path drawing and all decorative loops. Use immediate state change or 100 ms opacity crossfade, never delay actions.
- Pause loops when app is backgrounded, screen is hidden or element is offscreen. Resume from a stable state; do not replay a whole entrance.
- Animate transform/opacity on the native/UI thread where possible. Do not continuously animate card layout in JS. Layout changes are short, bounded transitions.
- Input follows the finger directly; animations must not introduce pointer lag. Cancel ongoing transitions when the user takes control.
- Haptics respect device settings. Success haptic follows successful save, not the initial tap. One owner per interaction.

| Recipe | Trigger and exact visual behavior | Timing / easing | Haptic and reduced-motion behavior |
| --- | --- | --- | --- |
| **M01 — press** | On press-in, filled button/card scales 1 → 0.985; subtle background state change. Text-only and navigation actions change background only. Return on release/cancel; disabled controls do nothing. | Down 80 ms `standard`; return 140 ms `enter`. | One selection tick on valid activation. Reduced: background change only. |
| **M02 — introduction hero** | On first slide appearance: illustration opacity 0 → 1, y 18 → 0, scale .96 → 1. Headline follows y 10 → 0; description follows y 8 → 0. After settling, optional hero float y 0 → −3 → 0, no rotation, maximum two cycles. | Hero 520 ms `enter`; headline 320 ms after 80 ms; copy 280 ms after 120 ms. Float 2,400 ms per cycle `standard`, starts after 900 ms. | No haptic on automatic entrance. Reduced: whole composition opacity 0 → 1 in 100 ms, no float. |
| **M03 — onboarding next/back** | Outgoing text fades and shifts 12 in navigation direction; incoming text starts 16 opposite. Art crossfades with scale .98 → 1. Progress capsule interpolates width without moving other controls. Keep footer anchored. | Out 120 ms `exit`; incoming 280 ms `enter`, starts after 60 ms; capsule 180 ms `standard`. | One activation tick. Reduced: 100 ms crossfade and instant progress change. |
| **M04 — page drill-in/back** | Drill-in: new page x 24 → 0, opacity 0 → 1; old page stays behind with slight opacity reduction. Back reverses direction. Never slide the bottom navigation away. | Enter 240 ms `enter`, back 200 ms `standard`. | No extra haptic beyond initiating button. Reduced: 100 ms fade. |
| **M05 — bottom navigation** | Selected soft-blue pill moves to target or crossfades between equal-sized slots; icon colour transitions. Page content crossfades, no large horizontal slide between tabs. | Pill 180 ms `standard`; content 140 ms; icon colour 120 ms. | One selection tick on changed tab; no tick on already-selected tab. Reduced: immediate selection, optional 100 ms content fade. |
| **M06 — settings sheet** | Backdrop opacity 0 → .28; sheet y 32 → 0 and opacity 0 → 1. Close reverses. Real drag-to-dismiss tracks gesture directly; cancelled dismissal settles back. Short editors use this one pattern. | Open 280 ms `enter`, close 180 ms `exit`; drag settle `settleSpring`. | Opening uses initiating press haptic only. Reduced: 100 ms fade. Trap focus and restore it to trigger. |
| **M07 — loading/refresh** | First load reserves the final content shape; skeleton opacity .45 → .75 → .45. On real response crossfade skeleton to content. Refresh preserves existing values and adds a small inline spinner/status. | Skeleton 1,200 ms per cycle, at most 3 cycles before settling static; content 180 ms `standard`. No artificial minimum wait. | None. Reduced: static placeholders; 100 ms content fade. Error ends loader immediately. |
| **M08 — card entrance** | Initial meaningful dashboard render only: visible cards opacity 0 → 1, y 8 → 0. Maximum first four cards, 35 ms stagger. Additional cards appear normally as user scrolls. | 220 ms `enter`; total sequence ≤325 ms for four cards. | None. Reduced: immediate content or single 100 ms fade, no stagger. |
| **M09 — save/action state** | Button keeps dimensions; label crossfades to spinner + “Gemmer…”. Success becomes small check + “Gemt” then original label. Error restores actionable state plus inline message. | Label transition 100 ms; success check draw 180 ms; success label lasts 1,200 ms. Network work is not delayed. | One success notification haptic after save; one error feedback on failed user action, not on background retry. Reduced: static check/text. |
| **M10 — inline error/empty state** | Short icon + title + explanatory text + relevant action. Error fades in without shaking entire card. Reserve/reflow message space cleanly; announce it once. | Opacity 120 ms `standard`; measured layout expansion 180 ms if needed. | No repeating haptic. Reduced: immediate layout + 100 ms fade. Empty states stay still. |
| **M11 — chart scrub** | Marker follows finger immediately. Selected halo scales 1 → 1.12 on pickup, returns on release. Tooltip/summary changes to exact selected value with no counting. Release can snap marker to closest data point. | Direct tracking; halo 90/120 ms; release snap ≤100 ms `standard`; optional summary crossfade 60 ms. | One tick on each distinct point, capped at one per 60 ms; never both chart and parent. Reduced: direct marker + instant summary, no halo scale. |
| **M12 — period/tab change** | Selected segment background moves/crossfades; old chart fades out, new chart fades in after data is ready. Preserve plot bounds and card height. Dates change synchronously with selected period. | Selection 160 ms `standard`; chart out 80 ms, in 160 ms. | One selection tick. Reduced: instant segment change, 100 ms chart crossfade. Never interpolate unrelated months' data as if real intermediate values exist. |
| **M13 — widget arrangement** | Long-press 350 ms enters arrangement. Selected card scale 1 → 1.015 with 2-unit outline, no decorative shadow. Neighbor cards move to valid slots; drop settles and saves. Cancel restores original order. | Pickup 120 ms; neighbors/drop `settleSpring`; layout persistence after confirmed drop. | Light impact on pickup, selection tick only when slot changes, light impact on drop. Reduced: no scale, direct slot changes; retain outline. |
| **M14 — disclosure** | Chevron rotates 0 → 180; content height opens from measured 0 → natural height; opacity follows after first 40 ms. Title and first row remain anchored. | Open 220 ms `standard`; close 180 ms; opacity 140 ms. | Activation tick only. Reduced: immediate layout, optional 100 ms fade. Announce expanded/collapsed. |
| **M15 — keyboard/focus** | Focus ring colour changes; focused input scrolls above keyboard with 16-unit breathing space. Buttons stay reachable. Never animate the keyboard itself. | Ring 120 ms; scroll uses OS keyboard timing or 180 ms if no timing supplied. | No focus haptic for every field. Reduced: immediate scroll/reposition. |
| **M16 — suggestions/search** | Reserve results area while searching. New results fade in together; selected row transitions to a confirmed-address row. No cascade that delays tapping. | Results 120 ms; confirmation 180 ms `standard`. | One tick on selection. Reduced: instant list and confirmation. |
| **M17 — external authorization** | Before leaving: button becomes “Åbner…”. On return: checking spinner, then connected state when server confirms. Use a static provider mark rather than a permanently rotating logo. | Crossfade states 120–180 ms; success check M09. | Success haptic only after confirmation. Reduced: static state swaps. No fake progress percentage. |
| **M18 — setup complete** | Check icon draws once; headline fades in; final CTA remains available immediately. Dashboard follows M04/M08 after user continues. | Check 240 ms; text 180 ms after 60 ms; no mandatory hold. | One success haptic. Reduced: static check + 100 ms fade. No confetti. |
| **M19 — seven-day data state** | Seven small calendar marks, filled only for confirmed complete days. On gaining a day, that mark fades from outline to fill; one quiet emphasis on new progress. | Fill 200 ms, optional scale .96 → 1 in 160 ms; no endless bouncing. | None for background updates. Reduced: instant fill. Counter says actual data coverage, not a timed promise. |
| **M20 — negative-price gold** | Negative bar grows downward from fixed zero baseline on first reveal. Gold spark above each negative bar uses a single shared phase: opacity .45 → .85 → .45, y 0 → −1.5 → 0. Small phase offset by index. Selected value retains explicit minus sign. | Initial growth 320 ms `enter`; spark cycle 2,800 ms, offsets max 420 ms; two cycles then static .65. User interaction may restart once. | No haptic for autonomous spark. Reduced: final bar + static gold spark. On updates animate current height → target; do not reset to zero. |
| **M21 — photo preview** | Direction change crossfades only after new photo is decoded; preserve frame size and marker correctness. Fullscreen opens from image bounds when supported; otherwise simple fade. Close restores scroll position. | Photo 180 ms; fullscreen 240 ms `enter`, close 200 ms. | Activation tick only. Reduced: 100 ms fade; pinch/drag remains direct. Never fly a marker between different georeferenced views. |
| **M22 — document operation** | Existing list stays visible during upload. On success new row fades in/y 6 → 0 and receives a quiet check. Opening shows row-local busy state. Progress is determinate only if actual bytes/progress are available. | New row 220 ms `enter`; row-status fade 100 ms. | One success haptic on upload. Reduced: instant insertion + static check. |
| **M23 — destructive confirmation** | Small confirmation dialog with named target; backdrop fades in, dialog scale .98 → 1. After confirmed server deletion, row fades then collapses. Failure retains row. | Dialog 180 ms `enter`; row fade 120 ms then collapse 160 ms. | Warning haptic on confirmed destructive action, not every dialog open. Reduced: fade only and immediate row removal after success. |
| **M24 — switch** | Thumb translates across track; track colour transitions simultaneously. Pending status is adjacent, not a replacement for thumb. Failed persistence returns to original state and announces error. | 160 ms `standard`; rollback 140 ms. | One selection tick; failure feedback once. Reduced: immediate thumb/colour change. |
| **M25 — changing chart number** | Exact incoming value appears immediately. Changed digits make one small vertical settling motion inside a clipped number row; unchanged digits and unit stay still. Incoming digit starts 4 units below when value increases, 4 above when it decreases, then settles at 0. No counting through intermediate values. | 140 ms `enter` for deliberate taps; during continuous scrub use the 60 ms fade-only variant described below. | Reuse M11 selection haptic, never add another. Reduced: immediate exact replacement. |
| **M26 — period summary replacement** | When a new period's data is ready, replace date, total, comparison and cost as one coherent snapshot. Old snapshot fades out; new one fades in with y 4 → 0. Keep chart and summary bound to the same period. | Out 80 ms, in 160 ms `enter`, coordinated with M12. | One period-selection tick only. Reduced: immediate replacement or 100 ms fade. |
| **M27 — background number update** | A real refreshed total/current price replaces the old value using a restrained crossfade. Keep date, basis and units visible. Optional small updated indicator appears once; no rolling animation on every polling response. | Value crossfade 180 ms `standard`; updated indicator fades away after 1,200 ms. Animate only when the displayed rounded value actually changes. | No haptic for background updates. Reduced: immediate replacement. |

### Chart exploration and changing numbers — detailed specification

**Intended feel:** the chart responds directly to the hand while the selected amount settles softly into place. The number is always the exact value of the selected point. Motion provides continuity without making the user wait to read it.

#### 1. Touching or dragging a chart

- On touch, reveal the vertical guide and selected dot/outline with a 90 ms opacity transition. Increase the existing dot halo by 12%, following M11; do not scale the whole chart.
- While dragging, the guide follows the finger directly within plot bounds. The selected data point snaps to the nearest valid bucket. The marker's vertical position uses that bucket's actual value, including zero and negative values.
- The selected bar changes fill/outline in 80 ms. Previous selection returns to its normal colour in the same interval. Gold negative bars retain their gold semantic colour; selection adds an outline/halo rather than turning them blue.
- On each selected bucket change, update date/hour, amount, unit and available cost together. No chart marker may represent one hour while the heading still represents another.
- **Continuous drag:** render the exact new number immediately with a maximum 60 ms opacity settle. Do not roll individual digits repeatedly as the finger crosses many points. Cancel the previous transition when a newer point arrives; never queue animations.
- **Deliberate tap or accessibility step:** use M25's 4-unit digit settle. Only changed digits animate. No overshoot, bounce or sideways shuffle.
- On release, keep the selected point and value visible. Settle the halo back over 120 ms. Do not reset to the latest point or total automatically.
- One selection haptic per changed bucket, throttled to 60 ms maximum frequency. Moving within the same bucket produces no haptic.

#### 2. Number typography and formatting during transitions

- Use tabular numerals where the bundled font/platform supports them. Verify actual rendering; if unsupported, use a stable number container and whole-value crossfade rather than substituting a visibly different font.
- Reserve enough width for the values in the current dataset, including Danish grouping, decimal comma and minus sign. Keep the unit anchored to a stable baseline. Do not reserve a huge empty block for unlikely values outside the displayed dataset.
- Keep decimal precision stable within a view: price 2 decimals, selected consumption up to 2 decimals, summary consumption up to 1 decimal, daily baseline 1 decimal. Preserve greater precision only where needed to avoid showing a meaningful nonzero reading as zero; label it explicitly if required.
- Format with `da-DK`: for example `1.234,56 kWh`, `−0,24 kr./kWh` and `2,4 kWh pr. døgn`. Do not animate punctuation, units or the sign through a false state.
- Crossing zero swaps the sign and number together. Never briefly show a positive amount beside a negative bar. Colour is supplementary; the minus sign stays visible.
- **Missing → available:** fade `—` to the actual value in 120 ms; never count up from zero. **Available → missing:** immediately show `—` and a short missing-data label. Missing data must never animate to `0`.
- If the value's character count changes, hold the container width through the transition, then remeasure after settling. Adjacent labels, icons and buttons must not jump.

#### 3. Day, month, year and all-years changes

1. Immediately show which period the user requested and indicate loading if needed.
2. If keeping the previous graph while loading, visibly retain its old period label and mark it as updating. Alternatively keep only its reserved skeleton layout. Never relabel old measurements as the new period.
3. When the requested data arrives, commit the chart, date range, total and comparisons together using M12/M26.
4. For the **same bucket structure and same meaning**, bars may transition from current to new height over 220 ms `standard`. Keep the y-domain fixed during that transition. Interrupt and retarget if the user selects another period.
5. For a **different granularity, point count or y-domain**, crossfade complete plots over 160 ms. Do not morph unrelated days into months or reshape a line across missing data.
6. Keep zero baseline and negative direction stable. Do not animate every bar from zero each time the period changes.
7. All-years mode keeps every available year visible. Selecting a year animates its selected summary through M25, not the number of displayed bars or the entire card's width.

#### 4. Selected value, total and comparison states

| Interaction | Number behavior | Supporting UI |
| --- | --- | --- |
| Tap a consumption bar | Exact selected kWh + M25, 140 ms | Date and partial-data status switch in the same render; guide appears with M11 |
| Drag through hourly prices | Immediate signed price, fade ≤60 ms | Hour label and cheap/normal/expensive status update together; status text colour may transition over 100 ms |
| Tap a weekday | Selected average + M25, 140 ms | Row highlight fades in over 100 ms; sample count updates with it |
| Drag daily consumption curve | Immediate exact bucket value, fade ≤60 ms | Peak-window shading stays fixed unless the dataset changes; moving the cursor does not move the peak window |
| Choose “Vis total” | Selected amount → period total with M26, 160 ms entrance | Remove point-selection guide over 100 ms; headline explicitly says total |
| Switch day/month/year | Complete snapshot replacement M26 | Period control M12; no stale number under a new date |
| Update comparison percentage | Replace exact percentage with 140 ms fade | Arrow and “mere/mindre” change together; use neutral state for no difference |
| Switch spot/total price mode | Values, colour classification, footer and chart update as one snapshot | M12/M26; do not keep raw thresholds labelled as total-price thresholds |
| Background price refresh/hour rollover | M27 only if displayed value changes | Update hour label and freshness together; no automatic scroll or selection theft |
| Cost arrives after consumption | `Beregner…` → exact cost with 120 ms fade | Retain selected bucket; discard a late cost result for a previously selected bucket |

#### 5. Tooltip and cursor behavior

- Keep the numerical readout in a fixed summary area above the plot whenever possible. Avoid a floating tooltip covering neighbouring bars.
- If a tooltip is necessary, anchor it 12 units above the selected point, clamp it 8 units inside the chart/card boundary and flip below if there is insufficient space above. Do not let its position push the chart layout.
- First appearance: opacity 0 → 1 and y 4 → 0 over 120 ms `enter`. During scrubbing position follows directly; content uses the 60 ms fast variant. Exit only on explicit deselection, over 100 ms.
- Hit testing must use the current rendered chart bounds after scrolling, rotation and font/layout changes. Tooltip animation must not affect hit testing.

#### 6. Technical and accessibility acceptance criteria

- Represent selection as one snapshot: `{datasetId, period, bucketId, label, value, unit, status, cost}`. Reject stale responses using dataset/period identity before starting animations.
- Animate presentation only. Never write interpolated display numbers back into calculations, persisted records, threshold comparisons or screen-reader values.
- Screen readers receive the exact final value with each explicit accessibility selection action. Avoid live announcements for every finger-move frame; announce the final selection on release where appropriate.
- With reduced motion, all figures and selections update immediately, without rolling digits, scaling or position shifts. Preserve the direct finger interaction and readable highlight.
- Acceptance cases: slow drag, rapid drag, direction reversal, repeated tap on same point, zero crossing, large/small value transition, null gaps, Danish formatting, font scaling, period change during pending request and background refresh while a historical point is selected.
- Performance target: smooth interaction at the device's normal refresh rate, with no visible cursor lag or delayed number queue. Measure on the physical phone; do not infer it from desktop animation.

### Explicitly static elements

Body text, data provenance, tariff notes, company names, page backgrounds, settled metrics, all normal card boundaries and empty-state illustrations remain static. Do not animate totals from zero: users must be able to read the actual number immediately. Do not repeatedly replay chart entrances while scrubbing, switching tabs or refreshing.

### Beginning-to-end introduction choreography

| Time from slide appearance | Element |
| --- | --- |
| 0 ms | Layout, footer and progress are already present and interactive; hero reveal begins |
| 80 ms | Headline reveal begins |
| 120 ms | Supporting copy reveal begins |
| 400 ms | Text is fully readable |
| 520 ms | Hero reveal completes |
| 900 ms | Optional two-cycle, 3-unit float begins on marketing slide only |
| Any tap | Cancel remaining entrance work as necessary and respond immediately |
| Keyboard opening / background / reduced motion | Stop all decorative motion |

The “wow” moment is the illustration arriving with a clear message and a responsive next action. It should not turn account setup into a slow animated presentation.

## 6. Implementation sequence

1. **Trust and release flow:** O01/O02, N05 and E13. Correct onboarding gating, status-bar contrast, real loading copy and price-threshold basis.
2. **Shared foundations:** F01–F10. Finalize tokens and shared text/button/sheet/state components; migrate active surfaces before polishing isolated screens.
3. **Dashboard and El:** N06–N10, E01–E19. Resolve card sizing, selection truth, gestures and explanatory hierarchy.
4. **Property, heating, waste and Profile:** H01–H12 and P01–P10. Reuse shared components rather than adding another style vocabulary.
5. **Motion:** M01/M04/M05/M06/M07/M09/M11 first; expressive introduction/photo/gold recipes after the core interaction states are solid.
6. **Device sign-off:** section 7. Review actual packaged source and screenshots. Mark each issue fixed only when its criterion is met.

Keep tasks small: one component family per change, screenshots before/after at the same viewport, then the affected phone flow. A spacing change does not need a new backend test suite.

## 7. Visual and interaction acceptance matrix

### Required viewports and states

| Dimension | Cases |
| --- | --- |
| Phone widths | 320, 360, 390, 430 logical units |
| Height | Short phone, normal phone, landscape keyboard case |
| Larger screen | 768-width and 1280-width layout, centred max-width column |
| System font | 100%, 130%, 200%; no essential text clipping |
| Motion | Normal, reduced motion, app background/foreground, screen switched while loop active |
| Connectivity | Initial loading, cached real data, refresh, offline, provider failure, retry success |
| Accounts | First run, configured returning account, no provider connection, incomplete history, multiple household/address |
| Data | Zero vs missing, partial year, long company name, negative price, all-negative day, DST 23/25-hour day, long document filename |
| Interaction | Tap, long press, horizontal chart scrub, vertical page scroll, screen-reader adjust, Android back, keyboard dismissal |

### Screen-by-screen sign-off checklist

- [ ] Introduction: dark status icons on light canvas; clear skip/next; no clipped footer; no repeated onboarding for configured account.
- [ ] Address/setup: suggestions visible above keyboard; selected address readable; authorization return state truthful.
- [ ] Login/recovery: input labels, errors and primary action visible; no technical wall of text as default.
- [ ] Dashboard: aligned card edges, no excess fixed-height blank space, settings icons correctly placed, user ordering preserved.
- [ ] Spot price: all bars visible, signed gold negatives, legible company/area/basis, limits agree with mode, no continuous offscreen animation.
- [ ] Usage: selected bar and headline agree; all available years side-by-side; incomplete periods labelled; no gesture/scroll conflict.
- [ ] Patterns/baseline: kWh per day, restrained explanations, midnight-boundary highlight correct, weekday values readable.
- [ ] Cheap hours: unavailable vs insufficient-data distinguished; no misleading countdown; explanation accessible.
- [ ] Elaftale/meter: keyboard-safe editing; no clipped identifiers; saved state clear.
- [ ] Property: all tabs discoverable, long address wraps, cached content remains steady, title sizes consistent across tabs.
- [ ] Photos/roof/parcel: no invented precision; short labels; safe close/retry; image marker remains aligned.
- [ ] Floorplans: upload/open/delete states clear, actual file retained on failure, visible destructive confirmation.
- [ ] Heating: same period controls/card geometry as El; temperatures and units readable.
- [ ] Waste: real upcoming date prominent; correct no-events/missing-address/error state.
- [ ] Profile: readable labels, stable switches, safe sheet/keyboard behavior, clear save result.
- [ ] Every active screen: 48-unit action targets where feasible, labelled icons, adequate contrast, large-text layout, reduced-motion behavior.

### Definition of finished

A professional design pass is finished when the issue register has explicit fixed/deferred decisions, active screens share the contract, real data and failure states have been viewed, and the **installed APK** passes the relevant visual checks. A successful build, token migration or attractive introduction alone does not establish that the full app looks clean.

## 8. Work intentionally outside this document

No new screens are requested here. Do not activate paused AI/3D/car/device features, buy illustration licences, switch icon libraries, change data providers or alter electricity calculations beyond the separately identified price-mode/threshold inconsistency without a concrete implementation task. This audit itself changes documentation only and requires no APK rebuild.

## 9. Implementation and verification — 24 October 2026

The user subsequently authorized implementation. The documentation-only boundary in section 8 described the original audit request; this section records the resulting app changes. The original findings remain a baseline register, **not a claim that all 81 acceptance criteria have been signed off**.

### Delivered source changes

| Area | Implemented change |
| --- | --- |
| Spot-price spacing | Replaced tiny footer text with a 12/18 two-row footer, explicit pricing basis and company/area. Fixed cards measure their actual content instead of forcing every price chart into a fixed grid height. Moved the dashboard's extra widget-management row into the main header. |
| Native consumption sizing | Removed the flex constraint that made Android measure the consumption widget too short. Its full title, period controls, summary, chart and estimate footer now determine its grid height. |
| Typography and geometry | Shared `AppText`, card tokens, 20-unit padding, 16-unit outer gaps, standard headings/supporting copy, consistent form labels, larger controls, and a centred 760 maximum-width page container. Applied across the active electricity, property, heating, waste, login/setup and Profile surfaces. |
| Interaction foundations | Shared animated/haptic press control, `ActionButton`, `AppModal`, `InlineStatus`, `LoadingState`, `Disclosure`, `ConfirmDialog`, `SettingSwitch` and a shared reduced-motion/background subscription. Existing gesture handlers keep ownership of chart/drag feedback. |
| Numbers and motion | `AnimatedMetric` renders the exact incoming value immediately, settles changed digits with opacity for deliberate updates, and uses a short whole-value fade while scrubbing. No intermediate numbers enter calculations or storage. Page/sheet/fade variants and finite loading/illustration/gold animations replace several unrelated effects. Native modal exit behavior remains platform-owned. |
| Chart correctness | No visually selected first bar while showing a whole-period total; accessible values include kWh; removed duplicate selection haptic; bounded late-evening peak shading; propagated scrub ownership to the El page; improved hour-axis placement outside narrow bar slots. |
| Price basis and contrast | Preserved saved thresholds as **total-price thresholds**, including when displaying raw spot prices. The label explicitly states this basis. Graph colours compare against the total value. Gold remains a negative-price treatment with explicit signed values. Normal bar colours were strengthened after contrast measurement. |
| Introduction and navigation | Forced onboarding preview disabled; dark status-bar foreground applied globally and in introduction; finite, smaller illustration float restricted to marketing slides; task CTAs have text and step labels. Category/property naming and El description updated; paused features remain paused. |
| Property and documents | Consistent fact-card typography, readable parcel loading/error state, less redundant overview copy, visible property-tab scrollbar, safe-area photo viewer, operation-specific upload/open/delete feedback, named-file destructive confirmation, and full-screen image preview with bounded two-finger zoom/pan. |
| Profile/heating/waste | Animated switch with adjacent pending state; notification editor made keyboard-scrollable; controlled save feedback; heating customer detail moved below consumption; valid empty waste calendar distinguished from missing address/error. |

### Completed checks

- Main-source and isolated-APK TypeScript checks pass.
- Actual React Native Web price widget checked at 320, 390 and 768 logical widths using the bundled Nunito fonts: footer stays inside its card, no oversized footer gap, settings remain usable, no runtime errors in the fixture.
- Actual daily-curve component: fixed curve, three-hour peak, pointer scrubbing, selection haptics and mobile width check pass.
- Actual property page with synthetic API/file picker: five tabs, overview, roof estimate, parcel, upload, image preview, reload and confirmed deletion pass. This does not exercise real customer document writes.
- All 52 reviewed packaged UI sources match the isolated stage. Embedded production API URL, APK version and signature verified.
- 1.0.114/code 115 installed with `adb install -r` and launched on the existing Samsung; app data retained. 1.0.113 was an intermediate phone check and is superseded.
- Native 1.0.114 capture confirms complete consumption-card content, consistent title sizing, readable price footer/company/area and dark status icons. Evidence: `.tmp/design-native-final-dashboard.png`. The preceding phone check also confirmed entry into the authenticated app without forced introduction.

Artifact: `dist/Stromblik-1.0.114.apk`, 86,137,383 bytes. SHA256: `0EB040D2ABCEE9674967D68694E55EAD8157F29C10B633E43289054027448735`. Existing test/debug signing certificate and production API target retained. No backend deployment, database/schema change, commit or push in this pass.

### Remaining sign-off and exact-spec boundaries

The section 7 matrix remains open until tested: all screens at 130%/200% system text, TalkBack/VoiceOver, keyboard/rotation combinations, all-negative and DST price days on the physical phone, provider-authorization return and native file dialogs. The inspected phone captures do not establish every one of those cases.

The implementation deliberately uses digit opacity settling rather than a rolling odometer, native modal exits rather than custom native dismissal choreography, and a fade fallback for photo expansion. The full timing/choreography table remains the design target for subsequent refinement; **do not mark every motion recipe or every audit issue complete solely because the shared primitives and this APK exist**.
