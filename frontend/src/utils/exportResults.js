function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJSON(resultsMap, query, meta = {}) {
  const payload = {
    exported_at: new Date().toISOString(),
    query,
    meta,
    results: Object.fromEntries(resultsMap),
  };
  download(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `vdb-results-${Date.now()}.json`
  );
}

export function exportCSV(resultsMap, query) {
  const allKeys = new Set();
  for (const [, { results }] of resultsMap) {
    results.forEach((r) => Object.keys(r.metadata || {}).forEach((k) => allKeys.add(k)));
  }
  const metaCols = [...allKeys];
  const header = ["db_type", "rank", "id", "score", "latency_ms", ...metaCols];
  const rows = [header];
  for (const [dbType, { results, latency_ms }] of resultsMap) {
    results.forEach((r, i) => {
      rows.push([
        dbType, i + 1, r.id, r.score, latency_ms,
        ...metaCols.map((k) => r.metadata?.[k] ?? ""),
      ]);
    });
  }
  const csv = rows
    .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  download(new Blob([csv], { type: "text/csv" }), `vdb-results-${Date.now()}.csv`);
}
