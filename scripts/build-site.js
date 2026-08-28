const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const postSourceDirectory = path.join(projectRoot, "content", "posts");
const pageSourceDirectory = path.join(projectRoot, "content", "pages");

function readProjectFile(...filePath) {
  return fs.readFileSync(path.join(projectRoot, ...filePath), "utf8");
}

function escapeHtml(value) {
  return value.replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  })[character]);
}

function replaceTokens(text, tokens) {
  return Object.entries(tokens).reduce(
    (result, [token, value]) => result.replaceAll(`{{${token}}}`, value),
    text
  );
}

function parseSource(source, requiredFields) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    throw new Error("A source file must begin and end its metadata with --- lines.");
  }

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    metadata[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  for (const field of requiredFields) {
    if (!metadata[field]) {
      throw new Error(`A source file is missing its required ${field} field.`);
    }
  }

  if (metadata.date && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) {
    throw new Error("A post date must use YYYY-MM-DD format.");
  }

  return { metadata, content: match[2].trim() };
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatMonthYear(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatTags(tags, archiveUrl) {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => {
      const tagUrl = `${archiveUrl}?tag=${encodeURIComponent(tag)}`;
      return `<a class="post-tag" href="${tagUrl}">${escapeHtml(tag)}</a>`;
    })
    .join("\n            ");
}

function formatArchiveTags(tags, archiveUrl) {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => {
      const tagUrl = `${archiveUrl}?tag=${encodeURIComponent(tag)}`;
      return `<a class="post-tag" href="${tagUrl}">${escapeHtml(tag)}</a>`;
    })
    .join(", ");
}

function tagNames(tags) {
  return tags
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .join(",");
}

