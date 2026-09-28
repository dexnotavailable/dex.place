// Small WebGL2 helpers. Every texture is NEAREST with clamped edges: the lab
// never filters a pixel.

export interface Texture {
  tex: WebGLTexture;
  w: number;
  h: number;
}

export function compile(gl: WebGL2RenderingContext, vs: string, fs: string, name: string): WebGLProgram {
  const make = (type: number, src: string): WebGLShader => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`${name} ${type === gl.VERTEX_SHADER ? "vertex" : "fragment"} shader: ${log}`);
    }
    return s;
  };
  const p = gl.createProgram()!;
  const v = make(gl.VERTEX_SHADER, vs);
  const f = make(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${name} link: ${gl.getProgramInfoLog(p)}`);
  return p;
}

export function uniforms(gl: WebGL2RenderingContext, p: WebGLProgram): Record<string, WebGLUniformLocation> {
  const out: Record<string, WebGLUniformLocation> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, "");
    const loc = gl.getUniformLocation(p, info.name);
    if (loc) out[name] = loc;
  }
  return out;
}

export function nearestTexture(
  gl: WebGL2RenderingContext,
  src: TexImageSource | { w: number; h: number; data: Uint8Array | Uint8ClampedArray },
): Texture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  let w: number;
  let h: number;
  if ("w" in src) {
    w = src.w;
    h = src.h;
    const data = src.data instanceof Uint8Array ? src.data : new Uint8Array(src.data.buffer, src.data.byteOffset, src.data.byteLength);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  } else {
    const s = src as { width: number; height: number };
    w = s.width;
    h = s.height;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }
  return { tex, w, h };
}

export function emptyTarget(gl: WebGL2RenderingContext, w: number, h: number): { fbo: WebGLFramebuffer; color: Texture } {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`low-res framebuffer incomplete (${status})`);
  return { fbo, color: { tex, w, h } };
}

/** Shared quad index buffer: 0 1 2, 0 2 3 per quad. */
export function quadIndices(gl: WebGL2RenderingContext, quads: number): WebGLBuffer {
  const idx = new Uint32Array(quads * 6);
  for (let i = 0; i < quads; i++) {
    const v = i * 4;
    idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
  }
  const b = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  return b;
}
