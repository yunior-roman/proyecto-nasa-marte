# Guía de supervivencia interplanetaria

Guía responsive de exploración marciana con navegación por módulos, herramientas, búsqueda y un asistente de IA flotante. La portada muestra la información principal; el menú lateral da acceso a los módulos informativos y a herramientas como el mapa, la galería, el panel de misión y el simulador. Cada módulo abre su propia página informativa y cada herramienta su propio apartado. El buscador devuelve enlaces directos a los módulos relacionados. El asistente está disponible desde todas las páginas y puede iniciar una pregunta contextual sobre el módulo abierto.

El centro de misión incluye un explorador visual de Marte con zoom y sitios reales de aterrizaje; consulta la elevación de Gale, Jezero y Elysium Planitia en el modelo MOLA MEGDR de NASA/PDS. Cada elevación representa la celda de 0,25° más cercana al sitio y se presenta respecto al areoide marciano. El dibujo del mapa y las referencias de hielo siguen siendo ilustrativos, no capas topográficas científicas. La galería carga imágenes de Perseverance y Curiosity desde NASA Images y muestra el crédito, la fecha NASA de cada imagen y cuándo se consultó el catálogo. El simulador educativo permite elegir sitio, reservas, plan de consumo y termostato; las tasas son supuestos de juego, no datos ni guía operativa. El panel de control de misión presenta el estado, los recursos, la ubicación del escenario, un historial local del simulador y un índice educativo de supervivencia derivado de la reserva más baja; sus datos no son telemetría ni probabilidad real y se guardan en el navegador. El detector compara hielo confirmado por Phoenix, indicios orbitales en Arcadia Planitia y evidencia de agua antigua en Jezero, diferenciándolos de recursos que solo serían potenciales. La sección de alertas resume riesgos de polvo, temperatura, radiación y EVA con fuentes NASA, pero no ofrece monitoreo ni avisos operativos en tiempo real. Incluye una escena animada 3D hecha con CSS y escenarios de alertas interactivos; los avisos de ejemplo son simulaciones locales, no lecturas ni observaciones NASA. Cada enlace del centro abre únicamente su apartado en una pestaña nueva. Los favoritos, el checklist, el resultado del quiz, el tema y el tamaño de texto se guardan localmente en el navegador. Los datos NASA requieren conexión a internet; el clima se presenta como archivo histórico, no como dato en tiempo real.

El chat en español apoya la planificación informativa de exploraciones en Marte. El servidor Python envía las preguntas a un proveedor compatible con la API de chat de OpenAI; la clave permanece en el servidor y no se expone al navegador.

Los enlaces a herramientas del menú lateral abren cada apartado en una pestaña separada. Dentro de cada herramienta, la barra fija también permite cambiar a las demás secciones del centro de misión.

La fotografía de portada se sirve desde el catálogo público de imágenes de NASA y las fuentes de la página desde Google Fonts; se necesita internet para cargarlas.

## Requisitos

- Python 3.9 o posterior
- Las dependencias de `requirements.txt`
- Una clave de API válida para el proveedor configurado (opcional; el asistente funciona también en modo local sin internet)

## Ejecutar en Windows

1. Abre PowerShell en la carpeta del proyecto.
2. Crea un entorno virtual e instala las dependencias:

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```

3. Configura las variables de entorno para el asistente:

   ```powershell
   $env:AI_API_KEY = "tu-clave-secreta"
   # Opcionales:
   $env:AI_API_URL = "https://api.openai.com/v1/chat/completions"
   $env:AI_MODEL = "gpt-4o-mini"
   ```

   No guardes la clave en archivos públicos ni la escribas en JavaScript.

4. Inicia la aplicación y abre `http://127.0.0.1:5000`:

   ```powershell
   py app.py
   ```

Si falta `AI_API_KEY` o el proveedor no está disponible, el sitio seguirá disponible y el asistente responderá en modo local/offline usando la guía del proyecto sin depender de internet.

## Endpoint

`GET /api/mars/elevation` descarga y conserva en memoria el producto topográfico global MOLA MEGDR de 4 píxeles por grado (v2.0) del archivo NASA/PDS, y devuelve la elevación de la celda más cercana a cada sitio de misión junto con la fecha de consulta. La primera consulta requiere conexión con el archivo.

`POST /api/assistant`

```json
{
  "message": "¿Qué debería incluir en una lista de recursos?",
  "history": []
}
```

El historial acepta hasta 12 mensajes anteriores con rol `user` o `assistant`. Cada pregunta nueva está limitada a 2000 caracteres.
