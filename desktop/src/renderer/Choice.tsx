import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

interface ChoiceProps {
  label: string; value: string; options: readonly string[]; onChange: (value: string) => void;
  editable?: boolean; disabled?: boolean; display?: (value: string) => string;
}

/** DOM-only popup: all options remain inside the protected Electron window. */
export function Choice({ label, value, options, onChange, editable = false, disabled = false, display = (v) => v }: ChoiceProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [above, setAbove] = useState(false);
  const shown = (editable ? options.filter((option) => !value || option.toLowerCase().includes(value.toLowerCase())) : options);
  const choices = shown.length ? shown : options;
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [id, active, open]);
  function show() {
    setAbove((root.current?.getBoundingClientRect().bottom ?? 0) + 210 > window.innerHeight);
    setActive(Math.max(0, choices.indexOf(value)));
    setOpen(true);
  }
  function select(option: string) { onChange(option); setOpen(false); }
  function keyDown(event: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && (!editable || open || event.key.startsWith('Arrow'))) {
      event.preventDefault();
      if (!open) show();
      else setActive((index) => event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 :
        (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault(); event.stopPropagation(); if (choices[active]) select(choices[active]);
    } else if (event.key === ' ' && !editable) { event.preventDefault(); if (open && choices[active]) select(choices[active]); else show(); }
    else if (event.key === 'Tab') setOpen(false);
    else if (!editable && event.key.length === 1) {
      const index = choices.findIndex((option) => display(option).toLowerCase().startsWith(event.key.toLowerCase()));
      if (index >= 0) { event.preventDefault(); setActive(index); if (!open) onChange(choices[index]!); }
    }
  }
  const aria = { 'aria-label': label, 'aria-expanded': open, 'aria-controls': `${id}-list`,
    'aria-activedescendant': open ? `${id}-${active}` : undefined, 'aria-autocomplete': editable ? 'list' as const : 'none' as const };
  return <div className={`choice ${above ? 'choice-above' : ''}`} ref={root} onKeyDown={keyDown}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <label id={`${id}-label`} htmlFor={id}>{label}</label>
    <div className="choice-control">
      {editable ? <input id={id} role="combobox" {...aria} value={value} maxLength={160} disabled={disabled}
        autoComplete="off" spellCheck={false} onChange={(event) => { onChange(event.target.value); setActive(0); show(); }} /> :
        <button id={id} type="button" role="combobox" {...aria} disabled={disabled} onClick={() => open ? setOpen(false) : show()}>{display(value)}</button>}
      {editable && <button type="button" className="choice-toggle" aria-label={`${label} suggestions`} disabled={disabled}
        tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => {
          root.current?.querySelector('input')?.focus();
          if (open) setOpen(false); else show();
        }}>▾</button>}
      {!editable && <span className="choice-arrow" aria-hidden="true">▾</span>}
    </div>
    {open && !disabled && <div id={`${id}-list`} role="listbox" aria-label={label} className="choice-list">
      {choices.map((option, index) => <div key={option} id={`${id}-${index}`} role="option" aria-selected={option === value}
        className={active === index ? 'active' : ''} onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActive(index)} onClick={() => select(option)}>{display(option)}</div>)}
    </div>}
  </div>;
}
