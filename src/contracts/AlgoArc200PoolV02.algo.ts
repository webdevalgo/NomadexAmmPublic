import { Arc200Token } from './Arc200Token.algo';

const SCALE = 100_000_000_000_000;
const INITIAL_FEE = 1_000_000_000_000;
const INITIAL_MANAGER_FEE = 50_000_000_000_000;
const DECIMALS = 6;

export class AlgoArc200PoolV02 extends Arc200Token {
	feeController = GlobalStateKey<Address>({ key: 'fee_controller' });
	ratio = GlobalStateKey<uint256>({ key: 'ratio' });

	fee = BoxKey<{
		swapFee: uint256;
		platformFee: uint256;
	}>({ key: 'fee' });

	tokenYAppId = BoxKey<Application>({ key: 'token_y_app_id' });

	/**
	 * Swap event logged on swap
	 * @param sender address of txn sender
	 * @param inAmts [x,y] amounts incoming to the pool
	 * @param outAmts [x,y] amounts outgoing from the pool
	 * @param poolBals [x,y] balances of the pool
	 */
	Swap = new EventLogger<{
		sender: Address;
		inAmts: [uint256, uint256];
		outAmts: [uint256, uint256];
		poolBals: [uint256, uint256];
	}>();

	/**
	 * Deposit event logged when user adds liquidity
	 * @param sender address of txn sender
	 * @param inAmts [x,y] amounts incoming to the pool
	 * @param outLpt lpt amount outgoing from the pool
	 * @param poolBals [x,y] balances of the pool
	 */
	Deposit = new EventLogger<{
		sender: Address;
		inAmts: [uint256, uint256];
		outLpt: uint256;
		poolBals: [uint256, uint256];
	}>();

	/**
	 * Withdraw event logged when user removes liquidity
	 * @param sender address of txn sender
	 * @param inLpt lpt amount incoming to the pool
	 * @param outAmts [x,y] amounts outgoing from the pool
	 * @param poolBals [x,y] balances of the pool
	 */
	Withdraw = new EventLogger<{
		sender: Address;
		inLpt: uint256;
		outAmts: [uint256, uint256];
		poolBals: [uint256, uint256];
	}>();

	/**
	 * Initialize the pool
	 * @param name name of the lp token
	 * @param symbol symbol of the lp token
	 * @param tokenYAppId appid (or id) of the y-token
	 */
	poolInitialize(name: StaticArray<byte, 32>, symbol: StaticArray<byte, 8>, tokenYAppId: Application): void {
		assert(this.app.creator === this.txn.sender || this.manager.value === this.txn.sender);
		assert(!this.totalSupply.exists);

		this.arc200Initialize(name, symbol, <uint8>DECIMALS, <uint256>SCALE * <uint256>(10 ** DECIMALS), this.app.address);

		this.feeController.value = this.txn.sender;
		this.ratio.value = <uint256>SCALE;
		this.fee.value = {
			swapFee: <uint256>INITIAL_FEE,
			platformFee: <uint256>INITIAL_MANAGER_FEE,
		};
		this.tokenYAppId.value = tokenYAppId;
	}

	/**
	 * Update fee-controller address
	 * @param feeController new fee-controller address
	 * @returns `true` if success
	 */
	setFeeController(feeController: Address): boolean {
		assert(this.manager.value === this.txn.sender || this.feeController.value === this.txn.sender);
		this.feeController.value = feeController;
		return true;
	}

	/**
	 * Update the swap-fee of the pool
	 * @param fee updated swap-fee
	 * @returns `true` if success
	 */
	setFees(fee: uint256): boolean {
		assert(this.feeController.value === this.txn.sender);
		this.fee.value = {
			swapFee: fee,
			platformFee: this.fee.value.platformFee,
		};
		return true;
	}

	/**
	 * Update the platform-fee of the pool
	 * @param fee updated platform-fee
	 * @returns `true` if success
	 */
	setPlatformFees(fee: uint256): boolean {
		assert(this.manager.value === this.txn.sender);
		this.fee.value = {
			swapFee: this.fee.value.swapFee,
			platformFee: fee,
		};
		return true;
	}

