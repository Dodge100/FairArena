import { Resend } from 'resend';
import { ENV } from '../config/env.js';
import { welcomeEmailTemplate } from './templates/welcome.js';

const resend = new Resend(ENV.RESEND_API_KEY);

// Collect all templates
export const emailTemplates = {
  welcome: welcomeEmailTemplate,
};

// Function to send email
export const sendEmail = async (
  to: string,
  subject: string,
  templateName: keyof typeof emailTemplates,
  params: unknown,
): Promise<unknown> => {
  const html = emailTemplates[templateName](params as { userName: string });

  try {
    const { data, error } = await resend.emails.send({
      from: ENV.FROM_EMAIL_ADDRESS,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('Error sending email:', error);
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Failed to send email:', err);
    throw err;
  }
};

export const sendWelcomeEmail = async (to: string, userName: string): Promise<unknown> => {
  return sendEmail(to, 'Welcome to FairArena', 'welcome', { userName });
};
