import {
  createApp,
  createWorkerRateLimitStore,
  type WorkerBindings
} from "./app";

const worker = {
  fetch(request, env, context) {
    const app = createApp(env, {
      rateLimitStore: createWorkerRateLimitStore(env),
      logger(line) {
        console.log(line);
      }
    });
    return app.fetch(request, env, context);
  }
} satisfies ExportedHandler<WorkerBindings>;

export default worker;
