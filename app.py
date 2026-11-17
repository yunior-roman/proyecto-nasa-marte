import json
import logging
import os
import struct
import unicodedata
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import Flask, jsonify, render_template, request


MOLA_TOPOGRAPHY_URL = (
    "https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/"
    "meg004/megt90n000cb.img"
)
MOLA_TOPOGRAPHY_BYTES = 1440 * 720 * 2
MOLA_SITES = {
    "curiosity": {"latitude": -4.59, "longitude": 137.44},
    "perseverance": {"latitude": 18.44, "longitude": 77.45},
    "insight": {"latitude": 4.50, "longitude": 135.62},
}
_mola_data = None
_mola_retrieved_at = None


MODULES = {
    "entorno": {
        "number": "01",
        "title": "El entorno marciano",
        "label": "CIENCIA · PLANETA ROJO",
        "intro": "Marte es un mundo frío y seco con una atmósfera muy delgada. Comprender sus condiciones ayuda a interpretar los datos y preparar una exploración responsable.",
        "topics": [
            {"title": "Atmósfera y clima", "description": "La atmósfera está compuesta principalmente por dióxido de carbono. La presión es muy baja y las temperaturas pueden cambiar ampliamente según la estación y el lugar."},
            {"title": "Terreno y polvo", "description": "Cráteres, dunas, rocas y pendientes influyen en el paso de un rover. El polvo puede cubrir paneles solares y afectar instrumentos."},
            {"title": "Radiación y gravedad", "description": "La superficie recibe más radiación que la Tierra y la gravedad es menor. Son factores importantes para estudiar en el diseño de futuras misiones humanas."},
        ],
        "prompt": "¿Cuáles son los principales riesgos ambientales de Marte y cómo se estudian?",
    },
    "equipo": {
        "number": "02",
        "title": "Tu equipo",
        "label": "TECNOLOGÍA · PREPARACIÓN",
        "intro": "Las misiones robóticas utilizan vehículos e instrumentos que permiten investigar Marte a distancia. Las misiones humanas necesitarán además sistemas de soporte vital y protección.",
        "topics": [
            {"title": "Traje espacial", "description": "Protege a la tripulación y ayuda a mantener condiciones adecuadas de presión, oxígeno y temperatura durante las actividades extravehiculares."},
            {"title": "Rovers e instrumentos", "description": "Cámaras, sensores y laboratorios a bordo observan el terreno y analizan muestras para estudiar la geología marciana."},
            {"title": "Comunicaciones y energía", "description": "Las antenas transmiten datos con retraso entre Marte y la Tierra. Los equipos pueden usar paneles solares o generadores según el diseño de cada misión."},
        ],
        "prompt": "¿Qué equipo y sistemas necesita un rover para explorar Marte?",
    },
    "rutas": {
        "number": "03",
        "title": "Rutas y destinos",
        "label": "MAPAS · EXPLORACIÓN",
        "intro": "Elegir un destino de exploración exige comparar objetivos científicos con el relieve y la información disponible. Los mapas y los datos de misión son esenciales para evaluar cada recorrido.",
        "topics": [
            {"title": "Define el objetivo", "description": "Relaciona la ruta con una pregunta científica: estudiar capas de roca, minerales, antiguos cauces o cambios del paisaje."},
            {"title": "Observa el terreno", "description": "Considera pendientes, dunas, rocas, cráteres, distancia y comunicación antes de planificar un desplazamiento."},
            {"title": "Planifica alternativas", "description": "Compara más de una ruta y revisa las condiciones con mapas e imágenes recientes. Una ruta propuesta no sustituye el análisis del equipo de misión."},
        ],
        "prompt": "¿Qué datos debería comparar para elegir una ruta de exploración en Marte?",
    },
    "condiciones": {
        "number": "04",
        "title": "Condiciones de vida",
        "label": "HÁBITAT · SALUD",
        "intro": "Vivir en Marte requeriría un hábitat que proteja a las personas del entorno y mantenga recursos esenciales. Estos retos se estudian mediante investigación y pruebas en la Tierra.",
        "topics": [
            {"title": "Aire y agua", "description": "El hábitat tendría que gestionar el aire respirable y el agua, además de controlar fugas y recuperar recursos con sistemas de soporte vital."},
            {"title": "Temperatura y radiación", "description": "El aislamiento, la calefacción y la protección del hábitat ayudarían a estudiar cómo afrontar el frío y la radiación del entorno."},
            {"title": "Salud y rutina", "description": "La alimentación, el descanso, el ejercicio, la atención médica y el bienestar psicológico son aspectos importantes de una misión prolongada."},
        ],
        "prompt": "¿Qué necesita un hábitat para proteger a las personas en Marte?",
    },
    "consejos": {
        "number": "05",
        "title": "Consejos de supervivencia",
        "label": "SEGURIDAD · PREPARACIÓN",
        "intro": "La seguridad de una misión depende de una buena preparación, comunicación y seguimiento de procedimientos revisados por especialistas.",
        "topics": [
            {"title": "Antes de cada salida", "description": "Comprueba los sistemas, revisa el plan de actividad y confirma los objetivos y las comunicaciones con el equipo."},
            {"title": "Durante la exploración", "description": "Registra observaciones, vigila las condiciones y mantén contacto con el equipo. Detén la actividad si cambian las condiciones previstas."},
            {"title": "Planes alternativos", "description": "Define cómo responder ante retrasos, fallos de equipo o cambios ambientales. Los procedimientos deben validarse para cada misión concreta."},
        ],
        "prompt": "¿Qué puntos debería incluir una lista de verificación para una caminata marciana?",
    },
    "recursos": {
        "number": "06",
        "title": "Recursos y enlaces",
        "label": "DOCUMENTACIÓN · DATOS",
        "intro": "Explora fuentes científicas y materiales de las misiones para aprender sobre la superficie, la atmósfera y la historia geológica de Marte.",
        "topics": [
            {"title": "Imágenes y mapas", "description": "Compara fotografías, mapas orbitales y observaciones de rovers. Comprueba la fecha, la ubicación y el contexto de cada dato."},
            {"title": "Misiones y ciencia", "description": "Consulta la información pública sobre las misiones que estudian Marte y los instrumentos con los que recogen sus datos."},
            {"title": "Evalúa la información", "description": "Prioriza fuentes científicas identificables y distingue entre datos observados, interpretaciones y propuestas futuras."},
        ],
        "prompt": "¿Dónde puedo encontrar datos públicos y mapas científicos de Marte?",
    },
}

