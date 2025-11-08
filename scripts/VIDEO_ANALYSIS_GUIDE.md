# Guía para Analizar Videos

Esta guía te muestra cómo ejecutar el análisis de video y obtener los resultados completos.

## 📋 Requisitos Previos

1. **Servicio de Pose Detection corriendo**
   ```bash
   # Asegúrate de que el servicio esté activo
   # Por defecto corre en el puerto 5000
   ```

2. **Modo Demo (opcional pero recomendado para pruebas)**
   ```bash
   # En el archivo .env.local o al iniciar el servicio:
   export DEMO_MODE=true
   ```

## 🚀 Métodos para Analizar un Video

### Método 1: Script Python (Recomendado)

El script Python proporciona una salida más detallada y formateada.

```bash
# Uso básico
python scripts/test-video-analysis.py ruta/al/video.mp4

# Con opciones
python scripts/test-video-analysis.py video.mp4 \
  --max-frames 100 \
  --sample-rate 2 \
  --yolo-confidence 0.6
```

**Opciones disponibles:**
- `--processing-mode <full|fast|streaming>`: Modo de procesamiento
- `--sample-rate <número>`: Procesar 1 de cada N frames (default: 1)
- `--max-frames <número>`: Máximo de frames a procesar
- `--no-yolo`: Deshabilitar detección YOLO
- `--yolo-confidence <0.0-1.0>`: Confianza mínima para YOLO (default: 0.5)
- `--calibration <altura_metros>`: Altura del batter en metros para calibración

**Ejemplo completo:**
```bash
python scripts/test-video-analysis.py swing_video.mp4 \
  --processing-mode full \
  --sample-rate 1 \
  --max-frames 200 \
  --yolo-confidence 0.6 \
  --calibration 1.75
```

### Método 2: Script Bash (curl)

Alternativa usando curl directamente.

```bash
# Uso básico
./scripts/test-video-analysis.sh ruta/al/video.mp4

# Con opciones
./scripts/test-video-analysis.sh video.mp4 \
  --max-frames 100 \
  --sample-rate 2
```

### Método 3: curl Directo

Si prefieres usar curl directamente:

```bash
curl -X POST http://localhost:5000/api/pose/analyze-video \
  -F "video=@ruta/al/video.mp4" \
  -F "processingMode=full" \
  -F "sampleRate=1" \
  -F "enableYOLO=true" \
  -F "yoloConfidence=0.5" \
  --max-time 300 \
  -o resultado.json
```

### Método 4: Python Requests (Programático)

```python
import requests

url = "http://localhost:5000/api/pose/analyze-video"

with open("video.mp4", "rb") as video_file:
    files = {"video": ("video.mp4", video_file, "video/mp4")}
    data = {
        "processingMode": "full",
        "sampleRate": "1",
        "enableYOLO": "true",
        "yoloConfidence": "0.5"
    }
    
    response = requests.post(url, files=files, data=data, timeout=300)
    result = response.json()
    
    print(result)
```

## 📊 Resultados del Análisis

El análisis devuelve un objeto JSON con la siguiente estructura:

```json
{
  "ok": true,
  "videoInfo": {
    "fps": 30.0,
    "frameCount": 150,
    "duration": 5.0,
    "width": 1920,
    "height": 1080
  },
  "contactFrame": 75,
  "contact": {
    "detected": true,
    "confidence": 0.95,
    "frame": 75
  },
  "metrics": {
    "batSpeed": 35.5,
    "swingAngle": 45.2,
    "contactAngle": 12.3
  },
  "swingPhases": [
    {
      "phase": "Stance",
      "startFrame": 0,
      "endFrame": 20
    },
    {
      "phase": "Load",
      "startFrame": 21,
      "endFrame": 40
    },
    // ... más fases
  ],
  "biomechanics": {
    "maxHipRotation": 45.0,
    "maxShoulderRotation": 120.0,
    "weightTransfer": 85.0
  },
  "formErrors": [
    {
      "type": "EarlyHipRotation",
      "severity": "medium",
      "frame": 50,
      "recommendation": "..."
    }
  ],
  "trackingTrajectories": {
    "person": [...],
    "bat": [...],
    "ball": [...]
  },
  "trackingQuality": {
    "overallScore": 0.95,
    "personTrackingRatio": 0.98,
    "batTrackingRatio": 0.92,
    "ballTrackingRatio": 0.85
  },
  "frames": [
    {
      "frame": 0,
      "pose": {...},
      "bat": {...},
      "ball": {...}
    }
    // ... más frames
  ]
}
```

