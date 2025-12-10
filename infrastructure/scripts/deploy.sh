#!/bin/bash
# JadeTrade Bot Engine Deployment Script
#
# Usage: ./deploy.sh [environment] [action]
#   environment: dev | staging | production
#   action: build | push | deploy | all
#
# Prerequisites:
#   - AWS CLI configured
#   - Docker installed
#   - Terraform installed

set -e

# Configuration
PROJECT_NAME="jadetrade"
AWS_REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${1:-production}"
ACTION="${2:-all}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-bot-engine"

log_info "=========================================="
log_info "JadeTrade Bot Engine Deployment"
log_info "=========================================="
log_info "Environment: ${ENVIRONMENT}"
log_info "Action: ${ACTION}"
log_info "AWS Region: ${AWS_REGION}"
log_info "ECR Repo: ${ECR_REPO}"
log_info "=========================================="

# Function: Build Docker image
build_image() {
    log_info "Building Docker image..."

    cd ../../bot-engine

    # Build image
    docker build -t ${PROJECT_NAME}-bot-engine:latest .

    # Tag for ECR
    docker tag ${PROJECT_NAME}-bot-engine:latest ${ECR_REPO}:latest
    docker tag ${PROJECT_NAME}-bot-engine:latest ${ECR_REPO}:$(git rev-parse --short HEAD)

    log_info "Docker image built successfully"
}

# Function: Push to ECR
push_image() {
    log_info "Pushing image to ECR..."

    # Login to ECR
    aws ecr get-login-password --region ${AWS_REGION} | \
        docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

    # Push images
    docker push ${ECR_REPO}:latest
    docker push ${ECR_REPO}:$(git rev-parse --short HEAD)

    log_info "Image pushed to ECR successfully"
}

# Function: Deploy with Terraform
deploy_terraform() {
    log_info "Deploying infrastructure with Terraform..."

    cd ../terraform

    # Initialize Terraform
    terraform init

    # Select workspace
    terraform workspace select ${ENVIRONMENT} || terraform workspace new ${ENVIRONMENT}

    # Plan
    terraform plan -var-file="${ENVIRONMENT}.tfvars" -out=tfplan

    # Apply
    read -p "Apply terraform plan? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        terraform apply tfplan
    else
        log_warn "Terraform apply cancelled"
        return 1
    fi

    log_info "Terraform deployment complete"
}

# Function: Update ECS service
update_ecs_service() {
    log_info "Updating ECS service..."

    CLUSTER_NAME="${PROJECT_NAME}-${ENVIRONMENT}"
    SERVICE_NAME="${PROJECT_NAME}-bot-engine"

    # Force new deployment
    aws ecs update-service \
        --cluster ${CLUSTER_NAME} \
        --service ${SERVICE_NAME} \
        --force-new-deployment \
        --region ${AWS_REGION}

    log_info "ECS service update initiated"

    # Wait for deployment to complete
    log_info "Waiting for deployment to complete..."
    aws ecs wait services-stable \
        --cluster ${CLUSTER_NAME} \
        --services ${SERVICE_NAME} \
        --region ${AWS_REGION}

    log_info "Deployment complete!"
}

# Function: Run health check
health_check() {
    log_info "Running health check..."

    # Get ALB DNS name from Terraform output
    ALB_DNS=$(terraform output -raw alb_dns_name 2>/dev/null || echo "")

    if [ -z "$ALB_DNS" ]; then
        log_warn "Could not get ALB DNS name"
        return 1
    fi

    # Wait for health check
    for i in {1..30}; do
        if curl -s -o /dev/null -w "%{http_code}" "https://${ALB_DNS}/health" | grep -q "200"; then
            log_info "Health check passed!"
            return 0
        fi
        log_info "Waiting for service to be healthy... (${i}/30)"
        sleep 10
    done

    log_error "Health check failed after 5 minutes"
    return 1
}

# Main execution
case ${ACTION} in
    build)
        build_image
        ;;
    push)
        push_image
        ;;
    deploy)
        deploy_terraform
        update_ecs_service
        health_check
        ;;
    all)
        build_image
        push_image
        deploy_terraform
        update_ecs_service
        health_check
        ;;
    *)
        log_error "Unknown action: ${ACTION}"
        echo "Usage: $0 [environment] [action]"
        echo "  environment: dev | staging | production"
        echo "  action: build | push | deploy | all"
        exit 1
        ;;
esac

log_info "=========================================="
log_info "Deployment completed successfully!"
log_info "=========================================="
