# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlowDesk is a team task handoff system built with React + Django + MySQL. The landing page is at `/`, and the task management application is at `/app`.

## Development Commands

### Backend (Django)
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # Configure MySQL connection
python manage.py migrate
python manage.py seed_demo  # Generate demo data
python manage.py runserver 8000
```

Demo account: `demo` / `demo123456`

### Frontend (React + Vite)
```bash
npm install
npm run dev -- --port 5173
```

Access: http://localhost:5173/ (landing) or http://localhost:5173/app (task system)

### Running Tests
```bash
cd backend
python manage.py test
```

## Architecture

### Backend (Django REST Framework)
- **Authentication**: Token-based via `rest_framework.authtoken`
- **Core models** (`tasks/models.py`):
  - `Task`: Main entity with status, priority, owner, confirmer, participants, department
  - `FlowEvent`: Tracks all task transitions (status changes, owner transfers, department changes)
  - `TaskComment`: Task comments
  - `Department`: Organization units
- **Task visibility** (`tasks/services.py`): `visible_tasks_for(user)` returns only tasks related to the user (creator, owner, confirmer, participant, commenter, actor in events). All API views must start from this queryset.
- **Write permissions**: `writable_task_for(user, task)` restricts modifications to creator, owner, confirmer, or participants
- **Duration analysis**: `duration_analysis(task)` aggregates time spent per owner, department, and status

### Frontend (React)
- **Entry**: `src/main.jsx` with `ThemeProvider`
- **Components**:
  - `src/App.jsx`: Landing page with marketing content
  - `src/TaskApp.jsx`: Task management interface (Kanban, detail drawer, dashboard)
- **API client**: `src/api.js` handles authentication token and request/response
- **Theme**: `src/theme.jsx` provides system/light/dark themes persisted in localStorage
- **Vite proxy**: `/api` requests proxied to Django backend at `http://127.0.0.1:8000`

### Key API Endpoints
- `/api/auth/login/`, `/api/auth/register/`, `/api/auth/me/` - Authentication
- `/api/tasks/` - List/create tasks
- `/api/tasks/<id>/` - Get/update task
- `/api/tasks/<id>/actions/` - Task actions (change_status, transfer, confirm_complete, archive)
- `/api/tasks/<id>/comments/` - Task comments
- `/api/dashboard/` - Dashboard stats
- `/api/meta/` - Users, departments, statuses, priorities metadata

## Key Constraints

- All task queries must use `visible_tasks_for(user)` to enforce "only see related tasks" rule
- Write operations must check `writable_task_for(user, task)`
- Every task change (status, owner, department) should create a `FlowEvent` via `create_flow_event()`