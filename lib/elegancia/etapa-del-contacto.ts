/**
 * La ETAPA DEL EMBUDO de cada clienta, para la Bandeja (Elegancia de Amor).
 *
 * Una clienta puede tener varios pedidos (un duplicado cerrado en Perdida, o dos
 * eventos reales). La etapa que la Bandeja muestra — y la que usa el filtro de
 * etapas — es la de su PEDIDO PRINCIPAL, con una sola regla para las dos cosas:
 *
 *   1. el pedido ABIERTO más reciente (por `updated_at`);
 *   2. si no tiene ninguno abierto, el más reciente de todos (Pagado, Perdida…).
 *
 * Así una conversación que sale al filtrar "Diseño" lleva la etiqueta "Diseño",
 * nunca la de un duplicado viejo.
 *
 * El COLOR de cada etapa es el mismo del embudo: `crm_stages.color` si la etapa
 * lo tiene; si no, el del Resumen ("Cómo está el embudo"), que pinta las etapas
 * abiertas por su orden con `COLORES_DE_ETAPA`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Los puntos de color del Resumen, en el orden de las etapas abiertas. */
export const COLORES_DE_ETAPA = [
  "#7d6ee6",
  "#3d8fdb",
  "#c99a13",
  "#6f9a16",
  "#e0623f",
  "#d24f84",
  "#2e9e8f",
  "#8e948f",
] as const;

/** Etapa de "ganado" (Pagado) y de "perdido" sin color propio. */
export const COLOR_DE_GANADA = "#2fb344";
export const COLOR_DE_PERDIDA = "#8e948f";

export interface EtapaParaColor {
  id: string;
  color?: string | null;
  position: number | string;
  is_won?: boolean | null;
  is_lost?: boolean | null;
  is_archived?: boolean | null;
}

