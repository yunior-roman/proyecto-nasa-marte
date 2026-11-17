const form = document.querySelector('#chat-form');
const input = document.querySelector('#message-input');
const conversation = document.querySelector('#conversation');
const sendButton = form.querySelector('.send-button');
const assistantPanel = document.querySelector('#assistant-panel');
const assistantToggle = document.querySelector('#assistant-toggle');
const searchForm = document.querySelector('#guide-search');
const searchInput = document.querySelector('#search-input');
const guideCards = [...document.querySelectorAll('.guide-card')];
const history = [];
const maxHistoryMessages = 12;

function setAssistantOpen(open) {
    assistantPanel.hidden = !open;
    assistantToggle.setAttribute('aria-expanded', String(open));

    if (open) {
        input.focus();
    } else {
        assistantToggle.focus();
    }
}

function appendMessage(role, text, options = {}) {
    const article = document.createElement('article');
    article.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'}${options.error ? ' error-message' : ''}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = role === 'user' ? 'T' : '✳';

    const body = document.createElement('div');
    body.className = 'message-body';

    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'EXPLORADOR' : 'ASISTENTE';

    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    body.append(label, paragraph);
    article.append(avatar, body);
    conversation.append(article);
    conversation.scrollTop = conversation.scrollHeight;
    return article;
}

function setBusy(busy) {
    sendButton.disabled = busy;
    input.disabled = busy;
    form.setAttribute('aria-busy', String(busy));
}

async function sendMessage(message) {
    const cleanMessage = message.trim();
    if (!cleanMessage || sendButton.disabled) {
        return;
    }

    appendMessage('user', cleanMessage);
    input.value = '';
    input.style.height = 'auto';
    setBusy(true);

    const loadingMessage = appendMessage('assistant', '');
    const loadingText = loadingMessage.querySelector('p');
    loadingText.setAttribute('aria-label', 'El asistente está preparando una respuesta');
    loadingText.innerHTML = '<span class="typing-indicator" aria-hidden="true"><span></span><span></span><span></span></span>';

    try {
        const response = await fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: cleanMessage,
                history: history.slice(-maxHistoryMessages),
            }),
        });
        const result = await response.json();
        loadingMessage.remove();

        if (!response.ok) {
            throw new Error(result.error || 'No se pudo obtener una respuesta.');
        }

        if (typeof result.reply !== 'string' || !result.reply.trim()) {
            throw new Error('El asistente devolvió una respuesta vacía. Inténtalo de nuevo.');
        }

        history.push(
            { role: 'user', content: cleanMessage },
            { role: 'assistant', content: result.reply },
        );
        appendMessage('assistant', result.reply);
    } catch (error) {
        loadingMessage.remove();
        const messageText = error instanceof TypeError
            ? 'No se pudo conectar con el servidor. Comprueba que la aplicación Python esté iniciada y vuelve a intentarlo.'
            : error.message;
        appendMessage('assistant', messageText, { error: true });
    } finally {
        setBusy(false);
        input.focus();
    }
}

form.addEventListener('submit', (event) => {
    event.preventDefault();
    sendMessage(input.value);
});

