const MAX_NAME_LENGTH = 60;
const MAX_COMMENT_LENGTH = 2000;
const MAX_REPLY_DEPTH = 4;
const POST_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/;

function widgetPage(postSlug, sitekey) {
  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comments</title>
  <link rel="stylesheet" href="https://tonykevin.neocities.org/style/style.css">
  <style>html,body{margin:0;padding:0;background:transparent!important;background-image:none!important}.comment-section{margin-top:0}</style>
  <script src="https://tonykevin.neocities.org/scripts/comments.js" defer></script>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onCommentsTurnstileLoad&render=explicit" defer></script>
  </head><body><section class="comment-section" data-comments-api="" data-post-slug="${postSlug}">
  <h2>Comments</h2><form class="comment-form">
  <div class="comment-reply-context" hidden>Replying to <strong class="comment-reply-name"></strong> <button type="button" class="comment-cancel-reply">Cancel reply</button></div>
  <input type="hidden" name="parentId" value="">
  <label class="comment-field"><span>Name</span><input type="text" name="name" maxlength="60" autocomplete="name" required></label>
  <label class="comment-anonymous-option"><input type="checkbox" name="anonymous"><span>Post anonymously</span></label>
  <label class="comment-field"><span>Comment</span><textarea name="body" rows="5" maxlength="2000" required></textarea></label>
  <div class="comment-turnstile" data-production-sitekey="${sitekey}" data-development-sitekey="1x00000000000000000000AA"></div>
  <button type="submit" class="comment-submit">Post comment</button><p class="comment-form-status" role="status" aria-live="polite"></p>
  </form><p class="comments-loading" role="status">Loading comments...</p><div class="comment-list" aria-live="polite"></div>
  </section></body></html>`;
}

function configuredOrigins(env) {
  return new Set(String(env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean));
}

function isLocalDevelopmentOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin, env) {
  return configuredOrigins(env).has(origin) || isLocalDevelopmentOrigin(origin);
}

function corsHeaders(origin, env) {
  const origins = configuredOrigins(env);
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin, env) ? origin : [...origins][0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, CF-Turnstile-Token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(data, status, origin, env) {
  return Response.json(data, { status, headers: { ...corsHeaders(origin, env), "Cache-Control": "no-store" } });
}

function cleanSingleLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanComment(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim();
}

async function visitorHash(request, env) {
  if (!env.VISITOR_SALT) throw new Error("VISITOR_SALT is not configured.");
  const address = request.headers.get("CF-Connecting-IP") ?? "local";
  const userAgent = request.headers.get("User-Agent") ?? "unknown";
  const input = new TextEncoder().encode(`${env.VISITOR_SALT}|${address}|${userAgent}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function parseJson(request) {
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function verifyTurnstile(request, env, token, origin) {
  const isDevelopment = origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  const secret = isDevelopment ? "1x0000000000000000000000000000000AA" : env.TURNSTILE_SECRET;
  if (!secret || !token) return false;

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  const address = request.headers.get("CF-Connecting-IP");
  if (address) formData.append("remoteip", address);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData
  });
  if (!response.ok) return false;

  const result = await response.json();
  return result.success === true;
}

async function getComment(env, commentId) {
  return env.COMMENTS_DB.prepare(
    "SELECT id, post_slug, parent_id, status FROM comments WHERE id = ?"
  ).bind(commentId).first();
}

