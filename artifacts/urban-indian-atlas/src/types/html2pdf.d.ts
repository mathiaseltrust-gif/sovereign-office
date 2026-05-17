declare module "html2pdf.js" {
  interface Html2PdfOptions {
    margin?: number | [number, number] | [number, number, number, number];
    filename?: string;
    image?: { type?: "jpeg" | "png" | "webp"; quality?: number };
    enableLinks?: boolean;
    html2canvas?: object;
    jsPDF?: { unit?: string; format?: string | [number, number]; orientation?: "portrait" | "landscape" };
  }
  interface Html2PdfWorker {
    from(src: HTMLElement | string): this;
    set(options: Html2PdfOptions): this;
    save(filename?: string): Promise<void>;
    output(type?: string, options?: unknown): Promise<unknown>;
    to(target: string): this;
    toPdf(): this;
  }
  function html2pdf(): Html2PdfWorker;
  export default html2pdf;
}
