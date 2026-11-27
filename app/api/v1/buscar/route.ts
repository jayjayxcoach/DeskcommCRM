/**
 * GET /api/v1/buscar?q=… — buscador global (Ctrl+K) de la plantilla Elegancia.
 *
 * Busca DENTRO de lo escrito, que es lo que la Bandeja no hace (ella busca por
 * nombre, teléfono y la última mensaje):
 *   - mensajes: el texto y la transcripción de audios/fotos (`media_derived_text`);
 *   - pedidos: título y descripción.
 *
 * Solo sesión (cookie). Cliente de la sesión → la RLS decide lo que se ve, y
 * además se filtra la organización activa explícitamente.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { loadAuthUser } from "@/lib/auth/server";
import { orgAtivaDaApi } from "@/lib/auth/require-role";
import { patronDeBusqueda } from "@/lib/elegancia/patron-de-busqueda";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LIMITE_MENSAJES = 40;
const LIMITE_PEDIDOS = 10;

type Contacto = { name: string | null; display_name: string | null; phone_number: string | null } | null;

function nombreDelContacto(c: Contacto): string {
  return (c?.name ?? "").trim() || (c?.display_name ?? "").trim() || (c?.phone_number ?? "").trim() || "Sin nombre";
}

function uno<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return fail("unauthenticated", "Auth required.", 401, { requestId });

  const authUser = await loadAuthUser();
  const ativa = await orgAtivaDaApi(authUser, requestId);
  if (!ativa.ok) return ativa.response;
  const orgId = ativa.org?.orgId;
  if (!orgId) return fail("no_active_org", "No active organization.", 403, { requestId });

  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 120);
  const patron = patronDeBusqueda(q);
  if (!patron) return ok({ mensajes: [], pedidos: [] }, { requestId });

  // Comillas dobles: el valor entra entero al `or=` aunque lleve corchetes o puntos.
  const filtroMensajes = `body.imatch."${patron}",media_derived_text.imatch."${patron}"`;
  const filtroPedidos = `title.imatch."${patron}",description.imatch."${patron}"`;

  const [mensajes, pedidos] = await Promise.all([
    supabase
      .from("messages")
      .select(
        "id, conversation_id, body, media_derived_text, direction, type, created_at, conversations!inner(id, contacts(name, display_name, phone_number))",
      )
      .eq("organization_id", orgId)
      .is("revoked_at", null)
      .or(filtroMensajes)
      .order("created_at", { ascending: false })
      .limit(LIMITE_MENSAJES),
    supabase
      .from("crm_leads")
      .select("id, title, description, status, contact_id, updated_at, crm_stages(name), contacts(name, display_name, phone_number)")
      .eq("organization_id", orgId)
      .or(filtroPedidos)
      .order("updated_at", { ascending: false })
      .limit(LIMITE_PEDIDOS),
  ]);

  if (mensajes.error && pedidos.error) {
    return fail("search_failed", "No se pudo buscar.", 500, { requestId });
  }

  type FilaMensaje = {
    id: string;
    conversation_id: string;
    body: string | null;
    media_derived_text: string | null;
    direction: string;
    type: string;
    created_at: string;
    conversations: { id: string; contacts: Contacto | Contacto[] } | { id: string; contacts: Contacto | Contacto[] }[];
  };
  type FilaPedido = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    contact_id: string | null;
    updated_at: string;
    crm_stages: { name: string } | { name: string }[] | null;
    contacts: Contacto | Contacto[];
  };

  return ok(
    {
      mensajes: ((mensajes.data ?? []) as unknown as FilaMensaje[]).map((m) => {
        const conv = uno(m.conversations);
        return {
          id: m.id,
          conversation_id: m.conversation_id,
          texto: (m.body ?? "").trim() || (m.media_derived_text ?? "").trim(),
          es_transcripcion: !(m.body ?? "").trim() && !!m.media_derived_text,
          saliente: m.direction === "outbound",
          fecha: m.created_at,
          contacto: nombreDelContacto(uno(conv?.contacts ?? null)),
        };
      }),
      pedidos: ((pedidos.data ?? []) as unknown as FilaPedido[]).map((p) => ({
        id: p.id,
        titulo: p.title,
        descripcion: p.description ?? "",
        estado: p.status,
        etapa: uno(p.crm_stages)?.name ?? null,
        contact_id: p.contact_id,
        contacto: p.contact_id ? nombreDelContacto(uno(p.contacts)) : null,
        fecha: p.updated_at,
      })),
    },
    { requestId },
  );
}
