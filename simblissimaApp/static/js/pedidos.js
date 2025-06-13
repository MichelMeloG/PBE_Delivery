// pedidos.js
let refreshInterval;

// Função para formatar o método de pagamento
function formatPaymentMethod(method) {
    const methodMap = {
        'PIX': 'Pix',
        'CARTAO_DEBITO': 'Cartão de Débito',
        'CARTAO_CREDITO': 'Cartão de Crédito',
        'BOLETO': 'Boleto'
    };
    return methodMap[method] || method;
}

// Função para formatar o status do pedido
function formatStatus(status) {
    const statusMap = {
        'PENDENTE': 'Pendente',
        'AGUARDANDO_PAGAMENTO': 'Aguardando Pagamento',
        'CONFIRMADO': 'Confirmado',
        'EM_TRANSITO': 'Em Trânsito',
        'ENTREGUE': 'Entregue',
        'CANCELADO': 'Cancelado'
    };
    return statusMap[status] || status;
}

// Funções auxiliares para estilização do usuário
function getBadgeClassUsuario(status) {
    const statusClasses = {
        'PENDENTE': 'bg-warning',
        'AGUARDANDO_PAGAMENTO': 'bg-info',
        'CONFIRMADO': 'bg-primary',
        'EM_TRANSITO': 'bg-info',
        'ENTREGUE': 'bg-success',
        'CANCELADO': 'bg-danger'
    };
    return statusClasses[status] || 'bg-secondary';
}

function getStatusIconUsuario(status) {
    const statusIcons = {
        'PENDENTE': '🕒',
        'AGUARDANDO_PAGAMENTO': '💰',
        'CONFIRMADO': '✅',
        'EM_TRANSITO': '⛵',
        'ENTREGUE': '📦',
        'CANCELADO': '❌'
    };
    return statusIcons[status] || '⚪';
}

