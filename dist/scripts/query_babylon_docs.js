"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
//!/usr/bin/env node
/*
Simple CLI to query local Babylon docs JSON
Usage:
  npm run dev -- --list-topics
  npm run dev -- --topic getting-started
  npm run dev -- --id app-initialization
  npm run dev -- --search particles
*/
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DATA_PATH = path.resolve(__dirname, '../../docs/babylon/json/all_docs.json');
function loadData() {
    try {
        const raw = fs.readFileSync(DATA_PATH, 'utf8');
        return JSON.parse(raw);
    }
    catch (e) {
        console.error('Failed to load docs JSON:', e.message);
        process.exit(1);
    }
}
function listTopics(data) {
    return (data.topics || []).map((t) => t.topic);
}
function findByTopic(data, topic) {
    return (data.topics || []).find((t) => t.topic === topic);
}
function findById(data, id) {
    for (const t of data.topics || []) {
        const s = (t.snippets || []).find((sn) => sn.id === id);
        if (s)
            return { topic: t.topic, snippet: s };
    }
    return null;
}
function searchContent(data, q) {
    const lower = q.toLowerCase();
    const results = [];
    for (const t of data.topics || []) {
        for (const s of t.snippets || []) {
            if ((s.title && s.title.toLowerCase().includes(lower)) ||
                (s.content && s.content.toLowerCase().includes(lower))) {
                results.push({ topic: t.topic, snippet: s });
            }
        }
    }
    return results;
}
function printSnippet(item, showContent = true) {
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
const opts = {};
for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--list-topics')
        opts.listTopics = true;
    else if (a === '--topic')
        opts.topic = args[++i];
    else if (a === '--id')
        opts.id = args[++i];
    else if (a === '--search')
        opts.search = args[++i];
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
    for (const item of res)
        printSnippet(item, false);
    process.exit(0);
}
// Default: show help header
console.log(fs.readFileSync(__filename, 'utf8'));
//# sourceMappingURL=query_babylon_docs.js.map