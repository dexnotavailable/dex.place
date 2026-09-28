import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import ts from 'typescript';

const families=['music','ambience','effects'];
const baseEffects=['slash-1','slash-2','landing'];
const materialEffects={concrete:['step-concrete-1','step-concrete-2'],metal:['step-metal-1','step-metal-2']};
const kindEffects={home:['confirm'],terminal:['confirm'],file:['paper-open'],gallery:['confirm'],donate:['confirm'],cable:['cable-cut'],bridge:['hit-metal'],seal:['paper-cut'],ornament:['hit-metal'],lift:['lift-start','lift-dock'],landing:['lift-start','lift-dock'],map:['cable-cut','paper-open'],shortcut:['hit-metal'],mob:['hit-metal','hurt','defeat'],door:[],product:[],resident:[]};
const bossEffects=['hit-metal','telegraph','hurt','victory','defeat'];
const sorted=values=>[...new Set(values)].sort();
const hash=text=>createHash('sha256').update(text).digest('hex');
const properties=object=>Object.fromEntries((object.properties||[]).map(p=>[p.name,p.value]));
const kind=object=>object.class||object.type||'';
function source(text,name){return ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);}
function stringUnion(file,name){
  const node=file.statements.find(n=>ts.isTypeAliasDeclaration(n)&&n.name.text===name);
  if(!node||!ts.isUnionTypeNode(node.type))throw Error('Audio audit requires the explicit '+name+' union');
  return node.type.types.map(n=>{if(!ts.isLiteralTypeNode(n)||!ts.isStringLiteral(n.literal))throw Error('Nonliteral '+name+' requires an audio-selection audit');return n.literal.text});
}
async function moduleFor(text){
  const result=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputText).toString('base64'));
}
function selectedMethods(file,className,predicate){
  const node=file.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text===className);
  if(!node)throw Error('Audio contract class missing: '+className);
  const printer=ts.createPrinter({removeComments:true});
  return node.members.filter(m=>ts.isMethodDeclaration(m)&&predicate(m)).map(m=>({name:m.name.getText(file),text:printer.printNode(ts.EmitHint.Unspecified,m,file)})).sort((a,b)=>a.name.localeCompare(b.name));
}
function emitsEffect(method){let found=false;function visit(node){if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.kind===ts.SyntaxKind.ThisKeyword&&node.expression.name.text==='effect')found=true;ts.forEachChild(node,visit)}visit(method);return found;}
function hostAudioContract(text,name){
  const file=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),printer=ts.createPrinter({removeComments:true}),rows=[];
  const handlers=new Set(['clearInputs','openInspector','closeInspector','enter','enableSound']);
  function visit(node){
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&handlers.has(node.name.text))rows.push({name:node.name.text,text:printer.printNode(ts.EmitHint.Unspecified,node,file)});
    if(ts.isCaseClause(node)&&ts.isStringLiteral(node.expression)&&node.expression.text==='effect')rows.push({name:'effect-dispatch',text:printer.printNode(ts.EmitHint.Unspecified,node,file)});
    if(ts.isArrowFunction(node)&&node.body.getText(file).includes('audio.current.setScene('))rows.push({name:'scene-audio-sync',text:printer.printNode(ts.EmitHint.Unspecified,node,file)});
    ts.forEachChild(node,visit);
  }
  visit(file);
  if(!rows.some(r=>r.name==='effect-dispatch')||!rows.some(r=>r.name==='scene-audio-sync'))throw Error('App audio dispatch/scene synchronization requires review');
  return rows.sort((a,b)=>a.name.localeCompare(b.name));
}

