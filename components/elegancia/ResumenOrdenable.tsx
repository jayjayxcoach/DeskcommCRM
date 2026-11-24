"use client";

/**
 * Resumen ordenable: el botón cuadrado de arriba a la derecha abre el modo
 * "Organizar". Ahí cada cuadro se puede arrastrar (computadora) o mover con
 * las flechas (celular), cambiar de ancho y ocultar. El orden se guarda en una
 * cookie de este aparato (`eleg-resumen`), así el servidor ya pinta la página
 * en el orden elegido y no hay salto al cargar.
 */
import { useEffect, useState, type ReactNode } from "react";

import { ANCHOS, COOKIE_RESUMEN, type DisposicionResumen } from "@/lib/elegancia/resumen-orden";

export interface BloqueResumen {
  id: string;
  titulo: string;
  anchoPorDefecto: number;
  nodo: ReactNode;
}

/* Clases literales para que Tailwind las genere. */
const CLASE_ANCHO: Record<number, string> = {
  4: "xl:col-span-4",
  5: "xl:col-span-5",
  6: "xl:col-span-6",
  7: "xl:col-span-7",
  8: "xl:col-span-8",
  12: "xl:col-span-12",
};
const NOMBRE_ANCHO: Record<number, string> = {
  4: "⅓",
  5: "5/12",
  6: "½",
  7: "7/12",
  8: "⅔",
  12: "Todo",
};

function guardar(d: DisposicionResumen) {
  document.cookie = `${COOKIE_RESUMEN}=${encodeURIComponent(JSON.stringify(d))}; path=/; max-age=31536000; samesite=lax`;
}

function ordenar(bloques: BloqueResumen[], d: DisposicionResumen): BloqueResumen[] {
  const pos = new Map(d.o.map((id, i) => [id, i]));
  return [...bloques].sort((a, b) => (pos.get(a.id) ?? 999) - (pos.get(b.id) ?? 999));
}

