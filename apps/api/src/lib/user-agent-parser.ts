export interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | null;
}

export function parseUserAgent(uaString: string | null | undefined): ParsedUserAgent {
  if (!uaString || typeof uaString !== 'string') {
    return { browser: null, os: null, deviceType: null };
  }

  const ua = uaString.trim();
  if (!ua) {
    return { browser: null, os: null, deviceType: null };
  }

  // Detect Device Type
  let deviceType: 'desktop' | 'mobile' | 'tablet' | null = 'desktop';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/iphone|ipod|android.*mobile|mobile|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = 'mobile';
  }

  // Detect OS
  let os: string | null = null;
  if (/windows phone/i.test(ua)) {
    os = 'Windows Phone';
  } else if (/windows/i.test(ua)) {
    os = 'Windows';
  } else if (/ipad|iphone|ipod/i.test(ua)) {
    os = 'iOS';
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
  } else if (/android/i.test(ua)) {
    os = 'Android';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  } else if (/crkey|cros/i.test(ua)) {
    os = 'ChromeOS';
  }

  // Detect Browser
  let browser: string | null = null;
  if (/edg\//i.test(ua)) {
    browser = 'Edge';
  } else if (/opr\/|opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/chrome|crios/i.test(ua) && !/edg\//i.test(ua)) {
    browser = 'Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browser = 'Safari';
  } else if (/msie|trident/i.test(ua)) {
    browser = 'Internet Explorer';
  }

  return { browser, os, deviceType };
}
