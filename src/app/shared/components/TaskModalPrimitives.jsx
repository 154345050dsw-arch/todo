import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Check, ChevronDown, ImagePlus, Italic, Link2, List, X } from 'lucide-react';

export function RichTextModal({ open, onClose, onSubmit, value, onChange, saving, config }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const linkInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    if (!open || !editorRef.current) return;
    editorRef.current.innerHTML = value || '';
  }, [open]);

  useEffect(() => {
    if (!open || !editorRef.current) return;
    if (document.activeElement === editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      setLinkOpen(false);
      setLinkUrl('');
    }
  }, [open]);

  function syncValue() {
    onChange(editorRef.current?.innerHTML || '');
  }

  function runCommand(command) {
    editorRef.current?.focus();
    document.execCommand(command, false, null);
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
      document.execCommand('insertHTML', false, `<img src="${reader.result}" alt="图片">`);
      syncValue();
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
    syncValue();
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

  if (!open) return null;

  const { icon: Icon, title, hint, placeholder, submitLabel, color } = config;
  const hasContent = value.replace(/<[^>]*>/g, '').trim();

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30 px-4 py-6 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md animate-modalPop rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel)] shadow-[0_24px_80px_rgba(15,23,42,0.24)]" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
          <div className={`flex items-center gap-2 text-base font-semibold ${color.text}`}>
            <Icon size={20} />
            {title}
          </div>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4">
          {config.targetInfo && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-700/50 dark:bg-amber-900/30">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-amber-700 dark:text-amber-400">催办对象：</span>
                <span className="font-medium text-amber-800 dark:text-amber-300">{config.targetInfo}</span>
              </div>
              {config.senderInfo && <div className="mt-1.5 flex items-center gap-2 text-sm"><span className="text-amber-700 dark:text-amber-400">催办人：</span><span className="font-medium text-amber-800 dark:text-amber-300">{config.senderInfo}</span></div>}
              {config.taskTitle && <div className="mt-1.5 flex items-center gap-2 text-sm"><span className="text-amber-700 dark:text-amber-400">任务标题：</span><span className="truncate font-medium text-amber-800 dark:text-amber-300">{config.taskTitle}</span></div>}
              {config.dueAt && <div className="mt-1.5 flex items-center gap-2 text-sm"><span className="text-amber-700 dark:text-amber-400">截止时间：</span><span className="font-medium text-amber-800 dark:text-amber-300">{config.dueAt}</span></div>}
            </div>
          )}
          <p className="mb-3 text-xs text-[var(--app-muted)]">{hint}</p>

          <div className="relative mb-2 flex items-center gap-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-1">
            {[
              ['bold', Bold, '加粗'],
              ['italic', Italic, '斜体'],
              ['insertUnorderedList', List, '列表'],
            ].map(([command, CmdIcon, label]) => (
              <button key={command} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand(command)} className="grid size-7 place-items-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]" title={label}>
                <CmdIcon size={14} />
              </button>
            ))}
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={openLinkEditor} className={`grid size-7 place-items-center rounded-md transition ${linkOpen ? 'bg-[var(--app-primary)]/10 text-[var(--app-primary)]' : 'text-[var(--app-muted)] hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]'}`} title="插入链接">
              <Link2 size={14} />
            </button>
            <button type="button" onClick={() => imageInputRef.current?.click()} className="grid size-7 place-items-center rounded-md text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text)]" title="插入图片">
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
                  <input ref={linkInputRef} value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onKeyDown={handleLinkKeyDown} placeholder="https://..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" autoComplete="off" />
                  <button type="button" disabled={!linkUrl.trim()} onClick={applyLink} className="grid size-6 place-items-center rounded bg-[var(--app-primary)] text-white disabled:bg-[var(--app-panel-soft)] disabled:text-[var(--app-subtle)]">
                    <Check size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div ref={editorRef} className="task-rich-text min-h-[120px] rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[var(--app-primary)]" contentEditable suppressContentEditableWarning role="textbox" data-placeholder={placeholder} onInput={syncValue} />
        </div>

        <div className="flex justify-end gap-2.5 border-t border-[var(--app-border)] px-5 py-4">
          <button onClick={onClose} className="h-9 rounded-lg border border-[var(--app-border)] px-4 text-sm font-medium text-[var(--app-muted)] transition-colors hover:bg-[var(--app-panel-soft)]">
            取消
          </button>
          <button onClick={onSubmit} disabled={saving || !hasContent} className={`h-9 rounded-lg px-5 text-sm font-semibold text-white transition-all disabled:opacity-50 ${color.button}`}>
            <span className="flex items-center gap-1.5">
              <Icon size={15} />
              {saving ? '提交中...' : submitLabel}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-5">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between py-2.5 text-[15px] font-medium text-[var(--app-muted)] transition-colors hover:text-[var(--app-text)]">
        <span>{title}</span>
        <ChevronDown size={18} strokeWidth={1.5} className={`text-[var(--app-subtle)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="animate-slideDown">
          {children}
        </div>
      )}
    </section>
  );
}
