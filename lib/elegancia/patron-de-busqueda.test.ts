import { describe, expect, it } from "vitest";

import { patronDeBusqueda, trozoConCoincidencia } from "./patron-de-busqueda";

describe("patronDeBusqueda", () => {
  it("encuentra con y sin acentos, mayúsculas y signos entre palabras", () => {
    const p = patronDeBusqueda("maria victoria");
    expect(p).not.toBeNull();
    const re = new RegExp(p!, "i");
    expect(re.test("XV de María Victoria")).toBe(true);
    expect(re.test("MARIA, VICTORIA")).toBe(true);
    expect(re.test("maría  victoria")).toBe(true);
    expect(re.test("Victoria María")).toBe(false);
  });

  it("no busca con menos de 2 caracteres útiles ni deja pasar caracteres especiales", () => {
    expect(patronDeBusqueda("a")).toBeNull();
    expect(patronDeBusqueda("  ,. ")).toBeNull();
    const p = patronDeBusqueda('ana" (,) .*');
    expect(p).not.toMatch(/["(),*]/);
  });

  it("el trozo marca la coincidencia", () => {
    const t = trozoConCoincidencia("Caso para Jay: XV de María Victoria pide un ejemplo", patronDeBusqueda("maria victoria"));
    expect(t.coincide).toBe("María Victoria");
    expect(t.antes).toContain("XV de ");
  });
});
