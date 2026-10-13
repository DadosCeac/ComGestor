// Exemplo de uso das regras de acesso: listar o quadro e criar card (modal "Novo Card").
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  exigir,
  podeEditarCard,
  podeVerCard,
  usuarioAtual,
  type Sessao,
} from "./lib/acesso";


async function validarDadosAdicionais(
  ctx: MutationCtx,
  sessao: Sessao,
  anterior: Record<string, unknown>,
  proximo: Record<string, unknown>,
) {
  const serializar = (valor: unknown) => JSON.stringify(valor ?? []);

  if (serializar(anterior.comments) !== serializar(proximo.comments)) {
    await exigir(ctx, sessao, "COMENTARIO_CRIAR");
  }
  if (serializar(anterior.attachments) !== serializar(proximo.attachments)) {
    await exigir(ctx, sessao, "ANEXO_GERENCIAR");
  }
  if (serializar(anterior.tags) !== serializar(proximo.tags)) {
    await exigir(ctx, sessao, "CARD_EDITAR");
  }
  const visibilidadeAnterior = anterior.visibility ?? "area";
  const visibilidadeNova = proximo.visibility ?? "area";
  if (visibilidadeAnterior !== visibilidadeNova &&
      (visibilidadeAnterior === "selected" || visibilidadeNova === "selected")) {
    await exigir(ctx, sessao, "COMPARTILHAMENTO_GERENCIAR");
  }
  if ((anterior.selectedUsers || proximo.selectedUsers) &&
      serializar(anterior.selectedUsers) !== serializar(proximo.selectedUsers)) {
    await exigir(ctx, sessao, "COMPARTILHAMENTO_GERENCIAR");
  }
  const compartilhamentosAnteriores = anterior.sharedWith && anterior.sharedWith !== "Equipe";
  const compartilhamentosNovos = proximo.sharedWith && proximo.sharedWith !== "Equipe";
  if ((compartilhamentosAnteriores || compartilhamentosNovos) &&
      serializar(anterior.sharedWith) !== serializar(proximo.sharedWith)) {
    await exigir(ctx, sessao, "COMPARTILHAMENTO_GERENCIAR");
  }

  const acoesAnteriores = Array.isArray(anterior.actions) ? anterior.actions : [];
  const acoesNovas = Array.isArray(proximo.actions) ? proximo.actions : [];
  if (serializar(acoesAnteriores) === serializar(acoesNovas)) return;

  const idsAnteriores = new Set(acoesAnteriores.map((acao) => String(acao.id)));
  const idsNovos = new Set(acoesNovas.map((acao) => String(acao.id)));
  if (acoesNovas.some((acao) => !idsAnteriores.has(String(acao.id)))) {
    await exigir(ctx, sessao, "ACAO_CRIAR");
  }
  if (acoesAnteriores.some((acao) => !idsNovos.has(String(acao.id)))) {
    await exigir(ctx, sessao, "ACAO_EDITAR");
  }
  const anterioresPorId = new Map(acoesAnteriores.map((acao) => [String(acao.id), acao]));
  for (const acao of acoesNovas) {
    const anteriorAcao = anterioresPorId.get(String(acao.id));
    if (!anteriorAcao) continue;
    if (anteriorAcao.completed !== acao.completed) {
      await exigir(ctx, sessao, "ACAO_EXECUTAR");
    }
    const { completed: _anteriorConcluida, ...dadosAnteriores } = anteriorAcao;
    const { completed: _novaConcluida, ...dadosNovos } = acao;
    if (serializar(dadosAnteriores) !== serializar(dadosNovos)) {
      await exigir(ctx, sessao, "ACAO_EDITAR");
    }
  }
}

