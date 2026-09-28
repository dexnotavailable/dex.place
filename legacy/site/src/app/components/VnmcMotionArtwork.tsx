import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  type MotionStyle,
  type MotionValue,
} from "motion/react";
import rigData from "../data/vnmcMotionRig.generated.json";

interface RigPlate {
  id: string;
  src: string;
  kind: "static" | "motion";
  left: number;
  top: number;
  width: number;
  height: number;
  pivotX?: number;
  pivotY?: number;
  x?: number;
  y?: number;
  duration?: number;
  delay?: number;
  depth?: number;
}

interface RigManifest {
  fallback: string;
  plates: RigPlate[];
}

interface Props {
  alt: string;
  className?: string;
  style?: MotionStyle;
  windX?: MotionValue<number>;
  windY?: MotionValue<number>;
  eager?: boolean;
}

interface MeshTuning {
  axisX: number;
  axisY: number;
  paddingX: number;
  paddingY: number;
  spread: number;
  response: number;
  ambientScale: number;
  columns: number;
  rows: number;
  nodes: InfluenceNode[];
  exclusions?: InfluenceNode[];
}

interface InfluenceNode {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  strength?: number;
}

interface MeshRegion extends MeshTuning {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
  amplitudeX: number;
  amplitudeY: number;
  duration: number;
  phase: number;
  depth: number;
  maxProjection: number;
}

interface WindMeshStageProps {
  regions: MeshRegion[];
  source: HTMLImageElement;
  windX: MotionValue<number>;
  windY: MotionValue<number>;
}

interface MeshBuffers {
  region: MeshRegion;
  vertices: WebGLBuffer;
  indices: WebGLBuffer;
  indexCount: number;
}

const rig = rigData as RigManifest;

// Each zone samples the finished composite, so deforming it cannot reveal the
// transparent gaps that exist inside the original PSD cutout layers.
const MESH_TUNING: Record<string, MeshTuning> = {
  "yosemite-hair": {
    axisX: 0.08,
    axisY: -1,
    paddingX: 4.2,
    paddingY: 4,
    spread: 0.72,
    response: 0.34,
    ambientScale: 1,
    columns: 12,
    rows: 8,
    nodes: [
      { x: 59, y: 7, radiusX: 6.5, radiusY: 8 },
      { x: 65, y: 4, radiusX: 7.5, radiusY: 6 },
      { x: 81, y: 5, radiusX: 8.5, radiusY: 7 },
      { x: 85, y: 15, radiusX: 6, radiusY: 10 },
      { x: 80, y: 25, radiusX: 7, radiusY: 7 },
    ],
    exclusions: [{ x: 74, y: 17, radiusX: 8.5, radiusY: 12 }],
  },
  "director-hair": {
    axisX: 0.18,
    axisY: -0.98,
    paddingX: 2.4,
    paddingY: 2.8,
    spread: 0.68,
    response: 0.22,
    ambientScale: 0.75,
    columns: 7,
    rows: 6,
    nodes: [
      { x: 20.2, y: 11.5, radiusX: 3.2, radiusY: 5 },
      { x: 25.2, y: 11.8, radiusX: 3.5, radiusY: 5.2 },
    ],
    exclusions: [{ x: 22.8, y: 15.2, radiusX: 2.5, radiusY: 3.8 }],
  },
  "towaki-hair": {
    axisX: -0.18,
    axisY: 0.98,
    paddingX: 4.4,
    paddingY: 4.6,
    spread: 0.82,
    response: 0.4,
    ambientScale: 1.06,
    columns: 12,
    rows: 11,
    nodes: [
      { x: 38, y: 37, radiusX: 8, radiusY: 9 },
      { x: 34.5, y: 48, radiusX: 7.5, radiusY: 13 },
      { x: 35, y: 62, radiusX: 7.5, radiusY: 14 },
      { x: 50, y: 42, radiusX: 8.5, radiusY: 10 },
      { x: 54, y: 51, radiusX: 6.5, radiusY: 10 },
    ],
    exclusions: [
      { x: 43.5, y: 43, radiusX: 5.5, radiusY: 8 },
      { x: 44.5, y: 65, radiusX: 7, radiusY: 17 },
    ],
  },
  "ena-cape": {
    axisX: 0.34,
    axisY: 0.94,
    paddingX: 4.2,
    paddingY: 4.4,
    spread: 0.84,
    response: 0.34,
    ambientScale: 0.9,
    columns: 10,
    rows: 11,
    nodes: [
      { x: 78, y: 61, radiusX: 7, radiusY: 12 },
      { x: 83, y: 77, radiusX: 8, radiusY: 17 },
      { x: 78, y: 92, radiusX: 8, radiusY: 14 },
    ],
    exclusions: [{ x: 73, y: 66, radiusX: 5.5, radiusY: 15 }],
  },
  "ena-hair": {
    axisX: 0.12,
    axisY: -0.99,
    paddingX: 2.8,
    paddingY: 3.2,
    spread: 0.7,
    response: 0.3,
    ambientScale: 0.86,
    columns: 8,
    rows: 7,
    nodes: [
      { x: 69.5, y: 45, radiusX: 3.5, radiusY: 5.5 },
      { x: 76.5, y: 46, radiusX: 3.5, radiusY: 6 },
    ],
    exclusions: [{ x: 73, y: 47, radiusX: 3, radiusY: 4.3 }],
  },
  "kaizen-hair": {
    axisX: 0.14,
    axisY: -0.99,
    paddingX: 2.5,
    paddingY: 2.8,
    spread: 0.68,
    response: 0.25,
    ambientScale: 0.78,
    columns: 7,
    rows: 6,
    nodes: [
      { x: 63.2, y: 33.5, radiusX: 2.5, radiusY: 4 },
      { x: 68, y: 34.2, radiusX: 2.5, radiusY: 4 },
    ],
    exclusions: [{ x: 65.6, y: 35.2, radiusX: 2, radiusY: 3.1 }],
  },
};

