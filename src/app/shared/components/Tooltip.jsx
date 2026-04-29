import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function Tooltip({ content, children, className = 'inline-block' }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2,
    });
  }, [visible]);

  if (!content) return children;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className={className}
      >
        {children}
      </div>
      {visible && createPortal(
        <div
          className="fixed z-[100] rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 py-2 text-[13px] text-[var(--app-text)] shadow-[var(--shadow-lg)] animate-tooltipPop"
          style={{
            top: position.top,
            left: position.left,
            transform: 'translateX(-50%)',
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </>
  );
}
