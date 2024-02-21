import { Contract } from '@algorandfoundation/tealscript';

const TOTAL_SUPPLY = 10_000_000_000_000_000;
const SCALE = 100_000_000;
const PLATFORM_FEE = 50_000_000;
const POOL_TOKEN_NAME = 'VOI-VIA LPT';
const POOL_TOKEN_UNIT = 'LPT';

export class Arc200Swap extends Contract {
	// admin account
	admin = GlobalStateKey<Address>({ key: 'admin' });

	// pool token (lpt), given to liquidity providers
	pool_token = GlobalStateKey<Asset>({ key: 'pool_token' });

	// ratio
	ratio = GlobalStateKey<uint64>({ key: 'ratio' });
	private set_ratio(): void {
		this.ratio.value = wideRatio([this.get_balance(), SCALE], [this.get_arc200_balance()]);
	}

	// liquidity providers fee, 1 = 0.01%
	fee = GlobalStateKey<uint64>({ key: 'fee' });

	// arc200 token application
	arc200_token = GlobalStateKey<Application>({ key: 'arc200_token' });

	// check if pool has been initialized
	initialized = GlobalStateKey<boolean>({ key: 'initialized' });

	Swap = new EventLogger<{
		sender: Address;
		from_amount: uint64;
		to_amount: uint64;
		direction: uint<8>;
	}>();

	// initialize values
	createApplication(): void {
		this.admin.value = this.txn.sender;
		this.arc200_token.value = Application.fromID(6779767); // via
		this.fee.value = 50; // 0.5 %
		this.initialized.value = false;
	}

	// allow admin to update the application
	updateApplication(): void {
		assert(this.txn.sender === this.admin.value);
	}

	/**************************************************/

	private tokens_to_mint_intial(a_amount: uint64, b_amount: uint64): uint64 {
		return sqrt(a_amount * b_amount);
	}

	private tokens_to_mint(
		issued: uint64,
		a_supply: uint64,
		b_supply: uint64,
		a_amount: uint64,
		b_amount: uint64
	): uint64 {
		const a_ratio = wideRatio([a_amount, SCALE], [a_supply]);
		const b_ratio = wideRatio([b_amount, SCALE], [b_supply]);

		const ratio = a_ratio < b_ratio ? a_ratio : b_ratio;

		return wideRatio([ratio, issued], [SCALE]);
	}

	private compute_token_withdraw_amount(issued: uint64, supply: uint64, amount: uint64): uint64 {
		return wideRatio([supply, amount], [issued]);
	}

	private compute_out_tokens(in_amount: uint64, in_supply: uint64, out_supply: uint64, fee: uint64): uint64 {
		const factor = SCALE - fee;

		const numerator = <uint<256>>in_amount * <uint<256>>out_supply * <uint<256>>factor;
		const denominator = (<uint<256>>in_amount + <uint<256>>in_supply) * <uint<256>>SCALE;

		return <uint64>(numerator / denominator);
	}

	private compute_out_tokens_platform_fee(in_amount: uint64, in_supply: uint64, out_supply: uint64): uint64 {
		const amount_without_fee = this.compute_out_tokens(in_amount, in_supply, out_supply, 0);
		const amount_with_fee = this.compute_out_tokens(in_amount, in_supply, out_supply, this.fee.value);

		return ((amount_without_fee - amount_with_fee) * PLATFORM_FEE) / SCALE;
	}

	/**************************************************/

	private get_balance(): uint64 {
		return this.app.address.balance - 1000_000;
	}

	private get_arc200_balance(): uint64 {
		return <uint64>sendMethodCall<[Address], uint<256>>({
			sender: this.app.address,
			name: 'arc200_balanceOf',
			applicationID: this.arc200_token.value,
			methodArgs: [this.app.address],
			fee: 1000,
		});
	}

	private transfer_to(to: Address, amount: uint64): boolean {
		sendPayment({
			sender: this.app.address,
			receiver: to,
			amount: amount,
			fee: 1000,
		});
		return true;
	}

	private asa_transfer_to(receiver: Account, asset: Asset, amount: uint64): boolean {
		sendAssetTransfer({
			assetReceiver: receiver,
			xferAsset: asset,
			assetAmount: amount,
			fee: 1000,
		});
		return true;
	}

	private arc200_transfer_to(to: Address, amount: uint64): boolean {
		return sendMethodCall<[Address, uint<256>], boolean>({
			sender: this.app.address,
			name: 'arc200_transfer',
			applicationID: this.arc200_token.value,
			methodArgs: [to, <uint<256>>amount],
			fee: 1000,
		});
	}

	private arc200_tranfer_from(from: Address, to: Address, amount: uint64): boolean {
		return sendMethodCall<[Address, Address, uint<256>], boolean>({
			sender: this.app.address,
			name: 'arc200_transferFrom',
			applicationID: this.arc200_token.value,
			methodArgs: [from, to, <uint<256>>amount],
			fee: 1000,
		});
	}

	/**************************************************/

