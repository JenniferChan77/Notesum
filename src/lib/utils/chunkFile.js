export function chunkFile(file, chunkSize = 10 * 1024 * 1024) { // 10MB
  const chunks = [];
  let offset = 0;
  while (offset < file.size) {
    const blob = file.slice(offset, offset + chunkSize);
    chunks.push(blob);
    offset += chunkSize;
  }
  return chunks;
}