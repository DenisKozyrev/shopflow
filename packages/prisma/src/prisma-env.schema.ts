import { z } from 'zod';

export const prismaEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
});