	mint(pay_txn: PayTxn, arc200_amount: uint64, pool_token: Asset): void {
		verifyPayTxn(pay_txn, {
			sender: this.txn.sender,
			receiver: this.app.address,
			amount: { greaterThan: 0 },
		});

		assert(arc200_amount > 0);
		assert(pool_token === this.pool_token.value);
		assert(this.get_balance() > 0);

		this.arc200_tranfer_from(this.txn.sender, this.app.address, arc200_amount);

		let to_mint = <uint64>0;

		if (!this.initialized.value) {
			to_mint = this.tokens_to_mint_intial(pay_txn.amount, arc200_amount);
			this.initialized.value = true;
		} else {
			to_mint = this.tokens_to_mint(
				TOTAL_SUPPLY - this.app.address.assetBalance(this.pool_token.value),
				this.get_balance() - pay_txn.amount,
				this.get_arc200_balance() - arc200_amount,
				pay_txn.amount,
				arc200_amount
			);
		}

		assert(to_mint > 0);

		this.asa_transfer_to(this.txn.sender, this.pool_token.value, to_mint);
		this.set_ratio();
	}

	burn(lpt_pay_txn: AssetTransferTxn): void {
		verifyAssetTransferTxn(lpt_pay_txn, {
			sender: this.txn.sender,
			assetAmount: { greaterThan: 0 },
			assetReceiver: this.app.address,
			xferAsset: this.pool_token.value,
		});

		assert(this.get_balance() > 0);

		const issued = TOTAL_SUPPLY - (this.app.address.assetBalance(this.pool_token.value) - lpt_pay_txn.assetAmount);

		const withdraw_amount = this.compute_token_withdraw_amount(issued, this.get_balance(), lpt_pay_txn.assetAmount);
		const arc200_withdraw_amount = this.compute_token_withdraw_amount(
			issued,
			this.get_arc200_balance(),
			lpt_pay_txn.assetAmount
		);

		this.transfer_to(this.txn.sender, withdraw_amount);
		this.arc200_transfer_to(this.txn.sender, arc200_withdraw_amount);

		this.set_ratio();
	}

	/**************************************************/

	swap_to_arc200(pay_txn: PayTxn, min_amount: uint64): uint64 {
		verifyPayTxn(pay_txn, {
			sender: this.txn.sender,
			receiver: this.app.address,
			amount: { greaterThan: 0 },
		});

		const arc200_balance = this.get_arc200_balance();
		const balance = this.get_balance();

		assert(balance > 0);
		assert(arc200_balance > 0);

		const to_swap = this.compute_out_tokens(pay_txn.amount, balance - pay_txn.amount, arc200_balance, this.fee.value);

		const platform_fee = this.compute_out_tokens_platform_fee(pay_txn.amount, balance - pay_txn.amount, arc200_balance);

		assert(to_swap > 0);
		assert(to_swap >= min_amount);

		this.arc200_transfer_to(this.txn.sender, to_swap);
		this.arc200_transfer_to(this.admin.value, platform_fee);
		this.set_ratio();

		this.Swap.log({
			sender: this.txn.sender,
			from_amount: pay_txn.amount,
			to_amount: to_swap,
			direction: 0,
		});

		return to_swap;
	}

	swap_from_arc200(arc200_amount: uint64, min_amount: uint64): uint64 {
		this.arc200_tranfer_from(this.txn.sender, this.app.address, arc200_amount);

		const arc200_balance = this.get_arc200_balance();
		const balance = this.get_balance();

		assert(balance > 0);
		assert(arc200_balance > 0);

		const to_swap = this.compute_out_tokens(arc200_amount, arc200_balance - arc200_amount, balance, this.fee.value);

		const platform_fee = this.compute_out_tokens_platform_fee(arc200_amount, arc200_balance - arc200_amount, balance);

		assert(to_swap > 0);
		assert(to_swap >= min_amount);

		this.transfer_to(this.txn.sender, to_swap);
		this.transfer_to(this.admin.value, platform_fee);
		this.set_ratio();

		this.Swap.log({
			sender: this.txn.sender,
			from_amount: arc200_amount,
			to_amount: to_swap,
			direction: 1,
		});

		return to_swap;
	}

	/**************************************************/

	create_pool_token(seed: PayTxn): Asset {
		assert(this.txn.sender === this.admin.value);
		verifyPayTxn(seed, { receiver: this.app.address, amount: { greaterThanEqualTo: 1010_000 } });
		assert(!this.pool_token.exists);

		this.pool_token.value = sendAssetCreation({
			configAssetName: POOL_TOKEN_NAME,
			configAssetUnitName: POOL_TOKEN_UNIT,
			configAssetTotal: TOTAL_SUPPLY,
			configAssetDecimals: 6,
			configAssetManager: this.app.address,
			configAssetReserve: this.app.address,
			fee: 1000,
		});

		return this.pool_token.value;
	}

	register_online(
		selection_pk: bytes,
		state_proof_pk: bytes,
		vote_pk: bytes,
		vote_first: uint64,
		vote_last: uint64,
		vote_key_dilution: uint64
	): void {
		assert(this.txn.sender === this.admin.value);

		sendOnlineKeyRegistration({
			sender: this.app.address,
			selectionPK: selection_pk,
			stateProofPK: state_proof_pk,
			votePK: vote_pk,
			voteFirst: vote_first,
			voteLast: vote_last,
			voteKeyDilution: vote_key_dilution,
			fee: 1000,
		});
	}

	register_offline(): void {
		assert(this.txn.sender === this.admin.value);

		sendOfflineKeyRegistration({
			sender: this.app.address,
			fee: 1000,
		});
	}

	set_fees(fee: uint64): void {
		assert(this.txn.sender === this.admin.value);
		this.fee.value = fee;
	}

	set_admin(admin: Account): void {
		assert(this.txn.sender === this.admin.value);
		this.admin.value = admin;
	}
}
