type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let entryPromise: Promise<ServerEntry> | undefined;

async function getEntry() {
  entryPromise ??= import("@tanstack/react-start/server-entry").then(
    (mod) => (mod.default ?? mod) as ServerEntry,
  );
  return entryPromise;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const entry = await getEntry();
    return entry.fetch(request, env, ctx);
  },
};
