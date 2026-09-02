(() => {
  const widgetOrigin = "https://blogtony-comments.tonykevinjr.workers.dev";
  const frames = [...document.querySelectorAll(".comment-frame")];
  if (frames.length === 0) return;
  function sendTheme(frame) {
    frame.contentWindow?.postMessage({ type: "blogtony-comments-theme", soft: document.body.classList.contains("soft-mode") }, widgetOrigin);
  }
  for (const frame of frames) frame.addEventListener("load", () => sendTheme(frame));
  new MutationObserver(() => { for (const frame of frames) sendTheme(frame); }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("message", (event) => {
    if (event.origin !== widgetOrigin || event.data?.source !== "blogtony-comments") return;
    const frame = frames.find((candidate) => candidate.contentWindow === event.source);
    if (!frame) return;
    if (event.data.type === "height") {
      const height = Number(event.data.height);
      if (Number.isFinite(height) && height > 0) frame.style.height = `${height}px`;
    }
    if (event.data.type === "count") {
      const countElement = frame.closest(".feed-comments")?.querySelector(".feed-comment-count");
      if (!countElement) return;
      countElement.textContent = String(event.data.count);
      countElement.removeAttribute("aria-label");
    }
  });
})();
