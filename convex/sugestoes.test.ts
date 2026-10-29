/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");

function logar(t: ReturnType<typeof convexTest>, email: string) {
  return t.withIdentity({ subject: `user_${email}`, email, email_verified: true });
}

test("sugestões, comentários, curtidas e pesquisa ficam disponíveis na organização", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.carregar, {});

  const thais = logar(t, "thais.v@hc.fm.usp.br");
  const sugestaoId = await thais.mutation(api.sugestoes.criar, { texto: "Melhorar a comunicação entre equipes" });
  await thais.mutation(api.sugestoes.comentar, { sugestao_id: sugestaoId, texto: "Podemos começar com uma reunião mensal." });
  expect(await thais.mutation(api.sugestoes.alternarCurtida, { sugestao_id: sugestaoId })).toBe(true);

  await thais.mutation(api.sugestoes.responderPesquisa, { nota: 9 });
  const pamela = logar(t, "pamela.santos@hc.fm.usp.br");
  await pamela.mutation(api.sugestoes.responderPesquisa, { nota: 7 });
  await thais.mutation(api.sugestoes.responderPesquisa, { nota: 10 });
  await expect(thais.mutation(api.sugestoes.responderPesquisa, { nota: 11 })).rejects.toThrow(/entre 0 e 10/);

  const resultado = await pamela.query(api.sugestoes.listar, {});
  expect(resultado.items).toHaveLength(1);
  expect(resultado.items[0].texto).toBe("Melhorar a comunicação entre equipes");
  expect(resultado.items[0].curtidas).toBe(1);
  expect(resultado.items[0].comentarios[0].texto).toBe("Podemos começar com uma reunião mensal.");
  expect(resultado.survey.total).toBe(2);
  expect(resultado.survey.media).toBe(8.5);
  expect(resultado.survey.notas[7]).toBe(1);
  expect(resultado.survey.notas[10]).toBe(1);
  expect(resultado.survey.minha_nota).toBe(7);
});

test("sugestões de outra organização não podem ser acessadas", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.carregar, {});
  const thais = logar(t, "thais.v@hc.fm.usp.br");
  const sugestaoId = await thais.mutation(api.sugestoes.criar, { texto: "Ideia da organização original" });

  const organizacao = await t.run((ctx) => ctx.db.insert("organizacoes", {
    nome: "Outra organização",
    ativa: true,
    criado_em: Date.now(),
    atualizado_em: Date.now(),
  }));
  const perfil = await t.run((ctx) => ctx.db.query("perfis_acesso").withIndex("by_codigo", q => q.eq("codigo", "USUARIO")).unique());
  const quadro = await t.run((ctx) => ctx.db.insert("quadros", {
    organizacao_id: organizacao,
    nome: "Outro quadro",
    cor: "000000",
    ordem: 1,
    ativo: true,
  }));
  const area = await t.run((ctx) => ctx.db.insert("areas", {
    organizacao_id: organizacao,
    quadro_id: quadro,
    macroarea: "Geral",
    setor: "Geral",
    ativa: true,
  }));
  await t.run((ctx) => ctx.db.insert("usuarios", {
    organizacao_id: organizacao,
    email: "outra.pessoa@example.com",
    nome: "Outra Pessoa",
    area_id: area,
    perfil_id: perfil!._id,
    ativo: true,
  }));
  const outraPessoa = logar(t, "outra.pessoa@example.com");
  await expect(outraPessoa.mutation(api.sugestoes.comentar, {
    sugestao_id: sugestaoId,
    texto: "Comentário de outra organização",
  })).rejects.toThrow(/organização/);
  expect((await outraPessoa.query(api.sugestoes.listar, {})).items).toHaveLength(0);
});
