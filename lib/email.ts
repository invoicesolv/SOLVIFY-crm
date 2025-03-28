import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'noreply@solvify.se',
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

export async function sendWelcomeEmail(email: string, name: string) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@solvify.se',
      to: email,
      subject: 'Welcome to Solvify - Your 14-Day Free Trial Starts Now! 🚀',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <img src="https://solvify.se/Solvify-logo-WTE.png" alt="Solvify Logo" style="width: 150px; margin-bottom: 20px;">
              
              <h1 style="color: #2563eb;">Welcome to Solvify, ${name}! 🎉</h1>
              
              <p>We're excited to have you on board! Your 14-day free trial has officially begun.</p>
              
              <h2 style="color: #374151;">What's included in your trial:</h2>
              <ul>
                <li>Full access to all CRM features</li>
                <li>Customer management tools</li>
                <li>Project tracking</li>
                <li>Invoice generation</li>
                <li>Marketing analytics</li>
                <li>And much more!</li>
              </ul>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Quick Tip:</strong> Start by adding your first customer or creating a project to see how Solvify can streamline your business operations.</p>
              </div>
              
              <p>Need help getting started? Our support team is here for you:</p>
              <ul>
                <li>Email: support@solvify.se</li>
                <li>Phone: +46 70 736 80 87</li>
              </ul>
              
              <div style="margin-top: 30px;">
                <a href="https://solvify.se/dashboard" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a>
              </div>
              
              <p style="margin-top: 30px; font-size: 0.9em; color: #6b7280;">
                Best regards,<br>
                The Solvify Team
              </p>
            </div>
          </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
} 