declare module "mammoth/mammoth.browser" {
  function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: unknown[] }>;
  const mammoth: { extractRawText: typeof extractRawText };
  export default mammoth;
}
