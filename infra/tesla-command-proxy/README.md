# Tesla Vehicle Command Proxy

This stack runs Tesla's official `tesla-http-proxy` behind Caddy. Caddy provides the public TLS certificate; it forwards over TLS to the official proxy inside the Docker network.

Caddy requires a random `X-Tesla-Proxy-Secret` header before forwarding any request. Store the matching value only as `TESLA_COMMAND_PROXY_SHARED_SECRET` in the Vercel server environment; it must never be part of the mobile app configuration.

The only files expected in `secrets/` on the host are:

- `tesla-private-key.pem`: the P-256 private key matching the public key registered with Tesla and hosted by the application domain.
- `internal-tls-key.pem` and `internal-tls-cert.pem`: an internal, self-signed certificate pair for the official proxy.

Never commit `secrets/` or copy the private key to Vercel, Supabase, the app, logs, or chat. The Vercel backend sends a user's decrypted short-lived Tesla access token to this proxy; it does not expose the proxy URL to clients.
