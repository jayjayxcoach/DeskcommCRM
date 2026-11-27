/**
 * Buscador global (Ctrl+K) de la plantilla Elegancia: la MISMA regla para el
 * servidor (regex de Postgres `~*`) y para la pantalla (resaltar el trozo).
 *
 * "maria victoria" tiene que encontrar "María Victoria", "MARIA, Victoria" y
 * "maría  victoria": cada vocal (y la ñ/ç) se vuelve una clase con sus acentos
 * y entre palabras se acepta cualquier cosa corta (espacios, comas, saltos).
 *
 * Solo letras y números del término llegan al patrón: así no hay forma de que
 * un carácter especial rompa el regex ni la gramática del `or=` de PostgREST.
 */

const CLASES: Record<string, string> = {
  a: "[aáàäâã]",
  e: "[eéèëê]",
  i: "[iíìïî]",
  o: "[oóòöôõ]",
  u: "[uúùüû]",
  n: "[nñ]",
  c: "[cç]",
};

/** Mínimo de caracteres útiles para buscar (como la Bandeja). */
export const MINIMO_DE_BUSQUEDA = 2;

/** Las palabras del término, sin acentos, en minúscula y solo [a-z0-9]. */
export function palabrasDeBusqueda(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * El patrón (sintaxis común a Postgres ARE y a JavaScript) o `null` si el
 * término es muy corto para buscar.
 */
export function patronDeBusqueda(texto: string): string | null {
  const palabras = palabrasDeBusqueda(texto);
  if (palabras.join("").length < MINIMO_DE_BUSQUEDA) return null;
  return palabras
    .map((p) => [...p].map((ch) => CLASES[ch] ?? ch).join(""))
    .join(".{1,6}");
}

/**
 * El trozo del texto alrededor de la coincidencia, para mostrar en la lista:
 * `{ antes, coincide, despues }` (vacío `coincide` si no se encontró).
 */
export function trozoConCoincidencia(
  texto: string,
  patron: string | null,
  alrededor = 48,
): { antes: string; coincide: string; despues: string } {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (!patron) return { antes: limpio.slice(0, alrededor * 2), coincide: "", despues: "" };
  let m: RegExpExecArray | null = null;
  try {
    m = new RegExp(patron, "i").exec(limpio);
  } catch {
    m = null;
  }
  if (!m) return { antes: limpio.slice(0, alrededor * 2), coincide: "", despues: "" };
  const ini = Math.max(0, m.index - alrededor);
  const fin = Math.min(limpio.length, m.index + m[0].length + alrededor * 1.6);
  return {
    antes: (ini > 0 ? "…" : "") + limpio.slice(ini, m.index),
    coincide: m[0],
    despues: limpio.slice(m.index + m[0].length, fin) + (fin < limpio.length ? "…" : ""),
  };
}
