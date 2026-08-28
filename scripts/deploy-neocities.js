const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const projectRoot = path.resolve(__dirname, "..");
const deployDirectory = path.join(projectRoot, "deploy");
const keyFile = path.join(projectRoot, ".neocities-key");

if (!fs.existsSync(keyFile)) {
  throw new Error(
    "Missing .neocities-key. Create that file in the project folder and paste your Neocities API key into it."
  );
}

const apiKey = fs.readFileSync(keyFile, "utf8").trim();

if (!apiKey) {
  throw new Error("Your .neocities-key file is empty.");
}

if (!fs.existsSync(deployDirectory)) {
  throw new Error("Missing deploy/. Run npm run prepare-neocities first.");
}

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(entryPath);
    return entry.isFile() ? [entryPath] : [];
  });
}

function sitePathFor(filePath) {
  return path.relative(deployDirectory, filePath).split(path.sep).join("/");
}

function sha1For(filePath) {
  return crypto.createHash("sha1").update(fs.readFileSync(filePath)).digest("hex");
}

async function jsonResponse(response, action) {
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Neocities ${action} failed (${response.status}): ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`Neocities returned an unexpected response while trying to ${action}: ${responseText}`);
  }
}

async function deploy() {
  const files = filesIn(deployDirectory);
  const remoteResponse = await fetch("https://neocities.org/api/list", {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const remoteResult = await jsonResponse(remoteResponse, "list site files");
  const remoteHashes = new Map(
    (remoteResult.files ?? [])
      .filter((file) => !file.is_directory)
      .map((file) => [file.path, file.sha1_hash])
  );
  const changedFiles = files.filter((filePath) => {
    const sitePath = sitePathFor(filePath);
    return remoteHashes.get(sitePath) !== sha1For(filePath);
  });

  if (changedFiles.length === 0) {
    console.log("Neocities is already up to date.");
    return;
  }

  const changedBytes = changedFiles.reduce((total, filePath) => total + fs.statSync(filePath).size, 0);

  if (process.env.NEOCITIES_DRY_RUN === "1") {
    console.log(`Neocities needs ${changedFiles.length} changed files (${Math.ceil(changedBytes / 1024)} KB).`);
    return;
  }

  const form = new FormData();

  for (const filePath of changedFiles) {
    const sitePath = sitePathFor(filePath);
    const fileData = fs.readFileSync(filePath);
    form.append(sitePath, new Blob([fileData]), path.basename(filePath));
  }

  const response = await fetch("https://neocities.org/api/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });
  const result = await jsonResponse(response, "upload files");

  if (result.result !== "success") {
    throw new Error(`Neocities upload failed: ${result.message ?? "unknown error"}`);
  }

  console.log(`Uploaded ${changedFiles.length} changed public site files to Neocities.`);
}

deploy().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
