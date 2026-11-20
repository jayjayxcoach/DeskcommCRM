import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import {
  EVENTOS_ORDEN,
  dinero,
  eventoDe,
  gastoDeIa,
  sumaPorMoneda,
  ultimosMeses,
} from "@/lib/elegancia/datos";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resumen" };

interface Lead {
  id: string;
  title: string;
  status: string;
  value_cents: number | null;
  currency: string | null;
  stage_id: string;
  tags: string[] | null;
  expected_close_date: string | null;
  created_at: string;
  closed_at: string | null;
  last_activity_at: string | null;
  updated_at: string;
}
interface Etapa {
  id: string;
  name: string;
  position: number;
  color: string | null;
  is_won: boolean;
  is_lost: boolean;
}

const COLORES = ["#7d6ee6", "#3d8fdb", "#c99a13", "#6f9a16", "#e0623f", "#d24f84", "#13171a", "#8e948f"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fecha(d: string): string {
  const x = new Date(`${d.slice(0, 10)}T12:00:00Z`);
  return `${x.getUTCDate()} ${MESES[x.getUTCMonth()]}`;
}
function hace(iso: string | null): string {
  if (!iso) return "";
  const min = (Date.now() - new Date(iso).getTime()) / 60000;
  if (min < 60) return "hace un rato";
  const h = min / 60;
  if (h < 24) return `hace ${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export default async function ResumenPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const supabase = await createClient();

  const { data: funis } = await supabase
    .from("crm_pipelines")
    .select("id, name, is_default, position")
    .eq("organization_id", org.orgId)
    .eq("is_archived", false)
    .order("is_default", { ascending: false })
    .order("position")
    .limit(1);
  const funil = funis?.[0] as { id: string; name: string } | undefined;

  const [{ data: etapasCrudas }, { data: leadsCrudos }] = funil
    ? await Promise.all([
        supabase
          .from("crm_stages")
          .select("id, name, position, color, is_won, is_lost")
          .eq("organization_id", org.orgId)
          .eq("pipeline_id", funil.id)
          .eq("is_archived", false)
          .order("position"),
        supabase
          .from("crm_leads")
          .select("id, title, status, value_cents, currency, stage_id, tags, expected_close_date, created_at, closed_at, last_activity_at, updated_at")
          .eq("organization_id", org.orgId)
          .eq("pipeline_id", funil.id)
          .limit(5000),
      ])
    : [{ data: [] }, { data: [] }];

  const etapas = (etapasCrudas ?? []) as Etapa[];
  const leads = (leadsCrudos ?? []) as Lead[];
  const mes = new Date().toISOString().slice(0, 7);
  const abiertos = leads.filter((l) => l.status === "open");
  const ganadosMes = leads.filter((l) => l.status === "won" && (l.closed_at ?? "").startsWith(mes));
  const nuevosMes = leads.filter((l) => l.created_at.startsWith(mes));
  const deAnuncio = nuevosMes.filter((l) => (l.tags ?? []).some((t) => t.toLowerCase() === "meta_ads")).length;

  const etapasAbiertas = etapas.filter((e) => !e.is_won && !e.is_lost);
  const porEtapa = etapasAbiertas.map((e, i) => {
    const ls = abiertos.filter((l) => l.stage_id === e.id);
    return { ...e, color: e.color ?? COLORES[i % COLORES.length]!, n: ls.length, valor: sumaPorMoneda(ls) };
  });
  const totalAbiertos = Math.max(1, porEtapa.reduce((a, e) => a + e.n, 0));

  const posicion = new Map(etapasAbiertas.map((e, i) => [e.id, i]));
  const calientes = abiertos
    .filter((l) => (posicion.get(l.stage_id) ?? -1) >= Math.max(0, etapasAbiertas.length - 4))
    .sort(
      (a, b) =>
        (posicion.get(b.stage_id) ?? 0) - (posicion.get(a.stage_id) ?? 0) ||
        (b.last_activity_at ?? b.updated_at).localeCompare(a.last_activity_at ?? a.updated_at),
    )
    .slice(0, 6);
  const nombreEtapa = new Map(etapas.map((e) => [e.id, e.name]));
  const colorEtapa = new Map(porEtapa.map((e) => [e.id, e.color]));

  const hoy = new Date().toISOString().slice(0, 10);
  const proximos = abiertos
    .filter((l) => l.expected_close_date && l.expected_close_date >= hoy)
    .sort((a, b) => (a.expected_close_date! > b.expected_close_date! ? 1 : -1))
    .slice(0, 5);
  const actividad = [...leads]
    .sort((a, b) => (b.last_activity_at ?? b.updated_at).localeCompare(a.last_activity_at ?? a.updated_at))
    .slice(0, 6);

  const eventos = [...EVENTOS_ORDEN, { tag: "otro", nombre: "Sin tipo / otros", color: "#8e948f" }].map((e) => ({
    ...e,
    n: abiertos.filter((l) => eventoDe(l.tags) === e.tag).length,
  }));
  const maxEvento = Math.max(1, ...eventos.map((e) => e.n));

  const verGastos = ROLE_RANK[org.role] >= ROLE_RANK.manager;
  const ia = verGastos ? await gastoDeIa(createAdminClient(), org.orgId, ultimosMeses(1)) : [];
  const enlace = (id: string) => (funil ? `/app/pipelines/${funil.id}?lead=${id}` : "/app/kanban");

  return (
    <div className="flex flex-col gap-5 p-6">
      <header className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <h1 className="max-w-xs text-4xl font-semibold leading-tight tracking-tight">Resumen de ventas</h1>
        <Dato titulo="Vendido este mes" valor={sumaPorMoneda(ganadosMes)} extra={`${ganadosMes.length} pago${ganadosMes.length === 1 ? "" : "s"}`} />
        <Dato titulo={`En el embudo · ${abiertos.length} pedidos`} valor={sumaPorMoneda(abiertos)} />
        <Dato titulo="Clientes nuevos este mes" valor={String(nuevosMes.length)} extra={`${deAnuncio} por anuncio`} />
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-8">
          <Titulo texto="Cómo está el embudo" enlace={funil ? `/app/pipelines/${funil.id}` : undefined} />
          <div className="mb-1 flex items-baseline gap-3">
            <span className="text-3xl font-semibold tracking-tight">{sumaPorMoneda(abiertos)}</span>
            <span className="text-sm text-text-muted">en {abiertos.length} pedidos abiertos</span>
          </div>
          <div className="my-4 flex h-3 gap-1 overflow-hidden rounded-full">
            {porEtapa.filter((e) => e.n > 0).map((e) => (
              <i key={e.id} title={`${e.name}: ${e.n}`} style={{ flex: e.n, background: e.color }} className="block rounded-full" />
            ))}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-text-subtle">
                <th className="py-2 font-semibold">Etapa</th>
                <th className="py-2 text-right font-semibold">Pedidos</th>
                <th className="py-2 text-right font-semibold">Valor</th>
                <th className="py-2 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {porEtapa.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} />
                      {e.name}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-semibold">{e.n}</td>
                  <td className="py-2.5 text-right font-semibold">{e.valor}</td>
                  <td className="py-2.5 text-right">{Math.round((e.n / totalAbiertos) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5 xl:col-span-4">
          <Titulo texto="Por tipo de evento" nota="pedidos abiertos" />
          <div className="flex flex-col gap-3">
            {eventos.map((e) => (
              <div key={e.tag}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{e.nombre}</span>
                  <span className="font-semibold">{e.n}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-elevated">
                  <div className="h-full rounded-full" style={{ width: `${(e.n / maxEvento) * 100}%`, background: e.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 xl:col-span-7">
          <Titulo texto="Pedidos calientes" nota="más cerca de pagar" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {calientes.length === 0 && <p className="text-sm text-text-muted">Nada por ahora.</p>}
            {calientes.map((l) => (
              <Link key={l.id} href={enlace(l.id)} className="rounded-2xl border border-border p-4 transition-colors hover:bg-surface-elevated">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: colorEtapa.get(l.stage_id) }} />
                  {nombreEtapa.get(l.stage_id)}
                  {l.expected_close_date ? ` · Fiesta ${fecha(l.expected_close_date)}` : ""}
                </div>
                <div className="mt-1.5 truncate font-semibold">{l.title}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-lg font-bold">{l.value_cents ? dinero(l.value_cents, l.currency ?? "USD") : "—"}</span>
                  <span className="text-xs text-text-muted">{EVENTOS_ORDEN.find((e) => e.tag === eventoDe(l.tags))?.nombre ?? "Otro"}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5 xl:col-span-5">
          <Titulo texto="Próximos eventos" nota="fecha de la fiesta" />
          <Filas
            vacio="Ningún pedido tiene fecha de fiesta próxima."
            filas={proximos.map((l) => ({
              id: l.id,
              href: enlace(l.id),
              izquierda: fecha(l.expected_close_date!),
              titulo: l.title,
              sub: nombreEtapa.get(l.stage_id) ?? "",
              derecha: l.value_cents ? dinero(l.value_cents, l.currency ?? "USD") : "",
            }))}
          />
        </Card>

        <Card className="p-5 xl:col-span-7">
          <Titulo texto="Actividad reciente" />
          <Filas
            vacio="Sin actividad."
            filas={actividad.map((l) => ({
              id: l.id,
              href: enlace(l.id),
              izquierda: "",
              titulo: l.title,
              sub: l.status === "won" ? "Pagó · venta cerrada" : l.status === "lost" ? "No compró" : `Está en ${nombreEtapa.get(l.stage_id) ?? ""}`,
              derecha: hace(l.last_activity_at ?? l.updated_at),
            }))}
          />
        </Card>

        {verGastos && (
          <Card className="p-5 xl:col-span-5">
            <Titulo texto="Gastos del mes" enlace="/app/finanzas" />
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between border-b border-border pb-3">
                <span>IA del CRM</span>
                <span className="font-semibold">{dinero(ia[0]?.centavos ?? 0, "USD", 2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Publicidad en Facebook</span>
                <Link href="/app/finanzas" className="font-semibold underline-offset-4 hover:underline">
                  Ver en Finanzas
                </Link>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Dato({ titulo, valor, extra }: { titulo: string; valor: string; extra?: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        {valor}
        {extra && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">{extra}</span>}
      </div>
      <div className="text-xs text-text-muted">{titulo}</div>
    </div>
  );
}

function Titulo({ texto, nota, enlace }: { texto: string; nota?: string; enlace?: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-[15px] font-semibold">
      {texto}
      <span className="ml-auto flex items-center gap-2 text-xs font-medium text-text-subtle">
        {nota}
        {enlace && (
          <Link href={enlace} className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-surface-elevated" aria-label={`Abrir ${texto}`}>
            ↗
          </Link>
        )}
      </span>
    </h2>
  );
}

function Filas({
  filas,
  vacio,
}: {
  vacio: string;
  filas: Array<{ id: string; href: string; izquierda: string; titulo: string; sub: string; derecha: string }>;
}) {
  if (filas.length === 0) return <p className="text-sm text-text-muted">{vacio}</p>;
  return (
    <div className="flex flex-col">
      {filas.map((f, i) => (
        <Link key={f.id} href={f.href} className={`flex items-center gap-3 py-2.5 ${i ? "border-t border-border" : ""}`}>
          {f.izquierda && (
            <span className="shrink-0 rounded-full bg-surface-elevated px-2.5 py-1 text-xs font-semibold">{f.izquierda}</span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{f.titulo}</span>
            <span className="block truncate text-xs text-text-muted">{f.sub}</span>
          </span>
          <span className="ml-auto shrink-0 text-sm text-text-muted">{f.derecha}</span>
        </Link>
      ))}
    </div>
  );
}
