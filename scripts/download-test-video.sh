#!/bin/bash
# Script para descargar un video de ejemplo de swing de béisbol

echo "📥 Descargando video de ejemplo de swing de béisbol..."

# URL de un video de ejemplo de Pexels (baseball swing)
# Si esta URL no funciona, el usuario puede descargar manualmente desde:
# https://www.pexels.com/es-es/video/bate-de-beisbol-rompiendose-en-camara-lenta-durante-un-swing-33930470/

VIDEO_URL="https://videos.pexels.com/video-files/3393047/3393047-hd_1920_1080_30fps.mp4"
OUTPUT_FILE="$HOME/Downloads/baseball_swing_example.mp4"

# Intentar descargar
curl -L "$VIDEO_URL" -o "$OUTPUT_FILE" --progress-bar

if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
    echo "✅ Video descargado exitosamente: $OUTPUT_FILE"
    echo "   Tamaño: $FILE_SIZE"
    echo ""
    echo "Para probar el análisis, ejecuta:"
    echo "  python3 scripts/test-video-analysis.py $OUTPUT_FILE"
else
    echo "❌ No se pudo descargar el video automáticamente."
    echo ""
    echo "Por favor, descarga manualmente un video de swing de béisbol desde:"
    echo "  https://www.pexels.com/es-es/video/bate-de-beisbol-rompiendose-en-camara-lenta-durante-un-swing-33930470/"
    echo ""
    echo "O usa cualquier video de swing de béisbol que tengas."
fi

