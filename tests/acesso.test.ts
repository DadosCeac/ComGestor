/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { escopoDe, podeVerCard, usuarioAtual } from "./lib/acesso";
const modules = import.meta.glob("./**/*.ts");

async function logar(t: ReturnType<typeof convexTest>, email: string) {
  return t.withIdentity({ subject: `user_${email}`, email, email_verified: true });
}

test("seed + perfis por e-mail + escopos + visibilidade", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.carregar, {});
  expect(await t.mutation(internal.seed.carregar, {})).toContain("Já carregado");

  const perfis: Record<string, string> = {
    "ellen.fgomes@hc.fm.usp.br": "ADMIN", "fernando.maia@hc.fm.usp.br": "GESTOR", "thais.v@hc.fm.usp.br": "USUARIO",
  };
  for (const [email, esperado] of Object.entries(perfis)) {
    const u = await logar(t, email);
    const s = await u.run((ctx) => usuarioAtual(ctx));
    expect(s.perfil.codigo).toBe(esperado);
  }

  const ger = await (await logar(t, "fernando.maia@hc.fm.usp.br")).run(async (ctx) => {
    const s = await usuarioAtual(ctx);
    return [await escopoDe(ctx, s.perfil._id, "CARD_EDITAR"), await escopoDe(ctx, s.perfil._id, "USUARIO_GERENCIAR")];
  });
  expect(ger).toEqual(["QUADRO", null]);

  // e-mail fora da lista não entra
  const intruso = await logar(t, "estranho@gmail.com");
  await expect(intruso.run((ctx) => usuarioAtual(ctx))).rejects.toThrow(/sem acesso/);

  // visibilidade
  const qual = await t.run(async (ctx) => (await ctx.db.query("quadros").collect()).find((q) => q.nome === "Qualidade")!._id);
  const thais = await logar(t, "thais.v@hc.fm.usp.br");
  const base = { quadro_id: qual, urgente: false, suspender_indeterminado: false };
  await thais.mutation(api.cards.criar, { ...base, titulo: "Aberto", visibilidade: "EQUIPE_INTEIRA" });
  await thais.mutation(api.cards.criar, { ...base, titulo: "Reservado", visibilidade: "PESSOAS_ESPECIFICAS" });
  const titulos = async (email: string) =>
    ((await (await logar(t, email)).query(api.cards.listarPorQuadro, { quadro_id: qual })) as { titulo: string }[]).map((c) => c.titulo).sort();

  expect(await titulos("thais.v@hc.fm.usp.br")).toEqual(["Aberto", "Reservado"]); // criadora
  expect(await titulos("pamela.santos@hc.fm.usp.br")).toEqual(["Aberto"]);         // mesmo quadro, sem menção
  expect(await titulos("ricardo.borges@hc.fm.usp.br")).toEqual([]);              // outro quadro
  expect(await titulos("ellen.fgomes@hc.fm.usp.br")).toEqual(["Aberto", "Reservado"]); // admin

  // usuário comum não cria card em quadro alheio
  const adm = await t.run(async (ctx) => (await ctx.db.query("quadros").collect()).find((q) => q.nome === "Administrativo")!._id);
  await expect(thais.mutation(api.cards.criar, { ...base, quadro_id: adm, titulo: "X", visibilidade: "EQUIPE_INTEIRA" })).rejects.toThrow(/seu quadro/);
});
