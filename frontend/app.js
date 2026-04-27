(function loadStayFlowApp() {
  const scripts = [
    'app/modules/apiClient.js',
    'app/modules/uiHelpers.js',
    'app/app.js'
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
