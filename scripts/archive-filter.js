(() => {
  const viewButtons = [...document.querySelectorAll("[data-archive-view]")];
  const viewPanels = [...document.querySelectorAll("[data-archive-panel]")];
  const allowedViews = new Set(["list", "feed"]);

  function setView(view, remember = true) {
    const selectedView = allowedViews.has(view) ? view : "list";
    for (const button of viewButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.archiveView === selectedView));
    }
    for (const panel of viewPanels) {
      panel.hidden = panel.dataset.archivePanel !== selectedView;
    }
    if (remember) localStorage.setItem("blogtony-post-view", selectedView);
  }

  for (const button of viewButtons) {
    button.addEventListener("click", () => setView(button.dataset.archiveView));
  }

  let savedView = "list";
  try {
    savedView = localStorage.getItem("blogtony-post-view") || "list";
  } catch {
    // List view remains the default when browser storage is unavailable.
  }
  setView(savedView, false);

  const selectedTag = new URLSearchParams(window.location.search).get("tag")?.trim().toLowerCase();
  const status = document.querySelector(".tag-filter-status");
  const listItems = [...document.querySelectorAll(".archive-month li[data-tags]")];
  const feedPosts = [...document.querySelectorAll(".feed-post[data-tags]")];

  if (!selectedTag || !status || listItems.length === 0) return;

  let visiblePosts = 0;
  for (const post of listItems) {
    const matchesTag = post.dataset.tags.split(",").includes(selectedTag);
    post.hidden = !matchesTag;
    if (matchesTag) visiblePosts += 1;
  }
  for (const post of feedPosts) {
    post.hidden = !post.dataset.tags.split(",").includes(selectedTag);
  }
  for (const month of document.querySelectorAll(".archive-month")) {
    month.hidden = !month.querySelector("li:not([hidden])");
  }

  const readableTag = selectedTag.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const resultWord = visiblePosts === 1 ? "post" : "posts";
  status.hidden = false;
  status.textContent = `Showing ${visiblePosts} ${resultWord} tagged ${readableTag}. `;

  const clearFilter = document.createElement("a");
  clearFilter.href = "posts.html";
  clearFilter.textContent = "Show all posts";
  status.appendChild(clearFilter);
})();
