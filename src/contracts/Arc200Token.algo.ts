import { Contract } from '@algorandfoundation/tealscript';

export class Arc200Token extends Contract {
	manager = GlobalStateKey<Address>({ key: 'manager' });

	metadata = BoxKey<{
		name: StaticArray<byte, 32>;
		symbol: StaticArray<byte, 8>;
		decimals: uint8;
	}>({ key: 'metadata' });
	totalSupply = BoxKey<uint256>({ key: 'totalSupply' });

	balances = BoxMap<Address, uint256>({});
	allowances = BoxMap<[Address, Address], uint256>({});

	createApplication(manager: Address): void {
		this.manager.value = manager;
	}

	updateApplication(): void {
		assert(this.manager.value === this.txn.sender);
	}

	setManager(manager: Address): boolean {
		assert(this.manager.value === this.txn.sender);
		this.manager.value = manager;
		return true;
	}

	protected arc200Initialize(
		name: StaticArray<byte, 32>,
		symbol: StaticArray<byte, 8>,
		decimals: uint8,
		totalSupply: uint256,
		mintTo: Address
	): void {
		this.metadata.value = {
			name: name,
			symbol: symbol,
			decimals: decimals,
		};
		this.totalSupply.value = totalSupply;

		this.balances(mintTo).value = totalSupply;

		this.arc200_Transfer.log({
			from: globals.zeroAddress,
			to: mintTo,
			value: totalSupply,
		});
	}

	/**
	 * Initialize ARC200
	 * @param name token name
	 * @param symbol token symbol
	 * @param decimals number of decimals
	 * @param totalSupply total supply of tokens
	 * @param mintTo initial mint to
	 */
	initialize(
		name: StaticArray<byte, 32>,
		symbol: StaticArray<byte, 8>,
		decimals: uint8,
		totalSupply: uint256,
		mintTo: Address
	): void {
		assert(this.app.creator === this.txn.sender || this.manager.value === this.txn.sender);
		assert(!this.totalSupply.exists);

		this.arc200Initialize(name, symbol, decimals, totalSupply, mintTo);
	}

	/**
	 * The name of the token
	 * @returns The name of the token
	 */
	@abi.readonly
	arc200_name(): StaticArray<byte, 32> {
		return this.metadata.value.name;
	}

	/**
	 * Returns the symbol of the token
	 * @returns The symbol of the token
	 */
	@abi.readonly
	arc200_symbol(): StaticArray<byte, 8> {
		return this.metadata.value.symbol;
	}

	/**
	 * Returns the decimals of the token
	 * @returns The decimals of the token
	 */
	@abi.readonly
	arc200_decimals(): uint8 {
		return this.metadata.value.decimals;
	}

	/**
	 * Returns the total supply of the token
	 * @returns The total supply of the token
	 */
	@abi.readonly
	arc200_totalSupply(): uint256 {
		return (
			this.totalSupply.value - this.arc200_balanceOf(globals.zeroAddress) - this.arc200_balanceOf(this.app.address)
		);
	}

	/**
	 * Returns the current balance of the owner of the token
	 * @param owner The address of the owner of the token
	 * @returns The current balance of the holder of the token
	 */
	@abi.readonly
	arc200_balanceOf(owner: Address): uint256 {
		if (this.balances(owner).exists) {
			return this.balances(owner).value;
		} else {
			return <uint256>0;
		}
	}

	/**
	 * Check if balance box exists
	 * @param owner The address of the owner
	 * @returns `true` if balance box exists
	 */
	@abi.readonly
	hasBalance(owner: Address): boolean {
		if (this.balances(owner).exists) {
			return true;
		}
		return false;
	}

	/**
	 * Check if allowance box exists
	 * @param owner The address of the owner
	 * @param spender The address of the spender
	 * @returns `true` if allowance box exists
	 */
	@abi.readonly
	hasAllowance(owner: Address, spender: Address): boolean {
		if (this.allowances([owner, spender]).exists) {
			return true;
		}
		return false;
	}

	/**
	 * Returns the current allowance of the spender of the tokens of the owner
	 * @param owner
	 * @param spender
	 * @returns The remaining allowance
	 */
	@abi.readonly
	arc200_allowance(owner: Address, spender: Address): uint256 {
		if (this.allowances([owner, spender]).exists) {
			return this.allowances([owner, spender]).value;
		} else {
			return <uint256>0;
		}
	}

