/**
 * The Ritual mark, turning slowly in the middle of the header.
 *
 * The supplied animation was a 1280x720 GIF of a 3D render, 5.8 MB, on an opaque grey
 * backdrop — nothing that could be keyed out, since the backdrop is a gradient and the
 * mark's own shaded faces fall darker than parts of it. So the turn is rebuilt here from
 * the flat mark instead: a short stack of the same image, each copy pushed a fraction of
 * a pixel further back and dimmed, which reads as extruded metal the moment the stack
 * turns away from the viewer. One 8 KB image, and it stays crisp at any size.
 */
export function RitualKnot({ size = 38, layers = 9 }: { size?: number; layers?: number }) {
  return (
    <span className="knot" aria-hidden style={{ width: size, height: size }}>
      <span className="knot-spin">
        {Array.from({ length: layers }, (_, i) => (
          <img
            key={i}
            src="/ritual-knot.png"
            alt=""
            width={size}
            height={size}
            className="knot-face"
            style={{
              // An extruded object has two faces of the same material and dark walls
              // between them. Dimming by depth alone looks right until the turn passes
              // side-on and the back of the stack swings to the front, which is why the
              // outer two layers are both left at full light.
              transform: `translateZ(${-i * 0.5}px)`,
              filter: `brightness(${i === 0 || i === layers - 1 ? 1 : 0.34})`,
            }}
          />
        ))}
      </span>
    </span>
  );
}