async function loadPedidos() {
    try {
        // Remove new order page class if it exists
        document.body.classList.remove('novo-pedido-page');
        
        const user = await getCurrentUser();
        if (!user) {
            loadLogin();
            return;
        }

        // Se for staff, redireciona para o dashboard
        if (user.is_staff) {
            loadManagerDashboard();
            return;
        }
        
        const content = document.getElementById('content');
        // Só monta o layout se ainda não estiver presente
        if (!document.getElementById('listaPedidos')) {
            content.innerHTML = `
                <div class="pedidos-container">
                    <div class="pedidos-content">
                        <div class="row justify-content-center">
                            <div class="col-md-8">
                                <div class="card">
                                    <div class="card-header d-flex justify-content-between align-items-center">
                                        <h3 class="mb-0">Meus Pedidos</h3>
                                        <div class="pedidos-button-container">
                                            <button class="btn btn-primary me-2" onclick="novoPedido()">Novo Pedido</button>
                                            <button class="btn btn-secondary" onclick="loadHome()">Voltar</button>
                                        </div>
                                    </div>
                                    <div class="card-body">
                                        <div id="listaPedidos" class="text-center">
                                            <div class="spinner-border" role="status">
                                                <span class="visually-hidden">Carregando...</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        atualizarListaPedidos();
        // Start auto-refresh when loading the pedidos view
        startAutoRefresh();
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        showMessage('Erro ao carregar a página de pedidos', 'danger');
    }
}

function startAutoRefresh() {    // Clear any existing interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    // Refresh every 60 seconds para reduzir atualizações frequentes
    refreshInterval = setInterval(atualizarListaPedidos, 60000);
}

function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
}

// Função para atualizar lista de pedidos
async function atualizarListaPedidos() {
    try {
        // Get expanded orders from localStorage logo no início
        const expandedOrders = JSON.parse(localStorage.getItem('expandedOrders') || '[]');
        
        // Busca o usuário só para pegar o id, mas não faz redirecionamento
        const user = await getCurrentUser();
        if (!user || user.is_staff) return;
        
        const data = await fetchAPI(`/pedidos/?cliente=${user.id}`);
        const listaPedidos = document.getElementById('listaPedidos');
        if (!listaPedidos) return;

        if (data.results && data.results.length > 0) {
            listaPedidos.innerHTML = data.results.map(pedido => {
                const isExpanded = expandedOrders.includes(pedido.id.toString());
                return `
                <div class="card mb-4 border-0 rounded-3" style="max-width:100%;">
                    <div class="card-body p-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pedido-header-clickable" onclick="togglePedidoMinimizadoUsuario(${pedido.id})" style="cursor:pointer; border-bottom: 1px solid #dee2e6;">
                        <div class="d-flex flex-column flex-md-row align-items-md-center gap-3 w-100">
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge ${getBadgeClassUsuario(pedido.status)} px-3 py-2 rounded-pill">
                                    ${getStatusIconUsuario(pedido.status)}
                                </span>
                                <span class="fw-bold text-center text-md-start fs-5">Pedido #${pedido.id}</span>
                            </div>
                            <span class="text-muted small text-center text-md-start">${new Date(pedido.data_criacao).toLocaleDateString()}</span>
                        </div>
                        <div class="d-flex flex-column flex-md-row align-items-md-center gap-3 w-100 justify-content-md-end flex-grow-1" style="min-width:320px;">
                            <span class="fw-bold text-primary text-center text-md-start me-md-auto fs-5" style="white-space:nowrap;">R$&nbsp;${parseFloat(pedido.valor_final || pedido.valor_total).toFixed(2)}</span>
                            <span class="text-muted small w-100 text-center d-block" style="vertical-align:middle;">${formatStatus(pedido.status)}</span>
                            <span class="mx-auto mx-md-0 pedido-toggle-arrow" style="font-size:1.2rem;">
                                <i id="pedido-toggle-icon-usuario-${pedido.id}" class="bi bi-chevron-${isExpanded ? 'up' : 'down'} text-muted"></i>
                            </span>
                        </div>
                    </div>
                    <div id="pedido-content-usuario-${pedido.id}" class="${isExpanded ? 'pedido-content-visible' : 'pedido-content-hidden'}" style="background-color: #fafafa;">
                        <div class="p-4">
                            <div class="mb-4">
                                <strong class="text-center text-md-start d-block mb-3 fs-6">Itens do Pedido:</strong>
                                <ul class="list-unstyled mb-2">
                                    ${pedido.itens && pedido.itens.length > 0 ? pedido.itens.map(item => `
                                        <li class="d-flex justify-content-between border-bottom py-2">
                                            <span class="text-center text-md-start">${item.descricao}</span>
                                            <span class="text-end w-25 fw-bold">R$ ${parseFloat(item.preco).toFixed(2)}</span>
                                        </li>
                                    `).join('') : '<li class="text-muted text-center py-2">Nenhum item</li>'}
                                </ul>
                            </div>
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <strong class="text-secondary">Status:</strong>
                                        <span class="ms-2">${formatStatus(pedido.status)}</span>
                                    </div>
                                    <div class="mb-3">
                                        <strong class="text-secondary">Última atualização:</strong>
                                        <span class="ms-2">${new Date(pedido.historico_status && pedido.historico_status.length > 0 ? pedido.historico_status[pedido.historico_status.length - 1].data : pedido.data_criacao).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <strong class="text-secondary">Observação:</strong>
                                        <span class="ms-2">${pedido.observacoes ? pedido.observacoes : '<span class="text-muted">Nenhuma</span>'}</span>
                                    </div>
                                    <div class="mb-3">
                                        <strong class="text-secondary">Pagamento:</strong>
                                        <span class="ms-2">${formatPaymentMethod(pedido.metodo_pagamento) || '<span class="text-muted">Não definido</span>'}</span>
                                    </div>
                                </div>
                            </div>
                            ${pedido.status === 'AGUARDANDO_PAGAMENTO' && pedido.valor_final ? `
                            <div class="alert alert-info mt-3 p-3">
                                <strong>Valor Final:</strong> R$ ${pedido.valor_final}
                                <div class="mt-3">
                                    <button class="btn btn-success btn-sm px-4" onclick="event.stopPropagation(); confirmarValorFinal(${pedido.id})">
                                        <i class="bi bi-check-lg me-2"></i>Confirmar Valor
                                    </button>
                                    <button class="btn btn-outline-danger btn-sm px-4 ms-2" onclick="event.stopPropagation(); recusarValorFinal(${pedido.id})">
                                        <i class="bi bi-x-lg me-2"></i>Recusar Valor
                                    </button>
                                </div>
                            </div>
                            ` : ''}
                            <div class="mt-4">
                                <strong class="text-secondary d-block mb-3">Histórico:</strong>
                                <ul class="list-unstyled mb-0">
                                    ${pedido.historico_status && pedido.historico_status.length > 0 ? pedido.historico_status.map(status => `
                                        <li class="small historico-status-item mb-3 border-start ps-3" style="border-left-width: 3px; border-left-color: #6c757d;">
                                            <div class="d-flex align-items-baseline gap-2">
                                                <span>${getStatusIconUsuario(status.status)}</span>
                                                <div class="flex-grow-1">
                                                    <div class="d-flex align-items-baseline gap-2">
                                                        <span class="fw-bold">${formatStatus(status.status)}</span>
                                                        <span class="text-muted small">- ${new Date(status.data).toLocaleString()}</span>
                                                    </div>
                                                    ${status.comentario ? `
                                                    <div class="mt-1 text-muted" style="font-size: 0.9em; text-align: left;">
                                                        <i class="bi bi-chat-left-text me-2"></i>${status.comentario}
                                                    </div>` : ''}
                                                </div>
                                            </div>
                                        </li>
                                    `).join('') : '<li class="text-muted">Sem histórico</li>'}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } else {
            listaPedidos.innerHTML = '<p class="text-center">Nenhum pedido encontrado.</p>';
        }
    } catch (error) {
        console.error('Erro ao atualizar lista de pedidos:', error);
    }
}

// Função para criar um novo pedido
function novoPedido() {
    const content = document.getElementById('content');
    
    // Add class to body to identify new order page
    document.body.classList.add('novo-pedido-page');
    
    content.innerHTML = `        <div class="order-detail-container novo-pedido-container">
            <div class="order-list">
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h3 class="mb-0">Novo Pedido</h3>
                        <div>
                            <button type="submit" form="novoPedidoForm" class="btn btn-primary me-2">Salvar Pedido</button>
                            <button type="button" class="btn btn-secondary" onclick="loadPedidos()">Cancelar</button>
                        </div>
                    </div>
                    <div class="card-body">
                        <form id="novoPedidoForm" onsubmit="handleNovoPedido(event)" class="needs-validation" novalidate>
                            <div id="itensPedido">
                                <h5>Itens do Pedido</h5>
                                <div class="itens-list"></div>
                                <button type="button" class="btn btn-secondary btn-sm mt-2" onclick="adicionarItem()">Adicionar Item</button>
                            </div>
                            <div class="mb-3 mt-3">
                                <label class="form-label">Observações</label>
                                <textarea class="form-control" id="observacoes" rows="2"></textarea>
                            </div>
                            <div class="mb-3">
                                <label for="formaPagamento" class="form-label">Forma de Pagamento</label>
                                <select class="form-select" id="formaPagamento" name="formaPagamento" required>                                    <option value="">Selecione...</option>
                                    <option value="PIX">Pix</option>
                                    <option value="CARTAO_DEBITO">Cartão de Débito</option>
                                    <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                                    <option value="BOLETO">Boleto</option>
                                </select>
                                <div class="invalid-feedback">Escolha a forma de pagamento</div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Função para adicionar item ao pedido
function adicionarItem() {
    const itemsList = document.querySelector('#itensPedido .itens-list');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'item-pedido mb-3 p-3 border rounded';
    itemDiv.innerHTML = `
        <div class="mb-2">
            <label class="form-label">Descrição</label>
            <textarea class="form-control item-descricao" rows="2"></textarea>
        </div>
        <div class="mb-2">
            <label class="form-label">Preço</label>
            <input type="number" class="form-control item-preco" step="0.01" min="0">
        </div>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">
            Remover Item
        </button>
    `;
    itemsList.appendChild(itemDiv);
}

// Função para salvar novo pedido
async function handleNovoPedido(event) {
    event.preventDefault();
    const form = event.target;
    if (!form.checkValidity()) {
        event.stopPropagation();
        form.classList.add('was-validated');
        return;
    }    const itens = Array.from(document.querySelectorAll('.item-pedido')).map(item => ({
        descricao: item.querySelector('.item-descricao').value.trim(),
        preco: parseFloat(item.querySelector('.item-preco').value)
    })).filter(item => item.descricao && !isNaN(item.preco));
    const observacoes = document.getElementById('observacoes').value.trim();
    const metodo_pagamento = document.getElementById('formaPagamento').value;    try {
        await fetchAPI('/pedidos/', {
            method: 'POST',
            body: JSON.stringify({ itens, observacoes, metodo_pagamento })
        });
        showMessage('Pedido criado com sucesso!', 'success');
        // Remove the new order page class before returning to list
        document.body.classList.remove('novo-pedido-page');
        loadPedidos();
    } catch (error) {
        showMessage('Erro ao criar pedido. Tente novamente.', 'danger');
    }
}

// Função para confirmar valor final do pedido
async function confirmarValorFinal(pedidoId) {
    try {
        const button = event.target;
        button.disabled = true;
        button.textContent = 'Processando...';

        // Update status to CONFIRMADO
        await fetchAPI(`/pedidos/${pedidoId}/update_status/`, {
            method: 'POST',
            body: JSON.stringify({
                status: 'CONFIRMADO',
                comentario: 'Valor final confirmado pelo cliente'
            })
        });

        showMessage('Valor final confirmado! O pedido foi confirmado.', 'success');
        loadPedidos(); // Recarregar a lista completa de pedidos
    } catch (error) {
        console.error('Erro ao confirmar valor final:', error);
        showMessage('Erro ao confirmar valor final', 'danger');
        button.disabled = false;
        button.textContent = 'Confirmar Valor';
    }
}

// Atualiza só a lista de pedidos
async function atualizarListaPedidos() {
    try {
        // Get expanded orders from localStorage logo no início
        const expandedOrders = JSON.parse(localStorage.getItem('expandedOrders') || '[]');
        
        // Busca o usuário só para pegar o id, mas não faz redirecionamento
        const user = await getCurrentUser();
        if (!user || user.is_staff) return;
        const data = await fetchAPI(`/pedidos/?cliente=${user.id}`);
        const listaPedidos = document.getElementById('listaPedidos');

        if (data.results && data.results.length > 0) {
            listaPedidos.innerHTML = data.results.map(pedido => {
                const isExpanded = expandedOrders.includes(pedido.id.toString());
                return `
                <div class="card mb-4 border-0 rounded-3" style="max-width:100%;">
                    <div class="card-body p-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pedido-header-clickable" onclick="togglePedidoMinimizadoUsuario(${pedido.id})" style="cursor:pointer; border-bottom: 1px solid #dee2e6;">
                        <div class="d-flex flex-column flex-md-row align-items-md-center gap-3 w-100">
                            <div class="d-flex align-items-center gap-2">
                                <span class="badge ${getBadgeClassUsuario(pedido.status)} px-3 py-2 rounded-pill">
                                    ${getStatusIconUsuario(pedido.status)}
                                </span>
                                <span class="fw-bold text-center text-md-start fs-5">Pedido #${pedido.id}</span>
                            </div>
                            <span class="text-muted small text-center text-md-start">${new Date(pedido.data_criacao).toLocaleDateString()}</span>
                        </div>
                        <div class="d-flex flex-column flex-md-row align-items-md-center gap-3 w-100 justify-content-md-end flex-grow-1" style="min-width:320px;">
                            <span class="fw-bold text-primary text-center text-md-start me-md-auto fs-5" style="white-space:nowrap;">R$&nbsp;${parseFloat(pedido.valor_final || pedido.valor_total).toFixed(2)}</span>
                            <span class="text-muted small w-100 text-center d-block" style="vertical-align:middle;">${formatStatus(pedido.status)}</span>
                            <span class="mx-auto mx-md-0 pedido-toggle-arrow" style="font-size:1.2rem;">
                                <i id="pedido-toggle-icon-usuario-${pedido.id}" class="bi bi-chevron-${isExpanded ? 'up' : 'down'} text-muted"></i>
                            </span>
                        </div>
                    </div>
                    <div id="pedido-content-usuario-${pedido.id}" class="${isExpanded ? 'pedido-content-visible' : 'pedido-content-hidden'}" style="background-color: #fafafa;">
                        <div class="p-4">
                            <div class="mb-4">
                                <strong class="text-center text-md-start d-block mb-3 fs-6">Itens do Pedido:</strong>
                                <ul class="list-unstyled mb-2">
                                    ${pedido.itens && pedido.itens.length > 0 ? pedido.itens.map(item => `
                                        <li class="d-flex justify-content-between border-bottom py-2">
                                            <span class="text-center text-md-start">${item.descricao}</span>
                                            <span class="text-end w-25 fw-bold">R$ ${parseFloat(item.preco).toFixed(2)}</span>
                                        </li>
                                    `).join('') : '<li class="text-muted text-center py-2">Nenhum item</li>'}
                                </ul>
                            </div>
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <strong class="text-secondary">Status:</strong>
                                        <span class="ms-2">${formatStatus(pedido.status)}</span>
                                    </div>
                                    <div class="mb-3">
                                        <strong class="text-secondary">Última atualização:</strong>
                                        <span class="ms-2">${new Date(pedido.historico_status && pedido.historico_status.length > 0 ? pedido.historico_status[pedido.historico_status.length - 1].data : pedido.data_criacao).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <strong class="text-secondary">Observação:</strong>
                                        <span class="ms-2">${pedido.observacoes ? pedido.observacoes : '<span class="text-muted">Nenhuma</span>'}</span>
                                    </div>
                                    <div class="mb-3">
                                        <strong class="text-secondary">Pagamento:</strong>
                                        <span class="ms-2">${formatPaymentMethod(pedido.metodo_pagamento) || '<span class="text-muted">Não definido</span>'}</span>
                                    </div>
                                </div>
                            </div>
                            ${pedido.status === 'AGUARDANDO_PAGAMENTO' && pedido.valor_final ? `
                            <div class="alert alert-info mt-3 p-3">
                                <strong>Valor Final:</strong> R$ ${pedido.valor_final}
                                <div class="mt-3">
                                    <button class="btn btn-success btn-sm px-4" onclick="event.stopPropagation(); confirmarValorFinal(${pedido.id})">
                                        <i class="bi bi-check-lg me-2"></i>Confirmar Valor
                                    </button>
                                    <button class="btn btn-outline-danger btn-sm px-4 ms-2" onclick="event.stopPropagation(); recusarValorFinal(${pedido.id})">
                                        <i class="bi bi-x-lg me-2"></i>Recusar Valor
                                    </button>
                                </div>
                            </div>
                            ` : ''}
                            <div class="mt-4">
                                <strong class="text-secondary d-block mb-3">Histórico:</strong>
                                <ul class="list-unstyled mb-0">
                                    ${pedido.historico_status && pedido.historico_status.length > 0 ? pedido.historico_status.map(status => `
                                        <li class="small historico-status-item mb-3 border-start ps-3" style="border-left-width: 3px; border-left-color: #6c757d;">
                                            <div class="d-flex align-items-baseline gap-2">
                                                <span>${getStatusIconUsuario(status.status)}</span>
                                                <div class="flex-grow-1">
                                                    <div class="d-flex align-items-baseline gap-2">
                                                        <span class="fw-bold">${formatStatus(status.status)}</span>
                                                        <span class="text-muted small">- ${new Date(status.data).toLocaleString()}</span>
                                                    </div>
                                                    ${status.comentario ? `
                                                    <div class="mt-1 text-muted" style="font-size: 0.9em; text-align: left;">
                                                        <i class="bi bi-chat-left-text me-2"></i>${status.comentario}
                                                    </div>` : ''}
                                                </div>
                                            </div>
                                        </li>
                                    `).join('') : '<li class="text-muted">Sem histórico</li>'}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } else {
            listaPedidos.innerHTML = '<p class="text-center">Nenhum pedido encontrado.</p>';
        }
    } catch (error) {
        console.error('Erro ao atualizar lista de pedidos:', error);
    }
}

