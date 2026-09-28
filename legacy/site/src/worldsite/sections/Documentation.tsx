import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ArrowLeft, ArrowRight, Copy, Search } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { documentation, documentationEdition, resolveDocumentationHref, type PublicDocument } from '../content';
import { copyText } from '../ui';
import './section-enhancements.css';

const publicDocs = documentation.filter(doc => doc.status === 'public');
const categories = [...new Set(publicDocs.map(doc => doc.category))];
// Reader return state lasts for this page session; explicit filtered URLs take precedence.
const indexSession = { url: '/documentation', scroll: 0, opener: '', restore: false };
const plainActivation = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
const projectLabel = (id: string) => id === 'dex-place' ? 'dex.place' : id;
const documentUrl = (doc: PublicDocument, heading = '') => `/documentation/${encodeURIComponent(doc.projectId)}/${encodeURIComponent(doc.slug)}?version=${encodeURIComponent(doc.versionId)}${heading ? '#' + encodeURIComponent(heading) : ''}`;

function parseRoute(path: string) {
  const url = new URL(path, window.location.origin);
  const segments = url.pathname.replace(/\/$/, '').split('/').slice(1);
  let project = '', slug = '', heading = '', malformed = false;
  try { project = decodeURIComponent(segments[1] || ''); slug = decodeURIComponent(segments[2] || ''); }
  catch { malformed = true; }
  try { heading = decodeURIComponent(url.hash.slice(1)); } catch { /* A malformed fragment opens at the document top. */ }
  const index = segments.length === 1 && segments[0] === 'documentation';
  if (!index && (segments.length !== 3 || segments[0] !== 'documentation' || !/^[a-z0-9-]+$/.test(project) || !/^[a-z0-9-]+$/.test(slug))) malformed = true;
  const versions = url.searchParams.getAll('version');
  const version = versions.length ? versions[0] : documentationEdition.version;
  const versionValid = versions.length < 2 && publicDocs.some(doc => doc.versionId === version);
  const knownDoc = !index && !malformed ? publicDocs.find(doc => doc.projectId === project && doc.slug === slug) : undefined;
  const doc = versionValid && knownDoc ? publicDocs.find(doc => doc.projectId === project && doc.slug === slug && doc.versionId === version) : undefined;
  return { url, index, malformed, version, versionValid, knownDoc, doc, heading };
}

function renderDocument(doc: PublicDocument | undefined) {
  if (!doc) return { html: '', code: [] as string[] };
  const source = doc.bodyMarkdown.replace(/<a id="[^"]+"><\/a>\s*/g, '');
  const parsed = new DOMParser().parseFromString(marked.parse(source, { async: false }) as string, 'text/html');
  parsed.querySelectorAll('a[href]').forEach(anchor => {
    const resolved = resolveDocumentationHref(anchor.getAttribute('href')!, doc.slug, doc.versionId);
    if (resolved) anchor.setAttribute('href', resolved);
  });
  parsed.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading, index) => {
    const registered = doc.headings[index];
    if (!registered) return;
    heading.id = registered.id;
    heading.setAttribute('tabindex', '-1');
    const row = parsed.createElement('div'); row.className = 'doc-heading';
    heading.replaceWith(row); row.append(heading);
    const button = parsed.createElement('button');
    button.type = 'button'; button.className = 'doc-heading-copy';
    button.dataset.docHeading = registered.id; button.dataset.docCopyLabel = 'Copy link';
    button.setAttribute('aria-label', `Copy link to ${registered.text}`); button.textContent = 'Copy link';
    row.append(button);
  });
  const code: string[] = [];
  parsed.querySelectorAll('pre > code').forEach(block => {
    const pre = block.parentElement!;
    const wrapper = parsed.createElement('div'); wrapper.className = 'doc-code-block'; pre.replaceWith(wrapper);
    const button = parsed.createElement('button'); button.type = 'button'; button.className = 'doc-code-copy';
    button.dataset.docCode = String(code.length); button.dataset.docCopyLabel = 'Copy';
    button.setAttribute('aria-label', `Copy code block ${code.length + 1}`); button.textContent = 'Copy';
    code.push(block.textContent || ''); wrapper.append(button, pre);
  });
  return { html: DOMPurify.sanitize(parsed.body.innerHTML), code };
}

