export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('[migaku-jp] content script up');
  },
});
