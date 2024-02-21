<script lang="ts">
	import { connectedAccount, getTransactionSignerAccount } from '$lib/UseWallet.svelte';
	import { nodeClient, nodeClientAllowsCompile } from '$lib/_shared';
	import algosdk from 'algosdk';
	import { LimitOrders001Client } from '../../../contracts/clients/LimitOrders001Client';
	import { onMount } from 'svelte';
	import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
	import { contracts } from '$lib';
	import { LimitOrders001ClientConnector } from '$lib/LimitOrderConnector';

	let appId = contracts.orderbookLimitOrderApp;
	let feePercent = 1;
	let owner = 'DYX2V5XF4IKOHE55Z63XAHVBJTMYM723HK5WJZ72BDZ5AFEFKJ5YP4DOQQ';
	const SCALE = 100_000_000_000_000;

	let withdrawFeeAmount = 0;

	let selection_pk = '';
	let state_proof_pk = '';
	let vote_pk = '';
	let vote_first = 0;
	let vote_last = 0;
	let vote_key_dilution = 0;

	onMount(async () => {
		const { boxes: boxesNames } = await nodeClient.getApplicationBoxes(appId).do();
		const boxes = await Promise.all(boxesNames.map((box) => nodeClient.getApplicationBoxByName(appId, box.name).do()));
		console.log(
			boxes.map((box) => ({
				name: Buffer.from(box.name).toString('hex'),
				value: Buffer.from(box.value).toString('hex'),
			}))
		);
	});

	async function deployLimitOrders() {
		const signer = getTransactionSignerAccount();

		const client = new LimitOrders001Client(
			{
				resolveBy: 'id',
				id: appId,
				sender: signer,
			},
			nodeClientAllowsCompile
		);

		if (appId) {
			console.log('updating...');
			await client.update.updateApplication({});
			console.log('updated');
		} else {
			const appCreateResponse = await client.create.createApplication({
				owner: owner,
				fee: Math.floor((feePercent / 100) * SCALE),
			});
			const appId = Number(appCreateResponse.confirmation?.applicationIndex);
			console.log('Created App:', { appId });

			const appAddress = algosdk.getApplicationAddress(appId);
			console.log('App Address:', appAddress);

			const newClient = new LimitOrders001Client(
				{
					resolveBy: 'id',
					id: appId,
					sender: signer,
				},
				nodeClientAllowsCompile
			);

			await newClient.appClient.fundAppAccount(new AlgoAmount({ algos: 0.2 }));

			console.log('ready to place limit orders');
		}
	}

	async function registerOnline() {
		const signer = getTransactionSignerAccount();

		const client = new LimitOrders001Client(
			{
				resolveBy: 'id',
				id: appId,
				sender: signer,
			},
			nodeClient
		);
		console.log(client);
		await client.registerOnline({
			selection_pk: Uint8Array.from(Buffer.from(selection_pk, 'base64')),
			state_proof_pk: Uint8Array.from(Buffer.from(state_proof_pk, 'base64')),
			vote_pk: Uint8Array.from(Buffer.from(vote_pk, 'base64')),
			vote_first: vote_first,
			vote_last: vote_last,
			vote_key_dilution: vote_key_dilution,
		});
	}

	async function registerOffline() {
		const signer = getTransactionSignerAccount();

		const client = new LimitOrders001Client(
			{
				resolveBy: 'id',
				id: appId,
				sender: signer,
			},
			nodeClient
		);
		console.log(client);

		await client.registerOffline({});
	}

	async function withdrawFee() {
		const amount = algosdk.algosToMicroalgos(withdrawFeeAmount);
		const signer = getTransactionSignerAccount();
		console.log(amount);
		const client = new LimitOrders001ClientConnector(appId, signer);
		await client.invoke('collectFee', { algoAmount: amount });
	}
</script>

{#if owner === $connectedAccount}
	<section class="pt-12 p-4 h-full flex flex-row justify-evenly items-center gap-3">
		<div class="h-full flex flex-col justify-start items-center gap-3 w-full">
			<div class="w-full max-w-[610px] flex flex-col justify-center">
				<div>App Id:</div>
				<input class="input input-primary" type="number" bind:value={appId} />
			</div>
			<div class="w-full max-w-[610px] flex flex-col justify-center">
				<div>Owner:</div>
				<input class="input input-primary" type="text" bind:value={owner} />
			</div>
			<div class="w-full max-w-[610px] flex flex-col justify-center">
				<div>Fee Percent:</div>
				<input class="input input-primary" type="number" min={0} max={100} bind:value={feePercent} />
			</div>
			<div class="w-full max-w-[610px] flex flex-col justify-center">
				<div>Collect Fee:</div>
				<input class="input input-primary" type="number" min={0} step={0.000001} bind:value={withdrawFeeAmount} />
			</div>
			<div class="w-full max-w-[610px] flex flex-col justify-center">
				<button class="btn btn-primary btn-sm" on:click={withdrawFee}>Collect Now</button>
			</div>
			{#if !appId}
				<div class="w-full max-w-[610px] flex flex-col justify-center">
					<button class="btn btn-primary btn-sm" on:click={deployLimitOrders}>DEPLOY</button>
				</div>
			{:else}
				<br />
				<div class="w-full max-w-[610px] flex flex-col justify-center">
					<button class="btn btn-primary btn-sm" on:click={deployLimitOrders}>Update Contract</button>
				</div>
				<br />
				{#if appId !== 0 && appId > 100}
					<div class="w-full max-w-[610px] flex flex-col justify-center">
						<div>Selection PK:</div>
						<input class="input input-primary" type="text" bind:value={selection_pk} />
					</div>
					<div class="w-full max-w-[610px] flex flex-col justify-center">
						<div>State Proof PK:</div>
						<input class="input input-primary" type="text" bind:value={state_proof_pk} />
					</div>
					<div class="w-full max-w-[610px] flex flex-col justify-center">
						<div>Vote PK:</div>
						<input class="input input-primary" type="text" bind:value={vote_pk} />
					</div>
					<div class="w-full max-w-[610px] flex flex-col justify-center">
						<div>Vote First:</div>
						<input class="input input-primary" type="number" bind:value={vote_first} />
					</div>
					<div class="w-full max-w-[610px] flex flex-col justify-center">
						<div>Vote Last:</div>
						<input class="input input-primary" type="number" bind:value={vote_last} />
					</div>
					<div class="w-full max-w-[610px] flex flex-col justify-center">
						<div>Vote Key Dilution:</div>
						<input class="input input-primary" type="number" bind:value={vote_key_dilution} />
					</div>
					<div class="w-full max-w-[610px] flex flex-col justify-center">
						<button class="btn btn-primary btn-sm" on:click={registerOnline}>Register Online</button>
					</div>
					<div class="w-full max-w-[610px] flex flex-col justify-center">
						<button class="btn btn-primary btn-sm" on:click={registerOffline}>Register Offline</button>
					</div>
				{/if}
			{/if}
		</div>
	</section>
{/if}

<style>
</style>
