declare module 'piexifjs' {
  export const GPSIFD: Record<string, number>;
  export const ImageIFD: Record<string, number>;
  export const ExifIFD: Record<string, number>;
  export function dump(exifObj: unknown): string;
  export function insert(exifStr: string, jpegDataUrl: string): string;
  export function load(jpegDataUrl: string): unknown;
  const _default: {
    GPSIFD: Record<string, number>;
    ImageIFD: Record<string, number>;
    ExifIFD: Record<string, number>;
    dump: (exifObj: unknown) => string;
    insert: (exifStr: string, jpegDataUrl: string) => string;
    load: (jpegDataUrl: string) => unknown;
  };
  export default _default;
}
