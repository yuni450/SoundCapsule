import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export default function RecordingMenu({ title, busy, onDownload, onDelete }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const menuId = useId();
  const positioned = position !== null;
  const close = (restoreFocus = false) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) trigger.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current.getBoundingClientRect();
      const rect = menu.current.getBoundingClientRect();
      const top = anchor.bottom + 6 + rect.height <= window.innerHeight - 12
        ? anchor.bottom + 6 : anchor.top - rect.height - 6;
      setPosition({
        top: Math.max(12, Math.min(top, window.innerHeight - rect.height - 12)),
        left: Math.max(12, Math.min(anchor.right - rect.width, window.innerWidth - rect.width - 12)),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (open && positioned) menu.current?.querySelector('button')?.focus();
  }, [open, positioned]);

  useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (!menu.current?.contains(event.target) && !trigger.current?.contains(event.target)) close();
    };
    const escape = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const navigate = (event) => {
    const buttons = [...menu.current.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (next !== undefined) { event.preventDefault(); buttons[next].focus(); }
  };
  const choose = (action) => { close(true); action(); };

  return (
    <div className="sc-card-menu">
      <button ref={trigger} className="sc-menu-trigger" type="button" aria-label={`${title} 메뉴`}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        disabled={busy} onClick={() => open ? close() : setOpen(true)}>
        ⋯
      </button>
      {open && <div ref={menu} id={menuId} className="sc-dropdown" role="menu" aria-label={`${title} 작업`}
        style={{ ...position, visibility: position ? 'visible' : 'hidden' }} onKeyDown={navigate}>
        <button role="menuitem" type="button" onClick={() => choose(onDownload)}>다운로드</button>
        <button role="menuitem" type="button" className="sc-menu-delete" onClick={() => choose(onDelete)}>삭제</button>
      </div>}
    </div>
  );
}
