import type { ReactNode } from "react";
import { Archive, Check, ExternalLink, Mail } from "lucide-react";
import { cn } from "../lib/utils";

interface InboxActionBarButtonProps {
  label: string;
  keys: string[];
  onClick: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}

function InboxActionBarButton({
  label,
  keys,
  onClick,
  disabled,
  icon,
}: InboxActionBarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground transition-colors",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      {icon}
      <span>{label}</span>
      <span className="flex items-center gap-0.5">
        {keys.map((key) => (
          <kbd
            key={key}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground"
          >
            {key}
          </kbd>
        ))}
      </span>
    </button>
  );
}

export interface InboxActionBarProps {
  visible: boolean;
  isMobile?: boolean;
  canOpen: boolean;
  canArchive: boolean;
  canMarkRead: boolean;
  canMarkUnread: boolean;
  archiveDisabled?: boolean;
  onOpen: () => void;
  onArchive: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
}

export function InboxActionBar({
  visible,
  isMobile = false,
  canOpen,
  canArchive,
  canMarkRead,
  canMarkUnread,
  archiveDisabled,
  onOpen,
  onArchive,
  onMarkRead,
  onMarkUnread,
}: InboxActionBarProps) {
  if (!visible) return null;

  const hasActions = canOpen || canArchive || canMarkRead || canMarkUnread;
  if (!hasActions) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4",
        isMobile
          ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
          : "bottom-6",
      )}
      data-testid="inbox-action-bar"
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-xl border border-border",
          "bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur-sm",
        )}
      >
        {canOpen && (
          <InboxActionBarButton
            label="Open"
            keys={["Enter"]}
            onClick={onOpen}
            icon={<ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
          />
        )}
        {canArchive && (
          <InboxActionBarButton
            label="Archive"
            keys={["A", "Y", "E"]}
            onClick={onArchive}
            disabled={archiveDisabled}
            icon={<Archive className="h-3.5 w-3.5 text-muted-foreground" />}
          />
        )}
        {canMarkRead && (
          <InboxActionBarButton
            label="Mark read"
            keys={["R"]}
            onClick={onMarkRead}
            icon={<Check className="h-3.5 w-3.5 text-muted-foreground" />}
          />
        )}
        {canMarkUnread && (
          <InboxActionBarButton
            label="Mark unread"
            keys={["⇧", "U"]}
            onClick={onMarkUnread}
            icon={<Mail className="h-3.5 w-3.5 text-muted-foreground" />}
          />
        )}
      </div>
    </div>
  );
}
