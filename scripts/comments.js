(() => {
  const sections = [...document.querySelectorAll(".comment-section")];
  if (sections.length === 0) return;

  const initializedSections = new WeakSet();
  let turnstileIsReady = false;

  function updateFeedCommentCount(section, count) {
    const countElement = section.closest(".feed-comments")?.querySelector(".feed-comment-count");
    if (!countElement) return;
    countElement.textContent = String(count);
    countElement.removeAttribute("aria-label");
  }

  async function loadFeedCommentCount(section) {
    const countElement = section.closest(".feed-comments")?.querySelector(".feed-comment-count");
    if (!countElement) return;
    try {
      const response = await fetch(`${section.dataset.commentsApi}/comments?post=${encodeURIComponent(section.dataset.postSlug)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error();
      updateFeedCommentCount(section, data.comments?.length ?? 0);
    } catch {
      countElement.textContent = "?";
      countElement.setAttribute("aria-label", "comment count unavailable");
    }
  }

  function initializeSection(section) {
    if (!section || initializedSections.has(section) || !turnstileIsReady) return;
    initializedSections.add(section);

    const apiBase = section.dataset.commentsApi;
    const postSlug = section.dataset.postSlug;
    const form = section.querySelector(".comment-form");
    const list = section.querySelector(".comment-list");
    const loading = section.querySelector(".comments-loading");
    const status = section.querySelector(".comment-form-status");
    const nameInput = form.elements.name;
    const anonymousInput = form.elements.anonymous;
    const bodyInput = form.elements.body;
    const parentInput = form.elements.parentId;
    const replyContext = section.querySelector(".comment-reply-context");
    const replyName = section.querySelector(".comment-reply-name");
    const cancelReply = section.querySelector(".comment-cancel-reply");
    const turnstileContainer = section.querySelector(".comment-turnstile");
    let turnstileToken = "";
    let turnstileWidgetId;

    const isDevelopment = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const sitekey = isDevelopment ? turnstileContainer.dataset.developmentSitekey : turnstileContainer.dataset.productionSitekey;

    turnstileWidgetId = window.turnstile.render(turnstileContainer, {
      sitekey,
      theme: "auto",
      callback: (token) => {
        turnstileToken = token;
        status.textContent = "";
      },
      "expired-callback": () => { turnstileToken = ""; },
      "error-callback": () => {
        turnstileToken = "";
        status.textContent = "The anti-spam check could not connect. Please refresh and try again.";
      }
    });

    function resetTurnstile() {
      turnstileToken = "";
      if (turnstileWidgetId != null) window.turnstile?.reset(turnstileWidgetId);
    }

    async function api(path, options = {}) {
      const response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The comment service is unavailable.");
      return data;
    }

    function actionButton(label, className) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.textContent = label;
      return button;
    }

    function clearReply() {
      parentInput.value = "";
      replyContext.hidden = true;
      replyName.textContent = "";
    }

    function chooseReply(comment) {
      parentInput.value = String(comment.id);
      replyName.textContent = comment.display_name;
      replyContext.hidden = false;
      bodyInput.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function renderComment(comment, childrenByParent, depth) {
      const article = document.createElement("article");
      article.className = "comment";
      article.style.setProperty("--comment-depth", String(Math.min(depth, 3)));

      const header = document.createElement("header");
      const author = document.createElement("strong");
      author.textContent = comment.display_name;
      const time = document.createElement("time");
      const date = new Date(`${comment.created_at.replace(" ", "T")}Z`);
      time.dateTime = date.toISOString();
      time.textContent = date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
      header.append(author, " · ", time);

      const body = document.createElement("p");
      body.className = "comment-body";
      body.textContent = comment.body;
      const actions = document.createElement("div");
      actions.className = "comment-actions";

      const like = actionButton(`♥ ${comment.like_count}`, "comment-like");
      like.setAttribute("aria-pressed", String(Boolean(comment.viewer_liked)));
      like.addEventListener("click", async () => {
        like.disabled = true;
        try {
          const result = await api(`/comments/${comment.id}/like`, { method: "POST", body: "{}" });
          like.textContent = `♥ ${result.like_count}`;
          like.setAttribute("aria-pressed", String(result.liked));
        } catch (error) {
          status.textContent = error.message;
        } finally {
          like.disabled = false;
        }
      });

      const reply = actionButton("Reply", "comment-reply");
      reply.addEventListener("click", () => chooseReply(comment));
      const flag = actionButton("Flag", "comment-flag");
      flag.addEventListener("click", async () => {
        flag.disabled = true;
        try {
          await api(`/comments/${comment.id}/flag`, { method: "POST", body: "{}" });
          flag.textContent = "Flagged";
        } catch (error) {
          status.textContent = error.message;
          flag.disabled = false;
        }
      });

      actions.append(like, reply, flag);
      article.append(header, body, actions);
      for (const child of childrenByParent.get(comment.id) ?? []) {
        article.append(renderComment(child, childrenByParent, depth + 1));
      }
      return article;
    }

    async function loadComments() {
      loading.hidden = false;
      try {
        const data = await api(`/comments?post=${encodeURIComponent(postSlug)}`);
        updateFeedCommentCount(section, data.comments.length);
        const childrenByParent = new Map();
        for (const comment of data.comments) {
          const key = comment.parent_id ?? null;
          if (!childrenByParent.has(key)) childrenByParent.set(key, []);
          childrenByParent.get(key).push(comment);
        }

        list.replaceChildren();
        const roots = childrenByParent.get(null) ?? [];
        if (roots.length === 0) {
          const empty = document.createElement("p");
          empty.className = "comments-empty";
          empty.textContent = "No comments yet. You could be the first, Pal.";
          list.append(empty);
        } else {
          for (const comment of roots) list.append(renderComment(comment, childrenByParent, 0));
        }
      } catch (error) {
        list.textContent = error.message;
      } finally {
        loading.hidden = true;
      }
    }

    anonymousInput.addEventListener("change", () => {
      nameInput.disabled = anonymousInput.checked;
      nameInput.required = !anonymousInput.checked;
    });
    cancelReply.addEventListener("click", clearReply);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = form.querySelector(".comment-submit");
      status.textContent = "";
      submit.disabled = true;
      try {
        await api("/comments", {
          method: "POST",
          body: JSON.stringify({
            postSlug,
            parentId: parentInput.value || null,
            name: nameInput.value,
            anonymous: anonymousInput.checked,
            body: bodyInput.value,
            turnstileToken
          })
        });
        bodyInput.value = "";
        clearReply();
        status.textContent = "Comment posted!";
        resetTurnstile();
        await loadComments();
      } catch (error) {
        status.textContent = error.message;
        resetTurnstile();
      } finally {
        submit.disabled = false;
      }
    });

    loadComments();
  }

  function initializeVisibleSections() {
    for (const section of sections) {
      const drawer = section.closest("details");
      if (!drawer || drawer.open) initializeSection(section);
    }
  }

  window.onCommentsTurnstileLoad = () => {
    turnstileIsReady = true;
    initializeVisibleSections();
  };

  for (const drawer of document.querySelectorAll(".feed-comments")) {
    drawer.addEventListener("toggle", () => {
      if (drawer.open) initializeSection(drawer.querySelector(".comment-section"));
    });
  }

  for (const section of sections) loadFeedCommentCount(section);
})();
