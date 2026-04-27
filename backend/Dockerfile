FROM python:3.11-slim

WORKDIR /app

# 配置 pip 使用阿里云镜像
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt daphne

# 复制项目代码
COPY . .

EXPOSE 8001

# 使用 Daphne (ASGI) 支持 WebSocket
CMD ["daphne", "--bind", "0.0.0.0", "--port", "8001", "flowdesk.asgi:application"]