# FlowDesk

FlowDesk 是一个 React + Django + MySQL 的团队任务流转系统。官网保留在 `/`，真实任务系统在 `/app`。

## 本地启动

### 1. 后端

```bash
cd backend
python3 -m pip install -r requirements.txt
cp .env.example .env
```

编辑 `backend/.env`，填写你的 MySQL 连接信息，并先创建数据库：

```sql
CREATE DATABASE flowdesk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

然后执行迁移和演示数据：

```bash
python3 manage.py migrate
python3 manage.py seed_demo
python3 manage.py runserver 8000
```

演示账号：

```text
demo / demo123456
```

### 2. 前端

```bash
npm install
npm run dev -- --port 5173
```

访问：

- 官网：http://localhost:5173/
- 任务系统：http://localhost:5173/app

## 功能说明

- 登录用户只能看到与自己相关的任务：创建人、当前负责人、参与人、待确认人、评论人、流转操作人。
- 任务创建、状态变更、转派、归档、确认完成都会写入流转事件。
- 详情抽屉展示任务属性、操作按钮、描述、评论、流转时间线和耗时分析。
- 前端支持 `system / light / dark` 主题，默认跟随系统，选择会保存到 `localStorage`。