input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 125)}px`;
});

input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

document.querySelectorAll('.suggestion').forEach((button) => {
    button.addEventListener('click', () => sendMessage(button.dataset.prompt));
});

assistantToggle.addEventListener('click', () => {
    setAssistantOpen(assistantPanel.hidden);
});

document.querySelector('.close-assistant').addEventListener('click', () => {
    setAssistantOpen(false);
});

document.querySelectorAll('[data-open-assistant]').forEach((link) => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        setAssistantOpen(true);
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !assistantPanel.hidden) {
        setAssistantOpen(false);
    }
});

function filterGuide(query) {
    const normalizedQuery = query
        .trim()
        .toLocaleLowerCase('es')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    let visibleCards = 0;

    guideCards.forEach((card) => {
        const searchableText = `${card.dataset.search} ${card.textContent}`
            .toLocaleLowerCase('es')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        card.hidden = normalizedQuery !== '' && !searchableText.includes(normalizedQuery);
        visibleCards += Number(!card.hidden);
    });

    document.querySelector('#search-empty').hidden = visibleCards !== 0;
}

searchForm.addEventListener('submit', (event) => {
    if (guideCards.length === 0) {
        return;
    }

    event.preventDefault();
    filterGuide(searchInput.value);
    document.querySelector('#guide').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

if (guideCards.length > 0) {
    searchInput.addEventListener('input', () => filterGuide(searchInput.value));
    if (searchInput.value) {
        filterGuide(searchInput.value);
    }
}

document.querySelectorAll('[data-ask-assistant]').forEach((button) => {
    button.addEventListener('click', () => {
        setAssistantOpen(true);
        input.value = button.dataset.askAssistant;
        input.dispatchEvent(new Event('input'));
        input.focus();
    });
});

document.querySelectorAll('.sidebar-link:not([data-open-assistant]):not([data-tool-link])').forEach((link) => {
    link.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-link').forEach((item) => {
            item.classList.remove('is-active');
            item.removeAttribute('aria-current');
        });
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
    });
});

if (document.querySelector('.mission-tools')) {
const missionStorageKey = 'guia-marciana-mission-data';
const preferencesStorageKey = 'guia-marciana-preferences';
const correctAnswers = ['b', 'a', 'b'];
const siteDetails = {
    curiosity: {
        title: 'Gale — Curiosity',
        text: 'Curiosity aterrizó en el cráter Gale el 6 de agosto de 2012 (UTC) y estudia la geología y la habitabilidad pasada.',
        coordinates: '4.59° S, 137.44° E',
        source: 'NASA · Mars Science Laboratory',
        url: 'https://science.nasa.gov/mission/msl-curiosity/',
    },
    perseverance: {
        title: 'Jezero — Perseverance',
        text: 'Perseverance aterrizó en el cráter Jezero el 18 de febrero de 2021 (UTC). Investiga su antiguo delta y recolecta muestras.',
        coordinates: '18.44° N, 77.45° E',
        source: 'NASA · Mars 2020',
        url: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
    },
    insight: {
        title: 'Elysium Planitia — InSight',
        text: 'InSight aterrizó en Elysium Planitia el 26 de noviembre de 2018 (UTC) para estudiar el interior y el entorno de Marte.',
        coordinates: '4.50° N, 135.62° E',
        source: 'NASA · InSight',
        url: 'https://science.nasa.gov/mission/insight/',
    },
};
let elevationData = null;
let selectedSite = 'curiosity';
const missionSimulationStorageKey = 'guia-marciana-simulation';
const missionActivityStorageKey = 'guia-marciana-activity';
const missionDashboardSites = {
    curiosity: { title: 'Cráter Gale · Curiosity', coordinates: '4.59° S, 137.44° E' },
    perseverance: { title: 'Cráter Jezero · Perseverance', coordinates: '18.44° N, 77.45° E' },
    insight: { title: 'Elysium Planitia · InSight', coordinates: '4.50° N, 135.62° E' },
};

function readStoredObject(key, fallback) {
    const serialized = localStorage.getItem(key);
    if (!serialized) {
        return fallback;
    }

    try {
        const stored = JSON.parse(serialized);
        return stored && typeof stored === 'object' ? stored : fallback;
    } catch (error) {
        console.error(`No se pudieron leer los datos guardados (${key}).`, error);
        return fallback;
    }
}

let missionData = readStoredObject(missionStorageKey, {
    favorites: [],
    checklist: {},
    bestScore: 0,
});

function saveMissionData() {
    localStorage.setItem(missionStorageKey, JSON.stringify(missionData));
    renderMissionProgress();
}

function renderMissionProgress() {
    const favoriteItems = Array.isArray(missionData.favorites) ? missionData.favorites : [];
    document.querySelectorAll('[data-favorite]').forEach((button) => {
        const isSaved = favoriteItems.includes(button.dataset.favorite);
        button.classList.toggle('is-favorite', isSaved);
        button.setAttribute('aria-pressed', String(isSaved));
        button.textContent = `${isSaved ? '★' : '☆'} ${button.dataset.favorite.startsWith('Pregunta:') ? (isSaved ? 'Pregunta guardada' : 'Guardar pregunta') : button.dataset.favorite}`;
    });

    document.querySelectorAll('[data-checklist-item]').forEach((checkbox) => {
        checkbox.checked = missionData.checklist?.[checkbox.dataset.checklistItem] === true;
    });

    const checkedItems = Object.values(missionData.checklist || {}).filter(Boolean).length;
    document.querySelector('#checklist-count').textContent = `${checkedItems} de 8 listos`;
    document.querySelector('#quiz-score').textContent = `Mejor resultado: ${missionData.bestScore || 0}/3`;

    const summary = document.querySelector('#progress-summary');
    if (favoriteItems.length === 0 && checkedItems === 0 && !missionData.hasQuizResult) {
        summary.textContent = 'Aún no hay favoritos ni resultados guardados.';
        return;
    }

    const favoritesText = favoriteItems.length
        ? `Favoritos: ${favoriteItems.join(', ')}.`
        : 'Todavía no guardaste favoritos.';
    const quizText = missionData.hasQuizResult
        ? ` Último quiz: ${missionData.lastScore}/3; mejor: ${missionData.bestScore}/3.`
        : '';
    summary.textContent = `${favoritesText} Checklist: ${checkedItems}/8 completados.${quizText}`;
}

document.querySelectorAll('[data-favorite]').forEach((button) => {
    button.addEventListener('click', () => {
        const favorite = button.dataset.favorite;
        const favorites = Array.isArray(missionData.favorites) ? missionData.favorites : [];
        missionData.favorites = favorites.includes(favorite)
            ? favorites.filter((item) => item !== favorite)
            : [...favorites, favorite];
        saveMissionData();
    });
});

document.querySelectorAll('[data-checklist-item]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
        missionData.checklist = missionData.checklist || {};
        missionData.checklist[checkbox.dataset.checklistItem] = checkbox.checked;
        saveMissionData();
    });
});

document.querySelector('#quiz-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const answers = [...document.querySelectorAll('.quiz-question')];
    const score = answers.reduce((total, question, index) => {
        const selected = question.querySelector('input:checked');
        question.classList.toggle('answer-correct', selected?.value === correctAnswers[index]);
        question.classList.toggle('answer-incorrect', selected?.value !== correctAnswers[index]);
        return total + Number(selected?.value === correctAnswers[index]);
    }, 0);

    missionData.lastScore = score;
    missionData.bestScore = Math.max(missionData.bestScore || 0, score);
    missionData.hasQuizResult = true;
    saveMissionData();
    document.querySelector('#quiz-feedback').textContent = `Obtuviste ${score} de 3. ${score === 3 ? '¡Excelente exploración!' : 'Revisa las respuestas y vuelve a intentarlo.'}`;
});

document.querySelector('#clear-progress').addEventListener('click', () => {
    localStorage.removeItem(missionStorageKey);
    missionData = { favorites: [], checklist: {}, bestScore: 0 };
    document.querySelector('#quiz-form').reset();
    document.querySelector('#quiz-feedback').textContent = '';
    document.querySelectorAll('.quiz-question').forEach((question) => {
        question.classList.remove('answer-correct', 'answer-incorrect');
    });
    saveMissionData();
});

const missionDashboardPanel = document.querySelector('#mission-dashboard');
if (missionDashboardPanel) {
    const resourceNames = ['oxygen', 'water', 'food', 'energy'];

    function renderMissionDashboard(state, activities) {
        const depleted = resourceNames.some((resource) => state[resource] <= 0);
        const lowResources = resourceNames.some((resource) => state[resource] <= 20);
        const temperatureOutOfRange = state.cabinTemperature < 16 || state.cabinTemperature > 24;
        const missionStatus = document.querySelector('#dashboard-mission-status');
        missionStatus.textContent = depleted ? 'CRÍTICA' : lowResources || temperatureOutOfRange ? 'ATENCIÓN' : 'OPERATIVA';
        missionStatus.classList.toggle('is-critical', depleted);
        missionStatus.classList.toggle('is-warning', !depleted && (lowResources || temperatureOutOfRange));
        document.querySelector('#dashboard-sol').textContent = `Sol ${state.sol} · simulación`;

        resourceNames.forEach((resource) => {
            const value = Math.max(0, Math.min(100, Math.round(Number(state[resource]) || 0)));
            document.querySelector(`#dashboard-${resource}`).value = value;
            document.querySelector(`#dashboard-${resource}-value`).textContent = `${value}%`;
            document.querySelector(`#dashboard-${resource}`).closest('.dashboard-resource').classList.toggle('is-low', value <= 20);
        });

        const site = missionDashboardSites[state.site] || missionDashboardSites.curiosity;
        document.querySelector('#dashboard-location-name').textContent = site.title;
        document.querySelector('#dashboard-coordinates').textContent = site.coordinates;
        document.querySelector('#dashboard-temperature').textContent = `${Number(state.cabinTemperature).toFixed(1)} °C`;

        const lowestResource = Math.min(...resourceNames.map((resource) => Number(state[resource]) || 0));
        const survivalIndex = Math.round(Math.max(0, Math.min(100, lowestResource * (temperatureOutOfRange ? 0.75 : 1))));
        const survivalRing = document.querySelector('#dashboard-survival-ring');
        survivalRing.style.setProperty('--survival-value', `${survivalIndex}%`);
        survivalRing.setAttribute('aria-label', `Índice educativo de supervivencia: ${survivalIndex} por ciento`);
        document.querySelector('#dashboard-survival-value').textContent = `${survivalIndex}%`;
        document.querySelector('#dashboard-survival-note').textContent = temperatureOutOfRange
            ? 'Recurso más bajo con penalización térmica educativa.'
            : 'Basado en la reserva más baja; no es una probabilidad real.';

        const activityList = document.querySelector('#dashboard-activity-list');
        const visibleActivities = activities.slice(0, 12);
        document.querySelector('#dashboard-history-count').textContent =
            `${visibleActivities.length} ${visibleActivities.length === 1 ? 'evento' : 'eventos'}`;
        if (visibleActivities.length === 0) {
            activityList.innerHTML = '<li>Inicia el simulador para registrar actividades.</li>';
            return;
        }

        activityList.replaceChildren(...visibleActivities.map((activity) => {
            const item = document.createElement('li');
            const eventTime = document.createElement('time');
            eventTime.dateTime = activity.createdAt;
            eventTime.textContent = new Intl.DateTimeFormat('es', {
                hour: '2-digit',
                minute: '2-digit',
            }).format(new Date(activity.createdAt));
            const description = document.createElement('span');
            description.textContent = `Sol ${activity.sol} · ${activity.description}`;
            item.append(eventTime, description);
            return item;
        }));
    }

    function loadMissionDashboard() {
        const storedState = readStoredObject(missionSimulationStorageKey, {});
        const storedActivity = readStoredObject(missionActivityStorageKey, { items: [] });
        const state = {
            sol: Number.isInteger(storedState.sol) && storedState.sol > 0 ? storedState.sol : 1,
            site: missionDashboardSites[storedState.site] ? storedState.site : 'curiosity',
            oxygen: storedState.oxygen,
            water: storedState.water,
            food: storedState.food,
            energy: storedState.energy,
            cabinTemperature: storedState.cabinTemperature,
        };
        const activities = Array.isArray(storedActivity.items)
            ? storedActivity.items.filter((item) =>
                item && typeof item.description === 'string' &&
                Number.isInteger(item.sol) && typeof item.createdAt === 'string' &&
                Number.isFinite(Date.parse(item.createdAt)),
            )
            : [];
        resourceNames.forEach((resource) => {
            state[resource] = Number.isFinite(Number(state[resource]))
                ? Math.max(0, Math.min(100, Number(state[resource])))
                : 100;
        });
        state.cabinTemperature = Number.isFinite(Number(state.cabinTemperature))
            ? Number(state.cabinTemperature)
            : 20;
        renderMissionDashboard(state, activities);
    }

    window.addEventListener('mars:mission-update', (event) => {
        renderMissionDashboard(event.detail.state, event.detail.activities);
    });
    window.addEventListener('storage', (event) => {
        if (event.key === missionSimulationStorageKey || event.key === missionActivityStorageKey) {
            loadMissionDashboard();
        }
    });
    loadMissionDashboard();
}

