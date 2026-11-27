"use client";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { apiClient } from "@/lib/api/client";
import type { Conversation, Message } from "@/lib/types/messaging";

/**
 * Elegancia (pedido de Jay, 27-nov-2026): UNA CLIENTA = UN CHAT.
 *
 * Las clientas escriben por Messenger, después por WhatsApp o Instagram. Cuando
 * sus fichas se juntan (Contactos › Juntar con otra ficha), el contacto queda con
 * varias conversaciones, una por canal. Este hook trae las OTRAS conversaciones
 * del mismo contacto y sus últimos mensajes, para que el chat las muestre
 * intercaladas por fecha, cada una con su canal. Solo lectura: se responde por
 * la conversación abierta (los botones de canal de arriba cambian de una a otra).
 *
 * Lee por las mismas rutas de la sesión (`/api/v1/conversations?contact_id=` y
 * `/api/v1/conversations/<id>/messages`): la RLS decide lo que se ve.
 */
export interface OtroCanal {
  id: string;
  canal: string;
  ultimo: string | null;
}

export interface MensajeDeOtroCanal {
  mensaje: Message;
  conversaId: string;
  canal: string;
}

type ConversaMinima = Pick<Conversation, "id" | "channel" | "last_message_at" | "contact_id">;

const MAXIMO_DE_OTRAS = 3;

export function useOtrosCanalesDelContacto(contactId: string | null | undefined, conversationId: string | null) {
  const conversas = useQuery({
    queryKey: ["conversas-do-contato-canales", contactId],
    queryFn: async () => {
      const qs = new URLSearchParams({ contact_id: contactId as string, limit: "20" });
      const res = await apiClient.get<{ data: ConversaMinima[] }>(`/api/v1/conversations?${qs.toString()}`);
      return res.data;
    },
    enabled: !!contactId && !!conversationId,
    staleTime: 30_000,
  });

  const otras: OtroCanal[] = useMemo(
    () =>
      (conversas.data ?? [])
        .filter((c) => c.id !== conversationId && (!c.contact_id || c.contact_id === contactId))
        .slice(0, MAXIMO_DE_OTRAS)
        .map((c) => ({ id: c.id, canal: c.channel, ultimo: c.last_message_at ?? null })),
    [conversas.data, conversationId, contactId],
  );

  const actual = useMemo(
    () => (conversas.data ?? []).find((c) => c.id === conversationId) ?? null,
    [conversas.data, conversationId],
  );

  const consultas = useQueries({
    queries: otras.map((c) => ({
      queryKey: ["mensajes-otro-canal", c.id],
      queryFn: async () => {
        const res = await apiClient.get<{ data: Message[] }>(`/api/v1/conversations/${c.id}/messages?limit=50`);
        return res.data;
      },
      staleTime: 30_000,
      refetchInterval: 60_000,
    })),
  });

  // `consultas` cambia de identidad en cada render: lo que importa es cuándo llegó cada respuesta.
  const firma = consultas.map((q) => q.dataUpdatedAt).join(",");
  const mensajes: MensajeDeOtroCanal[] = useMemo(() => {
    const salida: MensajeDeOtroCanal[] = [];
    otras.forEach((c, i) => {
      for (const m of consultas[i]?.data ?? []) {
        if (m.type === "reaction") continue;
        salida.push({ mensaje: m, conversaId: c.id, canal: c.canal });
      }
    });
    return salida;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otras, firma]);

  return { otras, mensajes, canalActual: actual?.channel ?? null };
}

/** Nombre del canal como lo dice la gente. */
export function nombreDelCanal(canal: string | null | undefined): string {
  switch ((canal ?? "").toLowerCase()) {
    case "whatsapp":
      return "WhatsApp";
    case "facebook":
    case "messenger":
      return "Messenger";
    case "instagram":
      return "Instagram";
    default:
      return canal ? canal.charAt(0).toUpperCase() + canal.slice(1) : "Otro canal";
  }
}