SYSTEM_PROMPT = (
    "Eres un asistente de planificación para exploración marciana. Responde en español "
    "con claridad. Ayuda con conceptos científicos generales, preparación de recursos, "
    "evaluación de rutas y riesgos. No inventes datos en tiempo real, coordenadas, mapas "
    "ni lecturas de sensores; aclara cuándo faltan datos. No presentes sugerencias como "
    "instrucciones operativas certificadas y recuerda que los planes reales deben "
    "validarse con especialistas y protocolos de misión."
)


def build_offline_assistant_reply(message, history=None):
    question = normalize_search_text(message or "")
    history = history or []
    if not question:
        return "Puedes preguntarme sobre Marte, rutas, recursos, clima, riesgos o equipo. Estoy funcionando en modo offline y respondo con orientación general de la guía."

    topic_hints = {
        "ruta": "Para elegir una ruta en Marte, compara el objetivo científico, el relieve, la distancia, la visibilidad, la comunicación y las alternativas. La mejor ruta es la que equilibra seguridad, ciencia y energía.",
        "destino": "Antes de elegir un destino, revisa si la zona tiene interés científico, pendiente manejable, accesibilidad y cobertura de comunicaciones. Haz una ruta alternativa por si cambian las condiciones.",
        "riesgo": "Los riesgos principales son polvo, temperaturas extremas, radiación, desgaste del equipo y pérdida de comunicación. En una misión real, cada riesgo debe evaluarse con protocolos y especialistas.",
        "polvo": "El polvo puede cubrir paneles solares, reducir la eficiencia energética y afectar cámaras e instrumentos. Una misión necesita planes de limpieza y contingencia.",
        "temperatura": "Las temperaturas en Marte cambian mucho entre el día y la noche. El hábitat, el traje y la planificación deben gestionar calor, aislamiento y energía.",
        "radiacion": "La radiación es un factor crítico por la ausencia de atmósfera densa y el campo magnético global. La protección del equipo y la planificación de EVA son esenciales.",
        "agua": "El agua es un recurso crítico para supervivencia, hidratación, higiene y potencial producción de propelente o oxígeno. Incluso pequeños ahorros cuentan.",
        "aire": "El aire respirable exige manejo cuidadoso de presión, oxígeno y filtración. El hábitat debe mantener condiciones estables y detectar fugas rápidamente.",
        "equipo": "El equipo debe cubrir protección, energía, comunicaciones, sensores, herramientas y protocolos de emergencia. Un rover o un traje no sirven por sí solos; necesitan integración.",
        "traje": "Un traje espacial debe proteger de presión, temperatura, radiación y posible daño mecánico. La planificación de EVA y el entrenamiento previo son fundamentales.",
        "rover": "Un rover necesita energía, navegación, sensores, autonomía y comunicación. Su diseño depende del terreno, la duración y la misión científica.",
        "recursos": "Los recursos clave para una misión son agua, energía, oxígeno, alimentación, materiales de reparación y datos de navegación. La reserva más escasa suele decidir el margen operativo.",
        "habitat": "El hábitat debe proteger a la tripulación del frío, la radiación y la falta de presión. También necesita sistemas para aire, agua, energía, reciclaje y salud.",
        "salud": "La salud en Marte incluye ejercicio, sueño, nutrición, atención médica y bienestar psicológico. La rutina y la preparación previenen errores durante las misiones.",
        "clima": "El clima marciano es seco, frío y con tormentas de polvo. Las condiciones cambian con la estación y la latitud; por eso se requiere vigilancia y planificación flexible.",
    }

    matched_topics = [value for keyword, value in topic_hints.items() if keyword in question]
    if matched_topics:
        base = matched_topics[0]
    else:
        base = "Para una misión marciana, conviene empezar por tres ideas: definir el objetivo científico, evaluar riesgos y recursos, y preparar rutas de respaldo. La guía recomienda mantener una visión clara antes de cada decisión importante."

    context_chunks = []
    if history:
        last_user = ""
        for item in reversed(history):
            if isinstance(item, dict) and item.get("role") == "user" and isinstance(item.get("content"), str):
                last_user = item["content"].strip()
                break
        if last_user:
            context_chunks.append(f"También he visto que antes preguntaste: \"{last_user}\". Por eso te respondo con continuidad a ese hilo y mantengo el enfoque de planificación y seguridad.")

    context_text = " ".join(context_chunks)

    if any(keyword in question for keyword in ["lista", "recursos", "suministros", "kit", "preparar"]):
        answer = (
            "Para una misión marciana, una lista útil incluye: 1) agua y reservas de hidratación, 2) oxígeno o sistemas de reciclaje, 3) energía y baterías, 4) comunicaciones, 5) herramientas de mantenimiento, 6) materiales para protección térmica y 7) un plan alternativo ante cambios climáticos o fallos. "
            "Lo más importante es priorizar lo que te permite sobrevivir, movernos y mantener la misión funcionando."
        )
    elif any(keyword in question for keyword in ["ruta", "destino", "mapa", "camino", "recorrido"]):
        answer = (
            "Si estás evaluando una ruta en Marte, primero fija el objetivo científico: ¿vas a estudiar rocas, minerales, hielo o un cráter? Luego compara pendiente, distancia, terreno, visibilidad, comunicación y energía. "
            "Haz siempre una ruta alternativa y revisa si el recorrido es realista con los sistemas y el tiempo disponible."
        )
    elif any(keyword in question for keyword in ["riesgo", "peligro", "tormenta", "polvo", "radiacion", "temperatura"]):
        answer = (
            "Los mayores riesgos son polvo, temperaturas extremas, radiación, agotamiento del equipo y pérdida de contacto con la base. Un buen plan se basa en detectar los riesgos temprano, reducir la exposición y preparar contingencias."
        )
    elif any(keyword in question for keyword in ["equipo", "traje", "rover", "sistema", "instrumento"]):
        answer = (
            "El equipo debe combinar protección, energía, sensores, comunicaciones y capacidad de recuperación. Un traje o rover solo es útil si están integrados con la misión, el terreno y la operación de la tripulación."
        )
    elif any(keyword in question for keyword in ["habitat", "vida", "salud", "agua", "aire"]):
        answer = (
            "Para condiciones de vida, un hábitat debe controlar presión, oxígeno, temperatura, agua y salud mental. La clave es crear un entorno estable y predecible, con redundancias y procedimientos claros para emergencias."
        )
    else:
        answer = base

    if context_text:
        answer = f"{answer} {context_text}"

    answer += " En este modo offline, la respuesta se basa en la guía local del sitio y no en datos en tiempo real ni conexión a internet."
    return answer


