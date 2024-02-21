import styles from './_defly-wallet-modal-header.scss?inline';
import { DEFLY_WALLET_REDIRECT_MODAL_ID, removeModalWrapperFromDOM } from '../deflyWalletConnectModalUtils';

const deflyWalletModalHeader = document.createElement('template');

const headerClassName = 'defly-wallet-modal-header defly-wallet-modal-header--desktop';

deflyWalletModalHeader.innerHTML = `
  <div class="${headerClassName}">
    </div>
`;

export class DeflyWalletModalHeader extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });

		if (this.shadowRoot) {
			const styleSheet = document.createElement('style');

			styleSheet.textContent = styles;

			this.shadowRoot.append(deflyWalletModalHeader.content.cloneNode(true), styleSheet);
			this.onClose();
		}
	}
	onClose() {
		const closeButton = this.shadowRoot?.getElementById('defly-wallet-modal-header-close-button');
		const modalId = this.getAttribute('modal-id');

		if (closeButton && modalId === DEFLY_WALLET_REDIRECT_MODAL_ID) {
			closeButton.addEventListener('click', () => {
				removeModalWrapperFromDOM(DEFLY_WALLET_REDIRECT_MODAL_ID);
			});
		}
	}
}
