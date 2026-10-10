import { Router, Request, Response } from 'express';
import { IsraeliInvoiceService } from '../services/israeliInvoiceService';

export const webhookRouter = Router();

/**
 * Morning (Green Invoice) Webhook endpoint
 * Triggered automatically when a client completes payment via Morning
 */
webhookRouter.post('/morning', async (req: Request, res: Response) => {
  try {
    console.log('[Webhook] Morning payload received:', JSON.stringify(req.body));
    const processed = await IsraeliInvoiceService.handleMorningWebhook(req.body);
    res.json({ success: processed });
  } catch (err: any) {
    console.error('[Webhook] Morning processing error:', err);
    res.status(500).json({ error: err.message || 'Webhook processing failed' });
  }
});

/**
 * Simulated payment endpoint for sandbox and local testing
 * Triggers instant receipt generation and redirects to client dashboard
 */
webhookRouter.get('/simulate-payment', async (req: Request, res: Response) => {
  try {
    const invoiceId = req.query['invoiceId'] as string;
    if (!invoiceId) {
      res.status(400).send('Missing invoiceId parameter');
      return;
    }

    const result = await IsraeliInvoiceService.generateTaxInvoiceReceipt(invoiceId, {
      method: 'credit_card',
      transactionId: `sim_tx_${Date.now()}`,
    });

    const frontendUrl =
      process.env['FRONTEND_URL'] ||
      (req.headers.referer ? new URL(req.headers.referer).origin : 'http://localhost:5173');

    // Return friendly HTML auto-redirect
    res.send(`
      <!DOCTYPE html>
      <html lang="he" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>תשלום בוצע בהצלחה | TimeTracker</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #334155; text-align: center; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          .icon { width: 56px; height: 56px; margin: 0 auto 1rem; color: #10b981; }
          h2 { margin: 0 0 0.5rem; font-size: 1.25rem; font-weight: 700; color: #10b981; }
          p { margin: 0.25rem 0; color: #94a3b8; font-size: 0.9rem; }
          .doc { background: #0f172a; padding: 0.75rem; border-radius: 0.5rem; margin: 1rem 0; border: 1px dashed #334155; font-family: monospace; font-size: 0.85rem; color: #38bdf8; }
          .btn { display: inline-block; background: #059669; color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.9rem; margin-top: 1rem; }
          .btn:hover { background: #10b981; }
        </style>
      </head>
      <body>
        <div class="card">
          <svg class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2>התשלום נקלט בהצלחה!</h2>
          <p>הופקה <strong>חשבונית מס קבלה</strong> דיגיטלית חתומה כחוק.</p>
          <div class="doc">מספר מסמך: ${result.receiptNumber}</div>
          <p style="font-size: 0.8rem; color: #64748b;">(סביבת בדיקות / Sandbox)</p>
          <a class="btn" href="${frontendUrl}">חזרה למערכת TimeTracker</a>
          <script>
            setTimeout(() => {
              window.location.href = "${frontendUrl}";
            }, 3000);
          </script>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Simulate payment error:', err);
    res.status(500).send(`Payment simulation error: ${err.message}`);
  }
});
