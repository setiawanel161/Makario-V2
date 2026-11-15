import {
  BillingWebhookError,
  processMidtransBillingEvent,
  processStripeBillingEvent,
} from '@/server/services/billing-webhook';

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  try {
    const stripeSignature = request.headers.get('stripe-signature');
    if (stripeSignature !== null) {
      return Response.json(
        await processStripeBillingEvent(
          rawBody,
          stripeSignature,
          process.env.STRIPE_WEBHOOK_SECRET,
        ),
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'Webhook body must be valid JSON.' }, { status: 400 });
    }
    return Response.json(
      await processMidtransBillingEvent(payload, process.env.MIDTRANS_SERVER_KEY),
    );
  } catch (error) {
    if (error instanceof BillingWebhookError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('Billing webhook could not be processed.', error);
    return Response.json({ error: 'Billing webhook could not be processed.' }, { status: 500 });
  }
}
