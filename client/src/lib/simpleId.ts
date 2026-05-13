// Generates a code in the format xxxx-xxxx with numbers, lowercase, and uppercase letters
export function generateSimpleId() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; ++i) {
    code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    if (i === 3) code += '-';
  }
  return code;
}
