// PROTOTYPE — throwaway. Ticket "Como as notificações aparecem dentro do app" (#18).
// Three structurally different ways Notifications surface inside Cadence,
// switchable via ?variant=A|B|C|D (remembered in a cookie across navigation)
// and the floating bar at the bottom-centre. Read state lives in memory only.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Dialog, Popover } from "radix-ui";
import {
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MessageSquare,
  Reply,
  X,
} from "lucide-react";
import { cn, formatRelativeTime } from "~/lib/utils";
import type {
  ProtoNotification,
  ProtoNotificationType,
} from "./data.server";

export const VARIANTS = {
  A: "Sino + Popover",
  B: "Inbox em painel",
  C: "Distribuída, sem central",
  D: "Sino + Popover com filtro",
} as const;
export type VariantKey = keyof typeof VARIANTS;
const KEYS = Object.keys(VARIANTS) as VariantKey[];
export const VARIANT_COOKIE = "proto_variant";

function persistVariant(v: VariantKey) {
  document.cookie = `${VARIANT_COOKIE}=${v}; path=/; SameSite=Lax`;
}

// ---------------------------------------------------------------- state

export function useProtoNotifications(initial: ProtoNotification[]) {
  const [items, setItems] = useState(initial);
  const markRead = (ids: string[]) =>
    setItems((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
    );
  const markAllRead = () =>
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  return { items, markRead, markAllRead };
}
export type ProtoState = ReturnType<typeof useProtoNotifications>;

// URL wins; otherwise the cookie (read by the layout loader, so SSR matches
// and the variant survives navigation that drops ?variant=).
export function useVariant(fromCookie: string | null): VariantKey {
  const [params] = useSearchParams();
  const fromUrl = params.get("variant")?.toUpperCase();
  const isKey = (v: string | null | undefined): v is VariantKey =>
    !!v && KEYS.includes(v as VariantKey);
  const variant = isKey(fromUrl) ? fromUrl : isKey(fromCookie) ? fromCookie : "A";
  useEffect(() => persistVariant(variant), [variant]);
  return variant;
}

// ---------------------------------------------------------------- shared bits

const TYPE_META: Record<
  ProtoNotificationType,
  { label: string; icon: ReactNode }
> = {
  new_comment: {
    label: "Comment novo",
    icon: <MessageSquare className="size-4" />,
  },
  reply: { label: "Resposta", icon: <Reply className="size-4" /> },
  new_lesson: { label: "Lesson nova", icon: <BookOpen className="size-4" /> },
};

function hrefFor(n: ProtoNotification) {
  return `/courses/${n.courseSlug}/lessons/${n.lessonId}`;
}

function headline(n: ProtoNotification) {
  switch (n.type) {
    case "new_comment":
      return `${n.actorName} comentou em ${n.lessonTitle}`;
    case "reply":
      return `${n.actorName} respondeu seu Comment em ${n.lessonTitle}`;
    case "new_lesson":
      return `Nova Lesson em ${n.courseTitle}: ${n.lessonTitle}`;
  }
}

// "Ana, Bruno e Carla responderam em Lesson X": names every actor so the
// count of the group is visible, instead of a vague "e mais N".
function groupHeadline(items: ProtoNotification[]) {
  const [first] = items;
  const names = [...new Set(items.map((n) => n.actorName ?? "?"))];
  const who =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  const plural = names.length > 1;
  const verb =
    first.type === "reply"
      ? plural ? "responderam seu Comment" : "respondeu seu Comment"
      : plural ? "comentaram" : "comentou";
  return `${who} ${verb} em ${first.lessonTitle}`;
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "ml-auto min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-primary-foreground",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function useOpenNotification(state: ProtoState) {
  const navigate = useNavigate();
  return (ids: string[], n: ProtoNotification) => {
    state.markRead(ids);
    navigate(hrefFor(n));
  };
}

type Group = { key: string; items: ProtoNotification[] };

// Popover/inbox grouping: one row per Comment thread, Lessons stay single.
function groupByThread(items: ProtoNotification[]): Group[] {
  const groups = new Map<string, ProtoNotification[]>();
  for (const n of items) {
    const key = n.threadId ? `t${n.threadId}` : n.id;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, items }));
}

