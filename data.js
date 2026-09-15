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
    const idx = Math.round(graus / 45) % 8;
    return direcoes[idx];
}

function getFaseLua(date) {
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    if (month < 3) { year--; month += 12; }
    month++;
    let c = 365.25 * year;
    let e = 30.6 * month;
    let jd = c + e + day - 694039.09;
    jd /= 29.5305882;
    let b = parseInt(jd);
    jd -= b;
    let b2 = Math.round(jd * 8);
    if (b2 >= 8) b2 = 0;

    switch (b2) {
        case 0: return { nome: "Lua Nova", icon: "🌑" };
        case 1: return { nome: "Crescente", icon: "🌒" };
        case 2: return { nome: "Quarto Crescente", icon: "🌓" };
        case 3: return { nome: "Crescente", icon: "🌔" };
        case 4: return { nome: "Lua Cheia", icon: "🌕" };
        case 5: return { nome: "Minguante", icon: "🌖" };
        case 6: return { nome: "Quarto Minguante", icon: "🌗" };
        case 7: return { nome: "Minguante", icon: "🌘" };
    }
}

function gerarCurvaMares(dataDia, janelaInicioIdx) {
    const niveisMares = [];
    const iconsPeixe = [];
    const offset = (dataDia.getDate() * 1.5) % 6;

    for (let h = 0; h < 24; h++) {
        let altura = 2.2 + 1.4 * Math.sin(((h + offset) / 12.4) * 2 * Math.PI);
        niveisMares.push(Number(altura.toFixed(2)));

        if (h >= janelaInicioIdx && h <= janelaInicioIdx + 3) {
            iconsPeixe.push('🐟');
        } else {
            iconsPeixe.push(null);
        }
    }
    return { niveisMares, iconsPeixe };
}

function calcularJanelaHorarios(diaData) {
    let melhorInicio = 6;
    let melhorFim = 10;
    let maxScore = -1;

    for (let i = 0; i < diaData.scores.length - 3; i++) {
        let soma = diaData.scores[i] + diaData.scores[i+1] + diaData.scores[i+2] + diaData.scores[i+3];
        if (soma > maxScore) {
            maxScore = soma;
            melhorInicio = i;
            melhorFim = i + 4;
        }
    }

    const hInicio = diaData.horasRaw[melhorInicio] ? diaData.horasRaw[melhorInicio].toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : "06:00";
    const idxFim = melhorFim ? Math.min(melhorFim, diaData.horasRaw.length-1) : melhorInicio+4;
    const hFim = diaData.horasRaw[idxFim] ? diaData.horasRaw[idxFim].toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : "10:00";
    const duracao = Math.min(4, diaData.horasRaw.length - melhorInicio);

    return { inicioStr: hInicio, fimStr: hFim, duracao: duracao, idxInicio: melhorInicio };
}

async function carregarDados() {
    const config = PRAIAS[praiaAtual];
    const container = document.getElementById('cardsContainer');
    document.getElementById('sectionLabel').innerText = `Jornadas em ${config.nome}`;

    try {
        const urlMarine = `https://marine-api.open-meteo.com/v1/marine?latitude=${config.lat}&longitude=${config.lon}&hourly=wave_height,wave_period,wave_direction&timezone=Europe%2FLisbon`;
        const urlWeather = `https://api.open-meteo.com/v1/forecast?latitude=${config.lat}&longitude=${config.lon}&hourly=surface_pressure,wind_speed_10m,wind_direction_10m&timezone=Europe%2FLisbon`;
        
        const [respMarine, respWeather] = await Promise.all([
            fetch(urlMarine),
            fetch(urlWeather)
        ]);

        const dataMarine = await respMarine.json();
        const dataWeather = await respWeather.json();

        if (!dataMarine.hourly || !dataWeather.hourly) {
            throw new Error("Dados meteorológicos indisponíveis.");
        }

        const horas = dataMarine.hourly.time;
        const vagas = dataMarine.hourly.wave_height;
        const periodos = dataMarine.hourly.wave_period;
        const dirVagas = dataMarine.hourly.wave_direction;
        const pressoes = dataWeather.hourly.surface_pressure;
        const ventos = dataWeather.hourly.wind_speed_10m;
        const dirVentos = dataWeather.hourly.wind_direction_10m;

        dadosPorDia = {};

        for (let i = 0; i < horas.length; i++) {
            const d = new Date(horas[i]);
            const chaveDia = d.toISOString().split('T')[0];

            if (!dadosPorDia[chaveDia]) {
                dadosPorDia[chaveDia] = {
                    data: d,
                    horasRaw: [],
                    horasStr: [],
                    vagas: [],
                    periodos: [],
                    dirVagas: [],
                    pressoes: [],
                    ventos: [],
                    dirVentos: [],
                    scores: [],
                    lua: getFaseLua(d)
                };
            }

            const vaga = (vagas && vagas[i] !== null && !isNaN(vagas[i])) ? vagas[i] : 1.2;
            const periodo = (periodos && periodos[i] !== null && !isNaN(periodos[i])) ? periodos[i] : 9;
            const dirVaga = (dirVagas && dirVagas[i] !== null && !isNaN(dirVagas[i])) ? dirVagas[i] : 290;
            const pressao = Math.round((pressoes && pressoes[i] !== null && !isNaN(pressoes[i])) ? pressoes[i] : 1013);
            const vento = Math.round((ventos && ventos[i] !== null && !isNaN(ventos[i])) ? ventos[i] : 10);
            const dirVento = (dirVentos && dirVentos[i] !== null && !isNaN(dirVentos[i])) ? dirVentos[i] : 90;

            let s = 0;
            if (vaga >= 1.2 && vaga <= 2.2) s += 35;
            else if (vaga >= 0.9 && vaga < 1.2) s += 20;

            if (periodo >= 9 && periodo <= 13) s += 25;
            else if (periodo >= 7 && periodo < 9) s += 15;

            if (dirVaga >= 270 && dirVaga <= 325) s += 15;

            if (vento <= 20) {
                s += 10;
                if (dirVento >= 45 && dirVento <= 135) s += 10;
            }

            if (pressao >= 1005 && pressao <= 1016) s += 15;

            dadosPorDia[chaveDia].horasRaw.push(d);
            dadosPorDia[chaveDia].horasStr.push(d.getHours() + 'h');
            dadosPorDia[chaveDia].vagas.push(vaga);
            dadosPorDia[chaveDia].periodos.push(periodo);
            dadosPorDia[chaveDia].dirVagas.push(dirVaga);
            dadosPorDia[chaveDia].pressoes.push(pressao);
            dadosPorDia[chaveDia].ventos.push(vento);
            dadosPorDia[chaveDia].dirVentos.push(dirVento);
            dadosPorDia[chaveDia].scores.push(s);
        }

        renderizarCardsDias();
    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div style="text-align:center; color: #f87171; padding: 30px 15px; background: rgba(239, 68, 68, 0.1); border-radius: 20px; border: 1px solid rgba(239, 68, 68, 0.2);">
                <strong>Erro ao carregar dados meteorológicos</strong><br>
                <span style="font-size: 0.8rem; color: #cbd5e1; display: inline-block; margin-top: 6px;">Verifica a ligação à Internet ou tenta novamente.</span><br><br>
                <button onclick="carregarDados()" style="background: #38bdf8; color: #000; border: none; padding: 8px 16px; border-radius: 12px; font-weight: bold; cursor: pointer;">Recarregar</button>
            </div>
        `;
    }
}
    }
}
