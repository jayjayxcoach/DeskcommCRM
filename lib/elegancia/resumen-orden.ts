/**
 * Orden del Resumen guardado por aparato (cookie). Vive fuera del componente
 * "use client" porque la página del servidor también lo lee: importar valores
 * de un módulo de cliente en el servidor solo trae una referencia, no el valor.
 */
export interface DisposicionResumen {
  /** ids en el orden elegido */
  o: string[];
  /** ancho elegido por id (columnas de 12) */
  a: Record<string, number>;
  /** ids ocultos */
  x: string[];
}

export const COOKIE_RESUMEN = "eleg-resumen";
export const ANCHOS = [4, 5, 6, 7, 8, 12] as const;

/** Lee la cookie del Resumen; si falta o viene rota, queda el orden de fábrica. */
export function leerDisposicion(crudo: string | undefined, ids: string[]): DisposicionResumen {
  const base: DisposicionResumen = { o: ids, a: {}, x: [] };
  if (!crudo) return base;
  try {
    let texto = crudo;
    if (texto.startsWith("%")) texto = decodeURIComponent(texto);
    const v = JSON.parse(texto) as Partial<DisposicionResumen>;
    const conocidos = new Set(ids);
    const o = Array.isArray(v.o)
      ? v.o.filter((x): x is string => typeof x === "string" && conocidos.has(x))
      : [];
    const a: Record<string, number> = {};
    for (const [k, n] of Object.entries(v.a ?? {})) {
      if (conocidos.has(k) && (ANCHOS as readonly number[]).includes(n)) a[k] = n;
    }
    const x = Array.isArray(v.x)
      ? v.x.filter((id): id is string => typeof id === "string" && conocidos.has(id))
      : [];
    // Cuadros nuevos (o el de dinero si antes no se veía) van al final.
    return { o: [...new Set([...o, ...ids])], a, x };
  } catch {
    return base;
  }
}
