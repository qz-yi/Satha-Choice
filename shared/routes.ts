import { z } from 'zod';
import { insertRequestSchema, requests } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  requests: {
    create: {
      method: 'POST' as const,
      path: '/api/requests',
      input: insertRequestSchema,
      responses: {
        201: z.custom<typeof requests.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    list: {
      method: 'GET' as const,
      path: '/api/requests',
      responses: {
        200: z.array(z.custom<typeof requests.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/requests/:id',
      responses: {
        200: z.custom<typeof requests.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    drivers: {
      list: {
        method: 'GET' as const,
        path: '/api/drivers/nearby',
        responses: {
          200: z.array(z.object({
            id: z.string(),
            lat: z.number(),
            lng: z.number(),
            type: z.string()
          })),
        }
      }
    }
  },
};

// ============================================
// REQUIRED: buildUrl helper
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
