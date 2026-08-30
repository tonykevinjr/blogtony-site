const allowedMethods = "GET, POST, OPTIONS";

function corsHeaders(origin, allowedOrigin) {
  return {
    "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
    "Access-Control-Allow-Methods": allowedMethods,
    "Access-Control-Allow-Headers": "Content-Type, CF-Turnstile-Token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(data, status, origin, env) {
  return Response.json(data, {
    status,
    headers: corsHeaders(origin, env.ALLOWED_ORIGIN)
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";

    if (request.method === "OPTIONS") {
      if (origin !== env.ALLOWED_ORIGIN) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env.ALLOWED_ORIGIN)
      });
    }

    if (origin && origin !== env.ALLOWED_ORIGIN) {
      return json({ error: "Origin not allowed." }, 403, origin, env);
    }

    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      const databaseCheck = await env.COMMENTS_DB.prepare("SELECT 1 AS ok").first();
      return json({ ok: databaseCheck?.ok === 1 }, 200, origin, env);
    }

    return json({ error: "Not found." }, 404, origin, env);
  }
};
