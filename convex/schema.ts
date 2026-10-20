// ComGestor · Converge — schema Convex (gerado a partir de Converge_Banco_v4.xlsx, aba ESQUEMA)
// Os nomes dos campos seguem a planilha (snake_case). A chave documental (USR_001...) vira o _id do Convex.
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const escopo = v.union(v.literal("PROPRIO"), v.literal("QUADRO"), v.literal("TODOS"));

export default defineSchema({
  organizacoes: defineTable({
    nome: v.string(),
    descricao: v.optional(v.string()),
    ativa: v.boolean(),
    bloquear_migracao_cards_locais: v.optional(v.boolean()),
    criado_em: v.number(),
    atualizado_em: v.number(),
  }),

  quadros: defineTable({
    organizacao_id: v.id("organizacoes"),
    nome: v.string(),
    cor: v.string(), // hexadecimal sem #
    ordem: v.number(),
    ativo: v.boolean(),
  }).index("by_organizacao", ["organizacao_id"]),

  areas: defineTable({
    organizacao_id: v.id("organizacoes"),
    quadro_id: v.id("quadros"),
    macroarea: v.string(),
    setor: v.string(),
    descricao: v.optional(v.string()),
    ativa: v.boolean(),
  }).index("by_quadro", ["quadro_id"]),

  perfis_acesso: defineTable({
    codigo: v.string(), // ADMIN | GESTOR | USUARIO
    nome: v.string(),
    descricao: v.optional(v.string()),
  }).index("by_codigo", ["codigo"]),

  permissoes: defineTable({
    codigo: v.string(),
    recurso: v.string(),
    acao: v.string(),
  }).index("by_codigo", ["codigo"]),

  perfil_permissoes: defineTable({
    perfil_id: v.id("perfis_acesso"),
    permissao_id: v.id("permissoes"),
    escopo,
  }).index("by_perfil_permissao", ["perfil_id", "permissao_id"]),

  // Cadastro de quem pode entrar. O vínculo com o login é feito pelo e-mail (ver auth.ts e lib/acesso.ts).
  usuarios: defineTable({
    organizacao_id: v.id("organizacoes"),
    email: v.string(), // sempre minúsculo
    nome: v.string(),
    area_id: v.id("areas"),
    perfil_id: v.id("perfis_acesso"),
    ativo: v.boolean(),
  })
    .index("by_email", ["email"])
    .index("by_area", ["area_id"])
    .index("by_organizacao", ["organizacao_id"]),

  status: defineTable({
    codigo: v.string(),
    nome: v.string(),
    descricao: v.optional(v.string()),
    ordem: v.number(),
    final: v.boolean(),
    ativo: v.boolean(),
  }).index("by_codigo", ["codigo"]),

  subareas: defineTable({
    quadro_id: v.id("quadros"),
    nome: v.string(),
    ativa: v.boolean(),
    criado_por_id: v.id("usuarios"),
    criado_em: v.number(),
  }).index("by_quadro_nome", ["quadro_id", "nome"]),

  cards: defineTable({
    organizacao_id: v.id("organizacoes"),
    quadro_id: v.id("quadros"), // quadro dono; transferir altera, compartilhar não
    origin_quadro_id: v.id("quadros"), // onde foi criado; nunca muda
    subarea_id: v.optional(v.id("subareas")),
    criado_por_id: v.id("usuarios"),
    responsavel_conclusao_id: v.optional(v.id("usuarios")),
    titulo: v.string(),
    descricao: v.optional(v.string()),
    urgente: v.boolean(),
    visibilidade: v.union(v.literal("EQUIPE_INTEIRA"), v.literal("PESSOAS_ESPECIFICAS")),
    status_id: v.id("status"),
    suspenso_indeterminado: v.boolean(),
    suspenso_desde: v.optional(v.number()),
    ordem: v.number(), // fracionário: inserir entre dois cards sem renumerar
    endereco: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    dados_interface: v.optional(v.any()),
    em_andamento_desde: v.optional(v.number()),
    concluido_em: v.optional(v.number()),
    criado_em: v.number(),
    atualizado_em: v.number(),
  })
    .index("by_quadro_status_ordem", ["quadro_id", "status_id", "ordem"])
    .index("by_criado_por", ["criado_por_id"])
    .index("by_subarea", ["subarea_id"]),

  acoes: defineTable({
    card_id: v.id("cards"),
    responsavel_id: v.optional(v.id("usuarios")),
    criado_por_id: v.id("usuarios"),
    titulo: v.string(),
    descricao: v.optional(v.string()),
    data_inicio: v.optional(v.number()),
    duracao_dias: v.optional(v.number()),
    data_prazo: v.optional(v.number()), // = data_inicio + duracao_dias (calculado ao salvar)
    status_id: v.id("status"),
    concluida_em: v.optional(v.number()),
    ordem: v.number(),
    criado_em: v.number(),
    atualizado_em: v.number(),
  })
    .index("by_card", ["card_id", "ordem"])
    .index("by_responsavel_status", ["responsavel_id", "status_id"])
    .index("by_data_prazo", ["data_prazo"]),

  minhas_acoes: defineTable({
    usuario_id: v.id("usuarios"),
    acao_id: v.id("acoes"),
    papel: v.union(v.literal("RESPONSAVEL"), v.literal("PARTICIPANTE"), v.literal("OBSERVADOR")),
    visualizada: v.boolean(),
    recebida_em: v.optional(v.number()),
    visualizada_em: v.optional(v.number()),
    concluida_pelo_usuario_em: v.optional(v.number()),
    arquivada: v.boolean(),
    observacao: v.optional(v.string()),
  })
    .index("by_usuario", ["usuario_id", "arquivada"])
    .index("by_usuario_acao", ["usuario_id", "acao_id"])
    .index("by_acao", ["acao_id"]),

  comentarios: defineTable({
    card_id: v.id("cards"),
    acao_id: v.optional(v.id("acoes")),
    autor_id: v.id("usuarios"),
    texto: v.string(), // Markdown
    criado_em: v.number(),
    atualizado_em: v.optional(v.number()),
  }).index("by_card", ["card_id"]),

  anexos: defineTable({
    card_id: v.id("cards"),
    acao_id: v.optional(v.id("acoes")),
    comentario_id: v.optional(v.id("comentarios")),
    tipo: v.union(v.literal("ARQUIVO"), v.literal("LINK")),
    nome: v.string(),
    storage_key: v.optional(v.id("_storage")), // obrigatório se ARQUIVO (Convex File Storage, privado)
    url_externa: v.optional(v.string()), // obrigatório se LINK
    tipo_conteudo: v.optional(v.string()),
    tamanho_bytes: v.optional(v.number()),
    enviado_por_id: v.id("usuarios"),
    criado_em: v.number(),
  }).index("by_card", ["card_id"]),

  tags: defineTable({
    organizacao_id: v.id("organizacoes"),
    nome: v.string(),
    cor: v.optional(v.string()),
    criado_em: v.number(),
  }).index("by_organizacao_nome", ["organizacao_id", "nome"]),

  card_tags: defineTable({
    card_id: v.id("cards"),
    tag_id: v.id("tags"),
  })
    .index("by_card_tag", ["card_id", "tag_id"])
    .index("by_tag", ["tag_id"]),

  compartilhamentos: defineTable({
    card_id: v.id("cards"),
    tipo_destino: v.union(v.literal("QUADRO"), v.literal("USUARIO")),
    quadro_id: v.optional(v.id("quadros")), // só se QUADRO
    usuario_id: v.optional(v.id("usuarios")), // só se USUARIO
    nivel_acesso: v.union(v.literal("LEITURA"), v.literal("EDICAO")),
    criado_por_id: v.id("usuarios"),
    criado_em: v.number(),
  })
    .index("by_card", ["card_id"])
    .index("by_usuario", ["usuario_id"])
    .index("by_quadro", ["quadro_id"]),

  indicadores: defineTable({
    card_id: v.id("cards"),
    acao_id: v.optional(v.id("acoes")),
    nome: v.string(),
    unidade: v.optional(v.string()),
    valor_meta: v.optional(v.number()),
    valor_atual: v.optional(v.number()),
    criado_em: v.number(),
    atualizado_em: v.number(),
  }).index("by_card", ["card_id"]),

  medicoes: defineTable({
    indicador_id: v.id("indicadores"),
    valor: v.number(),
    medido_em: v.number(),
    registrado_por_id: v.id("usuarios"),
    observacao: v.optional(v.string()),
  }).index("by_indicador_data", ["indicador_id", "medido_em"]),

  eventos: defineTable({
    card_id: v.id("cards"),
    acao_id: v.optional(v.id("acoes")),
    ator_id: v.optional(v.id("usuarios")),
    ator_nome: v.optional(v.string()), // snapshot histórico
    tipo_evento: v.union(
      v.literal("CARD_CRIADO"), v.literal("CARD_EDITADO"), v.literal("CARD_MOVIDO"),
      v.literal("ACAO_CRIADA"), v.literal("ACAO_EDITADA"), v.literal("ACAO_STATUS_ALTERADO"),
      v.literal("ACAO_CONCLUIDA"), v.literal("COMENTARIO_CRIADO"), v.literal("ANEXO_ADICIONADO"),
      v.literal("COMPARTILHADO"), v.literal("CARD_TRANSFERIDO"), v.literal("INDICADOR_ATUALIZADO"),
    ),
    status_anterior_id: v.optional(v.id("status")),
    status_novo_id: v.optional(v.id("status")),
    descricao: v.string(),
    detalhes_json: v.optional(v.any()),
    ocorrido_em: v.number(),
  })
    .index("by_card_ocorrido", ["card_id", "ocorrido_em"])
    .index("by_acao", ["acao_id"]),
});
