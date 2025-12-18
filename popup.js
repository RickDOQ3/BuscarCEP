document.addEventListener('DOMContentLoaded', function() {
    // Configurações
    const CONFIG = {
        API_URL: 'https://viacep.com.br/ws',
        CACHE_DURATION: 7 * 24 * 60 * 60 * 1000, // 7 dias em milissegundos
        MAX_HISTORY: 10,
        MAX_SAVED: 20
    };

    // Elementos DOM
    const elements = {
        cepInput: document.getElementById('cepInput'),
        searchBtn: document.getElementById('searchBtn'),
        closeBtn: document.getElementById('closeBtn'),
        resultSection: document.getElementById('resultSection'),
        loadingSection: document.getElementById('loadingSection'),
        errorSection: document.getElementById('errorSection'),
        errorMessage: document.getElementById('errorMessage'),
        tryAgainBtn: document.getElementById('tryAgainBtn'),
        clearBtn: document.getElementById('clearBtn'),
        copyBtn: document.getElementById('copyBtn'),
        mapsBtn: document.getElementById('mapsBtn'),
        saveBtn: document.getElementById('saveBtn'),
        notification: document.getElementById('notification'),
        notificationText: document.getElementById('notificationText'),
        notificationIcon: document.getElementById('notificationIcon'),
        historyButtons: document.getElementById('historyButtons'),
        savedList: document.getElementById('savedList'),
        
        // Campos de endereço
        logradouro: document.getElementById('logradouro'),
        bairro: document.getElementById('bairro'),
        localidade: document.getElementById('localidade'),
        cep: document.getElementById('cep'),
        complemento: document.getElementById('complemento'),
        ddd: document.getElementById('ddd'),
        regiao: document.getElementById('regiao')
    };

    // Estado da aplicação
    let currentData = null;

    // Inicialização
    function init() {
        loadLastSearch();
        loadHistory();
        loadSavedCEPs();
        setupEventListeners();
        elements.cepInput.focus();
    }

    // Configurar event listeners
    function setupEventListeners() {
        elements.searchBtn.addEventListener('click', handleSearch);
        elements.cepInput.addEventListener('keypress', handleKeyPress);
        elements.tryAgainBtn.addEventListener('click', resetSearch);
        elements.clearBtn.addEventListener('click', resetSearch);
        elements.copyBtn.addEventListener('click', copyAddress);
        elements.mapsBtn.addEventListener('click', openMaps);
        elements.saveBtn.addEventListener('click', saveCEP);
        
        // Fechar ao clicar fora (se permitido pelo Chrome)
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.container') && e.target !== elements.cepInput) {
                // Não fecha automaticamente para melhor UX
            }
        });
    }

    // Normalizar CEP (aceitar com ou sem hífen)
    function normalizeCEP(cep) {
        return cep.toString().replace(/\D/g, '');
    }

    // Validar CEP
    function validateCEP(cep) {
        const normalized = normalizeCEP(cep);
        return /^[0-9]{8}$/.test(normalized);
    }

    // Formatar CEP para exibição
    function formatCEP(cep) {
        const normalized = normalizeCEP(cep);
        return normalized.replace(/(\d{5})(\d{3})/, '$1-$2');
    }

    // Formatar CEP para input
    function formatInputCEP(cep) {
        const normalized = normalizeCEP(cep);
        if (normalized.length >= 5) {
            return normalized.replace(/(\d{5})(\d{0,3})/, '$1-$2');
        }
        return normalized;
    }

    // Mostrar notificação
    function showNotification(message, type = 'success') {
        const colors = {
            success: '#10b981',
            error: '#e53e3e',
            info: '#0c144b'
        };
        
        elements.notification.style.background = colors[type] || colors.info;
        elements.notificationText.textContent = message;
        elements.notificationIcon.className = type === 'success' ? 'fas fa-check-circle' : 
                                             type === 'error' ? 'fas fa-exclamation-circle' : 
                                             'fas fa-info-circle';
        
        elements.notification.classList.add('show');
        
        setTimeout(() => {
            elements.notification.classList.remove('show');
        }, 3000);
    }

    // Buscar CEP
    async function searchCEP(cepValue) {
        const cep = normalizeCEP(cepValue);
        
        if (!validateCEP(cep)) {
            showError('Digite um CEP válido (8 dígitos)');
            return;
        }

        // Verificar cache
        const cached = getFromCache(cep);
        if (cached) {
            showResult(cached);
            showNotification('Dados carregados do cache', 'info');
            return;
        }

        showLoading();
        
        try {
            const response = await fetch(`${CONFIG.API_URL}/${cep}/json`);
            
            if (!response.ok) {
                throw new Error('Erro na requisição');
            }
            
            const data = await response.json();
            
            if (data.erro) {
                showError('CEP não encontrado');
                return;
            }
            
            // Adicionar informações extras
            data.regiao = getRegionFromUF(data.uf);
            
            showResult(data);
            saveToCache(data);
            addToHistory(data);
            saveLastSearch(cep);
            
        } catch (error) {
            console.error('Erro:', error);
            showError('Erro na conexão. Tente novamente.');
        }
    }

    // Obter região a partir da UF
    function getRegionFromUF(uf) {
        const regions = {
            'AC': 'Norte', 'AP': 'Norte', 'AM': 'Norte', 'PA': 'Norte', 'RO': 'Norte', 'RR': 'Norte', 'TO': 'Norte',
            'AL': 'Nordeste', 'BA': 'Nordeste', 'CE': 'Nordeste', 'MA': 'Nordeste', 'PB': 'Nordeste', 'PE': 'Nordeste',
            'PI': 'Nordeste', 'RN': 'Nordeste', 'SE': 'Nordeste',
            'DF': 'Centro-Oeste', 'GO': 'Centro-Oeste', 'MT': 'Centro-Oeste', 'MS': 'Centro-Oeste',
            'ES': 'Sudeste', 'MG': 'Sudeste', 'RJ': 'Sudeste', 'SP': 'Sudeste',
            'PR': 'Sul', 'RS': 'Sul', 'SC': 'Sul'
        };
        return regions[uf] || 'Indefinida';
    }

    // Mostrar loading
    function showLoading() {
        hideAllSections();
        elements.loadingSection.style.display = 'block';
    }

    // Mostrar erro
    function showError(message) {
        hideAllSections();
        elements.errorMessage.textContent = message;
        elements.errorSection.style.display = 'block';
    }

    // Mostrar resultado
    function showResult(data) {
        hideAllSections();
        currentData = data;
        
        // Preencher campos
        elements.logradouro.textContent = data.logradouro || 'Não informado';
        elements.bairro.textContent = data.bairro || 'Não informado';
        elements.localidade.textContent = `${data.localidade || ''}/${data.uf || ''}`.trim();
        elements.cep.textContent = formatCEP(data.cep);
        elements.complemento.textContent = data.complemento || 'Não informado';
        elements.ddd.textContent = data.ddd || 'Não informado';
        elements.regiao.textContent = data.regiao || 'Indefinida';
        
        // Configurar botão do Maps se tiver logradouro
        if (data.logradouro && data.localidade) {
            elements.mapsBtn.style.display = 'flex';
        } else {
            elements.mapsBtn.style.display = 'none';
        }
        
        elements.resultSection.style.display = 'block';
    }

    // Esconder todas as seções
    function hideAllSections() {
        elements.resultSection.style.display = 'none';
        elements.loadingSection.style.display = 'none';
        elements.errorSection.style.display = 'none';
    }

    // Cache de CEPs
    function getFromCache(cep) {
        try {
            const cache = JSON.parse(localStorage.getItem('cepCache') || '{}');
            const item = cache[cep];
            
            if (item && Date.now() - item.timestamp < CONFIG.CACHE_DURATION) {
                return item.data;
            }
            
            // Remover item expirado
            delete cache[cep];
            localStorage.setItem('cepCache', JSON.stringify(cache));
            return null;
            
        } catch (error) {
            return null;
        }
    }

    function saveToCache(data) {
        try {
            const cache = JSON.parse(localStorage.getItem('cepCache') || '{}');
            cache[normalizeCEP(data.cep)] = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem('cepCache', JSON.stringify(cache));
        } catch (error) {
            console.error('Erro ao salvar cache:', error);
        }
    }

    // Histórico de buscas
    function addToHistory(data) {
        try {
            let history = JSON.parse(localStorage.getItem('cepHistory') || '[]');
            
            const newItem = {
                cep: normalizeCEP(data.cep),
                address: `${data.logradouro || ''}, ${data.bairro || ''}`.replace(/,\s*$/, ''),
                timestamp: Date.now()
            };
            
            // Remover duplicatas
            history = history.filter(item => item.cep !== newItem.cep);
            
            // Adicionar no início
            history.unshift(newItem);
            
            // Limitar tamanho
            if (history.length > CONFIG.MAX_HISTORY) {
                history = history.slice(0, CONFIG.MAX_HISTORY);
            }
            
            localStorage.setItem('cepHistory', JSON.stringify(history));
            loadHistory();
            
        } catch (error) {
            console.error('Erro ao salvar histórico:', error);
        }
    }

    function loadHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('cepHistory') || '[]');
            elements.historyButtons.innerHTML = '';
            
            history.slice(0, 5).forEach(item => {
                const button = document.createElement('button');
                button.className = 'history-btn';
                button.textContent = formatCEP(item.cep);
                button.title = item.address;
                button.addEventListener('click', () => {
                    elements.cepInput.value = formatInputCEP(item.cep);
                    searchCEP(item.cep);
                });
                elements.historyButtons.appendChild(button);
            });
            
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
        }
    }

    // CEPs salvos
    function saveCEP() {
        if (!currentData) return;
        
        try {
            let saved = JSON.parse(localStorage.getItem('cepSaved') || '[]');
            
            const newItem = {
                cep: normalizeCEP(currentData.cep),
                address: `${currentData.logradouro || ''}, ${currentData.bairro || ''}, ${currentData.localidade || ''}`.replace(/,\s*$/, ''),
                data: currentData,
                timestamp: Date.now()
            };
            
            // Verificar se já existe
            const exists = saved.find(item => item.cep === newItem.cep);
            if (exists) {
                showNotification('CEP já está salvo', 'info');
                return;
            }
            
            // Adicionar no início
            saved.unshift(newItem);
            
            // Limitar tamanho
            if (saved.length > CONFIG.MAX_SAVED) {
                saved = saved.slice(0, CONFIG.MAX_SAVED);
            }
            
            localStorage.setItem('cepSaved', JSON.stringify(saved));
            loadSavedCEPs();
            showNotification('CEP salvo com sucesso!');
            
        } catch (error) {
            console.error('Erro ao salvar CEP:', error);
            showNotification('Erro ao salvar CEP', 'error');
        }
    }

    function loadSavedCEPs() {
        try {
            const saved = JSON.parse(localStorage.getItem('cepSaved') || '[]');
            elements.savedList.innerHTML = '';
            
            saved.slice(0, 5).forEach(item => {
                const div = document.createElement('div');
                div.className = 'saved-item';
                div.innerHTML = `
                    <div>
                        <div class="saved-cep">${formatCEP(item.cep)}</div>
                        <div class="saved-address">${item.address}</div>
                    </div>
                    <i class="fas fa-chevron-right"></i>
                `;
                
                div.addEventListener('click', () => {
                    elements.cepInput.value = formatInputCEP(item.cep);
                    searchCEP(item.cep);
                });
                
                elements.savedList.appendChild(div);
            });
            
        } catch (error) {
            console.error('Erro ao carregar CEPs salvos:', error);
        }
    }

    // Última busca
    function saveLastSearch(cep) {
        try {
            localStorage.setItem('lastCEP', cep);
        } catch (error) {
            console.error('Erro ao salvar última busca:', error);
        }
    }

    function loadLastSearch() {
        try {
            const lastCEP = localStorage.getItem('lastCEP');
            if (lastCEP && validateCEP(lastCEP)) {
                elements.cepInput.value = formatInputCEP(lastCEP);
            }
        } catch (error) {
            console.error('Erro ao carregar última busca:', error);
        }
    }

    // Manipular eventos
    function handleSearch() {
        searchCEP(elements.cepInput.value);
    }

    function handleKeyPress(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
        
        // Formatar automaticamente
        if (e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Tab') {
            setTimeout(() => {
                elements.cepInput.value = formatInputCEP(elements.cepInput.value);
            }, 10);
        }
    }

    function resetSearch() {
        elements.cepInput.value = '';
        hideAllSections();
        elements.cepInput.focus();
    }



    function copyAddress() {
        if (!currentData) return;
        
        const address = `CEP: ${formatCEP(currentData.cep)}
Logradouro: ${currentData.logradouro || 'Não informado'}
Bairro: ${currentData.bairro || 'Não informado'}
Cidade/UF: ${currentData.localidade || ''}/${currentData.uf || ''}
Complemento: ${currentData.complemento || 'Não informado'}
DDD: ${currentData.ddd || 'Não informado'}
Região: ${currentData.regiao || 'Indefinida'}`;
        
        navigator.clipboard.writeText(address)
            .then(() => showNotification('Endereço copiado!'))
            .catch(() => showNotification('Erro ao copiar', 'error'));
    }

    function openMaps() {
        if (!currentData || !currentData.logradouro) return;
        
        const address = encodeURIComponent(
            `${currentData.logradouro}, ${currentData.bairro}, ${currentData.localidade} - ${currentData.uf}`
        );
        const url = `https://www.google.com/maps/search/?api=1&query=${address}`;
        window.open(url, '_blank');
    }

    // Inicializar a aplicação
    init();
});