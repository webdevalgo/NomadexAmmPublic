<script lang="ts">
	import { onMount } from 'svelte';

	let millionars: { address: string; amount: number; viaAmount: number }[] = [];
	let loading = false;

	onMount(async () => {
		try {
			loading = true;
			const holdersResp = await fetch('https://api.nomadex.app/holders');
			const holders = await holdersResp.json();
			millionars = holders;
		} catch (e) {
			console.error(e);
		}
		loading = false;
	});
	const filteredAddresess = [
		'VIAGCPULN6FUTHUNPQZDRQIHBT7IUVT264B3XDXLZNX7OZCJP6MEF7JFQU',
		'SDLCDDT7GAREOI5TJAZGIMXKPYYCPQVY4DXY75GHWHLKU7SZYVXVL5VIDY',
		'6HZGVRXNG6LR7FW5CVCISC4P2VY7HSKCVRFPZXNHMZZUUNL3KX4SHM2VOI',
		'6XW62HD3E564FITISBJNA7KKW3SSJV7WI67XBJOUVPL6LGLWDWB3HO2VOI',
		'GZ44UHLUBOH5YG52H4NUMEDSP7XKTSFEG4PZA2W6MY4QSKPSCCHJH72VOI',
		'JIJ2QKPZU3D3MFQUAVZUWBXJTYMNEMHSD7CO6Z3OCRLZQB2AHYQSEE2VOI',
		'OUJQM64LXOA3HN7HWNU5KEXI3YTUZHXLH5IY3L63KCZRQFUVBBON6I2VOI',
		'P5KTY72V3EK2IFVGRS66ZWRTNTEAI4HKS3F63EFHDE6P7IMC2PIYJN2VOI',
		'T6LZ5ROKXFSA4EUM6YLS3XWKCSY5GFM7GH3BEPTHAKVV5OGQL5L7OO2VOI',
		'XOYL4FQ6JXXA25JG3G5QVBPWG6S5MRQNT24ZUQ3CP5HGCISI2P53YH2VOI',
		'ZGHF6BNEXIFI3VXFWQMACB2TY63QGV4DEJXNFSLEMDY4CUISRR53FQ2VOI',

		'DIT3MNSV4QU7SMB7XBLTYWKOZTI3F5LT45FDSN63VTVBU7KGZDFLOZPRPI',
		'EQBOT7R5PA7KELBQNDL2UWRC6YL3OX7ZEPG7IFVDUWXQEFWQEWA7JQ5DIQ',
		'EQBOTUQ2VY2VT6RCQGYPXOAQUPB65PLRYTACD4AG6BAHU6SLXSS6NRC75A',
		'GOVFU2FZZ2IURHNZZFEKRDHHRKTUHA5FWXRTDMHU4ZV6L46JND43XREYKA',

		'OO2VQ53ELOU2QRKFF6NMTEOOXVHPABSBRN3QVKSTEJOJHTU2DNSHCAOJIY',

		'C46D7INVWU4U2CPOE5NVZT6ZB5NWOLU57U6BDTRFGEDWRKHTT7SPG3JTCA',
		'AGW4ZRWDAVSX46ODGH6WCWYGV33QOO6LDRGON4AD3MD4T5TUSK56M256OU',
	];
	const namedWallets = {};
	let filter = true;
	let voiValue = 0;
	let voiValues = [1, 2.2];
	let sortBy = 'total';

	$: filtededHolders = (filter ? millionars.filter((mil) => !filteredAddresess.includes(mil.address)) : millionars).map(
		(h) => ({ ...h, amount: h.amount * voiValues[voiValue % voiValues.length] })
	);
</script>

{#if loading}
	<div class="h-full flex justify-center items-center">
		<span class="loading" />
	</div>
{:else}
	<div class="w-full h-full flex flex-col items-center justify-center p-12">
		<div class="flex justify-between w-full max-w-[600px]">
			<button on:click={() => (filter = !filter)}>{filter ? 'Filtered' : 'Unfiltered'}</button>
			<button on:click={() => voiValue++}>1 VOI = {voiValues[voiValue % voiValues.length]} VIA</button>
		</div>
		<br />
		<table>
			<tr class="cursor-pointer">
				<th>#</th>
				<th>Address</th>
				<th class="hidden min-[500px]:table-cell" on:click={() => (sortBy = 'amount')}>Voi Balance</th>
				<th class="hidden min-[500px]:table-cell" on:click={() => (sortBy = 'viaAmount')}>Via Balance</th>
				<th on:click={() => (sortBy = 'total')}>Total</th>
			</tr>
			{#each [...filtededHolders]
				.map( (mil) => ({ address: mil.address, amount: mil.amount, viaAmount: mil.viaAmount, total: mil.amount + mil.viaAmount }) )
				.sort((a, b) => b[sortBy] - a[sortBy]) as millionar, index (millionar.address)}
				<tr>
					<td>
						{`${index + 1}`.padStart(2, '0')}
					</td>
					<td>
						<a
							href="https://voi.observer/explorer/account/{millionar.address}"
							referrerpolicy="no-referrer"
							target="_blank"
						>
							{#if namedWallets[millionar.address]}
								{namedWallets[millionar.address]}
							{:else}
								{millionar.address.slice(0, 3)}...{millionar.address.slice(-3)}
							{/if}
						</a>
					</td>
					<td class="hidden min-[500px]:table-cell">{Math.floor(millionar.amount / 1e6).toLocaleString('en')}</td>
					<td class="hidden min-[500px]:table-cell">{Math.floor(millionar.viaAmount / 1e6).toLocaleString('en')}</td>
					<td>{Math.floor(millionar.total / 1e6).toLocaleString('en')}</td>
				</tr>
			{/each}
		</table>
	</div>
{/if}

<style>
	table {
		width: 100%;
		max-width: 600px;
	}
	th {
		text-align: left;
	}
	th,
	td {
		border-bottom: 2px solid #ffffff11;
	}
</style>