const VERTEX_SHADER = `
  attribute vec2 aLocal;
  attribute float aInfluence;

  uniform vec2 uRegionOrigin;
  uniform vec2 uRegionSize;
  uniform vec2 uPivot;
  uniform vec2 uAxis;
  uniform vec2 uResolution;
  uniform vec2 uSway;
  uniform float uSpread;
  uniform float uMaxProjection;
  uniform float uRipple;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uPhase;

  varying vec2 vTextureCoordinate;
  varying vec2 vLocal;
  varying float vInfluence;

  void main() {
    vec2 relative = aLocal - uPivot;
    vec2 perpendicularAxis = vec2(-uAxis.y, uAxis.x);
    float projection = dot(relative, uAxis);
    float along = clamp(projection / uMaxProjection, 0.0, 1.0);
    float perpendicular = dot(relative, perpendicularAxis);
    float lateralFalloff = exp(-pow(abs(perpendicular) / uSpread, 3.2));
    float edgeDistance = min(min(aLocal.x, aLocal.y), min(1.0 - aLocal.x, 1.0 - aLocal.y));
    float edgeAnchor = smoothstep(0.0, 0.16, edgeDistance);
    float rootAnchor = smoothstep(0.02, 0.34, along);
    float influence = smoothstep(0.015, 0.42, aInfluence);
    float weight =
      pow(rootAnchor, 1.18) *
      edgeAnchor *
      (0.48 + lateralFalloff * 0.52) *
      influence;
    float localRipple = sin(
      uTime * uSpeed * 1.18 +
      uPhase +
      along * 3.2 +
      perpendicular * 2.4
    ) * uRipple;
    vec2 offset = (uSway + perpendicularAxis * localRipple) * weight;
    offset.y -= abs(uSway.x) * 0.055 * along * weight;

    vec2 stagePosition = uRegionOrigin + aLocal * uRegionSize;
    vec2 clipPosition = stagePosition * 2.0 - 1.0;
    clipPosition.y *= -1.0;
    clipPosition += vec2(
      offset.x * 2.0 / uResolution.x,
      offset.y * -2.0 / uResolution.y
    );

    gl_Position = vec4(clipPosition, 0.0, 1.0);
    vTextureCoordinate = vec2(stagePosition.x, 1.0 - stagePosition.y);
    vLocal = aLocal;
    vInfluence = aInfluence;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D uTexture;

  varying vec2 vTextureCoordinate;
  varying vec2 vLocal;
  varying float vInfluence;

  void main() {
    vec4 color = texture2D(uTexture, vTextureCoordinate);
    float edgeDistance = min(min(vLocal.x, vLocal.y), min(1.0 - vLocal.x, 1.0 - vLocal.y));
    float feather = smoothstep(0.0, 0.13, edgeDistance);
    float motionMask = smoothstep(0.015, 0.34, vInfluence);
    gl_FragColor = vec4(color.rgb, color.a * feather * motionMask * 0.995);
  }
`;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const buildMeshRegion = (plate: RigPlate, tuning: MeshTuning): MeshRegion => {
  const left = Math.max(0, plate.left - tuning.paddingX);
  const top = Math.max(0, plate.top - tuning.paddingY);
  const right = Math.min(100, plate.left + plate.width + tuning.paddingX);
  const bottom = Math.min(100, plate.top + plate.height + tuning.paddingY);
  const width = Math.max(0.01, right - left);
  const height = Math.max(0.01, bottom - top);
  const pivotCanvasX = plate.left + plate.width * ((plate.pivotX ?? 50) / 100);
  const pivotCanvasY = plate.top + plate.height * ((plate.pivotY ?? 50) / 100);
  const axisLength = Math.hypot(tuning.axisX, tuning.axisY) || 1;
  const axisX = tuning.axisX / axisLength;
  const axisY = tuning.axisY / axisLength;
  const pivotX = clamp((pivotCanvasX - left) / width);
  const pivotY = clamp((pivotCanvasY - top) / height);
  const maxProjection = Math.max(
    0.001,
    (0 - pivotX) * axisX + (0 - pivotY) * axisY,
    (1 - pivotX) * axisX + (0 - pivotY) * axisY,
    (0 - pivotX) * axisX + (1 - pivotY) * axisY,
    (1 - pivotX) * axisX + (1 - pivotY) * axisY
  );

  return {
    ...tuning,
    id: plate.id,
    left,
    top,
    width,
    height,
    pivotX,
    pivotY,
    axisX,
    axisY,
    amplitudeX: plate.x ?? 0,
    amplitudeY: plate.y ?? 0,
    duration: plate.duration ?? 8,
    phase: ((plate.delay ?? 0) / (plate.duration ?? 8)) * Math.PI * 2,
    depth: plate.depth ?? 0.3,
    maxProjection,
  };
};

