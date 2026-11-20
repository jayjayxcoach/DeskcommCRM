import Link from "next/link";
import { NAV_CATALOG } from "@/lib/navigation/catalogo";
import type { Metadata } from "next";
import { NavHub } from "@/components/shell/NavHub";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { modulosLigados } from "@/lib/instalacao/modulos";
import { createAdminClient } from "@/lib/supabase/admin";
import { aparenciaDeSettings } from "@/lib/aparencia/ajustes";
import type { NavGroupId } from "@/lib/navigation/catalogo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Configurações" };

/**
 * Hub de Organização.
 *
 * A lista de cards que vivia aqui era uma segunda navegação escrita à mão, e
 * divergia do sidebar — Funis, Conexões e Audit Log apareciam como se fossem
 * configuração, quando são CRM, Canais e Análise. Agora o conteúdo vem do
 * registro, e o que sobra aqui é o que de fato é organização: sua conta, sua
 * empresa, e quem tem acesso ao quê.
 *
 * O card-ponte para "Canal oficial (Meta) e templates" que a `main` manteve
 * aqui NÃO foi perdido no merge — ele foi promovido. A ponte existia porque
 * conectar canal tinha duas respostas dependendo do WhatsApp, e quem já sabia
 * procurar em Configurações precisava continuar achando. Com o registro, o
 * grupo CANAIS fica visível no sidebar para todo admin e o ⌘K acha "canal
 * oficial" por nome — a pergunta passa a ter um lugar só, que é o que a ponte
 * tentava ensinar apontando para outro.
 */
export default async function SettingsHubPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  const idioma = user.idioma;

  const admin = createAdminClient();
  const ligados = await modulosLigados(admin, activeOrg?.orgId);
  // Plantilla Elegancia: la barra lateral solo tiene lo del prototipo, y TODAS las
  // demás áreas del CRM viven aquí, en Configuración.
  let elegancia = false;
  if (activeOrg) {
    const { data: org } = await admin.from("organizations").select("settings").eq("id", activeOrg.orgId).maybeSingle();
    elegancia = aparenciaDeSettings((org as { settings?: unknown } | null)?.settings).template === "elegancia";
  }
  const AREAS: Array<{ group: NavGroupId; title: string; subtitle: string }> = [
    { group: "atendimento", title: "Atención", subtitle: "Bandeja, agenda, respuestas rápidas y lo del día a día." },
    { group: "crm", title: "CRM", subtitle: "Embudos, contactos, campañas, tareas, productos y propuestas." },
    { group: "ia", title: "Agente de IA", subtitle: "Agentes, seguimientos, conocimiento, uso y presupuesto." },
    { group: "canais", title: "Canales", subtitle: "WhatsApp y las demás conexiones." },
    { group: "analise", title: "Análisis", subtitle: "Rendimiento, Meta Ads, informes y auditoría." },
  ];
  const agencia =
    ligados.includes("agencias") &&
    activeOrg &&
    !user.support &&
    (user.agency_org_ids ?? []).includes(activeOrg.orgId);
  const porta = NAV_CATALOG.find((d) => d.href === "/app/settings/organizacoes")!;
  return (
    <>
      {agencia && (
        <Link className="mx-6 mt-6 block rounded-lg border p-6" href={porta.href}>
          <h2 className="font-semibold">{traduzir(porta.label, idioma)}</h2>
          <p className="text-sm text-muted-foreground">{traduzir(porta.description, idioma)}</p>
        </Link>
      )}
      <NavHub
        group="organizacao"
        isPlatformAdmin={user.is_platform_admin && !user.support}
        role={activeOrg?.role ?? null}
        interfaceSettings={activeOrg?.interface_settings}
        // A porta do banco externo mora neste hub, e só existe com o módulo ligado.
        modulosLigados={ligados}
        title={traduzir("Configurações", idioma)}
        subtitle={traduzir("Sua conta, os dados da empresa e quem tem acesso ao quê.", idioma)}
        locale={idioma}
      />
      {elegancia &&
        AREAS.map((a) => (
          <NavHub
            key={a.group}
            group={a.group}
            isPlatformAdmin={user.is_platform_admin && !user.support}
            role={activeOrg?.role ?? null}
            // Sin el filtro del menú: aquí se ve todo lo que el rol permite.
            interfaceSettings={undefined}
            modulosLigados={ligados}
            title={a.title}
            subtitle={a.subtitle}
            locale={idioma}
          />
        ))}
    </>
  );
}
