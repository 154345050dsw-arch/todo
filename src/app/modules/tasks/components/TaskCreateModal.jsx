import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  ImagePlus,
  Italic,
  Link2,
  List,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { api } from '../../../../api.js';

function localDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const deadlineQuickOptions = [
  { label: '今天', days: 0 },
  { label: '明天', days: 1 },
  { label: '本周五', days: ((5 - new Date().getDay()) % 7) || 7 },
  { label: '下周', days: 7 },
];

function deadlineToIso(dateValue, includeTime, timeValue) {
  if (!dateValue) return null;
  return new Date(`${dateValue}T${includeTime ? timeValue || '23:59' : '23:59'}`).toISOString();
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function ElegantDatePicker({ value, onChange, showTime, timeValue, onTimeChange, onToggleTime }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const date = value ? new Date(`${value}T00:00`) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const containerRef = useRef(null);

  const selectedDate = value ? new Date(`${value}T00:00`) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function formatDateDisplay(dateValue) {
    if (!dateValue) return '选择日期';
    const date = new Date(`${dateValue}T00:00`);
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) return '今天';
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function getDaysInMonth(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let index = 0; index < firstDay.getDay(); index += 1) days.push(null);
    for (let day = 1; day <= lastDay.getDate(); day += 1) days.push(new Date(year, month, day));
    return days;
  }

  function isDateDisabled(date) {
    return date < today;
  }

  function selectDate(date) {
    if (isDateDisabled(date)) return;
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    onChange(local.toISOString().slice(0, 10));
    setOpen(false);
  }

  const days = getDaysInMonth(viewMonth);

  return (
    <div className="flex items-center gap-2">
      <div ref={containerRef} className="relative flex-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="h-11 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 pr-10 text-left text-sm font-medium outline-none transition hover:border-[var(--app-muted)] focus:border-[var(--app-primary)]"
        >
          <span className={value ? 'text-[var(--app-text)]' : 'text-[var(--app-subtle)]'}>
            {formatDateDisplay(value)}
          </span>
          <Calendar size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
        </button>

        {open && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-[240px] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} className="grid size-7 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-semibold">{viewMonth.getFullYear()}年{MONTHS[viewMonth.getMonth()]}</span>
              <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} className="grid size-7 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]">
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-0.5 text-center text-[10px] font-medium text-[var(--app-subtle)]">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {days.map((date, index) => {
                if (!date) return <div key={`empty-${index}`} className="h-7" />;
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                const isTodayDate = date.toDateString() === today.toDateString();
                const disabled = isDateDisabled(date);
                return (
                  <button
                    key={date.getTime()}
                    type="button"
                    disabled={disabled}
                    onClick={() => selectDate(date)}
                    className={`h-7 rounded-[4px] text-xs font-medium transition ${
                      disabled
                        ? 'cursor-not-allowed text-[var(--app-subtle)]'
                        : isSelected
                          ? 'bg-[var(--app-primary)] text-white'
                          : isTodayDate
                            ? 'font-bold text-[var(--app-primary)] hover:bg-[var(--app-panel-soft)]'
                            : 'text-[var(--app-text)] hover:bg-[var(--app-panel-soft)]'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex gap-1 border-t border-[var(--app-border)] pt-2">
              {deadlineQuickOptions.slice(0, 3).map((option) => {
                const optionValue = localDateInputValue(new Date(Date.now() + option.days * 86400000));
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => { onChange(optionValue); setOpen(false); }}
                    className={`h-6 rounded-[4px] px-2 text-[10px] font-medium transition ${
                      value === optionValue ? 'bg-[var(--app-primary)] text-white' : 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onToggleTime}
        className={`flex h-11 items-center gap-1 rounded-[8px] border px-3 text-xs font-medium transition ${
          showTime
            ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
            : 'border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)] hover:text-[var(--app-text)]'
        }`}
      >
        <Clock3 size={13} />
        {showTime ? '关闭' : '时间'}
      </button>

      {showTime && (
        <input
          type="time"
          autoFocus
          value={timeValue}
          onChange={(event) => onTimeChange(event.target.value)}
          className="h-11 w-[88px] rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel)] px-2 text-xs font-medium outline-none focus:border-[var(--app-primary)]"
        />
      )}
    </div>
  );
}

function createInitialTaskForm(currentUser) {
  return {
    title: '',
    description: '',
    candidate_owner_ids: currentUser ? [currentUser.id] : [],
    due_date: localDateInputValue(),
    due_has_time: false,
    due_time: '23:59',
    confirmer_id: '',
    participant_ids: [],
    priority: 'low',
  };
}

function selectedUsers(users = [], selectedIds = []) {
  const selectedSet = new Set(selectedIds.map(String));
  return users.filter((item) => selectedSet.has(String(item.id)));
}

function toggleStringId(values, id) {
  const idText = String(id);
  const hasId = values.some((value) => String(value) === idText);
  return hasId ? values.filter((value) => String(value) !== idText) : [...values, idText];
}

function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const linkInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    if (!editorRef.current || document.activeElement === editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  function syncValue() {
    onChange(editorRef.current?.innerHTML || '');
  }

  function runCommand(command, commandValue = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncValue();
  }

  function rememberSelection() {
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;
    if (!selection?.rangeCount || !anchorNode || !editorRef.current?.contains(anchorNode)) return;
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    editorRef.current?.focus();
    if (!savedRangeRef.current) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(savedRangeRef.current);
  }

  function normalizeLinkUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) return '';
    return /^(https?:\/\/|mailto:|tel:|#|\/)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  function insertImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, `<img src="${reader.result}" alt="粘贴图片">`);
      syncValue();
    };
    reader.readAsDataURL(file);
  }

  function handlePaste(event) {
    const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    event.preventDefault();
    insertImage(imageItem.getAsFile());
  }

  function openLinkEditor() {
    rememberSelection();
    setLinkOpen(true);
    requestAnimationFrame(() => linkInputRef.current?.focus());
  }

  function closeLinkEditor() {
    setLinkOpen(false);
    setLinkUrl('');
  }

  function applyLink() {
    const normalizedUrl = normalizeLinkUrl(linkUrl);
    if (!normalizedUrl) return;
    restoreSelection();
    const selection = window.getSelection();
    const hasSelectedText = selection?.rangeCount && !selection.isCollapsed && editorRef.current?.contains(selection.anchorNode);
    if (hasSelectedText) {
      document.execCommand('createLink', false, normalizedUrl);
    } else {
      const anchor = document.createElement('a');
      anchor.href = normalizedUrl;
      anchor.textContent = linkUrl.trim();
      document.execCommand('insertHTML', false, anchor.outerHTML);
    }
    syncValue();
    closeLinkEditor();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">任务内容</span>
        <div className="relative flex items-center gap-1 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] p-1">
          {[
            ['bold', Bold, '加粗'],
            ['italic', Italic, '斜体'],
            ['insertUnorderedList', List, '项目列表'],
          ].map(([command, Icon, label]) => (
            <button
              key={command}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand(command)}
              className="grid size-8 place-items-center rounded-[7px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              aria-label={label}
              title={label}
            >
              <Icon size={15} />
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={openLinkEditor}
            className={`grid size-8 place-items-center rounded-[7px] transition ${
              linkOpen
                ? 'bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
                : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'
            }`}
            aria-label="插入链接"
            title="插入链接"
          >
            <Link2 size={15} />
          </button>
          <button type="button" onClick={() => imageInputRef.current?.click()} className="grid size-8 place-items-center rounded-[7px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]" aria-label="插入图片" title="插入图片">
            <ImagePlus size={15} />
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => insertImage(event.target.files?.[0])} />

          {linkOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] p-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.16)] sm:w-[320px]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--app-text)]">
                  <span className="grid size-6 place-items-center rounded-[7px] bg-[var(--app-primary)]/10 text-[var(--app-primary)]">
                    <Link2 size={13} />
                  </span>
                  链接地址
                </div>
                <button
                  type="button"
                  onClick={closeLinkEditor}
                  className="grid size-6 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
                  aria-label="关闭链接输入"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-2 transition focus-within:border-[var(--app-primary)]">
                <input
                  ref={linkInputRef}
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyLink();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      closeLinkEditor();
                      editorRef.current?.focus();
                    }
                  }}
                  placeholder="https://example.com"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--app-subtle)] focus-visible:outline-none"
                  autoComplete="off"
                />
                <button
                  type="button"
                  disabled={!linkUrl.trim()}
                  onClick={applyLink}
                  className="grid size-7 place-items-center rounded-[7px] bg-[var(--app-primary)] text-white transition disabled:bg-[var(--app-panel-soft)] disabled:text-[var(--app-subtle)]"
                  aria-label="应用链接"
                >
                  <Check size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div
        ref={editorRef}
        className="task-rich-text min-h-[180px] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[var(--app-primary)]"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="任务内容"
        data-placeholder="输入任务内容，支持粘贴图片。"
        onInput={syncValue}
        onPaste={handlePaste}
      />
    </div>
  );
}