const compileShader = (
  gl: WebGLRenderingContext,
  type: number,
  shaderSource: string
) => {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

const createProgram = (gl: WebGLRenderingContext) => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
};

const createMeshBuffers = (
  gl: WebGLRenderingContext,
  region: MeshRegion
): MeshBuffers | null => {
  const vertexData: number[] = [];
  const indexData: number[] = [];

  const nodeInfluence = (node: InfluenceNode, x: number, y: number) => {
    const offsetX = (x - node.x) / node.radiusX;
    const offsetY = (y - node.y) / node.radiusY;
    const distance = Math.hypot(offsetX, offsetY);
    return (node.strength ?? 1) * Math.pow(clamp(1 - distance), 1.7);
  };

  const sampleInfluence = (u: number, v: number) => {
    const canvasX = region.left + u * region.width;
    const canvasY = region.top + v * region.height;
    const positive = Math.max(
      0,
      ...region.nodes.map((node) => nodeInfluence(node, canvasX, canvasY))
    );
    const exclusion = Math.max(
      0,
      ...(region.exclusions ?? []).map((node) =>
        nodeInfluence(node, canvasX, canvasY)
      )
    );
    return clamp(positive * (1 - exclusion));
  };

  for (let row = 0; row <= region.rows; row += 1) {
    for (let column = 0; column <= region.columns; column += 1) {
      const u = column / region.columns;
      const v = row / region.rows;
      vertexData.push(u, v, sampleInfluence(u, v));
    }
  }

  for (let row = 0; row < region.rows; row += 1) {
    for (let column = 0; column < region.columns; column += 1) {
      const topLeft = row * (region.columns + 1) + column;
      const topRight = topLeft + 1;
      const bottomLeft = (row + 1) * (region.columns + 1) + column;
      const bottomRight = bottomLeft + 1;
      indexData.push(topLeft, topRight, bottomRight, topLeft, bottomRight, bottomLeft);
    }
  }

  const vertices = gl.createBuffer();
  const indices = gl.createBuffer();
  if (!vertices || !indices) return null;

  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexData), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData), gl.STATIC_DRAW);

  return {
    region,
    vertices,
    indices,
    indexCount: indexData.length,
  };
};

