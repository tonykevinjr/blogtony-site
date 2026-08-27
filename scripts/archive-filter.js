(() => {
  const selectedTag = new URLSearchParams(window.location.search).get("tag")?.trim().toLowerCase();
  const status = document.querySelector(".tag-filter-status");
  const postItems = document.querySelectorAll(".archive-month li[data-tags]");

  if (!selectedTag || !status || postItems.length === 0) return;

  let visiblePosts = 0;
  postItems.forEach((post) => {
    const postTags = post.dataset.tags.split(",");
    const matchesTag = postTags.includes(selectedTag);
    post.hidden = !matchesTag;
    if (matchesTag) visiblePosts += 1;
  });

  document.querySelectorAll(".archive-month").forEach((month) => {
    month.hidden = !month.querySelector("li:not([hidden])");
  });

  const readableTag = selectedTag.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const resultWord = visiblePosts === 1 ? "post" : "posts";
  status.hidden = false;
  status.textContent = `Showing ${visiblePosts} ${resultWord} tagged ${readableTag}. `;

  const clearFilter = document.createElement("a");
  clearFilter.href = "posts.html";
  clearFilter.textContent = "Show all posts";
  status.appendChild(clearFilter);
})();
