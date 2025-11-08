#!/usr/bin/env python3
"""
Script para probar el análisis de video del servicio de pose detection
Uso: python scripts/test-video-analysis.py <ruta_al_video>
"""
import sys
import os
import requests
import json
from pathlib import Path

# Configuración
# Por defecto intenta usar el servicio directo (puerto 5000) con header interno
# Si falla, puedes usar el gateway configurando GATEWAY_URL
POSE_SERVICE_URL = os.getenv('POSE_SERVICE_URL', 'http://localhost:5003')
GATEWAY_URL = os.getenv('GATEWAY_URL', 'http://localhost:3001')
USE_GATEWAY = os.getenv('USE_GATEWAY', 'false').lower() == 'true'

if USE_GATEWAY:
    API_ENDPOINT = f'{GATEWAY_URL}/api/pose/analyze-video'
else:
    API_ENDPOINT = f'{POSE_SERVICE_URL}/api/pose/analyze-video'

def analyze_video(video_path: str, **kwargs):
    """
    Analiza un video y devuelve los resultados
    
    Args:
        video_path: Ruta al archivo de video
        **kwargs: Parámetros opcionales:
            - processingMode: 'full', 'fast', 'streaming' (default: 'full')
            - sampleRate: Tasa de muestreo de frames (default: 1)
            - maxFrames: Máximo número de frames a procesar (default: None)
            - enableYOLO: Habilitar detección YOLO (default: True)
            - yoloConfidence: Confianza mínima para YOLO (default: 0.5)
            - calibration: Altura del batter en metros (default: None)
    """
    if not os.path.exists(video_path):
        print(f"❌ Error: El archivo {video_path} no existe")
        return None
    
    print(f"📹 Analizando video: {video_path}")
    print(f"🔗 Endpoint: {API_ENDPOINT}")
    print()
    
    # Preparar el archivo
    with open(video_path, 'rb') as video_file:
        files = {'video': (os.path.basename(video_path), video_file, 'video/mp4')}
        
        # Preparar parámetros
        data = {
            'processingMode': kwargs.get('processingMode', 'full'),
            'sampleRate': str(kwargs.get('sampleRate', 1)),
            'enableYOLO': str(kwargs.get('enableYOLO', True)).lower(),
            'yoloConfidence': str(kwargs.get('yoloConfidence', 0.5)),
        }
        
        if kwargs.get('maxFrames'):
            data['maxFrames'] = str(kwargs['maxFrames'])
        
        if kwargs.get('calibration'):
            data['calibration'] = str(kwargs['calibration'])
        
        print("📤 Enviando video al servicio...")
        print(f"   Parámetros: {json.dumps(data, indent=2)}")
        print()
        
        try:
            # Preparar headers
            headers = {}
            if not USE_GATEWAY:
                # Para servicio directo, usar header interno para que acepte la petición
                # El servicio acepta peticiones de localhost con este header
                headers['X-Internal-Request'] = 'true'
                headers['X-User-Id'] = 'test_user'
            
            # Enviar request
            response = requests.post(
                API_ENDPOINT,
                files=files,
                data=data,
                headers=headers,
                timeout=300  # 5 minutos timeout
            )
            
            print(f"📥 Respuesta recibida (Status: {response.status_code})")
            print()
            
            if response.status_code == 200:
                result = response.json()
                
                # Mostrar resumen
                print("=" * 60)
                print("✅ ANÁLISIS COMPLETADO")
                print("=" * 60)
                
                if result.get('ok'):
                    # Información del video
                    video_info = result.get('videoInfo', {})
                    print(f"\n📹 Información del Video:")
                    print(f"   - FPS: {video_info.get('fps', 'N/A')}")
                    print(f"   - Frames: {video_info.get('frameCount', 'N/A')}")
                    print(f"   - Duración: {video_info.get('duration', 'N/A'):.2f}s")
                    print(f"   - Resolución: {video_info.get('width', 'N/A')}x{video_info.get('height', 'N/A')}")
                    
                    # Frame de contacto
                    contact_frame = result.get('contactFrame')
                    if contact_frame is not None:
                        print(f"\n⚾ Frame de Contacto: {contact_frame}")
                        contact = result.get('contact', {})
                        if contact:
                            print(f"   - Detectado: {'Sí' if contact.get('detected') else 'No'}")
                            if contact.get('detected'):
                                print(f"   - Confianza: {contact.get('confidence', 0):.2%}")
                    
                    # Métricas
                    metrics = result.get('metrics', {})
                    if metrics:
                        print(f"\n📊 Métricas del Swing:")
                        if 'batSpeed' in metrics:
                            print(f"   - Velocidad del Bate: {metrics['batSpeed']:.2f} m/s")
                        if 'swingAngle' in metrics:
                            print(f"   - Ángulo del Swing: {metrics['swingAngle']:.2f}°")
                        if 'contactAngle' in metrics:
                            print(f"   - Ángulo de Contacto: {metrics['contactAngle']:.2f}°")
                    
                    # Fases del swing
                    swing_phases = result.get('swingPhases')
                    if swing_phases:
                        print(f"\n🔄 Fases del Swing:")
                        if isinstance(swing_phases, list):
                            for phase in swing_phases:
                                if isinstance(phase, dict):
                                    phase_name = phase.get('phase', 'Unknown')
                                    start_frame = phase.get('startFrame', 0)
                                    end_frame = phase.get('endFrame', 0)
                                    print(f"   - {phase_name}: frames {start_frame}-{end_frame}")
                                else:
                                    print(f"   - {phase}")
                        elif isinstance(swing_phases, dict) and 'phases' in swing_phases:
                            for phase in swing_phases.get('phases', []):
                                if isinstance(phase, dict):
                                    phase_name = phase.get('phase', 'Unknown')
                                    start_frame = phase.get('startFrame', 0)
                                    end_frame = phase.get('endFrame', 0)
                                    print(f"   - {phase_name}: frames {start_frame}-{end_frame}")
                        else:
                            print(f"   - {swing_phases}")
                    
                    # Biomecánica
                    biomechanics = result.get('biomechanics')
                    if biomechanics:
                        print(f"\n🏃 Análisis Biomecánico:")
                        if 'maxHipRotation' in biomechanics:
                            print(f"   - Rotación Máxima de Cadera: {biomechanics['maxHipRotation']:.2f}°")
                        if 'maxShoulderRotation' in biomechanics:
                            print(f"   - Rotación Máxima de Hombro: {biomechanics['maxShoulderRotation']:.2f}°")
                        if 'weightTransfer' in biomechanics:
                            print(f"   - Transferencia de Peso: {biomechanics['weightTransfer']:.2f}%")
                    
                    # Errores de forma
                    form_errors = result.get('formErrors')
                    if form_errors:
                        if isinstance(form_errors, list):
                            print(f"\n⚠️  Errores de Forma Detectados: {len(form_errors)}")
                            for error in form_errors[:5]:  # Mostrar solo los primeros 5
                                if isinstance(error, dict):
                                    error_type = error.get('type', 'Unknown')
                                    severity = error.get('severity', 'medium')
                                    print(f"   - {error_type} ({severity})")
                                else:
                                    print(f"   - {error}")
                        elif isinstance(form_errors, dict):
                            error_count = len(form_errors) if hasattr(form_errors, '__len__') else 0
                            print(f"\n⚠️  Errores de Forma Detectados: {error_count}")
                            for key, value in list(form_errors.items())[:5]:
                                print(f"   - {key}: {value}")
                    
                    # Tracking
                    tracking_quality = result.get('trackingQuality')
                    if tracking_quality:
                        print(f"\n🎯 Calidad de Tracking:")
                        print(f"   - Score General: {tracking_quality.get('overallScore', 0):.2%}")
                        print(f"   - Persona: {tracking_quality.get('personTrackingRatio', 0):.2%}")
                        print(f"   - Bate: {tracking_quality.get('batTrackingRatio', 0):.2%}")
                        print(f"   - Pelota: {tracking_quality.get('ballTrackingRatio', 0):.2%}")
                    
                    print("\n" + "=" * 60)
                    print("💾 Guardando resultados completos en 'video-analysis-result.json'...")
                    
                    # Guardar resultados completos
                    with open('video-analysis-result.json', 'w', encoding='utf-8') as f:
                        json.dump(result, f, indent=2, ensure_ascii=False)
                    
                    print("✅ Resultados guardados exitosamente!")
                    return result
                else:
                    print("❌ Error en el análisis:")
                    print(f"   {result.get('error', 'Error desconocido')}")
                    return None
            elif response.status_code == 403:
                print("❌ Error: El servicio rechazó la petición (403 Forbidden)")
                print()
                print("💡 Solución: El servicio necesita estar en modo DEMO para aceptar peticiones directas.")
                print()
                print("   Opción 1: Reiniciar el servicio con modo demo:")
                print("   npm run dev:pose:demo")
                print()
                print("   Opción 2: Usar el backend gateway (requiere autenticación):")
                print("   USE_GATEWAY=true python scripts/test-video-analysis.py <video>")
                print()
                print("   Opción 3: Activar modo demo en el servicio actual:")
                print("   export DEMO_MODE=true")
                print("   # Luego reinicia el servicio")
                return None
            else:
                print(f"❌ Error HTTP {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   {error_data.get('error', 'Error desconocido')}")
                    if 'message' in error_data:
                        print(f"   {error_data['message']}")
                except:
                    print(f"   {response.text}")
                return None
                
        except requests.exceptions.Timeout:
            print("❌ Error: Timeout - El análisis tomó más de 5 minutos")
            return None
        except requests.exceptions.ConnectionError:
            print(f"❌ Error: No se pudo conectar al servicio en {POSE_SERVICE_URL}")
            print("   Asegúrate de que el servicio esté corriendo:")
            print("   - Verifica que el servicio de pose detection esté activo")
            print("   - Verifica el puerto (por defecto: 5000)")
            return None
        except Exception as e:
            print(f"❌ Error inesperado: {e}")
            import traceback
            traceback.print_exc()
            return None

