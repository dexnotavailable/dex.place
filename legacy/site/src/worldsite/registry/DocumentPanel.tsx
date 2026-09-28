import {useEffect,useMemo,useRef,useState} from 'react';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {documentation,documentationEdition,resolveDocumentationHref} from '../content';
export default function DocsPanel(){
 const [query,setQuery]=useState(''),[slug,setSlug]=useState(''),[anchor,setAnchor]=useState('');const article=useRef<HTMLDivElement>(null);
 const docs=documentation.filter(d=>d.versionId===documentationEdition.version),doc=docs.find(d=>d.slug===slug);
 const html=useMemo(()=>doc?DOMPurify.sanitize(marked.parse(doc.bodyMarkdown,{async:false}) as string):'',[doc]);
 useEffect(()=>{if(anchor)requestAnimationFrame(()=>article.current?.querySelector(`[id="${CSS.escape(anchor)}"]`)?.scrollIntoView({block:'start'}));else article.current?.scrollTo({top:0})},[html,anchor]);
 if(doc)return <><button className="registry-back" onClick={()=>{setSlug('');setAnchor('')}}>← All records</button><div ref={article} className="registry-doc" onClick={e=>{const link=(e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement|null;if(!link)return;const raw=link.getAttribute('href')!;const href=resolveDocumentationHref(raw,doc.slug,doc.versionId);if(href){e.preventDefault();const url=new URL(href,location.origin);setSlug(url.pathname.split('/').at(-1)!);setAnchor(decodeURIComponent(url.hash.slice(1)))}else if(raw.startsWith('#')){e.preventDefault();setAnchor(raw.slice(1))}}} dangerouslySetInnerHTML={{__html:html}}/></>;
 const matches=docs.filter(d=>!query||(`${d.title} ${d.bodyMarkdown}`).toLowerCase().includes(query.toLowerCase()));
 return <><label className="registry-search"><span>Search records</span><input value={query} onChange={e=>setQuery(e.target.value)} type="search"/></label><p className="registry-note">Documentation edition {documentationEdition.version}</p><div className="registry-record-list">{matches.map(d=><button key={d.id} onClick={()=>setSlug(d.slug)}><span>{d.title}</span><span aria-hidden="true">↗</span></button>)}</div>{!matches.length&&<p>No records match.</p>}</>;
}
