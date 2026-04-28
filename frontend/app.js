(function loadStayFlowApp() {
  const scripts = [
    'app/modules/apiClient.js?v=20260427-1',
    'app/modules/uiHelpers.js?v=20260427-1',
    'app/app.js?v=20260427-1'
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Nao foi possivel carregar ${src}`));
      document.body.appendChild(script);
    });
  }

  scripts.reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve())
    .catch((error) => {
      const authMessage = document.getElementById('authMessage');
      if (authMessage) {
        authMessage.textContent = error.message;
        authMessage.className = 'message error';
      }
      console.error(error);
    });
})();