def main():
    if len(sys.argv) < 2:
        print("Uso: python scripts/test-video-analysis.py <ruta_al_video> [opciones]")
        print("\nOpciones:")
        print("  --processing-mode <full|fast|streaming>  Modo de procesamiento (default: full)")
        print("  --sample-rate <número>                    Tasa de muestreo (default: 1)")
        print("  --max-frames <número>                     Máximo de frames a procesar")
        print("  --no-yolo                                Deshabilitar YOLO")
        print("  --yolo-confidence <0.0-1.0>              Confianza YOLO (default: 0.5)")
        print("  --calibration <altura_metros>             Altura del batter en metros")
        print("\nEjemplo:")
        print("  python scripts/test-video-analysis.py video.mp4 --max-frames 100")
        sys.exit(1)
    
    video_path = sys.argv[1]
    
    # Parsear argumentos opcionales
    kwargs = {}
    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == '--processing-mode' and i + 1 < len(sys.argv):
            kwargs['processingMode'] = sys.argv[i + 1]
            i += 2
        elif arg == '--sample-rate' and i + 1 < len(sys.argv):
            kwargs['sampleRate'] = int(sys.argv[i + 1])
            i += 2
        elif arg == '--max-frames' and i + 1 < len(sys.argv):
            kwargs['maxFrames'] = int(sys.argv[i + 1])
            i += 2
        elif arg == '--no-yolo':
            kwargs['enableYOLO'] = False
            i += 1
        elif arg == '--yolo-confidence' and i + 1 < len(sys.argv):
            kwargs['yoloConfidence'] = float(sys.argv[i + 1])
            i += 2
        elif arg == '--calibration' and i + 1 < len(sys.argv):
            kwargs['calibration'] = float(sys.argv[i + 1])
            i += 2
        else:
            i += 1
    
    result = analyze_video(video_path, **kwargs)
    
    if result:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()

