variable "project_name" {
  description = "Prefix used in resource names and tags"
  type        = string
  default     = "notesum"
}

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-north-1" # Stockholm: the only region this AWS account is allowed to use
}

variable "aws_profile" {
  description = "AWS CLI profile to use. Leave null to use the standard credential chain (AWS_PROFILE or exported AWS_* env vars), which is also what GitHub Actions will use."
  type        = string
  default     = null
}

variable "vpc_cidr" {
  description = "IP address range for the whole VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to spread subnets across (the load balancer needs at least 2)"
  type        = number
  default     = 2
}
