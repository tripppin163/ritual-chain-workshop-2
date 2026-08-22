"use client";

import { useEffect, useRef } from "react";

/**
 * The specular rim from React Bits' SpecularButton
 * (https://reactbits.dev/components/specular-button, MIT), lit across every interactive
 * element on the page instead of one button.
 *
 * The original mounts a WebGL renderer and an animation loop per button. That is fine for
 * a landing page with one call to action and wrong here: a board of a hundred markets has
 * a hundred controls, and browsers cut a page off at roughly sixteen live WebGL contexts.
 * So the shader is upstream's — a rounded-rect SDF, a gaussian line hugging the edge, an
 * angular window that decides which part of the outline catches the light — and what is
 * rewritten around it is the plumbing: one canvas over the viewport, one context, one
 * loop, and a draw call per element that happens to be near the pointer.
 *
 * Nothing renders while the pointer is away from every control, so a page at rest costs
 * nothing.
 */

const SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "summary",
  '[role="button"]',
  "select",
  "textarea",
  'input:not([type="hidden"])',
].join(",");

/** Room around each element for the light to fall off in, in CSS pixels. */
const PAD = 22;
/** How far the pointer can be from an element before its rim goes dark. */
const PROXIMITY = 220;
/** Elements lit at once, nearest first — a cap so a dense corner cannot stall a frame. */
const MAX_LIT = 8;

const VERT = `#version 300 es
in vec2 a_position;
void main(){gl_Position=vec4(a_position,0.,1.);}`;

// Upstream's fragment shader, with two things lifted into uniforms. u_base scales the
// dark stroke drawn under the highlight, which on a near-black page reads as grime rather
// than as thickness. u_spread is how far from the border the light is allowed to reach:
// upstream pins it at three pixels, which on a control that already draws its own hairline
// border means the specular hides underneath it and only looks like the border brightened.
const FRAG = `#version 300 es
precision highp float;

uniform vec2 u_center;
uniform vec2 u_halfSize;
uniform float u_radius;
uniform float u_angle;
uniform float u_px;
uniform vec3 u_lineColor;
uniform vec3 u_baseColor;
uniform float u_intensity;
uniform float u_shineSize;
uniform float u_shineFade;
uniform float u_thickness;
uniform float u_baseWidth;
uniform float u_base;
uniform float u_spread;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - u_center;
  float d = sdRoundedRect(p, u_halfSize, u_radius);
  vec2 L = vec2(cos(u_angle), sin(u_angle));

  float base = (1.0 - smoothstep(0.0, u_baseWidth, abs(d))) * 0.45 * u_base;

  vec2 nEll = normalize(p / (u_halfSize * u_halfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(u_shineSize - u_shineFade, u_shineSize + u_shineFade + 1e-4, phi);
  float line = gaussianLine(d, u_thickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * u_px, u_spread * u_px, abs(d));
  float hi = line * rim * edgeClamp * u_intensity;

  vec3 col = u_baseColor * base + u_lineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}`;

