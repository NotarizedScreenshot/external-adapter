export const puppeteerDefaultConfig: {
  launch: {
    args: string[];
  };
  viewport: { width: number; height: number };
  userAgent: string;
  page: { goto: { gotoWaitUntilIdle: { waitUntil: 'networkidle2' | 'networkidle0' } } };
  defaultBoundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
} = {
  launch: {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  },
  viewport: {
    width: 1024,
    height: 1024,
  },
  defaultBoundingBox: {
    x: 0,
    y: 0,
    width: 1024,
    height: 1024,
  },

  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
  page: {
    goto: { gotoWaitUntilIdle: { waitUntil: 'networkidle2' } },
  },
};