async function substituirCompartilhamentosComUsuarios(
  ctx: MutationCtx,
  sessao: Sessao,
  cardId: Doc<"cards">["_id"],
  emails: string[],
) {
  const normalizados = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (!normalizados.length) throw new Error("Selecione ao menos uma pessoa para o card reservado.");
  await exigir(ctx, sessao, "COMPARTILHAMENTO_GERENCIAR");
  const destinatarios = await Promise.all(normalizados.map((email) =>
    ctx.db.query("usuarios").withIndex("by_email", (q) => q.eq("email", email)).unique()
  ));
  if (destinatarios.some((usuario) =>
    !usuario || !usuario.ativo || usuario.organizacao_id !== sessao.usuario.organizacao_id
  )) {
    throw new Error("Todos os destinatários devem estar ativos na organização.");
  }

  const compartilhamentos = await ctx.db
    .query("compartilhamentos")
    .withIndex("by_card", (q) => q.eq("card_id", cardId))
    .collect();
  for (const compartilhamento of compartilhamentos) {
    if (compartilhamento.tipo_destino === "USUARIO") {
      await ctx.db.delete(compartilhamento._id);
    }
  }
  for (const destinatario of destinatarios) {
    if (!destinatario) continue;
    await ctx.db.insert("compartilhamentos", {
      card_id: cardId,
      tipo_destino: "USUARIO",
      usuario_id: destinatario._id,
      nivel_acesso: "LEITURA",
      criado_por_id: sessao.usuario._id,
      criado_em: Date.now(),
    });
  }
}

/** Cards de um quadro (coluna a coluna), já filtrados por visibilidade. */
export const listarPorQuadro = query({
  args: { quadro_id: v.id("quadros") },
  handler: async (ctx, { quadro_id }) => {
    const s = await usuarioAtual(ctx);
    const quadro = await ctx.db.get(quadro_id);
    if (!quadro || !quadro.ativo || quadro.organizacao_id !== s.usuario.organizacao_id) {
      throw new Error("Quadro indisponível para esta organização.");
    }
    const proprios = await ctx.db
      .query("cards")
      .withIndex("by_quadro_status_ordem", (q) => q.eq("quadro_id", quadro_id))
      .collect();
    // cards de outros quadros compartilhados com este quadro (sem cópia)
    const comps = await ctx.db.query("compartilhamentos").withIndex("by_quadro", (q) => q.eq("quadro_id", quadro_id)).collect();
    const sharesWithUser = await ctx.db
      .query("compartilhamentos")
      .withIndex("by_usuario", (q) => q.eq("usuario_id", s.usuario._id))
      .collect();
    const extras = (await Promise.all(
      [...comps, ...sharesWithUser].map((c) => ctx.db.get(c.card_id))
    )).filter((c): c is Doc<"cards"> => !!c);

    const unicos = new Map([...proprios, ...extras].map((c) => [c._id, c]));
    const visiveis: Doc<"cards">[] = [];
    for (const card of unicos.values()) if (await podeVerCard(ctx, s, card)) visiveis.push(card);
    return Promise.all(visiveis
      .sort((a, b) => a.ordem - b.ordem)
      .map(async (card) => ({
        ...card,
        quadro_nome: (await ctx.db.get(card.quadro_id))?.nome ?? "",
      })));
  },
});