// Função global para minimizar/maximizar pedidos
window.togglePedidoMinimizadoUsuario = function(pedidoId) {
    // Get the current expanded orders from localStorage
    const expandedOrders = JSON.parse(localStorage.getItem('expandedOrders') || '[]');
    
    // Get the content and icon elements
    const content = document.getElementById('pedido-content-usuario-' + pedidoId);
    const icon = document.getElementById('pedido-toggle-icon-usuario-' + pedidoId);
    
    if (!content || !icon) return;

    // Check if currently expanded
    const isExpanded = expandedOrders.includes(pedidoId.toString());

    if (isExpanded) {
        // Remove from expanded list
        const index = expandedOrders.indexOf(pedidoId.toString());
        if (index > -1) expandedOrders.splice(index, 1);
        
        // Update UI
        content.classList.remove('pedido-content-visible');
        content.classList.add('pedido-content-hidden');
        icon.classList.remove('bi-chevron-up');
        icon.classList.add('bi-chevron-down');
    } else {
        // Add to expanded list
        expandedOrders.push(pedidoId.toString());
        
        // Update UI
        content.classList.remove('pedido-content-hidden');
        content.classList.add('pedido-content-visible');
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('bi-chevron-up');
    }

    // Save updated expanded state
    localStorage.setItem('expandedOrders', JSON.stringify(expandedOrders));
};