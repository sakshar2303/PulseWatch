variable "aws_region" {
  description = "AWS region for PulseWatch infrastructure deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name (e.g. staging, prod)"
  type        = string
  default     = "production"
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "pulsewatch-cluster"
}

variable "vpc_cidr" {
  description = "CIDR block for the PulseWatch VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "node_instance_types" {
  description = "EC2 instance types for EKS managed node group"
  type        = list(string)
  default     = ["t3.large"]
}

variable "min_nodes" {
  description = "Minimum number of worker nodes in EKS node group"
  type        = number
  default     = 2
}

variable "max_nodes" {
  description = "Maximum number of worker nodes in EKS node group"
  type        = number
  default     = 6
}

variable "desired_nodes" {
  description = "Desired number of worker nodes in EKS node group"
  type        = number
  default     = 3
}