function WindMeshStage({ regions, source, windX, windY }: WindMeshStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const program = createProgram(gl);
    if (!program) return;

    const texture = gl.createTexture();
    if (!texture) {
      gl.deleteProgram(program);
      return;
    }

    const meshes = regions.flatMap((region) => {
      const mesh = createMeshBuffers(gl, region);
      return mesh ? [mesh] : [];
    });
    if (!meshes.length) {
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      return;
    }

    const localAttribute = gl.getAttribLocation(program, "aLocal");
    const influenceAttribute = gl.getAttribLocation(program, "aInfluence");
    const uniforms = {
      regionOrigin: gl.getUniformLocation(program, "uRegionOrigin"),
      regionSize: gl.getUniformLocation(program, "uRegionSize"),
      pivot: gl.getUniformLocation(program, "uPivot"),
      axis: gl.getUniformLocation(program, "uAxis"),
      resolution: gl.getUniformLocation(program, "uResolution"),
      sway: gl.getUniformLocation(program, "uSway"),
      spread: gl.getUniformLocation(program, "uSpread"),
      maxProjection: gl.getUniformLocation(program, "uMaxProjection"),
      ripple: gl.getUniformLocation(program, "uRipple"),
      time: gl.getUniformLocation(program, "uTime"),
      speed: gl.getUniformLocation(program, "uSpeed"),
      phase: gl.getUniformLocation(program, "uPhase"),
      texture: gl.getUniformLocation(program, "uTexture"),
    };
    let animationFrame = 0;
    let lastFrame = 0;
    let isVisible = true;
    let currentWindX = windX.get();
    let currentWindY = windY.get();
    let cssWidth = 1;
    let cssHeight = 1;

    gl.useProgram(program);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source
    );
    gl.uniform1i(uniforms.texture, 0);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      cssWidth = Math.max(1, bounds.width);
      cssHeight = Math.max(1, bounds.height);
      const deviceScale = Math.min(window.devicePixelRatio || 1, 1.35);
      const nextWidth = Math.max(1, Math.round(cssWidth * deviceScale));
      const nextHeight = Math.max(1, Math.round(cssHeight * deviceScale));

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        gl.viewport(0, 0, nextWidth, nextHeight);
      }
    };

    const draw = (time: number) => {
      resize();
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(uniforms.resolution, cssWidth, cssHeight);
      gl.uniform1f(uniforms.time, time / 1000);

      for (const mesh of meshes) {
        const region = mesh.region;
        const seconds = time / 1000;
        const speed = (Math.PI * 2) / region.duration;
        const gust =
          Math.sin(seconds * speed + region.phase) +
          Math.sin(seconds * speed * 0.43 + region.phase * 1.7) * 0.27;
        const swayX =
          currentWindX * region.response * (0.68 + region.depth) +
          region.amplitudeX * region.ambientScale * gust;
        const swayY =
          currentWindY * region.response * 0.38 +
          region.amplitudeY *
            region.ambientScale *
            Math.cos(seconds * speed * 0.78 + region.phase + 0.6);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vertices);
        gl.enableVertexAttribArray(localAttribute);
        gl.vertexAttribPointer(localAttribute, 2, gl.FLOAT, false, 12, 0);
        gl.enableVertexAttribArray(influenceAttribute);
        gl.vertexAttribPointer(influenceAttribute, 1, gl.FLOAT, false, 12, 8);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
        gl.uniform2f(uniforms.regionOrigin, region.left / 100, region.top / 100);
        gl.uniform2f(uniforms.regionSize, region.width / 100, region.height / 100);
        gl.uniform2f(uniforms.pivot, region.pivotX, region.pivotY);
        gl.uniform2f(uniforms.axis, region.axisX, region.axisY);
        gl.uniform2f(uniforms.sway, swayX, swayY);
        gl.uniform1f(uniforms.spread, region.spread);
        gl.uniform1f(uniforms.maxProjection, region.maxProjection);
        gl.uniform1f(
          uniforms.ripple,
          region.amplitudeX * region.ambientScale * 0.24
        );
        gl.uniform1f(uniforms.speed, speed);
        gl.uniform1f(uniforms.phase, region.phase);
        gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
      }
    };

    const tick = (time: number) => {
      if (isVisible && !document.hidden && time - lastFrame >= 1000 / 30) {
        draw(time);
        lastFrame = time;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { rootMargin: "180px" }
    );
    const stopWindX = windX.on("change", (value) => {
      currentWindX = value;
    });
    const stopWindY = windY.on("change", (value) => {
      currentWindY = value;
    });

    resizeObserver.observe(canvas);
    visibilityObserver.observe(canvas);
    resize();
    draw(performance.now());
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      stopWindX();
      stopWindY();
      for (const mesh of meshes) {
        gl.deleteBuffer(mesh.vertices);
        gl.deleteBuffer(mesh.indices);
      }
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    };
  }, [regions, source, windX, windY]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-vnmc-mesh-stage="true"
      data-vnmc-mesh-regions={regions.length}
      className="vnmc-motion-stage pointer-events-none"
    />
  );
}

