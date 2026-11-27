"use client";

/**
 * Botones por tipo de evento sobre el quadro (Elegancia de Amor).
 *
 * Un toque filtra el embudo por la etiqueta del evento (xv, boda, bautizo,
 * primera-comunion). Solo aparecen los eventos que existen en el quadro: en una
 * organización sin esas etiquetas la fila no se dibuja y nada cambia.
 */
import { useMemo, type ReactNode } from "react";

import type { LeadFilters } from "@/lib/kanban/filters";
import { marcadoresDoFiltro } from "@/lib/kanban/filters";
import { marcadoresDoCard } from "@/lib/kanban/marcadores-do-card";
import type { Lead } from "@/lib/types/leads";
import { cn } from "@/lib/utils";

export const EVENTOS: ReadonlyArray<{ tag: string; nombre: string; ini: string; color: string }> = [
  { tag: "xv", nombre: "Quinceañera", ini: "XV", color: "#e05d8c" },
  { tag: "boda", nombre: "Boda", ini: "BO", color: "#7d6ee6" },
  { tag: "bautizo", nombre: "Bautizo", ini: "BA", color: "#3d8fdb" },
  { tag: "primera-comunion", nombre: "Primera comunión", ini: "PC", color: "#c99a13" },
];

/** 🔥 La etiqueta que pone Haiku a las clientas listas para pagar (27-nov-2026). */
export const ETIQUETA_LISTA = "lista-para-pagar";

interface Props {
  filters: LeadFilters;
  onChange: (f: LeadFilters) => void;
  leads: Lead[];
  /** Algo más al final de la fila (el selector de etapas). */
  children?: ReactNode;
}

export function BotonesDeEvento({ filters, onChange, leads, children }: Props) {
  const cuenta = useMemo(() => {
    const c = new Map<string, number>();
    for (const lead of leads) {
      const marcas = new Set(marcadoresDoCard(lead).map((m) => m.toLowerCase()));
      for (const e of EVENTOS) if (marcas.has(e.tag)) c.set(e.tag, (c.get(e.tag) ?? 0) + 1);
      if (marcas.has(ETIQUETA_LISTA) && lead.status === "open") c.set(ETIQUETA_LISTA, (c.get(ETIQUETA_LISTA) ?? 0) + 1);
    }
    return c;
  }, [leads]);

  const presentes = EVENTOS.filter((e) => (cuenta.get(e.tag) ?? 0) > 0);

  // 🔥 Para cerrar se combina con el evento (las dos etiquetas a la vez).
  const elegidas = marcadoresDoFiltro(filters.tag);
  const listaOn = elegidas.includes(ETIQUETA_LISTA);
  const eventosElegidos = elegidas.filter((t) => t !== ETIQUETA_LISTA);
  const activo = eventosElegidos.length === 1 ? (eventosElegidos[0] ?? null) : null;
  const aplicar = (evento: string | null, lista: boolean) => {
    const tags = [...(evento ? [evento] : []), ...(lista ? [ETIQUETA_LISTA] : [])];
    onChange({ ...filters, tag: tags.length ? tags : undefined, tagMode: undefined });
  };
  const elegir = (tag: string | null) => aplicar(tag, listaOn);

  const botonLista = (
    <button
      type="button"
      aria-pressed={listaOn}
      data-testid="embudo-para-cerrar"
      title="Ver solo las clientas listas para pagar"
      onClick={() => aplicar(activo, !listaOn)}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
        listaOn ? "border-transparent bg-[#e0623f] text-white" : "border-border bg-surface text-text hover:bg-surface-elevated",
      )}
    >
      🔥 Para cerrar
      <span className="text-xs opacity-70">{cuenta.get(ETIQUETA_LISTA) ?? 0}</span>
    </button>
  );

  if (presentes.length === 0)
    return (
      <div className="eleg-eventos flex flex-wrap items-center gap-2">
        {botonLista}
        {children}
      </div>
    );

  const boton = "flex h-10 shrink-0 items-center gap-2 rounded-full border pl-1.5 pr-4 text-sm font-medium transition-colors";
  const normal = "border-border bg-surface text-text hover:bg-surface-elevated";
  const encendido = "border-transparent bg-accent text-accent-foreground";

  return (
    <div className="eleg-eventos flex flex-wrap items-center gap-2" role="group" aria-label="Tipo de evento">
      <button type="button" onClick={() => elegir(null)} className={cn(boton, activo === null ? encendido : normal)}>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-background text-[11px] font-bold text-text">
          ✦
        </span>
        Todos
        <span className="text-xs opacity-60">{leads.length}</span>
      </button>
      {presentes.map((e) => (
        <button
          key={e.tag}
          type="button"
          onClick={() => elegir(activo === e.tag ? null : e.tag)}
          className={cn(boton, activo === e.tag ? encendido : normal)}
        >
          <span
            className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-[#13171a]"
            style={{ background: e.color }}
          >
            {e.ini}
          </span>
          {e.nombre}
          <span className="text-xs opacity-60">{cuenta.get(e.tag)}</span>
        </button>
      ))}
      {botonLista}
      {children}
    </div>
  );
}
