#!/usr/bin/env node
// SimpleScript -> TypeScript transpiler. No dependencies.
//   node simplescript.js build demo.simple      writes demo.ts
//   node simplescript.js run demo.simple        runs it (uses `typescript` if installed, for type annotations)

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

// ---- Built-in English names -> real targets. Add your own here. ----
const BUILTINS = {
  log: 'console.log', warn: 'console.warn', error: 'console.error',
  prompt: 'prompt', alert: 'alert',
  number: 'Number', text: 'String',
  round: 'Math.round', floor: 'Math.floor', ceil: 'Math.ceil',
  random: 'Math.random', max: 'Math.max', min: 'Math.min',
};

const KEYWORDS = new Set(['task', 'if', 'else', 'while', 'for', 'return', 'function', 'let', 'const', 'var',
  'class', 'new', 'import', 'export', 'switch', 'case', 'break', 'continue', 'throw', 'try', 'catch',
  'typeof', 'await', 'async', 'default', 'interface', 'type', 'enum', 'do', 'in', 'of']);

// ---- String-aware helpers ----
function segments(s) {
  const out = []; let cur = '', q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      cur += c;
      if (c === '\\' && i + 1 < s.length) cur += s[++i];
      else if (c === q) { out.push({ str: true, t: cur }); cur = ''; q = null; }
    } else if ("'\"`".includes(c)) {
      if (cur) out.push({ str: false, t: cur });
      cur = c; q = c;
    } else cur += c;
  }
  if (cur) out.push({ str: !!q, t: cur });
  return out;
}
const mapCode = (s, f) => segments(s).map(x => (x.str ? x.t : f(x.t))).join('');
const mask = s => segments(s).map(x => (x.str ? 'x'.repeat(x.t.length) : x.t)).join('');

