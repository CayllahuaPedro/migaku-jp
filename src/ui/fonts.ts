export function linkFontStylesheet(href: string): void {
  if (document.getElementById('mjp-fonts')) return;
  const link = document.createElement('link');
  link.id = 'mjp-fonts';
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}
