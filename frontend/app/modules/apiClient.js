(function setupStayFlowApi(window) {
  function normalizeApiBaseUrl(url) {
    return String(url || '').replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }

  const API_BASE_URL = (() => {
    const configuredUrl = window.STAYFLOW_API_URL;
    if (configuredUrl) return normalizeApiBaseUrl(configuredUrl);

    const hostname = window.location.hostname;
    const isLocalHost = hostname.includes('localhost') || hostname === '127.0.0.1';

    if (isLocalHost) return 'http://localhost:3000';

    return 'https://api.stayflowapp.online';
  })();

  const API_URL = API_BASE_URL;

  function extractApiError(data, fallback) {
    if (data?.error) return data.error;
    if (data?.message) return data.message;
    if (Array.isArray(data?.errors) && data.errors.length) {
      return data.errors.map(item => item.message).join(' ');
    }
    return fallback;
  }

  function appendRequestId(message, requestId) {
    if (!requestId) return message;
    return `${message} Código de suporte: ${requestId}.`;
  }

  function friendlyApiErrorMessage(status, data, fallback, requestId) {
    if (status === 401) {
      return appendRequestId('Sua sessão expirou. Faça login novamente para continuar.', requestId);
    }

    if (status === 403) {
      return appendRequestId('Você não tem permissão para executar esta ação.', requestId);
    }

    if (status === 429) {
      return appendRequestId(extractApiError(data, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'), requestId);
    }

    if (status >= 500) {
      return appendRequestId('O servidor encontrou um erro temporário. Tente novamente em instantes.', requestId);
    }

    return appendRequestId(extractApiError(data, fallback), requestId);
  }

  async function readApiResponse(response) {
    const raw = await response.text();

    if (!raw) return {};

    try {
      return JSON.parse(raw);
    } catch (error) {
      return raw;
    }
  }

  function createApiError(response, data, fallback) {
    const requestId = data?.requestId || response.headers.get('x-request-id') || null;
    const message = friendlyApiErrorMessage(response.status, data, fallback, requestId);
    const error = new Error(message);
    error.status = response.status;
    error.requestId = requestId;
    error.response = response;
    error.data = data;
    return error;
  }

  async function parseApiResponse(response, fallback) {
    const data = await readApiResponse(response);

    if (!response.ok) {
      throw createApiError(response, data, fallback);
    }

    return data;
  }

  function isStayFlowApiRequest(input) {
    const rawUrl = typeof input === 'string' ? input : input?.url;
    if (!rawUrl) return false;

    return rawUrl.startsWith(API_BASE_URL) || rawUrl.startsWith(`${window.location.origin}/`);
  }

  function createClient({ getToken, onUnauthorized } = {}) {
    const nativeFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await nativeFetch(...args);
      const token = getToken?.();

      if (token && response.status === 401 && isStayFlowApiRequest(args[0])) {
        const requestId = response.headers.get('x-request-id') || null;
        onUnauthorized?.(appendRequestId('Sua sessão expirou. Faça login novamente para continuar.', requestId));
      }

      return response;
    };

    function authHeaders() {
      const token = getToken?.();
      return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
    }

    async function fetchApi(endpoint, options = {}) {
      const {
        auth = true,
        body,
        headers: customHeaders = {},
        errorMessage = 'Erro ao conectar com o backend.',
        ...fetchOptions
      } = options;

      const url = endpoint.startsWith('http')
        ? endpoint
        : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

      const headers = { ...customHeaders };
      let requestBody = body;
      const token = getToken?.();

      if (auth && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (requestBody !== undefined && !(requestBody instanceof FormData) && typeof requestBody !== 'string') {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        requestBody = JSON.stringify(requestBody);
      }

      const response = await window.fetch(url, {
        ...fetchOptions,
        headers,
        body: requestBody
      });

      try {
        return await parseApiResponse(response, errorMessage);
      } catch (error) {
        if (auth && error.status === 401) {
          onUnauthorized?.(error.message);
        }

        throw error;
      }
    }

    return {
      API_BASE_URL,
      API_URL,
      authHeaders,
      fetch: fetchApi
    };
  }

  window.StayFlowApi = {
    API_BASE_URL,
    API_URL,
    appendRequestId,
    createApiError,
    createClient,
    extractApiError,
    friendlyApiErrorMessage,
    isStayFlowApiRequest,
    parseApiResponse,
    readApiResponse
  };
})(window);
