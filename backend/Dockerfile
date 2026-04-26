FROM python:3.11-slim

WORKDIR /app

# 安装依赖（使用清华镜像加速）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn -i https://pypi.tuna.tsinghua.edu.cn/simple

# 复制项目代码
COPY . .

EXPOSE 8001

CMD ["gunicorn", "--bind", "0.0.0.0:8001", "--workers", "3", "flowdesk.wsgi:application"]