	/**
	 * Bring the pool account online for consensus participation
	 */
	registerOnline(
		selectionPk: bytes,
		stateProofPk: bytes,
		votePk: bytes,
		voteFirst: uint64,
		voteLast: uint64,
		voteKeyDilution: uint64
	): void {
		assert(this.txn.sender === this.feeController.value || this.txn.sender === this.manager.value);

		sendOnlineKeyRegistration({
			sender: this.app.address,
			selectionPK: selectionPk,
			stateProofPK: stateProofPk,
			votePK: votePk,
			voteFirst: voteFirst,
			voteLast: voteLast,
			voteKeyDilution: voteKeyDilution,
			fee: globals.minTxnFee,
		});
	}

	/**
	 * Bring the pool account offline i.e. stop consensus participation
	 */
	registerOffline(): void {
		assert(this.txn.sender === this.feeController.value || this.txn.sender === this.manager.value);

		sendOfflineKeyRegistration({
			sender: this.app.address,
			fee: globals.minTxnFee,
		});
	}

	private getTokenXBalance(): uint256 {
		return <uint256>(this.app.address.balance - this.app.address.minBalance);
	}

	private getTokenYBalance(): uint256 {
		return sendMethodCall<[Address], uint256>({
			sender: this.app.address,
			name: 'arc200_balanceOf',
			applicationID: this.tokenYAppId.value,
			methodArgs: [this.app.address],
			fee: globals.minTxnFee,
		});
	}

	private getTokenXDecimals(): uint8 {
		return <uint8>6;
	}

	private getTokenYDecimals(): uint8 {
		return sendMethodCall<[], uint8>({
			sender: this.app.address,
			name: 'arc200_decimals',
			applicationID: this.tokenYAppId.value,
			methodArgs: [],
			fee: globals.minTxnFee,
		});
	}

	private transferXTo(to: Address, amount: uint256): boolean {
		sendPayment({
			sender: this.app.address,
			receiver: to,
			amount: <uint64>amount,
			fee: globals.minTxnFee,
		});
		return true;
	}

	private transferYTo(to: Address, amount: uint256): boolean {
		return sendMethodCall<[Address, uint256], boolean>({
			sender: this.app.address,
			name: 'arc200_transfer',
			applicationID: this.tokenYAppId.value,
			methodArgs: [to, amount],
			fee: globals.minTxnFee,
		});
	}

	private transferYFrom(from: Address, to: Address, amount: uint256): boolean {
		return sendMethodCall<[Address, Address, uint256], boolean>({
			sender: this.app.address,
			name: 'arc200_transferFrom',
			applicationID: this.tokenYAppId.value,
			methodArgs: [from, to, amount],
			fee: globals.minTxnFee,
		});
	}

	@abi.readonly
	getRatio(): uint256 {
		const yBalance = this.getTokenYBalance();
		const xBalance = this.getTokenXBalance();
		if (yBalance > <uint256>0) {
			return (xBalance * <uint256>SCALE * <uint256>SCALE) / yBalance;
		} else {
			return <uint256>SCALE * <uint256>SCALE;
		}
	}

	private updateRatio(): void {
		this.ratio.value = this.getRatio();
	}

	/**
	 * Example: `powOfTen(6)` returns `1,000,000`
	 * @param pow number of decimal places
	 * @returns
	 */
	private powOfTen(decimals: uint64): uint256 {
		let result: uint256 = 1;

		for (let i: uint64 = 0; i < decimals; i = i + 1) {
			result = result * <uint256>10;
		}

		return result;
	}

