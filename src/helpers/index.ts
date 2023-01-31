import { exec } from "child_process";

export const getDomainInformation = (
  url: string,
  timeoutMs: number = 30000
): Promise<any[]> => {
  const domainInformation: string[] = [];
  const errors: any[] = [];
  exec(`dig ${url} any +trace`, (err, stdout, stderr) => {
    if (!!err) {
      errors.push(err);
      return;
    }
    if (!!stderr) {
      errors.push(stderr);
      return;
    }
    if (!err && !stderr) {
      const res = stdout
        .split("\n")
        .filter((el) => el !== "")
        .map((el) =>
          el
            .split("\t")
            .filter((el) => el !== "")
            .join(" ")
        );
      domainInformation.push(...res);
    }
  });
  return new Promise((resolve, rejects) => {
    const checkTimeoutMs = 500;
    const check = (): NodeJS.Timeout | void => {
      if (errors.length > 0) rejects(errors.join());
      return domainInformation.length > 0
        ? resolve(domainInformation)
        : setTimeout(check, checkTimeoutMs);
    };
    check();

    setTimeout(() => {
      rejects("can not get DNS info");
    }, timeoutMs);
  });
};

export const getIncludeSubstringElementIndex = (
  array: string[],
  substring: string,
  start: number = 0
): number | null =>
  array.reduce<number | null>(
    (acc, val, index) =>
      val.includes(substring) && acc === null && index >= start ? index : acc,
    null
  );

export const getHostWithoutWWW = (url: string) => {
  const host = new URL(url).host;
  return host.slice(host.includes("www") ? 4 : 0);
};

export const trimUrl = (url: string): string => {
  const trimmedUrl = url.trim();
  return trimmedUrl[trimmedUrl.length - 1] === "/"
    ? trimmedUrl.substring(0, trimmedUrl.length - 1)
    : trimmedUrl;
};