export function ResumenOrdenable({
  encabezado,
  bloques,
  inicial,
}: {
  encabezado: ReactNode;
  bloques: BloqueResumen[];
  inicial: DisposicionResumen;
}) {
  const [disp, setDisp] = useState<DisposicionResumen>(inicial);
  const [editando, setEditando] = useState(false);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);

  const lista = ordenar(bloques, disp);
  const ocultos = new Set(disp.x);

  function cambiar(nueva: DisposicionResumen) {
    setDisp(nueva);
    guardar(nueva);
  }
  function conOrden(ids: string[]) {
    cambiar({ ...disp, o: ids });
  }
  function mover(id: string, paso: -1 | 1) {
    const ids = lista.map((b) => b.id);
    const i = ids.indexOf(id);
    const j = i + paso;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    conOrden(ids);
  }
  function soltarSobre(destino: string) {
    if (!arrastrando || arrastrando === destino) return;
    const ids = lista.map((b) => b.id).filter((x) => x !== arrastrando);
    ids.splice(ids.indexOf(destino), 0, arrastrando);
    conOrden(ids);
  }
  function anchoDe(b: BloqueResumen): number {
    return disp.a[b.id] ?? b.anchoPorDefecto;
  }
  function siguienteAncho(b: BloqueResumen) {
    const i = ANCHOS.indexOf(anchoDe(b) as (typeof ANCHOS)[number]);
    const nuevo = ANCHOS[(i + 1) % ANCHOS.length]!;
    cambiar({ ...disp, a: { ...disp.a, [b.id]: nuevo } });
  }
  function alternarOculto(id: string) {
    cambiar({ ...disp, x: ocultos.has(id) ? disp.x.filter((x) => x !== id) : [...disp.x, id] });
  }
  function restablecer() {
    cambiar({ o: bloques.map((b) => b.id), a: {}, x: [] });
  }

  // Esc cierra el modo organizar.
  useEffect(() => {
    if (!editando) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && setEditando(false);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [editando]);

  return (
    <div className="eleg-resumen flex flex-col gap-5 p-2 sm:p-4">
      <header className="flex flex-wrap items-center gap-x-10 gap-y-4">
        {encabezado}
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className={`eleg-sq ml-auto ${editando ? "activo" : ""}`}
          aria-pressed={editando}
          aria-label={editando ? "Terminar de organizar" : "Organizar el resumen"}
          title={editando ? "Listo" : "Organizar el resumen"}
        >
          {editando ? (
            <svg
              viewBox="0 0 24 24"
              width={20}
              height={20}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width={20}
              height={20}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7.5" height="9" rx="2" />
              <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
              <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
              <rect x="3" y="15" width="7.5" height="6" rx="2" />
            </svg>
          )}
        </button>
      </header>

      {editando && (
        <div className="eleg-aviso-orden">
          <span>
            <b>Organizar el resumen.</b> Arrastra los cuadros o usa las flechas. El botón de ancho
            los hace más grandes o más chicos y el ojo los oculta.
          </span>
          <span className="ml-auto flex gap-2">
            <button type="button" className="eleg-btn-sec" onClick={restablecer}>
              Restablecer
            </button>
            <button type="button" className="eleg-btn-pri" onClick={() => setEditando(false)}>
              Listo
            </button>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {lista.map((b, i) => {
          const oculto = ocultos.has(b.id);
          if (oculto && !editando) return null;
          return (
            <div
              key={b.id}
              className={`${CLASE_ANCHO[anchoDe(b)] ?? "xl:col-span-6"} relative flex min-w-0 flex-col ${editando ? "eleg-orden-caja" : ""} ${
                oculto ? "oculto" : ""
              } ${arrastrando === b.id ? "arrastrando" : ""} ${encima === b.id && arrastrando !== b.id ? "encima" : ""}`}
              draggable={editando}
              onDragStart={(e) => {
                setArrastrando(b.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", b.id);
              }}
              onDragOver={(e) => {
                if (!arrastrando) return;
                e.preventDefault();
                setEncima(b.id);
              }}
              onDragLeave={() => setEncima((x) => (x === b.id ? null : x))}
              onDrop={(e) => {
                e.preventDefault();
                soltarSobre(b.id);
                setArrastrando(null);
                setEncima(null);
              }}
              onDragEnd={() => {
                setArrastrando(null);
                setEncima(null);
              }}
            >
              {editando && (
                <div className="eleg-orden-barra">
                  <span className="eleg-orden-asa" aria-hidden>
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
                      <circle cx="9" cy="6" r="1.6" />
                      <circle cx="15" cy="6" r="1.6" />
                      <circle cx="9" cy="12" r="1.6" />
                      <circle cx="15" cy="12" r="1.6" />
                      <circle cx="9" cy="18" r="1.6" />
                      <circle cx="15" cy="18" r="1.6" />
                    </svg>
                  </span>
                  <span className="truncate font-semibold">{b.titulo}</span>
                  <span className="ml-auto flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => mover(b.id, -1)}
                      disabled={i === 0}
                      aria-label={`Subir ${b.titulo}`}
                      title="Antes"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width={16}
                        height={16}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(b.id, 1)}
                      disabled={i === lista.length - 1}
                      aria-label={`Bajar ${b.titulo}`}
                      title="Después"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width={16}
                        height={16}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="ancho"
                      onClick={() => siguienteAncho(b)}
                      aria-label={`Cambiar ancho de ${b.titulo}`}
                      title="Cambiar ancho"
                    >
                      ↔ {NOMBRE_ANCHO[anchoDe(b)]}
                    </button>
                    <button
                      type="button"
                      onClick={() => alternarOculto(b.id)}
                      aria-label={oculto ? `Mostrar ${b.titulo}` : `Ocultar ${b.titulo}`}
                      title={oculto ? "Mostrar" : "Ocultar"}
                    >
                      {oculto ? (
                        <svg
                          viewBox="0 0 24 24"
                          width={16}
                          height={16}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10 10 0 0 1 12 4c6 0 10 8 10 8a17 17 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s4 8 10 8a9.7 9.7 0 0 0 5.4-1.6" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          width={16}
                          height={16}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </span>
                </div>
              )}
              <div
                className={`eleg-bloque-in flex flex-1 flex-col ${editando ? "eleg-orden-contenido" : ""}`}
              >
                {b.nodo}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