document.querySelectorAll('[data-site]').forEach((marker) => {
    marker.addEventListener('click', () => {
        const site = siteDetails[marker.dataset.site];
        selectedSite = marker.dataset.site;
        const detail = document.querySelector('#map-detail');
        detail.querySelector('h3').textContent = site.title;
        detail.querySelector('#map-site-coordinates').textContent = site.coordinates;
        detail.querySelector('p:not(.section-kicker):not(.map-site-coordinates):not(.map-source-label)').textContent = site.text;
        detail.querySelector('a').href = site.url;
        detail.querySelector('#map-source-name').textContent = site.source;
        document.querySelector('#map-coordinates').textContent = site.coordinates;
        document.querySelectorAll('[data-site]').forEach((item) => {
            item.setAttribute('aria-pressed', String(item === marker));
        });
        renderSelectedElevation();
    });
});

function formatUtcDate(value) {
    return new Intl.DateTimeFormat('es', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'UTC',
    }).format(new Date(value));
}

function renderSelectedElevation() {
    const elevationValue = document.querySelector('#elevation-value');
    if (!elevationValue || !elevationData) {
        return;
    }

    const elevation = elevationData.elevations[selectedSite];
    elevationValue.textContent = `${new Intl.NumberFormat('es').format(elevation)} m`;
}

