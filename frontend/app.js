    const API_URL = 'http://localhost:3000';

    function getStoredUser() {
      const rawUser = localStorage.getItem('user');

      if (!rawUser || rawUser === 'undefined' || rawUser === 'null') {
        localStorage.removeItem('user');
        return null;
      }

      try {
        return JSON.parse(rawUser);
      } catch (error) {
        localStorage.removeItem('user');
        return null;
      }
    }

    let token = localStorage.getItem('token') || '';
    if (token === 'undefined' || token === 'null') {
      localStorage.removeItem('token');
      token = '';
    }

    let loggedUser = getStoredUser();
    let properties = [];
    let reservations = [];
    let financialEntries = [];
    let allFinancialEntries = [];
    let selectedPropertyId = null;
    let currentDate = new Date();
    let selectedCalendarDate = '';
    let editingFinancialId = null;
    let selectedReservationId = null;
    let messageAutomations = [];
    let messageLogs = [];
    let messageLogSummary = { total: 0, pending: 0, needs_contact: 0, sent: 0, failed: 0 };
    let currentMessageLogFilter = 'all';
    let editingMessageAutomationId = null;

    const authCard = document.getElementById('authCard');
    const app = document.getElementById('app');

    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const createPropertyBtn = document.getElementById('createPropertyBtn');
    const createReservationBtn = document.getElementById('createReservationBtn');
    const syncPropertyBtn = document.getElementById('syncPropertyBtn');
    const createFinancialBtn = document.getElementById('createFinancialBtn');
    const applyFinancialFiltersBtn = document.getElementById('applyFinancialFiltersBtn');
    const cancelEditFinancialBtn = document.getElementById('cancelEditFinancialBtn');

    const propertyList = document.getElementById('propertyList');
    const reservationProperty = document.getElementById('reservationProperty');
    const reservationsTableBody = document.getElementById('reservationsTableBody');
    const selectedPropertyInfo = document.getElementById('selectedPropertyInfo');
    const icalLinkBox = document.getElementById('icalLinkBox');
    const userInfo = document.getElementById('userInfo');

    const monthTitle = document.getElementById('monthTitle');
    const calendarGrid = document.getElementById('calendarGrid');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const calendarSelectedDateText = document.getElementById('calendarSelectedDateText');
    const calendarSelectedDateMeta = document.getElementById('calendarSelectedDateMeta');
    const calendarCreateReservationBtn = document.getElementById('calendarCreateReservationBtn');
    const calendarBlockDateBtn = document.getElementById('calendarBlockDateBtn');

    const financialProperty = document.getElementById('financialProperty');
    const financialReservation = document.getElementById('financialReservation');
    const financialFilterProperty = document.getElementById('financialFilterProperty');
    const dashboardChartProperty = document.getElementById('dashboardChartProperty');
    const financialTableBody = document.getElementById('financialTableBody');
    const financialFormTitle = document.getElementById('financialFormTitle');
    const financialFormCard = document.getElementById('financialFormCard');

    const messageProperty = document.getElementById('messageProperty');
    const messageTrigger = document.getElementById('messageTrigger');
    const messageOffsetDays = document.getElementById('messageOffsetDays');
    const messageSendTime = document.getElementById('messageSendTime');
    const messageTemplate = document.getElementById('messageTemplate');
    const messageStatus = document.getElementById('messageStatus');
    const saveMessageAutomationBtn = document.getElementById('saveMessageAutomationBtn');
    const cancelEditMessageAutomationBtn = document.getElementById('cancelEditMessageAutomationBtn');
    const refreshMessageLogsBtn = document.getElementById('refreshMessageLogsBtn');
    const messageAutomationTableBody = document.getElementById('messageAutomationTableBody');
    const messageLogsList = document.getElementById('messageLogsList');
    const messageLogFilters = document.getElementById('messageLogFilters');
    const messageAutomationFormTitle = document.getElementById('messageAutomationFormTitle');
    const messageAutomationFormCard = document.getElementById('messageAutomationFormCard');

    const pageTitle = document.getElementById('pageTitle');
    const selectedPropertyBadge = document.getElementById('selectedPropertyBadge');
    const navButtons = document.querySelectorAll('[data-section-btn]');
    const sectionJumpButtons = document.querySelectorAll('[data-section-jump]');

    function setActiveNav(section) {
      navButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.sectionBtn === section);
      });
    }

    function sectionTitle(section) {
      const titles = {
        dashboard: 'Dashboard',
        properties: 'Imóveis',
        reservations: 'Reservas',
        calendar: 'Calendário',
        messages: 'Automação de mensagens',
        financial: 'Financeiro'
      };
      return titles[section] || 'Painel';
    }

    function showSection(section) {
      document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
      const target = document.getElementById(`section-${section}`);
      if (target) target.classList.remove('hidden');
      if (pageTitle) pageTitle.textContent = sectionTitle(section);
      setActiveNav(section);
    }

    function updateSummaryMirrors(data) {
      const pairs = [
        ['financialSummaryIncomeMirror', data.total_income || 0],
        ['financialSummaryExpenseMirror', data.total_expense || 0],
        ['financialSummaryProfitMirror', data.profit || 0],
        ['financialSummaryPendingMirror', data.total_pending || 0]
      ];

      pairs.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = formatMoney(value);
      });
    }

    function showMessage(targetId, text, type = 'success') {
      document.getElementById(targetId).innerHTML = `<div class="message ${type}">${text}</div>`;
    }

    function clearMessage(targetId) {
      document.getElementById(targetId).innerHTML = '';
    }

    function authHeaders() {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    }

    function sourceClass(source) {
      if (source === 'manual') return 'manual';
      if (source === 'blocked' || source === 'bloqueio') return 'blocked';
      if (source === 'airbnb') return 'airbnb';
      if (source === 'booking') return 'booking';
      return 'manual';
    }

    function sourceLabel(source) {
      if (source === 'manual') return 'Manual';
      if (source === 'blocked' || source === 'bloqueio') return 'Bloqueio';
      if (source === 'airbnb') return 'Airbnb';
      if (source === 'booking') return 'Booking';
      return source || 'Reserva';
    }

    function financialStatusLabel(status) {
      if (status === 'pending') return 'Pendente';
      if (status === 'cancelled') return 'Cancelado';
      return 'Pago';
    }

    function financialStatusClass(status) {
      if (status === 'pending') return 'tag-pending';
      if (status === 'cancelled') return 'tag-neutral';
      return 'tag-paid';
    }

    function reservationStatusLabel(status) {
      if (status === 'cancelled') return 'Cancelada';
      return 'Confirmada';
    }

    function reservationStatusClass(status) {
      if (status === 'cancelled') return 'status-cancelled';
      return 'status-active';
    }

    function isFinancialEntryCancelled(entry) {
      return String(entry?.status || '').toLowerCase() === 'cancelled';
    }

    function isReservationCancelled(reservation) {
      return String(reservation?.status || '').toLowerCase() === 'cancelled';
    }

    function getFilteredFinancialEntries(entries = []) {
      return entries.filter(entry => !isFinancialEntryCancelled(entry));
    }

    function calculateFinancialSummary(entries = []) {
      const validEntries = getFilteredFinancialEntries(entries);
      const summary = { total_income: 0, total_expense: 0, total_pending: 0, profit: 0 };

      validEntries.forEach(entry => {
        const amount = Number(entry.amount || 0);
        if (entry.type === 'income') summary.total_income += amount;
        if (entry.type === 'expense') summary.total_expense += amount;
        if (entry.status === 'pending') summary.total_pending += amount;
      });

      summary.profit = summary.total_income - summary.total_expense;
      return summary;
    }

    function formatDateBR(dateStr) {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }

    function formatMoney(value) {
      return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    }

    function formatMonthLabel(monthKey) {
      const [year, month] = monthKey.split('-');
      const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      return `${names[Number(month) - 1]}/${year.slice(2)}`;
    }

    function getLastSixMonthsKeys() {
      const keys = [];
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        keys.push(key);
      }
      return keys;
    }

    function updateReservationFinanceSummary(summary = {}) {
      document.getElementById('reservationIncome').textContent = formatMoney(summary.total_income || 0);
      document.getElementById('reservationExpense').textContent = formatMoney(summary.total_expense || 0);
      document.getElementById('reservationPending').textContent = formatMoney(summary.total_pending || 0);
      document.getElementById('reservationProfit').textContent = formatMoney(summary.profit || 0);
    }

    function resetReservationFinanceCard() {
      selectedReservationId = null;
      messageAutomations = [];
      messageLogs = [];
      editingMessageAutomationId = null;
      document.getElementById('reservationFinanceInfo').innerHTML = 'Selecione uma reserva para ver o resultado financeiro.';
      updateReservationFinanceSummary();
      document.getElementById('reservationFinanceTableBody').innerHTML = '<tr><td colspan="6">Nenhum lançamento vinculado.</td></tr>';
    }

    function renderDashboardChartPropertyOptions() {
      if (!dashboardChartProperty) return;

      const currentValue = dashboardChartProperty.value;
      dashboardChartProperty.innerHTML = '<option value="">Todos os imóveis</option>';

      properties.forEach(property => {
        const option = document.createElement('option');
        option.value = property.id;
        option.textContent = property.name;
        dashboardChartProperty.appendChild(option);
      });

      if (currentValue && properties.some(property => String(property.id) === String(currentValue))) {
        dashboardChartProperty.value = currentValue;
      }
    }

    function renderMessagePropertyOptions() {
      if (!messageProperty) return;

      const currentValue = messageProperty.value;
      messageProperty.innerHTML = '';

      if (!properties.length) {
        messageProperty.innerHTML = '<option value="">Cadastre um imóvel primeiro</option>';
        return;
      }

      properties.forEach(property => {
        const option = document.createElement('option');
        option.value = property.id;
        option.textContent = property.name;
        if (currentValue && String(currentValue) === String(property.id)) {
          option.selected = true;
        }
        messageProperty.appendChild(option);
      });

      if ((!currentValue || !properties.some(property => String(property.id) === String(currentValue))) && selectedPropertyId) {
        messageProperty.value = String(selectedPropertyId);
      }
    }

    function triggerLabel(trigger) {
      const labels = {
        pre_check_in: 'Pré check-in',
        check_in: 'Check-in',
        during_stay: 'Durante a estadia',
        check_out: 'Check-out',
        post_check_out: 'Pós check-out'
      };

      return labels[trigger] || trigger || '-';
    }

    function resetMessageAutomationForm() {
      editingMessageAutomationId = null;
      if (messageAutomationFormTitle) messageAutomationFormTitle.textContent = 'Nova automação';
      if (saveMessageAutomationBtn) saveMessageAutomationBtn.textContent = 'Salvar automação';
      if (cancelEditMessageAutomationBtn) cancelEditMessageAutomationBtn.classList.add('hidden');

      renderMessagePropertyOptions();

      if (selectedPropertyId && messageProperty) {
        messageProperty.value = String(selectedPropertyId);
      }

      if (messageTrigger) messageTrigger.value = 'pre_check_in';
      if (messageOffsetDays) messageOffsetDays.value = '1';
      if (messageSendTime) messageSendTime.value = '09:00';
      if (messageTemplate) messageTemplate.value = '';
      if (messageStatus) messageStatus.value = 'active';
    }

    function updateMessageAutomationSummary() {
      const total = messageAutomations.length;
      const active = messageAutomations.filter(item => item.is_active || item.status === 'active').length;
      const inactive = total - active;

      const pairs = [
        ['messageAutomationCount', total],
        ['messageAutomationActiveCount', active],
        ['messageAutomationInactiveCount', inactive]
      ];

      pairs.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
      });
    }

    function renderMessageAutomationTable() {
      if (!messageAutomationTableBody) return;

      if (!messageAutomations.length) {
        messageAutomationTableBody.innerHTML = '<tr><td colspan="7">Nenhuma automação cadastrada</td></tr>';
        updateMessageAutomationSummary();
        return;
      }

      messageAutomationTableBody.innerHTML = messageAutomations.map(item => {
        const isActive = item.is_active || item.status === 'active';
        return `
          <tr>
            <td>${item.property_name || properties.find(property => String(property.id) === String(item.property_id))?.name || '-'}</td>
            <td>${triggerLabel(item.trigger_type || item.automation_type)}</td>
            <td>${item.offset_days ?? item.days_offset ?? 0}</td>
            <td>${item.send_time || '-'}</td>
            <td><span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'Ativa' : 'Inativa'}</span></td>
            <td><div style="max-width: 320px; white-space: pre-wrap;">${item.template_text || item.message_template || '-'}</div></td>
            <td>
              <div class="actions-inline">
                <button type="button" data-action="edit-message-automation" data-id="${item.id}">Editar</button>
                <button type="button" data-action="toggle-message-automation" data-id="${item.id}">${isActive ? 'Desativar' : 'Ativar'}</button>
                <button type="button" class="btn-danger" data-action="delete-message-automation" data-id="${item.id}">Excluir</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      updateMessageAutomationSummary();
    }

    function messageLogStatusLabel(status) {
      const labels = {
        pending: 'Pendente',
        needs_contact: 'Sem contato',
        sent: 'Enviado',
        failed: 'Falhou',
        processed: 'Processado',
        queued: 'Na fila'
      };

      return labels[status] || status || '-';
    }

    function messageLogStatusClass(status) {
      if (status === 'sent') return 'status-active';
      if (status === 'pending' || status === 'queued') return 'tag-pending';
      if (status === 'needs_contact') return 'tag-neutral';
      if (status === 'failed') return 'status-inactive';
      return 'status-cancelled';
    }

    function formatDateTimeBR(dateTime) {
      if (!dateTime) return '-';
      const [datePart, timePart = ''] = String(dateTime).split(' ');
      return `${formatDateBR(datePart)} ${timePart.slice(0, 5)}`.trim();
    }

    function updateMessageLogSummary() {
      const summary = {
        total: Number(messageLogSummary.total || 0),
        pending: Number(messageLogSummary.pending || 0),
        needs_contact: Number(messageLogSummary.needs_contact || 0),
        sent: Number(messageLogSummary.sent || 0),
        failed: Number(messageLogSummary.failed || 0)
      };

      const pairs = [
        ['messageLogTotalCount', summary.total],
        ['messageLogPendingCount', summary.pending],
        ['messageLogNeedsContactCount', summary.needs_contact],
        ['messageLogSentCount', summary.sent],
        ['messageLogFailedCount', summary.failed]
      ];

      pairs.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
      });
    }

    function updateMessageLogFilterButtons() {
      if (!messageLogFilters) return;

      messageLogFilters.querySelectorAll('[data-log-filter]').forEach(button => {
        button.classList.toggle('active-filter', button.dataset.logFilter === currentMessageLogFilter);
      });
    }

    function renderMessageLogs() {
      if (!messageLogsList) return;

      if (!messageLogs.length) {
        messageLogsList.innerHTML = '<div class="small">Nenhum log de mensagem encontrado para esse filtro.</div>';
        return;
      }

      messageLogsList.innerHTML = messageLogs.map(log => `
        <div class="log-item">
          <div class="log-top">
            <strong>${log.property_name || '-'} · ${log.guest_name || 'Hóspede'}</strong>
            <span class="status-badge ${messageLogStatusClass(log.status)}">${messageLogStatusLabel(log.status)}</span>
          </div>
          <div class="small">${log.automation_name || 'Automação'} · ${log.channel || 'Canal não informado'}</div>
          <div class="log-meta-grid">
            <div class="log-meta-box"><strong>Contato</strong><br>${log.guest_contact || '-'}</div>
            <div class="log-meta-box"><strong>Agendado</strong><br>${formatDateTimeBR(log.scheduled_for)}</div>
            <div class="log-meta-box"><strong>Processado</strong><br>${formatDateTimeBR(log.processed_at)}</div>
            <div class="log-meta-box"><strong>Erro</strong><br>${log.error_message || '-'}</div>
          </div>
          <div class="template-preview">${log.body_rendered || log.message_text || log.content || 'Sem conteúdo registrado.'}</div>
        </div>
      `).join('');
    }

    async function loadMessageLogSummary() {
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/message-logs/summary`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          messageLogSummary = { total: 0, pending: 0, needs_contact: 0, sent: 0, failed: 0 };
          updateMessageLogSummary();
          return;
        }

        messageLogSummary = data.summary || { total: 0, pending: 0, needs_contact: 0, sent: 0, failed: 0 };
        updateMessageLogSummary();
      } catch (error) {
        messageLogSummary = { total: 0, pending: 0, needs_contact: 0, sent: 0, failed: 0 };
        updateMessageLogSummary();
      }
    }

    async function loadMessageLogs(filter = currentMessageLogFilter || 'all') {
      if (!token) return;

      currentMessageLogFilter = filter;
      updateMessageLogFilterButtons();

      let endpoint = `${API_URL}/message-logs`;
      if (filter === 'pending') endpoint = `${API_URL}/message-logs/pending`;
      if (filter === 'failed') endpoint = `${API_URL}/message-logs/failed`;
      if (filter === 'needs_contact') endpoint = `${API_URL}/message-logs/needs-contact`;

      try {
        const response = await fetch(endpoint, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          messageLogs = [];
          renderMessageLogs();
          return;
        }

        if (filter === 'all') {
          messageLogs = Array.isArray(data) ? data.slice(0, 20) : [];
        } else if (filter === 'sent') {
          const allLogsResponse = await fetch(`${API_URL}/message-logs`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const allLogsData = await allLogsResponse.json();
          const allLogs = Array.isArray(allLogsData) ? allLogsData : [];
          messageLogs = allLogs.filter(item => item.status === 'sent').slice(0, 20);
        } else {
          messageLogs = Array.isArray(data.logs) ? data.logs.slice(0, 20) : [];
        }

        renderMessageLogs();
        await loadMessageLogSummary();
      } catch (error) {
        messageLogs = [];
        renderMessageLogs();
      }
    }

    async function loadMessageAutomations() {
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/message-automations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          messageAutomations = [];
          renderMessageAutomationTable();
          return;
        }

        messageAutomations = Array.isArray(data) ? data : [];
        renderMessageAutomationTable();
      } catch (error) {
        messageAutomations = [];
        renderMessageAutomationTable();
      }
    }

    async function loadMessageLogs() {
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/message-logs`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          messageLogs = [];
          renderMessageLogs();
          return;
        }

        messageLogs = Array.isArray(data) ? data.slice(0, 10) : [];
        renderMessageLogs();
      } catch (error) {
        messageLogs = [];
        renderMessageLogs();
      }
    }

    function editMessageAutomation(id) {
      const item = messageAutomations.find(automation => Number(automation.id) === Number(id));
      if (!item) {
        showMessage('messageAutomationMessage', 'Não foi possível localizar essa automação.', 'error');
        return;
      }

      editingMessageAutomationId = Number(item.id);
      if (messageAutomationFormTitle) messageAutomationFormTitle.textContent = 'Editar automação';
      if (saveMessageAutomationBtn) saveMessageAutomationBtn.textContent = 'Salvar alteração';
      if (cancelEditMessageAutomationBtn) cancelEditMessageAutomationBtn.classList.remove('hidden');

      renderMessagePropertyOptions();
      if (messageProperty) messageProperty.value = String(item.property_id || '');
      if (messageTrigger) messageTrigger.value = item.trigger_type || item.automation_type || 'pre_check_in';
      if (messageOffsetDays) messageOffsetDays.value = String(item.offset_days ?? item.days_offset ?? 0);
      if (messageSendTime) messageSendTime.value = item.send_time || '09:00';
      if (messageTemplate) messageTemplate.value = item.template_text || item.message_template || '';
      if (messageStatus) messageStatus.value = (item.is_active || item.status === 'active') ? 'active' : 'inactive';

      clearMessage('messageAutomationMessage');
      showSection('messages');
      if (messageAutomationFormCard) messageAutomationFormCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function saveMessageAutomation() {
      clearMessage('messageAutomationMessage');

      try {
        const body = {
          property_id: messageProperty?.value || null,
          trigger_type: messageTrigger?.value || 'pre_check_in',
          offset_days: Number(messageOffsetDays?.value || 0),
          send_time: messageSendTime?.value || '09:00',
          template_text: messageTemplate?.value?.trim() || '',
          is_active: (messageStatus?.value || 'active') === 'active'
        };

        let url = `${API_URL}/message-automations`;
        let method = 'POST';

        if (editingMessageAutomationId) {
          url = `${API_URL}/message-automations/${editingMessageAutomationId}`;
          method = 'PUT';
        }

        const response = await fetch(url, {
          method,
          headers: authHeaders(),
          body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
          showMessage('messageAutomationMessage', data.error || 'Erro ao salvar automação.', 'error');
          return;
        }

        showMessage('messageAutomationMessage', editingMessageAutomationId ? 'Automação atualizada com sucesso.' : 'Automação criada com sucesso.', 'success');
        resetMessageAutomationForm();
        await loadMessageAutomations();
        await loadMessageLogs();
      } catch (error) {
        showMessage('messageAutomationMessage', 'Erro ao conectar com o backend.', 'error');
      }
    }

    async function toggleMessageAutomation(id) {
      const item = messageAutomations.find(automation => Number(automation.id) === Number(id));
      if (!item) return;

      try {
        const response = await fetch(`${API_URL}/message-automations/${id}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            property_id: item.property_id,
            trigger_type: item.trigger_type || item.automation_type,
            offset_days: item.offset_days ?? item.days_offset ?? 0,
            send_time: item.send_time || '09:00',
            template_text: item.template_text || item.message_template || '',
            is_active: !(item.is_active || item.status === 'active')
          })
        });

        const data = await response.json();

        if (!response.ok) {
          showMessage('messageAutomationMessage', data.error || 'Erro ao alterar status da automação.', 'error');
          return;
        }

        await loadMessageAutomations();
      } catch (error) {
        showMessage('messageAutomationMessage', 'Erro ao conectar com o backend.', 'error');
      }
    }

    async function deleteMessageAutomation(id) {
      const confirmed = confirm('Deseja realmente excluir esta automação?');
      if (!confirmed) return;

      try {
        const response = await fetch(`${API_URL}/message-automations/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          showMessage('messageAutomationMessage', data.error || 'Erro ao excluir automação.', 'error');
          return;
        }

        if (editingMessageAutomationId === Number(id)) {
          resetMessageAutomationForm();
        }

        await loadMessageAutomations();
        await loadMessageLogs();
      } catch (error) {
        showMessage('messageAutomationMessage', 'Erro ao conectar com o backend.', 'error');
      }
    }

    function resetFinancialForm() {
      editingFinancialId = null;
      financialFormTitle.textContent = 'Novo lançamento financeiro';
      createFinancialBtn.textContent = 'Criar lançamento';
      cancelEditFinancialBtn.classList.add('hidden');

      if (selectedPropertyId) {
        financialProperty.value = String(selectedPropertyId);
      }

      renderFinancialReservationOptions();
      renderDashboardChartPropertyOptions();

      document.getElementById('financialType').value = 'income';
      document.getElementById('financialCategory').value = '';
      document.getElementById('financialDescription').value = '';
      document.getElementById('financialAmount').value = '';
      document.getElementById('financialDate').value = new Date().toISOString().split('T')[0];
      document.getElementById('financialStatus').value = 'paid';
      document.getElementById('financialSource').value = '';
    }

    function renderFinancialReservationOptions(selectedValue = '') {
      const propertyId = Number(financialProperty.value || selectedPropertyId || 0);
      const propertyReservations = reservations
        .filter(item => Number(item.property_id) === propertyId && item.source !== 'blocked' && !isReservationCancelled(item))
        .sort((a, b) => (a.start_date > b.start_date ? 1 : -1));

      financialReservation.innerHTML = '<option value="">Sem vincular a reserva</option>';

      propertyReservations.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `#${item.id} - ${item.guest_name || 'Sem nome'} (${formatDateBR(item.start_date)} a ${formatDateBR(item.end_date)})`;
        if (String(selectedValue) === String(item.id)) {
          option.selected = true;
        }
        financialReservation.appendChild(option);
      });
    }

    function buildLineChartSvg(monthKeys, monthsMap) {
      const width = 760;
      const height = 280;
      const paddingTop = 20;
      const paddingRight = 24;
      const paddingBottom = 42;
      const paddingLeft = 52;

      const values = monthKeys.flatMap(key => [
        monthsMap[key].income,
        monthsMap[key].expense,
        monthsMap[key].profit
      ]);

      const maxValue = Math.max(1, ...values);

      const plotWidth = width - paddingLeft - paddingRight;
      const plotHeight = height - paddingTop - paddingBottom;
      const stepX = monthKeys.length > 1 ? plotWidth / (monthKeys.length - 1) : plotWidth;

      function getX(index) {
        return paddingLeft + (stepX * index);
      }

      function getY(value) {
        return paddingTop + plotHeight - ((value / maxValue) * plotHeight);
      }

      function buildPath(seriesName) {
        return monthKeys.map((key, index) => {
          const x = getX(index);
          const y = getY(monthsMap[key][seriesName]);
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
      }

      const incomePath = buildPath('income');
      const expensePath = buildPath('expense');
      const profitPath = buildPath('profit');

      const yTicks = 4;
      const gridLines = [];
      const yLabels = [];

      for (let i = 0; i <= yTicks; i++) {
        const value = (maxValue / yTicks) * i;
        const y = getY(value);
        gridLines.push(`<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`);
        yLabels.push(`
          <text x="${paddingLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">
            ${Math.round(value).toLocaleString('pt-BR')}
          </text>
        `);
      }

      const xLabels = monthKeys.map((key, index) => `
        <text x="${getX(index)}" y="${height - 14}" text-anchor="middle" font-size="11" fill="#6b7280">
          ${formatMonthLabel(key)}
        </text>
      `).join('');

      const pointCircles = monthKeys.map((key, index) => {
        const x = getX(index);
        const incomeY = getY(monthsMap[key].income);
        const expenseY = getY(monthsMap[key].expense);
        const profitY = getY(monthsMap[key].profit);

        return `
          <circle cx="${x}" cy="${incomeY}" r="4" fill="#059669"></circle>
          <circle cx="${x}" cy="${expenseY}" r="4" fill="#dc2626"></circle>
          <circle cx="${x}" cy="${profitY}" r="4" fill="#2563eb"></circle>
        `;
      }).join('');

      return `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gráfico financeiro em linhas">
          <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"></rect>
          ${gridLines.join('')}
          ${yLabels.join('')}
          <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="#9ca3af" stroke-width="1.2"></line>
          <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="#9ca3af" stroke-width="1.2"></line>

          <path d="${incomePath}" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="${expensePath}" fill="none" stroke="#dc2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="${profitPath}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>

          ${pointCircles}
          ${xLabels}
        </svg>
      `;
    }

    function renderMonthlyChart() {
      const container = document.getElementById('lineChartContainer');
      if (!container) return;

      const selectedChartPropertyId = Number(dashboardChartProperty?.value || 0);
      const entries = selectedChartPropertyId
        ? allFinancialEntries.filter(entry => Number(entry.property_id) === selectedChartPropertyId)
        : allFinancialEntries;

      if (!entries.length) {
        container.innerHTML = '<div class="chart-empty">Sem dados suficientes para montar o gráfico.</div>';
        return;
      }

      const monthKeys = getLastSixMonthsKeys();
      const monthsMap = {};

      monthKeys.forEach(key => {
        monthsMap[key] = { income: 0, expense: 0, profit: 0 };
      });

      entries.forEach(entry => {
        if (!entry.entry_date) return;
        const key = entry.entry_date.slice(0, 7);
        if (!monthsMap[key]) return;

        const amount = Number(entry.amount || 0);

        if (entry.type === 'income') {
          monthsMap[key].income += amount;
        } else if (entry.type === 'expense') {
          monthsMap[key].expense += amount;
        }
      });

      monthKeys.forEach(key => {
        monthsMap[key].profit = monthsMap[key].income - monthsMap[key].expense;
      });

      const hasData = monthKeys.some(key =>
        monthsMap[key].income !== 0 || monthsMap[key].expense !== 0 || monthsMap[key].profit !== 0
      );

      if (!hasData) {
        container.innerHTML = '<div class="chart-empty">Não há lançamentos suficientes para o imóvel selecionado.</div>';
        return;
      }

      container.innerHTML = buildLineChartSvg(monthKeys, monthsMap);
    }


    function getPropertyChartColors(count) {
      const palette = [
        '#2563eb', '#059669', '#dc2626', '#d97706', '#7c3aed',
        '#0f766e', '#db2777', '#4f46e5', '#0891b2', '#65a30d'
      ];

      return Array.from({ length: count }, (_, index) => palette[index % palette.length]);
    }

    function buildPropertyProfitChartSvg(monthKeys, seriesList) {
      const width = 760;
      const height = 320;
      const paddingTop = 20;
      const paddingRight = 24;
      const paddingBottom = 42;
      const paddingLeft = 60;

      const values = seriesList.flatMap(series => monthKeys.map(key => series.months[key] || 0));
      const minValue = Math.min(0, ...values);
      const maxValue = Math.max(0, ...values);
      const range = Math.max(1, maxValue - minValue);

      const plotWidth = width - paddingLeft - paddingRight;
      const plotHeight = height - paddingTop - paddingBottom;
      const stepX = monthKeys.length > 1 ? plotWidth / (monthKeys.length - 1) : plotWidth;

      function getX(index) {
        return paddingLeft + (stepX * index);
      }

      function getY(value) {
        return paddingTop + plotHeight - (((value - minValue) / range) * plotHeight);
      }

      function buildPath(series) {
        return monthKeys.map((key, index) => {
          const x = getX(index);
          const y = getY(series.months[key] || 0);
          return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
      }

      const yTicks = 4;
      const gridLines = [];
      const yLabels = [];

      for (let i = 0; i <= yTicks; i++) {
        const value = minValue + ((range / yTicks) * i);
        const y = getY(value);
        gridLines.push(`<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`);
        yLabels.push(`
          <text x="${paddingLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#6b7280">
            ${Math.round(value).toLocaleString('pt-BR')}
          </text>
        `);
      }

      const zeroY = getY(0);
      const xLabels = monthKeys.map((key, index) => `
        <text x="${getX(index)}" y="${height - 14}" text-anchor="middle" font-size="11" fill="#6b7280">
          ${formatMonthLabel(key)}
        </text>
      `).join('');

      const paths = seriesList.map(series => `
        <path d="${buildPath(series)}" fill="none" stroke="${series.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      `).join('');

      const points = seriesList.map(series => {
        return monthKeys.map((key, index) => {
          const x = getX(index);
          const y = getY(series.months[key] || 0);
          return `<circle cx="${x}" cy="${y}" r="3.5" fill="${series.color}"></circle>`;
        }).join('');
      }).join('');

      return `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gráfico de lucro ou prejuízo por imóvel">
          <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"></rect>
          ${gridLines.join('')}
          ${yLabels.join('')}
          <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="#9ca3af" stroke-width="1.2"></line>
          <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="#9ca3af" stroke-width="1.2"></line>
          <line x1="${paddingLeft}" y1="${zeroY}" x2="${width - paddingRight}" y2="${zeroY}" stroke="#9ca3af" stroke-width="1.2" stroke-dasharray="4 4"></line>
          ${paths}
          ${points}
          ${xLabels}
        </svg>
      `;
    }

    function renderPropertyProfitChart() {
      const chartContainer = document.getElementById('propertyProfitChartContainer');
      const legendContainer = document.getElementById('propertyProfitLegend');

      if (!chartContainer || !legendContainer) return;

      if (!allFinancialEntries.length || !properties.length) {
        chartContainer.innerHTML = '<div class="chart-empty">Sem dados suficientes para montar o gráfico.</div>';
        legendContainer.innerHTML = '<div class="small">Cadastre imóveis e lançamentos para visualizar este gráfico.</div>';
        return;
      }

      const monthKeys = getLastSixMonthsKeys();
      const activeProperties = properties
        .map(property => ({
          id: property.id,
          name: property.name,
          months: Object.fromEntries(monthKeys.map(key => [key, 0]))
        }));

      const seriesMap = Object.fromEntries(activeProperties.map(item => [item.id, item]));

      allFinancialEntries.forEach(entry => {
        const series = seriesMap[entry.property_id];
        if (!series || !entry.entry_date) return;

        const key = entry.entry_date.slice(0, 7);
        if (!series.months.hasOwnProperty(key)) return;

        const amount = Number(entry.amount || 0);
        if (entry.type === 'income') {
          series.months[key] += amount;
        } else if (entry.type === 'expense') {
          series.months[key] -= amount;
        }
      });

      const seriesList = activeProperties
        .map(item => ({
          ...item,
          total: monthKeys.reduce((sum, key) => sum + Number(item.months[key] || 0), 0)
        }))
        .filter(item => monthKeys.some(key => Number(item.months[key] || 0) !== 0))
        .sort((a, b) => b.total - a.total);

      if (!seriesList.length) {
        chartContainer.innerHTML = '<div class="chart-empty">Sem dados suficientes para montar o gráfico.</div>';
        legendContainer.innerHTML = '<div class="small">Cadastre imóveis e lançamentos para visualizar este gráfico.</div>';
        return;
      }

      const colors = getPropertyChartColors(seriesList.length);
      seriesList.forEach((series, index) => {
        series.color = colors[index];
      });

      chartContainer.innerHTML = buildPropertyProfitChartSvg(monthKeys, seriesList);
      legendContainer.innerHTML = seriesList.map(series => `
        <div class="property-lines-legend-item">
          <div class="property-lines-legend-left">
            <span class="property-lines-dot" style="background:${series.color};"></span>
            <span class="property-lines-name">${series.name}</span>
          </div>
          <div class="property-lines-value ${series.total >= 0 ? 'income-value' : 'expense-value'}">${formatMoney(series.total)}</div>
        </div>
      `).join('');
    }

    function renderPropertyRanking() {
      const container = document.getElementById('propertyRankingContent');

      if (!allFinancialEntries.length || !properties.length) {
        container.innerHTML = '<div class="small">Sem dados suficientes para montar o ranking.</div>';
        return;
      }

      const propertyMap = {};

      properties.forEach(property => {
        propertyMap[property.id] = {
          property_id: property.id,
          property_name: property.name,
          income: 0,
          expense: 0,
          profit: 0
        };
      });

      allFinancialEntries.forEach(entry => {
        const item = propertyMap[entry.property_id];
        if (!item) return;

        const amount = Number(entry.amount || 0);

        if (entry.type === 'income') {
          item.income += amount;
        } else if (entry.type === 'expense') {
          item.expense += amount;
        }
      });

      const ranking = Object.values(propertyMap)
        .map(item => ({
          ...item,
          profit: item.income - item.expense
        }))
        .filter(item => item.income > 0 || item.expense > 0)
        .sort((a, b) => b.profit - a.profit);

      if (!ranking.length) {
        container.innerHTML = '<div class="small">Sem dados suficientes para montar o ranking.</div>';
        return;
      }

      container.innerHTML = ranking.map((item, index) => `
        <div class="ranking-item">
          <div class="ranking-top">
            <div class="ranking-name">${index + 1}. ${item.property_name}</div>
            <div class="${item.profit >= 0 ? 'income-value' : 'expense-value'}">${formatMoney(item.profit)}</div>
          </div>
          <div class="ranking-meta">
            <span>Receitas: <strong>${formatMoney(item.income)}</strong></span>
            <span>Despesas: <strong>${formatMoney(item.expense)}</strong></span>
          </div>
        </div>
      `).join('');
    }

    async function loadFinancialDashboard() {
      try {
        const response = await fetch(`${API_URL}/financial`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          allFinancialEntries = [];
          renderMonthlyChart();
          renderPropertyProfitChart();
          renderPropertyRanking();
          return;
        }

        allFinancialEntries = getFilteredFinancialEntries(Array.isArray(data) ? data : []);
        renderMonthlyChart();
        renderPropertyProfitChart();
        renderPropertyRanking();
      } catch (error) {
        allFinancialEntries = [];
        renderMonthlyChart();
        renderPropertyProfitChart();
        renderPropertyRanking();
      }
    }

    async function registerUser() {
      clearMessage('authMessage');

      const name = document.getElementById('registerName').value.trim();
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value.trim();

      try {
        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
          showMessage('authMessage', data.error || data.message || 'Erro ao cadastrar usuário', 'error');
          return;
        }

        showMessage('authMessage', 'Usuário cadastrado com sucesso. Agora faça login.', 'success');
      } catch (error) {
        showMessage('authMessage', 'Erro ao conectar com o backend.', 'error');
      }
    }

    async function login() {
      clearMessage('authMessage');

      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();

      try {
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
          showMessage('authMessage', data.error || data.message || 'Erro no login', 'error');
          return;
        }

        token = data?.data?.token || data.token || '';
        loggedUser = data?.data?.user || data.user || null;

        if (!token || !loggedUser) {
          showMessage('authMessage', 'Resposta de login inválida do backend.', 'error');
          return;
        }

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(loggedUser));

        enterApp();
        await loadProperties();
      } catch (error) {
        showMessage('authMessage', 'Erro ao conectar com o backend.', 'error');
      }
    }

    function logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      token = '';
      loggedUser = null;
      properties = [];
      reservations = [];
      financialEntries = [];
      allFinancialEntries = [];
      selectedPropertyId = null;
      editingFinancialId = null;
      selectedReservationId = null;
      selectedCalendarDate = '';
      messageAutomations = [];
      messageLogs = [];
      editingMessageAutomationId = null;

      authCard.classList.remove('hidden');
      app.classList.add('hidden');
      showSection('dashboard');
    }

    function enterApp() {
      authCard.classList.add('hidden');
      app.classList.remove('hidden');
      userInfo.textContent = loggedUser
        ? `Logado como ${loggedUser.name} (${loggedUser.email})`
        : 'Usuário logado';
      showSection('dashboard');
    }

    async function loadProperties() {
      clearMessage('propertyMessage');
      clearMessage('syncMessage');

      try {
        const response = await fetch(`${API_URL}/properties`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'Erro ao carregar imóveis');
          return;
        }

        properties = data;
        renderPropertyList();
        renderPropertySelects();
        renderMessagePropertyOptions();

        if (properties.length > 0) {
          if (!selectedPropertyId) {
            selectedPropertyId = properties[0].id;
          }

          renderPropertySelects();
          resetFinancialForm();
          await loadReservations();
          await loadFinancialSummary();
          await loadFinancialEntries();
          await loadFinancialDashboard();
          await loadMessageAutomations();
          await loadMessageLogSummary();
          await loadMessageLogs();
        } else {
          selectedPropertyId = null;
          selectedPropertyInfo.innerHTML = 'Nenhum imóvel cadastrado.';
          icalLinkBox.innerHTML = 'Link do iCal aparecerá aqui';
          reservationsTableBody.innerHTML = '<tr><td colspan="8">Nenhuma reserva carregada</td></tr>';
          financialTableBody.innerHTML = '<tr><td colspan="10">Nenhum lançamento financeiro</td></tr>';
          calendarGrid.innerHTML = '';
          updateSummaryCards({ total_income: 0, total_expense: 0, total_pending: 0, profit: 0 });
          updateSummaryMirrors({ total_income: 0, total_expense: 0, total_pending: 0, profit: 0 });
          resetReservationFinanceCard();
          renderMonthlyChart();
          renderPropertyProfitChart();
          renderPropertyRanking();
          messageAutomations = [];
          messageLogs = [];
          messageLogSummary = { total: 0, pending: 0, needs_contact: 0, sent: 0, failed: 0 };
          renderMessageAutomationTable();
          updateMessageLogSummary();
          renderMessageLogs();
        }
      } catch (error) {
        alert('Erro ao carregar imóveis');
      }
    }

   function platformLabel(value) {
  const labels = {
    airbnb: 'Airbnb',
    booking: 'Booking',
    vrbo: 'Vrbo',
    olx: 'OLX',
    other: 'Outro'
  };

  return labels[value] || value || 'Não identificado';
}

