# Which Terraform and AWS provider versions this project uses,
# and the region/profile to deploy into.

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # State is stored locally (terraform.tfstate) for now.
  # Later we can move it to an S3 bucket so GitHub Actions can use it too.
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  # Every resource gets these tags, so you can find (and cost) everything
  # belonging to Notesum in the AWS console and in Cost Explorer.
  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}
