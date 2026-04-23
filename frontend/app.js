    const API_URL = (() => {
      const configuredUrl = window.STAYFLOW_API_URL;
      if (configuredUrl) return configuredUrl.replace(/\/$/, '');

      const isLocalHost = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
      const isLocalFile = window.location.protocol === 'file:';

      if (isLocalFile || isLocalHost) return 'http://localhost:3000';

      return 'https://api.stayflowapp.online';
    })();

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
    let reservationTableRows = [];
    let financialEntries = [];
    let allFinancialEntries = [];
    let selectedPropertyId = null;
    let currentDate = new Date();
    let selectedCalendarDate = '';
    let editingFinancialId = null;
    let selectedReservationId = null;
    let messageAutomations = [];
    let messageAutomationLogs = [];
    let messageLogs = [];
    let messageLogSummary = { total: 0, pending: 0, needs_contact: 0, sent: 0, failed: 0 };
    let currentMessageLogFilter = 'all';
    let reservationPagination = { page: 1, limit: 25, total: 0, totalPages: 1 };
    let financialPagination = { page: 1, limit: 25, total: 0, totalPages: 1 };
    let messageLogPagination = { page: 1, limit: 25, total: 0, totalPages: 1 };
    let editingMessageAutomationId = null;
    let operationMessageLogs = [];
    let operationInboundEmails = [];
    let operationDashboardLoading = false;
    let operationCurrentActionButton = null;
    let currentUserDetails = null;
    let onboardingStep = 1;
    let onboardingPropertyId = null;
    let billingOverview = null;
    let billingPayments = [];
    let billingAccessState = {
      billingStatus: 'TRIAL',
      accessStatus: 'FULL'
    };

    const authCard = document.getElementById('authCard');
    const app = document.getElementById('app');

    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const showForgotPasswordBtn = document.getElementById('showForgotPasswordBtn');
    const hideForgotPasswordBtn = document.getElementById('hideForgotPasswordBtn');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const forgotPasswordPanel = document.getElementById('forgotPasswordPanel');
    const registerCpfInput = document.getElementById('registerCpf');
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

    const operationRefreshBtn = document.getElementById('operationRefreshBtn');
    const operationStatusFilter = document.getElementById('operationStatusFilter');
    const operationPropertyFilter = document.getElementById('operationPropertyFilter');
    const operationFromFilter = document.getElementById('operationFromFilter');
    const operationToFilter = document.getElementById('operationToFilter');
    const operationApplyFiltersBtn = document.getElementById('operationApplyFiltersBtn');
    const operationClearFiltersBtn = document.getElementById('operationClearFiltersBtn');
    const operationMessagesTableBody = document.getElementById('operationMessagesTableBody');
    const operationInboundTableBody = document.getElementById('operationInboundTableBody');
    const operationAttentionList = document.getElementById('operationAttentionList');
    const operationDetailsCard = document.getElementById('operationDetailsCard');
    const operationDetailsContent = document.getElementById('operationDetailsContent');
    const operationCloseDetailsBtn = document.getElementById('operationCloseDetailsBtn');
    const onboardingShell = document.getElementById('onboardingShell');
    const onboardingTitle = document.getElementById('onboardingTitle');
    const onboardingSubtitle = document.getElementById('onboardingSubtitle');
    const onboardingStepText = document.getElementById('onboardingStepText');
    const onboardingProgressPercent = document.getElementById('onboardingProgressPercent');
    const onboardingProgressBar = document.getElementById('onboardingProgressBar');
    const onboardingBackBtn = document.getElementById('onboardingBackBtn');
    const onboardingNextBtn = document.getElementById('onboardingNextBtn');
    const onboardingSkipBtn = document.getElementById('onboardingSkipBtn');
    const onboardingIntegrationEmailText = document.getElementById('onboardingIntegrationEmailText');
    const refreshMyInfoBtn = document.getElementById('refreshMyInfoBtn');
    const copyMyIntegrationEmailBtn = document.getElementById('copyMyIntegrationEmailBtn');
    const openOnboardingBtn = document.getElementById('openOnboardingBtn');
    const refreshBillingBtn = document.getElementById('refreshBillingBtn');
    const activateBillingBtn = document.getElementById('activateBillingBtn');
    const cancelBillingBtn = document.getElementById('cancelBillingBtn');
    const recalculateBillingBtn = document.getElementById('recalculateBillingBtn');
    const billingPaymentsTableBody = document.getElementById('billingPaymentsTableBody');
    const billingTypeSelect = document.getElementById('billingTypeSelect');
    const accessRestrictionBanner = document.getElementById('accessRestrictionBanner');
    const accessRestrictionTitle = document.getElementById('accessRestrictionTitle');
    const accessRestrictionText = document.getElementById('accessRestrictionText');
    const accessRestrictionCta = document.getElementById('accessRestrictionCta');
    const activationNextCta = document.getElementById('activationNextCta');
    const reservationDetailsCard = document.getElementById('reservationDetailsCard');
    const reservationDetailsContent = document.getElementById('reservationDetailsContent');
    const closeReservationDetailsBtn = document.getElementById('closeReservationDetailsBtn');

    const pageTitle = document.getElementById('pageTitle');
    const selectedPropertyBadge = document.getElementById('selectedPropertyBadge');
    const navButtons = document.querySelectorAll('[data-section-btn]');
    const sectionJumpButtons = document.querySelectorAll('[data-section-jump]');

    function setActiveNav(section) {
      navButtons.forEach(button => {
        const isActive = button.dataset.sectionBtn === section;
        button.classList.toggle('active', isActive);
        if (isActive) {
          button.setAttribute('aria-current', 'page');
        } else {
          button.removeAttribute('aria-current');
        }
      });
    }

    function sectionTitle(section) {
      const titles = {
        dashboard: 'Dashboard',
        operations: 'Operação',
        properties: 'Imóveis',
        reservations: 'Reservas',
        calendar: 'Calendário',
        messages: 'Automação de mensagens',
        financial: 'Financeiro',
        billing: 'Assinatura e Cobrança',
        'message-status': 'Status das mensagens',
        'my-info': 'Minhas informações'
      };
      return titles[section] || 'Painel';
    }

    function showSection(section) {
      if (!canAccessSection(section)) {
        showSection('billing');
        return;
      }

      document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
      const target = document.getElementById(`section-${section}`);
      if (target) target.classList.remove('hidden');
      if (pageTitle) pageTitle.textContent = sectionTitle(section);
      setActiveNav(section);
      if (section === 'operations' && hasFullBillingAccess()) {
        loadOperationalDashboard();
      }
      if (section === 'message-status' && hasFullBillingAccess()) {
        loadMessageLogs(currentMessageLogFilter);
      }
      if (section === 'my-info' && canAccessMyInfo()) {
        loadMyInfo();
      }
      if (section === 'billing') {
        loadBillingDashboard();
      }
      renderActivationGuide();
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
      const target = document.getElementById(targetId);
      if (!target) return;
      const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'success';
      target.innerHTML = `<div class="message ${safeType}">${escapeHtml(text)}</div>`;
    }

    function clearMessage(targetId) {
      document.getElementById(targetId).innerHTML = '';
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

    function extractApiError(data, fallback) {
      if (data?.error) return data.error;
      if (data?.message) return data.message;
      if (Array.isArray(data?.errors) && data.errors.length) {
        return data.errors.map(item => item.message).join(' ');
      }
      return fallback;
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

    function toggleForgotPasswordPanel(show) {
      if (!forgotPasswordPanel) return;
      forgotPasswordPanel.classList.toggle('hidden', !show);
      if (show) {
        const loginEmail = document.getElementById('loginEmail')?.value.trim();
        const forgotEmail = document.getElementById('forgotPasswordEmail');
        if (forgotEmail && loginEmail && !forgotEmail.value) forgotEmail.value = loginEmail;
        forgotPasswordPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    function onboardingStorageKey(suffix) {
      const userId = loggedUser?.id || currentUserDetails?.id || 'anonymous';
      return `stayflow:${suffix}:${userId}`;
    }

    function getOnboardingState() {
      return localStorage.getItem(onboardingStorageKey('onboardingState')) || 'not_started';
    }

    function setOnboardingState(state) {
      localStorage.setItem(onboardingStorageKey('onboardingState'), state);
    }

    function getOnboardingProgress() {
      try {
        return JSON.parse(localStorage.getItem(onboardingStorageKey('onboardingProgress')) || '{}');
      } catch (error) {
        return {};
      }
    }

    function updateOnboardingProgress(patch = {}) {
      const progress = { ...getOnboardingProgress(), ...patch };
      localStorage.setItem(onboardingStorageKey('onboardingProgress'), JSON.stringify(progress));
      renderMyInfo();
      renderActivationGuide();
      applyBillingAccessControls();
      return progress;
    }

    function isOnboardingDone() {
      const completed = getOnboardingState() === 'completed' || localStorage.getItem(onboardingStorageKey('onboardingDone')) === '1';
      return completed && canCompleteOnboarding();
    }

    function isOnboardingSkipped() {
      return getOnboardingState() === 'skipped' || localStorage.getItem(onboardingStorageKey('onboardingSkipped')) === '1';
    }

    function markOnboardingDone() {
      setOnboardingState('completed');
      localStorage.setItem(onboardingStorageKey('onboardingDone'), '1');
      localStorage.removeItem(onboardingStorageKey('onboardingSkipped'));
      applyBillingAccessControls();
    }

    function markOnboardingSkipped() {
      setOnboardingState('skipped');
      localStorage.setItem(onboardingStorageKey('onboardingSkipped'), '1');
      applyBillingAccessControls();
    }

    function hasConnectedIcal() {
      return properties.some(property => property.airbnb_ical_url || property.booking_ical_url);
    }

    function getOnboardingActivationStatus() {
      const progress = getOnboardingProgress();
      return {
        hasProperty: properties.length > 0 || Boolean(progress.property_created),
        hasIcal: hasConnectedIcal() || Boolean(progress.calendar_connected),
        notificationsUnderstood: Boolean(progress.notifications_seen && progress.email_copied),
        automationStepCompleted: Boolean(progress.automation_step_completed) || hasActiveAutomation()
      };
    }

    function canCompleteOnboarding() {
      const status = getOnboardingActivationStatus();
      return status.hasProperty && status.hasIcal && status.notificationsUnderstood && status.automationStepCompleted;
    }

    function shouldShowOnboarding() {
      return token && !isOnboardingDone() && !isOnboardingSkipped() && !canCompleteOnboarding();
    }

    function updateOnboardingIntegrationEmail() {
      const integrationEmail = currentUserDetails?.inbound_alias || loggedUser?.inbound_alias || 'E-mail ainda não carregado';
      if (onboardingIntegrationEmailText) onboardingIntegrationEmailText.textContent = integrationEmail;
      const myInfoIntegrationEmail = document.getElementById('myInfoIntegrationEmail');
      if (myInfoIntegrationEmail) myInfoIntegrationEmail.textContent = integrationEmail;
    }

    function renderOnboardingStep() {
      if (!onboardingShell) return;

      const titles = {
        1: ['Bem-vindo ao StayFlow', 'Um setup rápido para chegar ao primeiro valor sem se perder no sistema.'],
        2: ['Primeiro imóvel', 'Cadastre o imóvel principal para ativar calendário, reservas e automações.'],
        3: ['Calendário e e-mail do StayFlow', 'Use o iCal para sincronizar agenda e o e-mail do StayFlow para receber eventos das plataformas.'],
        4: ['Automação inicial', 'Prepare uma mensagem simples para começar a operar com menos trabalho manual.'],
        5: ['Tudo pronto', 'Sua conta já tem o caminho principal configurado.']
      };

      document.querySelectorAll('[data-onboarding-step]').forEach(step => {
        step.classList.toggle('hidden', Number(step.dataset.onboardingStep) !== onboardingStep);
      });

      const progress = Math.round((onboardingStep / 5) * 100);
      if (onboardingTitle) onboardingTitle.textContent = titles[onboardingStep][0];
      if (onboardingSubtitle) onboardingSubtitle.textContent = titles[onboardingStep][1];
      if (onboardingStepText) onboardingStepText.textContent = `Etapa ${onboardingStep} de 5`;
      if (onboardingProgressPercent) onboardingProgressPercent.textContent = `${progress}%`;
      if (onboardingProgressBar) onboardingProgressBar.style.width = `${progress}%`;
      if (onboardingBackBtn) onboardingBackBtn.classList.toggle('hidden', onboardingStep === 1);
      if (onboardingNextBtn) {
        onboardingNextBtn.textContent = onboardingStep === 1
          ? 'Começar configuração'
          : onboardingStep === 5
            ? 'Ir para o painel'
            : onboardingStep === 3
              ? 'Salvar e sincronizar'
              : 'Continuar';
      }
      updateOnboardingIntegrationEmail();
    }

    function openOnboarding(step = 1) {
      onboardingStep = step;
      if (!isOnboardingDone()) setOnboardingState('in_progress');
      if (onboardingShell) onboardingShell.classList.remove('hidden');
      renderOnboardingStep();
    }

    function closeOnboarding() {
      if (onboardingShell) onboardingShell.classList.add('hidden');
      clearMessage('onboardingMessage');
    }

    function maybeOpenOnboarding() {
      if (shouldShowOnboarding()) {
        openOnboarding(getSuggestedOnboardingStep());
      }
    }

    function getSuggestedOnboardingStep() {
      const status = getOnboardingActivationStatus();
      if (!status.hasProperty) return 1;
      if (!status.hasIcal || !status.notificationsUnderstood) return 3;
      if (!status.automationStepCompleted) return 4;
      return 5;
    }

    function hasActiveAutomation() {
      return messageAutomations.some(item => item.is_active || item.status === 'active');
    }

    function getActivationSteps() {
      const status = getOnboardingActivationStatus();
      const hasAutomation = hasActiveAutomation() || status.automationStepCompleted;

      return [
        {
          key: 'property',
          title: 'Criar o im\u00f3vel',
          description: 'Cadastre o im\u00f3vel principal para o sistema ter um contexto de opera\u00e7\u00e3o.',
          done: status.hasProperty,
          section: 'properties',
          cta: 'Cadastrar im\u00f3vel'
        },
        {
          key: 'ical',
          title: 'Configurar iCal',
          description: 'Cole ao menos um link iCal para manter o calend\u00e1rio sincronizado.',
          done: status.hasIcal,
          section: 'properties',
          cta: 'Conectar iCal'
        },
        {
          key: 'email',
          title: 'Cadastrar e-mail do StayFlow',
          description: 'Use o e-mail de integra\u00e7\u00e3o nas plataformas para receber reservas e altera\u00e7\u00f5es.',
          done: status.notificationsUnderstood,
          section: 'my-info',
          cta: 'Copiar e-mail'
        },
        {
          key: 'automation',
          title: 'Configurar automa\u00e7\u00e3o',
          description: 'Ative uma mensagem inicial para reduzir trabalho manual no atendimento.',
          done: hasAutomation,
          section: 'messages',
          cta: 'Criar automa\u00e7\u00e3o'
        }
      ];
    }

    function getStepStateClass(step, index, firstPendingIndex) {
      if (step.done) return 'completed';
      if (index === firstPendingIndex) return 'current';
      return 'pending';
    }

    function activationStepStatusLabel(step, index, firstPendingIndex) {
      if (step.done) return 'Conclu\u00eddo';
      if (index === firstPendingIndex) return 'Em progresso';
      return 'Pendente';
    }

    function renderActivationGuide() {
      const steps = getActivationSteps();
      const completed = steps.filter(step => step.done).length;
      const percent = Math.round((completed / steps.length) * 100);
      const firstPendingIndex = steps.findIndex(step => !step.done);
      const nextStep = firstPendingIndex >= 0 ? steps[firstPendingIndex] : {
        title: 'StayFlow pronto para operar',
        description: 'Sua configura\u00e7\u00e3o principal est\u00e1 conclu\u00edda. Agora acompanhe reservas, mensagens e resultados.',
        section: 'operations',
        cta: 'Ver opera\u00e7\u00e3o'
      };
      const contextNotes = {
        property: 'Primeiro crie o im\u00f3vel principal. Ele vira o contexto para reservas, calend\u00e1rio, financeiro e automa\u00e7\u00f5es.',
        ical: 'Agora conecte pelo menos um iCal. Isso ajuda a centralizar disponibilidade e reduzir conflito de datas.',
        email: 'Cadastre o e-mail do StayFlow nas plataformas para identificar reservas, altera\u00e7\u00f5es e cancelamentos automaticamente.',
        automation: 'Com im\u00f3vel, calend\u00e1rio e e-mail configurados, ative uma automa\u00e7\u00e3o inicial para reduzir trabalho manual.',
        done: 'Configura\u00e7\u00e3o principal conclu\u00edda. A partir daqui, acompanhe opera\u00e7\u00e3o, reservas e mensagens pelo painel.'
      };

      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      const setWidth = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.style.width = `${value}%`;
      };

      setText('activationProgressPercent', `${percent}%`);
      setText('activationProgressText', `${completed} de ${steps.length} conclu\u00eddos`);
      setText('activationNextTitle', nextStep.title);
      setText('activationNextDescription', nextStep.description);
      setText('activationContextNote', contextNotes[nextStep.key] || contextNotes.done);
      setWidth('activationProgressBar', percent);

      const dashboardSecondaryContent = document.getElementById('dashboardSecondaryContent');
      if (dashboardSecondaryContent) {
        dashboardSecondaryContent.classList.toggle('dashboard-secondary-muted', completed < steps.length);
      }

      if (activationNextCta) {
        activationNextCta.textContent = nextStep.cta || 'Continuar';
        activationNextCta.dataset.activationSection = nextStep.section;
      }

      const stepsHtml = steps.map((step, index) => {
        const state = getStepStateClass(step, index, firstPendingIndex);
        return `
          <button type="button" class="activation-step-card ${state}" data-activation-section="${step.section}">
            <span class="activation-step-number">${step.done ? '&check;' : index + 1}</span>
            <span>
              <strong>${escapeHtml(step.title)}</strong>
              <small>${escapeHtml(step.description)}</small>
            </span>
            <em>${escapeHtml(activationStepStatusLabel(step, index, firstPendingIndex))}</em>
          </button>
        `;
      }).join('');

      const activationStepsGrid = document.getElementById('activationStepsGrid');
      if (activationStepsGrid) activationStepsGrid.innerHTML = stepsHtml;
    }

    function goToActivationSection(section) {
      if (!section || !canAccessSection(section)) {
        showSection(preferredSectionForBillingAccess());
        return;
      }
      showSection(section);
      if (section === 'my-info') {
        copyIntegrationEmail('myInfoMessage');
      }
    }

    async function copyTextToClipboard(text) {
      if (!text || text.includes('n\u00e3o carregado') || text.includes('n\u00e3o dispon\u00edvel')) return false;
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        const input = document.createElement('input');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        const success = document.execCommand('copy');
        input.remove();
        return success;
      }
    }

    async function copyIntegrationEmail(targetMessageId = 'myInfoMessage') {
      const integrationEmail = currentUserDetails?.inbound_alias || loggedUser?.inbound_alias || '';
      const success = await copyTextToClipboard(integrationEmail);
      if (success) updateOnboardingProgress({ email_copied: true, notifications_seen: true });
      if (targetMessageId) {
        showMessage(
          targetMessageId,
          success ? 'E-mail do StayFlow copiado para a \u00e1rea de transfer\u00eancia.' : 'N\u00e3o foi poss\u00edvel copiar o e-mail agora.',
          success ? 'success' : 'error'
        );
      }
      return success;
    }

    function authHeaders() {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    }

    async function apiFetch(endpoint, options = {}) {
      const {
        auth = true,
        errorMessage = 'Não foi possível concluir a solicitação.',
        headers: customHeaders = {},
        body,
        ...fetchOptions
      } = options;

      const url = /^https?:\/\//i.test(endpoint)
        ? endpoint
        : `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

      const headers = { ...customHeaders };
      let requestBody = body;

      if (auth && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      if (requestBody !== undefined && !(requestBody instanceof FormData) && typeof requestBody !== 'string') {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        requestBody = JSON.stringify(requestBody);
      }

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        body: requestBody
      });

      const raw = await response.text();
      let data = {};

      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch (error) {
          data = raw;
        }
      }

      if (!response.ok) {
        const error = new Error(extractApiError(data, errorMessage));
        error.response = response;
        error.data = data;
        throw error;
      }

      return data;
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

    function setText(id, value) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }

    function normalizeDateString(value) {
      if (!value) return '';
      return String(value).slice(0, 10);
    }

    function formatBillingDate(value) {
      const date = normalizeDateString(value);
      return date ? formatDateBR(date) : '-';
    }

    function billingStatusLabel(status) {
      const normalized = String(status || '').toUpperCase();
      const labels = {
        TRIAL: 'Trial',
        ACTIVE: 'Ativo',
        PAST_DUE: 'Em atraso',
        CANCELED: 'Cancelado',
        CANCELLED: 'Cancelado',
        BLOCKED: 'Bloqueado',
        EXPIRED: 'Expirado',
        PENDING: 'Pendente',
        FULL: 'Acesso total',
        READ_ONLY: 'Somente leitura'
      };
      return labels[normalized] || status || '-';
    }

    function billingStatusClass(status) {
      const normalized = String(status || '').toUpperCase();
      if (['ACTIVE', 'FULL', 'CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(normalized)) return 'status-active';
      if (['TRIAL', 'PENDING'].includes(normalized)) return 'tag-pending';
      if (['PAST_DUE', 'OVERDUE', 'READ_ONLY'].includes(normalized)) return 'billing-warning';
      if (['CANCELED', 'CANCELLED', 'BLOCKED', 'EXPIRED', 'REFUNDED'].includes(normalized)) return 'status-inactive';
      return 'billing-muted';
    }

    function getBillingStatusFromOverview(overview = {}) {
      return overview.access?.billingStatus
        || overview.billing?.subscription_status
        || overview.subscription?.status
        || '-';
    }

    function getBillingAccessFromOverview(overview = {}) {
      return overview.access?.accessStatus
        || overview.billing?.access_status
        || '-';
    }

    function normalizeBillingAccessFromOverview(overview = {}) {
      const billingStatus = String(getBillingStatusFromOverview(overview) || 'TRIAL').toUpperCase();
      const accessStatus = String(getBillingAccessFromOverview(overview) || '').toUpperCase();

      if (['CANCELED', 'CANCELLED', 'INACTIVE', 'BLOCKED', 'EXPIRED'].includes(billingStatus) || accessStatus === 'BLOCKED') {
        return { billingStatus, accessStatus: 'BLOCKED' };
      }

      if (billingStatus === 'PAST_DUE' || accessStatus === 'READ_ONLY') {
        return { billingStatus, accessStatus: 'READ_ONLY' };
      }

      return { billingStatus, accessStatus: 'FULL' };
    }

    function hasFullBillingAccess() {
      return billingAccessState.accessStatus === 'FULL';
    }

    function canAccessMyInfo() {
      return billingAccessState.accessStatus !== 'BLOCKED';
    }

    function canAccessSection(section) {
      if (billingAccessState.accessStatus === 'BLOCKED') {
        return section === 'billing';
      }

      if (billingAccessState.accessStatus === 'READ_ONLY') {
        return ['billing', 'my-info'].includes(section);
      }

      return true;
    }

    function isInitialTrialExperience() {
      if (!hasFullBillingAccess()) return false;

      const billingStatus = String(billingAccessState.billingStatus || 'TRIAL').toUpperCase();
      const isTrialLike = !billingStatus || billingStatus === 'TRIAL';

      return isTrialLike && !isOnboardingDone() && !isOnboardingSkipped();
    }

    function shouldHideSectionForInitialExperience(section) {
      const advancedSections = ['financial', 'operations', 'message-status'];
      return isInitialTrialExperience() && advancedSections.includes(section);
    }

    function preferredSectionForBillingAccess() {
      if (billingAccessState.accessStatus === 'FULL') return 'dashboard';
      return 'billing';
    }

    function clearSensitiveFrontendData() {
      if (hasFullBillingAccess()) return;

      properties = [];
      reservations = [];
      reservationTableRows = [];
      financialEntries = [];
      allFinancialEntries = [];
      messageAutomations = [];
      messageAutomationLogs = [];
      messageLogs = [];
      operationMessageLogs = [];
      operationInboundEmails = [];
      selectedPropertyId = null;
      selectedReservationId = null;

      const sensitiveCounters = [
        'summaryIncome',
        'summaryExpense',
        'summaryProfit',
        'summaryPending',
        'summaryOccupancy',
        'dashboardUpcomingReservations',
        'dashboardUpcomingCheckins',
        'dashboardUpcomingCheckouts',
        'dashboardNoContact',
        'dashboardAutomationIssues',
        'dashboardRecentErrors',
        'operationSentToday',
        'operationPendingCount',
        'operationFailedCount',
        'operationNeedsContactCount',
        'messageAutomationCount',
        'messageAutomationActiveCount',
        'messageAutomationInactiveCount',
        'messageAutomationGeneratedCount',
        'messageAutomationFailureCount',
        'messageLogTotalCount',
        'messageLogPendingCount',
        'messageLogNeedsContactCount',
        'messageLogFailedCount',
        'messageLogSentCount',
        'financialSummaryIncomeMirror',
        'financialSummaryExpenseMirror',
        'financialSummaryProfitMirror',
        'financialSummaryPendingMirror',
        'reservationIncome',
        'reservationExpense',
        'reservationPending',
        'reservationProfit'
      ];

      sensitiveCounters.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === 'summaryOccupancy') {
          el.textContent = '0%';
          return;
        }
        const isMoney = /(income|expense|profit|summary|reservation)/i.test(id);
        el.textContent = isMoney ? 'R$ 0,00' : '0';
      });

      const emptyStates = [
        ['propertyList', 'Área indisponível até a regularização da assinatura.'],
        ['reservationsTableBody', '<tr><td colspan="8">Área indisponível até a regularização da assinatura.</td></tr>'],
        ['financialTableBody', '<tr><td colspan="10">Área indisponível até a regularização da assinatura.</td></tr>'],
        ['messageAutomationTableBody', '<tr><td colspan="8">Área indisponível até a regularização da assinatura.</td></tr>'],
        ['messageLogsList', 'Área indisponível até a regularização da assinatura.'],
        ['operationMessagesTableBody', '<tr><td colspan="6">Área indisponível até a regularização da assinatura.</td></tr>'],
        ['operationInboundTableBody', '<tr><td colspan="6">Área indisponível até a regularização da assinatura.</td></tr>']
      ];

      emptyStates.forEach(([id, html]) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
      });

      if (selectedPropertyBadge) selectedPropertyBadge.textContent = 'Nenhum imóvel selecionado';
    }

    function renderAccessRestrictionBanner() {
      if (!accessRestrictionBanner) return;

      if (billingAccessState.accessStatus === 'FULL') {
        accessRestrictionBanner.classList.add('hidden');
        return;
      }

      accessRestrictionBanner.classList.remove('hidden');

      if (billingAccessState.accessStatus === 'READ_ONLY') {
        accessRestrictionBanner.className = 'access-restriction-banner access-readonly';
        if (accessRestrictionTitle) accessRestrictionTitle.textContent = 'Acesso reduzido por pendência de pagamento';
        if (accessRestrictionText) accessRestrictionText.textContent = 'Reservas, financeiro, automações e dados operacionais ficam temporariamente indisponíveis. Regularize a assinatura na aba de cobrança.';
        return;
      }

      accessRestrictionBanner.className = 'access-restriction-banner access-blocked';
      if (accessRestrictionTitle) accessRestrictionTitle.textContent = 'Conta bloqueada por status de cobrança';
      if (accessRestrictionText) accessRestrictionText.textContent = 'Apenas a área de pagamento está disponível. Regularize a assinatura para voltar a usar o StayFlow.';
    }

    function applyBillingAccessControls() {
      navButtons.forEach(button => {
        const section = button.dataset.sectionBtn;
        const hidden = !canAccessSection(section) || shouldHideSectionForInitialExperience(section);
        button.classList.toggle('hidden', hidden);
      });

      document.querySelectorAll('[data-section-jump]').forEach(button => {
        const section = button.dataset.sectionJump;
        const hidden = !canAccessSection(section) || shouldHideSectionForInitialExperience(section);
        button.classList.toggle('hidden', hidden);
      });

      clearSensitiveFrontendData();
      renderAccessRestrictionBanner();

      const activeSection = document.querySelector('.section:not(.hidden)')?.id?.replace('section-', '');
      if (activeSection && !canAccessSection(activeSection)) {
        showSection('billing');
        return;
      }

      if (activeSection && shouldHideSectionForInitialExperience(activeSection)) {
        showSection('dashboard');
      }
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
      messageAutomationLogs = [];
      messageLogs = [];
      editingMessageAutomationId = null;
      document.getElementById('reservationFinanceInfo').innerHTML = 'Selecione uma reserva para ver o resultado financeiro.';
      updateReservationFinanceSummary();
      document.getElementById('reservationFinanceTableBody').innerHTML = '<tr><td colspan="6">Nenhum lançamento vinculado.</td></tr>';
      if (reservationDetailsCard) reservationDetailsCard.classList.add('hidden');
      if (reservationDetailsContent) reservationDetailsContent.innerHTML = '';
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
      const generated = messageAutomationLogs.length;
      const failures = messageAutomationLogs.filter(log => String(log.status || '') === 'failed').length;

      const pairs = [
        ['messageAutomationCount', total],
        ['messageAutomationActiveCount', active],
        ['messageAutomationInactiveCount', inactive],
        ['messageAutomationGeneratedCount', generated],
        ['messageAutomationFailureCount', failures]
      ];

      pairs.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
      });
    }

    function getAutomationStats(automationId) {
      const logs = messageAutomationLogs.filter(log => Number(log.automation_id) === Number(automationId));
      return {
        total: logs.length,
        sent: logs.filter(log => String(log.status || '') === 'sent').length,
        pending: logs.filter(log => ['pending', 'queued'].includes(String(log.status || ''))).length,
        failed: logs.filter(log => String(log.status || '') === 'failed').length,
        needsContact: logs.filter(log => String(log.status || '') === 'needs_contact').length,
        nextLog: logs
          .filter(log => log.scheduled_for && timelineDateValue(log.scheduled_for) >= Date.now() - 60000)
          .sort((a, b) => timelineDateValue(a.scheduled_for) - timelineDateValue(b.scheduled_for))[0] || null
      };
    }

    function addDaysToDate(dateStr, days) {
      if (!dateStr) return null;
      const date = new Date(String(dateStr) + 'T00:00:00');
      if (Number.isNaN(date.getTime())) return null;
      date.setDate(date.getDate() + Number(days || 0));
      return date;
    }

    function getAutomationBaseDate(reservation, trigger) {
      if (trigger === 'check_out' || trigger === 'post_check_out') return reservation.end_date;
      return reservation.start_date;
    }

    function estimateNextAutomationDate(automation) {
      const propertyId = Number(automation.property_id);
      const trigger = automation.trigger_type || automation.automation_type;
      const offsetDays = Number(automation.offset_days ?? automation.days_offset ?? 0);
      const sendTime = automation.send_time || '09:00';
      const upcoming = reservations
        .filter(reservation => Number(reservation.property_id) === propertyId)
        .filter(reservation => reservation.source !== 'blocked' && !isReservationCancelled(reservation))
        .map(reservation => {
          const baseDate = getAutomationBaseDate(reservation, trigger);
          const effectiveOffset = trigger === 'pre_check_in' ? -Math.abs(offsetDays) : offsetDays;
          const date = addDaysToDate(baseDate, effectiveOffset);
          if (!date) return null;
          const [hours = '09', minutes = '00'] = String(sendTime).split(':');
          date.setHours(Number(hours) || 9, Number(minutes) || 0, 0, 0);
          return date;
        })
        .filter(date => date && date.getTime() >= Date.now() - 60000)
        .sort((a, b) => a.getTime() - b.getTime());

      return upcoming[0] || null;
    }

    function automationOperationHtml(automation) {
      const stats = getAutomationStats(automation.id);
      const nextDate = stats.nextLog?.scheduled_for
        ? formatDateTimeBR(stats.nextLog.scheduled_for)
        : (estimateNextAutomationDate(automation) ? estimateNextAutomationDate(automation).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem próximo disparo estimado');

      return '<div class="automation-health">' +
        '<div><span>Próximo</span><strong>' + escapeHtml(nextDate) + '</strong></div>' +
        '<div class="automation-health-grid">' +
          '<span class="mini-pill">Logs ' + stats.total + '</span>' +
          '<span class="mini-pill status-active">Enviadas ' + stats.sent + '</span>' +
          '<span class="mini-pill tag-pending">Pendentes ' + stats.pending + '</span>' +
          '<span class="mini-pill status-inactive">Falhas ' + stats.failed + '</span>' +
          '<span class="mini-pill tag-neutral">Sem contato ' + stats.needsContact + '</span>' +
        '</div>' +
      '</div>';
    }

    function renderMessageAutomationTable() {
      if (!messageAutomationTableBody) return;

      if (!messageAutomations.length) {
        messageAutomationTableBody.innerHTML = '<tr><td colspan="8">Nenhuma automação cadastrada</td></tr>';
        updateMessageAutomationSummary();
        renderActivationGuide();
        return;
      }

      messageAutomationTableBody.innerHTML = messageAutomations.map(item => {
        const isActive = item.is_active || item.status === 'active';
        const propertyName = item.property_name || properties.find(property => String(property.id) === String(item.property_id))?.name || '-';
        const automationId = escapeHtml(item.id);
        return `
          <tr>
            <td>${escapeHtml(propertyName)}</td>
            <td>${escapeHtml(triggerLabel(item.trigger_type || item.automation_type))}</td>
          <td>${escapeHtml(item.offset_days ?? item.days_offset ?? 0)}</td>
          <td>${escapeHtml(item.send_time || '-')}</td>
          <td><span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">${isActive ? 'Ativa' : 'Inativa'}</span></td>
            <td>${automationOperationHtml(item)}</td>
            <td><div style="max-width: 320px; white-space: pre-wrap;">${escapeHtml(item.template_text || item.message_template || '-')}</div></td>
            <td>
              <div class="actions-inline">
                <button type="button" data-action="edit-message-automation" data-id="${automationId}">Editar</button>
                <button type="button" data-action="toggle-message-automation" data-id="${automationId}">${isActive ? 'Desativar' : 'Ativar'}</button>
                <button type="button" class="btn-danger" data-action="delete-message-automation" data-id="${automationId}">Excluir</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      updateMessageAutomationSummary();
      renderActivationGuide();
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
      const normalized = String(dateTime).replace('T', ' ');
      const [datePart, timePart = ''] = normalized.split(' ');
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

    /* MESSAGES */
    function renderMessageLogs() {
      if (!messageLogsList) return;

      if (!messageLogs.length) {
        messageLogsList.innerHTML = '<div class="small">Nenhum log de mensagem encontrado para esse filtro.</div>';
        messageLogsList.after(renderPaginationControl('messageLogsPagination', messageLogPagination, (page) => {
          messageLogPagination.page = page;
          loadMessageLogs(currentMessageLogFilter);
        }));
        renderDashboardAlerts();
        return;
      }

      messageLogsList.innerHTML = messageLogs.map(log => `
        <div class="log-item">
          <div class="log-top">
            <strong>${escapeHtml(log.property_name || '-')} - ${escapeHtml(log.guest_name || 'Hóspede')}</strong>
            <span class="status-badge ${messageLogStatusClass(log.status)}">${escapeHtml(messageLogStatusLabel(log.status))}</span>
          </div>
          <div class="small">${escapeHtml(log.automation_name || 'Automação')} - ${escapeHtml(log.channel || 'Canal não informado')}</div>
          <div class="log-meta-grid">
            <div class="log-meta-box"><strong>Contato</strong><br>${escapeHtml(log.guest_contact || '-')}</div>
            <div class="log-meta-box"><strong>Agendado</strong><br>${escapeHtml(formatDateTimeBR(log.scheduled_for))}</div>
            <div class="log-meta-box"><strong>Processado</strong><br>${escapeHtml(formatDateTimeBR(log.processed_at))}</div>
            <div class="log-meta-box"><strong>Erro</strong><br>${escapeHtml(log.error_message || '-')}</div>
          </div>
          <div class="template-preview">${escapeHtml(log.body_rendered || log.message_text || log.content || 'Sem conteúdo registrado.')}</div>
        </div>
      `).join('');
      messageLogsList.after(renderPaginationControl('messageLogsPagination', messageLogPagination, (page) => {
        messageLogPagination.page = page;
        loadMessageLogs(currentMessageLogFilter);
      }));
      renderDashboardAlerts();
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

      const params = new URLSearchParams({
        page: String(messageLogPagination.page || 1),
        limit: String(messageLogPagination.limit || 25)
      });

      if (filter !== 'all') {
        params.set('status', filter);
      }

      try {
        const response = await fetch(`${API_URL}/message-logs?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          messageLogs = [];
          renderMessageLogs();
          return;
        }

        const normalized = normalizePaginatedResponse(data, messageLogPagination.limit);
        messageLogs = normalized.data;
        messageLogPagination = normalized.pagination;

        renderMessageLogs();
        await loadMessageLogSummary();
      } catch (error) {
        messageLogs = [];
        renderMessageLogs();
      }
    }

    async function loadMessageAutomations() {
      if (!token) return;
      if (!hasFullBillingAccess()) {
        clearSensitiveFrontendData();
        return;
      }

      try {
        const [response, logsResponse] = await Promise.all([
          fetch(`${API_URL}/message-automations`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/message-logs?page=1&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const data = await response.json();
        const logsData = await logsResponse.json().catch(() => []);

        if (!response.ok) {
          messageAutomations = [];
          messageAutomationLogs = [];
          renderMessageAutomationTable();
          return;
        }

        messageAutomations = Array.isArray(data) ? data : [];
        messageAutomationLogs = logsResponse.ok ? normalizePaginatedResponse(logsData, 100).data : [];
        renderMessageAutomationTable();
      } catch (error) {
        messageAutomations = [];
        messageAutomationLogs = [];
        renderMessageAutomationTable();
      }
    }

    async function loadRecentMessageLogsLegacy() {
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/message-logs?page=1&limit=10`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
          messageLogs = [];
          renderMessageLogs();
          return;
        }

        messageLogs = normalizePaginatedResponse(data, 10).data;
        renderMessageLogs();
      } catch (error) {
        messageLogs = [];
        renderMessageLogs();
      }
    }



    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function normalizePaginatedResponse(payload, fallbackLimit = 25) {
      if (Array.isArray(payload)) {
        return {
          data: payload,
          pagination: {
            page: 1,
            limit: fallbackLimit,
            total: payload.length,
            totalPages: 1
          }
        };
      }

      const data = Array.isArray(payload?.data) ? payload.data : [];
      const pagination = payload?.pagination || {};

      return {
        data,
        pagination: {
          page: Number(pagination.page || 1),
          limit: Number(pagination.limit || fallbackLimit),
          total: Number(pagination.total || data.length),
          totalPages: Number(pagination.totalPages || 1)
        }
      };
    }

    function renderPaginationControl(targetId, state, onPageChange) {
      let container = document.getElementById(targetId);
      if (!container) {
        container = document.createElement('div');
        container.id = targetId;
        container.className = 'pagination-control';
      }

      const totalPages = Math.max(1, Number(state.totalPages || 1));
      const page = Math.min(Math.max(1, Number(state.page || 1)), totalPages);
      const total = Number(state.total || 0);

      container.innerHTML = `
        <button type="button" class="btn-secondary" data-page-action="prev" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
        <span>Página ${escapeHtml(page)} de ${escapeHtml(totalPages)} · ${escapeHtml(total)} registros</span>
        <button type="button" class="btn-secondary" data-page-action="next" ${page >= totalPages ? 'disabled' : ''}>Próxima</button>
      `;

      container.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
          const direction = button.dataset.pageAction === 'next' ? 1 : -1;
          const nextPage = Math.min(Math.max(1, page + direction), totalPages);
          if (nextPage !== page) onPageChange(nextPage);
        });
      });

      return container;
    }

    function placePaginationAfter(anchor, control) {
      const target = anchor?.closest?.('.table-wrap') || anchor;
      if (target && control) target.after(control);
    }

    function safeExternalUrl(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';

      try {
        const url = new URL(raw, window.location.origin);
        if (!['http:', 'https:', 'webcal:'].includes(url.protocol)) {
          return '';
        }
        return url.href;
      } catch (error) {
        return '';
      }
    }

    function setOperationFeedback(text, type = 'success') {
      const target = document.getElementById('operationFeedback');
      if (!target) return;
      const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'success';
      target.innerHTML = text ? '<div class="message ' + safeType + '">' + escapeHtml(text) + '</div>' : '';
    }

    function getOperationFilters() {
      return {
        status: operationStatusFilter?.value || '',
        propertyId: operationPropertyFilter?.value || '',
        from: operationFromFilter?.value || '',
        to: operationToFilter?.value || ''
      };
    }

    function hasOperationFilters(filters = getOperationFilters()) {
      return Boolean(filters.status || filters.propertyId || filters.from || filters.to);
    }

    function updateOperationPropertyOptions() {
      if (!operationPropertyFilter) return;
      const current = operationPropertyFilter.value;
      operationPropertyFilter.innerHTML = '<option value="">Todos os imóveis</option>' + properties.map(property => '<option value="' + escapeHtml(property.id) + '">' + escapeHtml(property.name || 'Imóvel') + '</option>').join('');
      operationPropertyFilter.value = current;
    }

    function setOperationLoadingState(isLoading) {
      operationDashboardLoading = isLoading;
      [operationRefreshBtn, operationApplyFiltersBtn, operationClearFiltersBtn].forEach(button => {
        if (button) button.disabled = isLoading;
      });
      if (operationRefreshBtn) {
        operationRefreshBtn.textContent = isLoading ? 'Atualizando...' : 'Atualizar operação';
      }
    }

    function getItemDateOnly(value) {
      if (!value) return '';
      return String(value).slice(0, 10);
    }

    function getOperationMessageDate(log) {
      return getItemDateOnly(log.scheduled_for || log.sent_at || log.processed_at || log.created_at);
    }

    function getOperationInboundDate(item) {
      return getItemDateOnly(item.created_at || item.updated_at);
    }

    function matchesOperationStatus(itemStatus, filterStatus, type) {
      const status = String(itemStatus || '').toLowerCase();
      const filter = String(filterStatus || '').toLowerCase();
      if (!filter) return true;

      if (type === 'inbound') {
        if (filter === 'sent') return status === 'processed';
        if (filter === 'failed') return status === 'failed' || status === 'error';
        if (filter === 'queued' || filter === 'needs_contact') return false;
        return status === filter;
      }

      return status === filter;
    }

    function matchesOperationDate(date, filters) {
      if (filters.from && date && date < filters.from) return false;
      if (filters.to && date && date > filters.to) return false;
      return true;
    }

    function isTodayDate(value) {
      if (!value) return false;
      return getItemDateOnly(value) === new Date().toISOString().slice(0, 10);
    }

    function filterOperationMessageLogs(logs) {
      const filters = getOperationFilters();
      return logs.filter(log => {
        if (!matchesOperationStatus(log.status, filters.status, 'message')) return false;
        if (filters.propertyId && String(log.property_id || '') !== String(filters.propertyId)) return false;
        return matchesOperationDate(getOperationMessageDate(log), filters);
      });
    }

    function filterOperationInboundEmails(emails) {
      const filters = getOperationFilters();
      return emails.filter(item => {
        if (!matchesOperationStatus(item.parsing_status, filters.status, 'inbound')) return false;
        if (filters.propertyId && String(item.property_id || '') !== String(filters.propertyId)) return false;
        return matchesOperationDate(getOperationInboundDate(item), filters);
      });
    }

    function updateOperationSummary(logs) {
      const sentToday = logs.filter(log => String(log.status || '') === 'sent' && isTodayDate(log.sent_at || log.processed_at || log.created_at)).length;
      const pending = logs.filter(log => ['pending', 'queued'].includes(String(log.status || ''))).length;
      const failed = logs.filter(log => String(log.status || '') === 'failed').length;
      const needsContact = logs.filter(log => String(log.status || '') === 'needs_contact').length;
      [['operationSentToday', sentToday], ['operationPendingCount', pending], ['operationFailedCount', failed], ['operationNeedsContactCount', needsContact]].forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
      });
    }

    function renderOperationLoading() {
      if (operationMessagesTableBody) operationMessagesTableBody.innerHTML = '<tr><td colspan="6"><div class="operation-loading-row">Carregando mensagens...</div></td></tr>';
      if (operationInboundTableBody) operationInboundTableBody.innerHTML = '<tr><td colspan="6"><div class="operation-loading-row">Carregando inbound emails...</div></td></tr>';
    }

    function renderOperationMessagesTable() {
      if (!operationMessagesTableBody) return;
      const rows = filterOperationMessageLogs(operationMessageLogs).slice(0, 100);
      if (!rows.length) {
        const message = hasOperationFilters()
          ? 'Nenhuma mensagem encontrada para os filtros aplicados.'
          : 'Nenhuma mensagem operacional encontrada.';
        operationMessagesTableBody.innerHTML = '<tr><td colspan="6"><div class="operation-empty-row">' + escapeHtml(message) + '</div></td></tr>';
        return;
      }
      operationMessagesTableBody.innerHTML = rows.map(log => '<tr>' +
        '<td><span class="status-badge ' + messageLogStatusClass(log.status) + '">' + escapeHtml(messageLogStatusLabel(log.status)) + '</span></td>' +
        '<td>' + escapeHtml(log.guest_name || 'Hóspede') + '</td>' +
        '<td>' + escapeHtml(log.property_name || '-') + '</td>' +
        '<td>' + escapeHtml(formatDateTimeBR(log.scheduled_for)) + '</td>' +
        '<td>' + escapeHtml(log.channel || 'email') + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn-secondary" data-operation-action="reprocess-message" data-id="' + escapeHtml(log.id) + '">Reprocessar</button>' +
          '<button type="button" class="btn-success" data-operation-action="force-message" data-id="' + escapeHtml(log.id) + '">Enviar</button>' +
          '<button type="button" data-operation-action="details-message" data-id="' + escapeHtml(log.id) + '">Ver</button>' +
        '</div></td></tr>').join('');
    }

    function inboundStatusClass(status) {
      if (status === 'processed') return 'status-active';
      if (status === 'ignored') return 'tag-neutral';
      if (status === 'failed' || status === 'error') return 'status-inactive';
      return 'tag-pending';
    }

    function inboundStatusLabel(status) {
      if (status === 'processed') return 'Processado';
      if (status === 'ignored') return 'Ignorado';
      if (status === 'failed' || status === 'error') return 'Erro';
      return status || 'Pendente';
    }

    function actionLabel(action) {
      if (action === 'new' || action === 'created') return 'Nova';
      if (action === 'modified' || action === 'updated') return 'Alterada';
      if (action === 'cancelled') return 'Cancelada';
      return action || 'Desconhecida';
    }

    function renderOperationInboundTable() {
      if (!operationInboundTableBody) return;
      const rows = filterOperationInboundEmails(operationInboundEmails).slice(0, 100);
      if (!rows.length) {
        const message = hasOperationFilters()
          ? 'Nenhum inbound encontrado para os filtros aplicados.'
          : 'Nenhum inbound email encontrado.';
        operationInboundTableBody.innerHTML = '<tr><td colspan="6"><div class="operation-empty-row">' + escapeHtml(message) + '</div></td></tr>';
        return;
      }
      operationInboundTableBody.innerHTML = rows.map(item => '<tr>' +
        '<td><span class="status-badge ' + inboundStatusClass(item.parsing_status) + '">' + escapeHtml(inboundStatusLabel(item.parsing_status)) + '</span></td>' +
        '<td>' + escapeHtml(item.platform || 'unknown') + '</td>' +
        '<td>' + escapeHtml(actionLabel(item.action)) + '</td>' +
        '<td><span class="confidence-pill">' + escapeHtml(item.confidence == null ? '-' : item.confidence + '%') + '</span></td>' +
        '<td>' + escapeHtml(item.property_name || 'Não identificado') + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn-secondary" data-operation-action="reprocess-inbound" data-id="' + escapeHtml(item.id) + '">Reprocessar</button>' +
          '<button type="button" data-operation-action="details-inbound" data-id="' + escapeHtml(item.id) + '">Ver</button>' +
        '</div></td></tr>').join('');
    }

    function getOperationAttentionItems() {
      const items = [];
      const filteredLogs = filterOperationMessageLogs(operationMessageLogs);
      const filteredInbound = filterOperationInboundEmails(operationInboundEmails);

      filteredLogs
        .filter(log => String(log.status || '') === 'failed')
        .slice(0, 8)
        .forEach(log => items.push({
          severity: 'danger',
          type: 'message',
          id: log.id,
          title: 'Mensagem com erro',
          detail: (log.guest_name || 'Hóspede') + ' · ' + (log.property_name || '-') + ' · ' + (log.error_message || 'Falha no envio')
        }));

      filteredLogs
        .filter(log => String(log.status || '') === 'needs_contact')
        .slice(0, 8)
        .forEach(log => items.push({
          severity: 'warning',
          type: 'message',
          id: log.id,
          title: 'Mensagem sem contato',
          detail: (log.guest_name || 'Hóspede') + ' · ' + (log.property_name || '-') + ' · confira email/telefone da reserva'
        }));

      filteredInbound
        .filter(item => ['failed', 'error'].includes(String(item.parsing_status || '')) || Number(item.confidence || 0) < 70)
        .slice(0, 8)
        .forEach(item => items.push({
          severity: Number(item.confidence || 0) < 70 ? 'warning' : 'danger',
          type: 'inbound',
          id: item.id,
          title: Number(item.confidence || 0) < 70 ? 'Inbound com baixa confiança' : 'Inbound com erro',
          detail: (item.subject || 'Email recebido') + ' · ' + (item.property_name || 'imóvel não identificado') + ' · score ' + (item.confidence ?? '-')
        }));

      reservations
        .filter(reservation => reservation.source !== 'blocked' && !isReservationCancelled(reservation))
        .filter(reservation => !reservation.guest_email && !reservation.guest_phone)
        .slice(0, 8)
        .forEach(reservation => items.push({
          severity: 'warning',
          type: 'reservation',
          id: reservation.id,
          title: 'Reserva sem contato',
          detail: (reservation.guest_name || 'Hóspede') + ' · ' + (reservation.property_name || '-') + ' · ' + formatDateBR(reservation.start_date)
        }));

      const duplicateMap = new Map();
      reservations.forEach(reservation => {
        if (!reservation.guest_name || reservation.source === 'blocked') return;
        const key = [reservation.property_id, reservation.guest_name.toLowerCase().trim(), reservation.start_date, reservation.end_date].join('|');
        const list = duplicateMap.get(key) || [];
        list.push(reservation);
        duplicateMap.set(key, list);
      });
      duplicateMap.forEach(list => {
        if (list.length > 1) {
          const reservation = list[0];
          items.push({
            severity: 'warning',
            type: 'reservation',
            id: reservation.id,
            title: 'Possível reserva duplicada',
            detail: (reservation.guest_name || 'Hóspede') + ' · ' + formatDateBR(reservation.start_date) + ' até ' + formatDateBR(reservation.end_date)
          });
        }
      });

      return items.slice(0, 12);
    }

    function renderOperationAttentionPanel() {
      if (!operationAttentionList) return;
      const items = getOperationAttentionItems();
      if (!items.length) {
        operationAttentionList.innerHTML = '<div class="operation-empty-row">Nenhum item crítico encontrado para os filtros atuais.</div>';
        return;
      }

      operationAttentionList.innerHTML = items.map(item =>
        '<div class="operation-attention-item ' + escapeHtml(item.severity) + '">' +
          '<div><strong>' + escapeHtml(item.title) + '</strong><div class="small">' + escapeHtml(item.detail) + '</div></div>' +
          '<button type="button" class="btn-secondary" data-attention-type="' + escapeHtml(item.type) + '" data-id="' + escapeHtml(item.id) + '">Abrir</button>' +
        '</div>'
      ).join('');
    }

    async function loadOperationalDashboard() {
      if (!token || operationDashboardLoading) return;
      if (!hasFullBillingAccess()) {
        clearSensitiveFrontendData();
        showSection('billing');
        return;
      }
      setOperationLoadingState(true);
      setOperationFeedback('');
      updateOperationPropertyOptions();
      renderOperationLoading();
      try {
        const filters = getOperationFilters();
        const messageParams = new URLSearchParams({ page: '1', limit: '100' });
        if (filters.propertyId) messageParams.set('property_id', filters.propertyId);
        const inboundParams = new URLSearchParams();
        if (filters.propertyId) inboundParams.set('property_id', filters.propertyId);
        if (filters.from) inboundParams.set('from', filters.from);
        if (filters.to) inboundParams.set('to', filters.to);
        inboundParams.set('limit', '100');
        const responses = await Promise.all([
          fetch(API_URL + '/message-logs?' + messageParams.toString(), { headers: { 'Authorization': 'Bearer ' + token } }),
          fetch(API_URL + '/inbound-emails?' + inboundParams.toString(), { headers: { 'Authorization': 'Bearer ' + token } })
        ]);
        const messageData = await responses[0].json();
        const inboundData = await responses[1].json();
        if (!responses[0].ok) throw new Error(messageData.message || messageData.error || 'Erro ao carregar mensagens.');
        if (!responses[1].ok) throw new Error(inboundData.message || inboundData.error || 'Erro ao carregar inbound emails.');
        operationMessageLogs = normalizePaginatedResponse(messageData, 100).data;
        operationInboundEmails = Array.isArray(inboundData.emails) ? inboundData.emails : [];
        updateOperationSummary(filterOperationMessageLogs(operationMessageLogs));
        renderOperationAttentionPanel();
        renderOperationMessagesTable();
        renderOperationInboundTable();
      } catch (error) {
        operationMessageLogs = [];
        operationInboundEmails = [];
        updateOperationSummary([]);
        renderOperationAttentionPanel();
        renderOperationMessagesTable();
        renderOperationInboundTable();
        setOperationFeedback(error.message || 'Não foi possível carregar o dashboard operacional.', 'error');
      } finally {
        setOperationLoadingState(false);
      }
    }

    function operationField(label, value) {
      const displayValue = value === undefined || value === null || value === '' ? '-' : value;
      return '<div class="operation-detail-field"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(displayValue) + '</strong></div>';
    }

    function operationDetailJson(item) {
      return '<details class="operation-technical-details"><summary>Ver dados técnicos</summary><pre>' + escapeHtml(JSON.stringify(item, null, 2)) + '</pre></details>';
    }

    function renderMessageOperationDetails(item) {
      const status = '<span class="status-badge ' + messageLogStatusClass(item.status) + '">' + escapeHtml(messageLogStatusLabel(item.status)) + '</span>';
      return '<div class="operation-detail-layout">' +
        '<div class="operation-detail-summary">' +
          '<div><div class="summary-label">Mensagem</div><h3>' + escapeHtml(item.subject || 'Mensagem sem assunto') + '</h3></div>' +
          status +
        '</div>' +
        '<div class="operation-detail-grid">' +
          operationField('Hóspede', item.guest_name || 'Hóspede') +
          operationField('Imóvel', item.property_name) +
          operationField('Canal', item.channel || 'email') +
          operationField('Agendada para', formatDateTimeBR(item.scheduled_for)) +
          operationField('Reserva', item.reservation_id ? '#' + item.reservation_id : '-') +
          operationField('Automação', item.automation_name || (item.automation_id ? '#' + item.automation_id : '-')) +
          operationField('Contato', item.guest_contact) +
          operationField('Criada em', formatDateTimeBR(item.created_at)) +
        '</div>' +
        (item.error_message ? '<div class="operation-detail-alert">' + escapeHtml(item.error_message) + '</div>' : '') +
        (item.body_rendered ? '<div class="operation-detail-block"><span>Mensagem renderizada</span><p>' + escapeHtml(item.body_rendered) + '</p></div>' : '') +
        operationDetailJson(item) +
      '</div>';
    }

    function renderInboundOperationDetails(item) {
      const status = '<span class="status-badge ' + inboundStatusClass(item.parsing_status) + '">' + escapeHtml(inboundStatusLabel(item.parsing_status)) + '</span>';
      return '<div class="operation-detail-layout">' +
        '<div class="operation-detail-summary">' +
          '<div><div class="summary-label">Inbound email</div><h3>' + escapeHtml(item.subject || 'Email sem assunto') + '</h3></div>' +
          status +
        '</div>' +
        '<div class="operation-detail-grid">' +
          operationField('Plataforma', item.platform || item.provider || 'unknown') +
          operationField('Ação detectada', actionLabel(item.action)) +
          operationField('Confiança', item.confidence == null ? '-' : item.confidence + '%') +
          operationField('Imóvel identificado', item.property_name || 'Não identificado') +
          operationField('Email de origem', item.from_email) +
          operationField('Email de destino', item.to_email) +
          operationField('Reserva criada', item.created_reservation_id ? '#' + item.created_reservation_id : '-') +
          operationField('Recebido em', formatDateTimeBR(item.created_at)) +
        '</div>' +
        (item.parsing_notes ? '<div class="operation-detail-block"><span>Notas do parser</span><p>' + escapeHtml(item.parsing_notes) + '</p></div>' : '') +
        operationDetailJson(item) +
      '</div>';
    }

    function showOperationDetails(type, id) {
      const item = type === 'message'
        ? operationMessageLogs.find(log => Number(log.id) === Number(id))
        : operationInboundEmails.find(email => Number(email.id) === Number(id));
      if (!item || !operationDetailsCard || !operationDetailsContent) return;
      operationDetailsContent.innerHTML = type === 'message'
        ? renderMessageOperationDetails(item)
        : renderInboundOperationDetails(item);
      operationDetailsCard.classList.remove('hidden');
      operationDetailsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function runOperationAction(url, successMessage, button) {
      if (operationCurrentActionButton) return;
      operationCurrentActionButton = button || null;
      const originalText = button ? button.textContent : '';
      if (button) {
        button.disabled = true;
        button.textContent = 'Processando...';
      }
      setOperationFeedback('Processando ação operacional...');

      try {
        const response = await fetch(url, { method: 'POST', headers: authHeaders() });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || data.error || 'A ação não pôde ser concluída.');
        setOperationFeedback(data.message || successMessage, 'success');
        await loadOperationalDashboard();
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
        operationCurrentActionButton = null;
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
      const isActive = item.is_active || item.status === 'active';
      const confirmed = confirm(isActive
        ? 'Deseja desativar esta automação? Novas mensagens podem deixar de ser agendadas.'
        : 'Deseja ativar esta automação? Ela poderá gerar novos disparos automáticos.');
      if (!confirmed) return;

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
            is_active: !isActive
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

    const CHART_THEME = {
      background: '#0f172a',
      grid: '#263449',
      axis: '#475569',
      label: '#94a3b8',
      income: '#38bdf8',
      expense: '#fb7185',
      profit: '#a78bfa'
    };

    function buildLineChartSvg(monthKeys, monthsMap) {
      const width = 680;
      const height = 240;
      const paddingTop = 18;
      const paddingRight = 24;
      const paddingBottom = 42;
      const paddingLeft = 52;

      const values = monthKeys.flatMap(key => [
        monthsMap[key].income,
        monthsMap[key].expense,
        monthsMap[key].profit
      ]);

      const minValue = Math.min(0, ...values);
      const maxValue = Math.max(1, ...values);
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
        const value = minValue + ((range / yTicks) * i);
        const y = getY(value);
        gridLines.push(`<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="${CHART_THEME.grid}" stroke-width="1" stroke-opacity="0.72" />`);
        yLabels.push(`
          <text x="${paddingLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${CHART_THEME.label}">
            ${Math.round(value).toLocaleString('pt-BR')}
          </text>
        `);
      }

      const zeroY = getY(0);
      const xLabels = monthKeys.map((key, index) => `
        <text x="${getX(index)}" y="${height - 14}" text-anchor="middle" font-size="11" fill="${CHART_THEME.label}">
          ${formatMonthLabel(key)}
        </text>
      `).join('');

      const pointCircles = monthKeys.map((key, index) => {
        const x = getX(index);
        const profitY = getY(monthsMap[key].profit);

        return `
          <circle cx="${x}" cy="${profitY}" r="4" fill="${CHART_THEME.profit}" stroke="${CHART_THEME.background}" stroke-width="2"></circle>
        `;
      }).join('');

      return `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gráfico financeiro em linhas">
          <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="${CHART_THEME.background}"></rect>
          ${gridLines.join('')}
          ${yLabels.join('')}
          <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="${CHART_THEME.axis}" stroke-width="1.2"></line>
          <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="${CHART_THEME.axis}" stroke-width="1.2"></line>
          <line x1="${paddingLeft}" y1="${zeroY}" x2="${width - paddingRight}" y2="${zeroY}" stroke="${CHART_THEME.axis}" stroke-width="1" stroke-dasharray="4 5" stroke-opacity="0.78"></line>

          <path d="${profitPath}" fill="none" stroke="${CHART_THEME.profit}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>

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
        '#38bdf8', '#34d399', '#fb7185', '#fbbf24', '#a78bfa',
        '#2dd4bf', '#f472b6', '#818cf8', '#22d3ee', '#bef264'
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
        gridLines.push(`<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="${CHART_THEME.grid}" stroke-width="1" stroke-opacity="0.72" />`);
        yLabels.push(`
          <text x="${paddingLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${CHART_THEME.label}">
            ${Math.round(value).toLocaleString('pt-BR')}
          </text>
        `);
      }

      const zeroY = getY(0);
      const xLabels = monthKeys.map((key, index) => `
        <text x="${getX(index)}" y="${height - 14}" text-anchor="middle" font-size="11" fill="${CHART_THEME.label}">
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
          return `<circle cx="${x}" cy="${y}" r="3.5" fill="${series.color}" stroke="${CHART_THEME.background}" stroke-width="2"></circle>`;
        }).join('');
      }).join('');

      return `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gráfico de lucro ou prejuízo por imóvel">
          <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="${CHART_THEME.background}"></rect>
          ${gridLines.join('')}
          ${yLabels.join('')}
          <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="${CHART_THEME.axis}" stroke-width="1.2"></line>
          <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="${CHART_THEME.axis}" stroke-width="1.2"></line>
          <line x1="${paddingLeft}" y1="${zeroY}" x2="${width - paddingRight}" y2="${zeroY}" stroke="${CHART_THEME.axis}" stroke-width="1" stroke-dasharray="4 5" stroke-opacity="0.78"></line>
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
            <span class="property-lines-dot" style="background:${escapeHtml(series.color)};"></span>
            <span class="property-lines-name">${escapeHtml(series.name)}</span>
          </div>
          <div class="property-lines-value ${series.total >= 0 ? 'income-value' : 'expense-value'}">${escapeHtml(formatMoney(series.total))}</div>
        </div>
      `).join('');
    }

    function renderPropertyRanking() {
      const container = document.getElementById('propertyRankingContent');

      if (!allFinancialEntries.length || !properties.length) {
        container.innerHTML = '<div class="small">Sem dados suficientes para montar o ranking.</div>';
        updateDashboardPerformanceHighlights([]);
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
        updateDashboardPerformanceHighlights([]);
        return;
      }

      updateDashboardPerformanceHighlights(ranking);

      container.innerHTML = ranking.map((item, index) => `
        <div class="ranking-item">
          <div class="ranking-top">
            <div class="ranking-name">${index + 1}. ${escapeHtml(item.property_name)}</div>
            <div class="${item.profit >= 0 ? 'income-value' : 'expense-value'}">${escapeHtml(formatMoney(item.profit))}</div>
          </div>
          <div class="ranking-meta">
            <span>Receitas: <strong>${escapeHtml(formatMoney(item.income))}</strong></span>
            <span>Despesas: <strong>${escapeHtml(formatMoney(item.expense))}</strong></span>
          </div>
        </div>
      `).join('');
    }

    function updateDashboardPerformanceHighlights(ranking = []) {
      const best = ranking[0];
      const worst = ranking.length > 1 ? ranking[ranking.length - 1] : null;

      setText('dashboardBestProperty', best ? best.property_name : '-');
      setText('dashboardBestPropertyValue', best ? formatMoney(best.profit) + ' de lucro' : 'Sem dados suficientes.');
      setText('dashboardWorstProperty', worst ? worst.property_name : '-');
      setText('dashboardWorstPropertyValue', worst ? formatMoney(worst.profit) + ' de resultado' : 'Sem dados suficientes.');
    }

    function getDateOnly(value) {
      if (!value) return null;
      const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function daysBetween(start, end) {
      return Math.max(0, Math.ceil((end - start) / 86400000));
    }

    function calculateCurrentMonthOccupancy() {
      if (!selectedPropertyId || !reservations.length) return 0;

      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 12);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1, 12);
      const daysInMonth = daysBetween(monthStart, monthEnd);
      let occupiedDays = 0;

      reservations.forEach(reservation => {
        if (reservation.status === 'cancelled' || reservation.status === 'canceled') return;
        const start = getDateOnly(reservation.start_date);
        const end = getDateOnly(reservation.end_date);
        if (!start || !end) return;

        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;
        occupiedDays += daysBetween(overlapStart, overlapEnd);
      });

      return daysInMonth ? Math.min(100, Math.round((occupiedDays / daysInMonth) * 100)) : 0;
    }

    function renderDashboardOperations() {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const nextSevenDays = new Date(today);
      nextSevenDays.setDate(nextSevenDays.getDate() + 7);

      const activeReservations = reservations.filter(reservation => !['cancelled', 'canceled'].includes(String(reservation.status || '').toLowerCase()));
      const futureReservations = activeReservations.filter(reservation => {
        const start = getDateOnly(reservation.start_date);
        return start && start >= today;
      }).sort((a, b) => getDateOnly(a.start_date) - getDateOnly(b.start_date));

      const checkins = futureReservations.filter(reservation => {
        const start = getDateOnly(reservation.start_date);
        return start && start >= today && start <= nextSevenDays;
      });

      const checkouts = activeReservations.filter(reservation => {
        const end = getDateOnly(reservation.end_date);
        return end && end >= today && end <= nextSevenDays;
      });

      setText('dashboardUpcomingReservations', String(futureReservations.length));
      setText('dashboardUpcomingCheckins', String(checkins.length));
      setText('dashboardUpcomingCheckouts', String(checkouts.length));
      setText('dashboardUpcomingReservationsText', futureReservations[0]
        ? `Próxima: ${futureReservations[0].guest_name || 'Hóspede'} em ${formatDateBR(futureReservations[0].start_date)}.`
        : 'Nenhuma reserva futura.');
      setText('summaryOccupancy', `${calculateCurrentMonthOccupancy()}%`);
    }

    function renderDashboardAlerts() {
      const noContactReservations = reservations.filter(reservation => {
        if (['cancelled', 'canceled'].includes(String(reservation.status || '').toLowerCase())) return false;
        return !reservation.guest_email && !reservation.guest_phone && !reservation.phone;
      });
      const automationIssues = messageLogs.filter(log => ['pending', 'failed', 'needs_contact'].includes(String(log.status || '').toLowerCase()));
      const recentErrors = messageLogs.filter(log => String(log.status || '').toLowerCase() === 'failed');

      setText('dashboardNoContact', String(noContactReservations.length));
      setText('dashboardAutomationIssues', String(automationIssues.length));
      setText('dashboardRecentErrors', String(recentErrors.length));
    }

    /* DASHBOARD */
    function renderDashboardValueBlocks() {
      renderDashboardOperations();
      renderDashboardAlerts();
    }

    async function loadFinancialDashboard() {
      if (!hasFullBillingAccess()) return;

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

    /* AUTH */
    async function registerUser() {
      clearMessage('authMessage');

      const name = document.getElementById('registerName').value.trim();
      const email = document.getElementById('registerEmail').value.trim();
      const cpf = onlyDigits(document.getElementById('registerCpf').value);
      const password = document.getElementById('registerPassword').value.trim();

      if (!name || !email || !cpf || !password) {
        showMessage('authMessage', 'Preencha nome, e-mail, CPF e senha para criar a conta.', 'error');
        return;
      }

      if (!isValidCpf(cpf)) {
        showMessage('authMessage', 'CPF inválido. Confira os números e tente novamente.', 'error');
        return;
      }

      try {
        setButtonLoading(registerBtn, true, 'Cadastrando...');

        await apiFetch('/auth/register', {
          method: 'POST',
          auth: false,
          body: { name, email, cpf, password },
          errorMessage: 'Não foi possível cadastrar este usuário.'
        });

        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = password;
        showMessage('authMessage', 'Conta criada com sucesso. Entrando no StayFlow...', 'success');

        try {
          setButtonLoading(loginBtn, true, 'Entrando...');

          const loginData = await apiFetch('/auth/login', {
            method: 'POST',
            auth: false,
            body: { email, password },
            errorMessage: 'A conta foi criada, mas não foi possível entrar automaticamente.'
          });

          token = loginData?.data?.token || loginData.token || '';
          loggedUser = loginData?.data?.user || loginData.user || null;

          if (!token || !loggedUser) {
            throw new Error('A conta foi criada, mas o login automático recebeu uma resposta inválida.');
          }

          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(loggedUser));

          await enterApp();
          if (hasFullBillingAccess()) {
            await loadProperties();
          }
          document.getElementById('registerPassword').value = '';
          return;
        } catch (autoLoginError) {
          showMessage('authMessage', autoLoginError.message || 'Conta criada com sucesso. Faça login para continuar.', 'success');
        } finally {
          setButtonLoading(loginBtn, false);
        }
      } catch (error) {
        showMessage('authMessage', error.message || 'Erro ao conectar com o backend.', 'error');
      } finally {
        setButtonLoading(registerBtn, false);
      }
    }

    async function login() {
      clearMessage('authMessage');

      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();

      if (!email || !password) {
        showMessage('authMessage', 'Informe e-mail e senha para entrar.', 'error');
        return;
      }

      try {
        setButtonLoading(loginBtn, true, 'Entrando...');

        const data = await apiFetch('/auth/login', {
          method: 'POST',
          auth: false,
          body: { email, password },
          errorMessage: 'Não foi possível entrar. Confira seus dados.'
        });

        token = data?.data?.token || data.token || '';
        loggedUser = data?.data?.user || data.user || null;

        if (!token || !loggedUser) {
          showMessage('authMessage', 'Resposta de login inválida do backend.', 'error');
          return;
        }

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(loggedUser));

        await enterApp();
        if (hasFullBillingAccess()) {
          await loadProperties();
        }
      } catch (error) {
        showMessage('authMessage', error.message || 'Erro ao conectar com o backend.', 'error');
      } finally {
        setButtonLoading(loginBtn, false);
      }
    }

    async function requestPasswordReset() {
      clearMessage('authMessage');

      const email = document.getElementById('forgotPasswordEmail').value.trim();
      if (!email) {
        showMessage('authMessage', 'Informe o e-mail da conta para receber as instruções.', 'error');
        return;
      }

      try {
        setButtonLoading(forgotPasswordBtn, true, 'Enviando...');

        const data = await apiFetch('/auth/forgot-password', {
          method: 'POST',
          auth: false,
          body: { email },
          errorMessage: 'Não foi possível solicitar a recuperação.'
        });

        const devToken = data?.data?.reset_token;
        if (devToken && document.getElementById('resetToken')) {
          document.getElementById('resetToken').value = devToken;
        }

        showMessage('authMessage', data.message || 'Se o e-mail estiver cadastrado, enviaremos as instruções para redefinir sua senha.', 'success');
      } catch (error) {
        showMessage('authMessage', error.message || 'Erro ao conectar com o backend.', 'error');
      } finally {
        setButtonLoading(forgotPasswordBtn, false);
      }
    }

    async function resetPassword() {
      clearMessage('authMessage');

      const tokenValue = document.getElementById('resetToken').value.trim();
      const password = document.getElementById('resetPassword').value.trim();

      if (!tokenValue || !password) {
        showMessage('authMessage', 'Informe o token recebido e a nova senha.', 'error');
        return;
      }

      if (password.length < 6) {
        showMessage('authMessage', 'A nova senha precisa ter pelo menos 6 caracteres.', 'error');
        return;
      }

      try {
        setButtonLoading(resetPasswordBtn, true, 'Redefinindo...');

        const data = await apiFetch('/auth/reset-password', {
          method: 'POST',
          auth: false,
          body: { token: tokenValue, password },
          errorMessage: 'Não foi possível redefinir a senha.'
        });

        document.getElementById('resetPassword').value = '';
        document.getElementById('loginPassword').value = '';
        showMessage('authMessage', data.message || 'Senha redefinida com sucesso. Faça login com a nova senha.', 'success');
      } catch (error) {
        showMessage('authMessage', error.message || 'Erro ao conectar com o backend.', 'error');
      } finally {
        setButtonLoading(resetPasswordBtn, false);
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
      billingOverview = null;
      billingPayments = [];
      billingAccessState = {
        billingStatus: 'TRIAL',
        accessStatus: 'FULL'
      };

      authCard.classList.remove('hidden');
      app.classList.add('hidden');
      showSection('dashboard');
    }

    async function enterApp() {
      authCard.classList.add('hidden');
      app.classList.remove('hidden');
      userInfo.textContent = loggedUser
        ? `Logado como ${loggedUser.name} (${loggedUser.email})`
        : 'Usuário logado';

      try {
        await loadBillingOverview();
      } catch (error) {
        billingAccessState = { billingStatus: 'BLOCKED', accessStatus: 'BLOCKED' };
        applyBillingAccessControls();
      }

      showSection(preferredSectionForBillingAccess());

      if (canAccessMyInfo()) {
        loadMyInfo({ silent: true });
      }
    }

    async function loadMyInfo(options = {}) {
      try {
        const data = await apiFetch('/auth/me', {
          errorMessage: 'Erro ao carregar suas informações.'
        });

        currentUserDetails = data?.data?.user || null;
        if (currentUserDetails) {
          loggedUser = { ...loggedUser, ...currentUserDetails };
          localStorage.setItem('user', JSON.stringify(loggedUser));
        }
        renderMyInfo();
        updateOnboardingIntegrationEmail();
        return currentUserDetails;
      } catch (error) {
        currentUserDetails = loggedUser || currentUserDetails;
        renderMyInfo();
        updateOnboardingIntegrationEmail();
        if (!options.silent) {
          showMessage('myInfoMessage', error.message.includes('/auth/me')
            ? 'O backend precisa ser reiniciado para carregar todos os dados da conta. Enquanto isso, exibimos as informações já salvas no navegador.'
            : (error.message || 'Erro ao conectar com o backend.'), 'error');
        }
        return null;
      }
    }

    function renderBillingAlert(overview = {}) {
      const alert = document.getElementById('billingAlert');
      const title = document.getElementById('billingAlertTitle');
      const text = document.getElementById('billingAlertText');
      if (!alert || !title || !text) return;

      const status = String(getBillingStatusFromOverview(overview)).toUpperCase();
      const accessStatus = String(getBillingAccessFromOverview(overview)).toUpperCase();
      const daysRemaining = Number(overview.trial?.days_remaining ?? 0);

      alert.className = 'billing-alert';

      if (status === 'PAST_DUE') {
        alert.classList.add('billing-alert-warning');
        title.textContent = 'Pagamento em atraso';
        text.textContent = 'Seu acesso pode ficar limitado até a regularização da cobrança.';
        return;
      }

      if (['CANCELED', 'CANCELLED', 'BLOCKED', 'EXPIRED'].includes(status) || accessStatus === 'BLOCKED') {
        alert.classList.add('billing-alert-danger');
        title.textContent = 'Acesso bloqueado ou assinatura cancelada';
        text.textContent = 'Ative uma assinatura para voltar a operar o StayFlow normalmente.';
        return;
      }

      if (status === 'ACTIVE') {
        alert.classList.add('billing-alert-success');
        title.textContent = 'Assinatura ativa';
        text.textContent = 'Sua conta está com acesso total e pronta para operar.';
        return;
      }

      if (status === 'TRIAL' && daysRemaining <= 3) {
        alert.classList.add('billing-alert-warning');
        title.textContent = 'Trial acabando';
        text.textContent = `Restam ${Math.max(daysRemaining, 0)} dia(s) de trial. Ative a assinatura para evitar bloqueio.`;
        return;
      }

      alert.classList.add('billing-alert-info');
      title.textContent = 'Trial ativo';
      text.textContent = 'Você pode usar o StayFlow normalmente durante o período de teste.';
    }

    /* BILLING */
    function renderBillingOverview() {
      const overview = billingOverview || {};
      billingAccessState = normalizeBillingAccessFromOverview(overview);
      const billing = overview.billing || {};
      const subscription = overview.subscription || {};
      const trial = overview.trial || {};
      const planStatus = getBillingStatusFromOverview(overview);
      const accessStatus = getBillingAccessFromOverview(overview);
      const currentAmount = billing.calculated_amount ?? billing.calculatedAmount ?? subscription.value ?? 0;
      const nextDate = subscription.next_due_date || subscription.remote_next_due_date || billing.next_billing_date;
      const nextAmount = subscription.value || currentAmount;

      setText('billingPlanName', billing.plan_name || 'StayFlow Base');
      setText('billingPlanStatus', billingStatusLabel(planStatus));
      setText('billingTrialDays', trial.days_remaining == null ? '-' : String(trial.days_remaining));
      setText('billingTrialEndsAt', formatBillingDate(trial.ends_at || billing.trial_ends_at));
      setText('billingAccessStatus', billingStatusLabel(accessStatus));
      setText('billingCurrentAmount', formatMoney(currentAmount));
      setText('billingActiveProperties', billing.active_properties_count ?? 0);
      setText('billingAdditionalProperties', billing.additional_properties_count ?? 0);
      setText('billingNextDate', formatBillingDate(nextDate));
      setText('billingNextAmount', formatMoney(nextAmount));

      const badge = document.getElementById('billingStatusBadge');
      if (badge) {
        badge.textContent = billingStatusLabel(planStatus);
        badge.className = `status-badge ${billingStatusClass(planStatus)}`;
      }

      renderBillingAlert(overview);
      applyBillingAccessControls();
    }

    function renderBillingPayments() {
      if (!billingPaymentsTableBody) return;

      if (!billingPayments.length) {
        billingPaymentsTableBody.innerHTML = '<tr><td colspan="5">Nenhum pagamento encontrado.</td></tr>';
        return;
      }

      billingPaymentsTableBody.innerHTML = billingPayments.map(payment => {
        const invoiceUrl = safeExternalUrl(payment.invoice_url || payment.invoiceUrl || '');
        const status = payment.status || 'PENDING';
        const paidAt = payment.payment_date || payment.paymentDate || payment.confirmed_date || payment.confirmedDate;

        return `
          <tr>
            <td><span class="status-badge ${billingStatusClass(status)}">${escapeHtml(billingStatusLabel(status))}</span></td>
            <td>${escapeHtml(formatMoney(payment.value))}</td>
            <td>${escapeHtml(formatBillingDate(payment.due_date || payment.dueDate))}</td>
            <td>${escapeHtml(formatBillingDate(paidAt))}</td>
            <td>${invoiceUrl ? `<a href="${escapeHtml(invoiceUrl)}" target="_blank" rel="noopener noreferrer">Abrir fatura</a>` : '-'}</td>
          </tr>
        `;
      }).join('');
    }

    async function loadBillingOverview() {
      const data = await apiFetch('/billing/me', {
        errorMessage: 'Não foi possível carregar sua assinatura.'
      });

      billingOverview = data.data || {};
      renderBillingOverview();
    }

    async function loadBillingPayments() {
      if (billingPaymentsTableBody) {
        billingPaymentsTableBody.innerHTML = '<tr><td colspan="5">Carregando pagamentos...</td></tr>';
      }

      const data = await apiFetch('/billing/payments', {
        errorMessage: 'Não foi possível carregar os pagamentos.'
      });

      billingPayments = Array.isArray(data.data) ? data.data : [];
      renderBillingPayments();
    }

    async function loadBillingDashboard(options = {}) {
      if (!token) return;
      clearMessage('billingMessage');

      if (options.showLoading !== false) {
        setText('billingPlanStatus', 'Carregando...');
        if (billingPaymentsTableBody) {
          billingPaymentsTableBody.innerHTML = '<tr><td colspan="5">Carregando pagamentos...</td></tr>';
        }
      }

      try {
        await Promise.all([
          loadBillingOverview(),
          loadBillingPayments()
        ]);
      } catch (error) {
        showMessage('billingMessage', error.message || 'Erro ao conectar com o backend.', 'error');
      }
    }

    async function runBillingAction(button, endpoint, options = {}) {
      if (!token) return;
      clearMessage('billingMessage');
      setButtonLoading(button, true, options.loadingText || 'Processando...');

      try {
        const data = await apiFetch(endpoint, {
          method: 'POST',
          body: options.body || {},
          errorMessage: options.errorMessage || 'Não foi possível concluir a ação.'
        });

        showMessage('billingMessage', data.message || options.successMessage || 'Ação concluída com sucesso.', 'success');
        await loadBillingDashboard({ showLoading: false });
      } catch (error) {
        showMessage('billingMessage', error.message || 'Erro ao conectar com o backend.', 'error');
      } finally {
        setButtonLoading(button, false);
      }
    }

    function activateBilling() {
      runBillingAction(activateBillingBtn, '/billing/activate-subscription', {
        loadingText: 'Ativando...',
        successMessage: 'Assinatura ativada com sucesso.',
        errorMessage: 'Não foi possível ativar a assinatura.',
        body: { billingType: billingTypeSelect?.value || 'PIX' }
      });
    }

    function cancelBilling() {
      if (!confirm('Tem certeza que deseja cancelar a assinatura? O acesso pode ser bloqueado conforme as regras de cobrança.')) return;

      runBillingAction(cancelBillingBtn, '/billing/cancel-subscription', {
        loadingText: 'Cancelando...',
        successMessage: 'Assinatura cancelada com sucesso.',
        errorMessage: 'Não foi possível cancelar a assinatura.'
      });
    }

    function recalculateBilling() {
      runBillingAction(recalculateBillingBtn, '/billing/recalculate', {
        loadingText: 'Recalculando...',
        successMessage: 'Plano recalculado com sucesso.',
        errorMessage: 'Não foi possível recalcular o plano.'
      });
    }

    function renderMyInfo() {
      const user = currentUserDetails || loggedUser || {};
      const onboardingState = getOnboardingState();
      const activationStatus = getOnboardingActivationStatus();
      const setupStatus = isOnboardingDone()
        ? 'Onboarding concluído'
        : onboardingState === 'skipped'
          ? 'Onboarding pulado'
          : activationStatus.hasProperty
            ? 'Configuração em progresso'
            : 'Configuração pendente';
      const pairs = [
        ['myInfoName', user.name || '-'],
        ['myInfoEmail', user.email || '-'],
        ['myInfoCpf', user.cpf || '-'],
        ['myInfoSetupStatus', setupStatus],
        ['myInfoIntegrationEmail', user.inbound_alias || 'E-mail ainda não disponível'],
        ['myInfoOnboardingStatus', setupStatus]
      ];

      pairs.forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      });

      userInfo.textContent = user.email
        ? `Logado como ${user.name || 'Usuário'} (${user.email})`
        : userInfo.textContent;
    }

    /* PROPERTIES */
    async function loadProperties() {
      if (!hasFullBillingAccess()) {
        clearSensitiveFrontendData();
        return;
      }

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
        maybeOpenOnboarding();

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
          selectedPropertyInfo.innerHTML = 'Cadastre seu primeiro imóvel para começar a centralizar reservas, calendário e automações.';
          icalLinkBox.innerHTML = 'Depois de cadastrar um imóvel, cole aqui os links iCal do Airbnb ou Booking.';
          reservationsTableBody.innerHTML = '<tr><td colspan="8">Cadastre um imóvel e conecte o iCal para começar a centralizar reservas.</td></tr>';
          financialTableBody.innerHTML = '<tr><td colspan="10">Os lançamentos aparecem depois que você cadastrar imóvel e reservas.</td></tr>';
          calendarGrid.innerHTML = '';
          updateSummaryCards({ total_income: 0, total_expense: 0, total_pending: 0, profit: 0 });
          updateSummaryMirrors({ total_income: 0, total_expense: 0, total_pending: 0, profit: 0 });
          resetReservationFinanceCard();
          renderMonthlyChart();
          renderPropertyProfitChart();
          renderPropertyRanking();
          messageAutomations = [];
          messageAutomationLogs = [];
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
    propertyList.innerHTML = '<div class="empty-state"><strong>Cadastre seu primeiro imóvel para começar</strong><br><span>Esse é o primeiro passo para conectar iCal, receber reservas e ativar automações.</span></div>';
    renderActivationGuide();
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
      <div class="property-title">${escapeHtml(property.name)}</div>
      <div class="small">${escapeHtml(cityState || '')}</div>
      <div class="small">${escapeHtml(property.address || '')}</div>
      <div class="small"><strong>Plataforma:</strong> ${escapeHtml(listingPlatform)}</div>
      <div class="small"><strong>${escapeHtml(listingCode)}</strong></div>
      <div class="small" style="word-break: break-all;"><strong>Anúncio:</strong> ${escapeHtml(listingUrl)}</div>
    `;

    div.addEventListener('click', async () => {
      selectedPropertyId = property.id;
      reservationPagination.page = 1;
      financialPagination.page = 1;

      selectedPropertyInfo.innerHTML = `
        <div><strong>${escapeHtml(property.name)}</strong></div>
        <div>${escapeHtml(cityState || 'Cidade não informada')}</div>
        <div>${escapeHtml(property.address || 'Endereço não informado')}</div>
        <div><strong>Plataforma:</strong> ${escapeHtml(listingPlatform)}</div>
        <div><strong>${escapeHtml(listingCode)}</strong></div>
        <div style="word-break: break-all;"><strong>Anúncio:</strong> ${escapeHtml(listingUrl)}</div>
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

    async function createOnboardingProperty() {
      const body = {
        name: document.getElementById('onboardingPropertyName').value.trim(),
        description: 'Criado pelo onboarding do StayFlow',
        address: '',
        city: document.getElementById('onboardingPropertyCity').value.trim(),
        state: '',
        country: 'Brasil',
        listing_url: document.getElementById('onboardingListingUrl').value.trim(),
        airbnb_ical_url: '',
        booking_ical_url: ''
      };

      if (!body.name || !body.city || !body.listing_url) {
        showMessage('onboardingMessage', 'Preencha nome, cidade e URL do anúncio para continuar.', 'error');
        return false;
      }

      const response = await fetch(`${API_URL}/properties`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (!response.ok) {
        showMessage('onboardingMessage', extractApiError(data, 'Não foi possível cadastrar o imóvel.'), 'error');
        return false;
      }

      const createdProperty = data.property || data.data?.property || null;
      onboardingPropertyId = createdProperty?.id || null;
      selectedPropertyId = onboardingPropertyId || selectedPropertyId;
      updateOnboardingProgress({ property_created: true });
      await loadProperties();
      showMessage('onboardingMessage', 'Imóvel cadastrado. Agora conecte calendários e notificações.', 'success');
      return true;
    }

    async function saveOnboardingCalendars() {
      const propertyId = onboardingPropertyId || selectedPropertyId || properties[0]?.id;
      const property = properties.find(item => Number(item.id) === Number(propertyId));
      const airbnbIcal = document.getElementById('onboardingAirbnbIcal').value.trim();
      const bookingIcal = document.getElementById('onboardingBookingIcal').value.trim();

      if (!property) {
        showMessage('onboardingMessage', 'Cadastre um imóvel antes de sincronizar calendários.', 'error');
        return false;
      }

      if (!airbnbIcal && !bookingIcal) {
        showMessage('onboardingMessage', 'Para concluir o onboarding, cole pelo menos um link iCal. Se preferir fazer isso depois, use "Pular por agora".', 'error');
        return false;
      }

      const response = await fetch(`${API_URL}/properties/${property.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          name: property.name,
          description: property.description || '',
          address: property.address || '',
          city: property.city,
          state: property.state || '',
          country: property.country || 'Brasil',
          listing_url: property.listing_url || property.property_listings?.[0]?.listing_url || '',
          airbnb_ical_url: airbnbIcal || property.airbnb_ical_url || '',
          booking_ical_url: bookingIcal || property.booking_ical_url || ''
        })
      });
      const data = await response.json();

      if (!response.ok) {
        showMessage('onboardingMessage', extractApiError(data, 'Não foi possível salvar os calendários.'), 'error');
        return false;
      }

      await loadProperties();
      updateOnboardingProgress({ calendar_connected: true });
      try {
        await fetch(`${API_URL}/sync/${property.id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        document.getElementById('onboardingCalendarFeedback').textContent = 'Calendários salvos. A sincronização foi solicitada.';
      } catch (error) {
        document.getElementById('onboardingCalendarFeedback').textContent = 'Calendários salvos. Se precisar, sincronize depois pela área de Imóveis.';
      }
      return true;
    }

    async function createOnboardingAutomation() {
      const shouldEnable = document.getElementById('onboardingEnableAutomation')?.checked;
      const propertyId = onboardingPropertyId || selectedPropertyId || properties[0]?.id;

      if (!shouldEnable || !propertyId) {
        updateOnboardingProgress({ automation_step_completed: true });
        return true;
      }

      const response = await fetch(`${API_URL}/message-automations`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          property_id: propertyId,
          trigger_type: 'pre_check_in',
          offset_days: 1,
          send_time: '09:00',
          template_text: 'Olá {nome_hospede}, seu check-in está chegando. Em breve enviaremos as informações do imóvel {nome_imovel} para deixar sua chegada tranquila.',
          is_active: true
        })
      });
      const data = await response.json();

      if (!response.ok) {
        showMessage('onboardingMessage', extractApiError(data, 'Não foi possível criar a automação inicial. Você pode configurar depois.'), 'error');
        updateOnboardingProgress({ automation_step_completed: true });
        return true;
      }

      await loadMessageAutomations();
      updateOnboardingProgress({ automation_step_completed: true });
      return true;
    }

    async function advanceOnboarding() {
      clearMessage('onboardingMessage');

      if (onboardingStep === 1) {
        onboardingStep = 2;
        renderOnboardingStep();
        return;
      }

      if (onboardingStep === 2) {
        setButtonLoading(onboardingNextBtn, true, 'Cadastrando...');
        const ok = await createOnboardingProperty();
        setButtonLoading(onboardingNextBtn, false);
        if (!ok) return;
        onboardingStep = 3;
        renderOnboardingStep();
        return;
      }

      if (onboardingStep === 3) {
        const progress = getOnboardingProgress();
        if (!progress.email_copied || !progress.notifications_seen) {
          showMessage('onboardingMessage', 'Copie o e-mail do StayFlow ou marque que entendeu onde cadastrá-lo antes de continuar.', 'error');
          return;
        }
        setButtonLoading(onboardingNextBtn, true, 'Sincronizando...');
        const ok = await saveOnboardingCalendars();
        setButtonLoading(onboardingNextBtn, false);
        if (!ok) return;
        onboardingStep = 4;
        renderOnboardingStep();
        return;
      }

      if (onboardingStep === 4) {
        setButtonLoading(onboardingNextBtn, true, 'Preparando...');
        const ok = await createOnboardingAutomation();
        setButtonLoading(onboardingNextBtn, false);
        if (!ok) return;
        onboardingStep = 5;
        renderOnboardingStep();
        return;
      }

      if (!canCompleteOnboarding()) {
        showMessage('onboardingMessage', 'Ainda falta uma etapa de ativação. Conecte pelo menos um iCal e confirme o uso do e-mail do StayFlow, ou pule por agora.', 'error');
        onboardingStep = 3;
        renderOnboardingStep();
        return;
      }

      markOnboardingDone();
      closeOnboarding();
      showSection('dashboard');
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
      if (!hasFullBillingAccess()) {
        clearSensitiveFrontendData();
        return;
      }

      try {
        const pagedParams = new URLSearchParams({
          page: String(reservationPagination.page || 1),
          limit: String(reservationPagination.limit || 25)
        });
        const allParams = new URLSearchParams();

        if (selectedPropertyId) {
          pagedParams.set('property_id', String(selectedPropertyId));
          allParams.set('property_id', String(selectedPropertyId));
        }

        const [pagedResponse, fullResponse] = await Promise.all([
          fetch(`${API_URL}/reservations?${pagedParams.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_URL}/reservations?${allParams.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const data = await pagedResponse.json();
        const fullData = await fullResponse.json();

        if (!pagedResponse.ok || !fullResponse.ok) {
          alert(data.error || 'Erro ao carregar reservas');
          return;
        }

        const normalized = normalizePaginatedResponse(data, reservationPagination.limit);
        reservationTableRows = normalized.data;
        reservationPagination = normalized.pagination;
        reservations = Array.isArray(fullData) ? fullData : normalizePaginatedResponse(fullData, 200).data;

        renderSelectedPropertyInfo();
        renderReservationsTable();
        renderCalendar();
        renderFinancialReservationOptions(financialReservation.value);
        renderDashboardValueBlocks();
      } catch (error) {
        alert('Erro ao carregar reservas');
      }
    }

    function renderSelectedPropertyInfo() {
      const property = properties.find(p => Number(p.id) === Number(selectedPropertyId));

      if (!property) {
        selectedPropertyInfo.textContent = 'Selecione ou cadastre um imóvel para ver reservas, calendário e links iCal.';
        if (selectedPropertyBadge) selectedPropertyBadge.textContent = 'Nenhum imóvel selecionado';
        icalLinkBox.textContent = 'Conecte o iCal para começar a sincronizar calendário.';
        return;
      }

      selectedPropertyInfo.innerHTML = `
        <strong>${escapeHtml(property.name)}</strong><br>
        ${escapeHtml(property.city || '')} ${property.state ? '- ' + escapeHtml(property.state) : ''}<br>
        ${escapeHtml(property.address || '')}<br>
        Reservas/bloqueios: <strong>${escapeHtml(reservationPagination.total || reservations.length)}</strong>
      `;

      if (selectedPropertyBadge) {
        selectedPropertyBadge.textContent = `Imóvel: ${property.name}`;
      }

      const internalIcalUrl = safeExternalUrl(property.internal_ical_url);
      icalLinkBox.innerHTML = internalIcalUrl
        ? `<a href="${escapeHtml(internalIcalUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(internalIcalUrl)}</a>`
        : 'iCal não disponível';
    }

    function renderReservationsTable() {
      if (!reservationTableRows.length) {
        reservationsTableBody.innerHTML = '<tr><td colspan="8">Nenhuma reserva ainda. Conecte o iCal ou cadastre uma reserva manual para começar.</td></tr>';
        placePaginationAfter(reservationsTableBody, renderPaginationControl('reservationsPagination', reservationPagination, (page) => {
          reservationPagination.page = page;
          loadReservations();
        }));
        return;
      }

      reservationsTableBody.innerHTML = reservationTableRows.map(item => {
        const reservationId = escapeHtml(item.id);
        return `
        <tr class="${item.source !== 'blocked' ? 'reservation-row-clickable' : ''} ${Number(selectedReservationId) === Number(item.id) ? 'active-row' : ''} ${isReservationCancelled(item) ? 'reservation-row-cancelled' : ''}" data-id="${reservationId}">
          <td>${reservationId}</td>
          <td>${escapeHtml(item.guest_name || '-')}</td>
          <td>${escapeHtml(sourceLabel(item.source))}</td>
          <td>${escapeHtml(formatDateBR(item.start_date))}</td>
          <td>${escapeHtml(formatDateBR(item.end_date))}</td>
          <td>${escapeHtml(item.total_amount !== null && item.total_amount !== undefined ? formatMoney(item.total_amount) : '-')}</td>
          <td><span class="status-badge ${reservationStatusClass(item.status)}">${escapeHtml(reservationStatusLabel(item.status))}</span></td>
          <td>
            <div class="row-actions">
              <button type="button" data-action="view-reservation-details" data-id="${reservationId}">Detalhes</button>
              ${item.source !== 'blocked'
                ? `<button type="button" class="btn-secondary" data-action="view-reservation-finance" data-id="${reservationId}">Ver lucro</button>`
                : ''}
            </div>
          </td>
        </tr>
      `;
      }).join('');
      placePaginationAfter(reservationsTableBody, renderPaginationControl('reservationsPagination', reservationPagination, (page) => {
        reservationPagination.page = page;
        loadReservations();
      }));
    }

    function highlightSelectedReservationRow() {
      document.querySelectorAll('#reservationsTableBody tr[data-id]').forEach(row => {
        row.classList.toggle('active-row', Number(row.dataset.id) === Number(selectedReservationId));
      });
    }

    function getReservationById(reservationId) {
      return reservations.find(item => Number(item.id) === Number(reservationId)) || null;
    }

    function reservationSourceBadge(source) {
      return '<span class="status-badge ' + sourceClass(source) + '">' + escapeHtml(sourceLabel(source)) + '</span>';
    }

    function reservationDetailMetric(label, value, className = '') {
      return '<div class="summary-card">' +
        '<div class="summary-label">' + escapeHtml(label) + '</div>' +
        '<div class="summary-value ' + className + '">' + escapeHtml(value) + '</div>' +
      '</div>';
    }

    function reservationDetailInfo(label, value) {
      const displayValue = value === undefined || value === null || value === '' ? '-' : value;
      return '<div class="operation-detail-field"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(displayValue) + '</strong></div>';
    }

    function renderRelatedList(items, emptyText, renderer) {
      if (!items.length) return '<div class="operation-empty-row">' + escapeHtml(emptyText) + '</div>';
      return '<div class="reservation-related-list">' + items.map(renderer).join('') + '</div>';
    }

    function timelineDateValue(value) {
      if (!value) return 0;
      const parsed = new Date(String(value).replace(' ', 'T')).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function buildReservationTimeline(reservation, financeEntries = [], relatedLogs = [], relatedInbound = []) {
      const items = [];

      if (reservation.created_at) {
        items.push({
          date: reservation.created_at,
          type: 'Reserva',
          title: 'Reserva criada',
          detail: sourceLabel(reservation.source) + ' · ' + reservationStatusLabel(reservation.status)
        });
      }

      relatedInbound.forEach(item => {
        items.push({
          date: item.created_at,
          type: 'Inbound',
          title: item.subject || 'Email recebido',
          detail: inboundStatusLabel(item.parsing_status) + ' · ' + (item.platform || item.provider || 'unknown')
        });
      });

      financeEntries.forEach(entry => {
        items.push({
          date: entry.entry_date,
          type: 'Financeiro',
          title: (entry.type === 'income' ? 'Receita' : 'Despesa') + ' registrada',
          detail: formatMoney(entry.amount) + ' · ' + (entry.category || '-') + ' · ' + financialStatusLabel(entry.status)
        });
      });

      relatedLogs.forEach(log => {
        items.push({
          date: log.scheduled_for || log.sent_at || log.processed_at || log.created_at,
          type: 'Mensagem',
          title: log.subject || log.automation_name || 'Mensagem automatizada',
          detail: messageLogStatusLabel(log.status) + ' · ' + (log.channel || 'email')
        });
      });

      if (reservation.start_date) {
        items.push({
          date: reservation.start_date,
          type: 'Estadia',
          title: 'Check-in',
          detail: reservation.guest_name || 'Hóspede'
        });
      }

      if (reservation.end_date) {
        items.push({
          date: reservation.end_date,
          type: 'Estadia',
          title: 'Check-out',
          detail: reservation.guest_name || 'Hóspede'
        });
      }

      return items.sort((a, b) => timelineDateValue(a.date) - timelineDateValue(b.date));
    }

    function renderReservationTimeline(items) {
      if (!items.length) return '<div class="operation-empty-row">Nenhum evento encontrado para montar a timeline.</div>';
      return '<div class="reservation-timeline">' + items.map(item =>
        '<div class="reservation-timeline-item">' +
          '<div class="reservation-timeline-marker"></div>' +
          '<div class="reservation-timeline-content">' +
            '<div class="reservation-timeline-top"><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.type) + '</span></div>' +
            '<div class="small">' + escapeHtml(formatDateTimeBR(item.date)) + '</div>' +
            '<p>' + escapeHtml(item.detail || '-') + '</p>' +
          '</div>' +
        '</div>'
      ).join('') + '</div>';
    }

    function renderReservationDetails(reservation, financeData = {}, relatedLogs = [], relatedInbound = []) {
      const summary = financeData.summary || {};
      const financeEntries = Array.isArray(financeData.entries) ? financeData.entries : [];
      const contact = [reservation.guest_email, reservation.guest_phone].filter(Boolean).join(' / ') || '-';
      const timelineItems = buildReservationTimeline(reservation, financeEntries, relatedLogs, relatedInbound);

      return '<div class="reservation-detail-layout">' +
        '<div class="operation-detail-summary">' +
          '<div><div class="summary-label">Reserva #' + escapeHtml(reservation.id) + '</div><h3>' + escapeHtml(reservation.guest_name || 'Hóspede sem nome') + '</h3></div>' +
          '<div class="row-actions">' +
            reservationSourceBadge(reservation.source) +
            '<span class="status-badge ' + reservationStatusClass(reservation.status) + '">' + reservationStatusLabel(reservation.status) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="operation-detail-grid">' +
          reservationDetailInfo('Imóvel', reservation.property_name || properties.find(property => Number(property.id) === Number(reservation.property_id))?.name) +
          reservationDetailInfo('Período', formatDateBR(reservation.start_date) + ' até ' + formatDateBR(reservation.end_date)) +
          reservationDetailInfo('Contato', contact) +
          reservationDetailInfo('Valor informado', reservation.total_amount !== null && reservation.total_amount !== undefined ? formatMoney(reservation.total_amount) : '-') +
          reservationDetailInfo('Origem', sourceLabel(reservation.source)) +
          reservationDetailInfo('Status', reservationStatusLabel(reservation.status)) +
          reservationDetailInfo('Criada em', formatDateTimeBR(reservation.created_at)) +
          reservationDetailInfo('Atualizada em', formatDateTimeBR(reservation.updated_at)) +
        '</div>' +
        (reservation.notes ? '<div class="operation-detail-block"><span>Observações</span><p>' + escapeHtml(reservation.notes) + '</p></div>' : '') +
        '<div class="reservation-detail-metrics">' +
          reservationDetailMetric('Receitas', formatMoney(summary.total_income || 0), 'income-value') +
          reservationDetailMetric('Despesas', formatMoney(summary.total_expense || 0), 'expense-value') +
          reservationDetailMetric('Pendentes', formatMoney(summary.total_pending || 0), 'pending-value') +
          reservationDetailMetric('Lucro', formatMoney(summary.profit || 0), 'profit-value') +
        '</div>' +
        '<div class="operation-detail-block"><span>Timeline da reserva</span>' + renderReservationTimeline(timelineItems) + '</div>' +
        '<div class="reservation-detail-sections">' +
          '<div class="operation-detail-block"><span>Lançamentos financeiros</span>' +
            renderRelatedList(financeEntries, 'Nenhum lançamento financeiro vinculado.', entry =>
              '<div class="reservation-related-item"><strong>' + escapeHtml(entry.type === 'income' ? 'Receita' : 'Despesa') + ' · ' + escapeHtml(formatMoney(entry.amount)) + '</strong><small>' + escapeHtml(formatDateBR(entry.entry_date)) + ' · ' + escapeHtml(entry.category || '-') + ' · ' + escapeHtml(financialStatusLabel(entry.status)) + '</small></div>'
            ) +
          '</div>' +
          '<div class="operation-detail-block"><span>Mensagens da reserva</span>' +
            renderRelatedList(relatedLogs, 'Nenhuma mensagem encontrada para esta reserva.', log =>
              '<div class="reservation-related-item"><strong>' + escapeHtml(log.subject || log.automation_name || 'Mensagem') + '</strong><small>' + escapeHtml(messageLogStatusLabel(log.status)) + ' · ' + escapeHtml(formatDateTimeBR(log.scheduled_for || log.created_at)) + '</small></div>'
            ) +
          '</div>' +
          '<div class="operation-detail-block"><span>Inbound relacionado</span>' +
            renderRelatedList(relatedInbound, 'Nenhum inbound relacionado encontrado.', item =>
              '<div class="reservation-related-item"><strong>' + escapeHtml(item.subject || 'Inbound email') + '</strong><small>' + escapeHtml(inboundStatusLabel(item.parsing_status)) + ' · ' + escapeHtml(item.platform || item.provider || 'unknown') + ' · ' + escapeHtml(formatDateTimeBR(item.created_at)) + '</small></div>'
            ) +
          '</div>' +
        '</div>' +
      '</div>';
    }

    async function fetchReservationFinanceSafe(reservationId, reservation) {
      if (!reservation || reservation.source === 'blocked') return { reservation, summary: {}, entries: [] };
      try {
        const response = await fetch(`${API_URL}/financial/by-reservation/${reservationId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return { reservation, summary: {}, entries: [] };
        return data;
      } catch (error) {
        return { reservation, summary: {}, entries: [] };
      }
    }

    async function fetchRelatedReservationActivity(reservationId) {
      const [logsResponse, inboundResponse] = await Promise.all([
        fetch(`${API_URL}/message-logs?page=1&limit=100`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/inbound-emails?limit=200`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const logsData = await logsResponse.json().catch(() => []);
      const inboundData = await inboundResponse.json().catch(() => ({ emails: [] }));
      const logs = normalizePaginatedResponse(logsData, 100).data.filter(log => Number(log.reservation_id) === Number(reservationId));
      const inbound = Array.isArray(inboundData.emails) ? inboundData.emails.filter(item => Number(item.created_reservation_id) === Number(reservationId)) : [];
      return { logs, inbound };
    }

    async function openReservationDetails(reservationId) {
      const reservation = getReservationById(reservationId);
      if (!reservation || !reservationDetailsCard || !reservationDetailsContent) return;

      selectedReservationId = Number(reservationId);
      highlightSelectedReservationRow();
      reservationDetailsCard.classList.remove('hidden');
      reservationDetailsContent.innerHTML = '<div class="operation-loading-row">Carregando detalhes da reserva...</div>';

      const [financeData, activity] = await Promise.all([
        fetchReservationFinanceSafe(reservationId, reservation),
        fetchRelatedReservationActivity(reservationId).catch(() => ({ logs: [], inbound: [] }))
      ]);

      const resolvedReservation = financeData.reservation || reservation;
      reservationDetailsContent.innerHTML = renderReservationDetails(resolvedReservation, financeData, activity.logs, activity.inbound);
      reservationDetailsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
          <strong>Reserva #${escapeHtml(reservation.id)}</strong><br>
          Imóvel: ${escapeHtml(reservation.property_name)}<br>
          Hóspede: ${escapeHtml(reservation.guest_name || '-')}<br>
          Status: ${escapeHtml(reservationStatusLabel(reservation.status))}<br>
          Período: ${escapeHtml(formatDateBR(reservation.start_date))} até ${escapeHtml(formatDateBR(reservation.end_date))}
        `;

        updateReservationFinanceSummary(data.summary || {});

        const tbody = document.getElementById('reservationFinanceTableBody');
        if (!data.entries || !data.entries.length) {
          tbody.innerHTML = '<tr><td colspan="6">Nenhum lançamento vinculado.</td></tr>';
        } else {
          tbody.innerHTML = data.entries.map(entry => `
            <tr>
              <td>${escapeHtml(formatDateBR(entry.entry_date))}</td>
              <td>${entry.type === 'income' ? 'Receita' : 'Despesa'}</td>
              <td>${escapeHtml(entry.category || '-')}</td>
              <td>${escapeHtml(entry.description || '-')}</td>
              <td>${escapeHtml(formatMoney(entry.amount))}</td>
              <td>${escapeHtml(financialStatusLabel(entry.status))}</td>
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

    /* CALENDAR */
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
      if (!hasFullBillingAccess()) {
        clearSensitiveFrontendData();
        return;
      }

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
        params.append('page', String(financialPagination.page || 1));
        params.append('limit', String(financialPagination.limit || 25));

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
      setText('summaryOccupancy', `${calculateCurrentMonthOccupancy()}%`);
      updateSummaryMirrors(data);
      renderDashboardValueBlocks();
    }

    async function loadFinancialEntries() {
      if (!hasFullBillingAccess()) {
        clearSensitiveFrontendData();
        return;
      }

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

        const normalized = normalizePaginatedResponse(data, financialPagination.limit);
        financialEntries = normalized.data;
        financialPagination = normalized.pagination;
        renderFinancialTable();
      } catch (error) {
        financialTableBody.innerHTML = '<tr><td colspan="10">Erro ao carregar lançamentos</td></tr>';
      }
    }

    function renderFinancialTable() {
      if (!financialEntries.length) {
        financialTableBody.innerHTML = '<tr><td colspan="10">Nenhum lançamento financeiro</td></tr>';
        placePaginationAfter(financialTableBody, renderPaginationControl('financialPagination', financialPagination, (page) => {
          financialPagination.page = page;
          loadFinancialEntries();
        }));
        return;
      }

      financialTableBody.innerHTML = financialEntries.map(entry => {
        const entryId = escapeHtml(entry.id);
        return `
        <tr class="${isFinancialEntryCancelled(entry) ? 'reservation-row-cancelled' : ''}">
          <td>${escapeHtml(formatDateBR(entry.entry_date))}</td>
          <td>${escapeHtml(entry.property_name || '-')}</td>
          <td>${escapeHtml(entry.reservation_id ? `#${entry.reservation_id} - ${entry.guest_name || '-'}` : '-')}</td>
          <td>
            <span class="tag ${entry.type === 'income' ? 'tag-income' : 'tag-expense'}">
              ${entry.type === 'income' ? 'Receita' : 'Despesa'}
            </span>
          </td>
          <td>${escapeHtml(entry.category || '-')}</td>
          <td>${escapeHtml(entry.description || '-')}</td>
          <td>${escapeHtml(formatMoney(entry.amount))}</td>
          <td>
            <span class="tag ${financialStatusClass(entry.status)}">
              ${escapeHtml(financialStatusLabel(entry.status))}
            </span>
          </td>
          <td>${escapeHtml(entry.source || '-')}</td>
          <td>
            <div class="actions-inline">
              <button type="button" data-action="edit-financial" data-id="${entryId}">Editar</button>
              <button type="button" class="btn-danger" data-action="delete-financial" data-id="${entryId}">Excluir</button>
            </div>
          </td>
        </tr>
      `;
      }).join('');
      placePaginationAfter(financialTableBody, renderPaginationControl('financialPagination', financialPagination, (page) => {
        financialPagination.page = page;
        loadFinancialEntries();
      }));
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

        if (action === 'view-reservation-details' && id) {
          await openReservationDetails(id);
          return;
        }

        if (action === 'view-reservation-finance' && id) {
          await openReservationFinance(id);
        }
        return;
      }

      const row = event.target.closest('tr[data-id]');
      if (!row) return;

      const id = Number(row.dataset.id);
      const reservation = reservations.find(item => Number(item.id) === id);
      if (!reservation) return;

      await openReservationDetails(id);
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

    operationRefreshBtn?.addEventListener('click', () => loadOperationalDashboard());
    operationApplyFiltersBtn?.addEventListener('click', () => loadOperationalDashboard());
    operationClearFiltersBtn?.addEventListener('click', () => {
      if (operationStatusFilter) operationStatusFilter.value = '';
      if (operationPropertyFilter) operationPropertyFilter.value = '';
      if (operationFromFilter) operationFromFilter.value = '';
      if (operationToFilter) operationToFilter.value = '';
      loadOperationalDashboard();
    });
    operationCloseDetailsBtn?.addEventListener('click', () => {
      operationDetailsCard?.classList.add('hidden');
      if (operationDetailsContent) operationDetailsContent.innerHTML = '';
    });
    closeReservationDetailsBtn?.addEventListener('click', () => {
      reservationDetailsCard?.classList.add('hidden');
      if (reservationDetailsContent) reservationDetailsContent.innerHTML = '';
    });
    operationMessagesTableBody?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-operation-action]');
      if (!button) return;
      const action = button.dataset.operationAction;
      const id = button.dataset.id;
      try {
        if (action === 'details-message') return showOperationDetails('message', id);
        if (action === 'reprocess-message') {
          if (!confirm('Deseja reprocessar esta mensagem? Um novo job será colocado na fila.')) return;
          return runOperationAction(API_URL + '/message-logs/' + id + '/reprocess', 'Mensagem reenfileirada.', button);
        }
        if (action === 'force-message') {
          if (!confirm('Deseja forçar o envio agora? Isso pode disparar email para o hóspede.')) return;
          return runOperationAction(API_URL + '/message-logs/' + id + '/force-send', 'Envio forçado enfileirado.', button);
        }
      } catch (error) {
        setOperationFeedback(error.message || 'Falha ao executar ação.', 'error');
      }
    });
    operationInboundTableBody?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-operation-action]');
      if (!button) return;
      const action = button.dataset.operationAction;
      const id = button.dataset.id;
      try {
        if (action === 'details-inbound') return showOperationDetails('inbound', id);
        if (action === 'reprocess-inbound') {
          if (!confirm('Deseja reprocessar este inbound? Ele pode atualizar/criar ações derivadas se o backend identificar mudanças.')) return;
          return runOperationAction(API_URL + '/inbound-emails/' + id + '/reprocess', 'Inbound reenfileirado.', button);
        }
      } catch (error) {
        setOperationFeedback(error.message || 'Falha ao executar ação.', 'error');
      }
    });
    operationAttentionList?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-attention-type]');
      if (!button) return;
      const type = button.dataset.attentionType;
      const id = button.dataset.id;
      if (type === 'message') {
        showOperationDetails('message', id);
        return;
      }
      if (type === 'inbound') {
        showOperationDetails('inbound', id);
        return;
      }
      if (type === 'reservation') {
        showSection('reservations');
        await openReservationDetails(id);
      }
    });

    onboardingNextBtn?.addEventListener('click', advanceOnboarding);
    onboardingBackBtn?.addEventListener('click', () => {
      if (onboardingStep > 1) {
        onboardingStep -= 1;
        clearMessage('onboardingMessage');
        renderOnboardingStep();
      }
    });
    onboardingSkipBtn?.addEventListener('click', () => {
      markOnboardingSkipped();
      closeOnboarding();
      showSection('dashboard');
    });
    document.querySelectorAll('[data-copy-integration-email]').forEach(button => {
      button.addEventListener('click', async () => {
        const success = await copyIntegrationEmail('onboardingMessage');
        if (success) showMessage('onboardingMessage', 'E-mail copiado. Agora cadastre esse e-mail nas notificações das plataformas.', 'success');
      });
    });
    document.getElementById('onboardingEmailUnderstoodBtn')?.addEventListener('click', () => {
      updateOnboardingProgress({ email_copied: true, notifications_seen: true });
      showMessage('onboardingMessage', 'Perfeito. O e-mail do StayFlow foi marcado como entendido para esta configuração.', 'success');
    });
    refreshMyInfoBtn?.addEventListener('click', () => loadMyInfo());
    copyMyIntegrationEmailBtn?.addEventListener('click', () => copyIntegrationEmail('myInfoMessage'));
    openOnboardingBtn?.addEventListener('click', () => openOnboarding(getSuggestedOnboardingStep()));
    refreshBillingBtn?.addEventListener('click', () => loadBillingDashboard());
    activateBillingBtn?.addEventListener('click', activateBilling);
    cancelBillingBtn?.addEventListener('click', cancelBilling);
    recalculateBillingBtn?.addEventListener('click', recalculateBilling);
    accessRestrictionCta?.addEventListener('click', () => showSection('billing'));
    activationNextCta?.addEventListener('click', (event) => {
      event.stopPropagation();
      goToActivationSection(activationNextCta.dataset.activationSection);
    });
    document.addEventListener('click', (event) => {
      const activationButton = event.target.closest('[data-activation-section]');
      if (!activationButton) return;
      goToActivationSection(activationButton.dataset.activationSection);
    });

    if (messageLogFilters) {
      messageLogFilters.addEventListener('click', (event) => {
        const button = event.target.closest('[data-log-filter]');
        if (!button) return;
        messageLogPagination.page = 1;
        loadMessageLogs(button.dataset.logFilter || 'all');
      });
    }

    loginBtn.addEventListener('click', login);
    registerBtn.addEventListener('click', registerUser);
    showForgotPasswordBtn?.addEventListener('click', () => toggleForgotPasswordPanel(true));
    hideForgotPasswordBtn?.addEventListener('click', () => toggleForgotPasswordPanel(false));
    forgotPasswordBtn?.addEventListener('click', requestPasswordReset);
    resetPasswordBtn?.addEventListener('click', resetPassword);
    registerCpfInput?.addEventListener('input', (event) => {
      event.target.value = formatCpf(event.target.value);
    });
    logoutBtn.addEventListener('click', logout);
    createPropertyBtn.addEventListener('click', createProperty);
    createReservationBtn.addEventListener('click', createReservation);
    syncPropertyBtn.addEventListener('click', syncSelectedProperty);
    createFinancialBtn.addEventListener('click', createFinancialEntry);

    applyFinancialFiltersBtn.addEventListener('click', async () => {
      financialPagination.page = 1;
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
      reservationPagination.page = 1;
      financialPagination.page = 1;
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

    const resetTokenFromUrl = new URLSearchParams(window.location.search).get('resetToken');
    if (resetTokenFromUrl && document.getElementById('resetToken')) {
      document.getElementById('resetToken').value = resetTokenFromUrl;
      toggleForgotPasswordPanel(true);
      showMessage('authMessage', 'Token carregado. Informe sua nova senha para concluir a redefinição.', 'success');
    }

    resetFinancialForm();
    resetMessageAutomationForm();
    resetReservationFinanceCard();

    if (token && loggedUser) {
      enterApp().then(() => {
        if (hasFullBillingAccess()) {
          loadProperties();
        }
      });
    }
