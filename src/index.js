const UPSTREAMS = {
  quad9: "https://dns.quad9.net/dns-query",
  cloudflare: "https://cloudflare-dns.com/dns-query",
  mullvad: "https://dns.mullvad.net/dns-query",
  "mullvad-base": "https://base.dns.mullvad.net/dns-query",
  "mullvad-adblock": "https://adblock.dns.mullvad.net/dns-query",
  "controld-p0": "https://freedns.controld.com/p0",
  "controld-p1": "https://freedns.controld.com/p1",
  "controld-p2": "https://freedns.controld.com/p2",
};

const DEFAULT_UPSTREAM = "quad9";
const MAX_BODY_SIZE = 4096;

function getClientToken(requestUrl, request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  const headerToken = request.headers.get("x-doh-token");
  if (headerToken) {
    return headerToken.trim();
  }

  return requestUrl.searchParams.get("token") || "";
}

function getAllowedTokens(env) {
  const raw = env.DOH_TOKENS || env.DOH_TOKEN || "";
  return raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function unauthorized() {
  return new Response("Unauthorized\n", {
    status: 401,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "www-authenticate": "Bearer",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok\n", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname !== "/dns-query") {
      return new Response("Not Found\n", { status: 404 });
    }

    const allowedTokens = getAllowedTokens(env);
    if (allowedTokens.length === 0) {
      return new Response("Server token is not configured\n", { status: 500 });
    }

    const clientToken = getClientToken(url, request);
    if (!clientToken || !allowedTokens.includes(clientToken)) {
      return unauthorized();
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return new Response("Method Not Allowed\n", {
        status: 405,
        headers: { allow: "GET, POST" },
      });
    }

    const upstreamName = url.searchParams.get("upstream") || DEFAULT_UPSTREAM;
    const upstreamBase = UPSTREAMS[upstreamName];

    if (!upstreamBase) {
      return new Response("Unknown upstream\n", { status: 400 });
    }

    const upstreamUrl = new URL(upstreamBase);

    if (request.method === "GET") {
      const dns = url.searchParams.get("dns");
      if (!dns) {
        return new Response("Missing dns parameter\n", { status: 400 });
      }
      upstreamUrl.searchParams.set("dns", dns);
    }

    const headers = new Headers();
    headers.set("accept", "application/dns-message");

    let body = null;

    if (request.method === "POST") {
      const contentType = request.headers.get("content-type") || "";
      if (!contentType.includes("application/dns-message")) {
        return new Response("Unsupported Media Type\n", { status: 415 });
      }

      const contentLength = Number(request.headers.get("content-length") || "0");
      if (contentLength > MAX_BODY_SIZE) {
        return new Response("Payload Too Large\n", { status: 413 });
      }

      body = request.body;
      headers.set("content-type", "application/dns-message");
    }

    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers,
      body,
      redirect: "follow",
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set("cache-control", "no-store");
    responseHeaders.set("x-doh-upstream", upstreamName);
    responseHeaders.delete("server");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  },
};
