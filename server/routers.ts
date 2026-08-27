import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { workflowExecutionService } from "./execution";
import { z } from "zod";

const executionInput = z.object({
  runId: z.string().min(8).max(128),
  inputNodeId: z.string().min(1).max(128),
  agentNodeId: z.string().min(1).max(128),
  prompt: z.string().max(24_000),
  model: z.string().max(128).optional(),
  provider: z.string().max(128).optional(),
  retry: z.boolean().optional(),
});

const proposalInput = z.object({
  sourceNodeId: z.string().min(1).max(128),
  prompt: z.string().min(1).max(24_000),
  model: z.string().max(128).optional(),
  provider: z.string().max(128).optional(),
});

const resumeInput = z.object({
  runId: z.string().min(8).max(128),
  request: executionInput.omit({ runId: true, retry: true }).optional(),
});

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  execution: router({
    run: publicProcedure.input(executionInput).mutation(({ input }) =>
      workflowExecutionService.run(input),
    ),
    pause: publicProcedure.input(z.object({ runId: z.string().min(8).max(128) })).mutation(({ input }) =>
      workflowExecutionService.pause(input.runId),
    ),
    resume: publicProcedure.input(resumeInput).mutation(({ input }) =>
      workflowExecutionService.resume(input.runId, input.request ? { ...input.request, runId: input.runId } : undefined),
    ),
    proposeNode: publicProcedure.input(proposalInput).mutation(({ input }) =>
      workflowExecutionService.proposeNode(input),
    ),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
