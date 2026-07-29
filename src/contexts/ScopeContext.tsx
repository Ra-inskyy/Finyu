import { useQuery } from "convex/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Share = {
  ownerId: Id<"users">;
  ownerName: string;
  ownerEmail: string;
  role: "viewer" | "editor";
};

type ScopeValue = {
  /** undefined = data milik sendiri */
  ownerId: Id<"users"> | undefined;
  setOwnerId: (id: Id<"users"> | undefined) => void;
  isOwner: boolean;
  canEdit: boolean;
  shares: Share[];
  activeLabel: string;
};

const ScopeContext = createContext<ScopeValue | null>(null);

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [ownerId, setOwnerId] = useState<Id<"users"> | undefined>(undefined);
  const collab = useQuery(api.collaborators.list);
  const shares = (collab?.shares ?? []) as Share[];

  const value = useMemo<ScopeValue>(() => {
    const active = shares.find(s => s.ownerId === ownerId);
    return {
      ownerId,
      setOwnerId,
      isOwner: !ownerId,
      canEdit: !ownerId || active?.role === "editor",
      shares,
      activeLabel: active ? `Data ${active.ownerName}` : "Data saya",
    };
  }, [ownerId, shares]);

  return (
    <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
  );
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope harus dipakai di dalam ScopeProvider");
  return ctx;
}

/** Argumen `ownerId` untuk query/mutation Convex (dibuang kalau data sendiri). */
export function useScopeArgs() {
  const { ownerId } = useScope();
  return useMemo(() => (ownerId ? { ownerId } : {}), [ownerId]);
}
