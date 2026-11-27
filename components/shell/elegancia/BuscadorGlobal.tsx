"use client";

/**
 * Buscador global de la plantilla Elegancia: Ctrl+K (⌘K en Mac) desde
 * cualquier pantalla, también con el cursor dentro de un campo.
 *
 * Tres listas en una sola ventana:
 *   - Contactos: nombre o número (la misma búsqueda de la Bandeja);
 *   - Mensajes: lo que se escribió en cualquier chat, avisos de Vale incluidos,
 *     y la transcripción de audios (`GET /api/v1/buscar`);
 *   - Pedidos: título y descripción.
 *
 * Abrir un mensaje lleva al chat y salta a ESE mensaje (`&msg=…&en=…`, lo lee
 * `ChatThread`). Flechas ↑↓ para moverse, Enter para abrir, Esc para cerrar.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { ConversationWithContact } from "@/hooks/inbox/useConversationsRealtime";
import { useT } from "@/hooks/i18n/useT";
import { phoneForDisplay } from "@/lib/channels/phone-variants";
import { rotuloParaAEquipe } from "@/lib/contacts/rotulo-do-contato";
import { patronDeBusqueda, trozoConCoincidencia } from "@/lib/elegancia/patron-de-busqueda";

import { Icono } from "./Iconos";

type Mensaje = {
  id: string;
  conversation_id: string;
  texto: string;
  es_transcripcion: boolean;
  saliente: boolean;
  fecha: string;
  contacto: string;
};
type Pedido = {
  id: string;
  titulo: string;
  descripcion: string;
  estado: string;
  etapa: string | null;
  contacto: string | null;
  fecha: string;
};

type Resultado =
  | { tipo: "contacto"; clave: string; href: string; c: ConversationWithContact }
  | { tipo: "mensaje"; clave: string; href: string; m: Mensaje }
  | { tipo: "pedido"; clave: string; href: string; p: Pedido };

const EVENTO_ABRIR = "eleg:abrir-buscador";

/** Para abrir el buscador desde cualquier botón (barra de arriba, panel "Más"). */
export function abrirBuscador() {
  window.dispatchEvent(new Event(EVENTO_ABRIR));
}

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== hoy.getFullYear() ? { year: "numeric" } : {}),
  });
}

function Resaltado({ texto, patron }: { texto: string; patron: string | null }) {
  const t = trozoConCoincidencia(texto, patron);
  return (
    <>
      {t.antes}
      {t.coincide && <mark>{t.coincide}</mark>}
      {t.despues}
    </>
  );
}

