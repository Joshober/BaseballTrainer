# Cambios para Main - Pose Detection Service

## Resumen

Se han realizado cambios para asegurar que el servicio de Pose Detection funcione correctamente con MediaPipe en el branch main.

## Cambios Realizados

### 1. **package.json** - Script de inicio actualizado
- **Archivo:** `package.json`
- **Cambio:** El script `dev:pose` ahora intenta usar Python 3.10 primero (compatible con MediaPipe)
- **Línea:** 13
- **Antes:** `"dev:pose": "cd pose-detection-service && python app.py"`
- **Después:** `"dev:pose": "cd pose-detection-service && PYTHON_BACKEND_PORT=5005 python3.10 app.py || cd pose-detection-service && PYTHON_BACKEND_PORT=5005 python app.py"`

### 2. **scripts/start-all.sh** - Script de inicio actualizado
- **Archivo:** `scripts/start-all.sh`
- **Cambio:** Actualizado para usar Python 3.10 y puerto 5005
- **Línea:** 37
- **Antes:** `start_service "Pose Detection Service" "PYTHON_BACKEND_PORT=5003 npm run dev:pose" "5003"`
- **Después:** `start_service "Pose Detection Service" "PYTHON_BACKEND_PORT=5005 python3.10 pose-detection-service/app.py || PYTHON_BACKEND_PORT=5005 python pose-detection-service/app.py" "5005"`

### 3. **POSE_DETECTION_SETUP.md** - Documentación nueva
- **Archivo:** `POSE_DETECTION_SETUP.md` (nuevo)
- **Contenido:** Guía completa de instalación y configuración del servicio de Pose Detection

## Requisitos

### Python Version
- **Requerido:** Python 3.10 o 3.11
- **No compatible:** Python 3.13 (MediaPipe no está disponible)

### MediaPipe Installation
```bash
cd pose-detection-service
python3.10 -m pip install mediapipe==0.10.8
```

### Port Configuration
- **Puerto:** 5005 (configurado en `lib/utils/config.ts`)
- **URL:** `http://localhost:5005`

## Verificación

1. **Verificar MediaPipe:**
   ```bash
   python3.10 -c "import mediapipe; print('✅ MediaPipe OK')"
   ```

2. **Iniciar servicio:**
   ```bash
   cd pose-detection-service
   PYTHON_BACKEND_PORT=5005 python3.10 app.py
   ```

3. **Verificar servicio:**
   ```bash
   curl http://localhost:5005/health
   ```

## Para Aplicar en Main

1. **Hacer commit de los cambios:**
   ```bash
   git add package.json scripts/start-all.sh POSE_DETECTION_SETUP.md
   git commit -m "fix: Update pose detection service to use Python 3.10 and port 5005"
   ```

2. **Merge a main:**
   ```bash
   git checkout main
   git merge Alvaro
   ```

3. **Push a main:**
   ```bash
   git push origin main
   ```

## Notas Importantes

- El servicio ahora usa Python 3.10 por defecto (compatible con MediaPipe)
- El puerto cambió de 5003 a 5005 para coincidir con la configuración en `config.ts`
- Si Python 3.10 no está disponible, el script intentará usar el Python por defecto
- MediaPipe debe estar instalado en Python 3.10 para que funcione correctamente