function userSearchText(user, displayUser) {
  return [
    displayUser(user),
    user?.username,
    user?.email,
    user?.default_department?.name,
  ].filter(Boolean).join(' ').toLowerCase();
}

function UserSelectControl({
  label,
  helper,
  users = [],
  selectedIds = [],
  value = '',
  onChange,
  onUserSelect,
  multiple = false,
  required,
  className = '',
  emptyLabel = '选择人员',
  emptyDescription = '搜索姓名或部门后选择',
  includeEmpty = false,
  emptyOptionLabel = '不指定',
  emptyOptionDescription = '保留默认确认流程',
  searchPlaceholder = '搜索姓名、部门',
  showFrequent = false,
  frequentUsers = [],
  manageFrequentOpen = false,
  onToggleManageFrequent,
  onRemoveFrequent,
  showSelectedChips = false,
  displayUser,
}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const selectedSet = new Set(multiple ? selectedIds.map(String) : (value ? [String(value)] : []));
  const pickedUsers = multiple ? selectedUsers(users, selectedIds) : [];
  const selectedUser = multiple ? null : users.find((item) => String(item.id) === String(value));
  const query = searchQuery.trim().toLowerCase();
  const visibleUsers = useMemo(() => {
    if (!query) return users;
    return users.filter((user) => userSearchText(user, displayUser).includes(query));
  }, [displayUser, query, users]);

  const primaryText = multiple
    ? pickedUsers.length
      ? `${pickedUsers.slice(0, 2).map(displayUser).join('、')}${pickedUsers.length > 2 ? ` 等 ${pickedUsers.length} 人` : ''}`
      : emptyLabel
    : selectedUser
      ? displayUser(selectedUser)
      : emptyLabel;
  const secondaryText = multiple
    ? pickedUsers.length
      ? `已选择 ${pickedUsers.length} 人 · 点击调整`
      : emptyDescription
    : selectedUser?.default_department?.name || emptyDescription;
  const leadUser = multiple ? pickedUsers[0] : selectedUser;

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function chooseUser(user) {
    if (multiple) {
      const nextIds = toggleStringId(selectedIds, user.id);
      onChange(nextIds);
      onUserSelect?.(user, nextIds);
      setSearchQuery('');
      return;
    }

    onChange(String(user.id));
    onUserSelect?.(user, String(user.id));
    setOpen(false);
    setSearchQuery('');
  }

  function renderUserRow(user, { compact = false, frequent = false } = {}) {
    const selected = selectedSet.has(String(user.id));
    const canRemove = frequent && manageFrequentOpen && user.id !== undefined;
    return (
      <button
        key={`${frequent ? 'frequent' : 'user'}-${user.id}`}
        type="button"
        onClick={() => canRemove ? onRemoveFrequent?.(user.id) : chooseUser(user)}
        className={`flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left transition hover:bg-[var(--app-panel-soft)] ${
          selected ? 'bg-[var(--app-primary)]/10' : ''
        } ${compact ? 'py-1.5' : ''}`}
      >
        <span className={`grid size-8 shrink-0 place-items-center rounded-[8px] text-sm font-semibold ${
          selected
            ? 'bg-[var(--app-primary)] text-white'
            : canRemove
              ? 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300'
              : 'bg-[var(--app-panel-soft)] text-[var(--app-text)]'
        }`}
        >
          {canRemove ? <X size={14} /> : displayUser(user)[0]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--app-text)]">{displayUser(user)}</span>
          <span className="block truncate text-xs text-[var(--app-subtle)]">{user.default_department?.name || '未设置部门'}</span>
        </span>
        {selected && !canRemove && <Check size={14} className="text-[var(--app-primary)]" />}
      </button>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      <div className="flex items-center gap-1 text-sm font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}
      </div>
      <div className="relative mt-2">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`flex min-h-11 w-full items-center gap-3 rounded-[10px] border px-3 py-2 text-left transition ${
            open
              ? 'border-[var(--app-primary)] bg-[var(--app-panel)]'
              : 'border-[var(--app-border)] bg-[var(--app-bg)] hover:border-[var(--app-muted)]'
          }`}
        >
          <span className={`grid size-8 shrink-0 place-items-center rounded-[8px] text-sm font-semibold ${
            leadUser
              ? 'bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
              : 'bg-[var(--app-panel-soft)] text-[var(--app-muted)]'
          }`}
          >
            {leadUser ? displayUser(leadUser)[0] : multiple ? <Users size={15} /> : <ClipboardCheck size={15} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-sm font-medium ${leadUser ? 'text-[var(--app-text)]' : 'text-[var(--app-muted)]'}`}>
              {primaryText}
            </span>
            <span className="block truncate text-xs text-[var(--app-subtle)]">{secondaryText}</span>
          </span>
          <ChevronDown size={15} className={`shrink-0 text-[var(--app-muted)] transition ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_12px_36px_rgba(0,0,0,0.16)]">
            <div className="border-b border-[var(--app-border)] p-2">
              <div className="flex items-center gap-2 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-bg)] px-2.5 py-2 transition focus-within:border-[var(--app-primary)]">
                <Search size={14} className="shrink-0 text-[var(--app-muted)]" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setOpen(false);
                      setSearchQuery('');
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--app-subtle)] focus-visible:outline-none"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="grid size-5 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]"
                    aria-label="清空搜索"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {showFrequent && !query && frequentUsers.length > 0 && (
              <div className="border-b border-[var(--app-border)] p-1.5">
                <div className="flex items-center justify-between px-1.5 py-1 text-[11px] text-[var(--app-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles size={12} />
                    常用负责人
                  </span>
                  <button
                    type="button"
                    onClick={onToggleManageFrequent}
                    className="rounded-[6px] px-1.5 py-0.5 text-[11px] text-[var(--app-subtle)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-muted)]"
                  >
                    {manageFrequentOpen ? '完成' : '管理'}
                  </button>
                </div>
                <div className="space-y-1">
                  {frequentUsers.map((item) => renderUserRow(item, { compact: true, frequent: true }))}
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-auto p-1.5">
              {includeEmpty && !query && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                    setSearchQuery('');
                  }}
                  className={`mb-1 flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left transition hover:bg-[var(--app-panel-soft)] ${
                    !selectedUser ? 'bg-[var(--app-panel-soft)]' : ''
                  }`}
                >
                  <span className="grid size-8 place-items-center rounded-[8px] bg-[var(--app-panel-soft)] text-[var(--app-muted)]">
                    <ClipboardCheck size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--app-text)]">{emptyOptionLabel}</span>
                    <span className="block truncate text-xs text-[var(--app-subtle)]">{emptyOptionDescription}</span>
                  </span>
                  {!selectedUser && <Check size={14} className="text-[var(--app-primary)]" />}
                </button>
              )}

              {visibleUsers.length > 0 ? (
                <div className="space-y-1">
                  {visibleUsers.map((item) => renderUserRow(item))}
                </div>
              ) : (
                <div className="px-3 py-5 text-center text-sm text-[var(--app-subtle)]">未找到匹配的人员</div>
              )}
            </div>
          </div>
        )}
      </div>
      {multiple && showSelectedChips && pickedUsers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {pickedUsers.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(toggleStringId(selectedIds, item.id))}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-[var(--app-text)] px-2.5 text-xs font-medium text-[var(--app-panel)] transition hover:opacity-80"
            >
              {displayUser(item)}
              <X size={12} />
            </button>
          ))}
        </div>
      )}
      {helper && <p className="mt-1.5 text-xs leading-5 text-[var(--app-muted)]">{helper}</p>}
    </div>
  );
}

