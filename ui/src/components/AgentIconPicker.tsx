import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { AGENT_ICON_NAMES, type AgentIconName } from "@paperclipai/shared";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { AGENT_ICONS, getAgentIcon } from "../lib/agent-icons";

const DEFAULT_ICON: AgentIconName = "bot";

interface AgentIconProps {
  icon: string | null | undefined;
  className?: string;
}

export function AgentIcon({ icon, className }: AgentIconProps) {
  const Icon = getAgentIcon(icon);
  return <Icon className={className} />;
}

interface AgentAvatarProps {
  name: string;
  icon: string | null | undefined;
  avatarUrl?: string | null;
  className?: string;
  imageClassName?: string;
}

export function AgentAvatar({ name, icon, avatarUrl, className, imageClassName }: AgentAvatarProps) {
  if (avatarUrl) {
    return (
      <Avatar className={cn("rounded-lg", className)}>
        <AvatarImage src={avatarUrl} alt={name} className={cn("object-cover", imageClassName)} />
        <AvatarFallback className="rounded-lg">
          <AgentIcon icon={icon} className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
    );
  }

  return <AgentIcon icon={icon} className={className} />;
}

interface AgentIconPickerProps {
  value: string | null | undefined;
  onChange: (icon: string) => void;
  avatarUrl?: string | null;
  agentName?: string;
  onUploadAvatar?: (file: File) => void;
  onClearAvatar?: () => void;
  avatarUploadPending?: boolean;
  children: React.ReactNode;
}

export function AgentIconPicker({
  value,
  onChange,
  avatarUrl,
  agentName,
  onUploadAvatar,
  onClearAvatar,
  avatarUploadPending = false,
  children,
}: AgentIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const entries = AGENT_ICON_NAMES.map((name) => [name, AGENT_ICONS[name]] as const);
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(([name]) => name.includes(q));
  }, [search]);

  function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (!file || !onUploadAvatar) return;
    onUploadAvatar(file);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        {(onUploadAvatar || onClearAvatar) && (
          <div className="mb-3 space-y-2 border-b border-border pb-3">
            <p className="text-xs font-medium text-muted-foreground">Profile photo</p>
            <div className="flex items-center gap-2">
              <Avatar className="size-10 rounded-lg">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={agentName ?? "Agent"} className="object-cover" /> : null}
                <AvatarFallback className="rounded-lg">
                  <AgentIcon icon={value} className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {onUploadAvatar ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAvatarFileChange}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={avatarUploadPending}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="mr-1 h-3.5 w-3.5" />
                      Upload
                    </Button>
                  </>
                ) : null}
                {onClearAvatar && avatarUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    disabled={avatarUploadPending}
                    onClick={() => {
                      onClearAvatar();
                      setOpen(false);
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}
        <Input
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8 text-sm"
          autoFocus
        />
        <div className="grid max-h-48 grid-cols-7 gap-1 overflow-y-auto">
          {filtered.map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onChange(name);
                setOpen(false);
                setSearch("");
              }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-accent",
                (value ?? DEFAULT_ICON) === name && "bg-accent ring-1 ring-primary",
              )}
              title={name}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-7 py-2 text-center text-xs text-muted-foreground">No icons match</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
