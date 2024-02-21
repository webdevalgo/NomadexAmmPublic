import { Contract } from '@algorandfoundation/tealscript';

const LPT_TOTAL_SUPPLY = 10_000_000_000_000_000;
const LPT_ASSET_DECIMALS = 6;
const SCALE = 100_000_000;
const INITIAL_ADMIN_FEE = 50_000_000; // 50% of the swap fee
const MIN_BALANCE = 1000_000; // 1 algo

export class AlgoArc200Pool extends Contract {
	/** admin account */
	admin = GlobalStateKey<Address>({ key: 'admin' });

	/** governer account */
	governer = GlobalStateKey<Address>({ key: 'governer' });

	/** ratio of algo to arc200 tokens in app account */
	ratio = GlobalStateKey<uint64>({ key: 'ratio' });

	/** swap fee liquidity providers fee, 1,000,000 = 1% */
	swap_fee = GlobalStateKey<uint64>({ key: 'swap_fee' });

	/** admin fee, deducted from swap_fee, 1,000,000 = 1% */
	admin_fee = GlobalStateKey<uint64>({ key: 'admin_fee' });

	/** pool token (lpt), given to liquidity providers */
	lpt_asset = GlobalStateKey<Asset>({ key: 'lpt_asset' });

	/** arc200 token application */
	arc200_token = GlobalStateKey<Application>({ key: 'arc200_token' });

	/** if pool tokens can be minted */
	mint_enabled = GlobalStateKey<boolean>({ key: 'mint_enabled' });

	/** if pool tokens can be burned */
	burn_enabled = GlobalStateKey<boolean>({ key: 'burn_enabled' });

	/** if swapping is enabled */
	swap_enabled = GlobalStateKey<boolean>({ key: 'swap_enabled' });

	/** check if pool has been initialized */
	initialized = GlobalStateKey<boolean>({ key: 'initialized' });

	/**
	 * Event Swap(sender, from_amount, to_amount, is_direction_from_arc200_to_algo)
	 */
	Swap = new EventLogger<{
		sender: Address;
		from_amount: uint64;
		to_amount: uint64;
		is_direction_from_arc200_to_algo: uint<8>;
	}>();

	/**
	 * Event Mint(sender, algo_amount, arc200_amount, lpt_amount_minted)
	 */
	Mint = new EventLogger<{
		sender: Address;
		algo_amount: uint64;
		arc200_amount: uint64;
		lpt_amount: uint64;
	}>();

	/**
	 * Event Burn(sender, lpt_amount_burned, algo_amount, arc200_amount)
	 */
	Burn = new EventLogger<{
		sender: Address;
		algo_amount: uint64;
		arc200_amount: uint64;
		lpt_amount: uint64;
	}>();

	/** initialize values  */
	createApplication(admin: Address, governer: Address, arc200_token: Application, lp_fee: uint64): void {
		this.admin.value = admin;
		this.governer.value = governer;
		this.arc200_token.value = arc200_token;
		this.swap_fee.value = lp_fee;
		this.admin_fee.value = wideRatio([lp_fee, INITIAL_ADMIN_FEE], [SCALE]);
		this.mint_enabled.value = true;
		this.burn_enabled.value = true;
		this.swap_enabled.value = true;
		this.initialized.value = false;
	}

	/** allows admin to update the application  */
	updateApplication(): void {
		assert(this.txn.sender === this.admin.value);
	}

	create_pool_token(algo_seed_txn: PayTxn, lpt_name: string, lpt_unit: string): Asset {
		assert(this.txn.sender === this.governer.value || this.txn.sender === this.admin.value);
		assert(!this.lpt_asset.exists);
		verifyPayTxn(algo_seed_txn, { receiver: this.app.address, amount: { greaterThanEqualTo: MIN_BALANCE + 1000 } });

		this.lpt_asset.value = sendAssetCreation({
			configAssetName: lpt_name,
			configAssetUnitName: lpt_unit,
			configAssetTotal: LPT_TOTAL_SUPPLY,
			configAssetDecimals: LPT_ASSET_DECIMALS,
			configAssetManager: this.app.address,
			configAssetReserve: this.app.address,
			fee: 1000,
		});

		return this.lpt_asset.value;
	}

	set_admin(admin: Address): void {
		assert(this.txn.sender === this.admin.value);
		this.admin.value = admin;
	}

	set_governer(governer: Address): void {
		assert(this.txn.sender === this.governer.value || this.txn.sender === this.admin.value);
		this.governer.value = governer;
	}

	set_fees(fee: uint64): void {
		assert(this.txn.sender === this.governer.value || this.txn.sender === this.admin.value);
		this.swap_fee.value = fee;
	}

	set_mint_enabled(enabled: boolean): void {
		assert(this.txn.sender === this.governer.value || this.txn.sender === this.admin.value);
		this.mint_enabled.value = enabled;
	}

	set_burn_enabled(enabled: boolean): void {
		assert(this.txn.sender === this.governer.value || this.txn.sender === this.admin.value);
		this.burn_enabled.value = enabled;
	}

