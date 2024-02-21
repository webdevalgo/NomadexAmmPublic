import styles from './_defly-wallet-connect-modal-information-section.scss?inline';

const deflyWalletConnectModalInformationSectionTemplate = document.createElement('template');

deflyWalletConnectModalInformationSectionTemplate.innerHTML = ``;

export class DeflyWalletConnectModalInformationSection extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });

		if (this.shadowRoot) {
			const styleSheet = document.createElement('style');

			styleSheet.textContent = styles;

			this.shadowRoot.append(deflyWalletConnectModalInformationSectionTemplate.content.cloneNode(true), styleSheet);

			const downloadDeflyButton = this.shadowRoot?.getElementById(
				'defly-wallet-connect-modal-information-section-download-defly-button'
			);

			if (downloadDeflyButton) {
				downloadDeflyButton.addEventListener('click', () => {
					this.onClickDownload();
				});
			}
		}
	}

	onClickDownload() {
		if (this.shadowRoot) {
			const modalDesktopMode = this.shadowRoot.host.parentElement;

			if (modalDesktopMode) {
				modalDesktopMode.classList.remove('defly-wallet-connect-modal-desktop-mode--default');

				modalDesktopMode.classList.add('defly-wallet-connect-modal-desktop-mode--download');
			}
		}
	}
}
