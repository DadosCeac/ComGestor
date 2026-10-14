import { query } from "./_generated/server";
import { usuarioAtual } from "./lib/acesso";

export const minhaSessao = query({
  args: {},
  handler: async (ctx) => {
    const sessao = await usuarioAtual(ctx);
    const [area, quadro, vinculos] = await Promise.all([
      ctx.db.get(sessao.usuario.area_id),
      ctx.db.get(sessao.quadro_id),
      ctx.db
        .query("perfil_permissoes")
        .withIndex("by_perfil_permissao", (q) => q.eq("perfil_id", sessao.perfil._id))
        .collect(),
    ]);

    if (!area || !quadro) throw new Error("Área do usuário não encontrada.");

    const permissoes: Record<string, string> = {};
    for (const vinculo of vinculos) {
      const permissao = await ctx.db.get(vinculo.permissao_id);
      if (permissao) permissoes[permissao.codigo] = vinculo.escopo;
    }
    const quadrosDaOrganizacao = await ctx.db
      .query("quadros")
      .withIndex("by_organizacao", (q) => q.eq("organizacao_id", sessao.usuario.organizacao_id))
      .collect();
    const podeVerTodosQuadros = sessao.perfil.codigo === "ADMIN" ||
      Object.values(permissoes).includes("TODOS");
    const quadros = quadrosDaOrganizacao
      .filter((quadro) => quadro.ativo && (podeVerTodosQuadros || quadro._id === sessao.quadro_id))
      .map(({ _id, nome }) => ({ id: _id, nome }));
    const quadrosDestino = permissoes.CARD_TRANSFERIR
      ? quadrosDaOrganizacao.filter((quadro) => quadro.ativo).map(({ _id, nome }) => ({ id: _id, nome }))
      : quadros;
    const quadrosCompartilhamento = permissoes.COMPARTILHAMENTO_GERENCIAR
      ? quadrosDaOrganizacao.filter((quadro) => quadro.ativo).map(({ _id, nome }) => ({ id: _id, nome }))
      : quadros;
    const usuariosDaOrganizacao = await ctx.db
      .query("usuarios")
      .withIndex("by_organizacao", (q) => q.eq("organizacao_id", sessao.usuario.organizacao_id))
      .collect();
    const usuariosCompartilhamento = (await Promise.all(usuariosDaOrganizacao.map(async (usuario) => {
      if (!usuario.ativo) return null;
      const areaUsuario = await ctx.db.get(usuario.area_id);
      const perfilUsuario = await ctx.db.get(usuario.perfil_id);
      const quadroUsuario = areaUsuario ? await ctx.db.get(areaUsuario.quadro_id) : null;
      if (
        !areaUsuario?.ativa ||
        areaUsuario.organizacao_id !== sessao.usuario.organizacao_id ||
        !perfilUsuario ||
        !quadroUsuario?.ativo ||
        quadroUsuario.organizacao_id !== sessao.usuario.organizacao_id
      ) return null;
      return {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        area: quadroUsuario.nome,
      };
    }))).filter((usuario): usuario is NonNullable<typeof usuario> => usuario !== null);

    return {
      usuario: { nome: sessao.usuario.nome, email: sessao.usuario.email },
      perfil: { codigo: sessao.perfil.codigo, nome: sessao.perfil.nome },
      area: { macroarea: area.macroarea, setor: area.setor },
      quadro: { nome: quadro.nome },
      quadros,
      quadrosDestino,
      quadrosCompartilhamento,
      usuarios: usuariosCompartilhamento,
      permissoes,
    };
  },
});