async function loadMarsElevations() {
    const elevationValue = document.querySelector('#elevation-value');
    const elevationUpdated = document.querySelector('#elevation-updated');
    if (!elevationValue || !elevationUpdated) {
        return;
    }

    try {
        const response = await fetch('/api/mars/elevation');
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `NASA/PDS respondió con estado ${response.status}.`);
        }

        elevationData = result;
        renderSelectedElevation();
        elevationUpdated.textContent = `Producto MOLA v2.0: 3 de abril de 2003 · archivo consultado: ${formatUtcDate(result.retrieved_at)} UTC.`;
    } catch (error) {
        elevationValue.textContent = 'No disponible';
        elevationUpdated.textContent = `No se pudieron actualizar los datos MOLA: ${error.message}`;
    }
}

const marsMap = document.querySelector('#mars-map-view');
if (marsMap) {
    const mapSurface = marsMap.querySelector('.map-surface');
    let mapZoom = 1;
    const layerClassNames = {
        relief: 'layer-off-relief',
        sites: 'layer-off-sites',
        ice: 'layer-show-ice',
        grid: 'layer-show-grid',
    };

    document.querySelectorAll('[data-map-layer]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
            const layerClass = layerClassNames[checkbox.dataset.mapLayer];
            const showLayer = checkbox.dataset.mapLayer === 'ice' || checkbox.dataset.mapLayer === 'grid';
            marsMap.classList.toggle(layerClass, showLayer ? checkbox.checked : !checkbox.checked);
        });
    });

    document.querySelectorAll('[data-map-zoom]').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.mapZoom === 'in') {
                mapZoom = Math.min(2.2, mapZoom + 0.2);
            } else if (button.dataset.mapZoom === 'out') {
                mapZoom = Math.max(1, mapZoom - 0.2);
            } else {
                mapZoom = 1;
            }
            mapSurface.style.setProperty('--map-zoom', mapZoom.toFixed(2));
            document.querySelector('#map-zoom-level').textContent = `${Math.round(mapZoom * 100)}%`;
        });
    });

    if (!document.body.dataset.toolView || document.body.dataset.toolView === 'mars-map') {
        loadMarsElevations();
    }
}