/** Recomputed from actual source/map every preparation; no hardcoded active list here. */
export async function inspectAudioRequirements(site,map){
  const activeMap=await inspectActiveAudioMap(site);
  if(JSON.stringify(map)!==JSON.stringify(activeMap.map))throw Error('Audio audit received a stale map; actual PUBLIC_ASSETS.map is '+activeMap.url);
  const names=['src/worldsite/audio.ts','src/worldsite/audio-direction.ts','src/worldsite/experience.ts','src/worldsite/game/WorldScene.ts','src/worldsite/game/population.ts','src/worldsite/game/assets.ts','src/worldsite/v2/main.tsx'];
  const texts=await Promise.all(names.map(name=>readFile(path.join(site,name),'utf8')));
  const audioSource=source(texts[0],names[0]),directionSource=source(texts[1],names[1]),worldSource=source(texts[3],names[3]),populationSource=source(texts[4],names[4]);
  const effects=stringUnion(audioSource,'AudioEffect'),regions=stringUnion(directionSource,'AudioRegion'),contents=stringUnion(directionSource,'AudioContent');
  const regionFunction=audioSource.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='audioRegionFor');
  if(!regionFunction)throw Error('Actual audioRegionFor mapping is missing');
  const [direction,geography,experience]=await Promise.all([moduleFor(texts[1]),moduleFor(regionFunction.getText(audioSource)),moduleFor(texts[2])]);
  if(typeof experience.EXPERIENCE?.encountersConfigured!=='boolean')throw Error('Encounter configuration must be explicit for audio selection');
  const covered=sorted([...baseEffects,...Object.values(materialEffects).flat(),...Object.values(kindEffects).flat(),...bossEffects,'paper-open','paper-cut']);
  if(JSON.stringify(sorted(effects))!==JSON.stringify(covered))throw Error('AudioEffect vocabulary changed; audit and extend the requirement rules before release');
  const objects=map.layers?.find(l=>l.name==='objects')?.objects;
  const solids=map.layers?.find(l=>l.name==='collision')?.objects;
  if(!objects||!solids)throw Error('Audio selection requires actual Tiled object/collision layers');
  const requiredEffects=new Set(baseEffects),reasons={};
  const add=(id,reason)=>{requiredEffects.add(id);(reasons[id]??=[]).push(reason)};
  const materials=new Set();
  for(const solid of solids){
    const value=properties(solid).material;
    if(value==='metal')materials.add('metal');
    else if(value===undefined||value==='concrete'||value==='causeway-concrete')materials.add('concrete');
    else throw Error('Unknown supporting material needs an audio rule: '+value);
  }
  for(const object of objects){
    const type=kind(object),props=properties(object);
    if(type==='banner')for(const id of ['paper-open',props.mechanism==='latched'?'hit-metal':'paper-cut'])add(id,'banner '+object.name+' ('+(props.mechanism||'legacy')+')');
    else {if(!(type in kindEffects))throw Error('Unknown map object kind needs an audio rule: '+type);for(const id of kindEffects[type])add(id,type+' '+object.name);}
    if(type==='bridge'||type==='lift')materials.add('metal');
  }
  for(const material of materials)for(const id of materialEffects[material])add(id,'support material '+material);
  if(experience.EXPERIENCE.encountersConfigured)for(const id of bossEffects)add(id,'configured encounter');
  const labels=map.layers.find(l=>l.name==='camera_bounds')?.objects.map(o=>String(properties(o).label||''))||[];
  const requiredRegions=new Set(['arrival','downloads','documentation','illustrations','donate',...labels].map(label=>geography.audioRegionFor(label)));
  if(experience.EXPERIENCE.encountersConfigured)requiredRegions.add('boss');else requiredRegions.delete('boss');
  const music=new Set(),ambience=new Set(),plans=[];
  for(const region of requiredRegions){
    if(!regions.includes(region))throw Error('Actual region mapping returned an unknown audio region: '+region);
    for(const content of contents){
      const plan=direction.resolveAudioDirection({region,content});
      if(!plan||!['string','object'].includes(typeof plan.music)||!['string','object'].includes(typeof plan.ambience))throw Error('Invalid audio direction plan');
      if(plan.music!==null){if(typeof plan.music!=='string'||!plan.music)throw Error('Invalid music key');music.add(plan.music)}
      if(plan.ambience!==null){if(typeof plan.ambience!=='string'||!plan.ambience)throw Error('Invalid ambience key');ambience.add(plan.ambience)}
      plans.push({region,content,music:plan.music,ambience:plan.ambience});
    }
  }
  // This seal prevents changed event semantics or loader behavior from silently
  // outgrowing the reviewed map-to-effect rules. Data-only map additions are
  // independently derived above; comments/formatting do not change the seal.
  const lifecycle=new Set(['effect','command','inspect','inspectMap','beginInspection','endInspection','loadRoom','setRoom','update','fixedStep','renderWorld','invalidateRenderer']);
  const contract={auditVersion:2,world:selectedMethods(worldSource,'WorldScene',m=>lifecycle.has(m.name.getText(worldSource))||emitsEffect(m)),population:selectedMethods(populationSource,'Population',emitsEffect),manager:selectedMethods(audioSource,'WorldAudioManager',()=>true),host:hostAudioContract(texts[6],names[6])};
  return {required:{music:sorted(music),ambience:sorted(ambience),effects:sorted(requiredEffects)},effectContractSha256:hash(JSON.stringify(contract)),encountersConfigured:experience.EXPERIENCE.encountersConfigured,materials:sorted(materials),objectKinds:sorted(objects.map(kind)),regionLabels:labels,plans,reasons,mapUrl:activeMap.url,sourceHashes:{...Object.fromEntries(names.map((name,i)=>[name,hash(texts[i])])),[activeMap.relative]:activeMap.sha256}};
}

