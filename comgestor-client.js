(function () {
  const CONVEX_URL = "https://compassionate-platypus-707.convex.cloud";

  async function getToken() {
    if (!window.Clerk || typeof window.Clerk.load !== "function") {
      throw new Error("O Clerk não foi carregado.");
    }

    await window.Clerk.load();
    if (!window.Clerk.isSignedIn || !window.Clerk.session) {
      throw new Error("Sessão não autenticada.");
    }

    const token = await window.Clerk.session.getToken({ template: "convex" });
    if (!token) throw new Error("Token JWT do template convex não encontrado no Clerk.");
    return token;
  }

  async function callConvex(kind, path, args) {
    const token = await getToken();
    const response = await fetch(`${CONVEX_URL}/api/${kind}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ path, args }),
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`Resposta inválida do Convex (HTTP ${response.status}).`);
    }

    if (!result || !response.ok || result.status !== "success") {
      throw new Error(result?.errorMessage || `Falha na chamada Convex (HTTP ${response.status}).`);
    }
    return result.value;
  }

  async function minhaSessao() {
    return callConvex("query", "usuarios:minhaSessao", {});
  }

  async function listarCards(quadros) {
    const resultados = await Promise.all(quadros.map(async (quadro) => {
      const documentos = await callConvex("query", "cards:listarPorQuadro", { quadro_id: quadro.id });
      return documentos.map((documento) => ({ documento, quadro }));
    }));

    let idLocal = 1;
    return resultados.flat().map(({ documento, quadro }) => {
      const dados = documento.dados_interface && typeof documento.dados_interface === "object"
        ? documento.dados_interface
        : {};
      const areaOrigem = documento.quadro_nome || quadro.nome;
      const areasCompartilhadas = areaOrigem === quadro.nome
        ? dados.sharedWith || ""
        : [dados.sharedWith, quadro.nome].filter(Boolean).join(", ");
      return {
        ...dados,
        id: idLocal++,
        _convexId: documento._id,
        _convexBoardId: documento.quadro_id,
        title: dados.title || documento.titulo,
        desc: dados.desc || documento.descricao || "",
        area: areaOrigem,
        createdArea: dados.createdArea || areaOrigem,
        colorArea: dados.colorArea || areaOrigem,
        sharedWith: areasCompartilhadas,
        urgencia: documento.urgente ? "Sim" : "Não",
        visibility: documento.visibilidade === "PESSOAS_ESPECIFICAS" ? "selected" : "area",
        status: dados.status || "A Fazer",
        archived: Boolean(dados.archived || documento.suspenso_indeterminado),
        actions: Array.isArray(dados.actions) ? dados.actions : [],
        comments: Array.isArray(dados.comments) ? dados.comments : [],
        tags: Array.isArray(dados.tags) ? dados.tags : [],
        history: Array.isArray(dados.history) ? dados.history : [],
      };
    });
  }

  async function persistirCard(card, quadro) {
    const nomesSelecionados = String(card.selectedUsers || "")
      .split(",")
      .map((nome) => nome.trim().replace(/^@/, ""))
      .filter(Boolean);
    const compartilharCom = nomesSelecionados.map((nome) => {
      const usuario = (window.COMGESTOR_SESSION?.usuarios || []).find(
        (item) => item.nome.toLowerCase() === nome.toLowerCase()
      );
      if (!usuario) throw new Error(`Não foi possível localizar o usuário ${nome} para compartilhar.`);
      return usuario.email;
    });
    return callConvex("mutation", "cards:persistirDoApp", {
      card_id: card._convexId,
      quadro_id: quadro.id,
      titulo: card.title,
      descricao: card.desc || undefined,
      urgente: card.urgencia === "Sim",
      visibilidade: card.visibility === "selected" ? "PESSOAS_ESPECIFICAS" : "EQUIPE_INTEIRA",
      suspenso_indeterminado: card.status === "Suspenso",
      dados_interface: card,
      compartilhar_com: compartilharCom,
    });
  }

  async function transferirCard(cardId, quadroDestino) {
    return callConvex("mutation", "cards:transferir", {
      card_id: cardId,
      quadro_destino_id: quadroDestino.id,
    });
  }

  async function compartilharCard(cardId, quadroDestino) {
    return callConvex("mutation", "cards:compartilharComQuadro", {
      card_id: cardId,
      quadro_destino_id: quadroDestino.id,
    });
  }

  function temPermissao(codigo) {
    return Object.prototype.hasOwnProperty.call(
      window.COMGESTOR_SESSION?.permissoes || {},
      codigo
    );
  }

  function exigirPermissao(codigo) {
    if (temPermissao(codigo)) return true;
    if (typeof window.toast === "function") {
      window.toast(`Seu perfil não possui a permissão ${codigo}.`);
    }
    return false;
  }

  window.ComGestorConvex = {
    callConvex,
    exigirPermissao,
    listarCards,
    minhaSessao,
    persistirCard,
    compartilharCard,
    temPermissao,
    transferirCard,
  };
})();
