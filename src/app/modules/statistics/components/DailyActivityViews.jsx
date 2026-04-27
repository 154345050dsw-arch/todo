import { useMemo } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';

export function DailyActivityCalendar({
  data,
  month,
  selectedDate,
  loading,
  error,
  onMonthChange,
  onDateSelect,
  calendarMode,
  onCalendarModeChange,
  buildCalendarCells,
  activityDayMap,
  dateFromKey,
  dateKey,
  monthKey,
  shiftMonthKey,
  formatMonthTitle,
  formatActivityTime,
  WEEKDAYS,
  eventBarStyles,
}) {
  const cells = useMemo(() => buildCalendarCells(month), [month, buildCalendarCells]);
  const daysByDate = useMemo(() => activityDayMap(data), [data, activityDayMap]);

  const weekDays = useMemo(() => {
    const selected = dateFromKey(selectedDate);
    const dayOfWeek = selected.getDay();
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        date,
        key: dateKey(date),
        label: WEEKDAYS[i],
        dayNum: date.getDate(),
        isToday: dateKey(date) === dateKey(new Date()),
      };
    });
  }, [selectedDate, dateFromKey, dateKey, WEEKDAYS]);

  const weekEventsByDate = useMemo(() => {
    const result = {};
    weekDays.forEach(({ key }) => {
      result[key] = {};
      const day = daysByDate.get(key);
      if (day?.groups) {
        day.groups.forEach(group => {
          group.events.forEach(event => {
            const hour = new Date(event.time).getHours();
            if (!result[key][hour]) result[key][hour] = [];
            result[key][hour].push({ ...event, status: group.status });
          });
        });
      }
    });
    return result;
  }, [weekDays, daysByDate]);

  function getDayEvents(day) {
    if (!day?.groups) return [];
    return day.groups.flatMap(group =>
      group.events.slice(0, 2).map(event => ({
        ...event,
        status: group.status,
      }))
    );
  }

  if (calendarMode === 'week') {
    const hours = Array.from({ length: 15 }, (_, i) => 8 + i);

    return (
      <div className="h-full min-h-[640px] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)]">
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const current = dateFromKey(selectedDate);
                current.setDate(current.getDate() - 7);
                onDateSelect(dateKey(current), { openTimeline: false });
              }}
              className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label="上周"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-[var(--app-text)]">
              {weekDays[0].date.getMonth() + 1}月{weekDays[0].dayNum}日 - {weekDays[6].date.getMonth() + 1}月{weekDays[6].dayNum}日
            </span>
            <button
              type="button"
              onClick={() => {
                const current = dateFromKey(selectedDate);
                current.setDate(current.getDate() + 7);
                onDateSelect(dateKey(current), { openTimeline: false });
              }}
              className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label="下周"
            >
              <ChevronRight size={16} />
            </button>
            {loading && <RefreshCw size={14} className="animate-spin text-[var(--app-muted)]" />}
          </div>

          <div className="inline-flex rounded-[8px] border border-[var(--app-border)] p-0.5">
            {[
              { key: 'month', label: '月' },
              { key: 'week', label: '周' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onCalendarModeChange(key)}
                className={`h-7 rounded-[6px] px-3 text-xs font-medium transition ${
                  calendarMode === key
                    ? 'bg-[var(--app-text)] text-[var(--app-panel)]'
                    : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <div className="flex flex-col">
          <div className="grid grid-cols-8 border-b border-[var(--app-border)]">
            <div className="py-2 text-center text-[11px] font-semibold text-[var(--app-subtle)] border-r border-[var(--app-border)]" />
            {weekDays.map(({ key, label, dayNum, isToday }) => (
              <button
                key={key}
                type="button"
                onClick={() => onDateSelect(key)}
                className={`py-2 text-center border-r border-[var(--app-border)] last:border-r-0 ${
                  isToday ? 'text-[var(--app-primary)]' : 'text-[var(--app-text)]'
                } hover:bg-[var(--app-panel-soft)]`}
              >
                <div className="text-[11px] font-semibold">{label}</div>
                <div className={`text-xs font-medium tabular-nums ${isToday ? 'text-[var(--app-primary)]' : 'text-[var(--app-muted)]'}`}>
                  {dayNum}
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 min-h-[32px] border-b border-[var(--app-border)]">
                <div className="flex items-center justify-center text-[11px] font-medium tabular-nums text-[var(--app-subtle)] border-r border-[var(--app-border)]">
                  {`${hour.toString().padStart(2, '0')}:00`}
                </div>

                {weekDays.map(({ key }) => {
                  const hourEvents = weekEventsByDate[key]?.[hour] || [];
                  return (
                    <div
                      key={`${key}-${hour}`}
                      className="border-r border-[var(--app-border)] last:border-r-0 p-0.5 relative hover:bg-[var(--app-panel-soft)]"
                    >
                      {hourEvents.slice(0, 2).map((event, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => onDateSelect(key)}
                          className={`block w-full h-[14px] rounded-[2px] px-1 text-[9px] font-medium truncate mb-0.5 ${eventBarStyles[event.status] || eventBarStyles.todo}`}
                          title={`${event.task?.code} ${event.task?.title}`}
                        >
                          {event.task?.title?.slice(0, 8)}
                        </button>
                      ))}
                      {hourEvents.length > 2 && (
                        <span className="text-[9px] text-[var(--app-subtle)]">+{hourEvents.length - 2}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[640px] rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonthKey(month, -1))}
              className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label="上月"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => onMonthChange(monthKey(new Date()))}
              className="h-8 rounded-[8px] px-2.5 text-sm font-semibold text-[var(--app-text)] transition hover:bg-[var(--app-panel-soft)]"
            >
              {formatMonthTitle(month)}
            </button>
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonthKey(month, 1))}
              className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label="下月"
            >
              <ChevronRight size={16} />
            </button>
            {loading && <RefreshCw size={14} className="animate-spin text-[var(--app-muted)]" />}
          </div>
        </div>

        <div className="inline-flex rounded-[8px] border border-[var(--app-border)] p-0.5">
          {[
            { key: 'month', label: '月' },
            { key: 'week', label: '周' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onCalendarModeChange(key)}
              className={`h-7 rounded-[6px] px-3 text-xs font-medium transition ${
                calendarMode === key
                  ? 'bg-[var(--app-text)] text-[var(--app-panel)]'
                  : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-7 border-b border-[var(--app-border)]">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-2 text-center text-[11px] font-semibold text-[var(--app-subtle)]">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const day = daysByDate.get(cell.key);
          const events = getDayEvents(day);
          const isSelected = selectedDate === cell.key;

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onDateSelect(cell.key)}
              className={`min-h-[80px] border-b border-r border-[var(--app-border)] p-1.5 text-left transition last:border-r-0 ${
                cell.inMonth
                  ? 'bg-[var(--app-panel)] hover:bg-[var(--app-panel-soft)]'
                  : 'bg-[var(--app-bg)] opacity-50 hover:bg-[var(--app-panel-soft)]'
              } ${
                isSelected
                  ? 'ring-2 ring-[var(--app-primary)] ring-inset'
                  : cell.isToday
                    ? 'font-semibold'
                    : ''
              }`}
            >
              <div className={`mb-1 text-xs font-medium tabular-nums ${
                cell.isToday
                  ? 'text-[var(--app-primary)]'
                  : cell.inMonth
                    ? 'text-[var(--app-text)]'
                    : 'text-[var(--app-subtle)]'
              }`}>
                {cell.date.getDate()}
              </div>

              {events.length > 0 && (
                <div className="space-y-0.5">
                  {events.slice(0, 3).map((event, idx) => (
                    <div
                      key={idx}
                      className={`h-[18px] rounded-[3px] px-1.5 text-[10px] font-medium truncate ${eventBarStyles[event.status] || eventBarStyles.todo}`}
                      title={`${event.task?.code} ${event.task?.title}`}
                    >
                      {event.task?.title?.slice(0, 10) || event.label}
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className="text-[10px] text-[var(--app-subtle)] pl-1">
                      +{day.groups.reduce((sum, g) => sum + g.count, 0) - 3}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DailyActivityTimeline({
  data,
  selectedDate,
  loading,
  onOpenTask,
  onClose,
  activityDayMap,
  formatFullDate,
  formatActivityTime,
  Badge,
  badgeClass,
  statusTone,
  statusLabels,
  displayUser,
}) {
  const daysByDate = useMemo(() => activityDayMap(data), [data, activityDayMap]);
  const day = daysByDate.get(selectedDate);

  const sortedEvents = useMemo(() => {
    if (!day?.groups) return [];
    const allEvents = day.groups.flatMap(group =>
      group.events.map(event => ({ ...event, status: group.status }))
    );
    return allEvents.sort((a, b) => new Date(a.time) - new Date(b.time));
  }, [day]);

  const hourlyGroups = useMemo(() => {
    const groups = {};
    sortedEvents.forEach(event => {
      const hour = new Date(event.time).getHours();
      const key = `${hour.toString().padStart(2, '0')}:00`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return groups;
  }, [sortedEvents]);

  const hourKeys = useMemo(() => {
    const keys = Object.keys(hourlyGroups);
    if (keys.length === 0) return ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const minHour = Math.min(...keys.map(k => parseInt(k.split(':')[0])));
    const maxHour = Math.max(...keys.map(k => parseInt(k.split(':')[0])));
    const start = Math.max(8, minHour);
    const end = Math.min(22, maxHour + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => `${(start + i).toString().padStart(2, '0')}:00`);
  }, [hourlyGroups]);

  return (
    <aside className="absolute inset-y-0 right-0 z-10 w-[340px] border-l border-[var(--app-border)] bg-[var(--app-panel)]">
      <div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3">
        <div>
          <div className="text-sm font-semibold">{formatFullDate(selectedDate)}</div>
          <div className="text-[11px] text-[var(--app-muted)]">
            {day?.total_actions ?? 0} 项流转
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <RefreshCw size={14} className="animate-spin text-[var(--app-muted)]" />}
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-[8px] text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
            aria-label="关闭日流转明细"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="h-[calc(100%-3rem)] overflow-y-auto">
        {sortedEvents.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-sm text-[var(--app-muted)]">
            这一天暂无流转动作
          </div>
        )}

        {sortedEvents.length > 0 && (
          <div className="relative px-4 py-3">
            <div className="absolute left-[52px] top-0 bottom-0 w-px bg-[var(--app-border)]" />

            {hourKeys.map((hourKey) => {
              const events = hourlyGroups[hourKey] || [];
              return (
                <div key={hourKey} className="flex min-h-[40px]">
                  <div className="w-[52px] shrink-0 text-[11px] font-medium tabular-nums text-[var(--app-subtle)] py-1">
                    {hourKey}
                  </div>

                  <div className="flex-1 pl-3 space-y-1.5">
                    {events.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onOpenTask(event.task.id)}
                        className="relative w-full rounded-[6px] px-2 py-1.5 text-left transition hover:bg-[var(--app-panel-soft)] group"
                      >
                        <span className="absolute -left-3 top-2 size-2 rounded-full bg-[var(--app-border)] ring-2 ring-[var(--app-panel)] group-hover:bg-[var(--app-primary)]" />

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium tabular-nums text-[var(--app-subtle)]">
                            {formatActivityTime(event.time)}
                          </span>
                          <Badge className={badgeClass(statusTone, event.task.status)}>
                            {event.task.status_label || statusLabels[event.task.status]}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[12px] font-medium truncate">
                          <span className="text-[var(--app-subtle)]">{event.task.code}</span>
                          <span className="truncate">{event.task.title}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-[11px] text-[var(--app-muted)]">
                          <span>{event.label}</span>
                          <span>{displayUser(event.actor)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
