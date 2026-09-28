import {Component,type ReactNode} from 'react';
export class PanelBoundary extends Component<{children:ReactNode;close:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){if(this.state.failed)return <div className="registry-shade"><div className="registry-panel" role="dialog" aria-modal="true" aria-label="Record unavailable" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();this.props.close()}else if(e.key==='Tab'){const buttons=Array.from(e.currentTarget.querySelectorAll('button'));if(document.activeElement===buttons[e.shiftKey?0:buttons.length-1]){e.preventDefault();buttons[e.shiftKey?buttons.length-1:0]?.focus()}}}}><div className="registry-panel-body"><h1>Record unavailable</h1><p>This panel could not load. Reload to try again, or return to the world.</p><div className="registry-actions"><button onClick={this.props.close}>Return to world</button><button autoFocus onClick={()=>location.reload()}>Reload to retry</button></div></div></div></div>;return this.props.children}
}
