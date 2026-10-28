# Electricity card layout

2026-10-24: `src/styles/cards.ts` supplies the shared card spacing and typography used by electricity usage, month summary, baseline, patterns, cheap-hour share, agreement, meter details, home electricity and spot-price cards. Standard card padding is 20, radius 24, outside spacing 16. Titles are Nunito Bold 18/24, body 14/20, supporting text 12/18 and primary totals 32/40. Cards inside the patterns group use the group's 16 gap instead of adding another margin.

The El page orders the month summary, usage chart, patterns/baseline, cheap-hour share, optional extra widgets, agreement, meter details and widget management. Spot prices remain on the dashboard; existing price shortcuts now stay there. The El widget catalogue does not offer redundant price/month/usage-chart pins; saved pins are retained and filtered for this page rather than deleted. Dashboard pins remain unchanged.

No import, storage, pricing or provider logic changes. The isolated APK keeps its existing history importer; no new technical import-status panel is introduced on this page.
