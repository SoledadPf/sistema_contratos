/**
 * MOCK Email Service
 * En el futuro, esto se conectará a SendGrid, AWS SES o Nodemailer.
 */
export const sendEmailMock = async (to: string, subject: string, body: string) => {
  console.log('\n======================================================');
  console.log(`📧 [MOCK EMAIL SENT]`);
  console.log(`TO:      ${to}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`BODY:\n${body}`);
  console.log('======================================================\n');
  return true;
};