function imagePath(post, root) {
  if (!post.metadata.image) return "";
  return post.metadata.image.replace(/^(\.\.\/)?images\//, `${root}images/`);
}

function recentPostsHtml(posts, root, postUrl) {
  return posts.slice(0, 1).map((post) => {
    const thumbnail = imagePath(post, root);
    const imageHtml = thumbnail
      ? `\n      <img class="recent-post-thumbnail sidebar-float" src="${thumbnail}" alt="${escapeHtml(post.metadata.title)}" width="100" height="100">`
      : "";

    return `<a href="${postUrl(post)}">${escapeHtml(post.metadata.title)}${imageHtml}</a>`;
  }).join("\n    <br>\n    ");
}

function sharedPageParts(root, posts, postUrl) {
  const recentPosts = recentPostsHtml(posts, root, postUrl);

  return {
    topbar: replaceTokens(readProjectFile("partials", "topbar.html"), { root }),
    header: replaceTokens(readProjectFile("partials", "header.html"), { root }),
    footer: readProjectFile("partials", "footer.html"),
    sidebar: replaceTokens(readProjectFile("partials", "sidebar.html"), { root, recentPosts })
  };
}

function buildPostPage(post, posts, options) {
  const shared = sharedPageParts(options.root, posts, options.postUrl);

  return replaceTokens(readProjectFile("templates", "post-page.html"), {
    root: options.root,
    ...shared,
    postTitle: escapeHtml(post.metadata.title),
    postDescription: escapeHtml(post.metadata.description),
    postDate: post.metadata.date,
    postDateDisplay: formatDate(post.metadata.date),
    postTags: formatTags(post.metadata.tags, options.archiveUrl),
    postContent: post.content
  });
}

function buildArchivePage(posts, options) {
  const shared = sharedPageParts(options.root, posts, options.postUrl);
  const groups = new Map();

  for (const post of posts) {
    const monthYear = formatMonthYear(post.metadata.date);
    if (!groups.has(monthYear)) groups.set(monthYear, []);
    groups.get(monthYear).push(post);
  }

  const postArchive = [...groups.entries()].map(([monthYear, monthPosts]) => {
    const items = monthPosts.map((post) => `
        <li data-tags="${escapeHtml(tagNames(post.metadata.tags))}">
          <a href="${options.postUrl(post)}">${escapeHtml(post.metadata.title)}</a> -
          <time datetime="${post.metadata.date}">${formatDate(post.metadata.date)}</time> -
          <span class="archive-tags">Tags: ${formatArchiveTags(post.metadata.tags, options.archiveUrl)}</span>
        </li>`).join("");

    return `<section class="archive-month">
      <h2>${monthYear}</h2>
      <ul>${items}
      </ul>
    </section>`;
  }).join("\n");

  return replaceTokens(readProjectFile("templates", "posts-page.html"), {
    root: options.root,
    ...shared,
    postArchive
  });
}

function buildRegularPage(page, posts, options) {
  const shared = sharedPageParts(options.root, posts, options.postUrl);

  return replaceTokens(readProjectFile("templates", "regular-page.html"), {
    root: options.root,
    ...shared,
    pageTitle: escapeHtml(page.metadata.title),
    pageDescription: escapeHtml(page.metadata.description),
    pageContent: replaceTokens(page.content, { root: options.root })
  });
}

function readPosts() {
  return fs.readdirSync(postSourceDirectory)
    .filter((filename) => filename.endsWith(".html"))
    .map((filename) => {
      const source = fs.readFileSync(path.join(postSourceDirectory, filename), "utf8");
      const { metadata, content } = parseSource(source, ["title", "date", "description", "tags"]);
      return { filename, metadata, content };
    })
    .sort((first, second) => second.metadata.date.localeCompare(first.metadata.date));
}

function readRegularPages() {
  return fs.readdirSync(pageSourceDirectory)
    .filter((filename) => filename.endsWith(".html"))
    .map((filename) => {
      const source = fs.readFileSync(path.join(pageSourceDirectory, filename), "utf8");
      const { metadata, content } = parseSource(source, ["title", "description"]);
      return { filename, metadata, content };
    });
}

function writeBuild({ outputDirectory, postDirectory, rootForRegularPages, rootForPosts, postUrlForRegularPages, postUrlForPosts }) {
  const posts = readPosts();
  const pages = readRegularPages();

  if (posts.length === 0) {
    throw new Error("Add at least one source post in content/posts before building.");
  }

  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.mkdirSync(postDirectory, { recursive: true });

  for (const post of posts) {
    fs.writeFileSync(
      path.join(postDirectory, post.filename),
      buildPostPage(post, posts, {
        root: rootForPosts,
        archiveUrl: `${rootForPosts}posts.html`,
        postUrl: postUrlForPosts
      })
    );
  }

  fs.writeFileSync(
    path.join(outputDirectory, "posts.html"),
    buildArchivePage(posts, {
      root: rootForRegularPages,
      archiveUrl: "posts.html",
      postUrl: postUrlForRegularPages
    })
  );

  for (const page of pages) {
    fs.writeFileSync(
      path.join(outputDirectory, page.filename),
      buildRegularPage(page, posts, {
        root: rootForRegularPages,
        postUrl: postUrlForRegularPages
      })
    );
  }

  return { postCount: posts.length, pageCount: pages.length };
}

const testOutputDirectory = path.join(projectRoot, "test-output");
const testResult = writeBuild({
  outputDirectory: testOutputDirectory,
  postDirectory: testOutputDirectory,
  rootForRegularPages: "../",
  rootForPosts: "../",
  postUrlForRegularPages: (post) => post.filename,
  postUrlForPosts: (post) => post.filename
});

const productionResult = writeBuild({
  outputDirectory: projectRoot,
  postDirectory: path.join(projectRoot, "posts"),
  rootForRegularPages: "",
  rootForPosts: "../",
  postUrlForRegularPages: (post) => `posts/${post.filename}`,
  postUrlForPosts: (post) => post.filename
});

console.log(`Built ${productionResult.postCount} post${productionResult.postCount === 1 ? "" : "s"} and ${productionResult.pageCount} regular page${productionResult.pageCount === 1 ? "" : "s"} for the live site.`);
console.log(`Also refreshed the matching test output in ${path.relative(projectRoot, testOutputDirectory)}.`);
