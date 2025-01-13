#!/bin/bash

# Function to check if Python 3.11 is installed
check_python() {
    if ! command -v python3.11 &> /dev/null; then
        echo "Python 3.11 is required but not installed."
        echo "Please install Python 3.11 and try again."
        exit 1
    fi
}

# Function to create and activate virtual environment
setup_venv() {
    echo "Setting up Python virtual environment..."
    cd tts_server
    if [ ! -d "venv" ]; then
        python3.11 -m venv venv
    fi
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate
    cd ..
}

# Function to install Node.js dependencies
setup_node() {
    echo "Installing Node.js dependencies..."
    npm install
}

# Function to start both servers
start_servers() {
    echo "Starting TTS server..."
    cd tts_server
    source venv/bin/activate
    python tts_server.py > tts_server.log 2>&1 &
    cd ..
    
    echo "Starting Discord bot..."
    node index.js
}

# Main execution
echo "Starting setup..."
check_python
setup_node
setup_venv
start_servers