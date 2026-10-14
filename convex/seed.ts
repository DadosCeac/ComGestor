// Carga inicial. Rodar UMA vez:  npx convex run seed:carregar
// Troca os códigos da planilha (USR_001, AREA_001...) pelos _id gerados pelo Convex.
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { seedData as d } from "./seedData";

export const carregar = internalMutation({
  args: {},
  handler: async (ctx) => {
    const organizacoesExistentes = await ctx.db.query("organizacoes").collect();
    if (organizacoesExistentes.length > 0) {
      const quadrosPorCodigo = new Map<string, (typeof d.quadros)[number]>();
      for (const item of d.quadros) quadrosPorCodigo.set(item.codigo, item);

      let usuariosAdicionados = 0;
      let statusAtualizados = 0;
      for (const u of d.usuarios) {
        const existente = await ctx.db
          .query("usuarios")
          .withIndex("by_email", (q) => q.eq("email", u.email.toLowerCase()))
          .unique();
        if (existente) {
          if (existente.ativo !== u.ativo) {
            await ctx.db.patch(existente._id, { ativo: u.ativo });
            statusAtualizados++;
          }
          continue;
        }

        const organizacaoSeed = d.organizacoes.find((item) => item.codigo === u.organizacao);
        const organizacao = organizacoesExistentes.find((item) => item.nome === organizacaoSeed?.nome);
        const perfilSeed = d.perfis.find((item) => item.codigo === u.perfil);
        const perfil = perfilSeed
          ? await ctx.db.query("perfis_acesso").withIndex("by_codigo", (q) => q.eq("codigo", perfilSeed.cod)).unique()
          : null;
        const areaSeed = d.areas.find((item) => item.codigo === u.area);
        const quadroSeed = areaSeed ? quadrosPorCodigo.get(areaSeed.quadro) : undefined;
        const quadro = organizacao && quadroSeed
          ? (await ctx.db.query("quadros")
              .withIndex("by_organizacao", (q) => q.eq("organizacao_id", organizacao._id))
              .collect()).find((item) => item.nome === quadroSeed.nome)
          : undefined;
        const area = quadro && areaSeed
          ? (await ctx.db.query("areas").withIndex("by_quadro", (q) => q.eq("quadro_id", quadro._id)).collect())
              .find((item) => item.macroarea === areaSeed.macroarea && item.setor === areaSeed.setor)
          : undefined;

        if (!organizacao || !perfil || !area) {
          throw new Error(`Não foi possível sincronizar o cadastro de ${u.email}: organização, perfil ou área ausente.`);
        }
        await ctx.db.insert("usuarios", {
          organizacao_id: organizacao._id,
          email: u.email.toLowerCase(),
          nome: u.nome,
          area_id: area._id,
          perfil_id: perfil._id,
          ativo: u.ativo,
        });
        usuariosAdicionados++;
      }
      return `Já carregado — usuários adicionados: ${usuariosAdicionados}, status atualizados: ${statusAtualizados}.`;
    }

    const org = new Map<string, Id<"organizacoes">>();
    for (const o of d.organizacoes)
      org.set(o.codigo, await ctx.db.insert("organizacoes", {
        nome: o.nome, descricao: o.descricao ?? undefined, ativa: o.ativa, criado_em: o.criado_em, atualizado_em: o.atualizado_em }));

    const quadro = new Map<string, Id<"quadros">>();
    for (const q of d.quadros)
      quadro.set(q.codigo, await ctx.db.insert("quadros", {
        organizacao_id: org.get(q.organizacao)!, nome: q.nome, cor: q.cor, ordem: q.ordem, ativo: q.ativo }));

    const area = new Map<string, Id<"areas">>();
    for (const a of d.areas)
      area.set(a.codigo, await ctx.db.insert("areas", {
        organizacao_id: org.get(a.organizacao)!, quadro_id: quadro.get(a.quadro)!, macroarea: a.macroarea,
        setor: a.setor, descricao: a.descricao ?? undefined, ativa: a.ativa }));

    const perfil = new Map<string, Id<"perfis_acesso">>();
    for (const p of d.perfis)
      perfil.set(p.codigo, await ctx.db.insert("perfis_acesso", { codigo: p.cod, nome: p.nome, descricao: p.descricao ?? undefined }));

    const permissao = new Map<string, Id<"permissoes">>();
    for (const p of d.permissoes)
      permissao.set(p.codigo, await ctx.db.insert("permissoes", { codigo: p.cod, recurso: p.recurso, acao: p.acao }));

    for (const pp of d.perfilPermissoes)
      await ctx.db.insert("perfil_permissoes", {
        perfil_id: perfil.get(pp.perfil)!, permissao_id: permissao.get(pp.permissao)!, escopo: pp.escopo });

    for (const s of d.status)
      await ctx.db.insert("status", {
        codigo: s.cod, nome: s.nome, descricao: s.descricao ?? undefined, ordem: s.ordem, final: s.final, ativo: s.ativo });

    for (const u of d.usuarios)
      await ctx.db.insert("usuarios", {
        organizacao_id: org.get(u.organizacao)!, email: u.email, nome: u.nome,
        area_id: area.get(u.area)!, perfil_id: perfil.get(u.perfil)!, ativo: u.ativo });

    return `Carregado: ${d.quadros.length} quadros, ${d.areas.length} áreas, ${d.usuarios.length} usuários.`;
  },
});