/** Read the same reviewed asset declaration as WorldScene, not a legacy map. */
export async function inspectActiveAudioMap(site){
  const text=await readFile(path.join(site,'src/worldsite/game/assets.ts'),'utf8');
  const {PUBLIC_ASSETS}=await moduleFor(text),url=PUBLIC_ASSETS?.map;
  if(typeof url!=='string'||!/^\/world\/maps\/[A-Za-z0-9_-]+\.json$/.test(url))throw Error('Actual public map URL needs an audio-selection audit');
  const relative='public'+url,bytes=await readFile(path.join(site,relative));
  return {url,relative,sha256:hash(bytes),map:JSON.parse(bytes.toString('utf8')),assets:PUBLIC_ASSETS};
}

export function runtimeSelectionConfig(audio){
  const selection=audio.activeRuntime;
  if(!selection||selection.schemaVersion!==1||typeof selection.id!=='string')throw Error('Audio manifest needs an explicit activeRuntime selection');
  const result={schemaVersion:1,id:selection.id,music:selection.music,ambience:selection.ambience,effects:selection.effects,files:{},buffers:{}};
  const seen=new Set();
  for(const family of families){
    if(!Array.isArray(selection[family])||new Set(selection[family]).size!==selection[family].length)throw Error('Invalid/duplicate active '+family+' selection');
    for(const id of selection[family]){
      if(typeof id!=='string'||seen.has(id))throw Error('Duplicate/non-string active audio ID');seen.add(id);
      const rows=(audio[family]||[]).filter(row=>row.id===id);if(rows.length!==1)throw Error('Active audio entry missing/ambiguous: '+id);
      const row=rows[0],sampleRate=row.sampleRate,channels=row.channels;
      const frameCount=row.frameCount??Math.round(row.durationSeconds*sampleRate);
      if(!Number.isInteger(sampleRate)||sampleRate<8000||!Number.isInteger(channels)||channels<1||channels>2||!Number.isInteger(frameCount)||frameCount<1||!Number.isFinite(row.durationSeconds)||Math.abs(frameCount/sampleRate-row.durationSeconds)>1/sampleRate)throw Error('Active audio duration/frame metadata invalid: '+id);
      result.buffers[id]={sampleRate,channels,frameCount};
      if(family!=='effects'){
        const loopStartFrame=row.loopStartFrame??Math.round((row.loopStartSeconds??0)*sampleRate),loopEndFrame=row.loopEndFrame??Math.round((row.loopEndSeconds??row.durationSeconds)*sampleRate);
        if(!Number.isInteger(loopStartFrame)||!Number.isInteger(loopEndFrame)||loopStartFrame<0||loopEndFrame<=loopStartFrame||loopEndFrame>frameCount)throw Error('Invalid loop frame bounds: '+id);
        Object.assign(result.buffers[id],{loopStartFrame,loopEndFrame});
      }
      const formats=family==='effects'?['wav']:['opus','m4a'];result.files[id]={};
      for(const format of formats){const file=rows[0].files?.[format];if(!file?.url||!Number.isInteger(file.bytes)||file.bytes<1||!/^[a-f0-9]{64}$/i.test(file.sha256))throw Error('Active representation incomplete: '+id+'.'+format);result.files[id][format]=file.url;}
    }
  }
  return result;
}

