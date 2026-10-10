# Values printed after `terraform apply`, and used by later steps.

output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "security_group_ids" {
  value = {
    alb    = aws_security_group.alb.id
    web    = aws_security_group.web.id
    worker = aws_security_group.worker.id
    redis  = aws_security_group.redis.id
  }
}
