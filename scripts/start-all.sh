#!/bin/bash
# Start All Services Script for Unix/Linux/Mac
# Starts all backend services and frontend

echo "🚀 Starting all services..."
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Function to start a service in a new terminal
start_service() {
    local service_name=$1
    local command=$2
    local port=$3
    
    echo "📡 Starting $service_name (Port $port)..."
    
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal --tab --title="$service_name" -- bash -c "cd '$PROJECT_ROOT'; echo '$service_name - Port $port'; $command; exec bash"
    elif command -v osascript &> /dev/null; then
        # macOS
        osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_ROOT'; echo '$service_name - Port $port'; $command\""
    elif command -v xterm &> /dev/null; then
        xterm -T "$service_name" -e "cd '$PROJECT_ROOT'; echo '$service_name - Port $port'; $command; exec bash" &
    else
        echo "⚠️  Could not open new terminal. Run manually: $command"
    fi
    
    sleep 2
}

# Start Backend Gateway (Port 3001)
start_service "Backend Gateway" "npm run dev:gateway" "3001"

# Start Pose Detection Service (Port 5000)
start_service "Pose Detection Service" "npm run dev:pose" "5000"

# Start Drill Recommender (Port 5001)
start_service "Drill Recommender" "npm run dev:drills" "5001"

# Start Blast Connector (Port 5002)
start_service "Blast Connector" "npm run dev:blast" "5002"

# Start Frontend (Port 3000)
start_service "Next.js Frontend" "npm run dev" "3000"

echo ""
echo "✅ All services starting in separate terminals!"
echo ""
echo "Services:"
echo "  • Backend Gateway:     http://localhost:3001"
echo "  • Pose Detection:       http://localhost:5000"
echo "  • Drill Recommender:    http://localhost:5001"
echo "  • Blast Connector:      http://localhost:5002"
echo "  • Frontend:             http://localhost:3000"
echo ""
echo "Press Ctrl+C in each terminal to stop the services."

