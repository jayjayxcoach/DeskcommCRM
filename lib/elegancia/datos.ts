/**
 * Datos de las pantallas Resumen y Finanzas (Elegancia de Amor).
 *
 * Todo se lee del lado del servidor y siempre filtrado por la organización
 * activa. Lo que usa el cliente de servicio (gasto de IA, credencial de Meta)
 * filtra `organization_id` a mano, con el id resuelto de la sesión.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { lerCredencialDeLeitura } from "@/lib/plataformas-de-anuncio/credenciais-de-leitura";
import { lerInsights, listarContas } from "@/lib/plataformas-de-anuncio/meta/insights";

export interface MesDeGasto {
  /** AAAA-MM */
  mes: string;
  centavos: number;
  llamadas: number;
}

export type GastoDeFacebook =
  | { estado: "sin_conexion" }
  | { estado: "error"; detalle: string }
  | { estado: "ok"; moneda: string; meses: MesDeGasto[] };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function nombreDelMes(aaaamm: string): string {
  const [a, m] = aaaamm.split("-").map(Number);
  return `${MESES[(m ?? 1) - 1]} ${a}`;
}

/** Los últimos `n` meses (AAAA-MM), del más antiguo al actual. */
export function ultimosMeses(n: number, hoy = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

function finDelMes(aaaamm: string): string {
  const [a, m] = aaaamm.split("-").map(Number);
  const d = new Date(Date.UTC(a!, m!, 0));
  const hoy = new Date();
  return (d > hoy ? hoy : d).toISOString().slice(0, 10);
}

/** Gasto de IA del CRM por mes, desde `llm_calls` (solo lo que tiene precio conocido suma). */
export async function gastoDeIa(admin: SupabaseClient, orgId: string, meses: string[]): Promise<MesDeGasto[]> {
  const desde = `${meses[0]}-01T00:00:00Z`;
  const { data } = await admin
    .from("llm_calls")
    .select("cost_cents, created_at")
    .eq("organization_id", orgId)
    .gte("created_at", desde)
    .limit(50000);
  const porMes = new Map(meses.map((m) => [m, { mes: m, centavos: 0, llamadas: 0 }]));
  for (const fila of (data ?? []) as Array<{ cost_cents: number | null; created_at: string }>) {
    const m = porMes.get(fila.created_at.slice(0, 7));
    if (!m) continue;
    m.llamadas += 1;
    m.centavos += Number(fila.cost_cents ?? 0);
  }
  return [...porMes.values()];
}

/** Gasto en Meta Ads (Facebook/Instagram) por mes, leído en vivo de la cuenta conectada. */
export async function gastoDeFacebook(admin: SupabaseClient, orgId: string, meses: string[]): Promise<GastoDeFacebook> {
  const credencial = await lerCredencialDeLeitura(admin, orgId, "meta_ads");
  if (!credencial.ok) return { estado: "sin_conexion" };
  const token = credencial.credencial.accessToken;
  try {
    const contas = await listarContas(token);
    if (!contas.ok) return { estado: "error", detalle: String(contas.detalle ?? contas.falha) };
    const moeda = contas.dados[0]?.moeda ?? "USD";
    const resultado: MesDeGasto[] = [];
    for (const mes of meses) {
      let centavos = 0;
      for (const conta of contas.dados) {
        const ins = await lerInsights(token, conta.id, `${mes}-01`, finDelMes(mes));
        if (!ins.ok) continue;
        for (const linha of ins.dados) centavos += Math.round(Number(linha.spend ?? 0) * 100);
      }
      resultado.push({ mes, centavos, llamadas: 0 });
    }
    return { estado: "ok", moneda: moeda, meses: resultado };
  } catch (e) {
    return { estado: "error", detalle: e instanceof Error ? e.message : "lectura falló" };
  }
}

/** Dinero con su moneda, en español: $49, S/ 100, $ 227.000 COP. */
export function dinero(centavos: number, moneda = "USD", decimales = 0): string {
  try {
    return new Intl.NumberFormat("es-EC", {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(centavos / 100);
  } catch {
    return `${(centavos / 100).toFixed(decimales)} ${moneda}`;
  }
}

/** Suma por moneda y la escribe junta: "$1.793 + $ 227.000 COP". */
export function sumaPorMoneda(filas: Array<{ value_cents: number | null; currency: string | null }>): string {
  const por = new Map<string, number>();
  for (const f of filas) {
    if (!f.value_cents) continue;
    const m = f.currency ?? "USD";
    por.set(m, (por.get(m) ?? 0) + f.value_cents);
  }
  if (por.size === 0) return dinero(0);
  return [...por.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m, c]) => dinero(c, m))
    .join(" + ");
}

export const EVENTOS_ORDEN: ReadonlyArray<{ tag: string; nombre: string; color: string }> = [
  { tag: "xv", nombre: "Quinceañera", color: "#e05d8c" },
  { tag: "boda", nombre: "Boda", color: "#7d6ee6" },
  { tag: "bautizo", nombre: "Bautizo", color: "#3d8fdb" },
  { tag: "primera-comunion", nombre: "Primera comunión", color: "#c99a13" },
];

export function eventoDe(tags: string[] | null): string {
  const t = new Set((tags ?? []).map((x) => x.toLowerCase()));
  return EVENTOS_ORDEN.find((e) => t.has(e.tag))?.tag ?? "otro";
}
