export async function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function sharePDF(blob: Blob, filename: string, title: string) {
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: "application/pdf" })
    const shareData = { title, files: [file] }

    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // User cancelled or share failed, fallback to download
      }
    }
  }

  // Fallback: download
  await downloadPDF(blob, filename)
}
