/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
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
  const usuarioEllen = await t.run((ctx) =>
    ctx.db.query("usuarios").withIndex("by_email", (q) => q.eq("email", "ellen.fgomes@hc.fm.usp.br")).unique()
  );
  expect(usuarioEllen).toBeDefined();
  await t.run((ctx) => ctx.db.patch(usuarioEllen!._id, { ativo: false }));
  const resultadoSeed = await t.mutation(internal.seed.carregar, {});
  expect(resultadoSeed).toContain("usuários adicionados: 1");
  expect(resultadoSeed).toContain("status atualizados: 1");
  expect((await t.run((ctx) => ctx.db.get(usuarioEllen!._id)))?.ativo).toBe(true);

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
  expect(sessaoGestor.permissoes.EVENTO_VISUALIZAR).toBe("QUADRO");
  expect(sessaoGestor.permissoes.USUARIO_GERENCIAR).toBeUndefined();
  expect(sessaoGestor.quadros.map((quadro: { nome: string }) => quadro.nome)).toEqual(["Assistencial"]);
  expect(sessaoGestor.usuarios.some((usuario: { email: string }) => usuario.email === "thais.v@hc.fm.usp.br")).toBe(true);

  const sessaoUsuario = await (await logar(t, "thais.v@hc.fm.usp.br")).query(api.usuarios.minhaSessao, {});
  expect(sessaoUsuario.perfil.codigo).toBe("USUARIO");
  expect(sessaoUsuario.permissoes.EVENTO_VISUALIZAR).toBe("PROPRIO");

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

test("somente admin apaga todos os cards e dados vinculados", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.seed.carregar, {});

  const { cardId, tagId, usuarioId, organizacaoId } = await t.run(async (ctx) => {
    const usuario = await ctx.db.query("usuarios")
      .withIndex("by_email", (q) => q.eq("email", "thais.v@hc.fm.usp.br"))
      .unique();
    const status = await ctx.db.query("status")
      .withIndex("by_codigo", (q) => q.eq("codigo", "A_FAZER"))
      .unique();
    expect(usuario).toBeDefined();
    expect(status).toBeDefined();

    const agora = Date.now();
    const tagId = await ctx.db.insert("tags", {
      organizacao_id: usuario!.organizacao_id,
      nome: "Tag para limpeza",
      criado_em: agora,
    });
    const cardId = await ctx.db.insert("cards", {
      organizacao_id: usuario!.organizacao_id,
      quadro_id: (await ctx.db.get(usuario!.area_id))!.quadro_id,
      origin_quadro_id: (await ctx.db.get(usuario!.area_id))!.quadro_id,
      criado_por_id: usuario!._id,
      titulo: "Card para limpeza",
      urgente: false,
      visibilidade: "EQUIPE_INTEIRA",
      status_id: status!._id,
      suspenso_indeterminado: false,
      ordem: 1,
      criado_em: agora,
      atualizado_em: agora,
    });
    const acaoId = await ctx.db.insert("acoes", {
      card_id: cardId,
      criado_por_id: usuario!._id,
      titulo: "Ação para limpeza",
      status_id: status!._id,
      ordem: 1,
      criado_em: agora,
      atualizado_em: agora,
    });
    const indicadorId = await ctx.db.insert("indicadores", {
      card_id: cardId,
      nome: "Indicador para limpeza",
      criado_em: agora,
      atualizado_em: agora,
    });
    const comentarioId = await ctx.db.insert("comentarios", {
      card_id: cardId,
      autor_id: usuario!._id,
      texto: "Comentário para limpeza",
      criado_em: agora,
    });
    await ctx.db.insert("minhas_acoes", {
      usuario_id: usuario!._id,
      acao_id: acaoId,
      papel: "RESPONSAVEL",
      visualizada: false,
      arquivada: false,
    });
    await ctx.db.insert("comentarios", {
      card_id: cardId,
      acao_id: acaoId,
      autor_id: usuario!._id,
      texto: "Comentário da ação",
      criado_em: agora,
    });
    await ctx.db.insert("anexos", {
      card_id: cardId,
      comentario_id: comentarioId,
      tipo: "LINK",
      nome: "Anexo para limpeza",
      url_externa: "https://example.com",
      enviado_por_id: usuario!._id,
      criado_em: agora,
    });
    await ctx.db.insert("card_tags", { card_id: cardId, tag_id: tagId });
    await ctx.db.insert("compartilhamentos", {
      card_id: cardId,
      tipo_destino: "USUARIO",
      usuario_id: usuario!._id,
      nivel_acesso: "LEITURA",
      criado_por_id: usuario!._id,
      criado_em: agora,
    });
    await ctx.db.insert("medicoes", {
      indicador_id: indicadorId,
      valor: 1,
      medido_em: agora,
      registrado_por_id: usuario!._id,
    });
    await ctx.db.insert("eventos", {
      card_id: cardId,
      tipo_evento: "CARD_CRIADO",
      descricao: "Card para limpeza",
      ocorrido_em: agora,
    });
    return { cardId, tagId, usuarioId: usuario!._id, organizacaoId: usuario!.organizacao_id };
  });

  await expect(
    (await logar(t, "thais.v@hc.fm.usp.br")).mutation(api.cards.apagarTodos, {})
  ).rejects.toThrow(/somente administradores/i);

  const admin = await logar(t, "ellen.fgomes@hc.fm.usp.br");
  expect((await admin.query(api.usuarios.minhaSessao, {})).migracao_cards_locais_permitida).toBe(true);
  vi.useFakeTimers();
  try {
    expect(await admin.mutation(api.cards.apagarTodos, {})).toEqual({ limpezaIniciada: true });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  } finally {
    vi.useRealTimers();
  }

  await t.run(async (ctx) => {
    expect(await ctx.db.get(cardId)).toBeNull();
    expect(await ctx.db.query("cards").collect()).toHaveLength(0);
    expect(await ctx.db.query("acoes").collect()).toHaveLength(0);
    expect(await ctx.db.query("minhas_acoes").collect()).toHaveLength(0);
    expect(await ctx.db.query("comentarios").collect()).toHaveLength(0);
    expect(await ctx.db.query("anexos").collect()).toHaveLength(0);
    expect(await ctx.db.query("card_tags").collect()).toHaveLength(0);
    expect(await ctx.db.get(tagId)).toBeDefined();
    expect(await ctx.db.query("compartilhamentos").collect()).toHaveLength(0);
    expect(await ctx.db.query("indicadores").collect()).toHaveLength(0);
    expect(await ctx.db.query("medicoes").collect()).toHaveLength(0);
    expect(await ctx.db.query("eventos").collect()).toHaveLength(0);
    expect(await ctx.db.get(usuarioId)).toBeDefined();
    expect(await ctx.db.get(organizacaoId)).toMatchObject({
      bloquear_migracao_cards_locais: true,
    });
  });
  expect((await admin.query(api.usuarios.minhaSessao, {})).migracao_cards_locais_permitida).toBe(false);
});
