import { DEFLY_WALLET_APP_DEEP_LINK } from './deflyWalletConstants';

function generateDeflyWalletAppDeepLink(shouldAddBrowserName = true): string {
	let appDeepLink = DEFLY_WALLET_APP_DEEP_LINK;
	const browserName = detectBrowser();

	if (shouldAddBrowserName && browserName) {
		appDeepLink = `${appDeepLink}?browser=${encodeURIComponent(browserName)}`;
	}

	return appDeepLink;
}

function generateEmbeddedWalletURL(url: string) {
	const newURL = new URL(url);

	newURL.searchParams.append('embedded', 'true');

	return newURL.toString();
}

/**
 * @param {string} uri WalletConnect uri
 * @returns {string} Defly Wallet deeplink
 */
function generateDeflyWalletConnectDeepLink(uri: string): string {
	const appDeepLink = generateDeflyWalletAppDeepLink(false);

	const deepLink = `${appDeepLink}wc?uri=${encodeURIComponent(uri)}`;

	return deepLink;
}

export { generateDeflyWalletAppDeepLink, generateDeflyWalletConnectDeepLink, generateEmbeddedWalletURL };