const survivalPanel = document.querySelector('#survival-simulator');
if (survivalPanel) {
    const survivalSites = {
        curiosity: 'cráter Gale',
        perseverance: 'cráter Jezero',
        insight: 'Elysium Planitia',
    };
    const consumptionPlans = {
        saving: { oxygen: 7, water: 8, food: 6, energy: 12, label: 'Ahorro' },
        balanced: { oxygen: 10, water: 12, food: 8, energy: 18, label: 'Equilibrado' },
        intensive: { oxygen: 12, water: 15, food: 10, energy: 24, label: 'Alto consumo' },
    };
    const resourceNames = {
        oxygen: 'Oxígeno',
        water: 'Agua',
        food: 'Alimentos',
        energy: 'Energía',
    };
    const savedSimulation = readStoredObject(missionSimulationStorageKey, {});
    const survivalState = {
        sol: 1,
        site: 'curiosity',
        mode: 'balanced',
        targetTemperature: 20,
        cabinTemperature: 20,
        oxygen: 100,
        water: 100,
        food: 100,
        energy: 100,
    };
    if (Number.isInteger(savedSimulation.sol) && savedSimulation.sol > 0) {
        survivalState.sol = savedSimulation.sol;
    }
    if (Object.hasOwn(survivalSites, savedSimulation.site)) {
        survivalState.site = savedSimulation.site;
    }
    if (Object.hasOwn(consumptionPlans, savedSimulation.mode)) {
        survivalState.mode = savedSimulation.mode;
    }
    ['oxygen', 'water', 'food', 'energy'].forEach((resource) => {
        if (Number.isFinite(Number(savedSimulation[resource]))) {
            survivalState[resource] = Math.max(0, Math.min(100, Number(savedSimulation[resource])));
        }
    });
    ['targetTemperature', 'cabinTemperature'].forEach((temperature) => {
        if (Number.isFinite(Number(savedSimulation[temperature]))) {
            survivalState[temperature] = Number(savedSimulation[temperature]);
        }
    });
    let missionActivities = readStoredObject(missionActivityStorageKey, { items: [] }).items;
    if (!Array.isArray(missionActivities)) {
        missionActivities = [];
    }
    missionActivities = missionActivities.filter((activity) =>
        activity && typeof activity.description === 'string' &&
        Number.isInteger(activity.sol) && typeof activity.createdAt === 'string' &&
        Number.isFinite(Date.parse(activity.createdAt)),
    ).slice(0, 12);
    const siteSelect = document.querySelector('#landing-site-select');
    const modeSelect = document.querySelector('#survival-mode');
    const temperatureSlider = document.querySelector('#temperature-target');
    const temperatureOutput = document.querySelector('#temperature-target-value');
    const alertBox = document.querySelector('#survival-alert');
    const alertList = document.querySelector('#survival-alert-list');
    const status = document.querySelector('#survival-status');

    function recordMissionActivity(description) {
        missionActivities.unshift({
            sol: survivalState.sol,
            description,
            createdAt: new Date().toISOString(),
        });
        missionActivities = missionActivities.slice(0, 12);
        localStorage.setItem(missionActivityStorageKey, JSON.stringify({ items: missionActivities }));
    }

    function publishMissionState() {
        localStorage.setItem(missionSimulationStorageKey, JSON.stringify(survivalState));
        window.dispatchEvent(new CustomEvent('mars:mission-update', {
            detail: {
                state: { ...survivalState },
                activities: [...missionActivities],
            },
        }));
    }

    function renderSurvivalSimulation() {
        const plan = consumptionPlans[survivalState.mode];
        document.querySelector('#survival-sol').textContent = `Sol ${survivalState.sol}`;
        document.querySelector('#survival-location').textContent =
            `Sitio seleccionado: ${survivalSites[survivalState.site]}. Las tasas educativas son iguales en cada lugar.`;
        document.querySelector('#temperature-target-summary').textContent = `${survivalState.targetTemperature} °C`;
        document.querySelector('#cabin-temperature').textContent = `${survivalState.cabinTemperature.toFixed(1)} °C`;
        temperatureOutput.textContent = `${survivalState.targetTemperature} °C`;

        ['oxygen', 'water', 'food', 'energy'].forEach((resource) => {
            const value = Math.round(survivalState[resource]);
            const meter = document.querySelector(`#${resource}-meter`);
            const resourceCard = document.querySelector(`[data-resource="${resource}"]`);
            document.querySelector(`#${resource}-value`).textContent = `${value}%`;
            meter.value = value;
            meter.setAttribute('aria-valuenow', String(value));
            resourceCard.classList.toggle('is-low', value <= 20);
            if (resource === 'energy') {
                const heatingUse = Math.max(0, survivalState.targetTemperature - 18) * 1.5;
                document.querySelector('#energy-use').textContent =
                    `Uso por sol: ${plan.energy}% + ${heatingUse.toFixed(1)}% calefacción · solar: +8%`;
            } else {
                document.querySelector(`#${resource}-use`).textContent =
                    `Consumo por sol (${plan.label.toLowerCase()}): ${plan[resource]}%`;
            }
        });

        const alerts = [];
        ['oxygen', 'water', 'food'].forEach((resource) => {
            const remaining = survivalState[resource];
            const required = plan[resource];
            if (remaining < required) {
                alerts.push(`${resourceNames[resource]} insuficiente: quedan ${Math.round(remaining)}%, se requieren ${required}% para el próximo sol.`);
            } else if (remaining <= 20) {
                alerts.push(`${resourceNames[resource]} en nivel bajo: ${Math.round(remaining)}%.`);
            }
        });

        const energyRequired = plan.energy + Math.max(0, survivalState.targetTemperature - 18) * 1.5;
        if (survivalState.energy + 8 < energyRequired) {
            alerts.push(`Energía insuficiente: la batería no cubrirá la demanda del hábitat (${energyRequired.toFixed(1)}%); la recarga solar estimada es 8%.`);
        } else if (survivalState.energy <= 20) {
            alerts.push(`Energía en nivel bajo: ${Math.round(survivalState.energy)}%.`);
        }
        if (survivalState.cabinTemperature < 16 || survivalState.cabinTemperature > 24) {
            alerts.push(`Temperatura interior fuera del rango recomendado en este simulador (16–24 °C): ${survivalState.cabinTemperature.toFixed(1)} °C.`);
        }

        alertBox.hidden = alerts.length === 0;
        alertList.replaceChildren(...alerts.map((message) => {
            const item = document.createElement('li');
            item.textContent = message;
            return item;
        }));
        publishMissionState();
    }

    siteSelect.addEventListener('change', () => {
        survivalState.site = siteSelect.value;
        status.textContent = `Escenario actualizado: ${survivalSites[survivalState.site]}. Las reservas no cambian.`;
        recordMissionActivity(`Ubicación del escenario: ${survivalSites[survivalState.site]}`);
        renderSurvivalSimulation();
    });

    modeSelect.addEventListener('change', () => {
        survivalState.mode = modeSelect.value;
        status.textContent = `Plan de consumo: ${consumptionPlans[survivalState.mode].label}.`;
        recordMissionActivity(`Plan de consumo: ${consumptionPlans[survivalState.mode].label}`);
        renderSurvivalSimulation();
    });

    temperatureSlider.addEventListener('input', () => {
        survivalState.targetTemperature = Number(temperatureSlider.value);
        status.textContent = `Termostato ajustado a ${survivalState.targetTemperature} °C. El calentamiento modifica la demanda de energía.`;
        renderSurvivalSimulation();
    });

    temperatureSlider.addEventListener('change', () => {
        recordMissionActivity(`Termostato ajustado a ${survivalState.targetTemperature} °C`);
        renderSurvivalSimulation();
    });

    document.querySelector('#advance-sol').addEventListener('click', () => {
        const plan = consumptionPlans[survivalState.mode];
        const heatingUse = Math.max(0, survivalState.targetTemperature - 18) * 1.5;
        const energyUse = plan.energy + heatingUse;
        const availableEnergy = survivalState.energy + 8;
        ['oxygen', 'water', 'food'].forEach((resource) => {
            survivalState[resource] = Math.max(0, survivalState[resource] - plan[resource]);
        });
        survivalState.energy = Math.max(0, Math.min(100, availableEnergy - energyUse));

        if (availableEnergy >= energyUse) {
            const temperatureChange = survivalState.targetTemperature - survivalState.cabinTemperature;
            survivalState.cabinTemperature += Math.max(-2, Math.min(2, temperatureChange));
        } else {
            survivalState.cabinTemperature = Math.max(-80, survivalState.cabinTemperature - 2);
        }

        survivalState.sol += 1;
        status.textContent = `Sol ${survivalState.sol} iniciado con el plan ${plan.label.toLowerCase()}. Revisa las alertas y ajusta los controles.`;
        recordMissionActivity(`Avanzó un sol con el plan ${plan.label.toLowerCase()}`);
        renderSurvivalSimulation();
    });

    document.querySelector('#reset-simulation').addEventListener('click', () => {
        Object.assign(survivalState, {
            sol: 1,
            site: 'curiosity',
            mode: 'balanced',
            targetTemperature: 20,
            cabinTemperature: 20,
            oxygen: 100,
            water: 100,
            food: 100,
            energy: 100,
        });
        siteSelect.value = survivalState.site;
        modeSelect.value = survivalState.mode;
        temperatureSlider.value = String(survivalState.targetTemperature);
        status.textContent = 'Simulación reiniciada. Todas las reservas están listas.';
        recordMissionActivity('Simulación reiniciada');
        renderSurvivalSimulation();
    });

    siteSelect.value = survivalState.site;
    modeSelect.value = survivalState.mode;
    temperatureSlider.value = String(survivalState.targetTemperature);
    if (missionActivities.length === 0) {
        recordMissionActivity(`Misión iniciada en ${survivalSites[survivalState.site]}`);
    }
    renderSurvivalSimulation();
}

