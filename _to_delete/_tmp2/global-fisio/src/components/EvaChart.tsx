import { evaColor } from "@/lib/types";

type Point = { date: string; avg: number };

export default function EvaChart({ points }: { points: Point[] }) {
  if (points.length === 0) return null;

  const w = 640;
  const h = 160;
  const padX = 30;
  const padY = 16;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  const x = (i: number) =>
    points.length === 1
      ? padX + innerW / 2
      : padX + (i / (points.length - 1)) * innerW;
  const y = (v: number) => padY + (1 - v / 10) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.avg).toFixed(1)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full min-w-[480px]"
        role="img"
        aria-label="Evolução da dor (EVA) por sessão"
      >
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line
              x1={padX}
              x2={w - padX}
              y1={y(v)}
              y2={y(v)}
              stroke="#e5e7eb"
              strokeDasharray="4 4"
            />
            <text
              x={padX - 8}
              y={y(v) + 4}
              fontSize="10"
              fill="#9ca3af"
              textAnchor="end"
            >
              {v}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#0e7490" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(p.avg)}
              r="4"
              fill={evaColor(Math.round(p.avg))}
              stroke="white"
              strokeWidth="1.5"
            />
            <text
              x={x(i)}
              y={h - 2}
              fontSize="9"
              fill="#6b7280"
              textAnchor="middle"
            >
              {p.date}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
