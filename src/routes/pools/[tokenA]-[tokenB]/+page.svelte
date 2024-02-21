<script lang="ts">
	import { connectedAccount } from '$lib/UseWallet.svelte';
	import { AlgoArc200PoolConnector } from '$lib/AlgoArc200PoolConnector';
	import { getStores } from '$app/stores';
	import { knownPools, knownTokens, TokenType, type Token, type Pool, saveVoiArc200PoolToList } from '$lib';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { onChainStateWatcher, watchArc200Balance } from '$lib/stores/onchain';
	import algosdk from 'algosdk';
	import { nodeClient, nodeClientAllowsCompile } from '$lib/_shared';
	import { convertDecimals } from '$lib/numbers';

	const { page } = getStores();
	const tokenA = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenA);
	const tokenB = <Token>$knownTokens.find((token) => token.ticker === $page.params.tokenB);

	let voiToken: Token = <any>undefined;
	let arc200Token: Token = <any>undefined;
	let matchedPool: Pool = <any>undefined;

	if (tokenA?.ticker === 'VOI' && tokenB?.type === TokenType.ARC200) {
		voiToken = tokenA;
		arc200Token = tokenB;
	} else if (tokenB?.ticker === 'VOI' && tokenA?.type === TokenType.ARC200) {
		voiToken = tokenB;
		arc200Token = tokenA;
	} else if (browser) {
		goto(`/`, { replaceState: true });
	}

	if (voiToken && arc200Token) {
		const match = $knownPools.find((pool) => pool.arc200Asset.assetId === arc200Token.id);
		if (match) matchedPool = match;
	}

	const connectedUserState = onChainStateWatcher.getAccountWatcher($connectedAccount);
	const arc200Balance = watchArc200Balance(arc200Token.id, $connectedAccount);

	const SCALE = 100_000_000_000_000;
	let managerAddress = '';
	let feeControllerAddress = '';
	let feePercent = 0;
	let platformFeePercent = 0;

	let selectionPk = '';
	let stateProofPk = '';
	let votePk = '';
	let voteFirst = 0;
	let voteLast = 0;
	let voteKeyDilution = 0;

	async function registerOnline() {
		const connector = new AlgoArc200PoolConnector(matchedPool.arc200Asset.assetId, matchedPool.poolId);
		await connector.invoke('registerOnline', {
			selectionPk: Uint8Array.from(Buffer.from(selectionPk, 'base64')),
			stateProofPk: Uint8Array.from(Buffer.from(stateProofPk, 'base64')),
			votePk: Uint8Array.from(Buffer.from(votePk, 'base64')),
			voteFirst,
			voteLast,
			voteKeyDilution,
		});
	}

	async function registerOffline() {
		const connector = new AlgoArc200PoolConnector(matchedPool.arc200Asset.assetId, matchedPool.poolId);
		await connector.invoke('registerOffline', {});
	}

	// if (!matchedPool) {
	// 	throw Error('pool not found');
	// }

	onMount(async () => {
		if (!matchedPool) return;
		const connector = new AlgoArc200PoolConnector(matchedPool.arc200Asset.assetId, matchedPool.poolId);
		const globalState = await connector.getGlobalState();
		const manager = globalState.manager;
		const feeController = globalState.fee_controller;
		if (manager) {
			managerAddress = algosdk.encodeAddress(manager.asByteArray());
		}
		if (feeController) {
			feeControllerAddress = algosdk.encodeAddress(feeController.asByteArray());
		}

		const feeBox = await nodeClient.getApplicationBoxByName(matchedPool.poolId, new TextEncoder().encode('fee')).do();
		const swapFee = Number(algosdk.ABIUintType.from('uint256').decode(feeBox.value.slice(0, 32)));
		const platformFee = Number(algosdk.ABIUintType.from('uint256').decode(feeBox.value.slice(32)));
		feePercent = (((100 * swapFee) / SCALE) * platformFee) / SCALE;
		platformFeePercent = (100 * platformFee) / SCALE;
	});

	let updating = false;

	async function updatePool() {
		if (!matchedPool) return;
		try {
			updating = true;
			const connector = new AlgoArc200PoolConnector(
				matchedPool.arc200Asset.assetId,
				matchedPool.poolId,
				undefined,
				nodeClientAllowsCompile
			);
			await connector.invoke('updatePool');
			console.log('updated');
		} catch (e) {}
		updating = false;

		return;
	}

	$: initialLiquidityAmount = Math.min(
		Math.min(
			Number(convertDecimals($arc200Balance ?? 0n, arc200Token.decimals, 6)) / 1e6,
			Math.min(Math.floor($connectedUserState.amount / 1e6), 100)
		),
		100
	);

	async function createVoiPool() {
		let FIRST_LIQUIDITY = initialLiquidityAmount;
		const connector = await AlgoArc200PoolConnector.createPool(arc200Token.id);

		console.log('Created App:', connector.appId);
		await connector.invoke('initPool');

		await connector.invoke(
			'mint',
			convertDecimals(Math.floor(FIRST_LIQUIDITY * 1e6), 6, 6),
			convertDecimals(Math.floor(FIRST_LIQUIDITY * 1e6), 6, arc200Token.decimals)
		);
		console.log('added liquidity');

		await saveVoiArc200PoolToList(arc200Token.ticker, connector.appId, arc200Token.id);

		goto(`/liquidity/VOI-${arc200Token.ticker}/add`);

		return;
	}

	async function setPoolFee() {
		const targetFee = ((feePercent / 100) * SCALE * 100) / platformFeePercent;
		const connector = new AlgoArc200PoolConnector(matchedPool.arc200Asset.assetId, matchedPool.poolId);
		console.log(await connector.getUnnamedResourcesAccessedFromMethod('setFees', { fee: targetFee }));
		await connector.invoke(
			'setFees',
			{ fee: targetFee },
			await connector.getUnnamedResourcesAccessedFromMethod('setFees', { fee: targetFee })
		);
	}