function renderPropertyList() {
  propertyList.innerHTML = '';

  if (properties.length === 0) {
    propertyList.innerHTML = '<div class="small">Nenhum imóvel cadastrado.</div>';
    return;
  }

  properties.forEach(property => {
    const div = document.createElement('div');
    div.className = `property-item ${Number(selectedPropertyId) === Number(property.id) ? 'active' : ''}`;

    const cityState = [property.city, property.state].filter(Boolean).join(' - ');
    const listingPlatform = platformLabel(property.listing_platform);
    const listingCode = property.listing_code ? `Código: ${property.listing_code}` : 'Código não identificado';
    const listingUrl = property.listing_url || 'Link do anúncio não informado';

    div.innerHTML = `
      <div class="property-title">${property.name}</div>
      <div class="small">${cityState || ''}</div>
      <div class="small">${property.address || ''}</div>
      <div class="small"><strong>Plataforma:</strong> ${listingPlatform}</div>
      <div class="small"><strong>${listingCode}</strong></div>
      <div class="small" style="word-break: break-all;"><strong>Anúncio:</strong> ${listingUrl}</div>
    `;

    div.addEventListener('click', async () => {
      selectedPropertyId = property.id;

      selectedPropertyInfo.innerHTML = `
        <div><strong>${property.name}</strong></div>
        <div>${cityState || 'Cidade não informada'}</div>
        <div>${property.address || 'Endereço não informado'}</div>
        <div><strong>Plataforma:</strong> ${listingPlatform}</div>
        <div><strong>${listingCode}</strong></div>
        <div style="word-break: break-all;"><strong>Anúncio:</strong> ${listingUrl}</div>
      `;

      renderPropertyList();
      renderPropertySelects();
      renderMessagePropertyOptions();
      resetFinancialForm();
      resetReservationFinanceCard();
      await loadReservations();
      await loadFinancialSummary();
      await loadFinancialEntries();
    });

    propertyList.appendChild(div);
  });
}

    function renderPropertySelects() {
      reservationProperty.innerHTML = '';
      financialProperty.innerHTML = '';
      financialFilterProperty.innerHTML = '<option value="">Todos os imóveis</option>';

      if (properties.length === 0) {
        reservationProperty.innerHTML = '<option value="">Cadastre um imóvel primeiro</option>';
        financialProperty.innerHTML = '<option value="">Cadastre um imóvel primeiro</option>';
        financialReservation.innerHTML = '<option value="">Sem vincular a reserva</option>';
        return;
      }

      properties.forEach(property => {
        const optionReservation = document.createElement('option');
        optionReservation.value = property.id;
        optionReservation.textContent = property.name;
        if (Number(selectedPropertyId) === Number(property.id)) {
          optionReservation.selected = true;
        }
        reservationProperty.appendChild(optionReservation);

        const optionFinancial = document.createElement('option');
        optionFinancial.value = property.id;
        optionFinancial.textContent = property.name;
        if (Number(selectedPropertyId) === Number(property.id)) {
          optionFinancial.selected = true;
        }
        financialProperty.appendChild(optionFinancial);

        const optionFilter = document.createElement('option');
        optionFilter.value = property.id;
        optionFilter.textContent = property.name;
        financialFilterProperty.appendChild(optionFilter);
      });

      if (selectedPropertyId) {
        financialFilterProperty.value = String(selectedPropertyId);
      }

      renderFinancialReservationOptions();
    }

   async function createProperty() {
  clearMessage('propertyMessage');

  const body = {
    name: document.getElementById('propertyName').value.trim(),
    description: document.getElementById('propertyDescription').value.trim(),
    address: document.getElementById('propertyAddress').value.trim(),
    city: document.getElementById('propertyCity').value.trim(),
    state: document.getElementById('propertyState').value.trim(),
    country: document.getElementById('propertyCountry').value.trim(),
    listing_url: document.getElementById('propertyListingUrl').value.trim(),
    airbnb_ical_url: document.getElementById('propertyAirbnbIcal').value.trim(),
    booking_ical_url: document.getElementById('propertyBookingIcal').value.trim()
  };

  if (!body.name || !body.city || !body.listing_url) {
    showMessage('propertyMessage', 'Nome, cidade e link do anúncio são obrigatórios.', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/properties`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage('propertyMessage', data.error || data.details || 'Erro ao cadastrar imóvel', 'error');
      return;
    }

    showMessage('propertyMessage', 'Imóvel cadastrado com sucesso.', 'success');

    document.getElementById('propertyName').value = '';
    document.getElementById('propertyDescription').value = '';
    document.getElementById('propertyAddress').value = '';
    document.getElementById('propertyCity').value = '';
    document.getElementById('propertyState').value = '';
    document.getElementById('propertyCountry').value = 'Brasil';
    document.getElementById('propertyListingUrl').value = '';
    document.getElementById('propertyAirbnbIcal').value = '';
    document.getElementById('propertyBookingIcal').value = '';

    await loadProperties();
  } catch (error) {
    showMessage('propertyMessage', 'Erro ao conectar com o backend.', 'error');
  }
}

    async function createReservation() {
      clearMessage('reservationMessage');

      const property_id = reservationProperty.value;
      const guest_name = document.getElementById('guestName').value.trim();
      const guest_email = document.getElementById('guestEmail').value.trim();
      const guest_phone = document.getElementById('guestPhone').value.trim();
      const start_date = document.getElementById('reservationStartDate').value;
      const end_date = document.getElementById('reservationEndDate').value;
      const total_amount = document.getElementById('reservationTotalAmount').value;
      const notes = document.getElementById('reservationNotes').value.trim();
      const type = document.getElementById('reservationType').value;

      try {
        const response = await fetch(`${API_URL}/reservations`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            property_id,
            guest_name,
            guest_email,
            guest_phone,
            start_date,
            end_date,
            total_amount,
            notes,
            type
          })
        });

        const data = await response.json();

        if (!response.ok) {
          showMessage('reservationMessage', data.error || 'Erro ao criar reserva', 'error');
          return;
        }

        showMessage('reservationMessage', 'Reserva/bloqueio criado com sucesso.', 'success');

        document.getElementById('guestName').value = '';
        document.getElementById('guestEmail').value = '';
        document.getElementById('guestPhone').value = '';
        document.getElementById('reservationStartDate').value = '';
        document.getElementById('reservationEndDate').value = '';
        document.getElementById('reservationTotalAmount').value = '';
        document.getElementById('reservationNotes').value = '';
        document.getElementById('reservationType').value = 'manual';

        selectedPropertyId = Number(property_id);
        renderPropertyList();
        renderPropertySelects();
        resetFinancialForm();
        resetReservationFinanceCard();
        await loadReservations();
        await loadFinancialSummary();
        await loadFinancialEntries();
        await loadFinancialDashboard();
      } catch (error) {
        showMessage('reservationMessage', 'Erro ao conectar com o backend.', 'error');
      }
    }

    async function loadReservations() {
      try {
        const response = await fetch(`${API_URL}/reservations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'Erro ao carregar reservas');
          return;
        }

        reservations = data.filter(item => Number(item.property_id) === Number(selectedPropertyId));

        renderSelectedPropertyInfo();
        renderReservationsTable();
        renderCalendar();
        renderFinancialReservationOptions(financialReservation.value);
      } catch (error) {
        alert('Erro ao carregar reservas');
      }
    }

    function renderSelectedPropertyInfo() {
      const property = properties.find(p => Number(p.id) === Number(selectedPropertyId));

      if (!property) {
        selectedPropertyInfo.innerHTML = 'Nenhum imóvel selecionado.';
        if (selectedPropertyBadge) selectedPropertyBadge.textContent = 'Nenhum imóvel selecionado';
        icalLinkBox.innerHTML = 'Link do iCal aparecerá aqui';
        return;
      }

      selectedPropertyInfo.innerHTML = `
        <strong>${property.name}</strong><br>
        ${property.city || ''} ${property.state ? '- ' + property.state : ''}<br>
        ${property.address || ''}<br>
        Reservas/bloqueios: <strong>${reservations.length}</strong>
      `;

      if (selectedPropertyBadge) {
        selectedPropertyBadge.textContent = `Imóvel: ${property.name}`;
      }

      icalLinkBox.innerHTML = property.internal_ical_url
        ? `<a href="${property.internal_ical_url}" target="_blank">${property.internal_ical_url}</a>`
        : 'iCal não disponível';
    }

    function renderReservationsTable() {
      if (!reservations.length) {
        reservationsTableBody.innerHTML = '<tr><td colspan="8">Nenhuma reserva para este imóvel</td></tr>';
        return;
      }

      reservationsTableBody.innerHTML = reservations.map(item => `
        <tr class="${item.source !== 'blocked' ? 'reservation-row-clickable' : ''} ${Number(selectedReservationId) === Number(item.id) ? 'active-row' : ''} ${isReservationCancelled(item) ? 'reservation-row-cancelled' : ''}" data-id="${item.id}">
          <td>${item.id}</td>
          <td>${item.guest_name || '-'}</td>
          <td>${sourceLabel(item.source)}</td>
          <td>${formatDateBR(item.start_date)}</td>
          <td>${formatDateBR(item.end_date)}</td>
          <td>${item.total_amount !== null && item.total_amount !== undefined ? formatMoney(item.total_amount) : '-'}</td>
          <td><span class="status-badge ${reservationStatusClass(item.status)}">${reservationStatusLabel(item.status)}</span></td>
          <td>
            ${item.source !== 'blocked'
              ? `<button type="button" data-action="view-reservation-finance" data-id="${item.id}">Ver lucro</button>`
              : '-'}
          </td>
        </tr>
      `).join('');
    }

    function highlightSelectedReservationRow() {
      document.querySelectorAll('#reservationsTableBody tr[data-id]').forEach(row => {
        row.classList.toggle('active-row', Number(row.dataset.id) === Number(selectedReservationId));
      });
    }

    async function openReservationFinance(reservationId) {
      if (!reservationId) return;
      selectedReservationId = Number(reservationId);
      highlightSelectedReservationRow();
      await loadReservationFinance(reservationId);
    }

    async function loadReservationFinance(reservationId) {
      try {
        const response = await fetch(`${API_URL}/financial/by-reservation/${reservationId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          showMessage('financialMessage', data.error || 'Erro ao carregar resultado da reserva', 'error');
          return;
        }

        selectedReservationId = Number(reservationId);
        highlightSelectedReservationRow();
        showSection('financial');

        const reservation = data.reservation;
        document.getElementById('reservationFinanceInfo').innerHTML = `
          <strong>Reserva #${reservation.id}</strong><br>
          Imóvel: ${reservation.property_name}<br>
          Hóspede: ${reservation.guest_name || '-'}<br>
          Status: ${reservationStatusLabel(reservation.status)}<br>
          Período: ${formatDateBR(reservation.start_date)} até ${formatDateBR(reservation.end_date)}
        `;

        updateReservationFinanceSummary(data.summary || {});

        const tbody = document.getElementById('reservationFinanceTableBody');
        if (!data.entries || !data.entries.length) {
          tbody.innerHTML = '<tr><td colspan="6">Nenhum lançamento vinculado.</td></tr>';
        } else {
          tbody.innerHTML = data.entries.map(entry => `
            <tr>
              <td>${formatDateBR(entry.entry_date)}</td>
              <td>${entry.type === 'income' ? 'Receita' : 'Despesa'}</td>
              <td>${entry.category || '-'}</td>
              <td>${entry.description || '-'}</td>
              <td>${formatMoney(entry.amount)}</td>
              <td>${financialStatusLabel(entry.status)}</td>
            </tr>
          `).join('');
        }

        showSection('financial');
        document.getElementById('reservationFinanceCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        showMessage('financialMessage', 'Erro ao conectar com o backend.', 'error');
      }
    }

    function getEventsForDay(dateObj) {
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      return reservations.filter(event => !isReservationCancelled(event) && dateStr >= event.start_date && dateStr < event.end_date);
    }


    function formatDateInput(dateObj) {
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }

    function formatReadableDate(dateStr) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }

    function updateCalendarSelectionCard(dateStr = '', dayEvents = []) {
      selectedCalendarDate = dateStr || '';

      if (!calendarSelectedDateText || !calendarSelectedDateMeta || !calendarCreateReservationBtn || !calendarBlockDateBtn) {
        return;
      }

      if (!dateStr) {
        calendarSelectedDateText.textContent = 'Clique em um dia vazio para criar reserva ou bloqueio. Clique em um evento para abrir a reserva.';
        calendarSelectedDateMeta.textContent = 'O calendário agora funciona como atalho operacional.';
        calendarCreateReservationBtn.disabled = true;
        calendarBlockDateBtn.disabled = true;
        return;
      }

      calendarCreateReservationBtn.disabled = false;
      calendarBlockDateBtn.disabled = false;

      if (!dayEvents.length) {
        calendarSelectedDateText.textContent = `Dia ${formatReadableDate(dateStr)} sem ocupações.`;
        calendarSelectedDateMeta.textContent = 'Você pode criar uma reserva manual ou bloquear essa data em um clique.';
        return;
      }

      const labels = dayEvents.map(event => `${sourceLabel(event.source)}${event.guest_name ? ` · ${event.guest_name}` : ''}`);
      calendarSelectedDateText.textContent = `Dia ${formatReadableDate(dateStr)} com ${dayEvents.length} ocorrência(s).`;
      calendarSelectedDateMeta.textContent = labels.join(' | ');
    }

    function prefillReservationFromCalendar(type = 'manual') {
      if (!selectedCalendarDate) return;

      const nextDate = new Date(`${selectedCalendarDate}T12:00:00`);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = formatDateInput(nextDate);

      showSection('reservations');

      if (selectedPropertyId) {
        reservationProperty.value = String(selectedPropertyId);
      }

      document.getElementById('reservationType').value = type;
      document.getElementById('reservationStartDate').value = selectedCalendarDate;
      document.getElementById('reservationEndDate').value = nextDateStr;

      if (type === 'blocked') {
        document.getElementById('guestName').value = '';
        document.getElementById('guestEmail').value = '';
        document.getElementById('guestPhone').value = '';
        document.getElementById('reservationTotalAmount').value = '';
      }

      const targetField = type === 'blocked' ? document.getElementById('reservationNotes') : document.getElementById('guestName');
      if (targetField) targetField.focus();
      showMessage('reservationMessage', type === 'blocked' ? `Bloqueio preparado para ${formatReadableDate(selectedCalendarDate)}.` : `Reserva preparada para ${formatReadableDate(selectedCalendarDate)}.`, 'success');
    }

    function openCalendarEvent(eventItem) {
      if (!eventItem) return;

      if (eventItem.source === 'blocked' || eventItem.source === 'bloqueio') {
        selectedReservationId = Number(eventItem.id);
        highlightSelectedReservationRow();
        showSection('reservations');
        const row = document.querySelector(`#reservationsTableBody tr[data-id="${eventItem.id}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showMessage('reservationMessage', 'Este evento é um bloqueio. Você foi levado para a lista de reservas/bloqueios.', 'success');
        return;
      }

      openReservationFinance(eventItem.id);
    }

    function renderCalendar() {
      calendarGrid.innerHTML = '';

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const firstWeekDay = firstDay.getDay();

      const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ];

      monthTitle.textContent = `${monthNames[month]} ${year}`;

      const totalCells = 42;
      let dayCounter = 1 - firstWeekDay;

      for (let i = 0; i < totalCells; i++) {
        const cellDate = new Date(year, month, dayCounter);
        const isCurrentMonth = cellDate.getMonth() === month;
        const dateStr = formatDateInput(cellDate);

        const dayEl = document.createElement('div');
        dayEl.className = `day ${isCurrentMonth ? '' : 'other-month'}`;
        dayEl.style.cursor = 'pointer';

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = cellDate.getDate();
        dayEl.appendChild(dayNumber);

        const dayEvents = getEventsForDay(cellDate);

        dayEl.addEventListener('click', () => {
          updateCalendarSelectionCard(dateStr, dayEvents);
        });

        dayEvents.slice(0, 3).forEach(event => {
          const ev = document.createElement('div');
          ev.className = `event ${sourceClass(event.source)}`;
          ev.textContent = `${sourceLabel(event.source)} - ${event.guest_name || 'Sem nome'}`;
          ev.style.cursor = 'pointer';
          ev.title = event.source === 'blocked' || event.source === 'bloqueio'
            ? 'Clique para abrir o bloqueio na lista'
            : 'Clique para abrir a reserva no financeiro';
          ev.addEventListener('click', (e) => {
            e.stopPropagation();
            updateCalendarSelectionCard(dateStr, dayEvents);
            openCalendarEvent(event);
          });
          dayEl.appendChild(ev);
        });

        if (dayEvents.length > 3) {
          const more = document.createElement('div');
          more.className = 'small';
          more.textContent = `+${dayEvents.length - 3} mais`;
          more.addEventListener('click', (e) => {
            e.stopPropagation();
            updateCalendarSelectionCard(dateStr, dayEvents);
          });
          dayEl.appendChild(more);
        }

        calendarGrid.appendChild(dayEl);
        dayCounter++;
      }
    }

    async function syncSelectedProperty() {
      clearMessage('syncMessage');

      if (!selectedPropertyId) {
        showMessage('syncMessage', 'Selecione um imóvel primeiro.', 'error');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/sync/${selectedPropertyId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          showMessage('syncMessage', data.message || 'Erro ao sincronizar', 'error');
          return;
        }

        showMessage('syncMessage', data.message || 'Sincronização concluída.', 'success');
        await loadReservations();
      } catch (error) {
        showMessage('syncMessage', 'Erro ao conectar com o backend.', 'error');
      }
    }

    async function createFinancialEntry() {
      clearMessage('financialMessage');

      const property_id = financialProperty.value;
      const reservation_id = financialReservation.value;
      const type = document.getElementById('financialType').value;
      const category = document.getElementById('financialCategory').value.trim();
      const description = document.getElementById('financialDescription').value.trim();
      const amount = document.getElementById('financialAmount').value;
      const entry_date = document.getElementById('financialDate').value;
      const status = document.getElementById('financialStatus').value;
      const source = document.getElementById('financialSource').value.trim();

      try {
        let url = `${API_URL}/financial`;
        let method = 'POST';

        if (editingFinancialId) {
          url = `${API_URL}/financial/${editingFinancialId}`;
          method = 'PUT';
        }

        const response = await fetch(url, {
          method,
          headers: authHeaders(),
          body: JSON.stringify({
            property_id,
            reservation_id: reservation_id || null,
            type,
            category,
            description,
            amount,
            entry_date,
            status,
            source
          })
        });

        const data = await response.json();

        if (!response.ok) {
          showMessage('financialMessage', data.error || 'Erro ao salvar lançamento financeiro', 'error');
          return;
        }

        showMessage(
          'financialMessage',
          editingFinancialId ? 'Lançamento atualizado com sucesso.' : 'Lançamento financeiro criado com sucesso.',
          'success'
        );

        const currentReservation = selectedReservationId;
        resetFinancialForm();
        await loadFinancialSummary();
        await loadFinancialEntries();
        await loadFinancialDashboard();

        if (currentReservation) {
          await loadReservationFinance(currentReservation);
        }
      } catch (error) {
        showMessage('financialMessage', 'Erro ao conectar com o backend.', 'error');
      }
    }

    function editFinancial(entryId) {
      const entry = financialEntries.find(item => Number(item.id) === Number(entryId));

      if (!entry) {
        showMessage('financialMessage', 'Não foi possível localizar esse lançamento para edição.', 'error');
        return;
      }

      editingFinancialId = Number(entry.id);
      financialFormTitle.textContent = 'Editar lançamento financeiro';
      createFinancialBtn.textContent = 'Salvar alteração';
      cancelEditFinancialBtn.classList.remove('hidden');

      financialProperty.value = String(entry.property_id);
      renderFinancialReservationOptions(entry.reservation_id || '');
      financialReservation.value = entry.reservation_id ? String(entry.reservation_id) : '';

      document.getElementById('financialType').value = entry.type || 'income';
      document.getElementById('financialCategory').value = entry.category || '';
      document.getElementById('financialDescription').value = entry.description || '';
      document.getElementById('financialAmount').value = entry.amount ?? '';
      document.getElementById('financialDate').value = entry.entry_date || '';
      document.getElementById('financialStatus').value = entry.status || 'paid';
      document.getElementById('financialSource').value = entry.source || '';

      clearMessage('financialMessage');
      showSection('financial');
      financialFormCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function loadFinancialSummary() {
      try {
        const params = new URLSearchParams();

        const propertyId = financialFilterProperty.value || selectedPropertyId || '';
        const month = document.getElementById('financialFilterMonth').value;
        const type = document.getElementById('financialFilterType').value;
        const status = document.getElementById('financialFilterStatus').value;

        if (propertyId) params.append('property_id', propertyId);
        if (month) params.append('month', month);
        if (type) params.append('type', type);
        if (status) params.append('status', status);

        const response = await fetch(`${API_URL}/financial?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          updateSummaryCards({ total_income: 0, total_expense: 0, total_pending: 0, profit: 0 });
          return;
        }

        updateSummaryCards(calculateFinancialSummary(Array.isArray(data) ? data : []));
      } catch (error) {
        updateSummaryCards({ total_income: 0, total_expense: 0, total_pending: 0, profit: 0 });
      }
    }

    function updateSummaryCards(data) {
      document.getElementById('summaryIncome').textContent = formatMoney(data.total_income || 0);
      document.getElementById('summaryExpense').textContent = formatMoney(data.total_expense || 0);
      document.getElementById('summaryProfit').textContent = formatMoney(data.profit || 0);
      document.getElementById('summaryPending').textContent = formatMoney(data.total_pending || 0);
      updateSummaryMirrors(data);
    }

    async function loadFinancialEntries() {
      try {
        const params = new URLSearchParams();

        const propertyId = financialFilterProperty.value || selectedPropertyId || '';
        const month = document.getElementById('financialFilterMonth').value;
        const type = document.getElementById('financialFilterType').value;
        const status = document.getElementById('financialFilterStatus').value;

        if (propertyId) params.append('property_id', propertyId);
        if (month) params.append('month', month);
        if (type) params.append('type', type);
        if (status) params.append('status', status);

        const response = await fetch(`${API_URL}/financial?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          financialTableBody.innerHTML = '<tr><td colspan="10">Erro ao carregar lançamentos</td></tr>';
          return;
        }

        financialEntries = Array.isArray(data) ? data : [];
        renderFinancialTable();
      } catch (error) {
        financialTableBody.innerHTML = '<tr><td colspan="10">Erro ao carregar lançamentos</td></tr>';
      }
    }

    function renderFinancialTable() {
      if (!financialEntries.length) {
        financialTableBody.innerHTML = '<tr><td colspan="10">Nenhum lançamento financeiro</td></tr>';
        return;
      }

      financialTableBody.innerHTML = financialEntries.map(entry => `
        <tr class="${isFinancialEntryCancelled(entry) ? 'reservation-row-cancelled' : ''}">
          <td>${formatDateBR(entry.entry_date)}</td>
          <td>${entry.property_name || '-'}</td>
          <td>${entry.reservation_id ? `#${entry.reservation_id} - ${entry.guest_name || '-'}` : '-'}</td>
          <td>
            <span class="tag ${entry.type === 'income' ? 'tag-income' : 'tag-expense'}">
              ${entry.type === 'income' ? 'Receita' : 'Despesa'}
            </span>
          </td>
          <td>${entry.category || '-'}</td>
          <td>${entry.description || '-'}</td>
          <td>${formatMoney(entry.amount)}</td>
          <td>
            <span class="tag ${financialStatusClass(entry.status)}">
              ${financialStatusLabel(entry.status)}
            </span>
          </td>
          <td>${entry.source || '-'}</td>
          <td>
            <div class="actions-inline">
              <button type="button" data-action="edit-financial" data-id="${entry.id}">Editar</button>
              <button type="button" class="btn-danger" data-action="delete-financial" data-id="${entry.id}">Excluir</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    async function deleteFinancialEntry(id) {
      const confirmed = confirm('Deseja realmente excluir este lançamento?');
      if (!confirmed) return;

      try {
        const response = await fetch(`${API_URL}/financial/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'Erro ao excluir lançamento');
          return;
        }

        if (editingFinancialId === Number(id)) {
          resetFinancialForm();
        }

        await loadFinancialSummary();
        await loadFinancialEntries();
        await loadFinancialDashboard();

        if (selectedReservationId) {
          await loadReservationFinance(selectedReservationId);
        }
      } catch (error) {
        alert('Erro ao conectar com o backend.');
      }
    }

    if (dashboardChartProperty) {
      dashboardChartProperty.addEventListener('change', () => {
        renderMonthlyChart();
      });
    }

    reservationsTableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (button) {
        const action = button.dataset.action;
        const id = Number(button.dataset.id);

        if (action === 'view-reservation-finance' && id) {
          await openReservationFinance(id);
        }
        return;
      }

      const row = event.target.closest('tr[data-id]');
      if (!row) return;

      const id = Number(row.dataset.id);
      const reservation = reservations.find(item => Number(item.id) === id);
      if (!reservation || reservation.source === 'blocked') return;

      await openReservationFinance(id);
    });


    messageAutomationTableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;

      const action = button.dataset.action;
      const id = Number(button.dataset.id);
      if (!action || !id) return;

      if (action === 'edit-message-automation') {
        editMessageAutomation(id);
        return;
      }

      if (action === 'toggle-message-automation') {
        await toggleMessageAutomation(id);
        return;
      }

      if (action === 'delete-message-automation') {
        await deleteMessageAutomation(id);
      }
    });

    financialTableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;

      const action = button.dataset.action;
      const id = Number(button.dataset.id);

      if (!action || !id) return;

      if (action === 'edit-financial') {
        editFinancial(id);
        return;
      }

      if (action === 'delete-financial') {
        await deleteFinancialEntry(id);
      }
    });

    navButtons.forEach(button => {
      button.addEventListener('click', () => {
        showSection(button.dataset.sectionBtn);
      });
    });

    sectionJumpButtons.forEach(button => {
      button.addEventListener('click', () => {
        showSection(button.dataset.sectionJump);
      });
    });

    saveMessageAutomationBtn.addEventListener('click', saveMessageAutomation);
    cancelEditMessageAutomationBtn.addEventListener('click', () => {
      resetMessageAutomationForm();
      clearMessage('messageAutomationMessage');
    });
    refreshMessageLogsBtn.addEventListener('click', () => loadMessageLogs(currentMessageLogFilter));

    if (messageLogFilters) {
      messageLogFilters.addEventListener('click', (event) => {
        const button = event.target.closest('[data-log-filter]');
        if (!button) return;
        loadMessageLogs(button.dataset.logFilter || 'all');
      });
    }

    loginBtn.addEventListener('click', login);
    registerBtn.addEventListener('click', registerUser);
    logoutBtn.addEventListener('click', logout);
    createPropertyBtn.addEventListener('click', createProperty);
    createReservationBtn.addEventListener('click', createReservation);
    syncPropertyBtn.addEventListener('click', syncSelectedProperty);
    createFinancialBtn.addEventListener('click', createFinancialEntry);

    applyFinancialFiltersBtn.addEventListener('click', async () => {
      await loadFinancialSummary();
      await loadFinancialEntries();
    });

    cancelEditFinancialBtn.addEventListener('click', () => {
      resetFinancialForm();
      clearMessage('financialMessage');
    });

    calendarCreateReservationBtn.addEventListener('click', () => {
      prefillReservationFromCalendar('manual');
    });

    calendarBlockDateBtn.addEventListener('click', () => {
      prefillReservationFromCalendar('blocked');
    });

    prevMonthBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    });

    reservationProperty.addEventListener('change', async (e) => {
      selectedPropertyId = Number(e.target.value);
      renderPropertyList();
      renderPropertySelects();
      resetFinancialForm();
      resetReservationFinanceCard();
      await loadReservations();
      await loadFinancialSummary();
      await loadFinancialEntries();
    });

    financialProperty.addEventListener('change', () => {
      renderFinancialReservationOptions();
    });

    document.getElementById('financialFilterMonth').value = new Date().toISOString().slice(0, 7);
    resetFinancialForm();
    resetMessageAutomationForm();
    resetReservationFinanceCard();

    if (token && loggedUser) {
      enterApp();
      loadProperties();
    }
