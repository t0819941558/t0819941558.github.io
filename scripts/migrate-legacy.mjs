import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import plugin from 'turndown-plugin-gfm';

const root = process.cwd();
const sourceRoot = path.join(root, '2020');
const outputRoot = path.join(root, 'src', 'content', 'archive');
const { gfm } = plugin;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await walk(fullPath)));
    if (entry.isFile() && entry.name === 'index.html') results.push(fullPath);
  }
  return results;
}

function safeFileName(value) {
  return value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function yamlString(value) {
  return JSON.stringify(value);
}

function normalizeLegacyCode($, body) {
  body.find('figure.highlight').each((_, element) => {
    const figure = $(element);
    const language = (figure.attr('class') ?? '')
      .split(/\s+/)
      .find((name) => name !== 'highlight') ?? 'text';
    const code = figure.find('td.code pre').text() || figure.find('pre').last().text();
    const replacement = $('<pre></pre>').append(
      $('<code></code>').addClass(`language-${language}`).text(code),
    );
    figure.replaceWith(replacement);
  });
}

const turndown = new TurndownService({
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  headingStyle: 'atx',
});
turndown.use(gfm);
turndown.keep(['details', 'summary']);

await mkdir(outputRoot, { recursive: true });
for (const entry of await readdir(outputRoot, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.md')) {
    await rm(path.join(outputRoot, entry.name));
  }
}

const pages = await walk(sourceRoot);
const report = [];

for (const filePath of pages) {
  const html = await readFile(filePath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const body = $('.post-body').first();
  if (!body.length) continue;

  body.find('script, style, .post-button, .post-eof').remove();
  body.find('img').each((_, element) => {
    const image = $(element);
    const source = image.attr('src') ?? '';
    const normalized = source.replace(/\\/g, '/');
    const marker = normalized.lastIndexOf('/images/');
    if (marker >= 0) image.attr('src', `/legacy-images/${normalized.slice(marker + 8)}`);
    else if (normalized.startsWith('images/')) image.attr('src', `/legacy-images/${normalized.slice(7)}`);
  });
  normalizeLegacyCode($, body);

  const title = $('h1.post-title').first().text().trim()
    || $('title').text().split('|')[0].trim()
    || path.basename(path.dirname(filePath));
  const relative = path.relative(root, filePath).replace(/\\/g, '/').replace(/\/index\.html$/, '/');
  const pathParts = relative.split('/');
  const fallbackDate = `${pathParts[0]}-${pathParts[1]}-${pathParts[2]}`;
  const publishedAt = $('time[itemprop*="datePublished"]').first().attr('datetime')?.slice(0, 10)
    || fallbackDate;
  const markdown = turndown.turndown(body.html() ?? '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const fileName = `${publishedAt}-${safeFileName(title)}.md`;
  const frontmatter = [
    '---',
    `title: ${yamlString(title)}`,
    `publishedAt: ${publishedAt}`,
    `legacyPath: ${yamlString(`/${relative}`)}`,
    'archived: true',
    '---',
    '',
  ].join('\n');

  await writeFile(path.join(outputRoot, fileName), `${frontmatter}${markdown}\n`, 'utf8');
  report.push({ title, publishedAt, legacyPath: `/${relative}`, file: fileName, characters: markdown.length });
}

report.sort((a, b) => a.legacyPath.localeCompare(b.legacyPath, 'zh-CN'));
await writeFile(
  path.join(outputRoot, '_migration-report.json'),
  `${JSON.stringify({ migratedAt: new Date().toISOString(), count: report.length, posts: report }, null, 2)}\n`,
  'utf8',
);

console.log(`Migrated ${report.length} legacy posts to ${path.relative(root, outputRoot)}.`);
