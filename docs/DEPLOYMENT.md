# FlowDesk Docker 部署指南

## 一、服务器准备工作

### 1. 端口检查

确保以下端口未被占用：

```bash
# 检查端口占用
netstat -tlnp | grep 5173
netstat -tlnp | grep 8001
```

如果被占用，修改 `docker-compose.yml` 中的端口映射。

### 2. 安装 Docker

```bash
# Ubuntu/Debian
apt update
apt install docker.io docker-compose

# CentOS
yum install docker docker-compose

# 启动 Docker
systemctl start docker
systemctl enable docker
```

### 3. 防火墙配置

```bash
# Ubuntu (ufw)
ufw allow 5173/tcp

# CentOS (firewalld)
firewall-cmd --add-port=5173/tcp --permanent
firewall-cmd --reload
```

---

## 二、MySQL 数据库准备

### 1. 创建数据库

```bash
mysql -u root -p
```

```sql
CREATE DATABASE flowdesk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 如果 MySQL 用户需要授权远程访问（Docker 容器访问）
GRANT ALL PRIVILEGES ON flowdesk.* TO '你的用户名'@'%' IDENTIFIED BY '你的密码';
FLUSH PRIVILEGES;
```

### 2. 确认 MySQL 配置

检查 MySQL 是否允许远程连接：

```bash
# 查看 MySQL 配置文件
cat /etc/mysql/mysql.conf.d/mysqld.cnf | grep bind-address

# 如果是 bind-address = 127.0.0.1，需要改为：
# bind-address = 0.0.0.0
# 或添加 Docker 网段 IP
```

---

## 三、必须配置的文件

### 1. `backend/.env` （最重要）

复制并修改：

```bash
cd backend
cp .env.example .env
vim .env
```

**配置模板：**

```env
# 安全密钥（必须修改）
DJANGO_SECRET_KEY=S3d8WAl0nhWZNOimPO2B5rvtwhv_YsNdTKC-p3hYEo0SS78_yu7cZ4LViy0evdaO9Ko

# 生产环境关闭调试
DJANGO_DEBUG=false

# 允许访问的主机（必须包含服务器 IP）
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100,你的公网IP

# CORS 允许的前端来源（必须包含前端访问地址）
CORS_ALLOWED_ORIGINS=http://192.168.1.100:5173,http://你的公网IP:5173

# MySQL 连接配置
MYSQL_DATABASE=flowdesk
MYSQL_USER=你的MySQL用户名
MYSQL_PASSWORD=你的MySQL密码

# Docker 访问宿主机 MySQL 使用此地址
MYSQL_HOST=host.docker.internal

# 或直接使用宿主机 IP
# MYSQL_HOST=192.168.1.100

MYSQL_PORT=3306
```

**生成安全密钥：**

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

### 2. `docker-compose.yml` （可选修改）

如果需要修改端口，编辑此文件：

```yaml
services:
  backend:
    ports:
      - "8001:8001"  # 改为其他端口如 "9001:8001"
  frontend:
    ports:
      - "5173:5173"  # 改为其他端口如 "80:5173"
```

---

## 四、部署命令

```bash
# 克隆代码
git clone <仓库地址> /opt/flowdesk
cd /opt/flowdesk

# 配置环境变量
cd backend
cp .env.example .env
vim .env  # 按上述模板修改

# 返回项目根目录
cd /opt/flowdesk

# 构建镜像
docker-compose build

# 启动容器
docker-compose up -d

# 查看容器状态
docker-compose ps

# 查看日志（排查问题）
docker-compose logs -f
```

---

## 五、初始化数据库

首次部署需要执行：

```bash
# 数据库迁移
docker-compose exec backend python manage.py migrate

# 创建演示数据（可选）
docker-compose exec backend python manage.py seed_demo

# 创建管理员账号
docker-compose exec backend python manage.py createsuperuser
```

---

## 六、验证部署

### 1. 检查容器状态

```bash
docker-compose ps
# 应显示两个容器都是 Up 状态
```

### 2. 检查 API 健康

```bash
curl http://localhost:5173/api/health/
# 应返回 {"status": "ok"}
```

### 3. 浏览器访问

- 前端页面：`http://服务器IP:5173`
- 任务管理：`http://服务器IP:5173/app`

### 4. 登录测试

使用演示账号：`demo` / `demo123456`

---

## 七、常见问题排查

### 问题 1：前端无法访问后端 API

**症状**：登录失败，页面空白，Network 显示 `/api` 请求失败

**排查**：

```bash
# 检查后端容器日志
docker-compose logs backend

# 检查 CORS 配置
cat backend/.env | grep CORS_ALLOWED_ORIGINS
# 确保包含前端访问地址
```

### 问题 2：MySQL 连接失败

**症状**：后端日志显示数据库连接错误

**排查**：

```bash
# 检查 MySQL 连接配置
cat backend/.env | grep MYSQL

# 测试从容器连接 MySQL
docker-compose exec backend python -c "
import pymysql
conn = pymysql.connect(host='host.docker.internal', user='你的用户', password='你的密码', database='flowdesk')
print('连接成功')
"

# 如果 host.docker.internal 不工作，改为宿主机实际 IP
vim backend/.env
# MYSQL_HOST=192.168.1.100  # 宿主机 IP
```

### 问题 3：端口被占用

**症状**：docker-compose up 报端口冲突

**解决**：

```bash
# 查看占用端口的进程
netstat -tlnp | grep 5173

# 停止占用进程或修改 docker-compose.yml 端口
```

### 问题 4：静态文件 404

**症状**：前端页面空白，JS/CSS 文件加载失败

**排查**：

```bash
# 检查前端容器是否正常构建
docker-compose logs frontend

# 重新构建前端
docker-compose build frontend --no-cache
docker-compose up -d frontend
```

---

## 八、日常运维命令

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 重启
docker-compose restart

# 查看日志
docker-compose logs -f
docker-compose logs -f backend  # 只看后端
docker-compose logs -f frontend # 只看前端

# 重新构建并启动（代码更新后）
docker-compose up -d --build

# 进入容器调试
docker-compose exec backend bash
docker-compose exec frontend sh

# 查看容器状态
docker-compose ps
```

---

## 九、更新部署

代码更新后：

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build

# 如果有数据库变更，执行迁移
docker-compose exec backend python manage.py migrate
```

---

## 十、配置文件位置总结

| 配置项 | 文件位置 | 必须配置 |
|--------|----------|----------|
| Django 密钥、数据库连接 | `backend/.env` | **是** |
| 端口映射 | `docker-compose.yml` | 可选（默认 5173/8001） |
| nginx 反向代理 | `nginx.conf` | 无需修改 |
| 防火墙端口 | 系统配置 | **是**（开放 5173） |
| MySQL 数据库 | MySQL 服务 | **是**（创建 flowdesk 数据库） |