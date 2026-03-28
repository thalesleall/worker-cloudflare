export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (url.pathname === "/__worker_health") {
      return Response.json(
        {
          ok: true,
          hasTarget: !!env.TARGET_BASE_URL,
          hasToken: !!env.MCP_BEARER_TOKEN,
          tokenLength: env.MCP_BEARER_TOKEN ? env.MCP_BEARER_TOKEN.length : 0,
        },
        { headers: corsHeaders() }
      );
    }

    const targetUrl = new URL(url.pathname + url.search, env.TARGET_BASE_URL);

    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${env.MCP_BEARER_TOKEN}`);
    headers.delete("host");

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }

    const upstream = await fetch(targetUrl.toString(), init);

    const outHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders())) {
      outHeaders.set(k, v);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Accept, Mcp-Session-Id, Last-Event-ID",
    "Access-Control-Expose-Headers": "Mcp-Session-Id",
    "Access-Control-Max-Age": "86400",
  };
}