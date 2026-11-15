import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';

const planTierSchema = z.enum(['FREE', 'PRO', 'TEAM']);
const stripeEventSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.object({
      metadata: z
        .object({
          workspaceId: z.string().min(1).optional(),
          planTier: planTierSchema.optional(),
        })
        .optional(),
      status: z.string().optional(),
      subscription: z.string().nullable().optional(),
    }).passthrough(),
  }),
});
const midtransNotificationSchema = z.object({
  signature_key: z.string().min(1),
  order_id: z.string().min(1),
  status_code: z.string().min(1),
  gross_amount: z.string().min(1),
  transaction_status: z.string().min(1),
  custom_field1: z.string().optional(),
  custom_field2: z.string().optional(),
  metadata: z
    .object({
      workspaceId: z.string().optional(),
      planTier: planTierSchema.optional(),
    })
    .optional(),
});

export class BillingWebhookError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 404,
  ) {
    super(message);
    this.name = 'BillingWebhookError';
  }
}

function safeEqualHex(actual: string, expected: string): boolean {
  if (!/^[a-f\d]+$/i.test(actual) || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (signatureHeader === null) return false;
  const entries = signatureHeader.split(',').map((part) => part.split('=', 2));
  const timestamp = entries.find(([key]) => key === 't')?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp)) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > 300) {
    return false;
  }
  const signatures = entries
    .filter(([key]) => key === 'v1')
    .flatMap(([, value]) => (value ? [value] : []));
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return signatures.some((signature) => safeEqualHex(signature, expected));
}

function verifyMidtransSignature(
  notification: z.infer<typeof midtransNotificationSchema>,
  serverKey: string,
): boolean {
  const expected = createHash('sha512')
    .update(
      `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`,
    )
    .digest('hex');
  return safeEqualHex(notification.signature_key, expected);
}

async function updateWorkspacePlan(workspaceId: string, planTier: z.infer<typeof planTierSchema>): Promise<void> {
  const workspace = await prisma.workspace.updateMany({
    where: { id: workspaceId },
    data: { planTier },
  });
  if (workspace.count === 0) {
    throw new BillingWebhookError('Billing workspace was not found.', 404);
  }
}

export async function processStripeBillingEvent(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
): Promise<{ received: true; updated: boolean }> {
  if (!secret) throw new BillingWebhookError('Stripe webhook is not configured.', 401);
  if (!verifyStripeSignature(rawBody, signatureHeader, secret)) {
    throw new BillingWebhookError('Stripe signature is invalid or expired.', 401);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new BillingWebhookError('Webhook body must be valid JSON.', 400);
  }
  const parsed = stripeEventSchema.safeParse(payload);
  if (!parsed.success) throw new BillingWebhookError('Stripe event payload is invalid.', 400);

  const { type, data } = parsed.data;
  const workspaceId = data.object.metadata?.workspaceId;
  const planTier = data.object.metadata?.planTier;
  const isPlanEvent =
    type === 'checkout.session.completed' ||
    type === 'customer.subscription.created' ||
    type === 'customer.subscription.updated' ||
    type === 'customer.subscription.deleted';
  if (!isPlanEvent) return { received: true, updated: false };
  if (!workspaceId) {
    throw new BillingWebhookError('Stripe event is missing workspace metadata.', 400);
  }
  const effectiveTier =
    type === 'customer.subscription.deleted' || data.object.status === 'canceled'
      ? 'FREE'
      : planTier;
  if (effectiveTier === undefined) {
    throw new BillingWebhookError('Stripe event is missing plan tier metadata.', 400);
  }
  await updateWorkspacePlan(workspaceId, effectiveTier);
  return { received: true, updated: true };
}

export async function processMidtransBillingEvent(
  payload: unknown,
  serverKey: string | undefined,
): Promise<{ received: true; updated: boolean }> {
  if (!serverKey) throw new BillingWebhookError('Midtrans webhook is not configured.', 401);
  const parsed = midtransNotificationSchema.safeParse(payload);
  if (!parsed.success) throw new BillingWebhookError('Midtrans event payload is invalid.', 400);
  if (!verifyMidtransSignature(parsed.data, serverKey)) {
    throw new BillingWebhookError('Midtrans signature is invalid.', 401);
  }

  const notification = parsed.data;
  const workspaceId = notification.metadata?.workspaceId ?? notification.custom_field1;
  if (!workspaceId) {
    throw new BillingWebhookError('Midtrans event is missing workspace metadata.', 400);
  }
  const status = notification.transaction_status;
  const successful = status === 'settlement' || status === 'capture';
  const canceled =
    status === 'cancel' ||
    status === 'expire' ||
    status === 'deny' ||
    status === 'failure' ||
    status === 'refund' ||
    status === 'partial_refund';
  if (!successful && !canceled) return { received: true, updated: false };
  const planTier = successful
    ? notification.metadata?.planTier ?? notification.custom_field2
    : 'FREE';
  const parsedTier = planTierSchema.safeParse(planTier);
  if (!parsedTier.success) {
    throw new BillingWebhookError('Midtrans event is missing a valid plan tier.', 400);
  }
  await updateWorkspacePlan(workspaceId, parsedTier.data);
  return { received: true, updated: true };
}