type Lit = {
  el: Element;
  rect: DOMRect;
  radius: number;
  /** 0 to 1, how close the pointer is. */
  target: number;
  /** Eased towards target so the light does not snap on. */
  bright: number;
  angle: number;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** The radius the element is actually drawn with, in CSS pixels. */
function readRadius(el: Element, rect: DOMRect) {
  const raw = getComputedStyle(el).borderTopLeftRadius;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  // A percentage or a pill's absurd radius both mean "as round as it goes".
  const px = raw.endsWith("%") ? (value / 100) * Math.min(rect.width, rect.height) : value;
  return Math.min(px, Math.min(rect.width, rect.height) / 2);
}

export function SpecularField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // preserveDrawingBuffer keeps the last frame around instead of letting it be discarded
    // after each composite. It costs a little bandwidth on a viewport-sized buffer, and it
    // is what makes the light survive into a frame the page did not draw itself — a forced
    // repaint, or a screenshot.
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const u = {
      center: gl.getUniformLocation(program, "u_center"),
      halfSize: gl.getUniformLocation(program, "u_halfSize"),
      radius: gl.getUniformLocation(program, "u_radius"),
      angle: gl.getUniformLocation(program, "u_angle"),
      px: gl.getUniformLocation(program, "u_px"),
      lineColor: gl.getUniformLocation(program, "u_lineColor"),
      baseColor: gl.getUniformLocation(program, "u_baseColor"),
      intensity: gl.getUniformLocation(program, "u_intensity"),
      shineSize: gl.getUniformLocation(program, "u_shineSize"),
      shineFade: gl.getUniformLocation(program, "u_shineFade"),
      thickness: gl.getUniformLocation(program, "u_thickness"),
      baseWidth: gl.getUniformLocation(program, "u_baseWidth"),
      base: gl.getUniformLocation(program, "u_base"),
      spread: gl.getUniformLocation(program, "u_spread"),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(window.innerWidth * dpr);
      const h = Math.round(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      // Present an explicitly cleared frame: a drawing buffer that has never been drawn
      // to is left to the compositor's discretion, and some of them show it as opaque.
      gl.scissor(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };
    resize();

    // The set of controls worth measuring: everything interactive that is currently on
    // screen. An IntersectionObserver keeps it to the visible ones, so a long board of
    // markets does not turn into a hundred layout reads per frame.
    const visible = new Set<Element>();
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
      },
      { rootMargin: `${PROXIMITY}px` },
    );

    const tracked = new WeakSet<Element>();
    const scan = () => {
      for (const el of document.querySelectorAll(SELECTOR)) {
        if (tracked.has(el)) continue;
        tracked.add(el);
        if (el.closest("[data-specular='off']")) continue;
        // Two things are not surfaces and must not be outlined. A link inside a sentence
        // has no box of its own, and a square-cornered control is bare text with a hit
        // area — a rectangle drawn around either reads as a debug outline, not as a
        // highlight. Everything this interface treats as a surface is rounded.
        const style = getComputedStyle(el);
        if (style.display === "inline") continue;
        if (Number.parseFloat(style.borderTopLeftRadius) < 2) continue;
        seen.observe(el);
      }
    };
    scan();

    let scanQueued = 0;
    const mutations = new MutationObserver(() => {
      // The board re-renders on every block, so coalesce instead of rescanning per node.
      if (scanQueued) return;
      scanQueued = window.setTimeout(() => {
        scanQueued = 0;
        scan();
      }, 200);
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    const lit = new Map<Element, Lit>();
    /** The open modal, if there is one. Set by the same observer that moves the canvas. */
    let modal: Element | null = null;
    let pointer: { x: number; y: number } | null = null;
    let running = false;
    let raf = 0;
    let last = performance.now();
    let lastMove = 0;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (pointer) {
        const nearby: Lit[] = [];
        for (const el of visible) {
          if (!el.isConnected) {
            visible.delete(el);
            continue;
          }
          // A modal makes everything behind it inert, and the canvas has to ride inside
          // it to be painted at all — so without this the board's own controls keep
          // lighting up, over the top of the dialog, in the shape of whatever sits
          // behind it.
          if (modal && !modal.contains(el)) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 4 || rect.height < 4) continue;
          const dx = Math.max(rect.left - pointer.x, 0, pointer.x - rect.right);
          const dy = Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom);
          const distance = Math.hypot(dx, dy);
          if (distance > PROXIMITY) continue;

          const t = Math.max(0, 1 - distance / PROXIMITY);
          const entry = lit.get(el) ?? { el, rect, radius: 0, target: 0, bright: 0, angle: 2.4 };
          entry.rect = rect;
          entry.radius = readRadius(el, rect);
          entry.target = t * t * (3 - 2 * t);

          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          if (distance === 0) {
            // Over the control itself the light settles on the diagonal, framing the
            // corners, and sways a little with where the pointer sits inside it.
            const nx = (pointer.x - cx) / (rect.width / 2);
            const ny = (cy - pointer.y) / (rect.height / 2);
            entry.angle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
          } else {
            entry.angle = Math.atan2(cy - pointer.y, pointer.x - cx);
          }

          lit.set(el, entry);
          nearby.push(entry);
        }

        // Anything that fell out of range fades rather than blinking off.
        const near = new Set(nearby);
        for (const entry of lit.values()) {
          if (!near.has(entry)) entry.target = 0;
        }

        nearby.sort((a, b) => b.target - a.target);
        if (nearby.length > MAX_LIT) {
          for (const entry of nearby.slice(MAX_LIT)) entry.target = 0;
        }
      } else {
        for (const entry of lit.values()) entry.target = 0;
      }

      const ease = reduced.matches ? 1 : 1 - Math.exp(-dt * 9);
      let anyLight = false;
      for (const [el, entry] of lit) {
        entry.bright += (entry.target - entry.bright) * ease;
        if (entry.bright < 0.002 && entry.target === 0) lit.delete(el);
        else if (entry.bright > 0.002) anyLight = true;
      }

      gl.scissor(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const height = window.innerHeight;
      for (const entry of lit.values()) {
        if (entry.bright < 0.002) continue;
        const { rect } = entry;

        const sx = Math.round((rect.left - PAD) * dpr);
        const sy = Math.round((height - rect.bottom - PAD) * dpr);
        const sw = Math.round((rect.width + PAD * 2) * dpr);
        const sh = Math.round((rect.height + PAD * 2) * dpr);
        gl.scissor(sx, sy, sw, sh);

        gl.uniform2f(
          u.center,
          (rect.left + rect.width / 2) * dpr,
          (height - (rect.top + rect.height / 2)) * dpr,
        );
        gl.uniform2f(u.halfSize, (rect.width / 2) * dpr, (rect.height / 2) * dpr);
        gl.uniform1f(u.radius, entry.radius * dpr);
        gl.uniform1f(u.angle, entry.angle);
        gl.uniform1f(u.px, dpr);
        gl.uniform3f(u.lineColor, 0.98, 0.98, 0.976);
        gl.uniform3f(u.baseColor, 0.32, 0.32, 0.32);
        gl.uniform1f(u.intensity, entry.bright * 1.6);
        gl.uniform1f(u.shineSize, (10 * Math.PI) / 180);
        gl.uniform1f(u.shineFade, (40 * Math.PI) / 180);
        gl.uniform1f(u.thickness, 1.6 * dpr);
        gl.uniform1f(u.baseWidth, dpr);
        gl.uniform1f(u.base, 0.25);
        gl.uniform1f(u.spread, 5);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      if (anyLight || now - lastMove < 300) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onPointerMove = (event: PointerEvent) => {
      // Touch has no hover, and lighting a control the moment a finger lands on it reads
      // as a glitch rather than as a response.
      if (event.pointerType === "touch") return;
      pointer = { x: event.clientX, y: event.clientY };
      lastMove = performance.now();
      start();
    };
    const onPointerLeave = () => {
      pointer = null;
      lastMove = performance.now();
      start();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("resize", resize);
    const onScroll = () => {
      lastMove = performance.now();
      start();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // A native <dialog> sits in the top layer, above anything in normal flow, so an
    // overlay left on the body would be painted underneath it. Riding along inside the
    // open dialog puts the light back on top of the controls it belongs to.
    const host = canvas.parentElement;
    const follow = () => {
      const open = document.querySelector("dialog[open]");
      modal = open;
      const parent = open ?? host;
      if (parent && canvas.parentElement !== parent) parent.appendChild(canvas);
    };
    follow();
    const dialogs = new MutationObserver(follow);
    dialogs.observe(document.body, { childList: true, subtree: true, attributeFilter: ["open"] });

    return () => {
      cancelAnimationFrame(raf);
      if (scanQueued) clearTimeout(scanQueued);
      seen.disconnect();
      mutations.disconnect();
      dialogs.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      // Free the GPU objects but leave the context alive: this canvas belongs to React,
      // and a context force-lost here is handed back still dead when the effect re-runs,
      // which is every mount in development.
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
      // React removes the node from where it rendered it, not from a dialog it moved to.
      if (host && canvas.parentElement !== host) host.appendChild(canvas);
    };
  }, []);

  // h-full w-full is not redundant next to inset-0: a canvas is a replaced element, so
  // an auto width resolves to the drawing buffer's size rather than stretching to the
  // inset box, and on a 2x display the layer would come out twice the size of the screen.
  return (
    <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[100] h-full w-full" />
  );
}
