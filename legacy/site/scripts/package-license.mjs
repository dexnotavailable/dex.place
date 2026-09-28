import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
/** Pinned fallback only where the installed package omitted its full notice. */
export async function readPackageLicense(site,folder,metadata){
 const names=await readdir(folder),file=names.find(n=>/^licen[cs]e(?:\.md|\.txt)?$/i.test(n))||names.find(n=>/^(?:COPYING|OFL)(?:\.txt|\.md)?$/i.test(n));
 if(file){const source=path.join(folder,file),bytes=await readFile(source);return{file,source,bytes,sha256:sha(bytes)};}
 if(metadata.name==='@bufbuild/protobuf'&&metadata.version==='1.10.1'&&metadata.license==='(Apache-2.0 AND BSD-3-Clause)'){
  const apache=path.join(site,'scripts/licenses/bufbuild-protobuf-1.10.1-Apache-2.0.txt'),bytes=await readFile(apache);
  if(sha(bytes)!=='6da19f017fad6716cbc9c938972ebee29957c295b8a4d51060dfb03da51d8502')throw Error('Pinned Buf license text changed');
  const google=path.join(folder,'dist/esm/google/varint.js'),source=await readFile(google,'utf8'),header=source.split('/* eslint-disable',1)[0];
  if(!header.startsWith('// Copyright 2008 Google Inc.')||!header.includes('THIS SOFTWARE IS PROVIDED')||!header.includes('above license.'))throw Error('Bundled Google BSD notice needs review');
  const combined=Buffer.from(bytes.toString('utf8')+'\n\nGoogle-derived runtime notice (BSD-3-Clause):\n'+header.replace(/^\/\/ ?/gm,'')+'\n');
  return{file:'upstream-Apache-plus-bundled-Google-BSD',source:apache,bytes:combined,sha256:sha(combined),sourceUrl:'https://raw.githubusercontent.com/bufbuild/protobuf-es/v1.10.1/LICENSE',supplement:{source:google,sourceSha256:sha(Buffer.from(source))}};
 }
 throw Error('Bundled package has no reviewed full license: '+metadata.name+'@'+metadata.version);
}
