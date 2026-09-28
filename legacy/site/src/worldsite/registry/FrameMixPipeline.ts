import Phaser from 'phaser';
/** One premultiplied texture sample mix, composited once. Ordinary two-sprite
 * crossfades would thin an opaque cloud to .75 alpha at the midpoint. */
export class FrameMixPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
 constructor(game:Phaser.Game){super({game,fragShader:`
 precision mediump float;
 uniform sampler2D uMainSampler;
 uniform vec2 uFrameOrigin;
 uniform vec2 uNextOrigin;
 uniform float uFrameMix;
 varying vec2 outTexCoord;
 varying float outTintEffect;
 varying vec4 outTint;
 void main(){
   vec4 a=texture2D(uMainSampler,outTexCoord);
   vec4 b=texture2D(uMainSampler,outTexCoord-uFrameOrigin+uNextOrigin);
   vec4 texel=mix(a,b,uFrameMix);
   gl_FragColor=texel*vec4(outTint.bgr*outTint.a,outTint.a);
 }`});}
 onBind(object?:Phaser.GameObjects.GameObject){
  if(!object||!('frame' in object))return;
  // Uniforms are per-sprite; flush the preceding sprite before changing them.
  this.flush();const sprite=object as Phaser.GameObjects.Sprite,data=sprite.pipelineData as {nextFrame?:number;frameMix?:number},a=sprite.frame,b=sprite.texture.get(data.nextFrame??Number(a.name));
  this.set2f('uFrameOrigin',a.u0,a.v0);this.set2f('uNextOrigin',b.u0,b.v0);this.set1f('uFrameMix',data.frameMix||0);
 }
}