const resourceDetector = document.querySelector('#resource-detector');
if (resourceDetector) {
    const resourceSites = [...document.querySelectorAll('[data-resource-site]')];
    const comparisonStatus = document.querySelector('#resource-compare-status');

    function updateResourceComparison() {
        let visibleSites = 0;
        resourceSites.forEach((checkbox) => {
            const card = document.querySelector(`[data-resource-card="${checkbox.dataset.resourceSite}"]`);
            card.hidden = !checkbox.checked;
            visibleSites += Number(checkbox.checked);
        });

        comparisonStatus.textContent = visibleSites
            ? `Comparando ${visibleSites} ${visibleSites === 1 ? 'lugar candidato' : 'lugares candidatos'}.`
            : 'Selecciona al menos un lugar para comparar.';
    }

    resourceSites.forEach((checkbox) => {
        checkbox.addEventListener('change', updateResourceComparison);
    });
    updateResourceComparison();
}

const hazardDashboard = document.querySelector('.hazard-dashboard');
if (hazardDashboard) {
    const scenarioDetails = {
        dust: {
            title: 'Polvo en aumento',
            severity: 'PRECAUCIÓN · SIMULACIÓN',
            message: 'El escenario supone menos visibilidad y generación solar reducida.',
            className: 'alert-warning',
            status: 'Escenario seleccionado: polvo. Las alertas son simuladas.',
        },
        temperature: {
            title: 'Frío extremo',
            severity: 'ALTA · SIMULACIÓN',
            message: 'El escenario supone temperatura bajo el límite; verificar el refugio térmico.',
            className: 'alert-danger',
            status: 'Escenario seleccionado: frío extremo. Las alertas son simuladas.',
        },
        radiation: {
            title: 'Radiación elevada',
            severity: 'AVISO · SIMULACIÓN',
            message: 'El escenario supone un aumento de radiación; revisar la protección.',
            className: 'alert-info',
            status: 'Escenario seleccionado: radiación elevada. Las alertas son simuladas.',
        },
        eva: {
            title: 'Soporte vital EVA bajo',
            severity: 'ALTA · SIMULACIÓN',
            message: 'El escenario supone una reserva baja de oxígeno durante una salida; regresar al hábitat.',
            className: 'alert-eva',
            status: 'Escenario seleccionado: riesgo EVA. Las alertas son simuladas.',
        },
    };
    const scene = hazardDashboard.querySelector('.mars-scene');
    const feed = hazardDashboard.querySelector('#hazard-alert-feed');
    const status = hazardDashboard.querySelector('#hazard-scene-status');
    const scenarioButtons = [...hazardDashboard.querySelectorAll('[data-hazard-scenario]')];

    scenarioButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const scenarioKey = button.dataset.hazardScenario;
            const scenario = scenarioDetails[scenarioKey];
            if (!scenario) {
                return;
            }

            scene.dataset.scenario = scenarioKey;
            scenarioButtons.forEach((item) => {
                item.setAttribute('aria-pressed', String(item === button));
            });

            const alert = document.createElement('article');
            alert.className = `demo-alert ${scenario.className}`;
            const severity = document.createElement('span');
            severity.className = 'demo-alert-severity';
            severity.textContent = scenario.severity;
            const title = document.createElement('strong');
            title.textContent = scenario.title;
            const message = document.createElement('span');
            message.textContent = scenario.message;
            alert.append(severity, title, message);
            feed.prepend(alert);
            while (feed.children.length > 4) {
                feed.lastElementChild.remove();
            }
            status.textContent = scenario.status;
        });
    });

    hazardDashboard.querySelector('#clear-hazard-alerts').addEventListener('click', () => {
        feed.replaceChildren();
        status.textContent = 'Bandeja de ejemplo vacía. Selecciona un escenario para simular una alerta.';
    });
}

