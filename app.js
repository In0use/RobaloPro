const PRAIAS = {
    'esp': { nome: 'Praia de Espinho', lat: 41.0072, lon: -8.6410 },
    'sil': { nome: 'Praia de Silvalde', lat: 40.9912, lon: -8.6480 },
    'par': { nome: 'Praia de Paramos', lat: 40.9750, lon: -8.6520 },
    'esm': { nome: 'Praia de Esmoriz', lat: 40.9610, lon: -8.6560 },
    'cor': { nome: 'Praia de Cortegaça', lat: 40.9410, lon: -8.6580 },
    'fur': { nome: 'Praia do Furadouro', lat: 40.8750, lon: -8.6730 }
};

let praiaAtual = 'esp';
let dadosPorDia = {};
let miniCharts = {};
let modalChartInstance = null;

function selecionarPraia(id, btn) {
    document.querySelectorAll('.beach-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    praiaAtual = id;
    carregarDados();
}

function getDirecaoTexto(graus) {
    if (graus === null || graus === undefined || isNaN(graus)) return "W";
    const direcoes = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return direcoes[Math.round(graus / 45) % 8];
}

function getFaseLua(date) {
    let year = date.getFullYear(), month = date.getMonth() + 1, day = date.getDate();
    if (month < 3) { year--; month += 12; }
    month++;
    let jd = (365.25 * year) + (30.6 * month) + day - 694039.09;
    let b = Math.round((jd / 29.5305882 - Math.floor(jd / 29.5305882)) * 8);
    if (b >= 8) b = 0;
    const fases = [
        { nome: "Lua Nova", icon: "🌑" }, { nome: "Crescente", icon: "🌒" },
        { nome: "Quarto Crescente", icon: "🌓" }, { nome: "Crescente", icon: "🌔" },
        { nome: "Lua Cheia", icon: "🌕" }, { nome: "Minguante", icon: "🌖" },
        { nome: "Quarto Minguante", icon: "🌗" }, { nome: "Minguante", icon: "🌘" }
    ];
    return fases[b];
}

function gerarCurvaMares(dataDia, janelaInicioIdx) {
    const niveisMares = [], iconsPeixe = [];
    const offset = (dataDia.getDate() * 1.5) % 6;
    for (let h = 0; h < 24; h++) {
        let altura = 2.2 + 1.4 * Math.sin(((h + offset) / 12.4) * 2 * Math.PI);
        niveisMares.push(Number(altura.toFixed(2)));
        iconsPeixe.push((h >= janelaInicioIdx && h <= janelaInicioIdx + 3) ? '🐟' : null);
    }
    return { niveisMares, iconsPeixe };
}

function calcularJanelaHorarios(diaData) {
    let melhorInicio = 6, maxScore = -1;
    for (let i = 0; i < diaData.scores.length - 3; i++) {
        let soma = diaData.scores[i] + diaData.scores[i+1] + diaData.scores[i+2] + diaData.scores[i+3];
        if (soma > maxScore) { maxScore = soma; melhorInicio = i; }
    }
    const hInicio = diaData.horasRaw[melhorInicio] ? diaData.horasRaw[melhorInicio].toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : "06:00";
    const idxFim = Math.min(melhorInicio + 4, diaData.horasRaw.length - 1);
    const hFim = diaData.horasRaw[idxFim] ? diaData.horasRaw[idxFim].toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : "10:00";
    return { inicioStr: hInicio, fimStr: hFim, duracao: Math.min(4, diaData.horasRaw.length - melhorInicio), idxInicio: melhorInicio };
}

async function carregarDados() {
    const config = PRAIAS[praiaAtual];
    const container = document.getElementById('cardsContainer');
    document.getElementById('sectionLabel').innerText = `Jornadas em ${config.nome}`;

    try {
        const urlMarine = `https://marine-api.open-meteo.com/v1/marine?latitude=${config.lat}&longitude=${config.lon}&hourly=wave_height,wave_period,wave_direction&timezone=Europe%2FLisbon`;
        const urlWeather = `https://api.open-meteo.com/v1/forecast?latitude=${config.lat}&longitude=${config.lon}&hourly=surface_pressure,wind_speed_10m,wind_direction_10m&timezone=Europe%2FLisbon`;
        
        const [respM, respW] = await Promise.all([fetch(urlMarine), fetch(urlWeather)]);
        const dataM = await respM.json(), dataW = await respW.json();

        dadosPorDia = {};
        const horas = dataM.hourly.time;

        for (let i = 0; i < horas.length; i++) {
            const d = new Date(horas[i]);
            const chave = d.toISOString().split('T')[0];
            if (!dadosPorDia[chave]) {
                dadosPorDia[chave] = { data: d, horasRaw: [], horasStr: [], vagas: [], periodos: [], dirVagas: [], pressoes: [], ventos: [], dirVentos: [], scores: [], lua: getFaseLua(d) };
            }
            const vaga = dataM.hourly.wave_height[i] ?? 1.2;
            const periodo = dataM.hourly.wave_period[i] ?? 9;
            const dirVaga = dataM.hourly.wave_direction[i] ?? 290;
            const pressao = Math.round(dataW.hourly.surface_pressure[i] ?? 1013);
            const vento = Math.round(dataW.hourly.wind_speed_10m[i] ?? 10);
            const dirVento = dataW.hourly.wind_direction_10m[i] ?? 90;

            let s = 0;
            if (vaga >= 1.2 && vaga <= 2.2) s += 35; else if (vaga >= 0.9) s += 20;
            if (periodo >= 9 && periodo <= 13) s += 25; else if (periodo >= 7) s += 15;
            if (dirVaga >= 270 && dirVaga <= 325) s += 15;
            if (vento <= 20) s += 20;
            if (pressao >= 1005 && pressao <= 1016) s += 15;

            dadosPorDia[chave].horasRaw.push(d);
            dadosPorDia[chave].horasStr.push(d.getHours() + 'h');
            dadosPorDia[chave].vagas.push(vaga);
            dadosPorDia[chave].periodos.push(periodo);
            dadosPorDia[chave].dirVagas.push(dirVaga);
            dadosPorDia[chave].pressoes.push(pressao);
            dadosPorDia[chave].ventos.push(vento);
            dadosPorDia[chave].dirVentos.push(dirVento);
            dadosPorDia[chave].scores.push(s);
        }
        renderizarCardsDias();
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div style="text-align:center; color:#f87171; padding:30px;">Erro ao carregar dados.<br><button onclick="carregarDados()">Tentar de novo</button></div>`;
    }
}

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
        const janela = calcularJanelaHorarios(diaData);
        const dirVagaTxt = getDirecaoTexto(diaData.dirVagas[janela.idxInicio]);
        const diaNomeStr = diaData.data.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: '2-digit' });

        container.innerHTML += `
            <div class="day-card" onclick="abrirPopUpCompleto('${chave}')">
                <div class="day-header">
                    <div>
                        <div class="day-title">${diaNomeStr}</div>
                        <div class="day-sub">${diaData.lua.icon} ${diaData.lua.nome} • Vaga: ${avgVaga}m (${dirVagaTxt}) • ${avgPressao} hPa</div>
                    </div>
                    <div class="score-badge ${(avgVaga < 1.0 || avgVaga > 2.4) ? 'medium' : ''}">
                        ${(avgVaga < 1.0 || avgVaga > 2.4) ? '👍 Razoável' : '⭐ Troféu Top'}
                    </div>
                </div>
                <div class="jornada-box">
                    <div>
                        <div class="jornada-label">Melhor Janela (Atividade 🐟)</div>
                        <div class="jornada-time">${janela.inicioStr} ➔ ${janela.fimStr}</div>
                    </div>
                    <div style="font-size:0.75rem; font-weight:700; color:var(--accent-blue);">${janela.duracao}h de Pesca</div>
                </div>
                <div class="mini-chart-container"><canvas id="miniChart_${index}"></canvas></div>
                <div class="click-full-hint">Toca para abrir a tábua de marés & tática ➔</div>
            </div>`;
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
                    datasets: [{ label: 'Maré (m)', data: niveisMares, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.15)', fill: true, tension: 0.4, pointRadius: ctx => iconsPeixe[ctx.dataIndex] ? 8 : 0, pointBackgroundColor: '#10b981' }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#64748b', font: { size: 9 } } }, y: { min: 0.5, max: 4.0, ticks: { color: '#38bdf8', font: { size: 9 } } } } }
            });
        });
    }, 50);
}

function abrirPopUpCompleto(chaveDia) {
    const diaData = dadosPorDia[chaveDia];
    const config = PRAIAS[praiaAtual];
    const diaNomeStr = diaData.data.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const avgPressao = Math.round(diaData.pressoes.reduce((a,b)=>a+b,0)/diaData.pressoes.length);
    const avgVaga = (diaData.vagas.reduce((a,b)=>a+b,0)/diaData.vagas.length);
    const avgPeriodo = (diaData.periodos.reduce((a,b)=>a+b,0)/diaData.periodos.length);
    const janela = calcularJanelaHorarios(diaData);
    const { niveisMares, iconsPeixe } = gerarCurvaMares(diaData.data, janela.idxInicio);

    document.getElementById('modalTitle').innerText = config.nome;
    document.getElementById('modalSub').innerText = `${diaNomeStr} • ${diaData.lua.icon} ${diaData.lua.nome} • ${avgPressao} hPa`;

    const ctxModal = document.getElementById('modalChart').getContext('2d');
    if (modalChartInstance) modalChartInstance.destroy();
    modalChartInstance = new Chart(ctxModal, {
        type: 'line',
        data: {
            labels: diaData.horasStr,
            datasets: [
                { label: 'Maré (m)', data: niveisMares, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.2)', fill: true, tension: 0.4, yAxisID: 'y' },
                { label: 'Onda (m)', data: diaData.vagas, borderColor: '#f59e0b', borderDash: [3,3], tension: 0.4, yAxisID: 'y1', pointRadius: 0 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#38bdf8' } }, y1: { position: 'right', ticks: { color: '#f59e0b' }, grid: { display: false } } } }
    });

    let linhasTabela = "";
    for (let i = 0; i < diaData.horasStr.length; i += 2) {
        linhasTabela += `<tr><td><strong>${diaData.horasStr[i]}</strong>${iconsPeixe[i] ? ' 🐟' : ''}</td><td>${niveisMares[i]}m</td><td>${diaData.vagas[i]}m (${getDirecaoTexto(diaData.dirVagas[i])})</td><td>${diaData.ventos[i]}km/h</td><td>${diaData.pressoes[i]} hPa</td></tr>`;
    }

    // Tática de Lançamento e Iscagem Avançada
    let ondeAtirar = "";
    let iscoRecomendado = "";
    let estralhoRecomendado = "";
    let estrategiaRobalo = "";

    if (avgVaga >= 1.4) {
        ondeAtirar = "🎯 <strong>Onde Atirar:</strong> Lança para o <strong>fundo da calha principal (buraco das águas brancas)</strong>. Procura a zona onde a vaga parte e deixa o chumbo assentado na vala.";
        iscoRecomendado = "🦀 Caranguejo Mouro / Pilado, Filete de Sardinha com elástico ou Tiras Grossas de Choco";
        estralhoRecomendado = "0.28mm - 0.32mm Fluorocarbono (Chumbo Garra/Pirâmide 150g-180g)";
        estrategiaRobalo = "<strong>Tática para Robalo Grande:</strong> O mar mexido escava o fundo da areia. Mantém a linha tensa e usa um espetão alto para passar a primeira rebentação.";
    } else if (avgVaga >= 1.0) {
        ondeAtirar = "🎯 <strong>Onde Atirar:</strong> Lança no <strong>corredor de saída da espuma (no declive onde a vaga morre)</strong>. Os robalos patrulham a transição entre o fundo fundo e a rebentação raso.";
        iscoRecomendado = "🐟 Sardinha fresca atada com elástico ou Caranguejo de casca mole";
        estralhoRecomendado = "0.25mm - 0.28mm Fluorocarbono (Chumbo URFE / Pirâmide 140g-160g)";
        estrategiaRobalo = "<strong>Tática Equilibrada:</strong> Condição perfeita. Alterna entre iscagens de sardinha (para libertar óleo) e caranguejo vivo.";
    } else {
        ondeAtirar = "🎯 <strong>Onde Atirar:</strong> Lança <strong>o mais longe possível para além dos pontões/poços profundos</strong>. Com mar manso o peixe afasta-se da margem.";
        iscoRecomendado = "🪱 Tiagem ativa, Biqueirão fresco ou Tiras finas de Lula fresca";
        estralhoRecomendado = "0.20mm - 0.22mm Fluorocarbono ultra-longo (2 metros)";
        estrategiaRobalo = "<strong>Tática em Água Limpa:</strong> Mar calmo exige discrição total. Usa baixadas compridas e anzois mais pequenos (ex: Aberdeen nº 1 ou 2).";
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${config.lat},${config.lon}`;
    const wazeUrl = `https://waze.com/ul?ll=${config.lat},${config.lon}&navigate=yes`;

    document.getElementById('modalContent').innerHTML = `
        <div class="tactic-section" style="border-left:4px solid var(--accent-blue);">
            <div class="tactic-title">⏰ Horário de Pesca & Atividade 🐟</div>
            <p class="tactic-desc"><strong>Janela Ideal:</strong> ${janela.inicioStr} às ${janela.fimStr}</p>
        </div>
        <div class="tactic-section" style="border-left:4px solid var(--accent-green);">
            <div class="tactic-title">📍 Zona de Lançamento (Estratégia)</div>
            <p class="tactic-desc">${ondeAtirar}</p>
        </div>
        <div class="tactic-section">
            <div class="tactic-title">🪱 Isco & Terminal Recomendado</div>
            <p class="tactic-desc"><strong>Iscos:</strong> ${iscoRecomendado}<br><strong>Montagem:</strong> ${estralhoRecomendado}</p>
        </div>
        <div class="tactic-section">
            <div class="tactic-title">🐟 Tática para Troféus</div>
            <p class="tactic-desc">${estrategiaRobalo}</p>
        </div>
        <div class="tactic-section">
            <div class="tactic-title">📊 Previsão Detalhada</div>
            <table class="hourly-table">
                <thead><tr><th>Hora</th><th>Maré</th><th>Onda</th><th>Vento</th><th>Pressão</th></tr></thead>
                <tbody>${linhasTabela}</tbody>
            </table>
        </div>
        <div class="gps-grid">
            <a href="${mapsUrl}" target="_blank" class="gps-btn btn-maps">📍 Google Maps</a>
            <a href="${wazeUrl}" target="_blank" class="gps-btn btn-waze">🚗 Waze GPS</a>
        </div>`;

    document.getElementById('modalOverlay').classList.add('active');
}

function fecharModal(e) {
    if (!e || e.target.id === 'modalOverlay' || e.target.classList.contains('close-btn')) {
        document.getElementById('modalOverlay').classList.remove('active');
    }
}

carregarDados();
