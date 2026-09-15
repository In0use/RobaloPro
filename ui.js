function renderizarCardsDias() {
    const container = document.getElementById('cardsContainer');
    container.innerHTML = '';
    Object.keys(miniCharts).forEach(k => miniCharts[k].destroy());
    miniCharts = {};

    const chaves = Object.keys(dadosPorDia).slice(0, 7);

    chaves.forEach((chave, index) => {
        const diaData = dadosPorDia[chave];
        const avgVaga = (diaData.vagas.reduce((a,b)=>a+b,0)/diaData.vagas.length).toFixed(1);
        const avgPressao = Math.round(diaData.pressoes.reduce((a,b)=>a+b,0)/diaData.pressoes.length);
        const lua = diaData.lua;
        const janela = calcularJanelaHorarios(diaData);
        const dirVagaTxt = getDirecaoTexto(diaData.dirVagas[janela.idxInicio]);

        let avaliacao = "⭐ Troféu Top";
        let classeBadge = "";
        if (avgVaga < 1.0 || avgVaga > 2.4) {
            avaliacao = "👍 Razoável";
            classeBadge = "medium";
        }

        const diaNomeStr = diaData.data.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: '2-digit' });
        const chartId = `miniChart_${index}`;

        const cardHTML = `
            <div class="day-card" onclick="abrirPopUpCompleto('${chave}')">
                <div class="day-header">
                    <div>
                        <div class="day-title">${diaNomeStr}</div>
                        <div class="day-sub">${lua.icon} ${lua.nome} • Vaga: ${avgVaga}m (${dirVagaTxt}) • Pressão: ${avgPressao} hPa</div>
                    </div>
                    <div class="score-badge ${classeBadge}">${avaliacao}</div>
                </div>

                <div class="jornada-box">
                    <div>
                        <div class="jornada-label">Melhor Janela (Atividade 🐟)</div>
                        <div class="jornada-time">${janela.inicioStr} ➔ ${janela.fimStr}</div>
                    </div>
                    <div style="font-size: 0.75rem; font-weight: 700; color: var(--accent-blue);">
                        ${janela.duracao}h de Pesca
                    </div>
                </div>

                <div class="mini-chart-container">
                    <canvas id="${chartId}"></canvas>
                </div>

                <div class="click-full-hint">Toca para abrir a tábua de marés & tática ➔</div>
            </div>
        `;
        container.innerHTML += cardHTML;
    });

    setTimeout(() => {
        chaves.forEach((chave, index) => {
            const diaData = dadosPorDia[chave];
            const janela = calcularJanelaHorarios(diaData);
            const { niveisMares, iconsPeixe } = gerarCurvaMares(diaData.data, janela.idxInicio);
            const ctx = document.getElementById(`miniChart_${index}`).getContext('2d');
            
            miniCharts[chave] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: diaData.horasStr,
                    datasets: [
                        {
                            label: 'Maré (m)',
                            data: niveisMares,
                            borderColor: '#38bdf8',
                            backgroundColor: 'rgba(56, 189, 248, 0.15)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: (ctx) => iconsPeixe[ctx.dataIndex] ? 8 : 0,
                            pointBackgroundColor: '#10b981'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { display: false } },
                        y: { 
                            ticks: { color: '#38bdf8', font: { size: 9 }, callback: (value) => value + 'm' }, 
                            grid: { color: 'rgba(255,255,255,0.02)' },
                            min: 0.5,
                            max: 4.0
                        }
                    }
                }
            });
        });
    }, 50);
}