	/**
	 * Transfer of tokens
	 * @param from The source of transfer of tokens
	 * @param to The destination of transfer of tokens
	 * @param value The amount of tokens transferred
	 */
	arc200_Transfer = new EventLogger<{
		from: Address;
		to: Address;
		value: uint256;
	}>();

	/**
	 * Approval of tokens
	 * @param owner The owner of the tokens
	 * @param spender The approved spender of tokens
	 * @param value The amount of tokens approve
	 */
	arc200_Approval = new EventLogger<{
		owner: Address;
		spender: Address;
		value: uint256;
	}>();

	/**
	 * Transfers tokens
	 * @param to The destination of the transfer
	 * @param value Amount of tokens to transfer
	 * @returns Success
	 */
	arc200_transfer(to: Address, value: uint256): boolean {
		return this.transfer(this.txn.sender, to, value);
	}

	protected transfer(from: Address, to: Address, value: uint256): boolean {
		const senderBalance = this.arc200_balanceOf(from);
		assert(senderBalance >= value);

		const senderBalanceAfter = <uint256>(senderBalance - value);
		if (senderBalanceAfter > <uint256>0) {
			this.balances(from).value = senderBalanceAfter;
		} else if (this.balances(from).exists) {
			// delete box to reduce MBR
			this.balances(from).delete();
		}

		const receiverBalanceAfter = <uint256>(this.arc200_balanceOf(to) + value);
		if (receiverBalanceAfter > <uint256>0) {
			this.balances(to).value = receiverBalanceAfter;
		}

		this.arc200_Transfer.log({
			from: from,
			to: to,
			value: value,
		});

		return true;
	}

	/**
	 * Approve spender for a token
	 * @param spender
	 * @param value
	 * @returns Success
	 */
	arc200_approve(spender: Address, value: uint256): boolean {
		return this.approve(this.txn.sender, spender, value);
	}

	protected approve(owner: Address, spender: Address, value: uint256): boolean {
		if (value > <uint256>0) {
			this.allowances([owner, spender]).value = value;
		} else if (this.allowances([owner, spender]).exists) {
			this.allowances([owner, spender]).delete();
		}

		this.arc200_Approval.log({
			owner: owner,
			spender: spender,
			value: value,
		});

		return true;
	}

	/**
	 * Transfers tokens from source to destination as approved spender
	 * @param from The source  of the transfer
	 * @param to The destination of the transfer
	 * @param value Amount of tokens to transfer
	 * @returns Success
	 */
	arc200_transferFrom(from: Address, to: Address, value: uint256): boolean {
		const allowance = this.arc200_allowance(from, this.txn.sender);
		assert(allowance >= value);

		const ownerBalance = this.arc200_balanceOf(from);
		assert(ownerBalance >= value);

		const allowanceAfter = <uint256>(allowance - value);
		if (allowanceAfter > <uint256>0) {
			this.allowances([from, this.txn.sender]).value = allowanceAfter;
		} else if (this.allowances([from, this.txn.sender]).exists) {
			// delete box to reduce MBR
			this.allowances([from, this.txn.sender]).delete();
		}

		const ownerBalanceAfter = <uint256>(ownerBalance - value);
		if (ownerBalanceAfter > <uint256>0) {
			this.balances(from).value = ownerBalanceAfter;
		} else if (this.balances(from).exists) {
			// delete box to reduce MBR
			this.balances(from).delete();
		}

		const receiverBalanceAfter = <uint256>(this.arc200_balanceOf(to) + value);
		if (receiverBalanceAfter > <uint256>0) {
			this.balances(to).value = receiverBalanceAfter;
		}

		this.arc200_Transfer.log({
			from: from,
			to: to,
			value: value,
		});

		return true;
	}

	/**
	 * Delete the app if balance total supply has been burned
	 */
	deleteApplication(): void {
		assert(this.manager.value === this.txn.sender);
		assert(this.arc200_balanceOf(globals.zeroAddress) === this.totalSupply.value);
		this.balances(globals.zeroAddress).delete();
		this.metadata.delete();
		this.totalSupply.delete();
		this.manager.delete();
		sendPayment({
			sender: this.app.address,
			receiver: this.txn.sender,
			amount: 0,
			closeRemainderTo: this.txn.sender,
			fee: globals.minTxnFee,
		});
		assert(this.app.address.balance === 0);
	}
}
