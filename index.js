export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Opcional: endpoint simples para validar se o Worker está vivo
    if (url.pathname === "/__worker_health") {
      return json(
        {
          ok: true,
          worker: "up",
          target: env.TARGET_BASE_URL,
        },
        200
      );
    }

    // Monte a URL de destino preservando path + querystring
    const targetUrl = new URL(url.pathname + url.search, env.TARGET_BASE_URL);

    // Copia os headers recebidos
    const headers = new Headers(request.headers);

    // Injeta o Bearer token que o n8n-mcp espera
    headers.set("Authorization", `Bearer ${env.MCP_BEARER_TOKEN}`);

    // Ajusta Host para evitar problemas em alguns origins
    headers.delete("Host");

    // Repassa a requisição
    const upstreamRequest = new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    });

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(upstreamRequest);
    } catch (error) {
      return json(
        {
          ok: false,
          error: "upstream_unreachable",
          message: String(error),
          target: targetUrl.toString(),
        },
        502
      );
    }

    // Copia a resposta do origin
    const responseHeaders = new Headers(upstreamResponse.headers);

    // CORS opcional para facilitar testes no navegador
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS"
    );
    responseHeaders.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Accept, Mcp-Session-Id, Last-Event-ID"
    );

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers":
        "Authorization, Content-Type, Accept, Mcp-Session-Id, Last-Event-ID",
    },
  });
}