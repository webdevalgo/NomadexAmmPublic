<script lang="ts" context="module">
	export type PriceCandleData = {
		x: number;
		o: number;
		h: number;
		l: number;
		c: number;
	};
</script>

<script lang="ts">
	import { Chart, _adapters, BarController, defaults, Element, LinearScale, TimeSeriesScale } from 'chart.js';
	import { clipArea, isNullOrUndef, merge, unclipArea, valueOrDefault } from 'chart.js/helpers';
	import { DateTime } from 'luxon';
	import { chartJsAdapterLuxon } from './chartjs-adapter-luxon';
	import { chartJsChartFinancial } from './chartjs-chart-financial';
	import { isDarkTheme } from '$lib/stores';

	export let label: string;
	export let data: PriceCandleData[];
	export let logarithmic: boolean = false;

	chartJsAdapterLuxon(_adapters, DateTime);
	chartJsChartFinancial(
		{ BarController, Chart, defaults, Element, LinearScale, TimeSeriesScale },
		{
			clipArea,
			isNullOrUndef,
			merge,
			unclipArea,
			valueOrDefault,
		}
	);

	let updating: Promise<{ data: typeof data; logarithmic: boolean; label: string; isDarkThemeActive: boolean }>;

	$: updating = new Promise((r) =>
		setTimeout(() => r({ data, logarithmic, label, isDarkThemeActive: $isDarkTheme }), 300)
	);

	function candleChart(
		canvas: HTMLCanvasElement,
		{ data: _data, logarithmic, label, isDarkThemeActive }: Awaited<typeof updating>
	) {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		Chart.defaults.color = isDarkThemeActive ? '#f0f0f0' : '#222222';

		const chart = new Chart(ctx, {
			type: <any>'candlestick',
			options: {
				responsive: true,
				maintainAspectRatio: true,
				aspectRatio: 4 / 2,
				scales: {
					y: {
						type: logarithmic ? 'logarithmic' : 'linear',
						position: 'right', // `axis` is determined by the position as `'y'`
						ticks: {
							beginAtZero: true,
						},
					},
				},
			},
			data: {
				datasets: [
					{
						label: label,
						data: _data,
						color: {
							up: 'rgba(80, 160, 115, 1)',
							down: 'rgba(215, 85, 65, 1)',
							unchanged: 'rgba(90, 90, 90, 1)',
						},
					},
				],
			},
		});

		return {
			update({ data: _data, label }: { data: PriceCandleData[]; logarithmic: boolean; label: string }) {
				// chart.scales.y[<string>'type'] = logarithmic ? 'logarithmic' : 'linear';
				chart.config.data.datasets = [
					{
						label: label,
						data: _data,
						color: {
							up: 'rgba(80, 160, 115, 1)',
							down: 'rgba(215, 85, 65, 1)',
							unchanged: 'rgba(90, 90, 90, 1)',
						},
					},
				];
				chart.update();
			},
			destroy: () => {
				chart.destroy();
			},
		};
	}
</script>

<div class="canvas-wrapper relative">
	{#await updating}
		<span class="loading text-primary" />
	{:then resp}
		<canvas use:candleChart={resp} />
	{/await}
</div>

<style>
	.canvas-wrapper {
		width: 100%;
		aspect-ratio: 4 / 2;
		margin: 2rem;
		display: flex;
		justify-content: center;
	}
	canvas {
		width: 100%;
		opacity: 0;
		animation: fadein 500ms ease-in 100ms forwards;
	}

	@keyframes fadein {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
