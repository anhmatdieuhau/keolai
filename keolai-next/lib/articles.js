import fs from "fs";
import path from "path";

const contentDir = path.join(process.cwd(), "content");

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta = {};
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      // Handle arrays like [item1, item2]
      if (val.startsWith("[") && val.endsWith("]")) {
        val = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      }
      // Handle quoted strings
      if (typeof val === "string") {
        val = val.replace(/^"|"$/g, "");
      }
      meta[key] = val;
    }
  });

  return { meta, body: match[2] };
}

export function getAllArticles() {
  if (!fs.existsSync(contentDir)) return [];

  const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".mdx"));

  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(contentDir, file), "utf-8");
      const { meta } = parseFrontmatter(raw);
      return {
        slug: file.replace(".mdx", ""),
        ...meta,
      };
    })
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

export function getArticle(slug) {
  const filePath = path.join(contentDir, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { meta, body } = parseFrontmatter(raw);

  return { slug, ...meta, body };
}

export function getAllSlugs() {
  if (!fs.existsSync(contentDir)) return [];
  return fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(".mdx", ""));
}
