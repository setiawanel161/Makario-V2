import { createHash, createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db/prisma', () => ({
  prisma: {
    workspace: { updateMany: vi.fn() },
  },
}));

import { prisma } from '@/server/db/prisma';
import {
  BillingWebhookError,
  processMidtransBillingEvent,
  processStripeBillingEvent,
} from '@/server/services/billing-webhook';

describe('billing webhook verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.workspace.updateMany).mockResolvedValue({ count: 1 });
  });

  it('updates the plan only after validating the Stripe signature', async () => {
    const secret = 'stripe-test-secret';
    const rawBody = JSON.stringify({
      type: 'customer.subscription.updated',
      data: {
        object: {
          metadata: { workspaceId: 'workspace-1', planTier: 'PRO' },
          status: 'active',
        },
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    await expect(
      processStripeBillingEvent(
        rawBody,
        `t=${timestamp},v1=${signature}`,
        secret,
      ),
    ).resolves.toEqual({ received: true, updated: true });
    expect(prisma.workspace.updateMany).toHaveBeenCalledWith({
      where: { id: 'workspace-1' },
      data: { planTier: 'PRO' },
    });
    await expect(
      processStripeBillingEvent(rawBody, `t=${timestamp},v1=invalid`, secret),
    ).rejects.toBeInstanceOf(BillingWebhookError);
  });

  it('verifies Midtrans SHA-512 signatures before applying the plan', async () => {
    const serverKey = 'midtrans-test-secret';
    const notification = {
      order_id: 'workspace-2-upgrade',
      status_code: '200',
      gross_amount: '99.00',
      transaction_status: 'settlement',
      custom_field1: 'workspace-2',
      custom_field2: 'TEAM',
    };
    const signature = createHash('sha512')
      .update(
        `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`,
      )
      .digest('hex');

    await expect(
      processMidtransBillingEvent(
        { ...notification, signature_key: signature },
        serverKey,
      ),
    ).resolves.toEqual({ received: true, updated: true });
    expect(prisma.workspace.updateMany).toHaveBeenCalledWith({
      where: { id: 'workspace-2' },
      data: { planTier: 'TEAM' },
    });
  });

  it('does not downgrade a workspace for a pending Midtrans transaction', async () => {
    const serverKey = 'midtrans-test-secret';
    const notification = {
      order_id: 'workspace-3-upgrade',
      status_code: '201',
      gross_amount: '99.00',
      transaction_status: 'pending',
      custom_field1: 'workspace-3',
      custom_field2: 'PRO',
    };
    const signature = createHash('sha512')
      .update(
        `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`,
      )
      .digest('hex');

    await expect(
      processMidtransBillingEvent(
        { ...notification, signature_key: signature },
        serverKey,
      ),
    ).resolves.toEqual({ received: true, updated: false });
    expect(prisma.workspace.updateMany).not.toHaveBeenCalled();
  });
});