## 🎯 Parámetros Importantes

### `processingMode`
- **`full`**: Análisis completo con todos los modelos (recomendado)
- **`fast`**: Análisis rápido, menos detecciones
- **`streaming`**: Optimizado para streaming en tiempo real

### `sampleRate`
- **1**: Procesa todos los frames (más lento, más preciso)
- **2**: Procesa 1 de cada 2 frames (más rápido)
- **3**: Procesa 1 de cada 3 frames (aún más rápido)

### `maxFrames`
- Limita el número de frames a procesar
- Útil para videos largos o pruebas rápidas
- Ejemplo: `--max-frames 100` procesa solo los primeros 100 frames

### `yoloConfidence`
- Confianza mínima para detecciones YOLO
- **0.5**: Más detecciones (puede incluir falsos positivos)
- **0.7**: Más estricto (menos detecciones, más precisas)
- **0.9**: Muy estricto (solo detecciones muy confiables)

## ⚠️ Solución de Problemas

### Error: "No se pudo conectar al servicio"
- Verifica que el servicio esté corriendo: `curl http://localhost:5000/health`
- Verifica el puerto (por defecto: 5000)
- Si usas otro puerto, configura: `export POSE_SERVICE_URL=http://localhost:PUERTO`

### Error: "Forbidden" o "403"
- El servicio requiere autenticación o modo demo
- Activa modo demo: `export DEMO_MODE=true` antes de iniciar el servicio
- O usa el backend gateway que maneja la autenticación

### Error: "Timeout"
- El video es muy largo o el procesamiento es lento
- Reduce `maxFrames` o aumenta `sampleRate`
- El timeout por defecto es 5 minutos (300 segundos)

### Error: "No video provided"
- Verifica que la ruta al video sea correcta
- Verifica que el archivo exista y sea un video válido

## 📝 Ejemplos de Uso

### Análisis rápido de prueba
```bash
python scripts/test-video-analysis.py video.mp4 --max-frames 50 --sample-rate 2
```

### Análisis completo de alta calidad
```bash
python scripts/test-video-analysis.py video.mp4 \
  --processing-mode full \
  --sample-rate 1 \
  --yolo-confidence 0.7
```

### Análisis con calibración
```bash
python scripts/test-video-analysis.py video.mp4 \
  --calibration 1.80 \
  --yolo-confidence 0.6
```

## 🔍 Ver Resultados

Los scripts guardan los resultados en `video-analysis-result.json`. Puedes:

1. **Ver el archivo completo:**
   ```bash
   cat video-analysis-result.json | python -m json.tool
   ```

2. **Extraer información específica:**
   ```python
   import json
   with open('video-analysis-result.json') as f:
       data = json.load(f)
       print(f"Frame de contacto: {data['contactFrame']}")
       print(f"Velocidad del bate: {data['metrics']['batSpeed']} m/s")
   ```

3. **Usar jq (si está instalado):**
   ```bash
   cat video-analysis-result.json | jq '.contactFrame'
   cat video-analysis-result.json | jq '.metrics.batSpeed'
   ```

## 🎬 Próximos Pasos

Una vez que tengas los resultados, puedes:
- Visualizar las trayectorias de tracking
- Analizar las fases del swing
- Revisar los errores de forma detectados
- Comparar múltiples swings
- Integrar con la interfaz web del proyecto

