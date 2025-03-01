import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import  hbs from 'nodemailer-express-handlebars';
import { EMAIL_FROM, EMAIL_HOST, EMAIL_PASSWORD, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER } from '@app/utils';
import { join } from 'path';



@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter
  private readonly logger = new Logger(EmailService.name);
  constructor () {
    this.transporter = nodemailer.createTransport({
      service: 'zoho',
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_SECURE,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
      },
      require_authentication: true
    } as any);
    const viewPath = join(__dirname, '../email-templates');
    const partialsDir = join(__dirname, '../email-templates/partials');
    const layoutsDir = join(__dirname, '../email-templates/layouts');

    // Create handlebars engine instance
    const handlebars = {
      extname: '.hbs',
      defaultLayout: 'main',
      layoutsDir: layoutsDir,
      partialsDir: partialsDir,
    };
    const handlebarOptions = {
      viewEngine: handlebars,
      viewPath: viewPath,
      extName: '.hbs',
    }
    this.transporter.use('compile', hbs(handlebarOptions));

    // Verify the SMTP connection on initialization
    this.verifyConnection();
  }
  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection established successfully');
    } catch (error) {
      this.logger.error(`Failed to establish SMTP connection: ${error.message}`);
    }
  }
  /**
   * Send an email using a template or HTML/text content
   * @param options Email sending options
   * @returns Promise resolving to the result of the operation
   */
  async sendMail(options: {
    to: string;
    subject: string;
    template?: string;
    context?: Record<string, any>;
    html?: string;
    text?: string;
    from?: string;
    attachments?: any[];
  }): Promise<any> {
    try {
      const { to, subject, template, context, html, text, from, attachments } = options;
      // Set up email data
      const mailOptions: any = { // nodemailer.SendMailOptions = {
        from: from || EMAIL_FROM,
        to,
        subject,
        attachments,
      };

      // Use template if provided, otherwise use HTML/text
      if (template) {
        mailOptions.template = template;
        mailOptions.context = context || {};
      } else {
        if (html) mailOptions.html = html;
        if (text) mailOptions.text = text;
      }

      // Send the email
      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${to}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw error;
    }
  }
}