export const criar = mutation({
  args: {
    titulo: v.string(),
    descricao: v.optional(v.string()),
    quadro_id: v.id("quadros"),
    subarea_id: v.optional(v.id("subareas")),
    urgente: v.boolean(),
    visibilidade: v.union(v.literal("EQUIPE_INTEIRA"), v.literal("PESSOAS_ESPECIFICAS")),
    suspender_indeterminado: v.boolean(),
    compartilhar_com: v.optional(v.array(v.id("usuarios"))),
  },
  handler: async (ctx, a) => {
    const s = await usuarioAtual(ctx);
    const escopo = await exigir(ctx, s, "CARD_CRIAR");
    const quadro = await ctx.db.get(a.quadro_id);
    if (!quadro || !quadro.ativo || quadro.organizacao_id !== s.usuario.organizacao_id) {
      throw new Error("Quadro indisponível para esta organização.");
    }
    if (escopo !== "TODOS" && a.quadro_id !== s.quadro_id) throw new Error("Você só pode criar cards no seu quadro.");
    const titulo = a.titulo.trim();
    if (!titulo) throw new Error("O título do card é obrigatório.");
    if (a.subarea_id) {
      const sub = await ctx.db.get(a.subarea_id);
      if (!sub || sub.quadro_id !== a.quadro_id) throw new Error("Subárea não pertence ao quadro.");
    }
    const destinatarios = a.visibilidade === "PESSOAS_ESPECIFICAS"
      ? [...new Set(a.compartilhar_com ?? [])]
      : [];
    if (destinatarios.length) {
      await exigir(ctx, s, "COMPARTILHAMENTO_GERENCIAR");
      const usuariosDestino = await Promise.all(destinatarios.map((id) => ctx.db.get(id)));
      if (usuariosDestino.some((usuario) =>
        !usuario || !usuario.ativo || usuario.organizacao_id !== s.usuario.organizacao_id
      )) {
        throw new Error("Todos os destinatários devem estar ativos na organização.");
      }
    }
    const codigo = a.suspender_indeterminado ? "SUSPENSO" : "A_FAZER";
    const status = await ctx.db.query("status").withIndex("by_codigo", (q) => q.eq("codigo", codigo)).unique();
    if (!status) throw new Error("Status não cadastrado.");

    const ultimo = await ctx.db
      .query("cards")
      .withIndex("by_quadro_status_ordem", (q) => q.eq("quadro_id", a.quadro_id).eq("status_id", status._id))
      .order("desc").first();
    const agora = Date.now();
    const card_id = await ctx.db.insert("cards", {
      organizacao_id: s.usuario.organizacao_id,
      quadro_id: a.quadro_id,
      origin_quadro_id: a.quadro_id,
      subarea_id: a.subarea_id,
      criado_por_id: s.usuario._id,
      titulo,
      descricao: a.descricao,
      urgente: a.urgente,
      visibilidade: a.visibilidade,
      status_id: status._id,
      suspenso_indeterminado: a.suspender_indeterminado,
      suspenso_desde: a.suspender_indeterminado ? agora : undefined,
      ordem: (ultimo?.ordem ?? 0) + 1,
      criado_em: agora,
      atualizado_em: agora,
    });
    if (a.visibilidade === "PESSOAS_ESPECIFICAS") {
      for (const usuario_id of destinatarios) {
        await ctx.db.insert("compartilhamentos", {
          card_id, tipo_destino: "USUARIO", usuario_id, nivel_acesso: "LEITURA",
          criado_por_id: s.usuario._id, criado_em: agora,
        });
      }
    }
    await ctx.db.insert("eventos", {
      card_id, ator_id: s.usuario._id, ator_nome: s.usuario.nome, tipo_evento: "CARD_CRIADO",
      status_novo_id: status._id, descricao: `Card criado: ${titulo}`, ocorrido_em: agora,
    });
    return card_id;
  },
});

