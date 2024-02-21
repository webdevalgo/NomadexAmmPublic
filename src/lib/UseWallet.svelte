<script lang="ts" context="module">
	import { WalletConnector } from '../../packages/wallet-connect';
	import { get, writable } from 'svelte/store';
	import { kibisis } from '@txnlab/use-wallet';

	export const deflyWallet = new WalletConnector({});
	export const connectedAccount = writable<string>();
	export const connectedWallet = writable<'wc' | 'kibisis'>();
	export const isKibisisInstalled = writable(false);

	connectedWallet.subscribe((walletType) => {
		if (!browser || !walletType) return;
		localStorage.setItem('defaultWallet', walletType);
	});

	export const getKibisisClient = async () => {
		let count = 0;
		while (count++ < 3) {
			const resp = await kibisis.init({
				algodOptions: algodClientOpts,
				network: 'testnet',
			});
			if (resp) {
				isKibisisInstalled.set(true);
				return resp;
			}
		}
		throw Error('failed to get kibisis client');
	};

	export async function walletDisconnect() {
		if (get(connectedWallet) === 'kibisis') {
			const client = await getKibisisClient();
			await client?.disconnect();
		} else {
			await deflyWallet.disconnect();
		}
		connectedAccount.set(<any>undefined);
		connectedWallet.set(<any>undefined);
		localStorage.removeItem('defaultWallet');
	}

	export async function walletConnect(
		isKibisis = browser ? localStorage.getItem('defaultWallet') === 'kibisis' : false
	) {
		if (isKibisis) {
			const client = await getKibisisClient();
			const wallet = await client?.connect(() => {
				connectedAccount.set('');
			});
			if (wallet?.accounts?.[0]?.address) {
				connectedAccount.set(wallet?.accounts?.[0]?.address);
				connectedWallet.set('kibisis');
			}
		} else {
			connectedAccount.set((await deflyWallet.connect())[0]);
			connectedWallet.set('wc');
		}
	}

	export async function signTransactions(
		txnGroups: algosdk.Transaction[][],
		kibisis = get(connectedWallet) === 'kibisis'
	) {
		try {
			if (kibisis) {
				const signed: Uint8Array[] = [];
				const client = await getKibisisClient();
				for (const group of txnGroups) {
					const txns: { txn: string }[] = [];
					for (const txn of group) {
						txns.push({ txn: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64') });
					}

					let count = 0;
					while (count++ < 3) {
						try {
							const resp = await client?.signTransactions(
								[get(connectedAccount)],
								group.map((txn) => txn.toByte()),
								group.map((_, i) => i),
								true
							);

							if (resp) {
								signed.push(...resp);
								break;
							}
						} catch (e: any) {
							if (e['code'] !== 4002) {
								throw e;
							}
						}
					}
				}

				return signed;
			} else {
				const signed = await deflyWallet.signTransaction(
					txnGroups.map((group) => {
						return group.map((txn) => ({ txn }));
					})
				);

				return signed;
			}
		} catch (error) {
			throw error;
		}
	}

	export async function signAndSendTransections(
		client: algosdk.Algodv2,
		txnGroups: algosdk.Transaction[][],
		kibisis = get(connectedWallet) === 'kibisis'
	) {
		console.log('signing and sending txns...');
		const signed = await signTransactions(txnGroups, kibisis);

		const groups = txnGroups.map((group) => {
			return <Uint8Array[]>group
				.map((txn) => {
					const txId = txn.txID();
					const matchedTxn = signed.find((signedTxn) => {
						if (!signedTxn) return;
						try {
							return algosdk.decodeSignedTransaction(signedTxn).txn.txID() === txId;
						} catch (err) {}
					});
					return matchedTxn;
				})
				.filter(Boolean);
		});

		for (const group of groups) {
			const { txId } = await client.sendRawTransaction(group).do();
			try {
				await algosdk.waitForConfirmation(client, txId, 1);
			} catch (error) {
				console.warn((<Error>error).message);
			}
		}

		console.log('sent txns...');
		return true;
	}

	export function getTransactionSignerAccount(kibisis = get(connectedWallet) === 'kibisis') {
		const account = get(connectedAccount);
		if (!account) return <{ addr: string; signer }>(<unknown>undefined);
		const signer: algosdk.TransactionSigner = (txnGroup: algosdk.Transaction[], indexesToSign: number[]) => {
			return signTransactions([txnGroup], kibisis);
		};
		return {
			addr: account as Readonly<string>,
			signer,
		};
	}
</script>

<script lang="ts">
	import algosdk from 'algosdk';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import LogoutIcon from 'svelte-star/dist/md/MdPowerSettingsNew.svelte';
	import { isDarkTheme } from './stores';
	import { algodClientOpts } from './_shared';

	onMount(async () => {
		try {
			await getKibisisClient(); // trigger check if kibisis is installed
		} catch (e) {}
		if (!$connectedAccount) {
			const defaultWallet = localStorage.getItem('defaultWallet');
			if (defaultWallet) {
				if (defaultWallet === 'wc') {
					[$connectedAccount] = await deflyWallet.reconnectSession();
					$connectedWallet = 'wc';
				} else if (defaultWallet === 'kibisis') {
					walletConnect(true);
				}
			}
		}
	});
</script>

{#if $connectedAccount}
	<div class="flex">
		<div class="flex justify-between items-center w-full bg-red-">
			<li on:click={() => walletDisconnect()} on:keydown>
				<a class="flex items-center text-[1rem] gap-2" href={null} tabindex="0">
					<span class="block h-6 w-6"><LogoutIcon /></span>
				</a>
			</li>
			<li
				class="relative"
				on:click={(e) => {
					const input = document.createElement('input');
					document.body.prepend(input);
					input.style.position = 'fixed';
					input.style.bottom = '-1000px';
					input.style.left = '-1000px';
					input.focus();
					input.remove();
					navigator.clipboard.writeText($connectedAccount);
				}}
				on:keydown
			>
				<a class="flex items-center text-[1rem] gap-2" href={null} tabindex="0">
					<span class="flex flex-grow w-full flex-col">
						<span class="">{$connectedAccount.slice(0, 5)}...{$connectedAccount.slice(-5)}</span>
					</span>
				</a>
			</li>
			<li>
				<label class="swap swap-rotate">
					<input
						type="checkbox"
						class="theme-controller"
						bind:checked={$isDarkTheme}
						on:change={() => localStorage.setItem('theme', $isDarkTheme ? 'dark' : 'light')}
					/>
					<svg class="swap-on fill-current w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
						<path
							d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"
						/>
					</svg>
					<svg class="swap-off fill-current w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
						<path
							d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"
						/>
					</svg>
				</label>
			</li>
		</div>
	</div>
{:else}
	<!-- <li>
		<a href={null} tabindex="0">
			<span class="h-6"><QRCodeIcon /></span>
			<span on:click={() => walletConnect()} on:keydown={null}>Wallet Connect</span>
		</a>
	</li>
	{#if browser && usingKibisisWallet}
		<li>
			<a href={null} tabindex="0">
				<svg width="24" height="24" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
					<path
						d="m 25.023711,359.18142 h 28.975992 v -90.30191 l 0.0031,-45.25017 1.21858,-15.67878 1.160033,-9.12944 c 22.151946,0 44.198904,2.61977 65.096734,10.43534 17.26553,6.4541 33.50023,14.95836 48.22718,26.10816 33.23584,25.16347 57.80112,62.03841 67.15086,102.77944 5.67018,24.71096 4.69373,49.64022 4.69373,74.82154 V 512 h 28.97598 v -90.10343 c 0,-22.41869 -1.28209,-45.22833 1.64329,-67.47834 4.65403,-35.39634 20.87067,-68.92513 44.56546,-95.462 9.7943,-10.9672 20.98381,-20.74958 33.17752,-28.97598 v 205.61047 h 28.77749 V 272.84884 229.58331 c 0,-3.65374 -0.27785,-7.27972 -0.59539,-10.9156 -0.0913,-1.0479 -0.78592,-3.16158 -0.19251,-4.09039 0.72835,-1.13918 3.53467,-1.77229 4.75722,-2.2605 4.33053,-1.73264 8.67295,-3.35608 13.09873,-4.82867 19.44964,-6.47795 39.55619,-8.66703 59.93665,-8.66703 l 1.13522,8.93098 1.24437,15.48031 0.002,45.44864 v 90.50037 h 28.976 v -95.46201 c 0,-25.90176 0.60136,-51.65664 -4.32656,-77.20315 C 476.43395,153.89982 462.73784,122.73337 443.30605,95.817446 429.2785,76.388251 412.27,59.205287 392.97913,44.987204 332.73486,0.58303279 252.04863,-12.257645 181.21622,12.3317 152.44386,22.320041 125.91633,37.891262 103.02073,57.967061 81.343513,76.974318 63.493112,100.38454 50.28006,125.98423 c -12.731636,24.6673 -21.067948,52.1413 -23.833552,79.78321 -2.080951,20.79919 -1.422797,41.80679 -1.422797,62.71517 v 90.69881 M 448.748,170.0436 c -62.23887,0 -122.38191,30.51015 -161.19386,78.79088 -8.25418,10.27059 -15.69268,21.42636 -21.73992,33.14378 -2.25855,4.37419 -4.4397,8.79599 -6.4303,13.29721 -1.09155,2.4689 -1.85764,5.49947 -3.34612,7.74017 -1.79215,-2.69914 -2.67532,-6.3668 -4.03085,-9.32791 -2.94126,-6.42236 -6.079,-12.78318 -9.703,-18.85423 -13.75565,-23.05179 -31.12438,-43.67832 -52.35523,-60.21847 -6.8707,-5.35461 -14.2961,-11.49115 -22.22817,-15.1985 0.52535,-3.05319 2.3022,-6.15025 3.61585,-8.93096 3.55788,-7.53118 8.19128,-14.52809 13.62486,-20.83888 18.48214,-21.46646 47.34598,-34.48224 75.83971,-32.53072 12.3922,0.84883 24.22274,3.78454 35.52537,8.97462 10.50082,4.82133 19.70565,12.00677 27.78519,20.18217 2.60387,2.63643 4.94973,5.57174 7.17057,8.53403 0.62714,0.83653 1.74251,3.19887 2.78844,3.46778 0.62912,0.1613 1.44087,-0.54201 1.94892,-0.83196 1.58178,-0.90102 3.15361,-1.82925 4.76319,-2.67927 6.0135,-3.17547 12.49142,-7.19638 19.0527,-9.08598 -12.55097,-18.60516 -28.36671,-33.85288 -48.42563,-44.20644 -48.74318,-25.159097 -110.32788,-12.99811 -146.69909,27.73379 -9.45352,10.58695 -18.20448,23.35841 -22.79062,36.91462 -2.55585,-0.44019 -5.09362,-1.96462 -7.5417,-2.83964 -5.90376,-2.11029 -11.81803,-4.12831 -17.86191,-5.80871 -17.251237,-4.7963 -35.298714,-7.42738 -53.188809,-7.42738 1.29876,-5.61399 3.759736,-11.16071 5.951787,-16.47265 6.131403,-14.85714 14.12302,-28.89362 23.589633,-41.87625 13.088419,-17.949833 29.251859,-33.770127 47.463269,-46.496541 65.90571,-46.055732 155.47605,-48.358192 223.47237,-5.292488 20.05497,12.702204 37.70057,28.907921 52.27986,47.621249 10.39562,13.34225 19.02093,28.12833 25.68739,43.66244 2.59992,6.05639 5.48561,12.41422 6.9761,18.85424 M 133.38598,240.69739 V 435.59072 H 162.1635 V 311.54964 275.42889 264.91022 c 0,-1.37537 0.39,-3.45728 -0.11968,-4.74532 -0.33302,-0.84149 -1.38469,-1.45672 -2.06344,-2.00251 -1.57502,-1.26426 -3.14687,-2.53244 -4.76318,-3.74506 -6.6873,-5.01722 -14.07121,-10.48892 -21.83123,-13.71994 z"
						fill="currentColor"
					/>
				</svg>

				<span on:click={() => walletConnect(true)} on:keydown={null}>Kibisis Wallet</span>
			</a>
		</li>
	{/if} -->
{/if}
