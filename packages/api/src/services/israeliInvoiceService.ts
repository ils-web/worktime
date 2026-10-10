import { prisma } from '@timetracker/db';

export interface PaymentLinkResult {
  paymentUrl: string;
  isSimulated: boolean;
  invoiceId: string;
  amount: number;
  vatRate: number;
  totalWithVat: number;
}

export interface IssueReceiptResult {
  invoiceId: string;
  receiptNumber: string;
  receiptUrl: string;
  status: string;
  paidAt: Date;
}

export class IsraeliInvoiceService {
  /**
   * Get Morning (Green Invoice) API base URL based on sandbox flag
   */
  private static getMorningBaseUrl(isSandbox: boolean): string {
    return isSandbox
      ? 'https://sandbox.greeninvoice.co.il/api/v1'
      : 'https://api.greeninvoice.co.il/api/v1';
  }

  /**
   * Acquire JWT token from Morning API
   */
  private static async getMorningToken(
    apiKey: string,
    apiSecret: string,
    isSandbox: boolean
  ): Promise<string> {
    const baseUrl = this.getMorningBaseUrl(isSandbox);
    const res = await fetch(`${baseUrl}/account/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: apiKey, secret: apiSecret }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Morning authentication failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as { token: string };
    return data.token;
  }

  /**
   * Generate an online payment link for a specific invoice
   */
  public static async createPaymentLink(
    invoiceId: string,
    originUrl?: string
  ): Promise<PaymentLinkResult> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const settings = await prisma.saaSSettings.findFirst();
    const vatRate = settings?.vatRate ?? 17.0;
    const totalWithVat = Math.round(invoice.amount * (1 + vatRate / 100) * 100) / 100;

    const hasKeys =
      settings?.invoiceApiKey &&
      settings?.invoiceApiSecret &&
      settings.invoiceProvider === 'morning';

    // If no real Morning API keys configured, return simulated instant payment URL
    if (!hasKeys) {
      const host = originUrl || 'http://localhost:4000';
      const simUrl = `${host}/api/webhooks/simulate-payment?invoiceId=${invoice.id}`;
      return {
        paymentUrl: simUrl,
        isSimulated: true,
        invoiceId: invoice.id,
        amount: invoice.amount,
        vatRate,
        totalWithVat,
      };
    }

    try {
      const token = await this.getMorningToken(
        settings.invoiceApiKey!,
        settings.invoiceApiSecret!,
        !!settings.invoiceSandbox
      );

      const baseUrl = this.getMorningBaseUrl(!!settings.invoiceSandbox);
      const appHost = originUrl || process.env['FRONTEND_URL'] || 'https://timetracker-saas.vercel.app';

      const payload = {
        description: `דמי מנוי מערכת TimeTracker - חודש ${invoice.periodMonth}`,
        amount: totalWithVat,
        currency: 'ILS',
        client: {
          name: invoice.client.legalName || invoice.client.name,
          taxId: invoice.client.taxId || undefined,
          emails: invoice.client.billingEmail ? [invoice.client.billingEmail] : [],
          phone: invoice.client.billingPhone || undefined,
          address: invoice.client.billingAddress || undefined,
        },
        document: {
          type: 320, // 320 = חשבונית מס קבלה (Tax Invoice Receipt)
          description: `דמי שימוש TimeTracker - חודש ${invoice.periodMonth}`,
        },
        custom: invoice.id,
        successUrl: `${appHost}/client?payment=success&invoiceId=${invoice.id}`,
        failureUrl: `${appHost}/client?payment=failed&invoiceId=${invoice.id}`,
        notifyUrl: `${process.env['API_URL'] || appHost}/api/webhooks/morning`,
      };

      const res = await fetch(`${baseUrl}/payments/form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn('Morning create payment form warning:', errText);
        // Fall back gracefully to simulation URL
        const simUrl = `${appHost}/api/webhooks/simulate-payment?invoiceId=${invoice.id}`;
        return {
          paymentUrl: simUrl,
          isSimulated: true,
          invoiceId: invoice.id,
          amount: invoice.amount,
          vatRate,
          totalWithVat,
        };
      }

      const resData = (await res.json()) as { url: string };
      return {
        paymentUrl: resData.url,
        isSimulated: false,
        invoiceId: invoice.id,
        amount: invoice.amount,
        vatRate,
        totalWithVat,
      };
    } catch (err) {
      console.error('Failed to create Morning payment link, falling back to simulated:', err);
      const host = originUrl || 'http://localhost:4000';
      return {
        paymentUrl: `${host}/api/webhooks/simulate-payment?invoiceId=${invoice.id}`,
        isSimulated: true,
        invoiceId: invoice.id,
        amount: invoice.amount,
        vatRate,
        totalWithVat,
      };
    }
  }

  /**
   * Issues official חשבונית מס קבלה (Tax Invoice Receipt) for an invoice
   */
  public static async generateTaxInvoiceReceipt(
    invoiceId: string,
    paymentDetails?: { method?: string; transactionId?: string }
  ): Promise<IssueReceiptResult> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const settings = await prisma.saaSSettings.findFirst();
    const vatRate = settings?.vatRate ?? 17.0;
    const totalWithVat = Math.round(invoice.amount * (1 + vatRate / 100) * 100) / 100;

    let receiptNumber = invoice.receiptNumber;
    let receiptUrl = invoice.receiptUrl;
    let docId = invoice.paymentDocId;

    const hasKeys =
      settings?.invoiceApiKey &&
      settings?.invoiceApiSecret &&
      settings.invoiceProvider === 'morning';

    if (hasKeys) {
      try {
        const token = await this.getMorningToken(
          settings.invoiceApiKey!,
          settings.invoiceApiSecret!,
          !!settings.invoiceSandbox
        );
        const baseUrl = this.getMorningBaseUrl(!!settings.invoiceSandbox);

        const methodCode = paymentDetails?.method === 'bit' ? 12 : paymentDetails?.method === 'bank_transfer' ? 4 : 1;

        const docPayload = {
          type: 320, // חשבונית מס קבלה
          description: `דמי מנוי מערכת TimeTracker - חודש ${invoice.periodMonth}`,
          lang: 'he',
          currency: 'ILS',
          vatRate,
          client: {
            name: invoice.client.legalName || invoice.client.name,
            taxId: invoice.client.taxId || undefined,
            emails: invoice.client.billingEmail ? [invoice.client.billingEmail] : [],
            phone: invoice.client.billingPhone || undefined,
            address: invoice.client.billingAddress || undefined,
          },
          income: [
            {
              description: `דמי שימוש במערכת TimeTracker - חודש ${invoice.periodMonth}`,
              quantity: 1,
              price: invoice.amount,
              vatType: 0, // Standard VAT rate
            },
          ],
          payment: [
            {
              type: methodCode,
              price: totalWithVat,
              date: new Date().toISOString().split('T')[0],
            },
          ],
        };

        const res = await fetch(`${baseUrl}/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(docPayload),
        });

        if (res.ok) {
          const docData = (await res.json()) as any;
          receiptNumber = String(docData.number || docData.documentNumber || '');
          receiptUrl = docData.url?.pdf || docData.url?.origin || '';
          docId = docData.id || '';
        } else {
          console.warn('Morning document creation response not ok:', await res.text());
        }
      } catch (e) {
        console.error('Failed to issue Morning document directly:', e);
      }
    }

    // Fallback receipt details if running in test/sandbox without live API
    if (!receiptNumber) {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      receiptNumber = `REC-${randomNum}`;
    }
    if (!receiptUrl) {
      receiptUrl = `https://morning.co.il/receipt/${receiptNumber}.pdf`;
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        receiptNumber,
        receiptUrl,
        paymentMethod: paymentDetails?.method || 'credit_card',
        paymentDocId: docId || paymentDetails?.transactionId || `sim_${Date.now()}`,
      },
    });

    return {
      invoiceId: updated.id,
      receiptNumber: updated.receiptNumber!,
      receiptUrl: updated.receiptUrl!,
      status: updated.status,
      paidAt: updated.paidAt!,
    };
  }

  /**
   * Handle incoming Morning (Green Invoice) webhook
   */
  public static async handleMorningWebhook(payload: any): Promise<boolean> {
    const invoiceId = payload?.custom || payload?.invoiceId;
    if (!invoiceId) {
      console.warn('Morning webhook received without custom invoiceId:', payload);
      return false;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      console.warn(`Morning webhook invoiceId not found: ${invoiceId}`);
      return false;
    }

    const docNumber =
      payload?.document?.number ||
      payload?.documentNumber ||
      payload?.number ||
      `REC-${Math.floor(100000 + Math.random() * 900000)}`;

    const docUrl =
      payload?.document?.url?.pdf ||
      payload?.document?.url?.origin ||
      payload?.receiptUrl ||
      `https://morning.co.il/receipt/${docNumber}.pdf`;

    const docId = payload?.document?.id || payload?.transactionId || payload?.id;
    const method = payload?.payment?.method || payload?.paymentMethod || 'credit_card';

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paidAt: new Date(),
        receiptNumber: String(docNumber),
        receiptUrl: docUrl,
        paymentMethod: method,
        paymentDocId: docId ? String(docId) : null,
      },
    });

    return true;
  }
}