async function loadNasaGallery() {
    const status = document.querySelector('#gallery-status');
    const gallery = document.querySelector('#gallery-grid');
    const updated = document.querySelector('#gallery-updated');
    const searches = [
        { rover: 'Perseverance', query: 'Perseverance rover Navcam Mars' },
        { rover: 'Curiosity', query: 'Curiosity rover Mars surface' },
    ];

    try {
        const results = await Promise.allSettled(searches.map(async ({ rover, query }) => {
            const response = await fetch(
                `https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=8`,
            );
            if (!response.ok) {
                throw new Error(`NASA Images respondió con estado ${response.status} para ${rover}.`);
            }
            const result = await response.json();
            return {
                rover,
                items: (result.collection?.items || [])
                    .filter((item) => item.data?.[0] && item.links?.some((link) => link.rel === 'preview'))
                    .slice(0, 2),
            };
        }));
        const failures = [];
        const loadedRovers = [];

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                failures.push(`${searches[index].rover}: ${result.reason.message}`);
                return;
            }

            if (result.value.items.length > 0) {
                loadedRovers.push(result.value.rover);
            }
            result.value.items.forEach((item) => {
                const metadata = item.data[0];
                const preview = item.links.find((link) => link.rel === 'preview');
                const card = document.createElement('article');
                card.className = 'gallery-card';

                const image = document.createElement('img');
                image.src = preview.href;
                image.alt = metadata.title || `Imagen del rover ${result.value.rover}`;
                image.loading = 'lazy';

                const copy = document.createElement('div');
                copy.className = 'gallery-copy';
                const roverLabel = document.createElement('span');
                roverLabel.className = 'gallery-rover-label';
                roverLabel.textContent = `ROVER · ${result.value.rover.toUpperCase()}`;
                const title = document.createElement('h3');
                title.textContent = metadata.title || `Imagen de ${result.value.rover}`;
                const date = document.createElement('time');
                if (metadata.date_created) {
                    date.dateTime = metadata.date_created;
                    date.textContent = `Fecha NASA: ${new Intl.DateTimeFormat('es', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(metadata.date_created))}`;
                } else {
                    date.textContent = 'Fecha NASA no disponible';
                }
                const creator = document.createElement('p');
                creator.className = 'gallery-credit';
                creator.textContent = `Crédito: ${metadata.secondary_creator || metadata.photographer || metadata.center || 'NASA'}`;
                const description = document.createElement('p');
                description.textContent = metadata.description_508 || metadata.description || 'Consulta el registro original de NASA para ver los detalles de esta imagen.';
                const link = document.createElement('a');
                link.href = item.href;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = `Abrir registro NASA ${metadata.nasa_id ? `(${metadata.nasa_id}) ` : ''}↗`;
                copy.append(roverLabel, title, date, creator, description, link);
                card.append(image, copy);
                gallery.append(card);
            });
        });

        if (gallery.children.length === 0) {
            throw new Error('El catálogo no devolvió imágenes con vista previa.');
        }

        const updateTime = new Date().toISOString();
        updated.textContent = `Catálogo consultado: ${formatUtcDate(updateTime)} UTC.`;
        const missingRovers = searches
            .map(({ rover }) => rover)
            .filter((rover) => !loadedRovers.includes(rover));
        status.textContent = `${gallery.children.length} imágenes del catálogo de NASA${loadedRovers.length ? `: ${loadedRovers.join(' y ')}` : ''}.${missingRovers.length ? ` Sin imágenes disponibles para: ${missingRovers.join(', ')}.` : ''}${failures.length ? ` ${failures.join(' ')}` : ''}`;
    } catch (error) {
        status.textContent = `No se pudo cargar la galería: ${error.message} Comprueba tu conexión o visita NASA Images.`;
        updated.textContent = 'No se pudo actualizar la galería.';
        const fallbackLink = document.createElement('a');
        fallbackLink.href = 'https://images.nasa.gov/search?q=mars%20rover';
        fallbackLink.target = '_blank';
        fallbackLink.rel = 'noopener noreferrer';
        fallbackLink.textContent = 'Explorar el catálogo de NASA ↗';
        status.append(' ', fallbackLink);
    }
}

