// Autorização: perfil (por e-mail) + permissão + escopo + visibilidade do card.
// TODA query/mutation do ComGestor deve começar por usuarioAtual() e checar permissão com exigir().
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;
export type Escopo = "PROPRIO" | "QUADRO" | "TODOS";
export type Sessao = {
  usuario: Doc<"usuarios">;
  perfil: Doc<"perfis_acesso">;
  quadro_id: Id<"quadros">; // quadro da área do usuário (base do escopo QUADRO)
};

/** Resolve o login do Clerk → e-mail → cadastro em "usuarios" (perfil e área). */
export async function usuarioAtual(ctx: Ctx): Promise<Sessao> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Não autenticado.");
  if (identity.emailVerified !== true && identity.email_verified !== true) {
    throw new Error("E-mail não verificado.");
  }
  const email = identity.email?.trim().toLowerCase();
  if (!email) throw new Error("Token sem e-mail (confira a integração Clerk ↔ Convex).");

  const usuario = await ctx.db
    .query("usuarios")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (!usuario || !usuario.ativo) throw new Error("Usuário sem acesso ao ComGestor.");

  const [area, perfil, organizacao] = await Promise.all([
    ctx.db.get(usuario.area_id),
    ctx.db.get(usuario.perfil_id),
    ctx.db.get(usuario.organizacao_id),
  ]);
  if (!area || !perfil || !organizacao) throw new Error("Cadastro de usuário inconsistente (organização/área/perfil).");
  if (!area.ativa || !organizacao.ativa) throw new Error("Área ou organização inativa.");
  if (area.organizacao_id !== organizacao._id) throw new Error("Área não pertence à organização do usuário.");
  const quadro = await ctx.db.get(area.quadro_id);
  if (!quadro || !quadro.ativo || quadro.organizacao_id !== organizacao._id) {
    throw new Error("Quadro da área não pertence à organização do usuário.");
  }
  return { usuario, perfil, quadro_id: area.quadro_id };
}

/** Escopo do perfil para uma permissão (ex.: "CARD_EDITAR"), ou null se não tem. */
export async function escopoDe(ctx: Ctx, perfil_id: Id<"perfis_acesso">, codigo: string): Promise<Escopo | null> {
  const permissao = await ctx.db.query("permissoes").withIndex("by_codigo", (q) => q.eq("codigo", codigo)).unique();
  if (!permissao) return null;
  const pp = await ctx.db
    .query("perfil_permissoes")
    .withIndex("by_perfil_permissao", (q) => q.eq("perfil_id", perfil_id).eq("permissao_id", permissao._id))
    .unique();
  return pp?.escopo ?? null;
}

/** Exige a permissão; devolve o escopo. */
export async function exigir(ctx: Ctx, s: Sessao, codigo: string): Promise<Escopo> {
  const e = await escopoDe(ctx, s.perfil._id, codigo);
  if (!e) throw new Error(`Sem permissão: ${codigo}`);
  return e;
}

/** Visibilidade do card. DECISÃO PENDENTE: aqui o ADMIN enxerga tudo, inclusive PESSOAS_ESPECIFICAS.
 *  Para dados de saúde ocupacional (LGPD), considere tirar esse atalho. */
export async function podeVerCard(ctx: Ctx, s: Sessao, card: Doc<"cards">): Promise<boolean> {
  if (card.organizacao_id !== s.usuario.organizacao_id) return false;
  if (s.perfil.codigo === "ADMIN") return true;
  const uid = s.usuario._id;
  if (card.criado_por_id === uid || card.responsavel_conclusao_id === uid) return true;

  const comps = await ctx.db.query("compartilhamentos").withIndex("by_card", (q) => q.eq("card_id", card._id)).collect();
  if (comps.some((c) => c.tipo_destino === "USUARIO" && c.usuario_id === uid)) return true;

  if (card.visibilidade === "PESSOAS_ESPECIFICAS") {
    const acoes = await ctx.db.query("acoes").withIndex("by_card", (q) => q.eq("card_id", card._id)).collect();
    return acoes.some((a) => a.responsavel_id === uid);
  }
  if (card.quadro_id === s.quadro_id) return true;
  return comps.some((c) => c.tipo_destino === "QUADRO" && c.quadro_id === s.quadro_id);
}

/** Edição: respeita o escopo da permissão (TODOS / QUADRO / PROPRIO) e o nível EDICAO de compartilhamento. */
export async function podeEditarCard(ctx: Ctx, s: Sessao, card: Doc<"cards">): Promise<boolean> {
  if (!(await podeVerCard(ctx, s, card))) return false;
  const escopo = await escopoDe(ctx, s.perfil._id, "CARD_EDITAR");
  if (!escopo) return false;
  if (escopo === "TODOS") return true;
  if (escopo === "QUADRO" && card.quadro_id === s.quadro_id) return true;
  const uid = s.usuario._id;
  if (card.criado_por_id === uid || card.responsavel_conclusao_id === uid) return true;
  const comps = await ctx.db.query("compartilhamentos").withIndex("by_card", (q) => q.eq("card_id", card._id)).collect();
  return comps.some((c) => c.tipo_destino === "USUARIO" && c.usuario_id === uid && c.nivel_acesso === "EDICAO");
}
