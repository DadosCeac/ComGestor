const CLERK_PUBLISHABLE_KEY =
  "pk_test_YWJsZS1sYW1iLTE1NjEuY2xlcmsuYWNjb3VudHMuZGV2JA";

const CLERK_DOMAIN =
  "https://able-lamb-1561.clerk.accounts.dev";

const loginContainer =
  document.getElementById("clerk-login");

const errorBox =
  document.getElementById("login-error");

const loadingBox =
  document.getElementById("login-loading");

let validandoAcesso = false;

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = "block";
}


function hideError() {
  errorBox.textContent = "";
  errorBox.style.display = "none";
}


function showLoading() {
  loadingBox.style.display = "block";
}


function hideLoading() {
  loadingBox.style.display = "none";
}


async function iniciarLogin() {

  try {

    hideError();
    showLoading();

    console.log("1. Iniciando Clerk...");

    /*
      Confirma se o Clerk foi carregado
      pelos scripts do HTML.
    */
    if (!window.Clerk) {

      throw new Error(
        "ClerkJS não foi carregado."
      );

    }

    console.log(
      "2. Clerk encontrado."
    );

    /*
      Inicializa o Clerk.
    */
    await window.Clerk.load({
      ui: {
        ClerkUI:
          window.__internal_ClerkUICtor
      }
    });

    console.log(
      "3. Clerk carregado."
    );

    /*
      Caso já esteja autenticado,
      não mostra novamente o login.
    */
    if (
      window.Clerk.isSignedIn &&
      window.Clerk.session
    ) {

      console.log(
        "4. Usuário já autenticado."
      );

      await verificarUsuario();

      return;
    }

    /*
      Mostra o login oficial do Clerk.
    */
    console.log(
      "4. Montando tela de login..."
    );

    window.Clerk.mountSignIn(
      loginContainer,
      {
        appearance: {
          layout: {
            socialButtonsPlacement: "top",
            socialButtonsVariant: "blockButton"
          },
          variables: {
            colorPrimary: "#2563eb"
          }
        }
      }
    );

    console.log(
      "5. Tela de login montada."
    );

    hideLoading();

    /*
      Quando o usuário terminar o login,
      verificamos o cadastro no ComGestor.
    */
    window.Clerk.addListener(
      async ({ session }) => {

        if (
          session &&
          window.Clerk.isSignedIn
        ) {

          await verificarUsuario();

        }

      }
    );

  } catch (error) {

    console.error(
      "ERRO CLERK:",
      error
    );

    hideLoading();

    showError(
      "Não foi possível iniciar o login. " +
      "Verifique a configuração do Clerk."
    );
  }
}


async function verificarUsuario() {
  if (validandoAcesso) return;
  validandoAcesso = true;

  try {

    showLoading();
    hideError();

    console.log(
      "6. Validando sessão no Convex..."
    );

    if (!window.ComGestorConvex) {
      throw new Error("Cliente Convex não foi carregado.");
    }

    const sessao = await window.ComGestorConvex.minhaSessao();
    console.log("7. Acesso validado pelo Convex.", sessao.perfil.codigo);

    /*
      Entra no ComGestor.
    */
    window.location.href = "./index.html";
  } catch (error) {

    console.error(
      "ERRO AO VALIDAR USUÁRIO:",
      error
    );

    const mensagem = error instanceof Error ? error.message : "";
    if (/sem acesso|não autorizado/i.test(mensagem)) {
      showError("Sua conta não está autorizada no ComGestor. Solicite acesso ao administrador.");
    } else if (/token de sessão do clerk|integration.*convex|integração convex/i.test(mensagem)) {
      showError("O Clerk não está fornecendo um token de sessão válido para o Convex. Confira a integração Convex e a configuração do token de sessão.");
    } else if (/e-mail não verificado|email.*not verified|email_verified/i.test(mensagem)) {
      showError("O Clerk não confirmou o e-mail desta conta. Verifique o endereço de e-mail e o claim email_verified no token de sessão.");
    } else if (/não autenticado|not authenticated|invalid.*token|token.*invalid|issuer|audience/i.test(mensagem)) {
      showError("O Convex não reconheceu a sessão do Clerk. Confira se a integração Convex está ativa para a instância correta e se o domínio corresponde ao Clerk configurado no backend.");
    } else if (/could not find public function|function.*not found/i.test(mensagem)) {
      showError("O serviço de acesso ainda não foi publicado no Convex. Solicite ao administrador a publicação do backend e tente novamente.");
    } else {
      showError("Não foi possível validar seu acesso no Convex. Verifique a integração e tente novamente.");
    }

    hideLoading();
    validandoAcesso = false;
  }

}


window.addEventListener(
  "load",
  iniciarLogin
);
