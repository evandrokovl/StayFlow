(function setupAuthPages(window, document) {
  const stayFlowApi = window.StayFlowApi;
  const stayFlowUi = window.StayFlowUi;
  const clearMessage = stayFlowUi.clearMessage;
  const setButtonLoading = stayFlowUi.setButtonLoading;
  const showMessage = stayFlowUi.showMessage;

  let token = localStorage.getItem('token') || '';

  function getStoredUser() {
    const rawUser = localStorage.getItem('user');
    if (!rawUser || rawUser === 'undefined' || rawUser === 'null') return null;

    try {
      return JSON.parse(rawUser);
    } catch (error) {
      localStorage.removeItem('user');
      return null;
    }
  }

  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatCpf(value) {
    const digits = onlyDigits(value).slice(0, 11);
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }

  function isValidCpf(value) {
    const cpf = onlyDigits(value);
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i += 1) {
      sum += Number(cpf[i]) * (10 - i);
    }

    let firstDigit = (sum * 10) % 11;
    if (firstDigit === 10) firstDigit = 0;
    if (firstDigit !== Number(cpf[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i += 1) {
      sum += Number(cpf[i]) * (11 - i);
    }

    let secondDigit = (sum * 10) % 11;
    if (secondDigit === 10) secondDigit = 0;
    return secondDigit === Number(cpf[10]);
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
  }

  function getValue(id) {
    return document.getElementById(id)?.value.trim() || '';
  }

  function storeSession(data) {
    token = data?.data?.token || data.token || '';
    const user = data?.data?.user || data.user || null;

    if (!token || !user) {
      throw new Error('Resposta de autenticacao invalida do backend.');
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  function prepareNewUserOnboarding() {
    localStorage.removeItem('stayflow_onboarding_completed');
    localStorage.removeItem('stayflow_onboarding_card_hidden');
    localStorage.setItem('stayflow_onboarding_steps', JSON.stringify([]));
    localStorage.setItem('stayflow_onboarding_first_access', 'true');
  }

  const apiClient = stayFlowApi.createClient({
    getToken: () => token
  });

  async function login() {
    clearMessage('authMessage');

    const email = getValue('loginEmail');
    const password = getValue('loginPassword');

    if (!email || !password) {
      showMessage('authMessage', 'Informe e-mail e senha para entrar.', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      showMessage('authMessage', 'Informe um e-mail valido para entrar.', 'error');
      return;
    }

    if (password.length < 6) {
      showMessage('authMessage', 'A senha precisa ter pelo menos 6 caracteres.', 'error');
      return;
    }

    const loginBtn = document.getElementById('loginBtn');

    try {
      setButtonLoading(loginBtn, true, 'Entrando...');
      const data = await apiClient.fetch('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password },
        errorMessage: 'Nao foi possivel entrar. Confira seus dados.'
      });

      storeSession(data);
      window.location.href = '/app.html';
    } catch (error) {
      showMessage('authMessage', error.message || 'Erro ao conectar com o backend.', 'error');
    } finally {
      setButtonLoading(loginBtn, false);
    }
  }

  async function registerUser() {
    clearMessage('authMessage');

    const name = getValue('registerName');
    const email = getValue('registerEmail');
    const cpf = onlyDigits(getValue('registerCpf'));
    const password = getValue('registerPassword');

    if (!name || !email || !cpf || !password) {
      showMessage('authMessage', 'Preencha nome, e-mail, CPF e senha para criar a conta.', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      showMessage('authMessage', 'Informe um e-mail valido para criar a conta.', 'error');
      return;
    }

    if (!isValidCpf(cpf)) {
      showMessage('authMessage', 'CPF invalido. Confira os numeros e tente novamente.', 'error');
      return;
    }

    if (password.length < 6) {
      showMessage('authMessage', 'A senha precisa ter pelo menos 6 caracteres.', 'error');
      return;
    }

    const registerBtn = document.getElementById('registerBtn');

    try {
      setButtonLoading(registerBtn, true, 'Cadastrando...');
      await apiClient.fetch('/auth/register', {
        method: 'POST',
        auth: false,
        body: { name, email, cpf, password },
        errorMessage: 'Nao foi possivel cadastrar este usuario.'
      });

      showMessage('authMessage', 'Conta criada com sucesso. Entrando no StayFlow...', 'success');

      const loginData = await apiClient.fetch('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password },
        errorMessage: 'A conta foi criada, mas nao foi possivel entrar automaticamente.'
      });

      storeSession(loginData);
      prepareNewUserOnboarding();
      document.getElementById('registerPassword').value = '';
      window.location.href = '/app.html';
    } catch (error) {
      showMessage('authMessage', error.message || 'Erro ao conectar com o backend.', 'error');
    } finally {
      setButtonLoading(registerBtn, false);
    }
  }

  async function requestPasswordReset() {
    clearMessage('authMessage');

    const email = getValue('forgotPasswordEmail');
    if (!email) {
      showMessage('authMessage', 'Informe o e-mail da conta para receber as instrucoes.', 'error');
      return;
    }

    if (!isValidEmail(email)) {
      showMessage('authMessage', 'Informe um e-mail valido para recuperar a senha.', 'error');
      return;
    }

    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');

    try {
      setButtonLoading(forgotPasswordBtn, true, 'Enviando...');
      const data = await apiClient.fetch('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: { email },
        errorMessage: 'Nao foi possivel solicitar a recuperacao.'
      });

      const devToken = data?.data?.reset_token;
      if (devToken) {
        const resetToken = document.getElementById('resetToken');
        const resetBox = document.getElementById('resetPasswordBox');
        if (resetToken) resetToken.value = devToken;
        resetBox?.classList.remove('hidden');
      }

      showMessage('authMessage', data.message || 'Se o e-mail estiver cadastrado, enviaremos as instrucoes para redefinir sua senha.', 'success');
    } catch (error) {
      showMessage('authMessage', error.message || 'Erro ao conectar com o backend.', 'error');
    } finally {
      setButtonLoading(forgotPasswordBtn, false);
    }
  }

  async function resetPassword() {
    clearMessage('authMessage');

    const tokenValue = getValue('resetToken');
    const password = getValue('resetPassword');

    if (!tokenValue || !password) {
      showMessage('authMessage', 'Informe o token recebido e a nova senha.', 'error');
      return;
    }

    if (password.length < 6) {
      showMessage('authMessage', 'A nova senha precisa ter pelo menos 6 caracteres.', 'error');
      return;
    }

    const resetPasswordBtn = document.getElementById('resetPasswordBtn');

    try {
      setButtonLoading(resetPasswordBtn, true, 'Redefinindo...');
      const data = await apiClient.fetch('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: { token: tokenValue, password },
        errorMessage: 'Nao foi possivel redefinir a senha.'
      });

      document.getElementById('resetPassword').value = '';
      showMessage('authMessage', data.message || 'Senha redefinida com sucesso. Faca login com a nova senha.', 'success');
    } catch (error) {
      showMessage('authMessage', error.message || 'Erro ao conectar com o backend.', 'error');
    } finally {
      setButtonLoading(resetPasswordBtn, false);
    }
  }

  if (token && getStoredUser() && !window.location.pathname.endsWith('/recuperar-senha.html')) {
    window.location.replace('/app.html');
    return;
  }

  document.getElementById('loginBtn')?.addEventListener('click', login);
  document.getElementById('registerBtn')?.addEventListener('click', registerUser);
  document.getElementById('forgotPasswordBtn')?.addEventListener('click', requestPasswordReset);
  document.getElementById('resetPasswordBtn')?.addEventListener('click', resetPassword);
  document.getElementById('registerCpf')?.addEventListener('input', (event) => {
    event.target.value = formatCpf(event.target.value);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.target?.tagName !== 'INPUT') return;
    event.preventDefault();
    if (document.getElementById('loginBtn')) login();
    if (document.getElementById('registerBtn')) registerUser();
    if (document.getElementById('forgotPasswordBtn') && !document.getElementById('resetPasswordBox')?.classList.contains('hidden')) resetPassword();
    if (document.getElementById('forgotPasswordBtn') && document.getElementById('resetPasswordBox')?.classList.contains('hidden')) requestPasswordReset();
  });

  const resetTokenFromUrl = new URLSearchParams(window.location.search).get('resetToken');
  if (resetTokenFromUrl && document.getElementById('resetToken')) {
    document.getElementById('resetToken').value = resetTokenFromUrl;
    document.getElementById('resetPasswordBox')?.classList.remove('hidden');
    showMessage('authMessage', 'Token carregado. Informe sua nova senha para concluir a redefinicao.', 'success');
  }
})(window, document);