export function BuscadorGlobal() {
  const t = useT();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [contactos, setContactos] = useState<ConversationWithContact[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(0);
  const entrada = useRef<HTMLInputElement | null>(null);
  const lista = useRef<HTMLDivElement | null>(null);

  // Ctrl+K / ⌘K — también dentro del cuadro de escribir de la Bandeja.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setAbierto((a) => !a);
      }
    };
    const alPedir = () => setAbierto(true);
    window.addEventListener("keydown", alTeclear, true);
    window.addEventListener(EVENTO_ABRIR, alPedir);
    return () => {
      window.removeEventListener("keydown", alTeclear, true);
      window.removeEventListener(EVENTO_ABRIR, alPedir);
    };
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const id = requestAnimationFrame(() => {
      entrada.current?.focus();
      entrada.current?.select();
    });
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = anterior;
    };
  }, [abierto]);

  const patron = useMemo(() => patronDeBusqueda(texto), [texto]);

  useEffect(() => {
    if (!abierto) return;
    const q = texto.trim();
    if (!patron) {
      setContactos([]);
      setMensajes([]);
      setPedidos([]);
      setCargando(false);
      return;
    }
    const control = new AbortController();
    setCargando(true);
    const espera = setTimeout(async () => {
      const opciones = { signal: control.signal, credentials: "same-origin" as const };
      const [rc, rb] = await Promise.allSettled([
        fetch(`/api/v1/conversations?search=${encodeURIComponent(q)}&limit=8`, opciones).then((r) => r.json()),
        fetch(`/api/v1/buscar?q=${encodeURIComponent(q)}`, opciones).then((r) => r.json()),
      ]);
      if (control.signal.aborted) return;
      const jc = rc.status === "fulfilled" ? (rc.value as { data?: ConversationWithContact[] }) : null;
      const jb =
        rb.status === "fulfilled" ? (rb.value as { data?: { mensajes?: Mensaje[]; pedidos?: Pedido[] } }) : null;
      setContactos(Array.isArray(jc?.data) ? jc.data : []);
      setMensajes(jb?.data?.mensajes ?? []);
      setPedidos(jb?.data?.pedidos ?? []);
      setActivo(0);
      setCargando(false);
    }, 220);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [texto, patron, abierto]);

  const resultados = useMemo<Resultado[]>(
    () => [
      ...contactos.map((c) => ({
        tipo: "contacto" as const,
        clave: `c-${c.id}`,
        href: `/app/inbox?filter=all&id=${encodeURIComponent(c.id)}`,
        c,
      })),
      ...mensajes.map((m) => ({
        tipo: "mensaje" as const,
        clave: `m-${m.id}`,
        href: `/app/inbox?filter=all&id=${encodeURIComponent(m.conversation_id)}&msg=${encodeURIComponent(m.id)}&en=${encodeURIComponent(m.conversation_id)}`,
        m,
      })),
      ...pedidos.map((p) => ({
        tipo: "pedido" as const,
        clave: `p-${p.id}`,
        href: `/app/leads/${encodeURIComponent(p.id)}`,
        p,
      })),
    ],
    [contactos, mensajes, pedidos],
  );

  const cerrar = useCallback(() => setAbierto(false), []);

  const abrir = useCallback(
    (r: Resultado | undefined) => {
      if (!r) return;
      setAbierto(false);
      router.push(r.href);
    },
    [router],
  );

  // Mantener visible la fila activa al moverse con las flechas.
  useEffect(() => {
    lista.current
      ?.querySelector<HTMLElement>(`[data-indice="${activo}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activo]);

  if (!abierto || typeof document === "undefined") return null;

  const alTeclearEnCampo = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivo((i) => Math.min(resultados.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      abrir(resultados[activo]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cerrar();
    }
  };

  const fila = (r: Resultado, i: number) => {
    const props = {

      type: "button" as const,
      "data-indice": i,
      className: `eleg-bg-fila${i === activo ? " on" : ""}`,
      onMouseMove: () => setActivo(i),
      onClick: () => abrir(r),
    };
    if (r.tipo === "contacto") {
      const nombre = rotuloParaAEquipe(r.c.contacts ?? null, t);
      const tel = r.c.contacts?.phone_number ? phoneForDisplay(r.c.contacts.phone_number) : "";
      return (
        <button key={r.clave} {...props}>
          <span className="eleg-bg-ini">{(nombre.trim()[0] ?? "?").toUpperCase()}</span>
          <span className="eleg-bg-txt">
            <b>{nombre}</b>
            <small>
              {tel && tel !== nombre ? `${tel} · ` : ""}
              {r.c.last_message_preview ?? ""}
            </small>
          </span>
          {r.c.last_message_at && <time>{fechaCorta(r.c.last_message_at)}</time>}
        </button>
      );
    }
    if (r.tipo === "mensaje") {
      return (
        <button key={r.clave} {...props}>
          <span className="eleg-bg-ini eleg-bg-ini-msg">
            <Icono nombre="inbox" />
          </span>
          <span className="eleg-bg-txt">
            <b>
              {r.m.contacto}
              <em>{r.m.es_transcripcion ? " · audio" : r.m.saliente ? " · enviado" : " · recibido"}</em>
            </b>
            <small className="eleg-bg-trozo">
              <Resaltado texto={r.m.texto} patron={patron} />
            </small>
          </span>
          <time>{fechaCorta(r.m.fecha)}</time>
        </button>
      );
    }
    return (
      <button key={r.clave} {...props}>
        <span className="eleg-bg-ini eleg-bg-ini-ped">
          <Icono nombre="kanban" />
        </span>
        <span className="eleg-bg-txt">
          <b>
            <Resaltado texto={r.p.titulo} patron={patron} />
          </b>
          <small>
            {[r.p.contacto, r.p.etapa].filter(Boolean).join(" · ")}
          </small>
        </span>
        <time>{fechaCorta(r.p.fecha)}</time>
      </button>
    );
  };

  let indice = 0;
  const seccion = (titulo: string, items: Resultado[]) =>
    items.length === 0 ? null : (
      <section className="eleg-bg-sec">
        <h3>
          {titulo} <span>{items.length}</span>
        </h3>
        {items.map((r) => fila(r, indice++))}
      </section>
    );

  const hayTexto = !!patron;
  const sinNada = hayTexto && !cargando && resultados.length === 0;

  return createPortal(
    <div className="eleg-bg-fondo" onMouseDown={(e) => e.target === e.currentTarget && cerrar()}>
      <div className="eleg-bg" role="dialog" aria-modal="true" aria-label="Buscar en el CRM">
        <div className="eleg-bg-campo">
          <Icono nombre="search" />
          <input
            ref={entrada}
            type="search"
            placeholder="Buscar contactos, mensajes, avisos o pedidos…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={alTeclearEnCampo}
            autoComplete="off"
            spellCheck={false}
          />
          {cargando && <span className="eleg-bg-girando" aria-hidden="true" />}
          <kbd onClick={cerrar}>Esc</kbd>
        </div>
        <div className="eleg-bg-lista" ref={lista}>
          {!hayTexto && (
            <p className="eleg-bg-vacio">
              Escribe un nombre, un número o cualquier palabra de una conversación.
              <br />
              <span>Por ejemplo: el nombre de la quinceañera, una fecha o “Caso para Jay”.</span>
            </p>
          )}
          {seccion("Contactos", resultados.filter((r) => r.tipo === "contacto"))}
          {seccion("Mensajes", resultados.filter((r) => r.tipo === "mensaje"))}
          {seccion("Pedidos", resultados.filter((r) => r.tipo === "pedido"))}
          {sinNada && <p className="eleg-bg-vacio">No encontré nada con “{texto.trim()}”.</p>}
        </div>
        <footer className="eleg-bg-pie">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> moverse
          </span>
          <span>
            <kbd>Enter</kbd> abrir
          </span>
          <span>
            <kbd>Ctrl</kbd>
            <kbd>K</kbd> abrir o cerrar
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