function abrirPopUpCompleto(chaveDia) {
    const diaData = dadosPorDia[chaveDia];
    const config = PRAIAS[praiaAtual];
    const diaNomeStr = diaData.data.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const avgPressao = Math.round(diaData.pressoes.reduce((a,b)=>a+b,0)/diaData.pressoes.length);
    const janela = calcularJanelaHorarios(diaData);
    const { niveisMares, iconsPeixe } = gerarCurvaMares(diaData.data, janela.idxInicio);

    document.getElementById('modalTitle').innerText = `${config.nome}`;
    document.getElementById('modalSub').innerText = `${diaNomeStr} • ${diaData.lua.icon} ${diaData.lua.nome} • Pressão Média: ${avgPressao} hPa`;

    const ctxModal = document.getElementById('modalChart').getContext('2d');
    if (modalChartInstance) modalChartInstance.destroy();

    modalChartInstance = new Chart(ctxModal, {
        type: 'line',
        data: {
            labels: diaData.horasStr,
            datasets: [
                {
                    label: 'Tábua de Maré (m)',
                    data: niveisMares,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y',
                    pointRadius: (ctx) => iconsPeixe[ctx.dataIndex] ? 10 : 2,
                    pointBackgroundColor: (ctx) => iconsPeixe[ctx.dataIndex] ? '#10b981' : '#38bdf8'
                },
                {
                    label: 'Onda (m)',
                    data: diaData.vagas,
                    borderColor: '#f59e0b',
                    borderDash: [3, 3],
                    tension: 0.4,
                    yAxisID: 'y1',
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 10 } } } },
            scales: {
                x: { ticks: { color: '#94a3b8', font: { size: 9 } } },
                y: { type: 'linear', position: 'left', ticks: { color: '#38bdf8' }, title: { display: true, text: 'Maré (m)', color: '#38bdf8' } },
                y1: { type: 'linear', position: 'right', ticks: { color: '#f59e0b' }, grid: { display: false }, title: { display: true, text: 'Onda (m)', color: '#f59e0b' } }
            }
        }
    });

    let linhasTabela = "";
    for (let i = 0; i < diaData.horasStr.length; i += 2) {
        const dVaga = getDirecaoTexto(diaData.dirVagas[i]);
        const dVento = getDirecaoTexto(diaData.dirVentos[i]);
        const peixeTag = iconsPeixe[i] ? ' 🐟' : '';
        linhasTabela += `
            <tr>
                <td><strong>${diaData.horasStr[i]}</strong>${peixeTag}</td>
                <td>${niveisMares[i]}m</td>
                <td>${diaData.vagas[i]}m (${dVaga})</td>
                <td>${diaData.ventos[i]}km/h (${dVento})</td>
                <td>${diaData.pressoes[i]} hPa</td>
            </tr>
        `;
    }

    const avgVaga = diaData.vagas.reduce((a,b)=>a+b,0)/diaData.vagas.length;
    const avgPeriodo = diaData.periodos.reduce((a,b)=>a+b,0)/diaData.periodos.length;
    const dirVagaInicio = getDirecaoTexto(diaData.dirVagas[janela.idxInicio]);
    const dirVentoInicio = getDirecaoTexto(diaData.dirVentos[janela.idxInicio]);

    const indiceCalha = (avgVaga * avgPeriodo).toFixed(1);
    let estadoMarInfo = "";
    let iscoRecomendado = "";
    let estralhoRecomendado = "";

    if (indiceCalha > 16) {
        estadoMarInfo = "🌊 <strong>Calha Funda com Água Branca:</strong> Mar forte e com muita energia. Excelente abertura de buracos na areia.";
        iscoRecomendado = "🦀 Caranguejo Mouro / Pilado ou 🦑 Tiras Espessas de Choco";
        estralhoRecomendado = "0.28mm a 0.32mm Fluorocarbono (Chumbo de Garra 160g-180g)";
    } else if (indiceCalha >= 10) {
        estadoMarInfo = "🌊 <strong>Calha Equilibrada:</strong> Condição perfeita de rebentação sem arrasto excessivo de chumbo.";
        iscoRecomendado = "🐟 Sardinha com elástico ou 🦀 Caranguejo de casca mole";
        estralhoRecomendado = "0.25mm a 0.28mm Fluorocarbono (Chumbo Pirâmide/URFE 140g-160g)";
    } else {
        estadoMarInfo = "☀️ <strong>Água Limpa / Mar Manso:</strong> Pouca rebentação. Exige montagens mais finas e discretas.";
        iscoRecomendado = "🪱 Tiagem ativa, Biqueirão fresco ou Tiras finas de Lula";
        estralhoRecomendado = "0.20mm a 0.22mm Fluorocarbono longo (2 metros)";
    }

    let estrategiaRobalo = "";
    let estrategiaBaila = "";

    if (avgVaga >= 1.2 && avgVaga <= 2.2) {
        estrategiaRobalo = "<strong>Robalo Grande:</strong> Vaga de " + dirVagaInicio + " com vento de " + dirVentoInicio + " (" + avgPressao + " hPa). Lança para a calha fundeira. Iscagens ideais: <strong>caranguejo (pilado/mouro), sardinha atada com elástico ou tiras grossas de choco fresco</strong> com estralho 0.28-0.30mm.";
        estrategiaBaila = "<strong>Bailas Grandes:</strong> Pesca no limite da rebentação com <strong>tiagem bem firme ou biqueirão fresco</strong> em estralho a flutuar ligeiramente.";
    } else if (avgVaga < 1.2) {
        estrategiaRobalo = "<strong>Robalo em Água Limpa:</strong> Mar calmo. Pesca noturna perto de pontões com <strong>tiagem, biqueirão fresco ou lula em tiras finas</strong>. Usa estralho longo (2m) em fluorocarbono 0.22mm.";
        estrategiaBaila = "<strong>Bailas em Água Calma:</strong> Lançamentos curtos com <strong>tiagem ativa ou biqueirão</strong> em montagens mais leves.";
    } else {
        estrategiaRobalo = "<strong>Robalo de Tempestade:</strong> Mar forte (" + avgPressao + " hPa). Usa chumbo de garra (160g-180g) e iscagens ultra-resistentes: <strong>choco espesso ou filetes grossos de sardinha bem iscados com elástico</strong>.";
        estrategiaBaila = "<strong>Bailas em Mar Agitado:</strong> Procura poços fundos atrás da rebentação com tiras resistentes de choco ou tiagem reforçada.";
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${config.lat},${config.lon}`;
    const wazeUrl = `https://waze.com/ul?ll=${config.lat},${config.lon}&navigate=yes`;
    
    const msgTelegram = encodeURIComponent(`🎣 *RobaloPro Alert - ${config.nome}*\n📅 ${diaNomeStr}\n⏰ *Melhor Janela:* ${janela.inicioStr} ➔ ${janela.fimStr}\n🌊 *Mar:* ${avgVaga.toFixed(1)}m | *Pressão:* ${avgPressao} hPa\n📌 ${estadoMarInfo.replace(/<[^>]*>?/gm, '')}`);
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${msgTelegram}`;

    const htmlContent = `
        <div class="tactic-section" style="border-left: 4px solid var(--accent-blue);">
            <div class="tactic-title">⏰ Horário de Pesca & Atividade 🐟</div>
            <p class="tactic-desc"><strong>Chegada:</strong> ${janela.inicioStr}<br><strong>Saída:</strong> ${janela.fimStr}<br><em>(Janela de ${janela.duracao} horas ideais assinaladas com 🐟 no gráfico)</em></p>
        </div>

        <div class="tactic-section" style="border-left: 4px solid var(--accent-green);">
            <div class="tactic-title">🌀 Análise da Calha & Rebentação</div>
            <p class="tactic-desc">${estadoMarInfo}</p>
        </div>

        <div class="tactic-section">
            <div class="tactic-title">🪱 Isco & Montagem Prioritária para Hoje</div>
            <div class="bait-grid">
                <div class="bait-card">
                    <strong>Iscagem Recomendada:</strong>
                    ${iscoRecomendado}
                </div>
                <div class="bait-card">
                    <strong>Terminal & Chumbo:</strong>
                    ${estralhoRecomendado}
                </div>
            </div>
        </div>

        <div class="tactic-section">
            <div class="tactic-title">🐟 Como Apanhar Robalos Troféu</div>
            <p class="tactic-desc">${estrategiaRobalo}</p>
        </div>

        <div class="tactic-section">
            <div class="tactic-title">⚡ Como Apanhar Bailas Grandes</div>
            <p class="tactic-desc">${estrategiaBaila}</p>
        </div>

        <div class="tactic-section">
            <div class="tactic-title">📊 Previsão Técnica Detalhada</div>
            <table class="hourly-table">
                <thead>
                    <tr>
                        <th>Hora</th>
                        <th>Maré</th>
                        <th>Onda</th>
                        <th>Vento</th>
                        <th>Pressão</th>
                    </tr>
                </thead>
                <tbody>${linhasTabela}</tbody>
            </table>
        </div>

        <div class="gps-grid">
            <a href="${mapsUrl}" target="_blank" class="gps-btn btn-maps">📍 Google Maps</a>
            <a href="${wazeUrl}" target="_blank" class="gps-btn btn-waze">🚗 Waze GPS</a>
            <a href="${telegramUrl}" target="_blank" class="gps-btn btn-telegram">✈️ Partilhar no Telegram</a>
        </div>
    `;

    document.getElementById('modalContent').innerHTML = htmlContent;
    document.getElementById('modalOverlay').classList.add('active');
}

function fecharModal(e) {
    if (!e || e.target.id === 'modalOverlay' || e.target.classList.contains('close-btn')) {
        document.getElementById('modalOverlay').classList.remove('active');
    }
}

carregarDados();

carregarDados();
