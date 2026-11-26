"use client";

/**
 * Selector de etapas del quadro (Elegancia de Amor).
 *
 * Un botón "Etapas" junto a los botones de evento: abre la lista de etapas del
 * funil y quien mira marca solo las que quiere ver (p. ej. Diseño y Pagado). Es
 * una preferencia de VISTA, guardada por aparato y por funil (localStorage
 * `eleg-etapas:<pipelineId>`): no cambia nada en el banco, no esconde negocios
 * de nadie más y no toca los menús de "mover a…", que siguen listando todas.
 */
import { useEffect, useMemo, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { colorDeEtapa } from "@/lib/elegancia/etapa-del-contacto";
import { ordenarEtapasDoFunil } from "@/lib/kanban/ordem-das-etapas";
import type { Stage } from "@/lib/kanban/types";
import type { Lead } from "@/lib/types/leads";
import { cn } from "@/lib/utils";

const clave = (pipelineId: string) => `eleg-etapas:${pipelineId}`;

/**
 * Estado del selector: `null` = todas las etapas. Se lee del aparato DESPUÉS de
 * montar (la página se arma en el servidor, que no tiene localStorage).
 */
export function useEtapasVisibles(pipelineId: string, stages: Stage[] | undefined) {
  const [elegidas, setElegidas] = useState<string[] | null>(null);

  useEffect(() => {
    try {
      const crudo = window.localStorage.getItem(clave(pipelineId));
      const lista = crudo ? (JSON.parse(crudo) as unknown) : null;
      setElegidas(Array.isArray(lista) && lista.length > 0 ? lista.map(String) : null);
    } catch {
      setElegidas(null);
    }
  }, [pipelineId]);

  const guardar = (ids: string[] | null) => {
    const valor = ids && ids.length > 0 ? ids : null;
    setElegidas(valor);
    try {
      if (valor) window.localStorage.setItem(clave(pipelineId), JSON.stringify(valor));
      else window.localStorage.removeItem(clave(pipelineId));
    } catch {
      /* aparato sin almacenamiento: el filtro vale solo mientras la página esté abierta */
    }
  };

  // Una etapa borrada o archivada que quedó guardada no cuenta; si no queda
  // ninguna válida, se ven todas (nunca un quadro vacío por un id viejo).
  const visibles = useMemo(() => {
    if (!elegidas || !stages) return null;
    const existentes = new Set(stages.filter((s) => !s.is_archived).map((s) => s.id));
    const validas = elegidas.filter((id) => existentes.has(id));
    return validas.length > 0 ? new Set(validas) : null;
  }, [elegidas, stages]);

  return { visibles, guardar };
}

interface Props {
  stages: Stage[];
  /** Para contar cuántos pedidos hay en cada etapa. Sin esto no se muestran cuentas. */
  leads?: Lead[];
  visibles: ReadonlySet<string> | null;
  onChange: (ids: string[] | null) => void;
  /** Clases extra del botón (la Bandeja lo pone a lo ancho de la columna). */
  className?: string;
  /** Texto del botón cuando no hay filtro. */
  textoSinFiltro?: string;
}

export function SelectorDeEtapas({
  stages,
  leads,
  visibles,
  onChange,
  className,
  textoSinFiltro = "Etapas",
}: Props) {
  const etapas = useMemo(
    () => ordenarEtapasDoFunil(stages).filter((s) => !s.is_archived),
    [stages],
  );
  const cuenta = useMemo(() => {
    const c = new Map<string, number>();
    for (const l of leads ?? []) c.set(l.stage_id, (c.get(l.stage_id) ?? 0) + 1);
    return c;
  }, [leads]);

  if (etapas.length === 0) return null;

  const filtrando = visibles !== null;
  const nombres = etapas.filter((e) => visibles?.has(e.id)).map((e) => e.name);
  const etiqueta = !filtrando
    ? textoSinFiltro
    : nombres.length <= 2
      ? nombres.join(" · ")
      : `${nombres.length} etapas`;

  const alternar = (id: string) => {
    const actual = new Set(visibles ?? []);
    if (actual.has(id)) actual.delete(id);
    else actual.add(id);
    // Marcar todas es lo mismo que no filtrar.
    onChange(actual.size === 0 || actual.size === etapas.length ? null : [...actual]);
  };

  const boton = "flex h-10 shrink-0 items-center gap-2 rounded-full border pl-1.5 pr-4 text-sm font-medium transition-colors";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            boton,
            filtrando
              ? "border-transparent bg-accent text-accent-foreground"
              : "border-border bg-surface text-text hover:bg-surface-elevated",
            className,
          )}
          aria-label="Elegir qué etapas ver"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-background text-[13px] text-text">
            ☰
          </span>
          <span className="min-w-0 max-w-[14rem] flex-1 truncate text-left">{etiqueta}</span>
          <span className="text-xs opacity-60">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="flex items-center justify-between px-2 pb-2 pt-1">
          <span className="text-sm font-semibold">Ver solo estas etapas</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              filtrando ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            )}
          >
            Ver todas
          </button>
        </div>
        <ul className="flex max-h-[60vh] flex-col gap-0.5 overflow-y-auto">
          {etapas.map((e) => {
            const marcada = filtrando && visibles.has(e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={marcada}
                  onClick={() => alternar(e.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-surface-elevated",
                    marcada && "bg-surface-elevated font-medium",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] font-bold",
                      marcada ? "border-transparent bg-accent text-accent-foreground" : "border-border",
                    )}
                  >
                    {marcada ? "✓" : ""}
                  </span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: colorDeEtapa(e, stages) }}
                  />
                  <span className="flex-1 truncate">{e.name}</span>
                  {leads && (
                    <span className="text-xs text-muted-foreground">{cuenta.get(e.id) ?? 0}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="px-2 pt-2 text-[11px] text-muted-foreground">
          Se guarda en este aparato. Sin ninguna marcada se ven todas.
        </p>
      </PopoverContent>
    </Popover>
  );
}
