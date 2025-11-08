#!/usr/bin/env python3
"""
Script para verificar qué se está detectando en el análisis de video
"""
import sys
import os
import requests
import json
from pathlib import Path

POSE_SERVICE_URL = os.getenv('POSE_SERVICE_URL', 'http://localhost:5003')
API_ENDPOINT = f'{POSE_SERVICE_URL}/api/pose/analyze-video'

def check_video_analysis(video_path: str):
    """Analiza un video y muestra detalles de qué se detectó"""
    if not os.path.exists(video_path):
        print(f"❌ Error: El archivo {video_path} no existe")
        return
    
    print(f"📹 Analizando: {video_path}")
    print(f"🔗 Endpoint: {API_ENDPOINT}\n")
    
    with open(video_path, 'rb') as video_file:
        files = {'video': video_file}
        data = {
            'processingMode': 'full',
            'sampleRate': '1',
            'maxFrames': '100',
            'enableYOLO': 'true',
            'yoloConfidence': '0.5'
        }
        
        headers = {
            'X-Internal-Request': 'true',
            'X-User-Id': 'test_user'
        }
        
        try:
            response = requests.post(API_ENDPOINT, files=files, data=data, headers=headers, timeout=300)
            
            if response.status_code == 200:
                result = response.json()
                
                print("=" * 60)
                print("📊 RESUMEN DE DETECCIONES")
                print("=" * 60)
                
                # Contar frames con detecciones
                frames_data = result.get('frames', [])
                total_frames = len(frames_data)
                
                bat_detections = sum(1 for f in frames_data if f.get('bat_angle') is not None)
                ball_detections = sum(1 for f in frames_data if f.get('ball') is not None)
                pose_detections = sum(1 for f in frames_data if f.get('pose_landmarks') is not None)
                
                print(f"\n📹 Total de frames procesados: {total_frames}")
                print(f"🏏 Frames con bate detectado: {bat_detections} ({bat_detections*100/total_frames:.1f}%)")
                print(f"⚾ Frames con pelota detectada: {ball_detections} ({ball_detections*100/total_frames:.1f}%)")
                print(f"👤 Frames con pose detectada: {pose_detections} ({pose_detections*100/total_frames:.1f}%)")
                
                # Métricas
                metrics = result.get('metrics', {})
                print(f"\n📈 Métricas:")
                print(f"   Velocidad angular: {metrics.get('batAngularVelocity', 'N/A')}°/s")
                print(f"   Velocidad lineal: {metrics.get('batLinearSpeedMph', 'N/A')} mph")
                print(f"   Frame de contacto: {result.get('contactFrame', 'N/A')}")
                
                # Tracking quality
                tracking = result.get('trackingQuality', {})
                if tracking:
                    print(f"\n🎯 Calidad de Tracking:")
                    print(f"   General: {tracking.get('overallScore', 0)*100:.1f}%")
                    print(f"   Persona: {tracking.get('personTrackingRatio', 0)*100:.1f}%")
                    print(f"   Bate: {tracking.get('batTrackingRatio', 0)*100:.1f}%")
                    print(f"   Pelota: {tracking.get('ballTrackingRatio', 0)*100:.1f}%")
                
                # Errores de forma
                form_errors = result.get('formErrors', {})
                if form_errors:
                    errors = form_errors.get('errors', []) if isinstance(form_errors, dict) else form_errors
                    if errors:
                        print(f"\n⚠️  Errores de forma detectados: {len(errors)}")
                        for err in errors[:5]:
                            print(f"   - {err.get('type', err.get('error', 'Unknown'))}")
                
                print("\n" + "=" * 60)
                
                # Recomendaciones
                if bat_detections < total_frames * 0.3:
                    print("\n💡 RECOMENDACIÓN:")
                    print("   El bate se detecta en menos del 30% de los frames.")
                    print("   Posibles causas:")
                    print("   - El video no muestra claramente el bate")
                    print("   - El bate está fuera del frame")
                    print("   - La iluminación es insuficiente")
                    print("   - El video necesita mejor calidad/resolución")
                
            else:
                print(f"❌ Error: {response.status_code}")
                print(response.text)
                
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Uso: python3 scripts/check-analysis-details.py <ruta_al_video>")
        sys.exit(1)
    
    check_video_analysis(sys.argv[1])

