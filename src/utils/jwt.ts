// Décodage manuel d'un JWT (payload uniquement), sans dépendance externe.
// Utile car le token Hourglass contient déjà le xsrf_token et le user_uuid
// dans son payload -> plus besoin d'aller les chercher séparément.

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64UrlDecode(input: string): string {
  let str = input.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';

  let output = '';
  let buffer = 0;
  let bits = 0;

  for (const char of str) {
    if (char === '=') break;
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  // Les octets décodés peuvent être de l'UTF-8 -> reconversion propre
  try {
    return decodeURIComponent(
      output
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return output;
  }
}

export interface HourglassJwtPayload {
  aud: string[];
  exp: number;
  iss: string;
  user_uuid: string;
  xsrf_token: string;
  [key: string]: any;
}

export function decodeHourglassJwt(token: string): HourglassJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = base64UrlDecode(parts[1]);
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}
