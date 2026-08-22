"use client";

import { useEffect, useRef, useState } from "react";
import MetallicPaint from "./reactbits/MetallicPaint";

/**
 * Fills a control's face with liquid metal.
 *
 * MetallicPaint takes a silhouette, not a colour, so the button has to hand it its own
 * outline: a rounded rectangle drawn at the element's live aspect ratio. Getting that
 * ratio right matters — the shader maps the silhouette onto its drawing buffer, so a
 * shape drawn at the wrong proportions arrives stretched, with its shading bunched into
 * the middle instead of running the length of the button.
 *
 * The silhouette is redrawn whenever the element resizes, which is what keeps a button
 * that grows with its label from smearing.
 */
export function MetallicSurface({ radius = 8 }: { radius?: number }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [shape, setShape] = useState<{ src: string; aspect: number }>();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Oversample so the outline's curves stay clean once the shader resamples them.
    const SS = 4;
    // A hair of transparent margin: the depth solve needs to see where the shape ends,
    // and a silhouette bleeding off the bitmap has no edge to find.
    const MARGIN = 2;
    // The shader shades the shape's rim over several pixels, which reads as a blurred
    // edge on a control that should look machined. So the metal is painted larger than
    // the button and the button's own rounded clip cuts the crisp edge.
    const BLEED = 6;

    let last = "";
    const draw = () => {
      const w = Math.round(host.clientWidth);
      const h = Math.round(host.clientHeight);
      if (w < 2 || h < 2) return;

      const key = `${w}x${h}`;
      if (key === last) return;
      last = key;

      const canvas = document.createElement("canvas");
      canvas.width = w * SS;
      canvas.height = h * SS;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.roundRect(
        MARGIN,
        MARGIN,
        canvas.width - MARGIN * 2,
        canvas.height - MARGIN * 2,
        (radius + BLEED) * SS,
      );
      ctx.fill();

      setShape({ src: canvas.toDataURL("image/png"), aspect: w / h });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [radius]);

  // The flow is drawn in units of the element's height, so a control much wider than it
  // is tall gets one stretched feature dragged across the whole plate instead of metal.
  // Densifying the pattern buys some of it back, but past roughly six to one there is no
  // setting that reads as a surface, so a full-width form button keeps the flat accent
  // fill it already sits on. Metal is for things shaped like buttons.
  const tooWide = (shape?.aspect ?? 0) > 6;

  return (
    <span ref={hostRef} aria-hidden className="absolute -inset-1.5 block">
      {shape && !tooWide && (
        <MetallicPaint
          imageSrc={shape.src}
          speed={0.35}
          scale={1.8 * Math.max(1, shape.aspect / 3.2)}
          liquid={0.55}
          brightness={1.15}
          contrast={1.05}
          fresnel={0.6}
          contour={0.15}
          refraction={0.02}
          chromaticSpread={0}
          blur={0.03}
          patternSharpness={1.5}
          lightColor="#fafaf9"
          darkColor="#cbcbc7"
          tintColor="#ffffff"
          mouseAnimation={false}
        />
      )}
    </span>
  );
}
