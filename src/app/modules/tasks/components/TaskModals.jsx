import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BellRing, Bold, Check, FileCheck2, ImagePlus, Italic, Link2, List, RefreshCw, Search, X } from 'lucide-react';

export function ReminderModal({
  open,
  task,
  onClose,
  onSubmit,
  reminderTargetForTask,
  displayUser,
  formatFullDateTime,
}) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const linkInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const initializedRef = useRef(false);
  const rawTargets = reminderTargetForTask(task);
  const targetList = Array.isArray(rawTargets) ? rawTargets : rawTargets ? [rawTargets] : [];
  const targetsText = targetList.map((target) => displayUser(target)).join('、');

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      setLinkOpen(false);
      setLinkUrl('');
      setError('');
      setSaving(false);
      return;
    }
    if (!editorRef.current || initializedRef.current) return;
    editorRef.current.innerHTML = '请尽快处理该任务';
    initializedRef.current = true;
  }, [open, task?.id]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  function syncValue() {
    return editorRef.current?.innerHTML || '';
  }

  function runCommand(command) {
    editorRef.current?.focus();
    document.execCommand(command, false, null);
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
      document.execCommand('insertHTML', false, `<img src="${reader.result}" alt="图片">`);
    };
    reader.readAsDataURL(file);
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
    closeLinkEditor();
  }

  function handleLinkKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyLink();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLinkEditor();
      editorRef.current?.focus();
    }
  }

  async function submit() {
    const remark = syncValue().replace(/<[^>]*>/g, '').trim();
    if (!remark) {
      setError('请填写催办说明');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit(task, syncValue());
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open || !task) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/30 px-4 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(15,23,42,0.24)] animate-modalPop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
          <div className="flex items-center gap-2 text-base font-semibold text-amber-600 dark:text-amber-400">
            <BellRing size={20} />
            催办说明
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-700/50 dark:bg-amber-900/30">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-amber-700 dark:text-amber-400">催办对象：</span>
              <span className="font-medium text-amber-800 dark:text-amber-300">{targetsText}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-sm">
              <span className="text-amber-700 dark:text-amber-400">任务标题：</span>
              <span className="truncate font-medium text-amber-800 dark:text-amber-300">{task?.title}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-sm">
              <span className="text-amber-700 dark:text-amber-400">截止时间：</span>
              <span className="font-medium text-amber-800 dark:text-amber-300">{task?.due_at ? formatFullDateTime(task.due_at) : '未设置'}</span>
            </div>
          </div>
          <p className="mb-3 text-xs text-[var(--app-muted)]">请填写催办说明（必填），支持富文本格式</p>

          <div className="relative mb-2 flex items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-1">
            {[
              ['bold', Bold, '加粗'],
              ['italic', Italic, '斜体'],
              ['insertUnorderedList', List, '列表'],
            ].map(([command, CmdIcon, label]) => (
              <button
                key={command}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runCommand(command)}
                className="grid size-7 place-items-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
                title={label}
              >
                <CmdIcon size={14} />
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={openLinkEditor}
              className={`grid size-7 place-items-center rounded-md transition ${
                linkOpen ? 'bg-[var(--app-primary)]/10 text-[var(--app-primary)]' : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'
              }`}
              title="插入链接"
            >
              <Link2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="grid size-7 place-items-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]"
              title="插入图片"
            >
              <ImagePlus size={14} />
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => insertImage(event.target.files?.[0])} />

            {linkOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[260px] rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-2 shadow-lg">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--app-text)]">
                  <span className="grid size-5 place-items-center rounded bg-[var(--app-primary)]/10 text-[var(--app-primary)]">
                    <Link2 size={12} />
                  </span>
                  链接地址
                </div>
                <div className="flex items-center gap-1.5 rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] px-2 py-1.5 focus-within:border-[var(--app-primary)]">
                  <input
                    ref={linkInputRef}
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    onKeyDown={handleLinkKeyDown}
                    placeholder="https://..."
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    disabled={!linkUrl.trim()}
                    onClick={applyLink}
                    className="grid size-6 place-items-center rounded bg-[var(--app-primary)] text-white disabled:bg-[var(--app-panel-soft)] disabled:text-[var(--app-subtle)]"
                  >
                    <Check size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            ref={editorRef}
            className="task-rich-text min-h-[120px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[var(--app-primary)]"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            data-placeholder="请尽快处理该任务"
          />

          {error && (
            <div className="mt-2 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2.5 border-t border-[var(--app-border)] px-5 py-4">
          <button onClick={onClose} className="h-9 rounded-lg border border-[var(--app-border)] px-4 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)]">
            取消
          </button>
          <button
            onClick={submit}
            disabled={saving || targetList.length === 0}
            className="h-9 rounded-lg bg-amber-600 px-5 text-sm font-semibold text-white transition-all hover:bg-amber-700 shadow-md disabled:opacity-50"
          >
            <span className="flex items-center gap-1.5">
              <BellRing size={15} />
              {saving ? '提交中...' : '发送催办'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function TaskSearchModal({
  open,
  query,
  results,
  loading,
  error,
  activeIndex,
  inputRef,
  onQueryChange,
  onActiveIndexChange,
  onSelect,
  onClose,
  groupSearchTasks,
  displayUser,
  dueMeta,
  Badge,
  badgeClass,
  statusTone,
  searchGroupKey,
  statusLabels,
}) {
  const groups = useMemo(() => groupSearchTasks(results), [results, groupSearchTasks]);
  const flatResults = useMemo(() => groups.flatMap((group) => group.tasks), [groups]);
  const activeTask = flatResults[activeIndex];
  const isEmptyQuery = !query.trim();
  const [selectionMode, setSelectionMode] = useState('keyboard');
  const scrollContainerRef = useRef(null);
  const pointerPositionRef = useRef(null);
  const ignoreStaticPointerRef = useRef(false);

  useEffect(() => {
    if (!open || !activeTask) return;
    const scrollContainer = scrollContainerRef.current;
    const activeElement = document.getElementById(`task-search-result-${activeTask.id}`);
    if (!scrollContainer || !activeElement) return;

    if (activeIndex === 0) {
      scrollContainer.scrollTo({ top: 0 });
      return;
    }

    const activeGroup = groups.find((group) => group.tasks.some((task) => task.id === activeTask.id));
    const isFirstInGroup = activeGroup?.tasks[0]?.id === activeTask.id;
    const containerRect = scrollContainer.getBoundingClientRect();

    if (isFirstInGroup) {
      const groupHeader = document.getElementById(`task-search-group-${activeGroup.key}`);
      const groupHeaderRect = groupHeader?.getBoundingClientRect();
      if (groupHeaderRect && groupHeaderRect.top < containerRect.top) {
        scrollContainer.scrollTop += groupHeaderRect.top - containerRect.top;
        return;
      }
    }

    const activeRect = activeElement.getBoundingClientRect();
    if (activeRect.top < containerRect.top) {
      scrollContainer.scrollTop += activeRect.top - containerRect.top;
    } else if (activeRect.bottom > containerRect.bottom) {
      scrollContainer.scrollTop += activeRect.bottom - containerRect.bottom;
    }
  }, [activeIndex, activeTask, groups, open]);

  useEffect(() => {
    if (open) setSelectionMode('keyboard');
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    pointerPositionRef.current = null;
    ignoreStaticPointerRef.current = false;
  }, [open]);

  function moveActive(offset) {
    if (!flatResults.length) return;
    setSelectionMode('keyboard');
    ignoreStaticPointerRef.current = true;
    onActiveIndexChange((current) => (current + offset + flatResults.length) % flatResults.length);
  }

  function handleResultPointerMove(resultIndex, event) {
    const nextPosition = { x: event.clientX, y: event.clientY };
    const previousPosition = pointerPositionRef.current;
    const pointerMoved = !previousPosition
      || previousPosition.x !== nextPosition.x
      || previousPosition.y !== nextPosition.y;
    pointerPositionRef.current = nextPosition;

    if (ignoreStaticPointerRef.current) {
      if (!previousPosition || !pointerMoved) return;
      ignoreStaticPointerRef.current = false;
    }

    if (selectionMode !== 'pointer') {
      setSelectionMode('pointer');
    }
    if (resultIndex !== activeIndex) {
      onActiveIndexChange(resultIndex);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === 'Enter' && activeTask) {
      event.preventDefault();
      onSelect(activeTask);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[800px] overflow-hidden rounded-[16px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.32)] animate-modalPop"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="搜索任务"
      >
        <div className="flex h-16 items-center gap-3 border-b border-[var(--app-border)] px-5">
          <Search size={20} strokeWidth={1.5} className="shrink-0 text-[var(--app-muted)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            className="task-search-input h-full min-w-0 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-[var(--app-subtle)]"
            placeholder="搜索任务、人员、部门"
            autoComplete="off"
          />
          {loading && <RefreshCw size={16} strokeWidth={1.5} className="shrink-0 animate-spin text-[var(--app-muted)]" aria-hidden="true" />}
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[var(--app-muted)] transition-all duration-200 hover:bg-[var(--app-panel-soft)]"
            aria-label="关闭搜索"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div ref={scrollContainerRef} className="max-h-[58vh] overflow-y-auto p-3">
          <div className="px-2 pb-2 pt-1 text-[13px] font-semibold text-[var(--app-subtle)]">
            {isEmptyQuery ? '最近任务' : '搜索结果'}
          </div>

          {error && (
            <div className="mx-2 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-[15px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {!error && !loading && !flatResults.length && (
            <div className="mx-2 rounded-[12px] border border-dashed border-[var(--app-border)] px-4 py-10 text-center text-[15px] text-[var(--app-muted)]">
              {isEmptyQuery ? '暂无最近任务' : '没有匹配的任务'}
            </div>
          )}

          {!error && groups.map((group) => (
            <div key={group.key} className="mb-3 last:mb-0">
              <div id={`task-search-group-${group.key}`} className="flex h-9 items-center gap-2 px-2 text-[13px] font-semibold text-[var(--app-muted)]">
                <group.Icon size={14} strokeWidth={1.5} className={group.className} aria-hidden="true" />
                <span>{group.label}</span>
                <span className="rounded-[8px] bg-[var(--app-panel-soft)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--app-muted)]">
                  {group.tasks.length}
                </span>
              </div>

              <div className="space-y-1.5">
                {group.tasks.map((task) => {
                  const resultIndex = flatResults.findIndex((item) => item.id === task.id);
                  const isActive = resultIndex === activeIndex;
                  return (
                    <button
                      key={task.id}
                      id={`task-search-result-${task.id}`}
                      type="button"
                      onPointerMove={(event) => handleResultPointerMove(resultIndex, event)}
                      onClick={() => onSelect(task)}
                      className={`flex min-h-[68px] w-full items-center gap-3 rounded-[12px] px-4 py-3 text-left transition-all duration-200 ${
                        isActive
                          ? 'bg-[var(--app-panel-soft)] shadow-[inset_0_0_0_1px_var(--app-border)]'
                          : selectionMode === 'pointer'
                            ? 'hover:bg-[var(--app-panel-soft)]'
                            : ''
                      }`}
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-muted)]">
                        <FileCheck2 size={18} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.02em] text-[var(--app-subtle)]">{task.code}</span>
                          <span className="truncate text-[15px] font-semibold">{task.title}</span>
                        </div>
                        {task.is_limited_view ? (
                          <div className="mt-1.5 text-[13px] text-[var(--app-muted)]">我的待办</div>
                        ) : (
                          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--app-muted)]">
                            <span className="truncate">{displayUser(task.owner)}</span>
                            <span className="text-[var(--app-subtle)]">·</span>
                            <span className="truncate">{task.department?.name || '-'}</span>
                            <span className="text-[var(--app-subtle)]">·</span>
                            <span className={dueMeta(task).className}>{dueMeta(task).label}</span>
                          </div>
                        )}
                      </div>
                      <Badge className={badgeClass(statusTone, searchGroupKey(task))}>
                        {searchGroupKey(task) === 'overdue' ? '已超时' : statusLabels[task.status]}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