export const persistirDoApp = mutation({
  args: {
    card_id: v.optional(v.id("cards")),
    quadro_id: v.id("quadros"),
    titulo: v.string(),
    descricao: v.optional(v.string()),
    urgente: v.boolean(),
    visibilidade: v.union(v.literal("EQUIPE_INTEIRA"), v.literal("PESSOAS_ESPECIFICAS")),
    suspenso_indeterminado: v.boolean(),
    dados_interface: v.any(),
    compartilhar_com: v.optional(v.array(v.string())),
  },
  handler: async (ctx, a) => {
    const sessao = await usuarioAtual(ctx);
    const quadro = await ctx.db.get(a.quadro_id);
    if (!quadro || !quadro.ativo || quadro.organizacao_id !== sessao.usuario.organizacao_id) {
      throw new Error("Quadro indisponível para esta organização.");
    }
    const titulo = a.titulo.trim();
    if (!titulo) throw new Error("O título do card é obrigatório.");
    const serializedData = JSON.stringify(a.dados_interface) ?? "";
    if (new TextEncoder().encode(serializedData).byteLength > 750_000) {
      throw new Error("O card excede o limite de armazenamento; reduza ou remova anexos grandes.");
    }

    if (!a.dados_interface || typeof a.dados_interface !== "object" || Array.isArray(a.dados_interface)) {
      throw new Error("Dados do card inválidos.");
    }
    const dadosInterface = a.dados_interface;
    const statusNome = typeof dadosInterface.status === "string" ? dadosInterface.status : "A Fazer";
    const status = (await ctx.db.query("status").collect()).find((item) =>
      item.ativo && item.nome.toLocaleLowerCase() === statusNome.toLocaleLowerCase()
    );
    if (!status) throw new Error("Status do card não cadastrado.");

    const agora = Date.now();
    if (a.card_id) {
      const card = await ctx.db.get(a.card_id);
      if (!card || card.organizacao_id !== sessao.usuario.organizacao_id) {
        throw new Error("Card não encontrado nesta organização.");
      }
      if (card.quadro_id !== a.quadro_id) throw new Error("A transferência de quadro exige a permissão específica.");
      if (!(await podeEditarCard(ctx, sessao, card))) throw new Error("Sem permissão para editar este card.");
      const dadosAnteriores = card.dados_interface && typeof card.dados_interface === "object"
        ? card.dados_interface
        : {};
      await validarDadosAdicionais(ctx, sessao, dadosAnteriores, dadosInterface);
      if (card.visibilidade !== a.visibilidade) {
        await exigir(ctx, sessao, "COMPARTILHAMENTO_GERENCIAR");
      }
      if (a.visibilidade === "PESSOAS_ESPECIFICAS") {
        await substituirCompartilhamentosComUsuarios(ctx, sessao, card._id, a.compartilhar_com ?? []);
      }
      const ordem = card.status_id === status._id
        ? card.ordem
        : ((await ctx.db
          .query("cards")
          .withIndex("by_quadro_status_ordem", (q) =>
            q.eq("quadro_id", card.quadro_id).eq("status_id", status._id)
          )
          .order("desc")
          .first())?.ordem ?? 0) + 1;
      await ctx.db.patch(card._id, {
        titulo,
        descricao: a.descricao,
        urgente: a.urgente,
        visibilidade: a.visibilidade,
        status_id: status._id,
        ordem,
        suspenso_indeterminado: a.suspenso_indeterminado,
        suspenso_desde: a.suspenso_indeterminado ? card.suspenso_desde ?? agora : undefined,
        dados_interface: a.dados_interface,
        atualizado_em: agora,
      });
      await ctx.db.insert("eventos", {
        card_id: card._id,
        ator_id: sessao.usuario._id,
        ator_nome: sessao.usuario.nome,
        tipo_evento: "CARD_EDITADO",
        status_anterior_id: card.status_id,
        status_novo_id: status._id,
        descricao: `Card atualizado: ${titulo}`,
        ocorrido_em: agora,
      });
      return card._id;
    }

    const escopo = await exigir(ctx, sessao, "CARD_CRIAR");
    if (escopo !== "TODOS" && a.quadro_id !== sessao.quadro_id) {
      throw new Error("Você só pode criar cards no seu quadro.");
    }
    await validarDadosAdicionais(ctx, sessao, {}, dadosInterface);
    const ultimo = await ctx.db
      .query("cards")
      .withIndex("by_quadro_status_ordem", (q) => q.eq("quadro_id", a.quadro_id).eq("status_id", status._id))
      .order("desc")
      .first();
    const cardId = await ctx.db.insert("cards", {
      organizacao_id: sessao.usuario.organizacao_id,
      quadro_id: a.quadro_id,
      origin_quadro_id: a.quadro_id,
      criado_por_id: sessao.usuario._id,
      titulo,
      descricao: a.descricao,
      urgente: a.urgente,
      visibilidade: a.visibilidade,
      status_id: status._id,
      suspenso_indeterminado: a.suspenso_indeterminado,
      suspenso_desde: a.suspenso_indeterminado ? agora : undefined,
      ordem: (ultimo?.ordem ?? 0) + 1,
      dados_interface: a.dados_interface,
      criado_em: agora,
      atualizado_em: agora,
    });
    if (a.visibilidade === "PESSOAS_ESPECIFICAS") {
      await substituirCompartilhamentosComUsuarios(
        ctx,
        sessao,
        cardId,
        a.compartilhar_com ?? []
      );
    }
    await ctx.db.insert("eventos", {
      card_id: cardId,
      ator_id: sessao.usuario._id,
      ator_nome: sessao.usuario.nome,
      tipo_evento: "CARD_CRIADO",
      status_novo_id: status._id,
      descricao: `Card criado: ${titulo}`,
      ocorrido_em: agora,
    });
    return cardId;
  },
});

