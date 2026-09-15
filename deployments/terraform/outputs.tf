output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = aws_eks_cluster.pulsewatch.name
}

output "cluster_endpoint" {
  description = "Endpoint URL for the EKS cluster API server"
  value       = aws_eks_cluster.pulsewatch.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = aws_eks_cluster.pulsewatch.certificate_authority[0].data
  sensitive   = true
}

output "vpc_id" {
  description = "ID of the VPC created for PulseWatch"
  value       = aws_vpc.pulsewatch_vpc.id
}

output "configure_kubectl_command" {
  description = "Command to configure kubectl context for the newly provisioned cluster"
  value       = "aws eks --region ${var.aws_region} update-kubeconfig --name ${aws_eks_cluster.pulsewatch.name}"
}
