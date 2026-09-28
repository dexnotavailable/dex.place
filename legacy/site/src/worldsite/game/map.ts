import type { Section } from './contracts';

export type Properties = Record<string, string | number | boolean>;
export interface MapObject { id: string; kind: string; x: number; y: number; width: number; height: number; props: Properties }
export interface Solid extends MapObject { kind: 'solid' | 'oneway' }
export interface WorldMap { width: number; height: number; solids: Solid[]; objects: MapObject[]; anchors: MapObject[]; regions: MapObject[];bounds:{left:number;right:number};cameraBounds:{left:number;right:number};resetZones:MapObject[] }
type TiledObject = { id:number; name:string; type?:string; class?:string; x:number;y:number;width?:number;height?:number; polygon?:unknown; ellipse?:boolean; properties?:{name:string;value:string|number|boolean}[] };
type TiledMap = { width:number;height:number;tilewidth:number;tileheight:number;properties?:{name:string;value:string|number|boolean}[];layers:{name:string;type:string;objects?:TiledObject[]}[] };
const known = new Set(['terminal','file','gallery','donate','home','banner','cable','bridge','seal','ornament','lift','landing','door','map','product','resident','shortcut','mob']);

/** Normalizes the deliberately small authored Tiled subset; malformed links fail at their owner. */
export function readMap(raw:TiledMap):WorldMap {
  if (!raw || !Array.isArray(raw.layers)) throw new Error('Map: no Tiled layers');
  const ids = new Set<string>();
  const layers = new Map<string,MapObject[]>();
  for(const layer of raw.layers) {
    if(layer.type !== 'objectgroup') continue;
    const objects = (layer.objects || []).map(o => {
      if(o.polygon || o.ellipse) throw new Error(`Map ${layer.name}/${o.name}: unsupported collision shape`);
      const props = Object.fromEntries((o.properties || []).map(p=>[p.name,p.value]));
      const id = String(props.stableId || o.name || o.id);
      if(ids.has(id)) throw new Error(`Map ${layer.name}/${id}: duplicate stable ID`);
      ids.add(id);
      return {id,kind:o.class || o.type || '',x:o.x,y:o.y,width:o.width || 0,height:o.height || 0,props};
    });
    layers.set(layer.name,objects);
  }
  const solids = (layers.get('collision') || []).map(o=> {
    if(o.kind !== 'solid' && o.kind !== 'oneway') throw new Error(`Map collision/${o.id}: unsupported class ${o.kind}`);
    return o as Solid;
  });
  const objects = layers.get('objects') || [];
  for(const o of objects) {
    if(!known.has(o.kind)) throw new Error(`Map objects/${o.id}: unknown class ${o.kind}`);
    for(const field of ['target','lower','upper']) if(o.props[field] && !ids.has(String(o.props[field]))) throw new Error(`Map objects/${o.id}: missing ${field} ${o.props[field]}`);
  }
  const anchors = layers.get('anchors_and_paths') || [];
  for(const name of ['home','downloads','documentation','illustrations','donate','arena']) if(!anchors.find(a=>a.id===`anchor.${name}`)) throw new Error(`Map: missing anchor.${name}`);
  const properties=Object.fromEntries((raw.properties||[]).map(p=>[p.name,p.value]));
  const width=raw.width*raw.tilewidth;
  const bounds={left:Number(properties.walkMinX??16),right:Number(properties.walkMaxX??width-16)};
  if(!Number.isFinite(bounds.left)||!Number.isFinite(bounds.right)||bounds.left<0||bounds.right>width||bounds.right<=bounds.left)throw new Error('Map: invalid walking bounds');
  const cameraBounds={left:Number(properties.cameraMinX??0),right:Number(properties.cameraMaxX??width)};
  if(!Number.isFinite(cameraBounds.left)||!Number.isFinite(cameraBounds.right)||cameraBounds.left<0||cameraBounds.right>width||cameraBounds.right<=cameraBounds.left)throw new Error('Map: invalid camera bounds');
  const resetZones=layers.get('reset_zones')||[];
  for(const zone of resetZones)if(zone.props.anchor&&!anchors.some(a=>a.id===zone.props.anchor))throw new Error(`Map ${zone.id}: missing reset anchor`);
  return {width,height:raw.height*raw.tileheight,solids,objects,anchors,regions:layers.get('camera_bounds') || [],bounds,cameraBounds,resetZones};
}

export function anchorFor(map:WorldMap, section:Section|'home'|'arena'):MapObject { return map.anchors.find(a=>a.id===`anchor.${section}`)!; }
