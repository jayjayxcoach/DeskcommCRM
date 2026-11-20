"use client";

/**
 * Gasto diario en Facebook (últimas 6 semanas), con vida: la línea se dibuja al
 * abrir y, al pasar el cursor, un punto recorre la línea mostrando el día y lo
 * que se gastó ese día.
 */
import { useRef, useState } from "react";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function fecha(k: string): string {
  const d = new Date(`${k}T12:00:00Z`);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}
function fechaLarga(k: string): string {
  const d = new Date(`${k}T12:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}
const usd = (v: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(v);

export function GraficoGasto({ dias }: { dias: Array<[string, number]> }) {
  const W = 640;
  const H = 160;
  const tope = Math.max(0, ...dias.map(([, v]) => v));
  const max = Math.max(4, Math.ceil(tope / 2) * 2);
  const bw = W / dias.length;
  const x = (i: number) => i * bw + bw / 2;
  const y = (v: number) => H - 22 - (v / max) * (H - 44);
  const path = dias.map(([, v], i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const total = dias.reduce((a, [, v]) => a + v, 0);

  const svgRef = useRef<SVGSVGElement>(null);
  const [idx, setIdx] = useState<number | null>(null);

  const mover = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    setIdx(Math.min(dias.length - 1, Math.max(0, Math.floor(px / bw))));
  };

  const activo = idx !== null ? dias[idx] : null;
  const ax = idx !== null ? x(idx) : 0;
  const ay = activo ? y(activo[1]) : 0;
  // Posición de la etiqueta en % del ancho, sin salirse de los bordes.
  const izquierda = Math.min(86, Math.max(10, (ax / W) * 100));
  const arriba = (ay / H) * 100;

  return (
    <>
      <div className="eleg-grafico-caja" onMouseLeave={() => setIdx(null)}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="eleg-grafico"
          style={{ width: "100%", marginTop: 18, touchAction: "pan-y" }}
          onMouseMove={(e) => mover(e.clientX)}
          onTouchStart={(e) => e.touches[0] && mover(e.touches[0].clientX)}
          onTouchMove={(e) => e.touches[0] && mover(e.touches[0].clientX)}
          onTouchEnd={() => setIdx(null)}
          role="img"
          aria-label={`Gasto diario en Facebook de las últimas 6 semanas: ${usd(total)} en total`}
        >
          <defs>
            <linearGradient id="eleg-area-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" className="eleg-area-tope" />
              <stop offset="1" className="eleg-area-base" />
            </linearGradient>
          </defs>
          {[0, max / 2, max].map((v) => (
            <g key={v}>
              <line x1={34} x2={W} y1={y(v)} y2={y(v)} className="eleg-rejilla" strokeDasharray="3 5" />
              <text x={0} y={y(v) + 4}>${v}</text>
            </g>
          ))}
          <path d={`${path} L${x(dias.length - 1)} ${H - 22} L${x(0)} ${H - 22}Z`} className="eleg-area eleg-area-anim" />
          <path d={path} className="eleg-linea eleg-linea-anim" fill="none" strokeWidth={2.4} strokeLinejoin="round" pathLength={1} />
          {dias
            .filter((_, i) => i % 7 === 0)
            .map(([k], j) => (
              <text key={k} x={x(j * 7)} y={H - 2} className={idx !== null && Math.floor(idx / 7) === j ? "eleg-eje-on" : ""}>
                {fecha(k)}
              </text>
            ))}
          {activo && (
            <g className="eleg-marca-dia">
              <line x1={ax} x2={ax} y1={14} y2={H - 22} className="eleg-guia" strokeDasharray="2 4" />
              <circle cx={ax} cy={ay} r={9} className="eleg-halo" />
              <circle cx={ax} cy={ay} r={4.5} className="eleg-punto-dia" />
            </g>
          )}
          {/* Zona invisible para que el cursor se detecte en todo el alto */}
          <rect x={0} y={0} width={W} height={H} fill="transparent" />
        </svg>
        {activo && (
          <div className="eleg-burbuja" style={{ left: `${izquierda}%`, top: `calc(${arriba}% + 18px)` }}>
            <b>{usd(activo[1])}</b>
            <span>{fechaLarga(activo[0])}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-[13px] text-text-muted">
        <span className="eleg-ley" />
        Gasto diario en Facebook Ads · últimas 6 semanas
        <span className="ml-auto font-semibold text-text">{usd(total)}</span>
      </div>
    </>
  );
}
