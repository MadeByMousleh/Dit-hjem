# SONFOR water via KMD MinForsyning

Research checkpoint: 2026-10-04. No real account login, token import, water-data request, deployment or credential/configuration change performed.

## Confirmed references

- SONFOR links water/other billing accounts to KMD MinForsyning and heat to eForsyning: https://sonfor.dk/selvbetjening/ and https://sonfor.dk/selvbetjening/regning/.
- The user-provided authorization URL targets KMD Easy Energy Identity, requests `openid profile pluginapi_int`, uses authorization code with PKCE S256 and redirects to `https://minforsyning-2.kmd.dk/login`. Utility selector: `0648000`. This selector comes from the supplied URL; its account/data relationship has not been independently verified.
- Reference integration: https://github.com/kpoppel/homeassistant-novafos. Its documentation describes user-mediated browser login followed by importing a bearer access token. Automated password login was affected by reCAPTCHA.
- Its example response has `expires_in: 3599` and no refresh token. That is evidence about the documented example, not a guarantee about SONFOR's current token response.
- Reference browser extension: https://github.com/kpoppel/homeassistant-novafos-chrome-addon. It targets Home Assistant, not Strømblik; compatibility and permissions must be reviewed before adapting it.

## Connection design

Use user-mediated provider login. Keep authentication at KMD; do not automate reCAPTCHA or forward the user's password through our backend.

An ordinary Strømblik browser tab cannot read another origin's login response. Opening MinForsyning alone does not give our app its token. The existing portal's client and redirect URI cannot simply be changed to huslyg.dk. A direct OAuth flow needs a KMD-approved client/redirect registration, or an explicitly user-controlled token transfer mechanism.

First verification increment: user logs into the official portal, then imports an access token locally into a dedicated connection interface. Never ask for tokens in chat. Before implementing data fetching, establish the fixed API host, provider account/installation enumeration, water capability, units and browser CORS behavior from the provider/reference implementation. Do not send tokens to an inferred or user-supplied host.

Token connection states must distinguish disconnected, valid, expired and provider unavailable. Do not treat an unverified JWT payload as proof of authentication. Provider responses are authoritative. Do not persist credentials or tokens in plaintext AsyncStorage/localStorage, source files or public Expo environment variables.

## Retaining the connection

Access-token storage does not extend token lifetime. If an approved flow issues a refresh token, validate renewal support and securely store it per user and household; respect rotation, expiry and revocation. A refresh failure requires reconnection. Without refresh support, ask the user to log in again when the access token expires. Never promise permanent login or extend a token by altering its expiry.

## Water history

Store imported household water readings separately from `heatingWaterM3`, which is heat-loop water. Follow the existing encrypted vault and signed-write contract, reviewed before implementation. Keep imported history readable when credentials expire. Missing readings remain missing; do not infer zero use or leak alarms from unavailable data. Hour/day/month/year resolution depends on actual provider data, not on reference-repository claims alone.

## Outstanding verification

1. Determine SONFOR's actual API/account/installation response and whether the user has drinking-water meter data or only wastewater billing.
2. Confirm the supported token-transfer/login route; a direct callback needs provider registration.
3. Verify actual token expiry, scope and any permitted renewal mechanism.
4. Implement token UI, fixed-host client, isolated credential handling and encrypted history; test with synthetic data first.
5. Test a user-controlled real login/import without exposing tokens in logs/chat. Report browser and native behavior separately.

The `.env` email/password names proposed in chat are not used or needed for this user-mediated design. Existing environment files were not read or changed during research.
