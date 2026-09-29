// Tiny build-time syntax colouring for code blocks in docs and posts. No
// runtime JS: the output is plain <span class="t-*"> markup. Covers what the
// docs actually show (shell, PowerShell, JS/TS, JSON, YAML front matter);
// anything else is
// escaped and left uncoloured. Token classes are styled in styles/docs.css.
//
//   t-c comment   t-s string   t-n number   t-k keyword   t-v variable
//   t-f flag / parameter       t-p prompt ($ or PS>) at the start of a line

import { esc } from "../render/html.ts";

type Rule = readonly [cls: string, re: RegExp];

const words = (list: string): RegExp => new RegExp(`\\b(?:${list.split(" ").join("|")})\\b`, "y");

const JS_KEYWORDS = words(
  "import export from default const let var function return if else for while do switch case break continue new " +
    "class extends async await try catch finally throw typeof instanceof in of interface type as satisfies readonly " +
    "true false null undefined this void",
);
const SH_KEYWORDS = words("if then else elif fi for in do done while case esac function return export local cd echo npm node npx git");
const PS_KEYWORDS = words(
  "if else elseif foreach for while function param return try catch finally throw " +
    "Get-FileHash Get-ChildItem Set-Location Start-Process Invoke-WebRequest Write-Host",
);

const STRINGS: Rule = ["t-s", /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/y];
const NUMBER: Rule = ["t-n", /\b\d[\d_]*(?:\.\d+)?\b/y];

const LANGS: Record<string, readonly Rule[]> = {
  js: [
    ["t-c", /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
    STRINGS,
    NUMBER,
    ["t-k", JS_KEYWORDS],
  ],
  json: [
    ["t-k", /"(?:[^"\\\n]|\\.)*"(?=\s*:)/y],
    ["t-s", /"(?:[^"\\\n]|\\.)*"/y],
    NUMBER,
    ["t-k", /\b(?:true|false|null)\b/y],
  ],
  sh: [
    ["t-p", /(?<=^|\n)\$ /y],
    ["t-c", /#[^\n]*/y],
    ["t-s", /"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/y],
    ["t-v", /\$\{?[A-Za-z_][\w]*\}?/y],
    ["t-f", /(?<=\s)--?[A-Za-z][\w-]*/y],
    ["t-k", SH_KEYWORDS],
  ],
  ps: [
    ["t-p", /(?<=^|\n)PS[^>\n]*> /y],
    ["t-c", /<#[\s\S]*?#>|#[^\n]*/y],
    ["t-s", /"(?:[^"`\n]|`.)*"|'[^'\n]*'/y],
    ["t-k", PS_KEYWORDS],
    ["t-v", /\$[A-Za-z_][\w:]*/y],
    ["t-f", /(?<=\s)-[A-Za-z][\w]*/y],
    NUMBER,
  ],
  // Front matter and config: keys in the key colour, values two-tone.
  yaml: [
    ["t-c", /(?<=^|\n)---(?=\n|$)|(?<=^|\s)#[^\n]*/y],
    ["t-k", /(?<=(?:^|\n)[ \t]*(?:- )?)[A-Za-z_][\w.-]*(?=:(?:[ \t]|\n|$))/y],
    ["t-s", /"(?:[^"\\\n]|\\.)*"|'[^'\n]*'/y],
    ["t-v", /\b(?:true|false|null|yes|no)\b/y],
    NUMBER,
  ],
};

const ALIASES: Record<string, { key: keyof typeof LANGS | null; label: string }> = {
  js: { key: "js", label: "JavaScript" },
  javascript: { key: "js", label: "JavaScript" },
  mjs: { key: "js", label: "JavaScript" },
  ts: { key: "js", label: "TypeScript" },
  typescript: { key: "js", label: "TypeScript" },
  json: { key: "json", label: "JSON" },
  sh: { key: "sh", label: "Shell" },
  bash: { key: "sh", label: "Shell" },
  shell: { key: "sh", label: "Shell" },
  console: { key: "sh", label: "Shell" },
  ps: { key: "ps", label: "PowerShell" },
  ps1: { key: "ps", label: "PowerShell" },
  powershell: { key: "ps", label: "PowerShell" },
  pwsh: { key: "ps", label: "PowerShell" },
  text: { key: null, label: "Text" },
  txt: { key: null, label: "Text" },
  md: { key: null, label: "Markdown" },
  markdown: { key: null, label: "Markdown" },
  yaml: { key: "yaml", label: "YAML" },
  yml: { key: "yaml", label: "YAML" },
  html: { key: null, label: "HTML" },
  css: { key: null, label: "CSS" },
};

/** Human label for a fence language ("ps1" -> "PowerShell"), or null. */
export function langLabel(lang: string): string | null {
  if (!lang) return null;
  return ALIASES[lang.toLowerCase()]?.label ?? lang.toUpperCase();
}

/** Escaped, coloured HTML for one code block. */
export function highlight(code: string, lang: string): string {
  const key = ALIASES[lang.toLowerCase()]?.key ?? null;
  const rules = key ? LANGS[key] : undefined;
  if (!rules) return esc(code);
  let out = "";
  let plain = "";
  let at = 0;
  outer: while (at < code.length) {
    for (const [cls, re] of rules) {
      re.lastIndex = at;
      const m = re.exec(code);
      if (m && m[0].length) {
        out += esc(plain) + `<span class="${cls}">${esc(m[0])}</span>`;
        plain = "";
        at += m[0].length;
        continue outer;
      }
    }
    // Skip a whole identifier at once so keywords only match at word starts.
    const word = /[A-Za-z_$][\w$-]*/y;
    word.lastIndex = at;
    const w = word.exec(code);
    const step = w && w[0].length ? w[0].length : 1;
    plain += code.slice(at, at + step);
    at += step;
  }
  return out + esc(plain);
}