function splitTopLevel(s) {
  const m = mask(s), parts = []; let depth = 0, start = 0;
  for (let i = 0; i < m.length; i++) {
    if ('([{'.includes(m[i])) depth++;
    else if (')]}'.includes(m[i])) depth--;
    else if (m[i] === ',' && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
  }
  parts.push(s.slice(start));
  return parts;
}

function wrapped(s) {
  const m = mask(s);
  if (m[0] !== '(') return false;
  let depth = 0;
  for (let i = 0; i < m.length; i++) {
    if (m[i] === '(') depth++;
    else if (m[i] === ')' && --depth === 0) return i === m.length - 1;
  }
  return false;
}

// ---- Compiler ----
function compile(src) {
  const aliases = {};            // user name -> target, e.g. a -> console.log
  const funcs = new Set();       // user-defined functions (callable without parens)
  const scopes = [new Set()];
  const isDeclared = n => scopes.some(s => s.has(n));
  const resolve = n => aliases[n] || BUILTINS[n] || (funcs.has(n) ? n : null);

  // pre-scan so functions can be called before they're defined
  for (const m of src.matchAll(/(?:function|task)\s+([A-Za-z_]\w*)/g)) funcs.add(m[1]);
  for (const m of src.matchAll(/^\s*([A-Za-z_]\w*)\s*=\s*(?:async\s*)?\(?[\w,\s:]*\)?\s*=>/gm)) funcs.add(m[1]);

  // `f x, y`  ->  `f(x, y)`   (nests: `log upper x` -> `log(upper(x))`)
  function command(expr) {
    expr = expr.trim();
    const m = expr.match(/^([A-Za-z_]\w*)(?:\s*,\s*|\s+)(?=\S)/);
    if (m && !KEYWORDS.has(m[1])) {
      const target = resolve(m[1]);
      const rest = expr.slice(m[0].length);
      if (target && /^(['"`\[{(]|[\w$])/.test(rest)) {
        return `${target}(${splitTopLevel(rest).map(command).join(', ')})`;
      }
    }
    return expr;
  }

  const callMap = { ...BUILTINS };
  const lines = src.split(/\r?\n/);
  const out = [];

  for (const raw of lines) {
    const indent = raw.match(/^\s*/)[0];
    let body = raw.trim();
    if (!body) { out.push(raw); continue; }

    let comment = '';
    const ci = mask(body).indexOf('//');
    if (ci >= 0) { comment = ' ' + body.slice(ci); body = body.slice(0, ci).trim(); }
    if (!body) { out.push(indent + comment.trim()); continue; }
    body = body.replace(/;$/, '');

    let pending = [];
    let m;

    // English operators
    body = mapCode(body, t => t
      .replace(/\bisnt\b/g, '!==').replace(/\bis\b/g, '===')
      .replace(/\band\b/g, '&&').replace(/\bor\b/g, '||')
      .replace(/\bnot\s+/g, '!'));

    if ((m = body.match(/^([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)$/)) &&
        resolve(m[1]) && !resolve(m[2]) && !isDeclared(m[2]) && !KEYWORDS.has(m[2])) {
      // `log = a`  ->  rename built-in
      aliases[m[2]] = resolve(m[1]);
      callMap[m[2]] = aliases[m[2]];
      if (comment) out.push(indent + comment.trim());
      continue;
    } else if ((m = body.match(/^(\}\s*)?(else\s+if|if|while)\s+(.+?)\s*\{$/))) {
      let cond = command(m[3]);
      if (!wrapped(cond)) cond = `(${cond})`;
      body = `${m[1] || ''}${m[2]} ${cond} {`;
    } else if ((m = body.match(/^for\s+([A-Za-z_]\w*)\s+(of|in)\s+(.+?)\s*\{$/))) {
      pending = [m[1]];
      body = `for (const ${m[1]} ${m[2]} ${command(m[3])}) {`;
    } else if ((m = body.match(/^return\s+(.+)$/))) {
      body = `return ${command(m[1])}`;
    } else if ((m = body.match(/^(export\s+)?(async\s+)?task\s+([A-Za-z_]\w*)\s*(?:,\s*(.*?))?\s*\{$/))) {
      // `task name, a, b {`  ->  `function name(a, b) {`
      const params = m[4] || '';
      pending = splitTopLevel(params).map(x => (x.trim().match(/^\.{0,3}([A-Za-z_]\w*)/) || [])[1]).filter(Boolean);
      body = `${m[1] || ''}${m[2] || ''}function ${m[3]}(${params}) {`;
    } else if ((m = body.match(/^(?:export\s+)?(?:async\s+)?function\b/))) {
      const p = body.match(/\(([^)]*)\)/);
      if (p) pending = splitTopLevel(p[1]).map(x => (x.trim().match(/^\.{0,3}([A-Za-z_]\w*)/) || [])[1]).filter(Boolean);
    } else if ((m = body.match(/^(?:(let|const|var)\s+)?([A-Za-z_]\w*)(\s*:\s*[^=]+?)?\s*=(?![=>])\s*(.+)$/)) &&
               !KEYWORDS.has(m[2])) {
      const kw = m[1] || (isDeclared(m[2]) ? '' : 'let');
      scopes[scopes.length - 1].add(m[2]);
      body = `${kw ? kw + ' ' : ''}${m[2]}${m[3] || ''} = ${command(m[4])}`;
    } else if (/^[A-Za-z_]\w*$/.test(body) && funcs.has(body) && !isDeclared(body)) {
      body = body + '()';   // bare task name = call with no args
    } else {
      body = command(body);
    }

    // paren-style calls to built-ins / aliases: log(x) -> console.log(x)
    body = mapCode(body, t => t.replace(/(^|[^.\w$])([A-Za-z_]\w*)(?=\s*\()/g,
      (all, pre, name) => (callMap[name] && callMap[name] !== name ? pre + callMap[name] : all)));

    // track block scopes
    for (const c of mask(body)) {
      if (c === '}' && scopes.length > 1) scopes.pop();
      else if (c === '{') { scopes.push(new Set(pending)); pending = []; }
    }

    out.push(indent + body + comment);
  }
  return out.join('\n');
}

// Plain-JS stdin prompt for running under Node (browsers already have prompt()).
const NODE_PRELUDE = `const __fs = require('fs');
function prompt(q) {
  process.stdout.write((q || '') + ' ');
  const buf = Buffer.alloc(1); let line = '';
  while (true) {
    let n;
    try { n = __fs.readSync(0, buf, 0, 1, null); }
    catch (e) { if (e.code === 'EAGAIN') continue; if (e.code === 'EOF') break; throw e; }
    if (n === 0) break;
    const ch = buf.toString();
    if (ch === '\\n') break;
    if (ch !== '\\r') line += ch;
  }
  return line;
}
`;

// ---- CLI ----
function main() {
  let [cmd, file, ...rest] = process.argv.slice(2);
  if (cmd && cmd.endsWith('.simple')) { rest = [file, ...rest].filter(Boolean); file = cmd; cmd = 'run'; }
  if (!cmd || !file) {
    console.log('usage: simplescript <build|run> file.simple [-o out.ts]');
    process.exit(1);
  }
  const ts = compile(fs.readFileSync(file, 'utf8'));

  if (cmd === 'build') {
    const oi = rest.indexOf('-o');
    const outFile = oi >= 0 ? rest[oi + 1] : file.replace(/\.simple$/, '') + '.ts';
    fs.writeFileSync(outFile, ts + '\n');
    console.log('wrote ' + outFile);
  } else if (cmd === 'run') {
    let code = NODE_PRELUDE + ts;
    try {
      code = require('typescript').transpileModule(code, {
        compilerOptions: { target: 'ES2020', module: 'commonjs' },
      }).outputText;
    } catch { /* typescript not installed: run as-is (fine if you used no type annotations) */ }
    const tmp = path.join(os.tmpdir(), `ss-${Date.now()}.js`);
    fs.writeFileSync(tmp, code);
    const r = cp.spawnSync(process.execPath, [tmp], { stdio: 'inherit' });
    fs.unlinkSync(tmp);
    process.exit(r.status ?? 1);
  } else {
    console.log('unknown command: ' + cmd);
    process.exit(1);
  }
}

if (require.main === module) main();
module.exports = { compile };
