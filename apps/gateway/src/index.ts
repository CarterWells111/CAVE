import {
  createApp,
  createWorkerRateLimitStore,
  type WorkerBindings
} from "./app";
import { D1AuthRepository } from "./auth/d1-auth-repository";

const AUTH_CLEANUP_BATCH_SIZE = 500;
const AUTH_CLEANUP_MAX_BATCHES = 20;

export async function cleanupAuthMetadata(database: D1Database, now: string): Promise<void> {
  const repository = new D1AuthRepository(database);
  for (let batch = 0; batch < AUTH_CLEANUP_MAX_BATCHES; batch += 1) {
    if (!await repository.cleanupExpired(now, AUTH_CLEANUP_BATCH_SIZE)) return;
  }
  console.warn(JSON.stringify({ event: "auth.cleanup.backlog", batches: AUTH_CLEANUP_MAX_BATCHES }));
}

const worker = {
  fetch(request, env, context) {
    const app = createApp(env, {
      rateLimitStore: createWorkerRateLimitStore(env),
      logger(line) {
        console.log(line);
      }
    });
    return app.fetch(request, env, context);
  },
  scheduled(_controller, env, context) {
    context.waitUntil(cleanupAuthMetadata(env.AUTH_DB, new Date().toISOString()));
  }
} satisfies ExportedHandler<WorkerBindings>;

export default worker;
