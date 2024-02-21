<script lang="ts" context="module">
	import { writable } from 'svelte/store';
	type Notification = {
		id: number;
		message: string;
		type: 'info' | 'error' | 'warn' | 'pending' | 'success';
		remove: () => void;
	};
	type NotificationInternals = {};
	let notifications = writable<(Notification & NotificationInternals)[]>([]);

	export function addNotification(type: Notification['type'], message: string, timeoutMs?: number) {
		const notification = {
			id: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
			type,
			message,
			remove() {},
		};

		let timeout: NodeJS.Timeout;
		if (typeof timeoutMs === 'number') {
			timeout = setTimeout(() => {
				notification.remove();
			}, timeoutMs);
		}

		notification.remove = () => {
			clearTimeout(timeout);
			notifications.update((ns) => ns.filter((not) => not.id !== notification.id));
		};

		notifications.update((nts) => {
			nts.push(notification);
			return nts;
		});

		return notification.remove;
	}

	// setInterval(() => {
	// 	if (Math.random() > 0.5) {
	// 		switch (Math.floor(Math.random() * 5)) {
	// 			case 0:
	// 				addNotification('info', 'Hello World', Math.random() * 30000);
	// 				break;
	// 			case 1:
	// 				addNotification('warn', 'Hello World', Math.random() * 30000);
	// 				break;
	// 			case 2:
	// 				addNotification('error', 'Lorem ipsum dolor sit amet.', Math.random() * 30000);
	// 				break;
	// 			case 3:
	// 				addNotification(
	// 					'success',
	// 					'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!',
	// 					Math.random() * 30000
	// 				);
	// 				break;

	// 			case 4:
	// 				addNotification('pending', 'Hello World', Math.random() * 30000);
	// 				break;
	// 		}
	// 	}
	// }, 1000);

	// addNotification('info', 'Hello World');
	// addNotification(
	// 	'info',
	// 	'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor! Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!   Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!'
	// );
	// addNotification('warn', 'Hello World');
	// addNotification(
	// 	'warn',
	// 	'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor! Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!   Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!'
	// );
	// addNotification('error', 'Lorem ipsum dolor sit amet.');
	// addNotification(
	// 	'error',
	// 	'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor! Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!   Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!'
	// );
	// addNotification('success', 'Lorem ipsum dolor');
	// addNotification(
	// 	'success',
	// 	'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor! Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!   Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!'
	// );
	// addNotification('pending', 'Hello World');
	// addNotification(
	// 	'pending',
	// 	'Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor! Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!   Lorem ipsum dolor sit amet consectetur adipisicing elit. Obcaecati, dolor!'
	// );
</script>

<script lang="ts">
	import CloseIcon from 'svelte-star/dist/md/MdClose.svelte';
	import InfoIcon from 'svelte-star/dist/md/MdInfo.svelte';
	import WarnIcon from 'svelte-star/dist/md/MdWarning.svelte';
	import ErrorIcon from 'svelte-star/dist/md/MdError.svelte';
	import SuccessIcon from 'svelte-star/dist/md/MdCheckCircle.svelte';
</script>

{#if $notifications.length}
	<div class="fixed top-10 right-10 min-w-[250px] min-h-[40px] text-white rounded-btn flex flex-col gap-2 items-end">
		{#each $notifications as notification}
			<div
				class="notification items-start justify-between relative bg-primary rounded-btn p-2 text-wrap max-w-[250px] {notification.type}"
			>
				<button
					on:click={() => notification.remove()}
					class="close bg-red-900 btn-sm w-10 h-10 scale-[0.5] p-0 absolute top-[-5px] right-[-8px]"
				>
					<CloseIcon />
				</button>
				<span class="icon">
					{#if notification.type === 'info'}
						<InfoIcon />
					{:else if notification.type === 'warn'}
						<WarnIcon />
					{:else if notification.type === 'error'}
						<ErrorIcon />
					{:else if notification.type === 'pending'}
						<span class="loading w-5 ml-[0.17rem] mt-[0.17rem]" />
					{:else if notification.type === 'success'}
						<SuccessIcon />
					{/if}
				</span>
				<span class="message">
					{notification.message.slice(0, 100)}{notification.message.length > 100 ? '...' : ''}
				</span>
			</div>
		{/each}
	</div>
{/if}

<style>
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.notification {
		animation: fade 1s forwards;
		background: var(--notification-bg);
		padding-right: 2rem;
		padding-left: 2.5rem;
	}
	.notification > .close {
		background: var(--notification-bg);
	}
	.notification > .icon {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		height: 1.5rem;
		width: 1.5rem;
	}
	.notification.info {
		--notification-bg: rgb(0, 110, 255);
	}
	.notification.error {
		--notification-bg: red;
	}
	.notification.warn {
		--notification-bg: orange;
		color: black;
	}
	.notification.pending {
		--notification-bg: rgb(0, 110, 255);
	}
	.notification.success {
		--notification-bg: rgb(54, 169, 54);
	}
</style>
