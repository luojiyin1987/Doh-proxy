# Doh-proxy

Cloudflare Worker based DNS-over-HTTPS proxy.

It forwards DoH requests to selected upstream resolvers, including Quad9, Mullvad, Control D, and Cloudflare.

## Why

Some networks poison or hijack plain DNS traffic. This project provides a personal DoH endpoint over HTTPS port 443, reducing the chance of local DNS manipulation.

This is not a VPN. It only protects DNS resolution. Your SNI, target IP, and application traffic may still be visible depending on the protocol and network.

## Endpoints

- `/dns-query` - default upstream: Quad9
- `/dns-query?upstream=quad9`
- `/dns-query?upstream=cloudflare`
- `/dns-query?upstream=mullvad`
- `/dns-query?upstream=mullvad-base`
- `/dns-query?upstream=mullvad-adblock`
- `/dns-query?upstream=controld-p0`
- `/dns-query?upstream=controld-p1`
- `/dns-query?upstream=controld-p2`
- `/health`

## Token protection

The Worker requires a token for `/dns-query`.

Supported client token locations:

```text
Authorization: Bearer YOUR_TOKEN
```

```text
x-doh-token: YOUR_TOKEN
```

```text
https://your-worker.example.workers.dev/dns-query?token=YOUR_TOKEN
```

For normal DoH clients, the query parameter is usually the easiest method.

## Configure token

Use a Cloudflare Worker secret named `DOH_TOKEN`:

```bash
npx wrangler secret put DOH_TOKEN
```

You can also allow multiple tokens during rotation by setting `DOH_TOKENS` to a comma-separated list:

```bash
npx wrangler secret put DOH_TOKENS
```

Example value:

```text
old-token,new-token
```

Recommended rotation process:

1. Set `DOH_TOKENS` to `old-token,new-token`.
2. Update your devices to use `new-token`.
3. Set `DOH_TOKENS` to `new-token` only.

If both `DOH_TOKENS` and `DOH_TOKEN` are set, `DOH_TOKENS` is used first.

## Deploy

```bash
npm install
npx wrangler login
npm run deploy
```

## Example URLs

```text
https://your-worker.example.workers.dev/dns-query?token=YOUR_TOKEN
```

```text
https://your-worker.example.workers.dev/dns-query?upstream=cloudflare&token=YOUR_TOKEN
```

```text
https://your-worker.example.workers.dev/dns-query?upstream=mullvad-base&token=YOUR_TOKEN
```

## Security notes

Do not publish your token.

Avoid running this as a public open resolver. Public open DoH proxies can be abused and may create unwanted traffic or cost.

If possible, add Cloudflare WAF rules, rate limits, or custom-domain access restrictions in front of this Worker.