app = Flask(__name__, static_folder="assets", static_url_path="/assets", template_folder="templates")
app.config["MAX_CONTENT_LENGTH"] = 20_000
TOOL_VIEWS = {
    "mars-map",
    "nasa-gallery",
    "mission-checklist",
    "rovers",
    "mars-quiz",
    "mars-weather",
    "my-progress",
    "survival-simulator",
    "mission-dashboard",
    "resource-detector",
    "hazard-alerts",
}


def normalize_search_text(text):
    decomposed = unicodedata.normalize("NFD", text.casefold())
    return "".join(character for character in decomposed if not unicodedata.combining(character))


@app.get("/")
def index():
    section = request.args.get("seccion", "inicio")
    requested_tool_view = request.args.get("apartado", "")
    tool_view = requested_tool_view if requested_tool_view in TOOL_VIEWS else ""
    current_module = MODULES.get(section)
    not_found = section != "inicio" and current_module is None
    search_query = request.args.get("q", "").strip()
    matching_modules = []

    if search_query:
        terms = normalize_search_text(search_query).split()
        for module_key, module in MODULES.items():
            searchable_text = " ".join(
                [module_key, module["title"], module["label"], module["intro"]]
                + [text for topic in module["topics"] for text in (topic["title"], topic["description"])]
            )
            normalized_text = normalize_search_text(searchable_text)
            if all(term in normalized_text for term in terms):
                matching_modules.append((module_key, module))

    return render_template(
        "index.html",
        section=section,
        tool_view=tool_view,
        current_module=current_module,
        not_found=not_found,
        search_query=search_query,
        matching_modules=matching_modules,
        modules=MODULES.items(),
    ), (404 if not_found else 200)


