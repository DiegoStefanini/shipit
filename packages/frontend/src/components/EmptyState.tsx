import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: 'projects' | 'hosts' | 'monitoring' | 'logs' | 'security' | 'alerts';
  title: string;
  children?: ReactNode;
}

const icons: Record<string, React.JSX.Element> = {
  projects: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".4">
      <rect x="5" y="5" width="13" height="13" rx="3"/>
      <rect x="22" y="5" width="13" height="13" rx="3"/>
      <rect x="5" y="22" width="13" height="13" rx="3"/>
      <rect x="22" y="22" width="13" height="13" rx="3" strokeDasharray="4 2"/>
    </svg>
  ),
  hosts: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".4">
      <rect x="4" y="6" width="32" height="12" rx="3"/>
      <rect x="4" y="22" width="32" height="12" rx="3"/>
      <circle cx="10" cy="12" r="1.5" fill="var(--accent)" stroke="none"/>
      <circle cx="10" cy="28" r="1.5" fill="var(--accent)" stroke="none"/>
      <line x1="16" y1="12" x2="30" y2="12"/>
      <line x1="16" y1="28" x2="30" y2="28"/>
    </svg>
  ),
  monitoring: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".4">
      <polyline points="4 32 12 18 20 24 28 10 36 16"/>
      <circle cx="12" cy="18" r="2" fill="none"/>
      <circle cx="28" cy="10" r="2" fill="none"/>
    </svg>
  ),
  logs: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".4">
      <rect x="6" y="4" width="28" height="32" rx="3"/>
      <line x1="12" y1="12" x2="28" y2="12"/>
      <line x1="12" y1="18" x2="24" y2="18"/>
      <line x1="12" y1="24" x2="28" y2="24"/>
      <line x1="12" y1="30" x2="20" y2="30"/>
    </svg>
  ),
  security: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".4">
      <path d="M20 4l14 6v10c0 10-6 14-14 18C12 34 6 30 6 20V10L20 4z"/>
      <polyline points="14 20 18 24 26 16" stroke="var(--green)"/>
    </svg>
  ),
  alerts: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="var(--yellow)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".4">
      <path d="M20 6a10 10 0 00-10 10c0 6-2 8-2 8h24s-2-2-2-8a10 10 0 00-10-10z"/>
      <path d="M16 34a4 4 0 008 0"/>
      <line x1="20" y1="2" x2="20" y2="6"/>
    </svg>
  ),
};

export default function EmptyState({ icon, title, children }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-state-icon">{icons[icon]}</div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}