function GroupRow({
  group,
  onOpen,
  dense,
}: {
  group: Group;
  onOpen: (ids: string[], n: ProtoNotification) => void;
  dense?: boolean;
}) {
  const [first] = group.items;
  const unread = group.items.filter((n) => !n.read).length;
  const others = group.items.length - 1;
  return (
    <button
      type="button"
      onClick={() => onOpen(group.items.map((n) => n.id), first)}
      className={cn(
        "flex w-full gap-3 rounded-md px-3 text-left text-sm transition-colors hover:bg-accent",
        dense ? "py-2" : "py-3",
        unread > 0 ? "font-medium" : "text-muted-foreground"
      )}
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground">
        {TYPE_META[first.type].icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">
          {others > 0 ? groupHeadline(group.items) : headline(first)}
          {others > 0 && (
            <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {group.items.length} notificações
            </span>
          )}
        </span>
        {first.excerpt && !dense && (
          <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
            “{first.excerpt}”
          </span>
        )}
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
          {first.courseTitle} · {formatRelativeTime(first.createdAt)}
        </span>
      </span>
      {unread > 0 && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="não lida" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------- Variant A
// Bell at the top of the sidebar → Popover grouped by Comment thread.
// Questions keeps its own badge (unread "Comment novo"), so an Instructor sees
// the same event twice: once as work (Questions) and once as news (bell).

function VariantABell({ state }: { state: ProtoState }) {
  const [open, setOpen] = useState(false);
  const openN = useOpenNotification(state);
  const unread = state.items.filter((n) => !n.read).length;
  const groups = groupByThread(state.items);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Notificações, ${unread} não lidas`}
          className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={12}
          className="z-50 w-96 rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold">Notificações</span>
            <button
              type="button"
              onClick={state.markAllRead}
              disabled={unread === 0}
              className="text-xs text-primary hover:underline disabled:opacity-40"
            >
              Marcar todas como lidas
            </button>
          </div>
          <div className="max-h-[28rem] overflow-y-auto p-1">
            {groups.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nada por aqui ainda.
              </p>
            ) : (
              groups.map((g) => (
                <GroupRow
                  key={g.key}
                  group={g}
                  onOpen={(ids, n) => {
                    setOpen(false);
                    openN(ids, n);
                  }}
                />
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------- filter (B, D)

type Tab = "unread" | "all";
type TypeFilter = ProtoNotificationType | "all";

function useFilter(state: ProtoState) {
  const [tab, setTab] = useState<Tab>("unread");
  const [type, setType] = useState<TypeFilter>("all");
  const unread = state.items.filter((n) => !n.read).length;
  const visible = state.items.filter(
    (n) => (tab === "all" || !n.read) && (type === "all" || n.type === type)
  );
  return { tab, setTab, type, setType, unread, visible };
}

function FilterBar({
  f,
  onMarkAll,
}: {
  f: ReturnType<typeof useFilter>;
  onMarkAll: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-2 text-sm">
      {(["unread", "all"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => f.setTab(t)}
          className={cn(
            "rounded-md px-2 py-1",
            f.tab === t ? "bg-accent font-medium" : "text-muted-foreground"
          )}
        >
          {t === "unread" ? `Não lidas (${f.unread})` : "Todas"}
        </button>
      ))}
      <select
        value={f.type}
        onChange={(e) => f.setType(e.target.value as TypeFilter)}
        className="ml-auto rounded-md border bg-background px-2 py-1 text-xs"
      >
        <option value="all">Todos os tipos</option>
        {Object.entries(TYPE_META).map(([k, m]) => (
          <option key={k} value={k}>
            {m.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onMarkAll}
        disabled={f.unread === 0}
        className="text-xs text-primary hover:underline disabled:opacity-40"
      >
        Marcar todas como lidas
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Variant D
// A's bell + B's filter, inside the Popover. Grouped by Comment within the
// filtered set. Questions has no badge: Comment novo lives in the bell only.

function VariantDBell({ state }: { state: ProtoState }) {
  const [open, setOpen] = useState(false);
  const f = useFilter(state);
  const openN = useOpenNotification(state);
  const groups = groupByThread(f.visible);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Notificações, ${f.unread} não lidas`}
          className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        >
          <Bell className="size-5" />
          {f.unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">
              {f.unread > 9 ? "9+" : f.unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={12}
          className="z-50 w-[28rem] rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="px-4 pt-3 font-semibold">Notificações</div>
          <FilterBar f={f} onMarkAll={state.markAllRead} />
          <div className="max-h-[28rem] overflow-y-auto p-1">
            {groups.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Tudo em dia.
              </p>
            ) : (
              groups.map((g) => (
                <GroupRow
                  key={g.key}
                  group={g}
                  onOpen={(ids, n) => {
                    setOpen(false);
                    openN(ids, n);
                  }}
                />
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------- Variant B
// No bell. A nav item "Notificações" with a count opens a full-height panel
// over the page: tabs Não lidas / Todas, filter by type, flat list (one row per
// Notification), per-row "marcar como lida". Questions gets no badge at all.

function VariantBPanel({ state }: { state: ProtoState }) {
  const [open, setOpen] = useState(false);
  const f = useFilter(state);
  const { unread, visible } = f;
  const openN = useOpenNotification(state);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Inbox className="size-4" />
          Notificações
          <CountBadge count={unread} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 left-56 z-40 bg-black/20" />
        <Dialog.Content className="fixed inset-y-0 left-56 z-50 flex w-[32rem] flex-col border-r bg-background shadow-xl">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <Dialog.Title className="text-lg font-semibold">
              Notificações
            </Dialog.Title>
            <Dialog.Close className="rounded p-1 hover:bg-accent">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <FilterBar f={f} onMarkAll={state.markAllRead} />
          <ul className="flex-1 divide-y overflow-y-auto">
            {visible.length === 0 && (
              <li className="p-10 text-center text-sm text-muted-foreground">
                Tudo em dia.
              </li>
            )}
            {visible.map((n) => (
              <li key={n.id} className="flex items-start gap-2 px-3">
                <div className="flex-1">
                  <GroupRow
                    group={{ key: n.id, items: [n] }}
                    onOpen={(ids, x) => {
                      setOpen(false);
                      openN(ids, x);
                    }}
                  />
                </div>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => state.markRead([n.id])}
                    className="mt-3 shrink-0 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                  >
                    Marcar como lida
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------- Variant C
// No central inbox. Notifications live where the work already is:
// - Comment novo (Instructor) → only the Questions badge; the queue IS the inbox.
// - Resposta / Lesson nova → a compact "Novidades" strip embedded in the
//   sidebar (max 3 unread) plus a badge on the matching Recent Course.
// Reading = visiting: opening the item marks it read; no "mark all".

function VariantCStrip({ state }: { state: ProtoState }) {
  const openN = useOpenNotification(state);
  const unread = state.items.filter((n) => !n.read && n.type !== "new_comment");
  if (unread.length === 0) return null;
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="mb-1 flex items-center px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        Novidades
        <CountBadge count={unread.length} />
      </div>
      {groupByThread(unread)
        .slice(0, 3)
        .map((g) => (
          <GroupRow key={g.key} group={g} onOpen={openN} dense />
        ))}
    </div>
  );
}

// ---------------------------------------------------------------- slots

export type SidebarSlots = {
  headerSlot?: ReactNode;
  navSlot?: ReactNode;
  belowNavSlot?: ReactNode;
  navBadges?: Record<string, number>;
  courseBadges?: Record<string, number>;
};

export function useSidebarSlots(
  variant: VariantKey,
  state: ProtoState
): SidebarSlots {
  return useMemo(() => {
    const unread = state.items.filter((n) => !n.read);
    const newComments = unread.filter((n) => n.type === "new_comment").length;
    switch (variant) {
      case "A":
        return {
          headerSlot: <VariantABell state={state} />,
          navBadges: { "/instructor/questions": newComments },
        };
      case "B":
        return { navSlot: <VariantBPanel state={state} /> };
      case "C": {
        const courseBadges: Record<string, number> = {};
        for (const n of unread) {
          if (n.type === "new_comment") continue;
          courseBadges[n.courseSlug] = (courseBadges[n.courseSlug] ?? 0) + 1;
        }
        return {
          belowNavSlot: <VariantCStrip state={state} />,
          navBadges: { "/instructor/questions": newComments },
          courseBadges,
        };
      }
      case "D":
        return { headerSlot: <VariantDBell state={state} /> };
    }
  }, [variant, state]);
}

// ---------------------------------------------------------------- switcher

export function PrototypeSwitcher({
  current,
  unread,
}: {
  current: VariantKey;
  unread: number;
}) {
  const [params, setParams] = useSearchParams();
  const go = (delta: number) => {
    const next = KEYS[(KEYS.indexOf(current) + delta + KEYS.length) % KEYS.length];
    persistVariant(next);
    const p = new URLSearchParams(params);
    p.set("variant", next);
    setParams(p, { replace: true, preventScrollReset: true });
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black px-2 py-1.5 text-sm text-white shadow-xl ring-2 ring-fuchsia-500">
      <button type="button" onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/20">
        <ChevronLeft className="size-4" />
      </button>
      <span className="px-1 font-mono">
        PROTÓTIPO {current} ({VARIANTS[current]}) · {unread} não lidas
      </span>
      <button type="button" onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/20">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
