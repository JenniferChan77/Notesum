# Security groups are firewalls attached to resources.
# Rules reference OTHER security groups rather than IP addresses,
# so access follows the service, wherever its containers happen to run.
#
#   internet --80/443--> alb --3000--> web --6379--> redis
#                                      worker --6379--^
#
# web and worker can make outbound calls (Supabase, OpenAI, ECR, CloudWatch).
# Nothing from the internet can reach web, worker or redis directly.

# ---- Load balancer: open to the internet on HTTP/HTTPS ----

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb"
  description = "Public load balancer"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${var.project_name}-alb" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from anywhere (will redirect to HTTPS)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from anywhere"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "alb_to_web" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward requests to the web containers"
  referenced_security_group_id = aws_security_group.web.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
}

# ---- Web (Next.js) containers: only the load balancer can reach them ----

resource "aws_security_group" "web" {
  name        = "${var.project_name}-web"
  description = "Next.js app containers"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${var.project_name}-web" }
}

resource "aws_vpc_security_group_ingress_rule" "web_from_alb" {
  security_group_id            = aws_security_group.web.id
  description                  = "App traffic from the load balancer only"
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
}

resource "aws_vpc_security_group_egress_rule" "web_all_out" {
  security_group_id = aws_security_group.web.id
  description       = "Outbound: Supabase, Redis, ECR, CloudWatch"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# ---- Worker containers: no inbound traffic at all ----

resource "aws_security_group" "worker" {
  name        = "${var.project_name}-worker"
  description = "Background worker containers (no inbound)"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${var.project_name}-worker" }
}

resource "aws_vpc_security_group_egress_rule" "worker_all_out" {
  security_group_id = aws_security_group.worker.id
  description       = "Outbound: Supabase, OpenAI, Redis, ECR, CloudWatch"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# ---- Redis (ElastiCache): only web and worker can reach it ----

resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis"
  description = "ElastiCache Redis, reachable from web and worker only"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${var.project_name}-redis" }
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_web" {
  security_group_id            = aws_security_group.redis.id
  description                  = "Redis from the web app (enqueues jobs)"
  referenced_security_group_id = aws_security_group.web.id
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_worker" {
  security_group_id            = aws_security_group.redis.id
  description                  = "Redis from the worker (processes jobs)"
  referenced_security_group_id = aws_security_group.worker.id
  ip_protocol                  = "tcp"
  from_port                    = 6379
  to_port                      = 6379
}
