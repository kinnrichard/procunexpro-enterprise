import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private ready: Promise<void>;

  constructor() {
    this.ready = this.init();
  }

  private async init() {
    if (process.env.SMTP_HOST) {
      // Use configured SMTP
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number.parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      this.logger.log(`Email configured with SMTP: ${process.env.SMTP_HOST}`);
    } else {
      // Auto-create Ethereal test account
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      this.logger.log('──────────────────────────────────────────');
      this.logger.log('Email using Ethereal test account');
      this.logger.log(`  User: ${testAccount.user}`);
      this.logger.log(`  Pass: ${testAccount.pass}`);
      this.logger.log('  View emails: https://ethereal.email/login');
      this.logger.log('──────────────────────────────────────────');
    }
  }

  async sendRfqInvitation(params: {
    to: string;
    vendorName: string;
    rfqNumber: string;
    rfqTitle: string;
    deadline?: string;
    responseUrl: string;
    companyName: string;
  }) {
    await this.ready;

    const deadlineText = params.deadline
      ? `<p style="margin:0 0 8px"><strong>Deadline:</strong> ${params.deadline}</p>`
      : '';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#1e3a5f;margin:0 0 16px">Request for Quotation</h2>
        <p style="margin:0 0 8px">Dear ${params.vendorName},</p>
        <p style="margin:0 0 16px">${params.companyName} has invited you to submit a quotation.</p>
        <div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:16px;margin:0 0 16px">
          <p style="margin:0 0 8px"><strong>RFQ #:</strong> ${params.rfqNumber}</p>
          <p style="margin:0 0 8px"><strong>Title:</strong> ${params.rfqTitle}</p>
          ${deadlineText}
        </div>
        <p style="margin:0 0 16px">Please click the button below to view the items and submit your pricing.</p>
        <a href="${params.responseUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Submit Quotation</a>
        <p style="margin:16px 0 0;font-size:12px;color:#6b7280">If the button doesn't work, copy this link: ${params.responseUrl}</p>
      </div>
    `;

    try {
      const info = await this.transporter!.sendMail({
        from: process.env.SMTP_FROM || `"Procunex" <noreply@procunex.com>`,
        to: params.to,
        subject: `RFQ Invitation: ${params.rfqNumber} — ${params.rfqTitle}`,
        html,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        this.logger.log(`Email preview: ${previewUrl}`);
      }

      return { sent: true, previewUrl: previewUrl || undefined };
    } catch (error: any) {
      this.logger.error(`Email send failed: ${error.message}`);
      return { sent: false, error: error.message };
    }
  }
}