</script>

<section class="flex flex-col justify-center items-center h-full">
	<div class="w-full h-full flex flex-col items-center p-12">
		<br />
		{#if matchedPool}
			{#if $connectedAccount === feeControllerAddress}
				<form on:submit|preventDefault class="flex flex-col gap-2 w-full max-w-[448px] prose">
					<h4 class="text-left">LP Fee {feePercent}%</h4>
					<input
						type="number"
						placeholder="Swap fee %"
						bind:value={feePercent}
						step={0.000001}
						required
						class="input input-primary input-bordered w-full focus:outline-none"
					/>

					<div class="flex justify-center mt-2 pr-0">
						<button
							class="btn btn-primary w-full box-border"
							class:disabled={updating}
							disabled={updating}
							on:click={setPoolFee}
						>
							Set LP Fee
						</button>
					</div>
					<br />
				</form>
			{/if}
			{#if [managerAddress, feeControllerAddress].includes($connectedAccount)}
				<form on:submit|preventDefault class="flex flex-col gap-2 w-full max-w-[448px] prose">
					<h4 class="text-left">Consensus</h4>
					<div class="h-full flex flex-col justify-start items-center gap-3 w-full">
						<div class="w-full max-w-[610px] flex flex-col justify-center">
							<div>Selection PK:</div>
							<input class="input input-primary" type="text" bind:value={selectionPk} />
						</div>
						<div class="w-full max-w-[610px] flex flex-col justify-center">
							<div>State Proof PK:</div>
							<input class="input input-primary" type="text" bind:value={stateProofPk} />
						</div>
						<div class="w-full max-w-[610px] flex flex-col justify-center">
							<div>Vote PK:</div>
							<input class="input input-primary" type="text" bind:value={votePk} />
						</div>
						<div class="w-full max-w-[610px] flex flex-col justify-center">
							<div>Vote First:</div>
							<input class="input input-primary" type="number" bind:value={voteFirst} />
						</div>
						<div class="w-full max-w-[610px] flex flex-col justify-center">
							<div>Vote Last:</div>
							<input class="input input-primary" type="number" bind:value={voteLast} />
						</div>
						<div class="w-full max-w-[610px] flex flex-col justify-center">
							<div>Vote Key Dilution:</div>
							<input class="input input-primary" type="number" bind:value={voteKeyDilution} />
						</div>
						<div class="w-full max-w-[610px] flex flex-col justify-center">
							<button class="btn btn-primary btn-sm" on:click={registerOnline}>Register Online</button>
						</div>
						<div class="w-full max-w-[610px] flex flex-col justify-center">
							<button class="btn btn-primary btn-sm" on:click={registerOffline}>Register Offline</button>
						</div>
					</div>
					<br />
					{#if $connectedAccount === managerAddress}
						<h4 class="text-left">Update Pool Contract (VOI/{arc200Token.ticker})</h4>

						<div class="flex justify-center mt-2 pr-0">
							<button
								class="btn btn-primary w-full box-border"
								class:disabled={updating}
								disabled={updating}
								on:click={updatePool}
							>
								Update Pool Contract
							</button>
						</div>
						<br />
					{/if}
				</form>
			{/if}
		{:else if typeof $arc200Balance !== 'undefined'}
			<!--  -->
			{#if (initialLiquidityAmount ?? 0) > 1}
				<form on:submit|preventDefault class="flex flex-col gap-2 w-full max-w-[448px] mt-40 prose">
					<h4 class="text-left">Create Liquidity Pool (VOI/{arc200Token.ticker})</h4>
					<h6 class="text-left">
						Initial Liquidity: {initialLiquidityAmount} VOI / {initialLiquidityAmount}
						{arc200Token.ticker}
					</h6>

					<div class="flex justify-center mt-2 pr-0">
						<button
							class="btn btn-primary w-full box-border"
							class:disabled={updating}
							disabled={updating}
							on:click={createVoiPool}
						>
							Create Pool
						</button>
					</div>
					<br />
				</form>
			{:else}
				Not Enough balance to create liquidity pool
				<br />
				Balance: {($connectedUserState.amount / 1e6).toLocaleString('en')} VOI / {(
					Number(convertDecimals($arc200Balance ?? 0n, arc200Token.decimals, 6)) / 1e6
				).toLocaleString('en')}
				{arc200Token.ticker}
			{/if}
		{/if}
	</div>
</section>