export function validateActiveAudio(audio,config,requirements){
  const expected=runtimeSelectionConfig(audio);
  if(JSON.stringify(config)!==JSON.stringify(expected))throw Error('Read-only runtime audio selection differs from owner manifest; regenerate selection before release');
  for(const family of families){
    const selected=sorted(audio.activeRuntime[family]);
    if(JSON.stringify(selected)!==JSON.stringify(requirements.required[family])){
      const missing=requirements.required[family].filter(id=>!selected.includes(id)),extra=selected.filter(id=>!requirements.required[family].includes(id));
      throw Error('Active '+family+' selection does not match current runtime/map requirements; missing='+missing.join(',')+'; extra='+extra.join(','));
    }
  }
  if(audio.activeRuntime.guard?.effectContractSha256!==requirements.effectContractSha256)throw Error('Audio emitter/loader contract changed; audit activeRuntime and update its guard before release');
  const selected=Object.fromEntries(families.map(family=>[family,audio[family].filter(row=>audio.activeRuntime[family].includes(row.id))]));
  const reserved=families.flatMap(family=>audio[family].filter(row=>!audio.activeRuntime[family].includes(row.id)).map(row=>({family,id:row.id,listeningStatus:row.listeningStatus,reason:family==='music'?'Not selected by current audio direction':row.id==='paper-cut'?'No seal or legacy cut-banner in current map':bossEffects.includes(row.id)?'Encounter disabled; current map has no use':'Not required by current map/gameplay'})));
  return {selection:expected,selected,reserved,requirements};
}

export function projectActiveAudio(audio,audit){
  const result={version:audio.version,activeRuntime:audit.selection,music:[],ambience:[],effects:[]};
  for(const family of families)for(const track of audit.selected[family]){
    const row={};for(const key of ['id','durationSeconds','sampleRate','channels','frameCount','loopStartSeconds','loopEndSeconds','loopStartFrame','loopEndFrame','transitionMode','files','listeningStatus','productionStatus','attributions'])if(track[key]!==undefined)row[key]=track[key];
    result[family].push(row);
  }
  return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.some(arg=>!['--check','--write-runtime-config'].includes(arg)))throw Error('Usage: node scripts/audio-runtime-selection.mjs [--check | --write-runtime-config]');
  const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const audio=JSON.parse(await readFile(path.join(site,'public/audio/world-v1/manifest.json'),'utf8'));
  const {map}=await inspectActiveAudioMap(site);
  const required=await inspectAudioRequirements(site,map),configPath=path.join(site,'src/worldsite/audio-runtime-selection.json');
  const config=args.includes('--write-runtime-config')?runtimeSelectionConfig(audio):JSON.parse(await readFile(configPath,'utf8'));
  const audit=validateActiveAudio(audio,config,required);
  if(args.includes('--write-runtime-config'))await writeFile(configPath,JSON.stringify(config,null,2)+'\n');
  console.log(JSON.stringify({status:'pass',selection:config.id,active:required.required,reserved:audit.reserved.map(r=>r.id),runtimeConfigWritten:args.includes('--write-runtime-config'),listeningStatusesChanged:false},null,2));
}
