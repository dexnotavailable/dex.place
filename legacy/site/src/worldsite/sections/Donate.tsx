import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Copy, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';
import { copyText } from '../ui';
export const money=(n:number)=>new Intl.NumberFormat('vi-VN').format(n)+' ₫';
function crc16(input:string){let crc=0xffff;for(const char of input){crc^=char.charCodeAt(0)<<8;for(let i=0;i<8;i++)crc=crc&0x8000?(crc<<1)^0x1021:crc<<1;crc&=0xffff}return crc.toString(16).toUpperCase().padStart(4,'0')}
const field=(id:string,value:string)=>id+String(value.length).padStart(2,'0')+value;
export function vietQrPayload(amount:number){const bank=field('00','970422')+field('01','0585739325');const merchant=field('00','A000000727')+field('01',bank)+field('02','QRIBFTTA');const payload=field('00','01')+field('01','12')+field('38',merchant)+field('53','704')+field('54',String(amount))+field('58','VN')+field('62',field('08','dex support'))+'6304';return payload+crc16(payload)}
const anchors=[100000,500000,1000000,5000000,10000000];
const fromSlider=(v:number)=>{if(v>=100)return anchors[4];const index=Math.floor(v/25),t=(v-index*25)/25;return Math.round((anchors[index]+(anchors[index+1]-anchors[index])*t)/10000)*10000};
function amountError(value:string){
 if(!value)return 'Enter an amount.';
 if(!/^\d+$/.test(value))return 'Use digits only, without commas or decimals.';
 const n=Number(value);if(!Number.isSafeInteger(n)||n<100000||n>10000000)return 'Choose between 100,000 and 10,000,000 VND.';
 if(n%10000!==0)return 'Choose an amount in steps of 10,000 VND.';return '';
}
function toSlider(value:number){let i=0;while(i<3&&value>anchors[i+1])i++;return i*25+(value-anchors[i])/(anchors[i+1]-anchors[i])*25}
const spokenVnd=(value:number)=>new Intl.NumberFormat('en-US').format(value)+' VND';
export function Donate({initialAmount=100000,onCommit}:{initialAmount?:number;onCommit?:(amount:number)=>void}){
 const [method,setMethod]=useState<'choice'|'mb'>('choice');const [amount,setAmount]=useState(initialAmount);const [draft,setDraft]=useState(String(initialAmount));const [slider,setSlider]=useState(toSlider(initialAmount));
 const [error,setError]=useState(''),[qrError,setQrError]=useState(''),[status,setStatus]=useState('');const [qr,setQr]=useState<{url:string;amount:number}|null>(null);const [busy,setBusy]=useState(false),[dragging,setDragging]=useState(false);
 const revision=useRef(0),activeUrl=useRef(''),input=useRef<HTMLInputElement>(null),methodHeading=useRef<HTMLSpanElement>(null),methodButton=useRef<HTMLButtonElement>(null),qrResult=useRef<HTMLDivElement>(null);
 const drag=useRef<{amount:number;draft:string;slider:number;preview:number}|null>(null);
 const invalidate=()=>{revision.current++;setBusy(false);if(activeUrl.current){URL.revokeObjectURL(activeUrl.current);activeUrl.current=''}setQr(null);setQrError('');setStatus('')};
 const choose=(value:number,announce=true)=>{invalidate();setAmount(value);setDraft(String(value));setSlider(toSlider(value));setError('');onCommit?.(value);if(announce)setStatus(spokenVnd(value))};
 const cancelDrag=()=>{const start=drag.current;if(!start)return;drag.current=null;setDragging(false);invalidate();setAmount(start.amount);setDraft(start.draft);setSlider(start.slider);setError(amountError(start.draft))};
 useEffect(()=>{const interrupt=()=>{if(document.hidden)cancelDrag()};const cancel=()=>cancelDrag();window.addEventListener('blur',cancel);window.addEventListener('orientationchange',cancel);document.addEventListener('visibilitychange',interrupt);return()=>{revision.current++;if(activeUrl.current)URL.revokeObjectURL(activeUrl.current);window.removeEventListener('blur',cancel);window.removeEventListener('orientationchange',cancel);document.removeEventListener('visibilitychange',interrupt)}},[]);
 useEffect(()=>{if(qr)qrResult.current?.scrollIntoView({block:'nearest',behavior:document.querySelector('.site.reduced')||matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})},[qr]);
 const apply=()=>{const message=amountError(draft);setError(message);if(message)return;choose(Number(draft));input.current?.focus()};
 const generate=async()=>{
  if(amountError(draft)||Number(draft)!==amount||drag.current)return;
  const snapshot=amount;invalidate();const rev=revision.current;setBusy(true);
  try{const data=await QRCode.toDataURL(vietQrPayload(snapshot),{errorCorrectionLevel:'M',margin:4,scale:8,color:{dark:'#111111',light:'#ffffff'}});const blob=await(await fetch(data)).blob();if(rev!==revision.current)return;if(activeUrl.current)URL.revokeObjectURL(activeUrl.current);activeUrl.current=URL.createObjectURL(blob);setQr({url:activeUrl.current,amount:snapshot});setStatus('QR ready')}
  catch{if(rev===revision.current)setQrError('QR could not be generated. Try again.')}
  finally{if(rev===revision.current)setBusy(false)}
 };
 const copy=(text:string,label:string)=>copyText(text).then(()=>setStatus(label+' copied')).catch(()=>setStatus('Select and copy the '+label.toLowerCase()+'.'));
 const openBank=()=>{setDraft(String(amount));setError('');setMethod('mb');requestAnimationFrame(()=>methodHeading.current?.focus())};
 const changeMethod=()=>{cancelDrag();invalidate();setDraft(String(amount));setError('');setMethod('choice');requestAnimationFrame(()=>methodButton.current?.focus())};
 const validDraft=!amountError(draft),dirty=Number(draft)!==amount||draft!==String(amount);
 if(method==='choice')return <div className="donation-methods"><a className="method" href="https://ko-fi.com/dexdonation"><span><strong>Ko-fi</strong><small>Choose your amount on Ko-fi.</small></span><ExternalLink size={20}/></a><button ref={methodButton} className="method" onClick={openBank}><span><strong>MB Bank</strong><small>VND</small></span><ArrowRight size={20}/></button></div>;
 return <>
  <button className="text-button" onClick={changeMethod}><ArrowLeft size={15}/>Change method</button>
  <div className="bank-heading"><span ref={methodHeading} tabIndex={-1}>MB Bank</span><strong>{money(amount)}</strong><span id="bank-current-amount" className="sr-only">Current amount: {spokenVnd(amount)}.</span></div>
  <label className="bank-slider"><span className="field-label">Amount (VND)</span><input type="range" aria-label="Amount (VND)" aria-valuetext={spokenVnd(amount)} aria-describedby="bank-current-amount" min={0} max={100} step={.1} value={slider}
   onPointerDown={e=>{drag.current={amount,draft,slider,preview:amount};setDragging(true);e.currentTarget.setPointerCapture(e.pointerId)}}
   onPointerUp={()=>{const value=drag.current?.preview;drag.current=null;setDragging(false);if(value!==undefined)choose(value)}}
   onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
   onKeyDown={e=>{if(e.key==='Escape'&&drag.current){e.preventDefault();e.stopPropagation();cancelDrag();return}const increments:Record<string,number>={ArrowLeft:-10000,ArrowDown:-10000,ArrowRight:10000,ArrowUp:10000,PageDown:-100000,PageUp:100000};if(e.key in increments){e.preventDefault();choose(Math.max(100000,Math.min(10000000,amount+increments[e.key])))}else if(e.key==='Home'||e.key==='End'){e.preventDefault();choose(e.key==='Home'?100000:10000000)}}}
   onChange={e=>{const position=Number(e.target.value),value=fromSlider(position);if(drag.current){drag.current.preview=value;invalidate();setAmount(value);setDraft(String(value));setSlider(position);setError('')}else choose(value)}}/>
   <span className="slider-legend">{['100k','500k','1m','5m','10m'].map(value=><span key={value}>{value}</span>)}</span>
  </label>
  <div className="amount-edit"><label><span className="field-label">Enter amount in VND</span><input ref={input} inputMode="numeric" aria-label="Enter amount in VND" aria-invalid={!!error} aria-describedby={error?'bank-amount-error':undefined} value={draft} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(validDraft&&dirty)apply()}}} onChange={e=>{invalidate();setDraft(e.target.value);setError(amountError(e.target.value))}}/></label><button disabled={!validDraft||!dirty} onClick={apply}>Apply amount</button></div>
  {error&&<p id="bank-amount-error" role="alert" className="error">{error}</p>}
  <div className="presets">{anchors.map((n,i)=><button key={n} aria-label={spokenVnd(n)} aria-pressed={amount===n&&!dragging} onClick={()=>choose(n)}>{['100k','500k','1m','5m','10m'][i]}</button>)}</div>
  <dl className="bank-facts">{[['Account','0585739325','Account number'],['Account holder','THIEU GIA MINH','Account holder'],['Note','dex support','Transfer note']].map(([label,value,copyLabel])=><div key={label}><dt>{label}</dt><dd><span>{value}</span><button className="icon-button" aria-label={'Copy '+copyLabel.toLowerCase()} onClick={()=>copy(value,copyLabel)}><Copy size={15}/></button></dd></div>)}</dl>
  {qrError&&<p role="alert" className="error">{qrError}</p>}
  <button className="primary" disabled={busy||dragging||!validDraft||dirty} onClick={generate}>{busy?'Generating QR…':qrError?'Retry QR':'Generate QR'}</button>
  {qr&&<div className="qr-result" ref={qrResult}><img src={qr.url} alt={'MB Bank transfer QR for '+spokenVnd(qr.amount)+', THIEU GIA MINH'} width={264} height={264}/><div><strong>{money(qr.amount)}</strong><p>Scan with your banking app, or save this QR and import it there.</p><p>Check the recipient and amount in your banking app before confirming.</p><a className="button secondary" href={qr.url} download={'dex-support-mb-'+qr.amount+'-vnd.png'}>Save QR image</a><a href={qr.url} target="_blank" rel="noreferrer" aria-label="Open QR image, opens image in a new tab">Open QR image</a></div></div>}
  <p role="status" className="status">{status}</p>
 </>
}
