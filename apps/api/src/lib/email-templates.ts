const brandColor = "#4E5D42";
const bgColor = "#F6F1E7";
const bgAccent = "#EDE6D6";
const textColor = "#1C1915";
const mutedText = "#847A66";
const accentText = "#403A2E";
const buttonText = "#F6F1E7";
const borderColor = "#D9D0BC";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(title: string, body: string, footnote?: string): string {
  return `
  <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: ${textColor}; background: ${bgColor};">
    <h1 style="font-size: 28px; font-weight: 400; margin: 0 0 16px;">${escapeHtml(title)}</h1>
    ${body}
    ${
      footnote
        ? `<p style="font-size: 13px; color: ${mutedText}; line-height: 1.6; margin-top: 28px;">${escapeHtml(footnote)}</p>`
        : ""
    }
    <hr style="border: none; border-top: 1px solid ${borderColor}; margin: 32px 0;">
    <p style="font-size: 12px; color: ${mutedText};">Tessera · a private family archive</p>
  </div>`;
}

function button(url: string, label: string): string {
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    throw new Error("Invalid URL scheme for email button");
  }
  return `<p style="margin: 32px 0;">
    <a href="${escapeHtml(url)}"
       style="background: ${brandColor}; color: ${buttonText}; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 15px; display: inline-block;">
      ${escapeHtml(label)}
    </a>
  </p>`;
}

function paragraph(text: string): string {
  return `<p style="font-size: 16px; line-height: 1.7; color: ${accentText};">${text}</p>`;
}

export const emailTemplates = {
  shell,
  button,
  paragraph,
  colors: {
    brand: brandColor,
    bg: bgColor,
    bgAccent,
    text: textColor,
    mutedText,
    accentText,
    buttonText,
    border: borderColor,
  },
};