function SmartUserPicker({ label, helper, users = [], selectedIds = [], onChange, required, currentUser, className = '', displayUser, onRefreshMeta }) {
  const [manageOpen, setManageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const containerRef = useRef(null);

  // 本地维护常用负责人状态（初始化从 meta.users.is_frequent）
  const [localFrequentIds, setLocalFrequentIds] = useState(() => {
    const frequentIds = users.filter((user) => user.is_frequent).map((user) => user.id);
    // 确保当前用户在列表中
    if (currentUser && !frequentIds.includes(currentUser.id)) {
      return [currentUser.id, ...frequentIds].slice(0, 5);
    }
    return frequentIds.slice(0, 5);
  });

  // 记录原始状态，用于在完成时判断是否有变化
  const [originalFrequentIds, setOriginalFrequentIds] = useState(() => {
    const frequentIds = users.filter((user) => user.is_frequent).map((user) => user.id);
    if (currentUser && !frequentIds.includes(currentUser.id)) {
      return [currentUser.id, ...frequentIds].slice(0, 5);
    }
    return frequentIds.slice(0, 5);
  });

  // 常用负责人：基于本地状态，当前用户排第一位
  const frequentUsers = useMemo(() => {
    const byId = {};
    users.forEach((user) => { byId[user.id] = user; });
    const list = localFrequentIds.map((id) => byId[id]).filter(Boolean);
    // 当前用户排第一位
    if (currentUser && list.some((u) => u.id === currentUser.id)) {
      const others = list.filter((u) => u.id !== currentUser.id);
      return [byId[currentUser.id], ...others].filter(Boolean);
    }
    return list;
  }, [users, localFrequentIds, currentUser]);

  const pickedUsers = selectedUsers(users, selectedIds);
  const selectedSet = new Set(selectedIds.map(String));
  const query = searchQuery.trim().toLowerCase();

  // 搜索框下拉：按频率排序显示（排除当前用户和常用负责人）
  const displayUsers = useMemo(() => {
    const sortedByFrequency = [...users]
      .filter((user) => user.id !== currentUser?.id) // 排除当前用户
      .sort((a, b) => {
        const countA = a.assignment_count || 0;
        const countB = b.assignment_count || 0;
        if (countA !== countB) return countB - countA;
        return displayUser(a).localeCompare(displayUser(b));
      });

    if (query) {
      return sortedByFrequency.filter((user) => userSearchText(user, displayUser).includes(query)).slice(0, 8);
    }
    // 无搜索词：排除已在常用列表的
    return sortedByFrequency.filter((user) => !localFrequentIds.includes(user.id)).slice(0, 5);
  }, [displayUser, query, users, currentUser, localFrequentIds]);

  useEffect(() => {
    if (!searchOpen) return;
    const handleClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [searchOpen]);

  // 删除：只更新本地状态，点击完成后才保存
  function removeFromFrequent(user) {
    const newIds = localFrequentIds.filter((id) => id !== user.id);
    setLocalFrequentIds(newIds);
  }

  async function addToFrequent(user) {
    const newIds = [user.id, ...localFrequentIds].slice(0, 5);
    setLocalFrequentIds(newIds);
    setOriginalFrequentIds(newIds);
    try {
      await api.updateFrequentOwners(newIds);
      onRefreshMeta?.();
    } catch { }
  }

  // 完成管理：如果有变化则保存
  async function finishManage() {
    setManageOpen(false);
    if (JSON.stringify(localFrequentIds) !== JSON.stringify(originalFrequentIds)) {
      setOriginalFrequentIds(localFrequentIds);
      try {
        await api.updateFrequentOwners(localFrequentIds);
        onRefreshMeta?.();
      } catch { }
    }
  }

  function toggleOwner(user) {
    onChange(toggleStringId(selectedIds, user.id));
  }

  return (
    <div ref={containerRef} className={className}>
      <div className="flex items-center gap-1 text-sm font-medium">
        {label}
        {required && <span className="text-red-500">*</span>}
      </div>
      <div className="mt-2 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-2.5">
        {pickedUsers.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pickedUsers.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleOwner(item)}
                className="inline-flex h-7 items-center gap-1 rounded-full bg-[var(--app-text)] px-2.5 text-xs font-medium text-[var(--app-panel)] transition hover:opacity-80"
              >
                {displayUser(item)}
                <X size={12} />
              </button>
            ))}
          </div>
        )}

        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 text-[11px] text-[var(--app-muted)]">
            <Sparkles size={12} />
            <span>常用负责人</span>
          </div>
          {frequentUsers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (manageOpen) {
                  finishManage();
                } else {
                  setOriginalFrequentIds(localFrequentIds);
                  setManageOpen(true);
                }
              }}
              className="rounded-[6px] px-1.5 py-0.5 text-[11px] text-[var(--app-subtle)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-muted)]"
            >
              {manageOpen ? '完成' : '管理'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {frequentUsers.map((item) => {
            const selected = selectedSet.has(String(item.id));
            const canRemove = manageOpen && item.id !== currentUser?.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => canRemove ? removeFromFrequent(item) : toggleOwner(item)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${
                  canRemove
                    ? 'border-red-300 bg-red-50 text-red-500 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
                    : selected
                      ? 'border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-primary)]'
                      : 'border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)] hover:border-[var(--app-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                {canRemove ? <X size={12} /> : null}
                {displayUser(item)}
                {!canRemove && selected && <Check size={12} />}
              </button>
            );
          })}
          {frequentUsers.length === 0 && (
            <span className="px-1 py-1 text-sm text-[var(--app-subtle)]">暂无常用负责人</span>
          )}
        </div>

        <div className="relative mt-3">
          <div className="flex items-center gap-2 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 transition focus-within:border-[var(--app-primary)]">
            <Search size={14} className="shrink-0 text-[var(--app-muted)]" />
            <input
              value={searchQuery}
              onFocus={() => {
                setSearchOpen(true);
              }}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchOpen(Boolean(event.target.value.trim()));
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearchOpen(false);
                  setSearchQuery('');
                }
              }}
              placeholder="搜索添加其他负责人"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--app-subtle)] focus-visible:outline-none"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                className="grid size-5 place-items-center rounded-[6px] text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)]"
                aria-label="清空搜索"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {searchOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-auto rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-1.5 shadow-[0_12px_36px_rgba(0,0,0,0.16)]">
              {displayUsers.length > 0 ? (
                <div className="space-y-1">
                  {displayUsers.map((item) => {
                    const selected = selectedSet.has(String(item.id));
                    return (
                      <div
                        key={item.id}
                        className={`flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 transition hover:bg-[var(--app-panel-soft)] ${
                          selected ? 'bg-[var(--app-primary)]/10' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            toggleOwner(item);
                            setSearchQuery('');
                            setSearchOpen(false);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className={`grid size-8 shrink-0 place-items-center rounded-[8px] text-sm font-semibold ${
                            selected ? 'bg-[var(--app-primary)] text-white' : 'bg-[var(--app-panel-soft)] text-[var(--app-text)]'
                          }`}
                          >
                            {displayUser(item)[0]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[var(--app-text)]">{displayUser(item)}</span>
                            <span className="block truncate text-xs text-[var(--app-subtle)]">{item.default_department?.name || '未设置部门'}</span>
                          </span>
                          {selected && <Check size={14} className="text-[var(--app-primary)]" />}
                        </button>
                        {!item.is_frequent && frequentUsers.length < 5 && (
                          <button
                            type="button"
                            onClick={() => addToFrequent(item)}
                            className="grid size-7 shrink-0 place-items-center rounded-[6px] text-[var(--app-subtle)] hover:bg-[var(--app-primary)]/10 hover:text-[var(--app-primary)]"
                            title="加入常用"
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-5 text-center text-sm text-[var(--app-subtle)]">未找到匹配的人员</div>
              )}
            </div>
          )}
        </div>
      </div>
      {helper && <p className="mt-1.5 text-xs leading-5 text-[var(--app-muted)]">{helper}</p>}
    </div>
  );
}

function UserMultiPicker({ label, helper, users = [], selectedIds = [], onChange, required, className = '', displayUser }) {
  return (
    <UserSelectControl
      label={label}
      helper={helper}
      users={users}
      selectedIds={selectedIds}
      onChange={onChange}
      multiple
      required={required}
      className={className}
      emptyLabel="选择协作人"
      emptyDescription="搜索姓名、部门后添加"
      searchPlaceholder="搜索协作人姓名、部门"
      showSelectedChips
      displayUser={displayUser}
    />
  );
}

function SingleUserSelect({ label, users = [], value, onChange, emptyLabel = '不指定', helper, displayUser }) {
  return (
    <UserSelectControl
      label={label}
      helper={helper}
      users={users}
      value={value}
      onChange={onChange}
      emptyLabel={emptyLabel}
      emptyDescription="不指定时由创建人确认"
      includeEmpty
      emptyOptionLabel={emptyLabel}
      emptyOptionDescription="默认由创建人确认"
      searchPlaceholder="搜索确认人姓名、部门"
      displayUser={displayUser}
    />
  );
}

function PriorityControl({ priorities = [], value, onChange }) {
  return (
    <div>
      <div className="text-sm font-medium">优先级</div>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-1">
        {priorities.map((priority) => (
          <button
            key={priority.value}
            type="button"
            onClick={() => onChange(priority.value)}
            className={`h-9 rounded-[8px] text-sm font-medium transition ${
              value === priority.value
                ? 'bg-[var(--app-text)] text-[var(--app-panel)]'
                : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'
            }`}
          >
            {priority.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TaskCreateModal({ open, meta, currentUser, restoreFocusRef, onClose, onCreated, onRefreshMeta, displayUser }) {
  const [form, setForm] = useState(() => createInitialTaskForm(currentUser));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const titleRef = useRef(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      setForm(createInitialTaskForm(currentUser));
      setAdvancedOpen(false);
      setError('');
      requestAnimationFrame(() => titleRef.current?.focus());
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      setSaving(false);
      setForm(createInitialTaskForm(currentUser));
      setAdvancedOpen(false);
      setError('');
      requestAnimationFrame(() => restoreFocusRef?.current?.focus());
    }
  }, [open, restoreFocusRef, currentUser]);

  function closeModal() {
    if (saving) return;
    onClose();
  }

  async function submit() {
    const candidateIds = form.candidate_owner_ids.map(Number).filter(Boolean);
    if (!form.title.trim()) {
      setError('请填写任务标题。');
      titleRef.current?.focus();
      return;
    }
    if (!candidateIds.length) {
      setError('请至少选择一位负责人。');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const task = await api.createTask({
        title: form.title.trim(),
        description: form.description,
        candidate_owner_ids: candidateIds,
        due_at: deadlineToIso(form.due_date, form.due_has_time, form.due_time),
        confirmer_id: form.confirmer_id ? Number(form.confirmer_id) : null,
        participant_ids: form.participant_ids.map(Number).filter(Boolean),
        priority: form.priority,
      });
      onCreated(task);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/35 px-4 pt-[8vh] backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
      role="presentation"
    >
      <section
        className="flex max-h-[86vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.28)] animate-modalPop"
        role="dialog"
        aria-modal="true"
        aria-label="新建任务"
      >
        <div className="flex min-h-[68px] items-center gap-3 border-b border-[var(--app-border)] px-6">
          <input
            ref={titleRef}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            className="h-16 min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none placeholder:text-[var(--app-subtle)] focus-visible:outline-none"
            placeholder="任务标题"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={closeModal}
            className="grid size-10 shrink-0 place-items-center rounded-[10px] text-[var(--app-muted)] transition-all duration-200 hover:bg-[var(--app-panel-soft)]"
            aria-label="关闭新建任务"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            <RichTextEditor value={form.description} onChange={(description) => setForm({ ...form, description })} />

            <div className="space-y-2">
              <SmartUserPicker
                label="负责人"
                users={meta.users}
                currentUser={currentUser}
                selectedIds={form.candidate_owner_ids}
                onChange={(candidate_owner_ids) => setForm({ ...form, candidate_owner_ids })}
                onRefreshMeta={onRefreshMeta}
                required
                displayUser={displayUser}
              />
              <p className="text-[13px] leading-5 text-[var(--app-muted)]">默认已选中自己，点击可取消。多人时分别进入各自待办，按人开始处理和完成。</p>
            </div>

            <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] p-4">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-[10px] bg-[var(--app-primary)]/10 text-[var(--app-primary)]">
                  <Calendar size={16} strokeWidth={1.5} />
                </span>
                <div>
                  <div className="text-[15px] font-semibold">截止日期</div>
                  <div className="text-[13px] text-[var(--app-muted)]">默认截止到 23:59</div>
                </div>
              </div>

              <ElegantDatePicker
                value={form.due_date}
                onChange={(due_date) => setForm({ ...form, due_date })}
                showTime={form.due_has_time}
                timeValue={form.due_time}
                onTimeChange={(due_time) => setForm({ ...form, due_time })}
                onToggleTime={() => setForm({ ...form, due_has_time: !form.due_has_time })}
              />
            </div>

            <div className="rounded-[10px] border border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                className="flex h-12 w-full items-center justify-between px-4 text-[15px] font-medium transition-colors hover:bg-[var(--app-panel-soft)]"
              >
                高级字段
                <ChevronDown size={16} strokeWidth={1.5} className={`text-[var(--app-muted)] transition ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>

              {advancedOpen && (
                <div className="space-y-5 border-t border-[var(--app-border)] p-4">
                  <PriorityControl priorities={meta.priorities} value={form.priority} onChange={(priority) => setForm({ ...form, priority })} />

                  <SingleUserSelect
                    label="确认"
                    users={meta.users}
                    value={form.confirmer_id}
                    onChange={(confirmer_id) => setForm({ ...form, confirmer_id })}
                    emptyLabel="不指定"
                    displayUser={displayUser}
                  />

                  <UserMultiPicker
                    label="协作人 / 关注人"
                    helper="用于同步任务进展，不影响实际负责人。"
                    users={meta.users}
                    selectedIds={form.participant_ids}
                    onChange={(participant_ids) => setForm({ ...form, participant_ids })}
                    displayUser={displayUser}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--app-border)] bg-[var(--app-panel)] px-6 py-4">
          <div className="min-w-0 text-[15px] text-red-600 dark:text-red-300">{error}</div>
          <div className="flex shrink-0 items-center gap-2.5">
            <button type="button" onClick={closeModal} disabled={saving} className="h-11 rounded-[10px] border border-[var(--app-border)] px-5 text-[15px] font-medium text-[var(--app-muted)] transition-colors disabled:opacity-60 hover:bg-[var(--app-panel-soft)]">
              取消
            </button>
            <button type="button" disabled={saving || !form.title.trim()} onClick={submit} className="h-11 rounded-[10px] bg-[var(--app-primary)] px-6 text-[15px] font-medium text-white transition-colors disabled:opacity-60 hover:bg-[var(--app-primary-strong)]">
              {saving ? '创建中...' : '创建任务'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
