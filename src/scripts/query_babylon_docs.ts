//!/usr/bin/env node
/*
Simple CLI to query local Babylon docs JSON
Usage:
  npm run dev -- --list-topics
  npm run dev -- --topic getting-started
  npm run dev -- --id app-initialization
  npm run dev -- --search particles
*/
import * as fs from 'fs';
import * as path from 'path';
const DATA_PATH = path.resolve(__dirname, '../../docs/babylon/json/all_docs.json');

type Snippet = {
  id: string;
  title?: string;
  content?: string;
  url?: string;
  source?: string;
};

type Topic = {
  topic: string;
  snippets?: Snippet[];
};

type Docs = {
  topics?: Topic[];
};

function loadData(): Docs {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw) as Docs;
  } catch (e: any) {
    console.error('Failed to load docs JSON:', e.message);
    process.exit(1);
  }
}

function listTopics(data: Docs): string[] {
  return (data.topics || []).map((t) => t.topic);
}

function findByTopic(data: Docs, topic: string): Topic | undefined {
  return (data.topics || []).find((t) => t.topic === topic);
}

function findById(data: Docs, id: string): { topic: string; snippet: Snippet } | null {
  for (const t of data.topics || []) {
    const s = (t.snippets || []).find((sn) => sn.id === id);
    if (s) return { topic: t.topic, snippet: s };
  }
  return null;
}

function searchContent(data: Docs, q: string) {
  const lower = q.toLowerCase();
  const results: { topic: string; snippet: Snippet }[] = [];
  for (const t of data.topics || []) {
    for (const s of t.snippets || []) {
      if (
        (s.title && s.title.toLowerCase().includes(lower)) ||
        (s.content && s.content.toLowerCase().includes(lower))
      ) {
        results.push({ topic: t.topic, snippet: s });
      }
    }
  }
  return results;
}

function printSnippet(item: { topic: string; snippet: Snippet }, showContent = true) {
  console.log('---');
  console.log('topic:', item.topic);
  console.log('id:', item.snippet.id);
  console.log('title:', item.snippet.title);
  console.log('url:', item.snippet.url || item.snippet.source || '');
  if (showContent) {
    console.log('content:');
    console.log(item.snippet.content || '');
  }
}

// Simple arg parsing
const args = process.argv.slice(2);
const opts: { listTopics?: boolean; topic?: string; id?: string; search?: string } = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--list-topics') opts.listTopics = true;
  else if (a === '--topic') opts.topic = args[++i];
  else if (a === '--id') opts.id = args[++i];
  else if (a === '--search') opts.search = args[++i];
  else if (a === '--help' || a === '-h') {
    console.log(fs.readFileSync(__filename, 'utf8'));
    process.exit(0);
  }
}

const data = loadData();

if (opts.listTopics) {
  console.log(listTopics(data).join('\n'));
  process.exit(0);
}

if (opts.topic) {
  const t = findByTopic(data, opts.topic);
  if (!t) {
    console.error('Topic not found:', opts.topic);
    process.exit(2);
  }
  console.log(JSON.stringify(t, null, 2));
  process.exit(0);
}

if (opts.id) {
  const r = findById(data, opts.id);
  if (!r) {
    console.error('Snippet id not found:', opts.id);
    process.exit(2);
  }
  printSnippet(r, true);
  process.exit(0);
}

if (opts.search) {
  const res = searchContent(data, opts.search);
  if (!res.length) {
    console.log('No matches.');
    process.exit(0);
  }
  for (const item of res) printSnippet(item, false);
  process.exit(0);
}

// Default: show help header
console.log(fs.readFileSync(__filename, 'utf8'));