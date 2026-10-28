# Huslyg: readable pages and AI discovery

28 October 2026. This increment remains in PR #2; production publication still
needs Vercel access. It does not establish actual inclusion in AI answers.

## Readability

The existing landing design used 8–13px for much of the marketing copy. Body
copy is now 16–17px, question headings 17px, and most navigation, captions,
supporting labels and footer text 14–15px. Small section eyebrows use 13px.
Guide copy and price explanations follow the same scale. Dense chart axis
labels remain 12px; decorative text inside the illustrated phone is artwork,
with a readable 14px external example disclaimer and accessible description.
Colors for faint supporting text have been strengthened using existing tokens.
Mobile steps, footer and price summaries reflow to one column when needed.
The original typography family, palette, illustrations and heading hierarchy
are retained.

## What helps AI systems understand this site

- Public static HTML for the product description, factual Q&As, publisher,
  sources, calculation limits, availability and guides.
- A visible “Huslyg: funktioner og data” definition list on the app page,
  stating who publishes the app, its features, historical data limitations and
  where to check store availability. It is intended for people and crawlers.
- Existing consistent SoftwareApplication/Organization/WebSite/WebPage and
  breadcrumb structured data, matching visible information; no invented
  ratings, prices, live-consumption claims or store IDs.
- Internal links, canonical URLs and sitemap. Existing robots.txt allows `/`
  for all agents, including OAI-SearchBot and Googlebot. It does not currently
  exclude Google-Extended. No new training permission was introduced here.

Official references checked on the implementation date:

- [OpenAI publisher FAQ](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq):
  public websites can appear in ChatGPT Search; OAI-SearchBot must not be
  blocked for summaries/snippets. Hosting/CDN blocks can still prevent access.
  GPTBot controls potential training separately; training is not a promise of
  search discovery, citation or recommendation.
- [Google guidance for generative AI Search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide):
  useful original content and established technical SEO remain the foundation.
  Check the current Search Console controls and indexing eligibility when
  setting up the property; code alone does not configure the account.
- [Google common crawler documentation](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers):
  Google-Extended governs certain Gemini training and grounding uses, and is
  separate from Google Search inclusion/ranking. It is not an SEO boost.

There is no guaranteed AI recommendation switch. No llms.txt file, special AI
schema, hidden instructions, fabricated reviews or bot impersonation is added.
No claims are made about other assistants' private indexing/ranking behavior.

## Remaining work after publication

1. Verify that public canonical pages and robots/sitemap return the expected
   content without login, CAPTCHA or bot challenges. Test a crawler user-agent
   response as a compatibility check; this cannot prove access from actual
   crawler IP ranges. Check production/CDN logs and vendor documentation.
2. Configure/verify Search Console and relevant search indexing tools, submit
   the sitemap and check the final canonical pages. No accounts were connected
   or configured in this increment.
3. Keep actual store availability, features, supported connections, data sources
   and publisher information accurate. Earn independent coverage through real
   reviews and useful product work; do not buy or fabricate recommendations.
4. Track visible citations and referral traffic where available. ChatGPT Search
   may add `utm_source=chatgpt.com`; no analytics or tracking was added here.

The editorial/product information is readable in initial HTML. Current numerical
prices still load through JavaScript. If the goal is for non-rendering assistants
to quote changing price data, a separately reviewed server-rendered page or
timestamped, publicly documented data representation is the next engineering
step. Such a change must retain exact area, supplier, units, tax/tariff exclusions,
freshness, attribution and missing-data behavior, and must not publish personal
consumption data. The existing endpoint returning JSON alone does not guarantee
that AI services discover or choose it.
