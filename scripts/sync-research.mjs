import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.resolve(process.env.RESEARCH_SOURCE ?? process.argv[2] ?? "../Research");
const outputRoot = path.join(root, "public", "reports");
const manifestPath = path.join(root, "src", "data", "reports.json");
const publishableExtensions = new Set([".html", ".htm", ".css", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".woff", ".woff2", ".pdf"]);
const trackConfig = {
  ai4s: { label: "AI for Science", shortLabel: "AI4S", description: "追踪人工智能驱动的药物发现、生命科学基础模型与实验自动化。", direction: "计算生物学 · AI 药物研发 · 科研基础设施", candidates: ["ai4s", "AI4S"] },
  bci: { label: "Brain–Computer Interface", shortLabel: "BCI", description: "覆盖侵入式与非侵入式脑机接口、神经信号解码和临床转化。", direction: "神经工程 · 医疗器械 · 人机交互", candidates: ["bci", "BCI"] },
};

async function exists(target) { try { await stat(target); return true; } catch { return false; } }
async function walk(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full, base));
    else files.push(path.relative(base, full));
  }
  return files;
}
function escapeText(value) { return value.replace(/<[^>]+>/g, " ").replace(/&(?:nbsp|amp|lt|gt);/g, " ").replace(/\s+/g, " ").trim(); }
function inferDate(file) {
  const match = file.match(/(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?([0-2]\d|3[01])/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return "1970-01-01";
}
function slugify(file) { return file.replace(/\.html?$/i, "").replace(/[\\/]+/g, "-").replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").replace(/^-|-$/g, ""); }
function publicUrl(track, relative) { return `/reports/${track}/${relative.split(path.sep).map(encodeURIComponent).join("/")}`; }

let previousManifest = null;
if (await exists(manifestPath)) {
  try {
    previousManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    previousManifest = null;
  }
}

const stageRoot = await mkdtemp(path.join(tmpdir(), "research-web-sync-"));
const tracks = {};
try {
  for (const [key, config] of Object.entries(trackConfig)) {
    const sourceDir = (await Promise.all(config.candidates.map(async (name) => [path.join(sourceRoot, name), await exists(path.join(sourceRoot, name))]))).find(([, found]) => found)?.[0];
    if (!sourceDir) throw new Error(`Missing source directory for ${key}. Expected one of: ${config.candidates.join(", ")}`);
    const targetDir = path.join(stageRoot, key);
    await mkdir(targetDir, { recursive: true });
    const sourceFiles = await walk(sourceDir);
    const publishableFiles = sourceFiles.filter((file) => publishableExtensions.has(path.extname(file).toLowerCase()) && !file.split(path.sep).some((part) => part.startsWith(".")));
    for (const file of publishableFiles) {
      const target = path.join(targetDir, file);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(sourceDir, file), target, { dereference: true });
    }
    const files = await walk(targetDir);
    const htmlFiles = files.filter((file) => /\.html?$/i.test(file));
    if (!htmlFiles.length) throw new Error(`No HTML reports found in ${sourceDir}`);
    const latestFile = htmlFiles.find((file) => path.basename(file).toLowerCase() === "latest.html");
    const historicalFiles = htmlFiles.filter((file) => file !== latestFile);
    const reports = [];
    for (const file of historicalFiles) {
      const html = await readFile(path.join(targetDir, file), "utf8");
      const title = escapeText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? path.basename(file, path.extname(file)));
      reports.push({ slug: slugify(file), title, date: inferDate(file), url: publicUrl(key, file), format: "html", tags: [], latest: false });
    }
    reports.sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
    if (latestFile && reports.length) {
      const latestResolved = reports.find((report) => report.url === publicUrl(key, latestFile)) ?? reports[0];
      if (latestResolved) latestResolved.latest = true;
    } else if (latestFile) {
      const html = await readFile(path.join(targetDir, latestFile), "utf8");
      reports.push({ slug: "latest", title: escapeText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? `${config.shortLabel} Latest`), date: inferDate(latestFile), url: publicUrl(key, latestFile), format: "html", tags: [], latest: true });
    } else if (reports[0]) {
      reports[0].latest = true;
      await writeFile(path.join(targetDir, "latest.html"), `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${reports[0].url}"><title>Latest report</title>\n`);
    }
    if (!reports.some((report) => report.latest) && reports[0]) reports[0].latest = true;
    tracks[key] = { label: config.label, shortLabel: config.shortLabel, description: config.description, direction: config.direction, reports };
  }
  await rm(outputRoot, { recursive: true, force: true });
  await rename(stageRoot, outputRoot);
  const tracksChanged = JSON.stringify(previousManifest?.tracks ?? null) !== JSON.stringify(tracks);
  const generatedAt = tracksChanged ? new Date().toISOString() : (previousManifest?.generatedAt ?? new Date().toISOString());
  await writeFile(manifestPath, `${JSON.stringify({ generatedAt, tracks }, null, 2)}\n`);
  console.log(`Synced ${Object.values(tracks).reduce((sum, track) => sum + track.reports.length, 0)} reports from ${sourceRoot}${tracksChanged ? " (changes detected)" : " (no report changes)"}`);
} catch (error) {
  await rm(stageRoot, { recursive: true, force: true });
  throw error;
}