export function VnmcMotionArtwork({
  alt,
  className = "",
  style,
  windX,
  windY,
  eager = false,
}: Props) {
  const reduceMotion = Boolean(useReducedMotion());
  const calmX = useMotionValue(0);
  const calmY = useMotionValue(0);
  const resolvedWindX = windX ?? calmX;
  const resolvedWindY = windY ?? calmY;
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const meshRegions = useMemo(
    () =>
      rig.plates.flatMap((plate) => {
        const tuning = MESH_TUNING[plate.id];
        return plate.kind === "motion" && tuning ? [buildMeshRegion(plate, tuning)] : [];
      }),
    []
  );

  return (
    <motion.div
      className={`vnmc-motion-artwork overflow-hidden ${className}`}
      style={style}
      data-motion-ready={source ? "true" : "false"}
      data-reduced-motion={reduceMotion ? "true" : "false"}
    >
      <img
        src={rig.fallback}
        alt={alt}
        draggable={false}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={(event) => setSource(event.currentTarget)}
        className="absolute inset-0 h-full w-full max-w-none select-none object-cover"
      />

      {!reduceMotion && source && (
        <WindMeshStage
          regions={meshRegions}
          source={source}
          windX={resolvedWindX}
          windY={resolvedWindY}
        />
      )}
    </motion.div>
  );
}
