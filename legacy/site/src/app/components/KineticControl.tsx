import {
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { ArrowUpRight } from "lucide-react";

type Variant = "accent" | "outline" | "dark";

interface SharedProps {
  label: string;
  accent: string;
  className?: string;
  compact?: boolean;
  icon?: ReactNode;
  variant?: Variant;
}

interface LinkProps extends SharedProps {
  href: string;
  target?: string;
  rel?: string;
  download?: string | boolean;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

interface ControlButtonProps
  extends SharedProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {}

function useMagnet(disabled = false) {
  const reduceMotion = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 360, damping: 24, mass: 0.28 });
  const y = useSpring(rawY, { stiffness: 360, damping: 24, mass: 0.28 });

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    if (reduceMotion || disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    rawX.set(((event.clientX - rect.left) / rect.width - 0.5) * 12);
    rawY.set(((event.clientY - rect.top) / rect.height - 0.5) * 10);
  };

  const reset = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return { move, reset, x, y };
}

function ControlContents({ label, accent, icon }: Pick<SharedProps, "label" | "accent" | "icon">) {
  return (
    <>
      <span className="kinetic-control__fill" style={{ background: accent }} />
      <span className="kinetic-control__icon" aria-hidden="true">
        {icon ?? <ArrowUpRight size={15} strokeWidth={2.2} />}
      </span>
      <span className="kinetic-control__labels">
        <span className="kinetic-control__label">{label}</span>
        <span className="kinetic-control__label kinetic-control__label--echo" aria-hidden="true">
          {label}
        </span>
      </span>
    </>
  );
}

function Sparks({ burst, accent }: { burst: number; accent: string }) {
  if (burst === 0) return null;

  return (
    <span key={burst} className="kinetic-sparks" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <span
          key={index}
          className="kinetic-spark"
          style={{
            background: accent,
            "--spark-angle": `${index * 45}deg`,
          } as CSSProperties}
        />
      ))}
    </span>
  );
}

export function KineticLink({
  label,
  accent,
  href,
  target,
  rel,
  download,
  className = "",
  compact = false,
  icon,
  variant = "accent",
  onClick,
}: LinkProps) {
  const magnet = useMagnet();
  const [burst, setBurst] = useState(0);

  return (
    <motion.a
      href={href}
      target={target}
      rel={rel}
      download={download}
      onPointerMove={magnet.move}
      onPointerLeave={magnet.reset}
      onBlur={magnet.reset}
      onClick={(event) => {
        setBurst((value) => value + 1);
        onClick?.(event);
      }}
      className={`kinetic-control kinetic-control--${variant} ${compact ? "kinetic-control--compact" : ""} ${className}`}
      style={{ x: magnet.x, y: magnet.y, background: variant === "accent" ? accent : undefined }}
    >
      <ControlContents label={label} accent={accent} icon={icon} />
      <Sparks burst={burst} accent={accent} />
    </motion.a>
  );
}

export function KineticButton({
  label,
  accent,
  className = "",
  compact = false,
  icon,
  variant = "outline",
  disabled,
  onClick,
  type = "button",
  ...props
}: ControlButtonProps) {
  const magnet = useMagnet(disabled);
  const [burst, setBurst] = useState(0);

  return (
    <motion.button
      {...props}
      type={type}
      disabled={disabled}
      onPointerMove={magnet.move}
      onPointerLeave={magnet.reset}
      onBlur={magnet.reset}
      onClick={(event) => {
        if (!disabled) setBurst((value) => value + 1);
        onClick?.(event);
      }}
      className={`kinetic-control kinetic-control--${variant} ${compact ? "kinetic-control--compact" : ""} ${className}`}
      style={{ x: magnet.x, y: magnet.y, background: variant === "accent" ? accent : undefined }}
    >
      <ControlContents label={label} accent={accent} icon={icon} />
      <Sparks burst={burst} accent={accent} />
    </motion.button>
  );
}
