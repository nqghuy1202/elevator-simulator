import type { ConnectionStatus } from '../store/uiSlice.js';
import './ConnectionBadge.css';

export interface ConnectionBadgeProps {
  readonly status: ConnectionStatus;
}

const LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  connected: 'Connected',
  disconnected: 'Disconnected',
};

/**
 * Reflects `uiSlice.connectionStatus` 1:1 (EXPERIENCE.md Component Patterns)
 * — informational only, no retry action, since the socket layer already
 * auto-reconnects on its own.
 */
export function ConnectionBadge({ status }: ConnectionBadgeProps) {
  return (
    <span className={`connection-badge connection-badge--${status}`} role="status">
      <span className="connection-badge__dot" aria-hidden="true" />
      {LABEL[status]}
    </span>
  );
}
