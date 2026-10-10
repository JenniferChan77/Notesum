# The VPC and its subnets.
#
#   Public subnets  (10.0.0.0/24, 10.0.1.0/24)
#     -> the load balancer and the ECS containers (web + worker).
#        They reach the internet (Supabase, OpenAI, ECR) through the
#        internet gateway, so no NAT gateway (~$30/month) is needed.
#        Security groups still block all unwanted inbound traffic.
#
#   Private subnets (10.0.10.0/24, 10.0.11.0/24)
#     -> ElastiCache (Redis). No route to the internet at all;
#        only reachable from inside the VPC.

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true # needed so containers can resolve the ElastiCache endpoint

  tags = { Name = "${var.project_name}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project_name}-igw" }
}

# ---- Public subnets ----

resource "aws_subnet" "public" {
  count = var.az_count

  vpc_id            = aws_vpc.main.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index) # 10.0.0.0/24, 10.0.1.0/24

  tags = { Name = "${var.project_name}-public-${local.azs[count.index]}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project_name}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count = var.az_count

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---- Private subnets ----
# No route table is attached, so they use the VPC's main route table,
# which only routes traffic inside the VPC.

resource "aws_subnet" "private" {
  count = var.az_count

  vpc_id            = aws_vpc.main.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10) # 10.0.10.0/24, 10.0.11.0/24

  tags = { Name = "${var.project_name}-private-${local.azs[count.index]}" }
}