/** El color con que el embudo pinta `etapa`, dadas las etapas de su funil. */
export function colorDeEtapa(etapa: EtapaParaColor, delFunil: readonly EtapaParaColor[]): string {
  if (etapa.color && /^#[0-9a-fA-F]{6}$/.test(etapa.color)) return etapa.color;
  if (etapa.is_won) return COLOR_DE_GANADA;
  if (etapa.is_lost) return COLOR_DE_PERDIDA;
  const abiertas = delFunil
    .filter((e) => !e.is_archived && !e.is_won && !e.is_lost)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const i = abiertas.findIndex((e) => e.id === etapa.id);
  return COLORES_DE_ETAPA[(i < 0 ? abiertas.length : i) % COLORES_DE_ETAPA.length]!;
}

/**
 * 🔥 La etiqueta que pone Haiku (el vigilante de Vale) en el pedido de una clienta
 * que está LISTA PARA PAGAR (pedido de Jay, 27-nov-2026). Va aparte de la etapa:
 * la etapa dice qué estamos haciendo; esta dice que ella está cerca de pagar.
 */
export const ETIQUETA_LISTA_PARA_PAGAR = "lista-para-pagar";

/** Lo que cada conversación de la Bandeja recibe. */
export interface EtapaDelEmbudo {
  id: string;
  nombre: string;
  color: string;
  /** 🔥 su pedido principal está abierto y lleva `lista-para-pagar`. */
  lista?: boolean;
}

interface PedidoMinimo {
  contact_id: string | null;
  stage_id: string;
  status: string | null;
  updated_at: string | null;
  tags?: string[] | null;
}

/** 🔥 ¿este pedido es de una clienta lista para pagar? (abierto + etiqueta). */
export function pedidoListoParaPagar(p: Pick<PedidoMinimo, "status" | "tags">): boolean {
  return p.status === "open" && (p.tags ?? []).includes(ETIQUETA_LISTA_PARA_PAGAR);
}

/** contacto → su pedido principal (regla de arriba). */
function pedidoPrincipalPorContacto(pedidos: readonly PedidoMinimo[]): Map<string, PedidoMinimo> {
  const mejor = new Map<string, PedidoMinimo>();
  for (const p of pedidos) {
    if (!p.contact_id) continue;
    const actual = mejor.get(p.contact_id);
    if (!actual) {
      mejor.set(p.contact_id, p);
      continue;
    }
    const abiertoP = p.status === "open";
    const abiertoA = actual.status === "open";
    if (abiertoP !== abiertoA) {
      if (abiertoP) mejor.set(p.contact_id, p);
      continue;
    }
    if ((p.updated_at ?? "") > (actual.updated_at ?? "")) mejor.set(p.contact_id, p);
  }
  return mejor;
}

/** contacto → etapa de su pedido principal (regla de arriba). */
export function etapaPrincipalPorContacto(pedidos: readonly PedidoMinimo[]): Map<string, string> {
  const mejor = pedidoPrincipalPorContacto(pedidos);
  const salida = new Map<string, string>();
  for (const [contacto, p] of mejor) salida.set(contacto, p.stage_id);
  return salida;
}

const COLUMNAS_PEDIDO = "contact_id, stage_id, status, updated_at, tags";

/**
 * Los contactos cuyo pedido principal está en alguna de `etapas`, del pedido
 * movido más recientemente al más viejo (si la lista no cabe entera en la URL,
 * quien la corta se queda con los más recientes, que son los de arriba de la
 * Bandeja). Lee todos los pedidos con contacto de la organización (cientos o
 * pocos miles: una consulta por página, solo cuando el filtro está puesto).
 */
export async function contactosEnEtapas(
  supabase: SupabaseClient,
  organizationId: string,
  etapas: readonly string[],
  /** 🔥 solo las clientas listas para pagar (sola o junto con `etapas`). */
  soloListas = false,
): Promise<string[]> {
  const pedidos: PedidoMinimo[] = [];
  const LOTE = 1000;
  for (let desde = 0; desde < 20_000; desde += LOTE) {
    const { data, error } = await supabase
      .from("crm_leads")
      .select(COLUMNAS_PEDIDO)
      .eq("organization_id", organizationId)
      .not("contact_id", "is", null)
      .order("id")
      .range(desde, desde + LOTE - 1);
    if (error) throw error;
    pedidos.push(...((data ?? []) as PedidoMinimo[]));
    if (!data || data.length < LOTE) break;
  }
  const elegidas = new Set(etapas);
  return [...pedidoPrincipalPorContacto(pedidos)]
    .filter(([, p]) => (elegidas.size === 0 || elegidas.has(p.stage_id)) && (!soloListas || pedidoListoParaPagar(p)))
    .sort(([, a], [, b]) => ((b.updated_at ?? "") > (a.updated_at ?? "") ? 1 : -1))
    .map(([contacto]) => contacto);
}

/**
 * Pone `etapa_del_embudo` en cada conversación de la página (o `null` si la
 * clienta no tiene pedido). Nunca lanza: si algo falla, la Bandeja sale sin
 * etiquetas, como antes.
 */
export async function conEtapaDelEmbudo<T extends { contact_id?: string | null }>(
  supabase: SupabaseClient,
  organizationId: string,
  conversaciones: T[],
): Promise<(T & { etapa_del_embudo: EtapaDelEmbudo | null })[]> {
  const sinEtapa = () => conversaciones.map((c) => ({ ...c, etapa_del_embudo: null }));
  const contactos = [...new Set(conversaciones.map((c) => c.contact_id).filter(Boolean))] as string[];
  if (contactos.length === 0) return sinEtapa();
  try {
    const { data: pedidos, error } = await supabase
      .from("crm_leads")
      .select(COLUMNAS_PEDIDO)
      .eq("organization_id", organizationId)
      .in("contact_id", contactos);
    if (error || !pedidos) return sinEtapa();
    const pedidoPrincipal = pedidoPrincipalPorContacto(pedidos as PedidoMinimo[]);
    const principal = etapaPrincipalPorContacto(pedidos as PedidoMinimo[]);
    const idsDeEtapa = [...new Set(principal.values())];
    if (idsDeEtapa.length === 0) return sinEtapa();

    const { data: etapasUsadas } = await supabase
      .from("crm_stages")
      .select("pipeline_id")
      .eq("organization_id", organizationId)
      .in("id", idsDeEtapa);
    const funiles = [...new Set((etapasUsadas ?? []).map((e) => (e as { pipeline_id: string }).pipeline_id))];
    if (funiles.length === 0) return sinEtapa();
    const { data: etapas } = await supabase
      .from("crm_stages")
      .select("id, name, color, position, pipeline_id, is_won, is_lost, is_archived")
      .eq("organization_id", organizationId)
      .in("pipeline_id", funiles);
    type Fila = EtapaParaColor & { name: string; pipeline_id: string };
    const todas = (etapas ?? []) as Fila[];
    const porId = new Map(todas.map((e) => [e.id, e]));

    return conversaciones.map((c) => {
      const etapaId = c.contact_id ? principal.get(c.contact_id) : undefined;
      const etapa = etapaId ? porId.get(etapaId) : undefined;
      if (!etapa) return { ...c, etapa_del_embudo: null };
      const delFunil = todas.filter((e) => e.pipeline_id === etapa.pipeline_id);
      return {
        ...c,
        etapa_del_embudo: {
          id: etapa.id,
          nombre: etapa.name,
          color: colorDeEtapa(etapa, delFunil),
          lista: pedidoListoParaPagar(pedidoPrincipal.get(c.contact_id as string) ?? { status: null }),
        },
      };
    });
  } catch {
    return sinEtapa();
  }
}
