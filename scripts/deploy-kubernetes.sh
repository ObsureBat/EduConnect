#!/bin/bash

# Script to deploy EduConnect to a local Kubernetes cluster (Docker Desktop)
echo "EduConnect - Kubernetes Deployment"
echo "==================================="

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl is not installed."
    echo "Please install kubectl first: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

# Check if Kubernetes is running
if ! kubectl cluster-info &> /dev/null; then
    echo "Error: Kubernetes cluster is not accessible."
    echo "Please make sure Kubernetes is enabled in Docker Desktop settings."
    exit 1
fi

# Ensure the kubernetes directory exists
if [ ! -d "kubernetes" ]; then
    echo "Error: kubernetes directory not found."
    echo "Please run this script from the project root directory."
    exit 1
fi

# Build the Docker image
echo "Building Docker image..."
docker build -t educonnect:latest .

# Check if the build was successful
if [ $? -ne 0 ]; then
    echo "Error: Docker build failed."
    exit 1
fi

# Apply the Kubernetes deployment
echo "Deploying to Kubernetes..."
kubectl apply -f kubernetes/deployment.yaml

# Check if deployment was successful
if [ $? -ne 0 ]; then
    echo "Error: Kubernetes deployment failed."
    exit 1
fi

# Wait for the deployment to be ready
echo "Waiting for deployment to be ready..."
kubectl rollout status deployment/educonnect

# Get the service information
echo "Getting service information..."
kubectl get service educonnect

echo "EduConnect has been deployed to your local Kubernetes cluster."
echo "The application should be accessible at http://localhost:[PORT]"
echo "To check the assigned port, run: kubectl get service educonnect"
echo ""
echo "To view logs, run: kubectl logs deployment/educonnect"
echo "To delete the deployment, run: kubectl delete -f kubernetes/deployment.yaml" 