import {readFile,readdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const assetExtension=/\.(?:avif|css|gif|html|ico|jpe?g|js|json|m4a|md|mp3|ogg|opus|otf|png|sha1|sha256|svg|ttf|txt|wav|wasm|webp|woff2?|zip)$/i;
const textExtension=/\.(?:css|html|js|json)$/i;
const origin='https://dex.place';
function reference(value,fromFile){
  if(typeof value!=='string')return null;
  const clean=value.trim().replace(/\\\//g,'/').replace(/&amp;/g,'&');
  if(!clean||/^(?:data:|blob:|#)/i.test(clean))return null;
  let url;try{url=new URL(clean,origin+'/'+fromFile)}catch{return null;}
  if(url.origin!==origin||!assetExtension.test(url.pathname))return null;
  const pathname=decodeURIComponent(url.pathname);
  if(pathname.includes('\\')||pathname.includes('\0'))throw new Error('Unsafe asset reference in '+fromFile);
  return pathname;
}
/** Concrete literal URLs plus Vite's declared chunk graph, not speculative JS evaluation. */
export function extractAssetReferences(text,fromFile){
  const found=new Set();const add=value=>{const url=reference(value,fromFile);if(url)found.add(url)};
  if(fromFile.endsWith('.js')){
    // Exact JS literals include imports and runtime manifests, while documentation
    // Markdown inside a large string is not itself a browser asset request.
    const source=ts.createSourceFile(fromFile,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    const visit=node=>{if((ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))&&/^(?:\/(?!\/)|\.\.?\/|https:\/\/dex\.place\/)/.test(node.text))add(node.text);ts.forEachChild(node,visit)};visit(source);
    return [...found].sort();
  }
  if(fromFile.endsWith('.json')){
    let json;try{json=JSON.parse(text)}catch{throw new Error('Invalid staged JSON: '+fromFile)}
    const visit=value=>{if(typeof value==='string'&&(value.startsWith('/')||value.startsWith(origin+'/')))add(value);else if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')Object.values(value).forEach(visit)};visit(json);
    return [...found].sort();
  }
  for(const match of text.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/gi))add(match[1]||match[2]||match[3]);
  for(const match of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi))add(match[1]);
  for(const match of text.matchAll(/["'`]((?:\/(?!\/)|\.\.?\/)[^"'`\s<>\\]+)["'`]/g))add(match[1]);
  return [...found].sort();
}
async function walk(root,relative=''){
  const found=[];for(const item of await readdir(path.join(root,relative),{withFileTypes:true})){
    const rel=path.posix.join(relative,item.name);if(item.isSymbolicLink())throw new Error('Unexpected staged link: '+rel);
    if(item.isDirectory())found.push(...await walk(root,rel));else if(item.isFile())found.push(rel);
  }return found;
}
export async function inspectReleaseDependencies(stage,{buildManifestPath}={}){
  const staged=await walk(stage),stagedSet=new Set(staged),references=new Map();
  const add=(url,from)=>{if(!references.has(url))references.set(url,new Set());references.get(url).add(from)};
  for(const file of staged.filter(file=>textExtension.test(file))){
    for(const url of extractAssetReferences(await readFile(path.join(stage,file),'utf8'),file))add(url,file);
  }
  if(buildManifestPath){
    const build=JSON.parse(await readFile(buildManifestPath,'utf8'));
    for(const entry of Object.values(build))for(const relative of [entry.file,...entry.css||[],...entry.assets||[]])if(relative)add('/'+relative,'Vite build manifest');
  }
  const missing=[];
  for(const [url,from] of references){const relative=url.slice(1);if(!stagedSet.has(relative)||!(await lstat(path.join(stage,relative))).isFile())missing.push({url,referencedBy:[...from]});}
  return {status:missing.length?'fail':'pass',filesScanned:staged.filter(f=>textExtension.test(f)).length,references:[...references].map(([url,from])=>({url,referencedBy:[...from]})).sort((a,b)=>a.url.localeCompare(b.url)),missing};
}
