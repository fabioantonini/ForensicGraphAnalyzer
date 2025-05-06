#!/bin/bash

echo "Starting ChromaDB client with persistence..."

# Make sure the directory exists
mkdir -p chroma_data

# Execute the script that tests and initializes ChromaDB
python server/direct-chroma.py

# If the test was successful, we consider ChromaDB ready
if [ $? -eq 0 ]; then
  echo "ChromaDB client with persistence initialized successfully"
  touch chroma.pid
  echo "ChromaDB ready flag created at chroma.pid"
else
  echo "Failed to initialize ChromaDB client with persistence"
  exit 1
fi
