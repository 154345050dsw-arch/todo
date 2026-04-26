# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlowDesk is a team task handoff system built with React + Django + MySQL. The landing page is at `/`, and the task management application is at `/app`. A desktop app (Tauri) is also available.

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

### Desktop (Tauri)
```bash
npm run desktop:dev         # Development with desktop window
npm run desktop:build:mac   # Build macOS app (no signing)
```

### Running Tests
```bash
cd backend
python manage.py test                          # All tests
python manage.py test tasks.tests.HealthTests  # Single test class
python manage.py test tasks.tests.TaskVisibilityTests.test_unrelated_user_cannot_see_task  # Single test
```

## Architecture

### Backend (Django REST Framework)
- **Authentication**: Token-based via `rest_framework.authtoken`
- **Core models** (`tasks/models.py`):
  - `Task`: Main entity with status, priority, owner, confirmer, participants, department, `candidate_owners` (for claimable tasks)
  - `FlowEvent`: Tracks all task transitions (status changes, owner transfers, department changes, reminders)
  - `TaskComment`: Task comments
  - `TaskReminder`: Reminder records with rate limiting (30 min window)
  - `TaskNotification`: User notifications linked to tasks
  - `Department`: Organization units
  - `UserProfile`: User's default department for task creation
- **Task visibility** (`tasks/services.py`): `visible_tasks_for(user)` returns only tasks related to the user. All API views must start from this queryset.
- **Write permissions**: `writable_task_for(user, task)` restricts modifications to creator, owner, confirmer, or participants
- **Candidate view**: `is_limited_candidate_view(task, user)` returns True for unclaimed candidate tasks (restricted view, no description)
- **Rich text sanitization**: `sanitize_rich_text(value)` in services.py strips unsafe HTML tags, allows limited safe tags
- **Duration analysis**: `duration_analysis(task)` aggregates time spent per owner, department, and status
- **Task scopes** (`task_scope(queryset, user, scope)`): Filters by scope - `all`, `created`, `participated`, `confirming`, `cancel_pending`, `overdue`, `done`, `cancelled`, `transferred`, `future`, `my_todo`, `today_todo`

### Frontend (React)
- **Entry**: `src/main.jsx` with `ThemeProvider`
- **Components**:
  - `src/App.jsx`: Landing page with marketing content
  - `src/TaskApp.jsx`: Task management interface (Kanban, detail drawer, dashboard)
- **API client**: `src/api.js` handles authentication token and request/response
- **Theme**: `src/theme.jsx` provides system/light/dark themes persisted in localStorage
- **Vite proxy**: `/api` requests proxied to Django backend at `http://127.0.0.1:8000`
- **Design guide**: `docs/FRONTEND_DESIGN_GUIDE.md` - use CSS variables `var(--app-*)`, warm stone tones, 15px body text, 12px card radius

### Desktop (Tauri)
- Config: `src-tauri/tauri.conf.json`
- Window: 1280x820, min 1024x720
- CSP allows localhost/127.0.0.1 connections for development

### Key API Endpoints
- `/api/auth/login/`, `/api/auth/register/`, `/api/auth/me/` - Authentication
- `/api/tasks/` - List/create tasks (supports `scope`, `search`, `limit` params)
- `/api/tasks/<id>/` - Get/update task
- `/api/tasks/<id>/actions/` - Task actions (change_status, transfer, confirm_complete, archive, claim_task)
- `/api/tasks/<id>/comments/` - Task comments
- `/api/tasks/<id>/reminders/` - Create reminder (rate limited 30 min)
- `/api/notifications/` - List notifications, mark read
- `/api/dashboard/` - Dashboard stats
- `/api/meta/` - Users, departments, statuses, priorities metadata
- `/api/stats/daily-activity/` - Daily activity stats by month
- `/api/health/` - Health check (no auth required)

## Key Constraints

- All task queries must use `visible_tasks_for(user)` to enforce "only see related tasks" rule
- Write operations must check `writable_task_for(user, task)`
- Candidate owners have limited view before claiming: no description, cannot comment/change status
- Every task change (status, owner, department, reminder) should create a `FlowEvent` via `create_flow_event()`
- Rich text fields (description, completion_note) must pass through `sanitize_rich_text()`
- Reminders have 30-minute rate limit per task/target combination
- Frontend styling must follow `docs/FRONTEND_DESIGN_GUIDE.md`