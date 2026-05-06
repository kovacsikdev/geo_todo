export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator.clipboard?.writeText === "function") {
    await navigator.clipboard.writeText(text);
    return;
  }

  const fallbackInput = document.createElement("input");
  fallbackInput.value = text;
  fallbackInput.style.position = "fixed";
  fallbackInput.style.opacity = "0";
  document.body.append(fallbackInput);
  fallbackInput.select();
  document.execCommand("copy");
  fallbackInput.remove();
}
