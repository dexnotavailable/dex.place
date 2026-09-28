import { useSeason } from "./season";

interface Props {
  size?: number;
  className?: string;
  color?: string;
}

export function DexMark({ size = 34, className = "", color }: Props) {
  const { season } = useSeason();
  const markColor = color ?? season.accent;

  return (
    <span
      className={"inline-block select-none " + className}
      style={{
        fontFamily: "'Daniel Dex', cursive",
        color: markColor,
        fontSize: size,
        lineHeight: 0.9,
        transform: "skewX(-12deg) rotate(-1deg)",
        letterSpacing: "0",
        textShadow: `0 0 18px ${season.glow}`,
      }}
    >
      dex
    </span>
  );
}
