import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { usuarioAtual } from "./lib/acesso";

export const listar = query({
  args: {},
  handler: async (ctx) => {
    const sessao = await usuarioAtual(ctx);
    const [sugestoes, respostas] = await Promise.all([
      ctx.db
        .query("sugestoes")
        .withIndex("by_organizacao", (q) => q.eq("organizacao_id", sessao.usuario.organizacao_id))
        .collect(),
      ctx.db
        .query("respostas_satisfacao")
        .withIndex("by_organizacao_usuario", (q) => q.eq("organizacao_id", sessao.usuario.organizacao_id))
        .collect(),
    ]);

    const notas = Array.from({ length: 11 }, () => 0);
    for (const resposta of respostas) notas[resposta.nota] += 1;

    const items = await Promise.all(sugestoes
      .sort((a, b) => b.criado_em - a.criado_em)
      .map(async (sugestao) => {
        const [autor, comentarios, curtidas, curtidaAtual] = await Promise.all([
          ctx.db.get(sugestao.autor_id),
          ctx.db.query("sugestao_comentarios")
            .withIndex("by_sugestao", (q) => q.eq("sugestao_id", sugestao._id))
            .collect(),
          ctx.db.query("sugestao_curtidas")
            .withIndex("by_sugestao", (q) => q.eq("sugestao_id", sugestao._id))
            .collect(),
          ctx.db.query("sugestao_curtidas")
            .withIndex("by_sugestao_usuario", (q) => q.eq("sugestao_id", sugestao._id).eq("usuario_id", sessao.usuario._id))
            .unique(),
        ]);
        const comentariosComAutor = await Promise.all(comentarios
          .sort((a, b) => a.criado_em - b.criado_em)
          .map(async (comentario) => ({
            id: comentario._id,
            texto: comentario.texto,
            criado_em: comentario.criado_em,
            autor: (await ctx.db.get(comentario.autor_id))?.nome ?? "Usuário",
          })));
        return {
          id: sugestao._id,
          texto: sugestao.texto,
          criado_em: sugestao.criado_em,
          autor: autor?.nome ?? "Usuário",
          curtidas: curtidas.length,
          curtida_atual: Boolean(curtidaAtual),
          comentarios: comentariosComAutor,
        };
      }));

    return {
      items,
      survey: {
        total: respostas.length,
        media: respostas.length
          ? respostas.reduce((total, resposta) => total + resposta.nota, 0) / respostas.length
          : null,
        notas,
        minha_nota: respostas.find((resposta) => resposta.usuario_id === sessao.usuario._id)?.nota ?? null,
      },
    };
  },
});

export const criar = mutation({
  args: { texto: v.string() },
  handler: async (ctx, { texto }) => {
    const sessao = await usuarioAtual(ctx);
    const conteudo = texto.trim();
    if (!conteudo) throw new Error("Escreva sua sugestão antes de publicar.");
    if (conteudo.length > 2000) throw new Error("A sugestão deve ter no máximo 2.000 caracteres.");
    return ctx.db.insert("sugestoes", {
      organizacao_id: sessao.usuario.organizacao_id,
      autor_id: sessao.usuario._id,
      texto: conteudo,
      criado_em: Date.now(),
    });
  },
});

export const comentar = mutation({
  args: { sugestao_id: v.id("sugestoes"), texto: v.string() },
  handler: async (ctx, { sugestao_id, texto }) => {
    const sessao = await usuarioAtual(ctx);
    const sugestao = await ctx.db.get(sugestao_id);
    if (!sugestao || sugestao.organizacao_id !== sessao.usuario.organizacao_id) {
      throw new Error("Sugestão não encontrada nesta organização.");
    }
    const conteudo = texto.trim();
    if (!conteudo) throw new Error("Escreva um comentário antes de enviar.");
    if (conteudo.length > 1000) throw new Error("O comentário deve ter no máximo 1.000 caracteres.");
    return ctx.db.insert("sugestao_comentarios", {
      sugestao_id,
      autor_id: sessao.usuario._id,
      texto: conteudo,
      criado_em: Date.now(),
    });
  },
});

export const alternarCurtida = mutation({
  args: { sugestao_id: v.id("sugestoes") },
  handler: async (ctx, { sugestao_id }) => {
    const sessao = await usuarioAtual(ctx);
    const sugestao = await ctx.db.get(sugestao_id);
    if (!sugestao || sugestao.organizacao_id !== sessao.usuario.organizacao_id) {
      throw new Error("Sugestão não encontrada nesta organização.");
    }
    const curtida = await ctx.db.query("sugestao_curtidas")
      .withIndex("by_sugestao_usuario", (q) => q.eq("sugestao_id", sugestao_id).eq("usuario_id", sessao.usuario._id))
      .unique();
    if (curtida) {
      await ctx.db.delete(curtida._id);
      return false;
    }
    await ctx.db.insert("sugestao_curtidas", {
      sugestao_id,
      usuario_id: sessao.usuario._id,
      criado_em: Date.now(),
    });
    return true;
  },
});

export const responderPesquisa = mutation({
  args: { nota: v.number() },
  handler: async (ctx, { nota }) => {
    const sessao = await usuarioAtual(ctx);
    if (!Number.isInteger(nota) || nota < 0 || nota > 10) {
      throw new Error("A nota deve ser um número inteiro entre 0 e 10.");
    }
    const resposta = await ctx.db.query("respostas_satisfacao")
      .withIndex("by_organizacao_usuario", (q) =>
        q.eq("organizacao_id", sessao.usuario.organizacao_id).eq("usuario_id", sessao.usuario._id)
      )
      .unique();
    const dados = {
      organizacao_id: sessao.usuario.organizacao_id,
      usuario_id: sessao.usuario._id,
      nota,
      atualizado_em: Date.now(),
    };
    if (resposta) await ctx.db.patch(resposta._id, dados);
    else await ctx.db.insert("respostas_satisfacao", dados);
    return nota;
  },
});