const preferences = readStoredObject(preferencesStorageKey, { theme: 'light', textSize: 'normal' });
const themeToggle = document.querySelector('#theme-toggle');

function applyPreferences() {
    document.body.dataset.theme = preferences.theme === 'dark' ? 'dark' : 'light';
    document.body.dataset.accessibilitySize = ['small', 'normal', 'large'].includes(preferences.textSize)
        ? preferences.textSize
        : 'normal';
    const darkMode = preferences.theme === 'dark';
    themeToggle.setAttribute('aria-pressed', String(darkMode));
    themeToggle.textContent = darkMode ? 'Activar modo claro' : 'Activar modo oscuro';
}

themeToggle.addEventListener('click', () => {
    preferences.theme = preferences.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(preferencesStorageKey, JSON.stringify(preferences));
    applyPreferences();
});

document.querySelectorAll('button[data-text-size]').forEach((button) => {
    button.addEventListener('click', () => {
        preferences.textSize = button.dataset.textSize;
        localStorage.setItem(preferencesStorageKey, JSON.stringify(preferences));
        applyPreferences();
    });
});

renderMissionProgress();
applyPreferences();
if (!document.body.dataset.toolView || document.body.dataset.toolView === 'nasa-gallery') {
    loadNasaGallery();
}
}
