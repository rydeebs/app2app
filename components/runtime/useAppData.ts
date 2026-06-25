"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type LogRow = {
  id: string;
  metric_key: string;
  value: Record<string, unknown> & { [k: string]: unknown };
  logged_at: string;
};

export function useAppData(appId: string) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("app_logs")
      .select("id, metric_key, value, logged_at")
      .eq("app_id", appId)
      .order("logged_at", { ascending: true });
    setLogs((data as LogRow[]) ?? []);
    setLoading(false);
  }, [appId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addLog = useCallback(
    async (metricKey: string, value: Record<string, unknown>) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("app_logs")
        .insert({ app_id: appId, metric_key: metricKey, value })
        .select("id, metric_key, value, logged_at")
        .single();
      if (data) setLogs((prev) => [...prev, data as LogRow]);
    },
    [appId]
  );

  return { logs, loading, addLog, refresh };
}

export function latestByKey(logs: LogRow[], key: string): LogRow | undefined {
  let latest: LogRow | undefined;
  for (const l of logs) {
    if (l.metric_key === key) {
      if (!latest || l.logged_at > latest.logged_at) latest = l;
    }
  }
  return latest;
}

export function seriesForKey(logs: LogRow[], key: string): LogRow[] {
  return logs
    .filter((l) => l.metric_key === key)
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
}
