#!/bin/bash
# Script para probar el análisis de video usando curl
# Uso: ./scripts/test-video-analysis.sh <ruta_al_video>

POSE_SERVICE_URL="${POSE_SERVICE_URL:-http://localhost:5000}"
API_ENDPOINT="${POSE_SERVICE_URL}/api/pose/analyze-video"

if [ $# -lt 1 ]; then
    echo "Uso: $0 <ruta_al_video> [opciones]"
    echo ""
    echo "Opciones:"
    echo "  --processing-mode <full|fast|streaming>  Modo de procesamiento (default: full)"
    echo "  --sample-rate <número>                    Tasa de muestreo (default: 1)"
    echo "  --max-frames <número>                     Máximo de frames a procesar"
    echo "  --no-yolo                                Deshabilitar YOLO"
    echo "  --yolo-confidence <0.0-1.0>              Confianza YOLO (default: 0.5)"
    echo "  --calibration <altura_metros>             Altura del batter en metros"
    echo ""
    echo "Ejemplo:"
    echo "  $0 video.mp4 --max-frames 100"
    exit 1
fi

VIDEO_PATH="$1"
shift

if [ ! -f "$VIDEO_PATH" ]; then
    echo "❌ Error: El archivo $VIDEO_PATH no existe"
    exit 1
fi

echo "📹 Analizando video: $VIDEO_PATH"
echo "🔗 Endpoint: $API_ENDPOINT"
echo ""

# Valores por defecto
PROCESSING_MODE="full"
SAMPLE_RATE="1"
ENABLE_YOLO="true"
YOLO_CONFIDENCE="0.5"
MAX_FRAMES=""
CALIBRATION=""

# Parsear argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --processing-mode)
            PROCESSING_MODE="$2"
            shift 2
            ;;
        --sample-rate)
            SAMPLE_RATE="$2"
            shift 2
            ;;
        --max-frames)
            MAX_FRAMES="$2"
            shift 2
            ;;
        --no-yolo)
            ENABLE_YOLO="false"
            shift
            ;;
        --yolo-confidence)
            YOLO_CONFIDENCE="$2"
            shift 2
            ;;
        --calibration)
            CALIBRATION="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo "📤 Enviando video al servicio..."
echo "   Parámetros:"
echo "   - processingMode: $PROCESSING_MODE"
echo "   - sampleRate: $SAMPLE_RATE"
echo "   - enableYOLO: $ENABLE_YOLO"
echo "   - yoloConfidence: $YOLO_CONFIDENCE"
[ -n "$MAX_FRAMES" ] && echo "   - maxFrames: $MAX_FRAMES"
[ -n "$CALIBRATION" ] && echo "   - calibration: $CALIBRATION"
echo ""

# Construir comando curl
CURL_CMD="curl -X POST \"$API_ENDPOINT\" \
  -F \"video=@$VIDEO_PATH\" \
  -F \"processingMode=$PROCESSING_MODE\" \
  -F \"sampleRate=$SAMPLE_RATE\" \
  -F \"enableYOLO=$ENABLE_YOLO\" \
  -F \"yoloConfidence=$YOLO_CONFIDENCE\""

[ -n "$MAX_FRAMES" ] && CURL_CMD="$CURL_CMD -F \"maxFrames=$MAX_FRAMES\""
[ -n "$CALIBRATION" ] && CURL_CMD="$CURL_CMD -F \"calibration=$CALIBRATION\""

CURL_CMD="$CURL_CMD --max-time 300 -w \"\nHTTP Status: %{http_code}\n\""

# Ejecutar curl y guardar respuesta
echo "⏳ Procesando (esto puede tomar varios minutos)..."
RESPONSE=$(eval $CURL_CMD)
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP Status:" | awk '{print $3}')
BODY=$(echo "$RESPONSE" | sed '/HTTP Status:/d')

echo ""
echo "📥 Respuesta recibida (Status: $HTTP_CODE)"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "$BODY" | python3 -m json.tool > video-analysis-result.json 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Análisis completado!"
        echo "💾 Resultados guardados en 'video-analysis-result.json'"
        echo ""
        echo "📊 Resumen rápido:"
        python3 -c "
import json
with open('video-analysis-result.json', 'r') as f:
    data = json.load(f)
    if data.get('ok'):
        print(f\"   - Frames procesados: {data.get('videoInfo', {}).get('frameCount', 'N/A')}\")
        print(f\"   - Frame de contacto: {data.get('contactFrame', 'N/A')}\")
        if data.get('metrics'):
            m = data['metrics']
            if 'batSpeed' in m:
                print(f\"   - Velocidad del bate: {m['batSpeed']:.2f} m/s\")
        if data.get('swingPhases'):
            print(f\"   - Fases detectadas: {len(data['swingPhases'])}\")
        if data.get('formErrors'):
            print(f\"   - Errores de forma: {len(data['formErrors'])}\")
    else:
        print(f\"   Error: {data.get('error', 'Desconocido')}\")
" 2>/dev/null || echo "   (Instala python3 para ver el resumen)"
    else
        echo "⚠️  Respuesta recibida pero no es JSON válido"
        echo "$BODY"
    fi
else
    echo "❌ Error HTTP $HTTP_CODE"
    echo "$BODY"
    exit 1
fi

