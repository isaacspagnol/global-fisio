import { evaColor } from "@/lib/types";

type Point = { date: string; avg: number };

/**
 * Gráfico de linha simples da EVA média por sessão. Usa as variáveis do tema
 * (grade, texto e linha) para funcionar no modo claro e escuro.
 */
export default function EvaChart({ points }: { points: Point[] }) {
  if (points.length === 0) return null;

  // Largura proporcional ao nº de pontos para caber no celular sem rolagem
  // quando há poucas sessões.
  const w = Math.max(320, Math.min(640, points.length * 56));
  const h = 170;
  const padX = 28;
  const padY = 18;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2 - 14;

  const x = (i: number) =>
    points.length === 1 ? padX + innerW / 2 : padX + (i / (points.length - 1)) * innerW;
  const y = (v: number) => padY + (1 - v / 10) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.avg).toFixed(1)}`)
    .join(" ");
  const area = `${path} L ${x(points.length - 1).toFixed(1)} ${(padY + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

  return (
    <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        style={{ minWidth: points.length > 8 ? 480 : undefined }}
        role="img"
        aria-label="Evolução da dor (EVA) por sessão"
      >
        <defs>
          <linearGradient id="eva-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line
              x1={padX}
              x2={w - padX}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--line)"
              strokeDasharray="4 4"
            />
            <text
              x={padX - 8}
              y={y(v) + 4}
              fontSize="10"
              fill="var(--fg-faint)"
              textAnchor="end"
              className="tnum"
            >
              {v}
            </text>
          </g>
        ))}
        {points.length > 1 && <path d={area} fill="url(#eva-fill)" />}
        <path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={x(i)}
              cy={y(p.avg)}
              r="5"
              fill={evaColor(Math.round(p.avg))}
              stroke="var(--surface)"
              strokeWidth="2"
            />
            <text
              x={x(i)}
              y={y(p.avg) - 10}
              fontSize="10"
              fontWeight="600"
              fill="var(--fg-muted)"
              textAnchor="middle"
              className="tnum"
            >
              {p.avg.toFixed(1).replace(".", ",")}
            </text>
            <text
              x={x(i)}
              y={h - 4}
              fontSize="10"
              fill="var(--fg-muted)"
              textAnchor="middle"
              className="tnum"
            >
              {p.date}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
