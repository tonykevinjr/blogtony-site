const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const deployDirectory = path.join(projectRoot, "deploy");

const buildResult = spawnSync(process.execPath, [path.join(__dirname, "build-site.js")], {
  cwd: projectRoot,
  stdio: "inherit"
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

if (!deployDirectory.startsWith(`${projectRoot}${path.sep}`)) {
  throw new Error("The deploy folder must stay inside this project.");
}

fs.rmSync(deployDirectory, { recursive: true, force: true });
fs.mkdirSync(deployDirectory, { recursive: true });

function copyFile(relativePath) {
  const source = path.join(projectRoot, relativePath);
  const destination = path.join(deployDirectory, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyDirectory(relativePath) {
  fs.cpSync(
    path.join(projectRoot, relativePath),
    path.join(deployDirectory, relativePath),
    {
      recursive: true,
      filter: (source) => path.basename(source) !== ".DS_Store"
    }
  );
}

["index.html", "about.html", "music.html", "posts.html", "store.html", "theme.js"].forEach(copyFile);
copyDirectory("posts");
copyDirectory("images");
copyDirectory("style");
copyFile(path.join("scripts", "archive-filter.js"));
copyFile(path.join("scripts", "comments.js"));

console.log("Prepared deploy/ with the public site files for Neocities.");