export function Documentation({ path, navigate, replaceLocation }: {
  path: string; navigate: (url: string) => void; replaceLocation?: (url: string) => void;
}) {
  const route = useMemo(() => parseRoute(path), [path]);
  const initial = route.index && route.url.search ? route.url.searchParams : new URL(indexSession.url, location.origin).searchParams;
  const [query, setQuery] = useState(initial.get('q') || '');
  const [category, setCategory] = useState(categories.includes(initial.get('category') || '') ? initial.get('category')! : '');
  const [filterNotice, setFilterNotice] = useState('');
  const [status, setStatus] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [contentsOpen, setContentsOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const restoring = useRef(false);
  const copyAttempt = useRef(0);
  const rendered = useMemo(() => renderDocument(route.doc), [route.doc]);
  const outline = route.doc?.headings.filter(heading => heading.level > 1) || [];
  const filteredDocs = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return publicDocs.filter(doc => doc.versionId === route.version && (!category || doc.category === category) &&
      `${doc.title} ${doc.headings.map(heading => heading.text).join(' ')} ${doc.bodyMarkdown}`.toLocaleLowerCase().includes(search));
  }, [query, category, route.version]);
  const replace = (url: string) => {
    if (replaceLocation) replaceLocation(url); else history.replaceState(history.state, '', url);
  };

  useEffect(() => {
    if (!route.index || !route.versionValid || route.malformed) return;
    const params = route.url.search ? route.url.searchParams : new URL(indexSession.url, location.origin).searchParams;
    const nextQuery = params.get('q') || '';
    const rawCategory = params.get('category') || '';
    const rawProject = params.get('project') || '';
    const nextCategory = categories.includes(rawCategory) ? rawCategory : '';
    const missingFilter = (rawCategory && !nextCategory) || (rawProject && rawProject !== documentationEdition.projectId);
    setQuery(nextQuery); setCategory(nextCategory);
    if (missingFilter) setFilterNotice('An unavailable documentation filter was cleared.');
    const canonical = new URL(route.url);
    if (nextQuery) canonical.searchParams.set('q', nextQuery); else canonical.searchParams.delete('q');
    if (nextCategory) canonical.searchParams.set('category', nextCategory); else canonical.searchParams.delete('category');
    if (rawProject && rawProject !== documentationEdition.projectId) canonical.searchParams.delete('project');
    const indexUrl = canonical.pathname + canonical.search;
    indexSession.url = indexUrl;
    if (indexUrl !== route.url.pathname + route.url.search) replace(indexUrl);
  }, [path]);

  useLayoutEffect(() => {
    const scroller = sectionRef.current?.closest<HTMLElement>('.panel-body');
    if (!route.index || !scroller) return;
    restoring.current = true;
    const restore = requestAnimationFrame(() => {
      scroller.scrollTop = indexSession.scroll;
      if (indexSession.restore) {
        const opener = [...sectionRef.current!.querySelectorAll<HTMLAnchorElement>('[data-doc-result]')].find(link => link.dataset.docResult === indexSession.opener);
        (opener || searchRef.current)?.focus({ preventScroll: true });
        indexSession.restore = false;
      }
      restoring.current = false;
    });
    const rememberScroll = () => { if (!restoring.current) indexSession.scroll = scroller.scrollTop; };
    scroller.addEventListener('scroll', rememberScroll);
    return () => {
      cancelAnimationFrame(restore);
      scroller.removeEventListener('scroll', rememberScroll);
      if (indexSession.opener) indexSession.restore = true;
    };
  }, [route.index]);

  useLayoutEffect(() => {
    copyAttempt.current++;
    setStatus(''); setManualUrl(''); setContentsOpen(false);
    if (route.index) return;
    const frame = requestAnimationFrame(() => {
      const scroller = sectionRef.current?.closest<HTMLElement>('.panel-body');
      const heading = route.doc?.headings.some(item => item.id === route.heading)
        ? [...(articleRef.current?.querySelectorAll<HTMLElement>('[id]') || [])].find(item => item.id === route.heading) : undefined;
      if (heading) {
        heading.scrollIntoView({ block: 'start', behavior: 'auto' }); heading.focus({ preventScroll: true });
      } else {
        if (scroller) scroller.scrollTop = 0;
        sectionRef.current?.querySelector<HTMLElement>('.doc-reader-title, .doc-unavailable')?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [route.index, route.doc, route.heading, route.malformed, route.version]);

  const changeFilters = (nextQuery: string, nextCategory: string) => {
    setQuery(nextQuery); setCategory(nextCategory); setFilterNotice('');
    const url = new URL(location.href); url.pathname = '/documentation'; url.hash = '';
    if (nextQuery) url.searchParams.set('q', nextQuery); else url.searchParams.delete('q');
    if (nextCategory) url.searchParams.set('category', nextCategory); else url.searchParams.delete('category');
    indexSession.url = url.pathname + url.search; indexSession.scroll = 0; replace(indexSession.url);
  };
  const rememberIndex = (id: string) => {
    indexSession.scroll = sectionRef.current?.closest<HTMLElement>('.panel-body')?.scrollTop || 0;
    indexSession.opener = id; indexSession.restore = true;
  };
  const backLink = <a className="text-button" href={indexSession.url} onClick={event => {
    if (!plainActivation(event)) return;
    event.preventDefault(); indexSession.restore = true; navigate(indexSession.url);
  }}><ArrowLeft size={15} />Back to documentation</a>;
  const copy = async (text: string, kind: 'link' | 'code', button?: HTMLButtonElement) => {
    const attempt = ++copyAttempt.current;
    setStatus(''); setManualUrl('');
    sectionRef.current?.querySelectorAll<HTMLButtonElement>('[data-doc-copy-label]').forEach(item => { item.textContent = item.dataset.docCopyLabel!; });
    try {
      await copyText(text);
      if (attempt !== copyAttempt.current) return;
      if (button?.isConnected) button.textContent = 'Copied';
      setStatus('Copied');
    }
    catch {
      if (attempt !== copyAttempt.current) return;
      setStatus(kind === 'link' ? 'Copy failed. Select and copy the link below.' : 'Copy failed. Select and copy the code from this block.');
      if (kind === 'link') setManualUrl(text);
    }
  };
  const onArticleClick = (event: MouseEvent<HTMLElement>) => {
    const element = event.target as HTMLElement;
    const button = element.closest<HTMLButtonElement>('button[data-doc-heading],button[data-doc-code]');
    if (button && route.doc) {
      if (button.dataset.docHeading) void copy(new URL(documentUrl(route.doc, button.dataset.docHeading), location.origin).href, 'link', button);
      else if (button.dataset.docCode !== undefined) void copy(rendered.code[Number(button.dataset.docCode)], 'code', button);
      return;
    }
    const anchor = element.closest<HTMLAnchorElement>('a[href]');
    if (anchor && plainActivation(event) && anchor.getAttribute('href')?.startsWith('/documentation/')) {
      event.preventDefault(); openDocumentLink(anchor.getAttribute('href')!);
    }
  };
  const openDocumentLink = (url: string) => {
    // Selecting the current fragment again still returns to it after manual scrolling.
    const target = parseRoute(url);
    if (target.doc === route.doc && target.heading === route.heading && target.heading) {
      const heading = [...(articleRef.current?.querySelectorAll<HTMLElement>('[id]') || [])].find(item => item.id === target.heading);
      heading?.scrollIntoView({ block: 'start', behavior: 'auto' });
      heading?.focus({ preventScroll: true });
    }
    navigate(url);
  };

  if (route.malformed || !route.versionValid || (!route.index && !route.doc)) return <div ref={sectionRef} className="documentation-section">
    {backLink}{route.knownDoc && <h2>{route.knownDoc.title}</h2>}
    <p className="doc-unavailable" tabIndex={-1}>{!route.versionValid || route.knownDoc ? 'This document is not available in that version.' : 'This item is unavailable.'}</p>
  </div>;

  return <div ref={sectionRef} className="documentation-section">{route.doc ? <>
    <div className="article-toolbar">{backLink}<button className="text-button" onClick={() => void copy(new URL(documentUrl(route.doc!, route.doc!.headings.some(heading => heading.id === route.heading) ? route.heading : ''), location.origin).href, 'link')}><Copy size={14} />Copy link</button></div>
    <p className="edition doc-reader-title" tabIndex={-1}>{projectLabel(route.doc.projectId)} · Version {route.doc.versionId}</p>
    <div className="article-layout">
      {outline.length > 0 && <div className="doc-contents">
        <button className="doc-contents-toggle" aria-expanded={contentsOpen} aria-controls="doc-contents-links" onClick={() => setContentsOpen(open => !open)}>Contents<span aria-hidden="true">{contentsOpen ? '−' : '+'}</span></button>
        <nav id="doc-contents-links" className={'doc-contents-links' + (contentsOpen ? ' is-open' : '')} aria-label="Contents">
          {outline.map(heading => <a className={'doc-outline-level-' + heading.level} href={documentUrl(route.doc!, heading.id)} key={heading.id} onClick={event => {
            if (!plainActivation(event)) return;
            event.preventDefault(); setContentsOpen(false); openDocumentLink(documentUrl(route.doc!, heading.id));
          }}>{heading.text}</a>)}
        </nav>
      </div>}
      <article ref={articleRef} className="markdown" onClick={onArticleClick} dangerouslySetInnerHTML={{ __html: rendered.html }} />
    </div>
  </> : <>
    <label className="search-field"><Search size={17} /><input ref={searchRef} placeholder="Search documentation" aria-label="Search documentation" value={query} onChange={event => changeFilters(event.target.value, category)} />{query && <button onClick={() => { changeFilters('', category); searchRef.current?.focus(); }}>Clear</button>}</label>
    <div className="doc-index-filters"><p className="edition">{projectLabel(documentationEdition.projectId)} · Version {route.version}</p>
      <label className="doc-category">Category<select aria-label="Category" value={category} onChange={event => changeFilters(query, event.target.value)}><option value="">All categories</option>{categories.map(item => <option value={item} key={item}>{item}</option>)}</select></label>
    </div>
    {filterNotice && <p role="status" className="doc-filter-notice">{filterNotice}</p>}
    <p className="doc-result-count" role="status" aria-live="polite">{publicDocs.length === 0 ? 'No documentation published yet' : filteredDocs.length === 0 ? 'No matching documents' : `${filteredDocs.length} ${filteredDocs.length === 1 ? 'document' : 'documents'}`}</p>
    <div className="document-list">{filteredDocs.map((doc, index) => <a href={documentUrl(doc)} data-doc-result={doc.id} key={doc.id} onClick={event => {
      if (!plainActivation(event)) return;
      event.preventDefault(); rememberIndex(doc.id); navigate(documentUrl(doc));
    }}><span className="row-number">{String(index + 1).padStart(2, '0')}</span><span>{doc.title}<small className="doc-result-meta">{projectLabel(doc.projectId)} · {doc.versionId} · {doc.category}</small></span><ArrowRight size={16} /></a>)}</div>
  </>}
    <p role="status" aria-live="polite" className="doc-copy-status">{status}</p>
    {manualUrl && <label className="doc-manual-link">Document link<input readOnly aria-label="Document link for manual copy" value={manualUrl} onFocus={event => event.currentTarget.select()} /></label>}
  </div>;
}
