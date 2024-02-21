import { DEFLY_WALLET_CONNECT_MODAL_ID, removeModalWrapperFromDOM } from '../../deflyWalletConnectModalUtils';
import styles from './_defly-wallet-connect-modal-pending-message.scss?inline';
import { CONNECT_AUDIO_URL, CONNECT_TIMEOUT_INTERVAL } from './util/deflyWalletConnectModalPendingMessageConstants';

const deflyWalletConnectModalPendingMessageTemplate = document.createElement('template');

deflyWalletConnectModalPendingMessageTemplate.innerHTML = `
  <div class="defly-wallet-connect-modal-pending-message-section">
    <div class="defly-wallet-connect-modal-pending-message">

      <div class="defly-wallet-connect-modal-pending-message__text">
        Please wait while we connect you to Defly Wallet...
      </div>
    </div>

    <button
      id="defly-wallet-connect-modal-pending-message-cancel-button"
      class="defly-wallet-button defly-wallet-connect-modal-pending-message__cancel-button">
        Cancel
    </button>
  </div>

  <div id="defly-wallet-connect-modal-pending-message-audio-wrapper"></div>
`;

const deflyWalletConnectTryAgainView = `
  <div class="defly-wallet-connect-modal-pending-message--try-again-view">
    <div>
      <img class="defly-wallet-connect-modal-pending-message--try-again-view__image" src="${''}" alt="Defly Wallet" />

      <h1 class="defly-wallet-connect-modal-pending-message--try-again-view__title">
        Couldn’t establish connection
      </h1>

      <p class="defly-wallet-connect-modal-pending-message--try-again-view__description">
        Having issues? Before trying again, make sure to read the support article below and apply the possible solutions.
      </p>
    </div>

    <div>
      <a
        href=" https://docs.defly.app/app/dapp-browser"
        target="_blank"
        rel="noopener noreferrer"
        class="defly-wallet-connect-modal-pending-message--try-again-view__resolving-anchor">

        <div>
          <div
            class="defly-wallet-connect-modal-pending-message--try-again-view__resolving-anchor__title-wrapper">
            <h1
              class="defly-wallet-connect-modal-pending-message--try-again-view__resolving-anchor__title">
                Resolving WalletConnect issues
            </h1>
          </div>

          <p
            class="defly-wallet-connect-modal-pending-message--try-again-view__resolving-anchor__description">
            Unfortunately there are several known issues related to WalletConnect that our team is working on. Some of these issues are related to the WalletConnect JavaScript implementation on the dApp ...
          </p>
        </div>
      </a>

      <button id="defly-wallet-connect-modal-pending-message-try-again-button" class="defly-wallet-connect-button defly-wallet-connect-modal-pending-message--try-again-view__button">
        Close & Try Again
      </button>
    </div>
  </div>
  `;

export class DeflyWalletConnectModalPendingMessageSection extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });

		if (this.shadowRoot) {
			const styleSheet = document.createElement('style');

			styleSheet.textContent = styles;

			this.shadowRoot.append(deflyWalletConnectModalPendingMessageTemplate.content.cloneNode(true), styleSheet);
		}
	}

	connectedCallback() {
		const cancelButton = this.shadowRoot?.getElementById('defly-wallet-connect-modal-pending-message-cancel-button');

		cancelButton?.addEventListener('click', () => {
			this.onClose();
		});

		this.addAudioForConnection();

		setTimeout(() => {
			deflyWalletConnectModalPendingMessageTemplate.innerHTML = deflyWalletConnectTryAgainView;

			if (this.shadowRoot) {
				const styleSheet = document.createElement('style');

				styleSheet.textContent = styles;

				this.shadowRoot.innerHTML = '';

				this.shadowRoot.append(deflyWalletConnectModalPendingMessageTemplate.content.cloneNode(true), styleSheet);

				const tryAgainButton = this.shadowRoot?.getElementById(
					'defly-wallet-connect-modal-pending-message-try-again-button'
				);

				tryAgainButton?.addEventListener('click', () => {
					this.onClose();
				});
			}
		}, CONNECT_TIMEOUT_INTERVAL);
	}

	onClose() {
		removeModalWrapperFromDOM(DEFLY_WALLET_CONNECT_MODAL_ID);
	}

	addAudioForConnection() {
		const shouldUseSound = this.getAttribute('should-use-sound');

		if (shouldUseSound === 'true') {
			const connectAudioWrapper = this.shadowRoot?.getElementById(
				'defly-wallet-connect-modal-pending-message-audio-wrapper'
			);

			const audio = document.createElement('audio');

			audio.src = CONNECT_AUDIO_URL;
			audio.autoplay = true;
			audio.loop = true;

			connectAudioWrapper?.appendChild(audio);
		}
	}
}