async function replyDepth(env, comment) {
  let depth = 1;
  let current = comment;
  while (current?.parent_id != null) {
    depth += 1;
    if (depth > MAX_REPLY_DEPTH) return depth;
    current = await getComment(env, current.parent_id);
    if (!current) return MAX_REPLY_DEPTH + 1;
  }
  return depth;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

async function sendCommentNotification(env, comment, postSlug) {
  if (!env.RESEND_API_KEY || !env.NOTIFICATION_EMAIL) {
    console.error("Comment notification secrets are not configured.");
    return;
  }

  const postUrl = `${env.SITE_ORIGIN}/posts/${encodeURIComponent(postSlug)}.html`;
  const replyNote = comment.parent_id == null ? "Top-level comment" : `Reply to comment #${comment.parent_id}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "BlogTony Comments <onboarding@resend.dev>",
      to: [env.NOTIFICATION_EMAIL],
      subject: `New comment from ${comment.display_name}`,
      text: [
        `New comment on ${postUrl}`,
        replyNote,
        `Comment ID: ${comment.id}`,
        `Name: ${comment.display_name}`,
        "",
        "Comment:",
        comment.body
      ].join("\n"),
      html: `
        <h1>New BlogTony comment</h1>
        <p><strong>Post:</strong> <a href="${escapeHtml(postUrl)}">${escapeHtml(postSlug)}</a></p>
        <p><strong>Comment ID:</strong> ${comment.id}<br>
        <strong>Type:</strong> ${escapeHtml(replyNote)}<br>
        <strong>Name:</strong> ${escapeHtml(comment.display_name)}</p>
        <h2 style="font-size:18px">Comment</h2>
        <blockquote style="margin:0;padding:12px 16px;border-left:4px solid #01e04f;background:#f3f3f3;white-space:pre-wrap;color:#17151d">${escapeHtml(comment.body)}</blockquote>
      `
    })
  });

  if (!response.ok) {
    throw new Error(`Resend notification failed (${response.status}): ${await response.text()}`);
  }
}

async function listComments(request, env, origin, url) {
  const postSlug = cleanSingleLine(url.searchParams.get("post"));
  if (!POST_SLUG_PATTERN.test(postSlug)) return json({ error: "A valid post is required." }, 400, origin, env);

  const viewer = await visitorHash(request, env);
  const result = await env.COMMENTS_DB.prepare(`
    SELECT c.id, c.parent_id, c.display_name, c.body, c.created_at,
      (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id) AS like_count,
      EXISTS(SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.visitor_hash = ?) AS viewer_liked
    FROM comments c
    WHERE c.post_slug = ? AND c.status = 'visible'
    ORDER BY c.created_at ASC, c.id ASC
  `).bind(viewer, postSlug).all();

  return json({ comments: result.results ?? [] }, 200, origin, env);
}

async function createComment(request, env, origin, context) {
  const payload = await parseJson(request);
  if (!payload) return json({ error: "Send the comment as JSON." }, 400, origin, env);

  const postSlug = cleanSingleLine(payload.postSlug);
  const body = cleanComment(payload.body);
  const displayName = payload.anonymous === true ? "Anonymous" : cleanSingleLine(payload.name);
  const parentId = payload.parentId == null ? null : Number(payload.parentId);

  if (!await verifyTurnstile(request, env, payload.turnstileToken, origin)) {
    return json({ error: "Please complete the anti-spam check and try again." }, 403, origin, env);
  }

  if (!POST_SLUG_PATTERN.test(postSlug)) return json({ error: "A valid post is required." }, 400, origin, env);
  if (!displayName || displayName.length > MAX_NAME_LENGTH) {
    return json({ error: `Names must be between 1 and ${MAX_NAME_LENGTH} characters.` }, 400, origin, env);
  }
  if (!body || body.length > MAX_COMMENT_LENGTH) {
    return json({ error: `Comments must be between 1 and ${MAX_COMMENT_LENGTH} characters.` }, 400, origin, env);
  }
  if (parentId != null && (!Number.isSafeInteger(parentId) || parentId < 1)) {
    return json({ error: "That reply target is invalid." }, 400, origin, env);
  }

  if (parentId != null) {
    const parent = await getComment(env, parentId);
    if (!parent || parent.status !== "visible" || parent.post_slug !== postSlug) {
      return json({ error: "That comment is no longer available for replies." }, 404, origin, env);
    }
    if (await replyDepth(env, parent) >= MAX_REPLY_DEPTH) {
      return json({ error: `Replies are limited to ${MAX_REPLY_DEPTH} levels.` }, 400, origin, env);
    }
  }

  const result = await env.COMMENTS_DB.prepare(`
    INSERT INTO comments (post_slug, parent_id, display_name, body)
    VALUES (?, ?, ?, ?)
    RETURNING id, parent_id, display_name, body, created_at
  `).bind(postSlug, parentId, displayName, body).first();

  context.waitUntil(
    sendCommentNotification(env, result, postSlug).catch((error) => console.error(error))
  );

  return json({ comment: { ...result, like_count: 0, viewer_liked: 0 } }, 201, origin, env);
}

async function toggleLike(request, env, origin, commentId) {
  const comment = await getComment(env, commentId);
  if (!comment || comment.status !== "visible") return json({ error: "Comment not found." }, 404, origin, env);

  const viewer = await visitorHash(request, env);
  const existing = await env.COMMENTS_DB.prepare(
    "SELECT 1 FROM comment_likes WHERE comment_id = ? AND visitor_hash = ?"
  ).bind(commentId, viewer).first();

  if (existing) {
    await env.COMMENTS_DB.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND visitor_hash = ?")
      .bind(commentId, viewer).run();
  } else {
    await env.COMMENTS_DB.prepare("INSERT INTO comment_likes (comment_id, visitor_hash) VALUES (?, ?)")
      .bind(commentId, viewer).run();
  }

  const count = await env.COMMENTS_DB.prepare("SELECT COUNT(*) AS count FROM comment_likes WHERE comment_id = ?")
    .bind(commentId).first();
  return json({ liked: !existing, like_count: count?.count ?? 0 }, 200, origin, env);
}

async function flagComment(request, env, origin, commentId) {
  const comment = await getComment(env, commentId);
  if (!comment || comment.status !== "visible") return json({ error: "Comment not found." }, 404, origin, env);

  const viewer = await visitorHash(request, env);
  await env.COMMENTS_DB.prepare(`
    INSERT INTO comment_flags (comment_id, visitor_hash) VALUES (?, ?)
    ON CONFLICT (comment_id, visitor_hash) DO NOTHING
  `).bind(commentId, viewer).run();
  return json({ flagged: true }, 200, origin, env);
}

export default {
  async fetch(request, env, context) {
    const origin = request.headers.get("Origin") ?? "";

    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin(origin, env)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }
    if (origin && !isAllowedOrigin(origin, env)) return json({ error: "Origin not allowed." }, 403, origin, env);

    try {
      const url = new URL(request.url);
      if (request.method === "GET" && url.pathname === "/widget") {
        const postSlug = cleanSingleLine(url.searchParams.get("post"));
        if (!POST_SLUG_PATTERN.test(postSlug)) return new Response("A valid post is required.", { status: 400 });
        return new Response(widgetPage(postSlug, env.TURNSTILE_SITE_KEY), {
          headers: {
            "Content-Type": "text/html; charset=UTF-8",
            "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://tonykevin.neocities.org https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://tonykevin.neocities.org; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; img-src data: https:",
            "Cache-Control": "public, max-age=300",
            "X-Content-Type-Options": "nosniff"
          }
        });
      }
      if (request.method === "GET" && url.pathname === "/health") {
        const check = await env.COMMENTS_DB.prepare("SELECT 1 AS ok").first();
        return json({ ok: check?.ok === 1 }, 200, origin, env);
      }
      if (request.method === "GET" && url.pathname === "/comments") return listComments(request, env, origin, url);
      if (request.method === "POST" && url.pathname === "/comments") return createComment(request, env, origin, context);

      const action = url.pathname.match(/^\/comments\/(\d+)\/(like|flag)$/);
      if (request.method === "POST" && action) {
        const commentId = Number(action[1]);
        return action[2] === "like"
          ? toggleLike(request, env, origin, commentId)
          : flagComment(request, env, origin, commentId);
      }
      return json({ error: "Not found." }, 404, origin, env);
    } catch (error) {
      console.error(error);
      return json({ error: "The comment service had a problem." }, 500, origin, env);
    }
  }
};
