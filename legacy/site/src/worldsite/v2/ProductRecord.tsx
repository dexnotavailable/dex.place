import {useEffect,useRef,useState} from 'react';
import {ArrowDownToLine, ArrowUpRight, Check, Copy} from 'lucide-react';
import {download as latestDownload,documentationReleases} from '../content';
import {copyText,FoldSelect} from '../ui';

export function ProductRecord({path,onNavigate}:{path:string;onNavigate:(path:string)=>void}) {
 const [status,setStatus]=useState('');
 const copyAttempt=useRef(0);
 const route=new URL(path,location.origin),parts=route.pathname.split('/').filter(Boolean);
 const releases=documentationReleases.filter(item=>item.productId===latestDownload.productId);
 const download=releases.find(item=>Object.entries({version:item.version,release:item.releaseId,artifact:item.artifactId}).every(([key,value])=>!route.searchParams.has(key)||route.searchParams.get(key)===value))||latestDownload;
 const invalid=parts.length>2||parts[1]&&parts[1]!==download.productId;
 const selection:Record<string,string>={version:download.version,release:download.releaseId,artifact:download.artifactId,os:'all',arch:'all'};
 const invalidSelection=Object.entries(selection).some(([key,value])=>route.searchParams.has(key)&&(route.searchParams.getAll(key).length!==1||route.searchParams.get(key)!==value));
 const available=download.status==='available'&&download.bytes>0&&/^[a-f0-9]{64}$/i.test(download.sha256);
 useEffect(()=>{copyAttempt.current++;setStatus('');return()=>{copyAttempt.current++}},[download.url]);
 const copyChecksum=()=>{const attempt=++copyAttempt.current;void copyText(download.sha256).then(()=>{if(attempt===copyAttempt.current)setStatus('Checksum copied.')}).catch(()=>{if(attempt===copyAttempt.current)setStatus('Select the checksum to copy it.')})};
 if(invalid||invalidSelection)return <div className="v2-empty"><h3>{invalid?'Product not found':'File selection unavailable'}</h3><button onClick={()=>onNavigate('/downloads')}>Back to downloads</button></div>;
 return <article className="v2-product-record">
  <div className="v2-record-cover" aria-hidden="true"><div className="v2-paper-stack"><span/><span/><div><i>dex</i><b>DOCUMENTATION</b><small>{download.version}</small></div></div></div>
  <div className="v2-record-copy"><p className="v2-kicker">dex.place / {download.format}</p><h3>{download.title}</h3><p>{download.summary}</p>
   <dl className="v2-file-facts"><div><dt>Version</dt><dd><FoldSelect label="Documentation version" value={download.version} options={releases.map(item=>({value:item.version,label:item.version}))} onChange={version=>{setStatus('');onNavigate(`/downloads/${encodeURIComponent(download.productId)}?version=${encodeURIComponent(version)}`)}}/></dd></div><div><dt>Size</dt><dd>{available?`${(download.bytes/1024).toFixed(0)} KB`:'Unavailable'}</dd></div><div><dt>Platform</dt><dd>Any</dd></div></dl>
   <div className="v2-record-actions"><a className="v2-button solid" href={available?download.url:undefined} download={download.filename} aria-disabled={!available} onClick={event=>{if(!available){event.preventDefault();return}setStatus('Download requested.')}}><ArrowDownToLine size={17}/>Download</a><a className="v2-inline-link" href={download.documentationUrl} onClick={e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();onNavigate(download.documentationUrl)}}>Read online<ArrowUpRight size={16}/></a></div>
   <details className="v2-file-details"><summary>File details</summary><p>{download.filename}</p><small>SHA-256</small><code>{download.sha256}</code><button className="v2-inline-link" disabled={!available} onClick={copyChecksum}>{status==='Checksum copied.'?<Check size={14}/>:<Copy size={14}/>}Copy checksum</button></details>
   <p className="v2-inline-status" role="status">{status}</p>
  </div>
 </article>;
}
