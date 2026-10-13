// Gerado de Converge_Banco_v4.xlsx. Os 'codigo' são os códigos documentais da planilha;
// o seed troca cada um pelo _id gerado pelo Convex.
/* eslint-disable */
export const seedData = {
 "organizacoes": [
  {
   "codigo": "ORG_001",
   "nome": "HC FM USP",
   "descricao": "Hospital das Clínicas da Faculdade de Medicina da Universidade de São Paulo",
   "ativa": true,
   "criado_em": 1790899200000,
   "atualizado_em": 1790899200000
  }
 ],
 "quadros": [
  {
   "codigo": "QUADRO_001",
   "organizacao": "ORG_001",
   "nome": "Assistencial",
   "cor": "1E88E5",
   "ordem": 1,
   "ativo": true
  },
  {
   "codigo": "QUADRO_002",
   "organizacao": "ORG_001",
   "nome": "Operacional",
   "cor": "F57C00",
   "ordem": 2,
   "ativo": true
  },
  {
   "codigo": "QUADRO_003",
   "organizacao": "ORG_001",
   "nome": "Administrativo",
   "cor": "43A047",
   "ordem": 3,
   "ativo": true
  },
  {
   "codigo": "QUADRO_004",
   "organizacao": "ORG_001",
   "nome": "Diretoria",
   "cor": "6A1B9A",
   "ordem": 4,
   "ativo": true
  },
  {
   "codigo": "QUADRO_005",
   "organizacao": "ORG_001",
   "nome": "Ocupacional",
   "cor": "00897B",
   "ordem": 5,
   "ativo": true
  },
  {
   "codigo": "QUADRO_006",
   "organizacao": "ORG_001",
   "nome": "Qualidade",
   "cor": "E53935",
   "ordem": 6,
   "ativo": true
  },
  {
   "codigo": "QUADRO_007",
   "organizacao": "ORG_001",
   "nome": "Dados",
   "cor": "546E7A",
   "ordem": 7,
   "ativo": true
  }
 ],
 "areas": [
  {
   "codigo": "AREA_001",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_001",
   "macroarea": "ASSISTENCIAL",
   "setor": "PRONTO ATENDIMENTO",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_002",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_001",
   "macroarea": "ASSISTENCIAL",
   "setor": "AMBULATÓRIO",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_003",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_002",
   "macroarea": "EXTERNO",
   "setor": "PRESTADOR DE SERVIÇOS MÉDICOS",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_004",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_005",
   "macroarea": "OCUPACIONAL",
   "setor": "MEDICINA DO TRABALHO",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_005",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_005",
   "macroarea": "OCUPACIONAL",
   "setor": "ENGENHARIA DE SEGURANÇA",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_006",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_005",
   "macroarea": "OCUPACIONAL",
   "setor": "CONTROLE DE PROCESSOS",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_007",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_004",
   "macroarea": "DIRETORIA",
   "setor": "DIRETORIA",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_008",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_006",
   "macroarea": "DIRETORIA",
   "setor": "QUALIDADE",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_009",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_004",
   "macroarea": "DIRETORIA",
   "setor": "PROJETOS",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_010",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_004",
   "macroarea": "DIRETORIA",
   "setor": "OUVIDORIA",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_011",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_003",
   "macroarea": "ADMINISTRATIVO",
   "setor": "CONTROLES INTERNOS",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_012",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_003",
   "macroarea": "ADMINISTRATIVO",
   "setor": "COMUNICAÇÃO",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_013",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_003",
   "macroarea": "ADMINISTRATIVO",
   "setor": "APOIO PREDIAL",
   "descricao": "Área operacional do Converge",
   "ativa": true
  },
  {
   "codigo": "AREA_014",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_007",
   "macroarea": "DADOS",
   "setor": "DADOS",
   "descricao": "Equipe de Dados (administradores do ComGestor)",
   "ativa": true
  },
  {
   "codigo": "AREA_015",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_003",
   "macroarea": "ADMINISTRATIVO",
   "setor": "ADMINISTRATIVO",
   "descricao": "Área genérica: usuários sem setor definido (macroárea informada na origem)",
   "ativa": true
  },
  {
   "codigo": "AREA_016",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_001",
   "macroarea": "ASSISTENCIAL",
   "setor": "ASSISTENCIAL",
   "descricao": "Área genérica: usuários sem setor definido (macroárea informada na origem)",
   "ativa": true
  },
  {
   "codigo": "AREA_017",
   "organizacao": "ORG_001",
   "quadro": "QUADRO_005",
   "macroarea": "OCUPACIONAL",
   "setor": "OCUPACIONAL",
   "descricao": "Área genérica: usuários sem setor definido (macroárea informada na origem)",
   "ativa": true
  }
 ],
 "perfis": [
  {
   "codigo": "PERFIL_001",
   "cod": "ADMIN",
   "nome": "Administrador",
   "descricao": "Acesso completo ao sistema"
  },
  {
   "codigo": "PERFIL_002",
   "cod": "GESTOR",
   "nome": "Gestor",
   "descricao": "Gerencia cards e ações da sua área"
  },
  {
   "codigo": "PERFIL_003",
   "cod": "USUARIO",
   "nome": "Usuário",
   "descricao": "Cria e acompanha seus cards"
  }
 ],
 "permissoes": [
  {
   "codigo": "PERM_001",
   "cod": "CARD_CRIAR",
   "recurso": "CARDS",
   "acao": "CRIAR"
  },
  {
   "codigo": "PERM_002",
   "cod": "CARD_EDITAR",
   "recurso": "CARDS",
   "acao": "EDITAR"
  },
  {
   "codigo": "PERM_003",
   "cod": "ACAO_CRIAR",
   "recurso": "ACOES",
   "acao": "CRIAR"
  },
  {
   "codigo": "PERM_004",
   "cod": "ACAO_EDITAR",
   "recurso": "ACOES",
   "acao": "EDITAR"
  },
  {
   "codigo": "PERM_005",
   "cod": "ACAO_EXECUTAR",
   "recurso": "ACOES",
   "acao": "EXECUTAR"
  },
  {
   "codigo": "PERM_006",
   "cod": "COMENTARIO_CRIAR",
   "recurso": "COMENTARIOS",
   "acao": "CRIAR"
  },
  {
   "codigo": "PERM_007",
   "cod": "ANEXO_GERENCIAR",
   "recurso": "ANEXOS",
   "acao": "GERENCIAR"
  },
  {
   "codigo": "PERM_008",
   "cod": "USUARIO_GERENCIAR",
   "recurso": "USUARIOS",
   "acao": "GERENCIAR"
  },
  {
   "codigo": "PERM_009",
   "cod": "AREA_GERENCIAR",
   "recurso": "AREAS",
   "acao": "GERENCIAR"
  },
  {
   "codigo": "PERM_010",
   "cod": "PERFIL_GERENCIAR",
   "recurso": "PERFIS",
   "acao": "GERENCIAR"
  },
  {
   "codigo": "PERM_011",
   "cod": "COMPARTILHAMENTO_GERENCIAR",
   "recurso": "COMPARTILHAMENTOS",
   "acao": "GERENCIAR"
  },
  {
   "codigo": "PERM_012",
   "cod": "EVENTO_VISUALIZAR",
   "recurso": "EVENTOS",
   "acao": "VISUALIZAR"
  },
  {
   "codigo": "PERM_013",
   "cod": "TAG_GERENCIAR",
   "recurso": "TAGS",
   "acao": "GERENCIAR"
  },
  {
   "codigo": "PERM_014",
   "cod": "CARD_TRANSFERIR",
   "recurso": "CARDS",
   "acao": "TRANSFERIR"
  },
  {
   "codigo": "PERM_015",
   "cod": "SUBAREA_CRIAR",
   "recurso": "SUBAREAS",
   "acao": "CRIAR"
  }
 ],
 "perfilPermissoes": [
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_001",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_002",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_003",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_004",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_005",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_006",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_007",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_008",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_009",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_010",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_011",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_012",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_013",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_001",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_002",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_003",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_004",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_005",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_006",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_007",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_009",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_011",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_012",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_013",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_003",
   "permissao": "PERM_001",
   "escopo": "PROPRIO"
  },
  {
   "perfil": "PERFIL_003",
   "permissao": "PERM_002",
   "escopo": "PROPRIO"
  },
  {
   "perfil": "PERFIL_003",
   "permissao": "PERM_003",
   "escopo": "PROPRIO"
  },
  {
   "perfil": "PERFIL_003",
   "permissao": "PERM_004",
   "escopo": "PROPRIO"
  },
  {
   "perfil": "PERFIL_003",
   "permissao": "PERM_005",
   "escopo": "PROPRIO"
  },
  {
   "perfil": "PERFIL_003",
   "permissao": "PERM_006",
   "escopo": "PROPRIO"
  },
  {
   "perfil": "PERFIL_003",
   "permissao": "PERM_007",
   "escopo": "PROPRIO"
  },
  {
   "perfil": "PERFIL_003",
   "permissao": "PERM_012",
   "escopo": "PROPRIO"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_014",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_001",
   "permissao": "PERM_015",
   "escopo": "TODOS"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_014",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_002",
   "permissao": "PERM_015",
   "escopo": "QUADRO"
  },
  {
   "perfil": "PERFIL_003",
   "permissao": "PERM_011",
   "escopo": "PROPRIO"
  },
  {
   "perfil": "PERFIL_003",
   "permissao": "PERM_014",
   "escopo": "PROPRIO"
  },
  {
   "perfil": "PERFIL_003",
   "permissao": "PERM_015",
   "escopo": "QUADRO"
  }
 ],
 "status": [
  {
   "codigo": "STATUS_001",
   "cod": "A_FAZER",
   "nome": "A Fazer",
   "descricao": "Atividade criada e ainda não iniciada",
   "ordem": 1,
   "final": false,
   "ativo": true
  },
  {
   "codigo": "STATUS_002",
   "cod": "EM_ANDAMENTO",
   "nome": "Em Andamento",
   "descricao": "Atividade em execução",
   "ordem": 2,
   "final": false,
   "ativo": true
  },
  {
   "codigo": "STATUS_003",
   "cod": "CONCLUIDO",
   "nome": "Concluídos",
   "descricao": "Atividade concluída",
   "ordem": 3,
   "final": true,
   "ativo": true
  },
  {
   "codigo": "STATUS_004",
   "cod": "SUSPENSO",
   "nome": "Suspenso",
   "descricao": "Atividade temporariamente suspensa",
   "ordem": 4,
   "final": false,
   "ativo": true
  },
  {
   "codigo": "STATUS_005",
   "cod": "CANCELADO",
   "nome": "Cancelado",
   "descricao": "Atividade cancelada",
   "ordem": 5,
   "final": true,
   "ativo": true
  }
 ],
 "usuarios": [
  {
   "organizacao": "ORG_001",
   "email": "usuario01@example.com",
   "nome": "usuario de teste 01",
   "area": "AREA_016",
   "perfil": "PERFIL_003",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario02@example.com",
   "nome": "usuario de teste 02",
   "area": "AREA_007",
   "perfil": "PERFIL_002",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario03@example.com",
   "nome": "usuario de teste 03",
   "area": "AREA_008",
   "perfil": "PERFIL_003",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario04@example.com",
   "nome": "usuario de teste 04",
   "area": "AREA_017",
   "perfil": "PERFIL_003",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario05@example.com",
   "nome": "usuario de teste 05",
   "area": "AREA_008",
   "perfil": "PERFIL_003",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario06@example.com",
   "nome": "usuario de teste 06",
   "area": "AREA_015",
   "perfil": "PERFIL_003",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario07@example.com",
   "nome": "usuario de teste 07",
   "area": "AREA_014",
   "perfil": "PERFIL_001",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario08@example.com",
   "nome": "usuario de teste 08",
   "area": "AREA_014",
   "perfil": "PERFIL_001",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario09@example.com",
   "nome": "usuario de teste 09",
   "area": "AREA_017",
   "perfil": "PERFIL_003",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario10@example.com",
   "nome": "usuario de teste 10",
   "area": "AREA_007",
   "perfil": "PERFIL_001",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario11@example.com",
   "nome": "usuario de teste 11",
   "area": "AREA_014",
   "perfil": "PERFIL_001",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario12@example.com",
   "nome": "usuario de teste 12",
   "area": "AREA_015",
   "perfil": "PERFIL_002",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "usuario13@example.com",
   "nome": "usuario de teste 13",
   "area": "AREA_014",
   "perfil": "PERFIL_001",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "ellen.fgomes@hc.fm.usp.br",
   "nome": "Ellen Gomes",
   "area": "AREA_014",
   "perfil": "PERFIL_001",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "fernando.maia@hc.fm.usp.br",
   "nome": "Fernando Maia",
   "area": "AREA_016",
   "perfil": "PERFIL_002",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "thais.v@hc.fm.usp.br",
   "nome": "Thais",
   "area": "AREA_008",
   "perfil": "PERFIL_003",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "pamela.santos@hc.fm.usp.br",
   "nome": "Pamela Santos",
   "area": "AREA_008",
   "perfil": "PERFIL_003",
   "ativo": true
  },
  {
   "organizacao": "ORG_001",
   "email": "ricardo.borges@hc.fm.usp.br",
   "nome": "Ricardo Borges",
   "area": "AREA_016",
   "perfil": "PERFIL_003",
   "ativo": true
  }
 ]
} as const;
