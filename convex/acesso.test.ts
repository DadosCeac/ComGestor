/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { escopoDe, usuarioAtual } from "./lib/acesso";
const modules = import.meta.glob("./**/*.ts");

// Simula o token do Clerk (com e-mail) — sem tabela de usuários de autenticação.
async function logar(t: ReturnType<typeof convexTest>, email: string) {
  return t.withIdentity({ subject: `user_${email}`, email, email_verified: true });
}

test("seed + perfis por e-mail + escopos + visibilidade", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.carregar, {});
  expect(await t.mutation(internal.seed.carregar, {})).toContain("Já carregado");
  const usuarioThais = await t.run((ctx) =>
    ctx.db.query("usuarios").withIndex("by_email", (q) => q.eq("email", "thais.v@hc.fm.usp.br")).unique()
  );
  expect(usuarioThais).toBeDefined();
  await t.run((ctx) => ctx.db.delete(usuarioThais!._id));
  expect(await t.mutation(internal.seed.carregar, {})).toContain("usuários adicionados: 1");

  const perfis: Record<string, string> = {
    "ellen.fgomes@hc.fm.usp.br": "ADMIN", "fernando.maia@hc.fm.usp.br": "GESTOR", "thais.v@hc.fm.usp.br": "USUARIO",
  };
  for (const [email, esperado] of Object.entries(perfis)) {
    const u = await logar(t, email);
    const s = await u.run((ctx) => usuarioAtual(ctx));
    expect(s.perfil.codigo).toBe(esperado);
  }

  const sessaoGestor = await (await logar(t, "fernando.maia@hc.fm.usp.br")).query(api.usuarios.minhaSessao, {});
  expect(sessaoGestor.perfil.codigo).toBe("GESTOR");
  expect(sessaoGestor.permissoes.CARD_CRIAR).toBe("QUADRO");
  expect(sessaoGestor.permissoes.USUARIO_GERENCIAR).toBeUndefined();
  expect(sessaoGestor.quadros.map((quadro: { nome: string }) => quadro.nome)).toEqual(["Assistencial"]);

  const ger = await (await logar(t, "fernando.maia@hc.fm.usp.br")).run(async (ctx) => {
    const s = await usuarioAtual(ctx);
    return [await escopoDe(ctx, s.perfil._id, "CARD_EDITAR"), await escopoDe(ctx, s.perfil._id, "USUARIO_GERENCIAR")];
  });
  expect(ger).toEqual(["QUADRO", null]);

  // e-mail fora da lista não entra
  const intruso = await logar(t, "estranho@gmail.com");
  await expect(intruso.run((ctx) => usuarioAtual(ctx))).rejects.toThrow(/sem acesso/);
  await expect(intruso.query(api.usuarios.minhaSessao, {})).rejects.toThrow(/sem acesso/);
  const naoVerificado = t.withIdentity({
    subject: "conta-nao-verificada",
    email: "ellen.fgomes@hc.fm.usp.br",
    email_verified: false,
  });
  await expect(naoVerificado.query(api.usuarios.minhaSessao, {})).rejects.toThrow(/não verificado/);

  // visibilidade
  const qual = await t.run(async (ctx) => (await ctx.db.query("quadros").collect()).find((q) => q.nome === "Qualidade")!._id);
  const thais = await logar(t, "thais.v@hc.fm.usp.br");
  const base = { quadro_id: qual, urgente: false, suspender_indeterminado: false };
  await thais.mutation(api.cards.criar, { ...base, titulo: "Aberto", visibilidade: "EQUIPE_INTEIRA" });
  await thais.mutation(api.cards.criar, { ...base, titulo: "Reservado", visibilidade: "PESSOAS_ESPECIFICAS" });
  const cardDoApp = await thais.mutation(api.cards.persistirDoApp, {
    quadro_id: qual,
    titulo: "Card salvo pelo app",
    descricao: "Persistido no Convex",
    urgente: false,
    visibilidade: "EQUIPE_INTEIRA",
    suspenso_indeterminado: false,
    dados_interface: { status: "A Fazer", title: "Card salvo pelo app" },
  });
  await thais.mutation(api.cards.persistirDoApp, {
    card_id: cardDoApp,
    quadro_id: qual,
    titulo: "Card atualizado pelo app",
    descricao: "Alterado no Convex",
    urgente: true,
    visibilidade: "EQUIPE_INTEIRA",
    suspenso_indeterminado: false,
    dados_interface: { status: "Em Andamento", title: "Card atualizado pelo app" },
  });
  await expect(
    (await logar(t, "pamela.santos@hc.fm.usp.br")).mutation(api.cards.persistirDoApp, {
      card_id: cardDoApp,
      quadro_id: qual,
      titulo: "Edição não permitida",
      urgente: false,
      visibilidade: "EQUIPE_INTEIRA",
      suspenso_indeterminado: false,
      dados_interface: { status: "A Fazer" },
    })
  ).rejects.toThrow(/sem permissão/i);
  const cardPrivado = await thais.mutation(api.cards.persistirDoApp, {
    quadro_id: qual,
    titulo: "Reservado para Pamela",
    urgente: false,
    visibilidade: "PESSOAS_ESPECIFICAS",
    suspenso_indeterminado: false,
    dados_interface: { status: "A Fazer", title: "Reservado para Pamela", visibility: "selected" },
    compartilhar_com: ["pamela.santos@hc.fm.usp.br"],
  });
  const cardsPamela = await (await logar(t, "pamela.santos@hc.fm.usp.br")).query(api.cards.listarPorQuadro, {
    quadro_id: qual,
  });
  expect(cardsPamela.some((card: { _id: string }) => card._id === cardPrivado)).toBe(true);
  const cardTransferido = await thais.mutation(api.cards.persistirDoApp, {
    quadro_id: qual,
    titulo: "Card a transferir",
    urgente: false,
    visibilidade: "EQUIPE_INTEIRA",
    suspenso_indeterminado: false,
    dados_interface: { status: "A Fazer", title: "Card a transferir" },
  });
  const adm = await t.run(async (ctx) =>
    (await ctx.db.query("quadros").collect()).find((q) => q.nome === "Administrativo")!._id
  );
  await expect(
    (await logar(t, "pamela.santos@hc.fm.usp.br")).mutation(api.cards.transferir, {
      card_id: cardTransferido,
      quadro_destino_id: adm,
    })
  ).rejects.toThrow(/transferir cards próprios/i);
  await thais.mutation(api.cards.transferir, { card_id: cardTransferido, quadro_destino_id: adm });

  const organizacaoEstranha = await t.run((ctx) => ctx.db.insert("organizacoes", {
    nome: "Outra organização", ativa: true, criado_em: Date.now(), atualizado_em: Date.now(),
  }));
  const quadroEstranho = await t.run((ctx) => ctx.db.insert("quadros", {
    organizacao_id: organizacaoEstranha, nome: "Privado", cor: "000000", ordem: 1, ativo: true,
  }));
  await expect(
    (await logar(t, "ellen.fgomes@hc.fm.usp.br")).query(api.cards.listarPorQuadro, { quadro_id: quadroEstranho })
  ).rejects.toThrow(/organização/i);

  const titulos = async (email: string) =>
    ((await (await logar(t, email)).query(api.cards.listarPorQuadro, { quadro_id: qual })) as { titulo: string }[]).map((c) => c.titulo).sort();

 expect(await titulos("thais.v@hc.fm.usp.br")).toEqual([
  "Aberto",
  "Card atualizado pelo app",
  "Reservado",
  "Reservado para Pamela",
]); // criadora

expect(await titulos("pamela.santos@hc.fm.usp.br")).toEqual([
  "Aberto",
  "Card atualizado pelo app",
  "Reservado para Pamela",
]); // mesmo quadro e card compartilhado diretamente

expect(await titulos("ricardo.borges@hc.fm.usp.br")).toEqual([]); // outro quadro

expect(await titulos("ellen.fgomes@hc.fm.usp.br")).toEqual([
  "Aberto",
  "Card atualizado pelo app",
  "Reservado",
  "Reservado para Pamela",
]); // admin
  

  // usuário comum não cria card em quadro alheio
  await expect(thais.mutation(api.cards.criar, { ...base, quadro_id: adm, titulo: "X", visibilidade: "EQUIPE_INTEIRA" })).rejects.toThrow(/seu quadro/);
});
