import { useEffect, useRef, useId, type ReactNode } from 'react';
import { X, Zap, Scissors, Bike, Hammer, Wrench, ArrowUpRight, LoaderCircle } from 'lucide-react';
import {
  categoryLabels,
  statusLabels,
  type Category,
  type Status,
  type Ticket,
} from '../shared/model.ts';

export function CategoryIcon({ category, size = 19 }: { category: Category; size?: number }) {
  const Icon = {
    electrical: Zap,
    textiles: Scissors,
    bicycles: Bike,
    woodwork: Hammer,
    general: Wrench,
  }[category];
  return (
    <span className={`category-icon ${category}`} aria-label={categoryLabels[category]}>
      <Icon size={size} strokeWidth={1.65} />
    </span>
  );
}
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge ${status}`}>
      <i />
      {statusLabels[status]}
    </span>
  );
}
export function TicketNumber({ ticket }: { ticket: Ticket }) {
  return <span className="ticket-number">#{String(ticket.number).padStart(3, '0')}</span>;
}
export function Button({
  children,
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button {...props} disabled={props.disabled || busy}>
      {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <div>
            <p className="eyebrow">MENDROOM</p>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={14} />
    </button>
  );
}
export function FormError({ error }: { error: string }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
