import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the base API URL for the application
 * Uses the same logic as the auth client - current domain
 */
export function getApiUrl(): string {
  return window.location.origin;
}

// Common passwords to check against
const COMMON_PASSWORDS = [
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
  'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master', 'sunshine',
  'princess', 'qwerty123', 'football', 'baseball', 'superman', 'batman',
  'trustno1', 'hello123', 'freedom', 'whatever', 'qazwsx', 'password1',
  '12345678', '1234567', '123123', '111111', '000000', 'qwertyuiop',
  'asdfghjkl', 'zxcvbnm', '1q2w3e4r', '1qaz2wsx', 'q1w2e3r4', 'abcd1234'
];

export interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
  met: boolean;
}

export interface PasswordStrength {
  score: number; // 0-5
  label: string;
  color: string;
  requirements: PasswordRequirement[];
}

/**
 * Check if password contains sequential patterns
 */
function hasSequentialPatterns(password: string): boolean {
  const sequences = [
    '123456', '234567', '345678', '456789', '567890',
    'abcdef', 'bcdefg', 'cdefgh', 'defghi', 'efghij',
    'ghijkl', 'hijklm', 'ijklmn', 'jklmno', 'klmnop',
    'lmnopq', 'mnopqr', 'nopqrs', 'opqrst', 'pqrstu',
    'qrstuv', 'rstuvw', 'stuvwx', 'tuvwxy', 'uvwxyz',
    'qwerty', 'wertyu', 'ertyui', 'rtyuio', 'tyuiop',
    'asdfgh', 'sdfghj', 'dfghjk', 'fghjkl', 'ghjklz'
  ];
  
  return sequences.some(seq => password.toLowerCase().includes(seq));
}

/**
 * Check if password has more than 2 consecutive identical characters
 */
function hasRepeatedCharacters(password: string): boolean {
  for (let i = 0; i < password.length - 2; i++) {
    if (password[i] === password[i + 1] && password[i] === password[i + 2]) {
      return true;
    }
  }
  return false;
}

/**
 * Validate password strength and return detailed feedback
 */
export function validatePassword(password: string): PasswordStrength {
  const requirements: PasswordRequirement[] = [
    {
      id: 'length',
      label: 'At least 12 characters',
      test: (pwd) => pwd.length >= 12,
      met: false
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      test: (pwd) => /[A-Z]/.test(pwd),
      met: false
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a-z)',
      test: (pwd) => /[a-z]/.test(pwd),
      met: false
    },
    {
      id: 'numbers',
      label: 'At least one number (0-9)',
      test: (pwd) => /\d/.test(pwd),
      met: false
    },
    {
      id: 'special',
      label: 'At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)',
      test: (pwd) => /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pwd),
      met: false
    },
    {
      id: 'common',
      label: 'Not a common password',
      test: (pwd) => !COMMON_PASSWORDS.includes(pwd.toLowerCase()),
      met: false
    },
    {
      id: 'sequential',
      label: 'No sequential patterns',
      test: (pwd) => !hasSequentialPatterns(pwd),
      met: false
    },
    {
      id: 'repeated',
      label: 'No more than 2 consecutive identical characters',
      test: (pwd) => !hasRepeatedCharacters(pwd),
      met: false
    }
  ];

  // Test each requirement
  requirements.forEach(req => {
    req.met = req.test(password);
  });

  // Calculate strength score (0-6) - adding new very weak category
  const metRequirements = requirements.filter(req => req.met).length;
  const totalRequirements = requirements.length;
  let score = Math.floor((metRequirements / totalRequirements) * 5);
  
  // Special handling for very short passwords
  if (password.length === 1) {
    score = 0; // Very Weak
  } else if (password.length <= 3) {
    score = Math.max(0, score - 1); // Reduce score for very short passwords
  }

  // Determine strength label and color
  let label: string;
  let color: string;

  if (score === 0) {
    label = 'Very Weak';
    color = 'text-red-500';
  } else if (score === 1) {
    label = 'Weak';
    color = 'text-orange-500';
  } else if (score === 2) {
    label = 'Fair';
    color = 'text-yellow-500';
  } else if (score === 3) {
    label = 'Good';
    color = 'text-blue-500';
  } else if (score === 4) {
    label = 'Strong';
    color = 'text-green-500';
  } else {
    label = 'Very Strong';
    color = 'text-emerald-500';
  }

  return {
    score,
    label,
    color,
    requirements
  };
}

/**
 * Check if password meets all requirements
 */
export function isPasswordValid(password: string): boolean {
  const strength = validatePassword(password);
  return strength.requirements.every(req => req.met);
}

/**
 * Check if password meets the minimum requirement for registration.
 *
 * Soft floor of 6 characters with no complexity requirement, chosen to
 * minimise signup friction. Password *strength* (uppercase / digit /
 * symbol / no common patterns) is still scored by `validatePassword`
 * and surfaced by the strength indicator as informational UX, but it
 * does NOT gate submission.
 *
 * Both `RegistrationForm` and `ChangePasswordForm` route their submit
 * gate through this helper, so any future change to the floor lands
 * in one place.
 */
export function isPasswordMinimallyValid(password: string): boolean {
  return !!password && password.length >= 6;
}

/**
 * Returns true if `redirectUrl` resolves to the same origin as the
 * current page. Relative URLs ("/dashboard") and same-origin absolute
 * URLs are accepted; cross-origin absolute URLs and malformed inputs
 * are rejected.
 *
 * Used to gate post-login / post-register redirects against open-
 * redirect phishing — see #7 HIGH-1.
 */
export function isSafeRedirect(redirectUrl: string | null | undefined): boolean {
  if (!redirectUrl) return false;
  try {
    const parsed = new URL(redirectUrl, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Pragmatic client-side email format check: a non-empty local part, an `@`,
 * and a dotted domain, with no whitespace. Deliberately permissive (the
 * server is the source of truth) — its job is to catch obvious typos before
 * a pointless network round-trip, not to fully implement RFC 5322.
 */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
