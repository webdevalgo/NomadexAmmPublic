if (typeof window !== 'undefined') {
	// Pollyfill for Buffer
	(window as any).global = window;

	import('./App');
}

import WalletConnector from './WalletConnector';

export { WalletConnector };
