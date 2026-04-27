(function setupStayFlowUi(window) {
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showMessage(targetId, text, type = 'success') {
    const target = document.getElementById(targetId);
    if (!target) return;

    const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'success';
    target.innerHTML = `<div class="message ${safeType}">${escapeHtml(text)}</div>`;
  }

  function clearMessage(targetId) {
    const target = document.getElementById(targetId);
    if (target) target.innerHTML = '';
  }

  function setButtonLoading(button, isLoading, loadingText) {
    if (!button) return;

    if (isLoading) {
      button.dataset.originalText = button.textContent;
      button.textContent = loadingText || 'Processando...';
      button.disabled = true;
      button.classList.add('is-loading');
      return;
    }

    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
    button.classList.remove('is-loading');
    delete button.dataset.originalText;
  }

  function tableStateRow(colspan, title, text, type = 'empty') {
    const safeClass = type === 'error' ? 'error' : type === 'loading' ? 'loading' : 'empty';
    return `
      <tr>
        <td colspan="${Number(colspan) || 1}">
          <div class="table-state table-state-${safeClass}">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(text)}</span>
          </div>
        </td>
      </tr>
    `;
  }

  function compactEmptyState(title, text) {
    return `<div class="empty-state panel-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
  }

  window.StayFlowUi = {
    clearMessage,
    compactEmptyState,
    escapeHtml,
    setButtonLoading,
    showMessage,
    tableStateRow
  };
})(window);
