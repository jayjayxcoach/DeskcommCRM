import { describe, expect, it } from "vitest";

import {
  COLORES_DE_ETAPA,
  COLOR_DE_GANADA,
  colorDeEtapa,
  etapaPrincipalPorContacto,
} from "./etapa-del-contacto";

describe("etapa principal de cada clienta", () => {
  it("el pedido abierto gana al cerrado, aunque el cerrado sea más nuevo", () => {
    const m = etapaPrincipalPorContacto([
      { contact_id: "a", stage_id: "perdida", status: "lost", updated_at: "2026-11-25" },
      { contact_id: "a", stage_id: "diseno", status: "open", updated_at: "2026-11-20" },
    ]);
    expect(m.get("a")).toBe("diseno");
  });

  it("entre abiertos, el movido más recientemente", () => {
    const m = etapaPrincipalPorContacto([
      { contact_id: "a", stage_id: "prospecto", status: "open", updated_at: "2026-11-01" },
      { contact_id: "a", stage_id: "enviado", status: "open", updated_at: "2026-11-24" },
    ]);
    expect(m.get("a")).toBe("enviado");
  });

  it("sin abiertos, el más reciente de todos; sin contacto, nada", () => {
    const m = etapaPrincipalPorContacto([
      { contact_id: "a", stage_id: "pagado", status: "won", updated_at: "2026-11-24" },
      { contact_id: "a", stage_id: "perdida", status: "lost", updated_at: "2026-11-02" },
      { contact_id: null, stage_id: "x", status: "open", updated_at: "2026-11-25" },
    ]);
    expect(m.get("a")).toBe("pagado");
    expect(m.size).toBe(1);
  });
});

describe("color de la etapa = el del embudo", () => {
  const funil = [
    { id: "p", position: 1000 },
    { id: "c", position: 2000 },
    { id: "vieja", position: 2500, is_archived: true },
    { id: "d", position: 3000 },
    { id: "g", position: 7000, is_won: true },
  ];
  it("las abiertas, por su orden, con la paleta del Resumen (archivadas no cuentan)", () => {
    expect(colorDeEtapa(funil[0]!, funil)).toBe(COLORES_DE_ETAPA[0]);
    expect(colorDeEtapa(funil[3]!, funil)).toBe(COLORES_DE_ETAPA[2]);
  });
  it("el color guardado en la etapa manda", () => {
    expect(colorDeEtapa({ ...funil[1]!, color: "#123456" }, funil)).toBe("#123456");
  });
  it("ganada sin color propio = verde", () => {
    expect(colorDeEtapa(funil[4]!, funil)).toBe(COLOR_DE_GANADA);
  });
});