export const transferir = mutation({
  args: {
    card_id: v.id("cards"),
    quadro_destino_id: v.id("quadros"),
  },
  handler: async (ctx, { card_id, quadro_destino_id }) => {
    const sessao = await usuarioAtual(ctx);
    const escopo = await exigir(ctx, sessao, "CARD_TRANSFERIR");
    const card = await ctx.db.get(card_id);
    const destino = await ctx.db.get(quadro_destino_id);
    if (!card || card.organizacao_id !== sessao.usuario.organizacao_id) {
      throw new Error("Card não encontrado nesta organização.");
    }
    if (!destino || !destino.ativo || destino.organizacao_id !== sessao.usuario.organizacao_id) {
      throw new Error("Quadro de destino indisponível.");
    }
    if (!(await podeVerCard(ctx, sessao, card))) throw new Error("Sem acesso a este card.");
    if (escopo === "PROPRIO" && card.criado_por_id !== sessao.usuario._id) {
      throw new Error("Seu perfil só pode transferir cards próprios.");
    }
    if (escopo === "QUADRO" && card.quadro_id !== sessao.quadro_id) {
      throw new Error("Seu perfil só pode transferir cards do seu quadro.");
    }
    if (card.quadro_id === destino._id) return card._id;

    const ultimo = await ctx.db
      .query("cards")
      .withIndex("by_quadro_status_ordem", (q) =>
        q.eq("quadro_id", destino._id).eq("status_id", card.status_id)
      )
      .order("desc")
      .first();
    const agora = Date.now();
    await ctx.db.patch(card._id, {
      quadro_id: destino._id,
      subarea_id: undefined,
      ordem: (ultimo?.ordem ?? 0) + 1,
      atualizado_em: agora,
    });
    await ctx.db.insert("eventos", {
      card_id: card._id,
      ator_id: sessao.usuario._id,
      ator_nome: sessao.usuario.nome,
      tipo_evento: "CARD_TRANSFERIDO",
      descricao: `Card transferido para ${destino.nome}`,
      ocorrido_em: agora,
    });
    return card._id;
  },
});

export const compartilharComQuadro = mutation({
  args: {
    card_id: v.id("cards"),
    quadro_destino_id: v.id("quadros"),
  },
  handler: async (ctx, { card_id, quadro_destino_id }) => {
    const sessao = await usuarioAtual(ctx);
    const escopo = await exigir(ctx, sessao, "COMPARTILHAMENTO_GERENCIAR");
    const [card, destino] = await Promise.all([
      ctx.db.get(card_id),
      ctx.db.get(quadro_destino_id),
    ]);
    if (!card || card.organizacao_id !== sessao.usuario.organizacao_id) {
      throw new Error("Card não encontrado nesta organização.");
    }
    if (!destino || !destino.ativo || destino.organizacao_id !== sessao.usuario.organizacao_id) {
      throw new Error("Quadro de destino indisponível.");
    }
    if (card.visibilidade !== "EQUIPE_INTEIRA") {
      throw new Error("Altere a visibilidade para equipe inteira antes de compartilhar com um quadro.");
    }
    if (!(await podeVerCard(ctx, sessao, card))) throw new Error("Sem acesso a este card.");
    if (escopo === "PROPRIO" && card.criado_por_id !== sessao.usuario._id) {
      throw new Error("Seu perfil só pode compartilhar cards próprios.");
    }
    if (escopo === "QUADRO" && card.quadro_id !== sessao.quadro_id) {
      throw new Error("Seu perfil só pode compartilhar cards do seu quadro.");
    }

    const existentes = await ctx.db
      .query("compartilhamentos")
      .withIndex("by_card", (q) => q.eq("card_id", card._id))
      .collect();
    const existente = existentes.find((item) =>
      item.tipo_destino === "QUADRO" && item.quadro_id === destino._id
    );
    const agora = Date.now();
    if (existente) {
      await ctx.db.patch(existente._id, { nivel_acesso: "LEITURA" });
    } else {
      await ctx.db.insert("compartilhamentos", {
        card_id: card._id,
        tipo_destino: "QUADRO",
        quadro_id: destino._id,
        nivel_acesso: "LEITURA",
        criado_por_id: sessao.usuario._id,
        criado_em: agora,
      });
    }
    await ctx.db.insert("eventos", {
      card_id: card._id,
      ator_id: sessao.usuario._id,
      ator_nome: sessao.usuario.nome,
      tipo_evento: "COMPARTILHADO",
      descricao: `Card compartilhado com o quadro ${destino.nome}`,
      ocorrido_em: agora,
    });
    return card._id;
  },
});
