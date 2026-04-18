interface ShimmerProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  className?: string;
}

export function Shimmer({
  width = "100%",
  height = 20,
  borderRadius = 4,
  className,
}: ShimmerProps) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: "var(--paper-deep)",
        backgroundImage:
          "linear-gradient(90deg, var(--paper-deep) 25%, var(--rule) 50%, var(--paper-deep) 75%)",
        backgroundSize: "400px 100%",
        animation: "shimmer 1.5s infinite",
      }}
    />
  );
}