	/**
	 * Add liquidity to the pool
	 * @param payTxnX x-token txn
	 * @param amountY amount of y-token approved to the pool
	 * @returns `true` if success
	 */
	addLiquidity(payTxnX: PayTxn, amountY: uint256): boolean {
		verifyPayTxn(payTxnX, {
			sender: this.txn.sender,
			receiver: this.app.address,
			amount: { greaterThan: 0 },
			rekeyTo: globals.zeroAddress,
			closeRemainderTo: globals.zeroAddress,
		});

		const amountX = <uint256>payTxnX.amount;

		assert(amountY > <uint256>0);

		const balanceY = this.getTokenYBalance();
		const balanceX = this.getTokenXBalance();
		const issuedLptBefore = this.totalSupply.value - this.arc200_balanceOf(this.app.address);

		assert(this.transferYFrom(this.txn.sender, this.app.address, amountY));

		let lptToMint = <uint256>0;

		if (issuedLptBefore === <uint256>0) {
			const decimalsOfX = this.getTokenXDecimals();
			const decimalsOfY = this.getTokenYDecimals();

			const amountXNormalized = (amountX * this.powOfTen(DECIMALS)) / this.powOfTen(<uint64>decimalsOfX);
			const amountYNormalized = (amountY * this.powOfTen(DECIMALS)) / this.powOfTen(<uint64>decimalsOfY);

			lptToMint = sqrt(amountXNormalized * amountYNormalized);
		} else {
			const ratioX = (amountX * <uint256>SCALE) / (balanceX - amountX);
			const ratioY = (amountY * <uint256>SCALE) / balanceY;
			const ratio = ratioX < ratioY ? ratioX : ratioY;

			lptToMint = (issuedLptBefore * ratio) / <uint256>SCALE;
		}

		assert(lptToMint > <uint256>0);
		assert(this.transfer(this.app.address, this.txn.sender, lptToMint));

		const innerTxnsCount = 2;
		const innerTxnsFee = innerTxnsCount * globals.minTxnFee;
		const finalBalanceX = balanceX + amountX - <uint256>innerTxnsFee;
		const finalBalanceY = balanceY + amountY;

		this.Deposit.log({
			sender: this.txn.sender,
			inAmts: [amountX, amountY],
			outLpt: <uint256>0 + lptToMint,
			poolBals: [finalBalanceX, finalBalanceY],
		});

		this.updateRatio();

		return true;
	}

	/**
	 * Remove liquidity from the pool
	 * @param lptAmount amount of lp-token to burn
	 * @returns `true` of success
	 */
	removeLiquidity(lptAmount: uint256): boolean {
		const balanceY = this.getTokenYBalance();
		const balanceX = this.getTokenXBalance();

		assert(balanceX > <uint256>0);
		assert(balanceY > <uint256>0);

		const issuedLptBefore = this.totalSupply.value - this.arc200_balanceOf(this.app.address);
		const withdrawAmountX = (balanceX * lptAmount) / issuedLptBefore;
		const withdrawAmountY = (balanceY * lptAmount) / issuedLptBefore;

		assert(withdrawAmountX > <uint256>0);
		assert(withdrawAmountY > <uint256>0);

		assert(this.transfer(this.txn.sender, this.app.address, lptAmount));
		assert(this.transferXTo(this.txn.sender, withdrawAmountX));
		assert(this.transferYTo(this.txn.sender, withdrawAmountY));

		const innerTxnsCount = 2;
		const innerTxnsFee = innerTxnsCount * globals.minTxnFee;
		const finalBalanceX = balanceX - withdrawAmountX - <uint256>(balanceX === withdrawAmountX ? 0 : innerTxnsFee);
		const finalBalanceY = balanceY - withdrawAmountY;

		this.Withdraw.log({
			sender: this.txn.sender,
			inLpt: lptAmount,
			outAmts: [withdrawAmountX, withdrawAmountY],
			poolBals: [finalBalanceX, finalBalanceY],
		});

		this.updateRatio();

		return true;
	}

	private computeOutTokens(amountA: uint256, supplyA: uint256, supplyB: uint256, fee: uint256): uint256 {
		const factor = <uint256>SCALE - fee;

		const numerator = <uint<512>>amountA * <uint<512>>supplyB * <uint<512>>factor;
		const denominator = (<uint<512>>amountA + <uint<512>>supplyA) * <uint<512>>SCALE;

		return <uint256>(numerator / denominator);
	}

