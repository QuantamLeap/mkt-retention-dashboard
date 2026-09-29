window.RetentionSharedStorage = (() => {
  const apiUrl = "https://sozhynhaeaorsdwswidh.supabase.co/functions/v1/mkt-retention-state";
  const workspace = "main";
  let version = 0;
  let saveQueue = Promise.resolve();
  let pollTimer = null;

  async function request(method, body) {
    const response = await fetch(apiUrl, {
      method,
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || "shared_storage_error");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function load() {
    const payload = await request("GET");
    if (!payload.data) return null;
    version = Number(payload.data.version || 0);
    return payload.data.state;
  }

  async function save(state) {
    saveQueue = saveQueue.then(async () => {
      const payload = await request("PUT", { state, expectedVersion: version });
      version = Number(payload.version || version + 1);
      return version;
    });
    return saveQueue;
  }

  async function waitForSaves() {
    await saveQueue;
  }

  function getVersion() {
    return version;
  }

  function setVersion(nextVersion) {
    version = Number(nextVersion || 0);
  }

  function startPolling(onChange, intervalMs = 8000) {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        await waitForSaves();
        const payload = await request("GET");
        if (!payload.data) return;
        const nextVersion = Number(payload.data.version || 0);
        if (nextVersion <= version) return;
        version = nextVersion;
        onChange(payload.data.state);
      } catch (error) {
        console.error("Shared storage poll failed", error);
      }
    }, intervalMs);
  }

  async function refresh(onChange) {
    await waitForSaves();
    const payload = await request("GET");
    if (!payload.data) return;
    const nextVersion = Number(payload.data.version || 0);
    if (nextVersion <= version) return;
    version = nextVersion;
    onChange(payload.data.state);
  }

  return { load, save, startPolling, refresh, getVersion, setVersion };
})();