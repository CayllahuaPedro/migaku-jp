import { renderPopupHtml, POPUP_CSS, type PopupData } from './html';

export type { PopupData };

export class DictPopup {
  private host: HTMLElement;
  private root: ShadowRoot;

  constructor(parent: HTMLElement = document.body) {
    this.host = document.createElement('div');
    this.host.className = 'mjp-popup-host';
    this.root = this.host.attachShadow({ mode: 'open' });
    parent.append(this.host);
  }

  show(anchor: DOMRect, data: PopupData): void {
    this.root.innerHTML = `<style>${POPUP_CSS}</style>${renderPopupHtml(data)}`;
    const popup = this.root.querySelector('.mjp-popup') as HTMLElement;
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - popup.offsetWidth - 8));
    popup.style.top = `${anchor.bottom + 8}px`;
    popup.style.left = `${left}px`;
  }

  hide(): void {
    this.root.innerHTML = '';
  }
}
