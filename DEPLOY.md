# EduConnect Deployment Guide

This guide covers how to deploy the EduConnect application using AWS Amplify, Docker and Kubernetes.

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Docker Desktop (for Docker and local Kubernetes deployments)
- AWS account with appropriate permissions
- Git repository (GitHub, GitLab, etc.) with the application code

## Environment Setup

1. Create a `.env` file based on the `.env.example` template
2. Fill in the required AWS credentials and configuration:

```
VITE_AWS_REGION=us-east-1
VITE_AWS_ACCESS_KEY_ID=your-access-key-id
VITE_AWS_SECRET_ACCESS_KEY=your-secret-access-key
VITE_AWS_ACCOUNT_ID=your-account-id

# For Amplify deployment
VITE_GITHUB_REPO_URL=https://github.com/your-username/educonnect
VITE_GITHUB_ACCESS_TOKEN=your-github-token
```

## Option 1: AWS Amplify Deployment

AWS Amplify provides a fully managed CI/CD and hosting service for modern web applications.

### Deploy with AWS Amplify

1. Ensure your AWS credentials are configured in the `.env` file
2. Run the deployment script:

```bash
npm run deploy:amplify
```

3. Follow the console output instructions to access your Amplify app
4. The script will create an Amplify app connected to your repository
5. Future pushes to your repository will trigger automatic builds and deployments

### AWS Amplify Free Tier

- AWS Amplify offers 1,000 build minutes per month in the free tier
- 5 GB of storage
- 15 GB of data transfer out per month

## Option 2: Docker Deployment

### Build and Run with Docker

1. Build the Docker image:

```bash
npm run docker:build
```

2. Run the Docker container:

```bash
npm run docker:run
```

3. Access the application at http://localhost:80

### Using Docker Compose

1. Run the application with Docker Compose:

```bash
npm run docker:compose
```

2. Access the application at http://localhost:80

## Option 3: Kubernetes Deployment

### Deploy to Local Kubernetes (Docker Desktop)

1. Make sure Kubernetes is enabled in Docker Desktop settings
2. Build the Docker image:

```bash
npm run docker:build
```

3. Apply the Kubernetes configuration:

```bash
kubectl apply -f kubernetes/deployment.yaml
```

4. Access the application through the LoadBalancer service:

```bash
kubectl get services
```

The application should be accessible at http://localhost:[PORT] where PORT is the mapped port from the LoadBalancer.

## AWS Infrastructure

The application uses several AWS services:

- DynamoDB for database
- S3 for file storage
- Cognito for authentication
- Rekognition for face analysis
- Lex for chatbot functionality
- Lambda for serverless functions
- API Gateway for API endpoints

These services are configured using the deployment scripts in the `src/scripts` directory.

## Troubleshooting

- **Docker issues**: Ensure Docker Desktop is running and you have sufficient permissions
- **AWS deployment errors**: Check your AWS credentials and permissions
- **Kubernetes errors**: Verify that Kubernetes is enabled in Docker Desktop

## Monitoring

- AWS CloudWatch is used for monitoring the application in AWS
- Docker logs can be viewed with `docker logs [container_id]`
- Kubernetes logs can be viewed with `kubectl logs [pod_name]` 