class ControleFinanceiro {
    constructor() {
        this.transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
        this.tema = localStorage.getItem('tema') || 'light';
        this.graficos = {};
        this.periodoAtual = 'mes-atual';
        this.paginaAtual = 'dashboard';
        this.orcamentos = JSON.parse(localStorage.getItem('orcamentos')) || {};
        this.perfil = JSON.parse(localStorage.getItem('perfil')) || {
            nome: 'Usuário',
            email: '',
            moeda: 'BRL'
        };
        this.metas = JSON.parse(localStorage.getItem('metas')) || [];
        this.inicializar();
    }

    inicializar() {
        this.aplicarTema();
        this.configurarNavegacao();
        this.configurarMenuUsuario();
        this.configurarBackup();
    }

    aplicarTema() {
        document.documentElement.setAttribute('data-theme', this.tema);
        const icone = document.querySelector('#theme-toggle i');
        icone.className = this.tema === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    alternarTema() {
        this.tema = this.tema === 'light' ? 'dark' : 'light';
        localStorage.setItem('tema', this.tema);
        document.documentElement.setAttribute('data-theme', this.tema);
        
        // Atualizar ícone do tema
        const icone = document.querySelector('#theme-toggle i');
        if (icone) {
            icone.className = this.tema === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }

        // Atualizar gráficos se existirem
        if (this.paginaAtual === 'dashboard' && this.graficos.categorias) {
            this.atualizarGraficos();
        }
    }

    configurarEventos() {
        // Eventos do tema
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.alternarTema();
            });
        }

        // Eventos de período
        document.querySelectorAll('.periodo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const active = document.querySelector('.periodo-btn.active');
                if (active) active.classList.remove('active');
                e.target.classList.add('active');
                this.periodoAtual = e.target.dataset.periodo;
                this.atualizarDashboard();
            });
        });
    }

    filtrarTransacoesPorPeriodo(transacoes) {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

        switch (this.periodoAtual) {
            case 'mes-atual':
                return transacoes.filter(t => {
                    const data = new Date(t.data);
                    return data >= inicioMes && data <= fimMes;
                });
            case 'ultimo-mes':
                const inicioUltimoMes = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                const fimUltimoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                return transacoes.filter(t => {
                    const data = new Date(t.data);
                    return data >= inicioUltimoMes && data <= fimUltimoMes;
                });
            case '3-meses':
                const inicio3Meses = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
                return transacoes.filter(t => {
                    const data = new Date(t.data);
                    return data >= inicio3Meses && data <= fimMes;
                });
            case 'ano':
                const inicioAno = new Date(hoje.getFullYear(), 0, 1);
                return transacoes.filter(t => {
                    const data = new Date(t.data);
                    return data >= inicioAno && data <= hoje;
                });
            default:
                return transacoes;
        }
    }

    atualizarDashboard() {
        const transacoesFiltradas = this.filtrarTransacoesPorPeriodo(this.transacoes);
        this.atualizarSaldo(transacoesFiltradas);
        this.atualizarTabela(transacoesFiltradas);
        this.atualizarGraficos(transacoesFiltradas);
        this.atualizarVariacoes();
        this.atualizarUltimasTransacoes();
    }

    inicializarGraficos() {
        // Destruir gráficos existentes se houver
        if (this.graficos.categorias) {
            this.graficos.categorias.destroy();
        }
        if (this.graficos.fluxo) {
            this.graficos.fluxo.destroy();
        }

        // Inicializar novos gráficos
        const graficoCategorias = document.getElementById('grafico-categorias');
        const graficoFluxo = document.getElementById('grafico-fluxo');

        if (graficoCategorias && graficoFluxo) {
            this.graficos.categorias = new Chart(graficoCategorias, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#FF6384',
                            '#36A2EB',
                            '#FFCE56',
                            '#4BC0C0',
                            '#9966FF',
                            '#FF9F40'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'right',
                        }
                    }
                }
            });

            this.graficos.fluxo = new Chart(graficoFluxo, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Receitas',
                            borderColor: '#2ecc71',
                            data: []
                        },
                        {
                            label: 'Despesas',
                            borderColor: '#e74c3c',
                            data: []
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });

            this.atualizarGraficos();
        }
    }

    atualizarGraficos(transacoes = this.transacoes) {
        // Atualizar gráfico de categorias
        const despesasPorCategoria = {};
        transacoes.filter(t => t.tipo === 'despesa').forEach(t => {
            despesasPorCategoria[t.categoria] = (despesasPorCategoria[t.categoria] || 0) + t.valor;
        });

        this.graficos.categorias.data.labels = Object.keys(despesasPorCategoria);
        this.graficos.categorias.data.datasets[0].data = Object.values(despesasPorCategoria);
        this.graficos.categorias.update();

        // Atualizar gráfico de fluxo
        const dadosPorMes = {};
        transacoes.forEach(t => {
            const data = new Date(t.data);
            const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            if (!dadosPorMes[mes]) {
                dadosPorMes[mes] = { receitas: 0, despesas: 0 };
            }
            if (t.tipo === 'receita') {
                dadosPorMes[mes].receitas += t.valor;
            } else {
                dadosPorMes[mes].despesas += t.valor;
            }
        });

        const meses = Object.keys(dadosPorMes).sort();
        this.graficos.fluxo.data.labels = meses.map(mes => {
            const [ano, mesNum] = mes.split('-');
            return new Date(ano, mesNum - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        });
        this.graficos.fluxo.data.datasets[0].data = meses.map(mes => dadosPorMes[mes].receitas);
        this.graficos.fluxo.data.datasets[1].data = meses.map(mes => dadosPorMes[mes].despesas);
        this.graficos.fluxo.update();
    }

    filtrarTransacoes(termo) {
        if (!termo) {
            this.atualizarTabela(this.transacoes);
            return;
        }

        const termoLower = termo.toLowerCase();
        const transacoesFiltradas = this.transacoes.filter(t =>
            t.descricao.toLowerCase().includes(termoLower) ||
            t.categoria.toLowerCase().includes(termoLower)
        );
        this.atualizarTabela(transacoesFiltradas);
    }

    adicionarTransacao(transacao) {
        const novaTransacao = {
            ...transacao,
            id: Date.now(),
            data: transacao.data || new Date().toISOString().split('T')[0]
        };

        this.transacoes.push(novaTransacao);
        this.salvarTransacoes();
        this.atualizarTabela(); // Atualizar a tabela imediatamente
        this.mostrarNotificacao('Transação adicionada com sucesso!', 'sucesso');
    }

    removerTransacao(id) {
        this.mostrarModalConfirmacao(() => {
            this.transacoes = this.transacoes.filter(t => t.id !== id);
            this.salvarTransacoes();
            this.atualizarTabela();
            this.mostrarNotificacao('Transação removida com sucesso!', 'sucesso');
            
            if (this.paginaAtual === 'dashboard') {
                this.atualizarDashboard();
            }
        });
    }

    mostrarModalConfirmacao(callback) {
        const modal = document.getElementById('modal-confirmacao');
        const confirmar = document.getElementById('confirmar-exclusao');
        const cancelar = document.getElementById('cancelar-exclusao');

        if (modal && confirmar && cancelar) {
            modal.classList.remove('hidden');

            confirmar.onclick = () => {
                callback();
                modal.classList.add('hidden');
            };

            cancelar.onclick = () => {
                modal.classList.add('hidden');
            };

            // Fechar modal ao clicar fora
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            };
        }
    }

    editarTransacao(id) {
        const transacao = this.transacoes.find(t => t.id === id);
        if (!transacao) return;

        // Preencher formulário com dados da transação
        document.getElementById('descricao').value = transacao.descricao;
        document.getElementById('valor').value = transacao.valor;
        document.getElementById('tipo').value = transacao.tipo;
        document.getElementById('categoria').value = transacao.categoria;
        document.getElementById('data').value = transacao.data;

        // Mostrar formulário
        document.getElementById('form-transacao').classList.remove('hidden');

        // Remover transação antiga
        this.transacoes = this.transacoes.filter(t => t.id !== id);
        this.salvarTransacoes();
    }

    salvarTransacoes() {
        localStorage.setItem('transacoes', JSON.stringify(this.transacoes));
    }

    atualizarSaldo(transacoes = this.transacoes) {
        const saldo = transacoes.reduce((acc, t) => {
            return t.tipo === 'receita' ? acc + t.valor : acc - t.valor;
        }, 0);

        const receitas = transacoes
            .filter(t => t.tipo === 'receita')
            .reduce((acc, t) => acc + t.valor, 0);

        const despesas = transacoes
            .filter(t => t.tipo === 'despesa')
            .reduce((acc, t) => acc + t.valor, 0);

        document.getElementById('saldo').textContent = this.formatarMoeda(saldo);
        document.getElementById('total-receitas').textContent = this.formatarMoeda(receitas);
        document.getElementById('total-despesas').textContent = this.formatarMoeda(despesas);
    }

    atualizarTabela(transacoes = this.transacoes) {
        const tbody = document.getElementById('lista-transacoes');
        if (!tbody) return; // Verificação adicional

        tbody.innerHTML = '';
        
        transacoes
            .sort((a, b) => new Date(b.data) - new Date(a.data))
            .forEach(t => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${new Date(t.data).toLocaleDateString()}</td>
                    <td>${t.descricao}</td>
                    <td>${t.categoria}</td>
                    <td>${t.tipo}</td>
                    <td class="${t.tipo === 'receita' ? 'positivo' : 'negativo'}">
                        ${this.formatarMoeda(t.valor)}
                    </td>
                    <td>
                        <button onclick="controle.editarTransacao(${t.id})" class="icon-button">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="controle.removerTransacao(${t.id})" class="icon-button">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
    }

    formatarMoeda(valor) {
        const moedas = {
            'BRL': { locale: 'pt-BR', currency: 'BRL', symbol: 'R$' },
            'USD': { locale: 'en-US', currency: 'USD', symbol: '$' },
            'EUR': { locale: 'de-DE', currency: 'EUR', symbol: '€' }
        };

        const config = moedas[this.perfil.moeda] || moedas['BRL'];

        return valor.toLocaleString(config.locale, {
            style: 'currency',
            currency: config.currency
        });
    }

    configurarNavegacao() {
        // Configurar navegação desktop e mobile
        document.querySelectorAll('.nav-links a, .menu-mobile a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pagina = e.currentTarget.getAttribute('href').replace('#', '');
                
                // Remove active de todos os links
                document.querySelectorAll('.nav-links a, .menu-mobile a').forEach(l => {
                    l.classList.remove('active');
                });
                
                // Adiciona active ao link clicado (tanto no desktop quanto no mobile)
                document.querySelectorAll(`a[href="#${pagina}"]`).forEach(l => {
                    l.classList.add('active');
                });

                this.navegarPara(pagina);
            });
        });

        // Configurar clique no perfil do menu do usuário
        const perfilLinks = document.querySelectorAll('a[href="#perfil"]');
        perfilLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                // Remove active de todos os links
                document.querySelectorAll('.nav-links a, .menu-mobile a').forEach(l => {
                    l.classList.remove('active');
                });
                
                // Adiciona active aos links de perfil
                perfilLinks.forEach(l => {
                    l.classList.add('active');
                });
                
                this.navegarPara('perfil');
                
                // Fecha o dropdown do usuário se estiver aberto
                const userDropdown = document.getElementById('user-dropdown');
                if (userDropdown) {
                    userDropdown.classList.add('hidden');
                }
            });
        });

        // Iniciar na página dashboard
        this.navegarPara('dashboard');
    }

    navegarPara(pagina) {
        // Atualizar menu desktop e mobile
        document.querySelectorAll('.nav-links a, .menu-mobile a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${pagina}`) {
                link.classList.add('active');
            }
        });

        this.paginaAtual = pagina;
        this.carregarPagina();
    }

    carregarPagina() {
        const container = document.querySelector('main');
        if (!container) return;

        let conteudo = '';

        switch (this.paginaAtual) {
            case 'perfil':
                conteudo = this.renderizarPerfil(); // Certifique-se de que este método existe
                break;
            case 'dashboard':
                conteudo = this.renderizarDashboard();
                break;
            case 'transacoes':
                conteudo = this.renderizarTransacoes();
                break;
            case 'relatorios':
                conteudo = this.renderizarRelatorios();
                break;
            case 'orcamento':
                conteudo = this.renderizarOrcamento();
                break;
        }

        container.innerHTML = conteudo;
        this.inicializarEventosPagina();
    }

    renderizarTransacoes() {
        return `
            <section class="transacoes-page">
                <div class="transacoes-header">
                    <h2 class="transacoes-title">Gerenciar Transações</h2>
                    <button class="btn-primary" id="btn-nova-transacao">
                        <i class="fas fa-plus"></i> Nova Transação
                    </button>
                </div>

                <!-- Formulário de Nova Transação -->
                <form id="form-transacao" class="form-card hidden">
                    <div class="form-grid">
                        <div class="form-field">
                            <label for="descricao">Descrição</label>
                            <input type="text" id="descricao" required>
                        </div>
                        <div class="form-field">
                            <label for="valor">Valor</label>
                            <input type="number" id="valor" step="0.01" required>
                        </div>
                        <div class="form-field">
                            <label for="tipo">Tipo</label>
                            <select id="tipo" required>
                                <option value="receita">Receita</option>
                                <option value="despesa">Despesa</option>
                            </select>
                        </div>
                        <div class="form-field">
                            <label for="categoria">Categoria</label>
                            <select id="categoria" required>
                                <option value="salario">Salário</option>
                                <option value="alimentacao">Alimentação</option>
                                <option value="transporte">Transporte</option>
                                <option value="moradia">Moradia</option>
                                <option value="lazer">Lazer</option>
                                <option value="outros">Outros</option>
                            </select>
                        </div>
                        <div class="form-field">
                            <label for="data">Data</label>
                            <input type="date" id="data" required>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">
                            <i class="fas fa-check"></i> Salvar
                        </button>
                        <button type="button" class="btn-secondary" id="btn-cancelar">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                    </div>
                </form>

                <div class="filtros-wrapper">
                    <div class="filtros-grid">
                        <div class="filtro-grupo">
                            <label>Data Início</label>
                            <input type="date" id="data-inicio">
                        </div>
                        <div class="filtro-grupo">
                            <label>Data Fim</label>
                            <input type="date" id="data-fim">
                        </div>
                        <div class="filtro-grupo">
                            <label>Tipo</label>
                            <select id="filtro-tipo">
                                <option value="">Todos</option>
                                <option value="receita">Receitas</option>
                                <option value="despesa">Despesas</option>
                            </select>
                        </div>
                        <div class="filtro-grupo">
                            <label>Ordenar por</label>
                            <select id="ordenacao">
                                <option value="data">Data</option>
                                <option value="valor">Valor</option>
                                <option value="descricao">Descrição</option>
                            </select>
                        </div>
                    </div>
                    <div class="filtros-actions">
                        <button class="btn-secondary" onclick="controle.limparFiltros()">
                            <i class="fas fa-undo"></i> Limpar Filtros
                        </button>
                        <button class="btn-primary" onclick="controle.aplicarFiltros()">
                            <i class="fas fa-filter"></i> Aplicar Filtros
                        </button>
                    </div>
                </div>

                <div class="transacoes-grid">
                    ${this.transacoes.map(t => `
                        <div class="transacao-item">
                            <div class="transacao-icon">
                                <i class="fas ${t.tipo === 'receita' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                            </div>
                            <div class="transacao-info">
                                <span class="transacao-descricao">${t.descricao}</span>
                                <span class="transacao-categoria">${t.categoria}</span>
                            </div>
                            <span class="transacao-data">${new Date(t.data).toLocaleDateString()}</span>
                            <span class="transacao-valor ${t.tipo}">${this.formatarMoeda(t.valor)}</span>
                            <div class="transacao-acoes">
                                <button class="icon-action" onclick="controle.editarTransacao(${t.id})">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="icon-action" onclick="controle.removerTransacao(${t.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }

    renderizarRelatorios() {
        return `
            <section class="relatorios-page">
                <div class="section-header">
                    <h2>Relatórios Financeiros</h2>
                    <div class="periodo-selector">
                        <button class="periodo-btn active" data-periodo="mes">Mês</button>
                        <button class="periodo-btn" data-periodo="trimestre">Trimestre</button>
                        <button class="periodo-btn" data-periodo="ano">Ano</button>
                        <button class="periodo-btn" data-periodo="personalizado">Personalizado</button>
                    </div>
                </div>

                <div class="relatorios-grid">
                    <div class="relatorio-card">
                        <h3>Fluxo de Caixa</h3>
                        <canvas id="grafico-fluxo-detalhado"></canvas>
                    </div>

                    <div class="relatorio-card">
                        <h3>Despesas por Categoria</h3>
                        <canvas id="grafico-categorias-detalhado"></canvas>
                    </div>

                    <div class="relatorio-card">
                        <h3>Comparativo Mensal</h3>
                        <canvas id="grafico-comparativo"></canvas>
                    </div>

                    <div class="relatorio-card">
                        <h3>Análise de Tendências</h3>
                        <canvas id="grafico-tendencias"></canvas>
                    </div>
                </div>

                <div class="relatorio-resumo">
                    <h3>Resumo Financeiro</h3>
                    <div class="resumo-grid">
                        <div class="resumo-item">
                            <span class="label">Receitas Totais</span>
                            <span class="valor positivo" id="relatorio-receitas">R$ 0,00</span>
                        </div>
                        <div class="resumo-item">
                            <span class="label">Despesas Totais</span>
                            <span class="valor negativo" id="relatorio-despesas">R$ 0,00</span>
                        </div>
                        <div class="resumo-item">
                            <span class="label">Saldo Período</span>
                            <span class="valor" id="relatorio-saldo">R$ 0,00</span>
                        </div>
                        <div class="resumo-item">
                            <span class="label">Economia</span>
                            <span class="valor" id="relatorio-economia">0%</span>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    renderizarOrcamento() {
        return `
            <section class="orcamento-page">
                <div class="section-header">
                    <h2>Gestão de Orçamento</h2>
                    <button class="btn-primary" id="btn-novo-orcamento">
                        <i class="fas fa-plus"></i> Definir Novo Orçamento
                    </button>
                </div>

                <div class="orcamento-grid">
                    <div class="orcamento-card">
                        <h3>Visão Geral do Orçamento</h3>
                        <canvas id="grafico-orcamento"></canvas>
                    </div>

                    <div class="orcamento-card">
                        <h3>Orçamentos por Categoria</h3>
                        <div id="lista-orcamentos"></div>
                    </div>
                </div>

                <div id="form-orcamento" class="modal hidden">
                    <div class="modal-content">
                        <h3>Definir Orçamento</h3>
                        <form id="orcamento-form">
                            <div class="form-field">
                                <label>Categoria</label>
                                <select id="orcamento-categoria" required>
                                    <option value="alimentacao">Alimentação</option>
                                    <option value="transporte">Transporte</option>
                                    <option value="moradia">Moradia</option>
                                    <option value="lazer">Lazer</option>
                                    <option value="outros">Outros</option>
                                </select>
                            </div>
                            <div class="form-field">
                                <label>Valor Limite</label>
                                <input type="number" id="orcamento-valor" step="0.01" required>
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn-primary">Salvar</button>
                                <button type="button" class="btn-secondary" id="btn-cancelar-orcamento">Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            </section>
        `;
    }

    renderizarDashboard() {
        return `
            <section class="dashboard-header">
                <h1>Olá, ${this.perfil.nome}! <small>Bem-vindo ao seu Dashboard</small></h1>
                <div class="periodo-selector">
                    <button class="periodo-btn active" data-periodo="mes-atual">Mês Atual</button>
                    <button class="periodo-btn" data-periodo="ultimo-mes">Último Mês</button>
                    <button class="periodo-btn" data-periodo="3-meses">3 Meses</button>
                    <button class="periodo-btn" data-periodo="ano">Ano</button>
                </div>
            </section>

            <section class="cards-overview">
                <div class="card saldo-card">
                    <div class="card-header">
                        <h3>Saldo Total</h3>
                        <i class="fas fa-wallet"></i>
                    </div>
                    <span id="saldo" class="card-value">R$ 0,00</span>
                    <div class="card-footer">
                        <span class="variacao" id="variacao-saldo">Calculando...</span>
                    </div>
                </div>

                <div class="card receitas-card">
                    <div class="card-header">
                        <h3>Receitas</h3>
                        <i class="fas fa-arrow-up"></i>
                    </div>
                    <span id="total-receitas" class="card-value positivo">R$ 0,00</span>
                    <div class="card-footer">
                        <span class="variacao" id="variacao-receitas">Calculando...</span>
                    </div>
                </div>

                <div class="card despesas-card">
                    <div class="card-header">
                        <h3>Despesas</h3>
                        <i class="fas fa-arrow-down"></i>
                    </div>
                    <span id="total-despesas" class="card-value negativo">R$ 0,00</span>
                    <div class="card-footer">
                        <span class="variacao" id="variacao-despesas">Calculando...</span>
                    </div>
                </div>
            </section>

            <section class="graficos">
                <div class="grafico-card">
                    <h3>Despesas por Categoria</h3>
                    <canvas id="grafico-categorias"></canvas>
                </div>
                <div class="grafico-card">
                    <h3>Fluxo de Caixa</h3>
                    <canvas id="grafico-fluxo"></canvas>
                </div>
            </section>

            <section class="ultimas-transacoes">
                <div class="section-header">
                    <h3>Últimas Transações</h3>
                    <button class="btn-link" onclick="controle.navegarPara('transacoes')">
                        Ver todas <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
                <div class="tabela-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Descrição</th>
                                <th>Categoria</th>
                                <th>Valor</th>
                            </tr>
                        </thead>
                        <tbody id="ultimas-transacoes"></tbody>
                    </table>
                </div>
            </section>
        `;
    }

    inicializarEventosPagina() {
        switch (this.paginaAtual) {
            case 'dashboard':
                this.configurarEventos();
                this.inicializarGraficos();
                this.atualizarDashboard();
                this.verificarLimitesOrcamento();
                break;
            case 'transacoes':
                this.configurarEventosTransacoes();
                this.atualizarTabela();
                break;
            case 'relatorios':
                this.configurarEventos();
                this.inicializarGraficosRelatorios();
                this.atualizarRelatorios();
                break;
            case 'orcamento':
                this.configurarEventosOrcamento();
                this.atualizarOrcamentos();
                break;
            case 'perfil':
                this.configurarEventosPerfil();
                break;
        }
    }

    configurarEventosTransacoes() {
        const form = document.getElementById('form-transacao');
        const btnNovo = document.getElementById('btn-nova-transacao');
        const btnCancelar = document.getElementById('btn-cancelar');

        if (btnNovo) {
            btnNovo.addEventListener('click', () => {
                if (form) {
                    form.classList.remove('hidden');
                    // Preencher data atual
                    const dataInput = document.getElementById('data');
                    if (dataInput) {
                        dataInput.value = new Date().toISOString().split('T')[0];
                    }
                }
            });
        }

        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => {
                if (form) {
                    form.classList.add('hidden');
                    form.reset();
                }
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const transacao = {
                    descricao: document.getElementById('descricao').value,
                    valor: parseFloat(document.getElementById('valor').value),
                    tipo: document.getElementById('tipo').value,
                    categoria: document.getElementById('categoria').value,
                    data: document.getElementById('data').value
                };
                
                this.adicionarTransacao(transacao);
                form.reset();
                form.classList.add('hidden');
                
                // Atualizar todas as visualizações necessárias
                this.atualizarTabela();
                if (this.paginaAtual === 'dashboard') {
                    this.atualizarDashboard();
                }
            });
        }

        // Configurar eventos de filtro
        const filtros = ['data-inicio', 'data-fim', 'filtro-tipo', 'ordenacao', 'busca'];
        filtros.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.addEventListener('change', () => this.aplicarFiltrosTransacoes());
            }
        });
    }

    configurarFormularioTransacao() {
        const form = document.getElementById('form-transacao');
        const btnNovo = document.getElementById('btn-nova-transacao');
        const btnCancelar = document.getElementById('btn-cancelar');

        if (btnNovo) {
            btnNovo.addEventListener('click', () => {
                form.classList.remove('hidden');
            });
        }

        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => {
                form.classList.add('hidden');
                form.reset();
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.adicionarTransacao({
                    descricao: document.getElementById('descricao').value,
                    valor: parseFloat(document.getElementById('valor').value),
                    tipo: document.getElementById('tipo').value,
                    categoria: document.getElementById('categoria').value,
                    data: document.getElementById('data').value || new Date().toISOString().split('T')[0]
                });
                form.reset();
                form.classList.add('hidden');
                this.atualizarDashboard();
            });
        }
    }

    exportarTransacoes() {
        const transacoesCSV = this.transacoes.map(t => {
            return `${t.data},${t.descricao},${t.categoria},${t.tipo},${t.valor}`;
        });

        const header = 'Data,Descrição,Categoria,Tipo,Valor\n';
        const csv = header + transacoesCSV.join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transacoes_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    // Métodos para Orçamentos
    salvarOrcamento(categoria, valor) {
        this.orcamentos[categoria] = valor;
        localStorage.setItem('orcamentos', JSON.stringify(this.orcamentos));
        this.atualizarOrcamentos();
    }

    configurarEventosOrcamento() {
        const btnNovo = document.getElementById('btn-novo-orcamento');
        const form = document.getElementById('form-orcamento');
        const btnCancelar = document.getElementById('btn-cancelar-orcamento');

        if (btnNovo) {
            btnNovo.addEventListener('click', () => {
                form.classList.remove('hidden');
            });
        }

        if (btnCancelar) {
            btnCancelar.addEventListener('click', () => {
                form.classList.add('hidden');
                document.getElementById('orcamento-form').reset();
            });
        }

        const orcamentoForm = document.getElementById('orcamento-form');
        if (orcamentoForm) {
            orcamentoForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const categoria = document.getElementById('orcamento-categoria').value;
                const valor = parseFloat(document.getElementById('orcamento-valor').value);
                this.salvarOrcamento(categoria, valor);
                form.classList.add('hidden');
                orcamentoForm.reset();
            });
        }
    }

    atualizarOrcamentos() {
        const listaOrcamentos = document.getElementById('lista-orcamentos');
        if (!listaOrcamentos) return;

        const despesasPorCategoria = {};
        this.transacoes
            .filter(t => t.tipo === 'despesa')
            .forEach(t => {
                despesasPorCategoria[t.categoria] = (despesasPorCategoria[t.categoria] || 0) + t.valor;
            });

        listaOrcamentos.innerHTML = Object.entries(this.orcamentos)
            .map(([categoria, limite]) => {
                const gasto = despesasPorCategoria[categoria] || 0;
                const percentual = (gasto / limite) * 100;
                const status = percentual > 100 ? 'excedido' : percentual > 80 ? 'alerta' : 'normal';

                return `
                    <div class="orcamento-item ${status}">
                        <div class="orcamento-info">
                            <h4>${categoria}</h4>
                            <p>${this.formatarMoeda(gasto)} de ${this.formatarMoeda(limite)}</p>
                        </div>
                        <div class="orcamento-barra">
                            <div class="barra-progresso" style="width: ${Math.min(percentual, 100)}%"></div>
                        </div>
                    </div>
                `;
            })
            .join('');

        this.inicializarGraficosOrcamento();
    }

    inicializarGraficosOrcamento() {
        const canvas = document.getElementById('grafico-orcamento');
        if (!canvas) return;

        const despesasPorCategoria = {};
        this.transacoes
            .filter(t => t.tipo === 'despesa')
            .forEach(t => {
                despesasPorCategoria[t.categoria] = (despesasPorCategoria[t.categoria] || 0) + t.valor;
            });

        const dados = Object.entries(this.orcamentos).map(([categoria, limite]) => ({
            categoria,
            limite,
            gasto: despesasPorCategoria[categoria] || 0
        }));

        if (this.graficos.orcamento) {
            this.graficos.orcamento.destroy();
        }

        this.graficos.orcamento = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: dados.map(d => d.categoria),
                datasets: [
                    {
                        label: 'Orçamento',
                        data: dados.map(d => d.limite),
                        backgroundColor: 'rgba(52, 152, 219, 0.5)',
                        borderColor: 'rgba(52, 152, 219, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Gasto Real',
                        data: dados.map(d => d.gasto),
                        backgroundColor: 'rgba(231, 76, 60, 0.5)',
                        borderColor: 'rgba(231, 76, 60, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    configurarMenuUsuario() {
        const userMenu = document.getElementById('user-menu');
        if (userMenu) {
            userMenu.addEventListener('click', () => {
                this.mostrarPerfil(); // Agora vai direto para a página de perfil
            });
        }
    }

    configurarBackup() {
        const importFile = document.getElementById('import-file');
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const dados = JSON.parse(e.target.result);
                        this.importarDados(dados);
                    } catch (error) {
                        this.mostrarNotificacao('Erro ao importar dados', 'erro');
                    }
                };
                reader.readAsText(file);
            }
        });
    }

    exportarDados() {
        const dados = {
            transacoes: this.transacoes,
            orcamentos: this.orcamentos,
            tema: this.tema,
            versao: '1.0'
        };

        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `financetracker_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.mostrarNotificacao('Backup exportado com sucesso!', 'sucesso');
    }

    importarDados(dados) {
        if (!dados.versao || !dados.transacoes) {
            this.mostrarNotificacao('Arquivo de backup inválido', 'erro');
            return;
        }

        if (confirm('Isso irá substituir todos os dados atuais. Deseja continuar?')) {
            this.transacoes = dados.transacoes;
            this.orcamentos = dados.orcamentos || {};
            this.tema = dados.tema || 'light';
            
            localStorage.setItem('transacoes', JSON.stringify(this.transacoes));
            localStorage.setItem('orcamentos', JSON.stringify(this.orcamentos));
            localStorage.setItem('tema', this.tema);

            this.aplicarTema();
            this.atualizarDashboard();
            this.mostrarNotificacao('Dados importados com sucesso!', 'sucesso');
            document.getElementById('modal-backup').classList.add('hidden');
        }
    }

    mostrarNotificacao(mensagem, tipo = 'info') {
        const notificacao = document.createElement('div');
        notificacao.className = `notificacao ${tipo}`;
        notificacao.innerHTML = `
            <i class="fas fa-${tipo === 'sucesso' ? 'check-circle' : 
                             tipo === 'erro' ? 'exclamation-circle' : 
                             'info-circle'}"></i>
            <span>${mensagem}</span>
        `;

        document.body.appendChild(notificacao);
        setTimeout(() => {
            notificacao.classList.add('mostrar');
        }, 100);

        setTimeout(() => {
            notificacao.classList.remove('mostrar');
            setTimeout(() => notificacao.remove(), 300);
        }, 3000);
    }

    mostrarPerfil() {
        this.paginaAtual = 'perfil';
        const container = document.querySelector('main');
        container.innerHTML = `
            <section class="perfil-page">
                <div class="section-header">
                    <h2>Configurações de Perfil</h2>
                </div>

                <div class="configuracoes-grid">
                    <div class="config-card">
                        <h3>Perfil</h3>
                        <form id="form-perfil" class="form-card">
                            <div class="form-field">
                                <label>Nome</label>
                                <input type="text" id="perfil-nome" value="${this.perfil.nome}" required>
                            </div>
                            <div class="form-field">
                                <label>E-mail</label>
                                <input type="email" id="perfil-email" value="${this.perfil.email}" required>
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn-primary">Salvar Alterações</button>
                            </div>
                        </form>
                    </div>

                    <div class="config-card">
                        <h3>Preferências</h3>
                        <div class="form-card">
                            <div class="form-field">
                                <label>Moeda</label>
                                <select id="perfil-moeda">
                                    <option value="BRL">Real (R$)</option>
                                    <option value="USD">Dólar ($)</option>
                                    <option value="EUR">Euro (€)</option>
                                </select>
                            </div>
                            <div class="form-field">
                                <label>Tema</label>
                                <select id="perfil-tema">
                                    <option value="light">Claro</option>
                                    <option value="dark">Escuro</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;

        // Configurar eventos do formulário de perfil
        const formPerfil = document.getElementById('form-perfil');
        if (formPerfil) {
            formPerfil.addEventListener('submit', (e) => {
                e.preventDefault();
                const dados = {
                    nome: document.getElementById('perfil-nome').value,
                    email: document.getElementById('perfil-email').value,
                    moeda: moedaSelect.value
                };
                this.salvarPerfil(dados);
                this.mostrarNotificacao('Perfil atualizado com sucesso!', 'sucesso');
            });
        }

        // Definir tema atual no select
        const temaSelect = document.getElementById('perfil-tema');
        if (temaSelect) {
            temaSelect.value = this.tema;
        }

        // Definir moeda atual no select
        const moedaSelect = document.getElementById('perfil-moeda');
        if (moedaSelect) {
            moedaSelect.value = this.perfil.moeda;
            moedaSelect.addEventListener('change', (e) => {
                this.salvarPerfil({ moeda: moedaSelect.value });
                this.atualizarDashboard();
            });
        }
    }

    mostrarAjuda() {
        const conteudo = `
            <section class="ajuda-page">
                <h2>Central de Ajuda</h2>
                <div class="ajuda-grid">
                    <div class="ajuda-card">
                        <h3>Primeiros Passos</h3>
                        <ul>
                            <li>Como adicionar transações</li>
                            <li>Configurando categorias</li>
                            <li>Definindo orçamentos</li>
                        </ul>
                    </div>
                    <div class="ajuda-card">
                        <h3>Perguntas Frequentes</h3>
                        <ul>
                            <li>Como fazer backup dos dados?</li>
                            <li>Como exportar relatórios?</li>
                            <li>Como funciona o sistema de orçamentos?</li>
                        </ul>
                    </div>
                    <div class="ajuda-card">
                        <h3>Contato</h3>
                        <p>Precisa de ajuda adicional?</p>
                        <button class="btn-primary" onclick="controle.mostrarFormularioContato()">
                            Enviar Mensagem
                        </button>
                    </div>
                </div>
            </section>
        `;

        document.querySelector('main').innerHTML = conteudo;
    }

    mostrarFormularioContato() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Enviar Mensagem</h3>
                <form id="form-contato">
                    <div class="form-field">
                        <label>Assunto</label>
                        <select required>
                            <option value="">Selecione um assunto</option>
                            <option value="duvida">Dúvida</option>
                            <option value="sugestao">Sugestão</option>
                            <option value="problema">Reportar Problema</option>
                        </select>
                    </div>
                    <div class="form-field">
                        <label>Mensagem</label>
                        <textarea required rows="4"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">Enviar</button>
                        <button type="button" class="btn-secondary" 
                                onclick="this.closest('.modal').remove()">
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
    }

    inicializarGraficosRelatorios() {
        const graficos = [
            'grafico-fluxo-detalhado',
            'grafico-categorias-detalhado',
            'grafico-comparativo',
            'grafico-tendencias'
        ];

        graficos.forEach(id => {
            const canvas = document.getElementById(id);
            if (!canvas) return;

            if (this.graficos[id]) {
                this.graficos[id].destroy();
            }

            this.graficos[id] = new Chart(canvas, {
                type: id.includes('categorias') ? 'doughnut' : 'line',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#FF6384',
                            '#36A2EB',
                            '#FFCE56',
                            '#4BC0C0',
                            '#9966FF',
                            '#FF9F40'
                        ]
                    }]
                },
                options: {
                    responsive: true
                }
            });
        });

        this.atualizarGraficosRelatorios();
    }

    atualizarGraficosRelatorios() {
        const transacoesFiltradas = this.filtrarTransacoesPorPeriodo(this.transacoes);

        // Gráfico de Fluxo Detalhado
        if (this.graficos['grafico-fluxo-detalhado']) {
            const dadosPorDia = {};
            transacoesFiltradas.forEach(t => {
                const data = t.data;
                if (!dadosPorDia[data]) {
                    dadosPorDia[data] = { receitas: 0, despesas: 0 };
                }
                if (t.tipo === 'receita') {
                    dadosPorDia[data].receitas += t.valor;
                } else {
                    dadosPorDia[data].despesas += t.valor;
                }
            });

            const dias = Object.keys(dadosPorDia).sort();
            this.graficos['grafico-fluxo-detalhado'].data = {
                labels: dias.map(d => new Date(d).toLocaleDateString()),
                datasets: [
                    {
                        label: 'Receitas',
                        data: dias.map(d => dadosPorDia[d].receitas),
                        borderColor: '#2ecc71',
                        fill: false
                    },
                    {
                        label: 'Despesas',
                        data: dias.map(d => dadosPorDia[d].despesas),
                        borderColor: '#e74c3c',
                        fill: false
                    }
                ]
            };
            this.graficos['grafico-fluxo-detalhado'].update();
        }

        // Gráfico de Categorias Detalhado
        if (this.graficos['grafico-categorias-detalhado']) {
            const despesasPorCategoria = {};
            transacoesFiltradas
                .filter(t => t.tipo === 'despesa')
                .forEach(t => {
                    despesasPorCategoria[t.categoria] = (despesasPorCategoria[t.categoria] || 0) + t.valor;
                });

            this.graficos['grafico-categorias-detalhado'].data = {
                labels: Object.keys(despesasPorCategoria),
                datasets: [{
                    data: Object.values(despesasPorCategoria),
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56',
                        '#4BC0C0', '#9966FF', '#FF9F40'
                    ]
                }]
            };
            this.graficos['grafico-categorias-detalhado'].update();
        }

        // Gráfico Comparativo
        if (this.graficos['grafico-comparativo']) {
            const mesesAnteriores = 6;
            const dadosComparativos = {};
            
            for (let i = 0; i < mesesAnteriores; i++) {
                const data = new Date();
                data.setMonth(data.getMonth() - i);
                const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                dadosComparativos[mesAno] = { receitas: 0, despesas: 0 };
            }

            this.transacoes.forEach(t => {
                const data = new Date(t.data);
                const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                if (dadosComparativos[mesAno]) {
                    if (t.tipo === 'receita') {
                        dadosComparativos[mesAno].receitas += t.valor;
                    } else {
                        dadosComparativos[mesAno].despesas += t.valor;
                    }
                }
            });

            const meses = Object.keys(dadosComparativos).sort();
            this.graficos['grafico-comparativo'].data = {
                labels: meses.map(m => {
                    const [ano, mes] = m.split('-');
                    return new Date(ano, mes - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                }),
                datasets: [
                    {
                        label: 'Receitas',
                        data: meses.map(m => dadosComparativos[m].receitas),
                        backgroundColor: 'rgba(46, 204, 113, 0.2)',
                        borderColor: '#2ecc71',
                        borderWidth: 2
                    },
                    {
                        label: 'Despesas',
                        data: meses.map(m => dadosComparativos[m].despesas),
                        backgroundColor: 'rgba(231, 76, 60, 0.2)',
                        borderColor: '#e74c3c',
                        borderWidth: 2
                    }
                ]
            };
            this.graficos['grafico-comparativo'].update();
        }

        // Gráfico de Tendências
        if (this.graficos['grafico-tendencias']) {
            const dadosTendencia = this.calcularTendencias();
            this.graficos['grafico-tendencias'].data = {
                labels: dadosTendencia.labels,
                datasets: [
                    {
                        label: 'Gastos Reais',
                        data: dadosTendencia.reais,
                        borderColor: '#3498db',
                        fill: false
                    },
                    {
                        label: 'Tendência',
                        data: dadosTendencia.tendencia,
                        borderColor: '#9b59b6',
                        borderDash: [5, 5],
                        fill: false
                    }
                ]
            };
            this.graficos['grafico-tendencias'].update();
        }

        // Atualizar resumo financeiro
        this.atualizarResumoFinanceiro(transacoesFiltradas);
    }

    calcularTendencias() {
        const ultimos6Meses = {};
        const hoje = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            ultimos6Meses[mesAno] = 0;
        }

        this.transacoes
            .filter(t => t.tipo === 'despesa')
            .forEach(t => {
                const data = new Date(t.data);
                const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                if (ultimos6Meses[mesAno] !== undefined) {
                    ultimos6Meses[mesAno] += t.valor;
                }
            });

        const valores = Object.values(ultimos6Meses);
        const labels = Object.keys(ultimos6Meses).map(mesAno => {
            const [ano, mes] = mesAno.split('-');
            return new Date(ano, mes - 1).toLocaleDateString('pt-BR', { month: 'short' });
        });

        // Calcular linha de tendência linear
        const n = valores.length;
        const x = Array.from({length: n}, (_, i) => i);
        const y = valores;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, curr, i) => acc + curr * y[i], 0);
        const sumXX = x.reduce((acc, curr) => acc + curr * curr, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        const tendencia = x.map(xi => slope * xi + intercept);

        return {
            labels,
            reais: valores,
            tendencia
        };
    }

    atualizarResumoFinanceiro(transacoes) {
        const receitas = transacoes
            .filter(t => t.tipo === 'receita')
            .reduce((acc, t) => acc + t.valor, 0);
        
        const despesas = transacoes
            .filter(t => t.tipo === 'despesa')
            .reduce((acc, t) => acc + t.valor, 0);
        
        const saldo = receitas - despesas;
        const economia = receitas > 0 ? ((receitas - despesas) / receitas * 100) : 0;

        document.getElementById('relatorio-receitas').textContent = this.formatarMoeda(receitas);
        document.getElementById('relatorio-despesas').textContent = this.formatarMoeda(despesas);
        document.getElementById('relatorio-saldo').textContent = this.formatarMoeda(saldo);
        document.getElementById('relatorio-economia').textContent = `${economia.toFixed(1)}%`;
    }

    // Adicionar método para salvar perfil
    salvarPerfil(dados) {
        this.perfil = { ...this.perfil, ...dados };
        localStorage.setItem('perfil', JSON.stringify(this.perfil));
        
        // Atualizar interface
        this.atualizarNomeUsuario();
        if (dados.moeda) {
            this.atualizarDashboard();
            this.atualizarTabela();
            if (this.paginaAtual === 'relatorios') {
                this.atualizarRelatorios();
            }
        }
    }

    // Adicionar método para atualizar nome do usuário
    atualizarNomeUsuario() {
        // Atualizar mensagem de boas-vindas no dashboard
        const mensagemBoasVindas = document.querySelector('.dashboard-header h1');
        if (mensagemBoasVindas) {
            mensagemBoasVindas.innerHTML = `Olá, ${this.perfil.nome}! <small>Bem-vindo ao seu Dashboard</small>`;
        }
    }

    atualizarVariacoes() {
        const periodoAtual = this.filtrarTransacoesPorPeriodo(this.transacoes);
        const periodoAnterior = this.obterTransacoesPeriodoAnterior();

        // Calcular saldos
        const saldoAtual = this.calcularSaldo(periodoAtual);
        const saldoAnterior = this.calcularSaldo(periodoAnterior);
        const variacaoSaldo = this.calcularVariacao(saldoAtual, saldoAnterior);

        // Calcular receitas
        const receitasAtual = this.calcularReceitas(periodoAtual);
        const receitasAnterior = this.calcularReceitas(periodoAnterior);
        const variacaoReceitas = this.calcularVariacao(receitasAtual, receitasAnterior);

        // Calcular despesas
        const despesasAtual = this.calcularDespesas(periodoAtual);
        const despesasAnterior = this.calcularDespesas(periodoAnterior);
        const variacaoDespesas = this.calcularVariacao(despesasAtual, despesasAnterior);

        // Atualizar UI
        document.getElementById('variacao-saldo').textContent = 
            `${variacaoSaldo >= 0 ? '+' : ''}${variacaoSaldo.toFixed(1)}% em relação ao período anterior`;
        document.getElementById('variacao-receitas').textContent = 
            `${variacaoReceitas >= 0 ? '+' : ''}${variacaoReceitas.toFixed(1)}% em relação ao período anterior`;
        document.getElementById('variacao-despesas').textContent = 
            `${variacaoDespesas >= 0 ? '+' : ''}${variacaoDespesas.toFixed(1)}% em relação ao período anterior`;
    }

    calcularVariacao(atual, anterior) {
        if (anterior === 0) return atual > 0 ? 100 : 0;
        return ((atual - anterior) / anterior) * 100;
    }

    calcularSaldo(transacoes) {
        return transacoes.reduce((acc, t) => 
            t.tipo === 'receita' ? acc + t.valor : acc - t.valor, 0);
    }

    calcularReceitas(transacoes) {
        return transacoes
            .filter(t => t.tipo === 'receita')
            .reduce((acc, t) => acc + t.valor, 0);
    }

    calcularDespesas(transacoes) {
        return transacoes
            .filter(t => t.tipo === 'despesa')
            .reduce((acc, t) => acc + t.valor, 0);
    }

    obterTransacoesPeriodoAnterior() {
        const hoje = new Date();
        let inicio, fim;

        switch (this.periodoAtual) {
            case 'mes-atual':
                inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                break;
            case 'ultimo-mes':
                inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
                fim = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 0);
                break;
            case '3-meses':
                inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
                fim = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 0);
                break;
            case 'ano':
                inicio = new Date(hoje.getFullYear() - 1, 0, 1);
                fim = new Date(hoje.getFullYear() - 1, 11, 31);
                break;
            default:
                return [];
        }

        return this.transacoes.filter(t => {
            const data = new Date(t.data);
            return data >= inicio && data <= fim;
        });
    }

    gerenciarMetas() {
        const saldoAtual = this.calcularSaldo(this.transacoes);
        const metasAtualizadas = this.metas.map(meta => {
            const progresso = (saldoAtual / meta.valor) * 100;
            return {
                ...meta,
                progresso: Math.min(progresso, 100),
                status: progresso >= 100 ? 'Alcançada' : 'Em andamento'
            };
        });

        // Notificar usuário sobre metas próximas de serem alcançadas
        metasAtualizadas.forEach(meta => {
            if (meta.progresso >= 90 && meta.progresso < 100) {
                this.mostrarNotificacao(`Você está próximo de alcançar sua meta: ${meta.descricao}!`, 'info');
            }
        });

        return metasAtualizadas;
    }

    verificarLimitesOrcamento() {
        const despesasMes = this.transacoes
            .filter(t => {
                const data = new Date(t.data);
                const mesAtual = new Date().getMonth();
                return t.tipo === 'despesa' && data.getMonth() === mesAtual;
            })
            .reduce((acc, t) => {
                acc[t.categoria] = (acc[t.categoria] || 0) + t.valor;
                return acc;
            }, {});

        Object.entries(this.orcamentos).forEach(([categoria, limite]) => {
            const gasto = despesasMes[categoria] || 0;
            const percentual = (gasto / limite) * 100;

            if (percentual >= 80 && percentual < 100) {
                this.mostrarNotificacao(
                    `Atenção: Você já usou ${percentual.toFixed(1)}% do orçamento de ${categoria}`,
                    'aviso'
                );
            } else if (percentual >= 100) {
                this.mostrarNotificacao(
                    `Limite excedido: Orçamento de ${categoria} ultrapassado!`,
                    'erro'
                );
            }
        });
    }

    analisarPadroes() {
        const gastosMensais = {};
        const hoje = new Date();
        const ultimosMeses = 6;

        // Agrupar gastos por mês
        this.transacoes
            .filter(t => t.tipo === 'despesa')
            .forEach(t => {
                const data = new Date(t.data);
                const mesAno = `${data.getFullYear()}-${data.getMonth()}`;
                gastosMensais[mesAno] = (gastosMensais[mesAno] || 0) + t.valor;
            });

        // Calcular média e tendência
        const valores = Object.values(gastosMensais);
        const mediaGastos = valores.reduce((a, b) => a + b, 0) / valores.length;
        const tendencia = this.calcularTendenciaLinear(valores);

        // Projetar próximo mês
        const projecaoProximoMes = tendencia.ultimoValor + tendencia.inclinacao;

        return {
            mediaGastos,
            tendencia: tendencia.inclinacao > 0 ? 'Aumento' : 'Redução',
            projecaoProximoMes,
            recomendacoes: this.gerarRecomendacoes(projecaoProximoMes, mediaGastos)
        };
    }

    gerarRecomendacoes(projecao, media) {
        const recomendacoes = [];
        
        if (projecao > media * 1.1) {
            recomendacoes.push({
                tipo: 'alerta',
                mensagem: 'Seus gastos estão em tendência de aumento. Considere revisar seu orçamento.'
            });
        }

        // Identificar categorias com maior impacto
        const categoriasPrincipais = this.identificarCategoriasPrincipais();
        categoriasPrincipais.forEach(cat => {
            if (cat.percentual > 30) {
                recomendacoes.push({
                    tipo: 'sugestao',
                    mensagem: `A categoria ${cat.nome} representa ${cat.percentual}% dos seus gastos. Considere estratégias de redução.`
                });
            }
        });

        return recomendacoes;
    }

    exportarRelatorio(tipo = 'pdf') {
        const dados = {
            periodo: this.periodoAtual,
            saldo: this.calcularSaldo(this.transacoes),
            transacoes: this.transacoes,
            analise: this.analisarPadroes(),
            metas: this.gerenciarMetas(),
            orcamentos: this.orcamentos
        };

        if (tipo === 'pdf') {
            this.gerarPDF(dados);
        } else if (tipo === 'excel') {
            this.gerarExcel(dados);
        }
    }

    gerarPDF(dados) {
        // Implementar geração de PDF com jsPDF
        const doc = new jsPDF();
        // ... lógica de geração do PDF
    }

    sugerirCategoria(descricao) {
        // Criar base de dados de palavras-chave
        const categoriasComuns = {
            'mercado,supermercado,feira': 'alimentacao',
            'uber,taxi,onibus,metro': 'transporte',
            'luz,agua,gas,aluguel': 'moradia',
            'netflix,cinema,restaurante': 'lazer'
        };

        const descricaoLower = descricao.toLowerCase();
        
        for (const [palavras, categoria] of Object.entries(categoriasComuns)) {
            if (palavras.split(',').some(palavra => descricaoLower.includes(palavra))) {
                return categoria;
            }
        }

        // Usar histórico do usuário como backup
        return this.encontrarCategoriaHistorica(descricaoLower);
    }

    sincronizarDados() {
        // Implementar sincronização com serviço de armazenamento em nuvem
        const dadosParaSincronizar = {
            transacoes: this.transacoes,
            metas: this.metas,
            orcamentos: this.orcamentos,
            perfil: this.perfil,
            configuracoes: this.configuracoes
        };

        // Adicionar timestamp para controle de versão
        dadosParaSincronizar.ultimaSincronizacao = new Date().toISOString();

        // Implementar lógica de sincronização
        return this.sincronizarComNuvem(dadosParaSincronizar);
    }

    configurarEventosPerfil() {
        const formPerfil = document.getElementById('form-perfil');
        const moedaSelect = document.getElementById('perfil-moeda');
        const temaSelect = document.getElementById('perfil-tema');

        if (formPerfil) {
            formPerfil.addEventListener('submit', (e) => {
                e.preventDefault();
                const dados = {
                    nome: document.getElementById('perfil-nome').value,
                    email: document.getElementById('perfil-email').value,
                    moeda: moedaSelect.value
                };
                this.salvarPerfil(dados);
                this.mostrarNotificacao('Perfil atualizado com sucesso!', 'sucesso');
            });
        }

        if (moedaSelect) {
            moedaSelect.value = this.perfil.moeda;
            moedaSelect.addEventListener('change', () => {
                this.salvarPerfil({ moeda: moedaSelect.value });
                this.atualizarDashboard();
            });
        }

        if (temaSelect) {
            temaSelect.value = this.tema;
            temaSelect.addEventListener('change', () => {
                this.alternarTema();
            });
        }
    }

    atualizarUltimasTransacoes() {
        const tbody = document.getElementById('ultimas-transacoes');
        if (!tbody) return;

        // Pegar as 5 últimas transações
        const ultimasTransacoes = [...this.transacoes]
            .sort((a, b) => new Date(b.data) - new Date(a.data))
            .slice(0, 5);

        tbody.innerHTML = ultimasTransacoes.map(t => `
            <tr>
                <td>${new Date(t.data).toLocaleDateString()}</td>
                <td>${t.descricao}</td>
                <td>${t.categoria}</td>
                <td class="${t.tipo === 'receita' ? 'positivo' : 'negativo'}">
                    ${this.formatarMoeda(t.valor)}
                </td>
            </tr>
        `).join('');
    }
}

const controle = new ControleFinanceiro();
