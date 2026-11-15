import { BlockType } from '@prisma/client';
import { z } from 'zod';
import { blockContentMatchesType, blockContentPayloadSchema } from '@/lib/editor/block-content-schema';
import type { JsonObject, JsonValue } from '@/types/workspace';

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const jsonObjectSchema = z.record(z.string(), jsonValueSchema);
const mutationBase = {
  idempotencyKey: z.string().trim().min(1).max(200),
  workspaceId: z.string().min(1).max(100),
  entityId: z.string().min(1).max(100),
  createdAt: z.string().datetime({ offset: true }),
  fieldTimestamps: z
    .record(z.string(), z.string().datetime({ offset: true }))
    .optional(),
};

const pageFields = {
  title: z.string().trim().min(1).max(200),
  parentPageId: z.string().min(1).nullable(),
  icon: z.string().max(32).nullable(),
  coverUrl: z.union([z.string().url(), z.literal('builtin:calm')]).nullable(),
  fontFamily: z.enum(['sans', 'serif', 'mono']),
  isFullWidth: z.boolean(),
  orderIndex: z.string().regex(/^[0-9A-Za-z]{1,128}$/),
  isDatabase: z.boolean(),
  isFavorite: z.boolean(),
  isPrivate: z.boolean(),
};

const pageChangeSchema = z.object(pageFields).partial().refine(
  (changes) => Object.keys(changes).length > 0,
  'At least one page field must be provided.',
);

function validateContent(
  type: BlockType | undefined,
  content: JsonObject | undefined,
  context: z.RefinementCtx,
): void {
  if (content === undefined) return;
  if (!blockContentPayloadSchema.safeParse(content).success) {
    context.addIssue({
      code: 'custom',
      path: ['content'],
      message: 'Block content does not match the typed payload contract.',
    });
    return;
  }
  if (type !== undefined && !blockContentMatchesType(type, content)) {
    context.addIssue({
      code: 'custom',
      path: ['content'],
      message: `Block content is not valid for ${type}.`,
    });
  }
}

const blockChangeSchema = z
  .object({
    type: z.nativeEnum(BlockType),
    content: jsonObjectSchema,
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'At least one block field is required.')
  .superRefine((changes, context) => validateContent(changes.type, changes.content, context));

const emptyChangesSchema = z.object({});

const baseSchema = z.object(mutationBase);

export const syncMutationSchema = z.discriminatedUnion('type', [
  baseSchema.extend({
    type: z.literal('CREATE_PAGE'),
    changes: z.object(pageFields).partial(),
  }),
  baseSchema.extend({ type: z.literal('UPDATE_PAGE'), changes: pageChangeSchema }),
  baseSchema.extend({ type: z.literal('DELETE_PAGE'), changes: emptyChangesSchema }),
  baseSchema.extend({
    type: z.literal('CREATE_BLOCK'),
    changes: z
      .object({
        pageId: z.string().min(1),
        parentBlockId: z.string().min(1).nullable().optional(),
        type: z.nativeEnum(BlockType),
        content: jsonObjectSchema,
        orderIndex: z.string().regex(/^[0-9A-Za-z]{1,128}$/),
      })
      .superRefine((changes, context) =>
        validateContent(changes.type, changes.content, context),
      ),
  }),
  baseSchema.extend({ type: z.literal('UPDATE_BLOCK'), changes: blockChangeSchema }),
  baseSchema.extend({
    type: z.literal('MOVE_BLOCK'),
    changes: z.object({
      parentBlockId: z.string().min(1).nullable(),
      orderIndex: z.string().regex(/^[0-9A-Za-z]{1,128}$/),
    }),
  }),
  baseSchema.extend({ type: z.literal('DELETE_BLOCK'), changes: emptyChangesSchema }),
  baseSchema.extend({
    type: z.literal('UPSERT_ROW_PROP'),
    changes: z.object({
      rowPageId: z.string().min(1),
      propertyId: z.string().min(1),
      value: jsonValueSchema,
    }),
  }),
]);

export const syncPushSchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(50),
});

export const syncPullQuerySchema = z.object({
  workspaceId: z.string().min(1).max(100),
  sinceRevision: z.string().regex(/^\d+$/).default('0'),
});

export const workspaceSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});

export type ParsedSyncMutation = z.infer<typeof syncMutationSchema>;