	private computePlatformFee(amountA: uint256, supplyA: uint256, supplyB: uint256): uint256 {
		const amount_without_fee = this.computeOutTokens(amountA, supplyA, supplyB, <uint256>0);
		const amount_with_fee = this.computeOutTokens(amountA, supplyA, supplyB, this.fee.value.swapFee);

		return ((amount_without_fee - amount_with_fee) * this.fee.value.platformFee) / <uint256>SCALE;
	}

	/**
	 * Swap x-token for y-token
	 * @param payTxnX x-token pay txn
	 * @param minAmountY minimum amount of y-token required for this txn to be successful
	 * @returns amount of y-token given out in exchange for x-token
	 */
	swapXtoY(payTxnX: PayTxn, minAmountY: uint256): uint256 {
		verifyPayTxn(payTxnX, {
			sender: this.txn.sender,
			receiver: this.app.address,
			amount: { greaterThan: 0 },
			rekeyTo: globals.zeroAddress,
			closeRemainderTo: globals.zeroAddress,
		});

		const amountX = <uint256>payTxnX.amount;
		const balanceY = this.getTokenYBalance();
		const balanceX = this.getTokenXBalance();

		assert(balanceX > <uint256>0);
		assert(balanceY > <uint256>0);
		assert(balanceY > minAmountY);

		const amountOut = this.computeOutTokens(amountX, balanceX - amountX, balanceY, this.fee.value.swapFee);

		assert(amountOut > <uint256>0);
		assert(amountOut >= minAmountY);
		assert(amountOut < balanceY);

		const platformFee = this.computePlatformFee(amountX, balanceX - amountX, balanceY);

		assert(this.transferYTo(this.txn.sender, amountOut));
		assert(this.transferYTo(this.manager.value, platformFee));

		const innerTxnsCount = 2;
		const innerTxnsFee = innerTxnsCount * globals.minTxnFee;
		const finalBalanceX = balanceX - <uint256>innerTxnsFee;
		const finalBalanceY = balanceY - amountOut - platformFee;

		this.Swap.log({
			sender: this.txn.sender,
			inAmts: [amountX, 0],
			outAmts: [0, amountOut],
			poolBals: [finalBalanceX, finalBalanceY],
		});

		this.updateRatio();

		return amountOut;
	}

	/**
	 * Swap y-token for x-token
	 * @param amountY amount of y-token approved for swap
	 * @param minAmountX minimum amount of x-token required for this txn to be successful
	 * @returns amount of x-token given out in exchange for x-token
	 */
	swapYtoX(amountY: uint256, minAmountX: uint256): uint256 {
		assert(this.transferYFrom(this.txn.sender, this.app.address, amountY));

		const balanceY = this.getTokenYBalance();
		const balanceX = this.getTokenXBalance();

		assert(balanceX > <uint256>0);
		assert(balanceX > minAmountX);
		assert(balanceY > <uint256>0);

		const amountOut = this.computeOutTokens(amountY, balanceY - amountY, balanceX, this.fee.value.swapFee);

		assert(amountOut > <uint256>0);
		assert(amountOut >= minAmountX);
		assert(amountOut < balanceX);

		const platformFee = this.computePlatformFee(amountY, balanceY - amountY, balanceX);

		assert(this.transferXTo(this.txn.sender, amountOut));
		assert(this.transferXTo(this.manager.value, platformFee));

		const innerTxnsCount = 2;
		const innerTxnsFee = innerTxnsCount * globals.minTxnFee;
		const finalBalanceX = balanceX - amountOut - platformFee - <uint256>innerTxnsFee;
		const finalBalanceY = balanceY;

		this.Swap.log({
			sender: this.txn.sender,
			inAmts: [0, amountY],
			outAmts: [amountOut, 0],
			poolBals: [finalBalanceX, finalBalanceY],
		});

		this.updateRatio();

		return amountOut;
	}
}