	set_swap_enabled(enabled: boolean): void {
		assert(this.txn.sender === this.governer.value || this.txn.sender === this.admin.value);
		this.swap_enabled.value = enabled;
	}

	register_online(
		selection_pk: bytes,
		state_proof_pk: bytes,
		vote_pk: bytes,
		vote_first: uint64,
		vote_last: uint64,
		vote_key_dilution: uint64
	): void {
		assert(this.txn.sender === this.governer.value || this.txn.sender === this.admin.value);

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
		assert(this.txn.sender === this.governer.value || this.txn.sender === this.admin.value);

		sendOfflineKeyRegistration({
			sender: this.app.address,
			fee: 1000,
		});
	}

	set_ratio(): void {
		this.ratio.value = wideRatio([this.get_balance(), SCALE], [this.get_arc200_balance()]);
	}

	/**********************************************/
	/***    Get Balance and Tranefer  Helpers   ***/
	/**********************************************/

	private get_balance(): uint64 {
		return this.app.address.balance - MIN_BALANCE;
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
			sender: this.app.address,
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

	/**********************************************/
	/***       Math and Token Calc Helpers      ***/
	/**********************************************/

	/**
	 * Compute how many tokens to mint first time (i.e. when initializing)
	 * @param amount_of_a
	 * @param amount_of_b
	 * @returns
	 */
	private tokens_to_mint_intial(amount_of_a: uint64, amount_of_b: uint64): uint64 {
		return sqrt(amount_of_a * amount_of_b);
	}

	/**
	 * Compute how many pool token to mint
	 * @param issued
	 * @param supply_of_a
	 * @param supply_of_b
	 * @param amount_of_a
	 * @param amount_of_b
	 * @returns
	 */
	private tokens_to_mint(
		issued: uint64,
		supply_of_a: uint64,
		supply_of_b: uint64,
		amount_of_a: uint64,
		amount_of_b: uint64
	): uint64 {
		const a_ratio = wideRatio([amount_of_a, SCALE], [supply_of_a]);
		const b_ratio = wideRatio([amount_of_b, SCALE], [supply_of_b]);

		const ratio = a_ratio < b_ratio ? a_ratio : b_ratio;

		return wideRatio([ratio, issued], [SCALE]);
	}

	/**
	 *
	 * @param lpt_issued
	 * @param supply_of_token_in_app
	 * @param lpt_amount
	 * @returns
	 */
	private compute_token_return_amount_for_burning_lpt(
		lpt_issued: uint64,
		supply_of_token_in_app: uint64,
		lpt_amount: uint64
	): uint64 {
		return wideRatio([supply_of_token_in_app, lpt_amount], [lpt_issued]);
	}

	/**
	 * Compute how many tokens to give out during swap
	 * @param in_amount
	 * @param in_supply
	 * @param out_supply
	 * @param fee
	 * @returns
	 */
	private compute_out_tokens(in_amount: uint64, in_supply: uint64, out_supply: uint64, fee: uint64): uint64 {
		const factor = SCALE - fee;

		const numerator = <uint<256>>in_amount * <uint<256>>out_supply * <uint<256>>factor;
		const denominator = (<uint<256>>in_amount + <uint<256>>in_supply) * <uint<256>>SCALE;

		return <uint64>(numerator / denominator);
	}

	/**
	 * Compute platform fee duraing swap
	 * @param in_amount
	 * @param in_supply
	 * @param out_supply
	 * @returns
	 */
	private compute_out_tokens_admin_fee(in_amount: uint64, in_supply: uint64, out_supply: uint64): uint64 {
		const amount_without_fee = this.compute_out_tokens(in_amount, in_supply, out_supply, 0);
		const amount_with_fee = this.compute_out_tokens(in_amount, in_supply, out_supply, this.swap_fee.value);

		return ((amount_without_fee - amount_with_fee) * this.admin_fee.value) / SCALE;
	}

	/**********************************************/
	/***       Mint / Burn / Swap Methods       ***/
	/**********************************************/

	/**
	 * Add liquidity and mints lpt token
	 * @param pay_txn pay txn with algos sending to this app account
	 * @param arc200_amount amount of arc200 approved to add to liquidity
	 * @param lpt_asset lpt asset needed to mint
	 */
	mint(pay_txn: PayTxn, arc200_amount: uint64, lpt_asset: Asset): void {
		assert(this.mint_enabled.value);

		verifyPayTxn(pay_txn, {
			sender: this.txn.sender,
			receiver: this.app.address,
			amount: { greaterThan: 0 },
		});

		assert(arc200_amount > 0);
		assert(lpt_asset === this.lpt_asset.value);
		assert(this.get_balance() > 0);

		this.arc200_tranfer_from(this.txn.sender, this.app.address, arc200_amount);

		let to_mint = <uint64>0;

		if (!this.initialized.value) {
			to_mint = this.tokens_to_mint_intial(pay_txn.amount, arc200_amount);
			this.initialized.value = true;
		} else {
			to_mint = this.tokens_to_mint(
				LPT_TOTAL_SUPPLY - this.app.address.assetBalance(this.lpt_asset.value),
				this.get_balance() - pay_txn.amount,
				this.get_arc200_balance() - arc200_amount,
				pay_txn.amount,
				arc200_amount
			);
		}

		assert(to_mint > 0);

		this.asa_transfer_to(this.txn.sender, this.lpt_asset.value, to_mint);

		this.Mint.log({
			sender: this.txn.sender,
			algo_amount: pay_txn.amount,
			arc200_amount: arc200_amount,
			lpt_amount: to_mint,
		});

		this.set_ratio();
	}

	/**
	 * Withdraw liquidity
	 */
	burn(lpt_xfer_txn: AssetTransferTxn): void {
		assert(this.burn_enabled.value);

		verifyAssetTransferTxn(lpt_xfer_txn, {
			sender: this.txn.sender,
			assetAmount: { greaterThan: 0 },
			assetReceiver: this.app.address,
			xferAsset: this.lpt_asset.value,
		});

		assert(this.get_balance() > 0);

		const lpt_issues =
			LPT_TOTAL_SUPPLY - (this.app.address.assetBalance(this.lpt_asset.value) - lpt_xfer_txn.assetAmount);

		const withdraw_amount = this.compute_token_return_amount_for_burning_lpt(
			lpt_issues,
			this.get_balance(),
			lpt_xfer_txn.assetAmount
		);
		const arc200_withdraw_amount = this.compute_token_return_amount_for_burning_lpt(
			lpt_issues,
			this.get_arc200_balance(),
			lpt_xfer_txn.assetAmount
		);

		this.transfer_to(this.txn.sender, withdraw_amount);
		this.arc200_transfer_to(this.txn.sender, arc200_withdraw_amount);

		this.Burn.log({
			sender: this.txn.sender,
			lpt_amount: lpt_xfer_txn.assetAmount,
			algo_amount: withdraw_amount,
			arc200_amount: arc200_withdraw_amount,
		});

		this.set_ratio();
	}

	/**
	 * Swap from Algos to Arc200
	 * @param pay_txn Txn with an amount of algos sending to this app account
	 * @param min_amount min arc200 for this swap to be successful
	 * @returns amount of algos returned
	 */
	swap_to_arc200(pay_txn: PayTxn, min_amount: uint64): uint64 {
		assert(this.swap_enabled.value);

		verifyPayTxn(pay_txn, {
			sender: this.txn.sender,
			receiver: this.app.address,
			amount: { greaterThan: 0 },
		});

		const arc200_balance = this.get_arc200_balance();
		const balance = this.get_balance();

		assert(balance > 0);
		assert(arc200_balance > 0);

		const to_swap = this.compute_out_tokens(
			pay_txn.amount,
			balance - pay_txn.amount,
			arc200_balance,
			this.swap_fee.value
		);

		const admin_fee = this.compute_out_tokens_admin_fee(pay_txn.amount, balance - pay_txn.amount, arc200_balance);

		const admin_fee_in_algos = this.compute_out_tokens(admin_fee, arc200_balance - admin_fee, balance, 0);

		assert(to_swap > 0);
		assert(to_swap >= min_amount);

		this.arc200_transfer_to(this.txn.sender, to_swap);
		this.transfer_to(this.admin.value, admin_fee_in_algos);

		this.set_ratio();

		this.Swap.log({
			sender: this.txn.sender,
			from_amount: pay_txn.amount,
			to_amount: to_swap,
			is_direction_from_arc200_to_algo: 0,
		});

		return to_swap;
	}

	/**
	 * Swap tokens from Arc200 to Algos
	 * @param arc200_amount amount of arc200 approved
	 * @param min_amount min algo for this swap to be successful
	 * @returns amount of algos returned
	 */
	swap_from_arc200(arc200_amount: uint64, min_amount: uint64): uint64 {
		assert(this.swap_enabled.value);

		this.arc200_tranfer_from(this.txn.sender, this.app.address, arc200_amount);

		const arc200_balance = this.get_arc200_balance();
		const balance = this.get_balance();

		assert(balance > 0);
		assert(arc200_balance > 0);

		const to_swap = this.compute_out_tokens(
			arc200_amount,
			arc200_balance - arc200_amount,
			balance,
			this.swap_fee.value
		);

		const admin_fee_in_algos = this.compute_out_tokens_admin_fee(
			arc200_amount,
			arc200_balance - arc200_amount,
			balance
		);

		assert(to_swap > 0);
		assert(to_swap >= min_amount);

		this.transfer_to(this.txn.sender, to_swap);
		this.transfer_to(this.admin.value, admin_fee_in_algos);

		this.set_ratio();

		this.Swap.log({
			sender: this.txn.sender,
			from_amount: arc200_amount,
			to_amount: to_swap,
			is_direction_from_arc200_to_algo: 1,
		});

		return to_swap;
	}
}
