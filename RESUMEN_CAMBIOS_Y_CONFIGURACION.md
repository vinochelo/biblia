# 📖 Resumen de Cambios, Funcionamiento y Guía de Configuración

Este documento detalla todas las mejoras, correcciones y nuevas integraciones implementadas en la plataforma bíblica, así como la guía paso a paso para configurar las variables de entorno tanto en tu entorno local (`.env.local`) como en **Vercel**.

---

## 🛠️ 1. Resumen de Cambios y Mejoras Recientes

### A. 🔇 Corrección del Error Inmediato de Audio al Cargar Capítulos
- **Problema**: Al abrir cualquier capítulo en la sección *Leer la Biblia*, aparecía inmediatamente el mensaje en rojo: *"Error al reproducir el audio. Intenta generarlo de nuevo"*, aunque al presionar *Reintentar* funcionaba.
- **Causa**: Al cambiar de capítulo o versión, el navegador ejecutaba el evento nativo `onError` del elemento `<audio>` debido a que el atributo `src` se limpiaba en memoria antes de que el usuario iniciara la reproducción.
- **Solución**: Se implementó una protección en `handleAudioError` y en el efecto de reinicio (`removeAttribute('src')` + validación de estado inactivo), evitando que se disparen falsos errores al cargar la lectura.

### B. 🎙️ Locución Humana Limpia y Oficial
- Se eliminaron las opciones duplicadas que mostraban el mismo audio con distintos nombres (*RV60* y *Wordproject* eran re-etiquetados de las mismas cintas).
- Ahora se presenta directamente como **🎙️ Samuel Montoya (RVR 1909)**, cubriendo el 100% de la Biblia (1,189 capítulos) de forma inmediata, sin cuotas y en alta calidad.

### C. ⚡ Motor de Síntesis IA Ultra-Resistente (EdgeTTS + Google TTS Fallback)
- **Alta Disponibilidad**: Se integró un motor de respaldo con **Google TTS** dentro de `/api/tts`. Si el servidor en la nube (Vercel) experimenta bloqueos temporales de conexión WebSocket con EdgeTTS, el sistema genera automáticamente el audio en menos de 1 segundo mediante Google TTS, garantizando cero fallos de generación.
- **7 Voces Neuronales Disponibles**:
  - 👩 **Dalia** (México 🇲🇽)
  - 👨 **Jorge** (México 🇲🇽)
  - 👩 **Paloma** (Latinoamérica 🌎)
  - 👩 **Elvira** (España 🇪🇸)
  - 👨 **Álvaro** (España 🇪🇸)
  - 👨 **Tomás** (Argentina 🇦🇷)
  - 👨 **Gonzalo** (Colombia 🇨🇴)

### D. 🎭 Integración Preparada para Bible Brain (Faith Comes By Hearing / Bible.is)
- Se preparó el módulo `src/lib/bible-brain.ts` y las rutas API `/api/passages` y `/api/audio/bible-brain`.
- Soporta las nuevas versiones en español tanto en **Texto** como en **Audio Dramatizado**:
  - **Reina Valera 1960** (`RVR60` / `SPNBDA`)
  - **Nueva Versión Internacional** (`NVI` / `SPNNVIDA`)
  - **Traducción en Lenguaje Actual** (`TLA` / `SPNTLADA`)
  - **Dios Habla Hoy** (`DHH` / `SPNDHHDA`)
  - **La Biblia de las Américas** (`LBLA` / `SPNLBLDA`)
- Cuenta con respaldo inteligente: si la API Key aún no está configurada, el sistema utiliza la versión disponible por defecto sin bloquear la interfaz.

---

## 🔐 2. Plantilla de Variables de Entorno (`.env.local` y Vercel)

Copia este contenido en tu archivo `.env.local` en la raíz del proyecto. Estas mismas variables deben registrarse en el panel de **Vercel** (`Settings` -> `Environment Variables`):

```env
# ==============================================================================
# 1. API.BIBLE (Para textos de RVR09, BES, PDT, VBL)
# Obtén tu clave en: https://scripture.api.bible/
# ==============================================================================
BIBLE_API_KEY=tu_clave_de_api_bible

# ==============================================================================
# 2. BIBLE BRAIN / FAITH COMES BY HEARING (Texto y Audios Dramatizados)
# Solicitud en: https://www.faithcomesbyhearing.com/bible-brain/developer-documentation
# (Ingresar cuando te llegue el correo de aprobación)
# ==============================================================================
BIBLE_BRAIN_API_KEY=tu_clave_de_bible_brain

# ==============================================================================
# 3. GOOGLE GEMINI AI (Diccionario, Concordancia, Devocionales e Insights)
# Obtén tu clave en: https://aistudio.google.com/
# Puedes colocar una clave principal o varias separadas por coma para rotación
# ==============================================================================
GEMINI_API_KEY=tu_clave_de_gemini
# GEMINI_API_KEYS=clave1,clave2,clave3

# ==============================================================================
# 4. FIREBASE (Base de Datos en Tiempo Real y Autenticación)
# ==============================================================================
NEXT_PUBLIC_FIREBASE_API_KEY=tu_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_proyecto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

# Firebase Admin SDK (Servidor)
FIREBASE_PROJECT_ID=tu_proyecto
FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
# FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# ==============================================================================
# 5. TAREAS PROGRAMADAS Y CRONS (Opcional)
# ==============================================================================
CRON_SECRET=clave_secreta_para_crons

# ==============================================================================
# 6. ELEVENLABS (Opcional - Fallback secundario)
# ==============================================================================
# ELEVENLABS_API_KEY=tu_clave_elevenlabs
# ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
```

---

## 🚀 3. Pasos para Configurar en Vercel

1. Ve a tu proyecto en el panel de **[Vercel Dashboard](https://vercel.com/)**.
2. Dirígete a la pestaña **Settings** > **Environment Variables**.
3. Añade cada variable con su respectivo valor marcando los entornos **Production**, **Preview** y **Development**.
4. Cuando añadas o actualices una clave (como `BIBLE_BRAIN_API_KEY`), realiza un nuevo despliegue (*Redeploy*) o haz un commit en la rama `main` para que Vercel tome los cambios actualizados.

---

## 🎯 4. Cómo Probar el Funcionamiento

1. **Lectura y Audio Humano**: Entra a *Leer la Biblia* o *Lectura del Día*, selecciona cualquier libro y presiona **Reproducir**. Iniciará de inmediato con la voz de Samuel Montoya sin errores de inicio.
2. **Audio con IA**: Cambia a la pestaña **`IA Neuronal`**, elige cualquiera de las 7 voces (ej. *👩 Dalia* o *👨 Jorge*) y presiona reproducir. El audio se sintetizará y quedará guardado en caché.
3. **Versiones de Bible Brain**: Selecciona versiones como *RVR60* o *NVI*. En cuanto agregues `BIBLE_BRAIN_API_KEY`, tanto el texto oficial como el audio dramatizado se activarán automáticamente.