@app.get("/api/mars/elevation")
def mars_elevation():
    global _mola_data, _mola_retrieved_at

    if _mola_data is None:
        try:
            mola_request = Request(
                MOLA_TOPOGRAPHY_URL,
                headers={"User-Agent": "GuiaMarciana/1.0", "Accept": "application/octet-stream"},
            )
            with urlopen(mola_request, timeout=30) as response:
                data = response.read(MOLA_TOPOGRAPHY_BYTES + 1)
            if len(data) != MOLA_TOPOGRAPHY_BYTES:
                raise ValueError("El archivo MOLA no tiene el tamaño esperado.")
        except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
            logging.error("Could not retrieve NASA MOLA topography: %s", error)
            return jsonify(error="No se pudo consultar el modelo de elevación NASA MOLA."), 502

        _mola_data = data
        _mola_retrieved_at = datetime.now(timezone.utc).isoformat()

    elevations = {}
    for site, coordinates in MOLA_SITES.items():
        latitude = coordinates["latitude"]
        longitude = coordinates["longitude"] % 360
        row = min(719, max(0, int((90 - latitude) * 4)))
        column = int(longitude * 4) % 1440
        elevation = struct.unpack_from(">h", _mola_data, (row * 1440 + column) * 2)[0]
        if not -8068 <= elevation <= 21134:
            logging.error("NASA MOLA returned an invalid elevation for %s.", site)
            return jsonify(error="El archivo NASA MOLA contiene una elevación no válida."), 502
        elevations[site] = elevation

    return jsonify(
        elevations=elevations,
        retrieved_at=_mola_retrieved_at,
        product_date="2003-04-03T01:00:00Z",
        resolution_degrees=0.25,
        source="Mars Global Surveyor MOLA MEGDR, producto final v2.0",
        source_url="https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg004/",
    )


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify(error="La solicitud está vacía o supera el tamaño permitido."), 413


@app.route("/api/assistant", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def assistant():
    if request.method != "POST":
        response = jsonify(error="Este endpoint solo acepta solicitudes POST.")
        response.headers["Allow"] = "POST, OPTIONS"
        return response, 405

    try:
        payload = json.loads(request.get_data(cache=False))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return jsonify(error="El cuerpo de la solicitud no contiene JSON válido."), 400

    if not isinstance(payload, dict):
        return jsonify(error="El cuerpo de la solicitud no contiene JSON válido."), 400

    message = payload.get("message")
    if not isinstance(message, str) or not message.strip() or len(message) > 2000:
        return jsonify(error="Escribe una pregunta de hasta 2000 caracteres."), 400

    history = payload.get("history", [])
    if not isinstance(history, list):
        return jsonify(error="El historial de conversación no es válido."), 400

    for item in history[-12:]:
        if (
            not isinstance(item, dict)
            or item.get("role") not in ("user", "assistant")
            or not isinstance(item.get("content"), str)
            or len(item["content"]) > 4000
        ):
            return jsonify(error="El historial contiene un mensaje no válido."), 400

    api_key = os.getenv("AI_API_KEY", "").strip()
    if api_key:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for item in history[-12:]:
            messages.append({"role": item["role"], "content": item["content"]})
        messages.append({"role": "user", "content": message.strip()})

        provider_payload = json.dumps(
            {
                "model": os.getenv("AI_MODEL", "gpt-4o-mini"),
                "messages": messages,
                "temperature": 0.6,
            }
        ).encode("utf-8")
        provider_request = Request(
            os.getenv("AI_API_URL", "https://api.openai.com/v1/chat/completions"),
            data=provider_payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(provider_request, timeout=45) as response:
                provider_response = json.loads(response.read())
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError, UnicodeDecodeError) as error:
            logging.warning("External AI provider unavailable; falling back to offline mode: %s", error)
        else:
            try:
                reply = provider_response["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError):
                reply = None
            if isinstance(reply, str) and reply.strip():
                return jsonify(reply=reply.strip(), mode="online")

    offline_reply = build_offline_assistant_reply(message, history)
    return jsonify(reply=offline_reply, mode="offline")


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
