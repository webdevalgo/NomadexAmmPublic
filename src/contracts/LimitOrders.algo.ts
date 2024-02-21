import { Contract } from '@algorandfoundation/tealscript';

const SCALE = 100_000_000_000_000;

export class LimitOrders001 extends Contract {
	owner = GlobalStateKey<Address>({ key: 'owner' });
	fee = GlobalStateKey<uint64>({ key: 'fee' });
	feeAccumulated = GlobalStateKey<uint64>({ key: 'fee_acc' });
	orderCounter = GlobalStateKey<uint64>({ key: 'order_counter' });

	orderbook = BoxMap<
		uint64,
		{
			maker: Address;
			arc200Id: Application;
			algoAmount: uint64;
			arc200Amount: uint256;
			isBuyingAlgo: uint8;
		}
	>();

	createApplication(owner: Address, fee: uint64): void {
		this.orderCounter.value = 0;
		this.owner.value = owner;
		this.fee.value = fee;
		this.feeAccumulated.value = 0;
	}

	updateApplication(): void {
		assert(this.owner.value === this.txn.sender);
	}

	setFee(ownerFee: uint64): void {
		assert(this.owner.value === this.txn.sender);
		this.fee.value = ownerFee;
	}

	setOwner(newOwner: Address): void {
		assert(this.owner.value === this.txn.sender);
		this.owner.value = newOwner;
	}

	collectFee(algoAmount: uint64): void {
		assert(this.owner.value === this.txn.sender);
		this.transferTo(this.txn.sender, algoAmount);
	}

	/*************************************************/

	private transferTo(to: Address, amount: uint64): boolean {
		sendPayment({
			sender: this.app.address,
			receiver: to,
			amount: amount,
			fee: 1000,
		});
		return true;
	}

	private arc200TransferTo(arc200Id: Application, to: Address, amount: uint256): boolean {
		return sendMethodCall<[Address, uint256], boolean>({
			sender: this.app.address,
			name: 'arc200_transfer',
			applicationID: arc200Id,
			methodArgs: [to, <uint256>amount],
			fee: 1000,
		});
	}

	private arc200TranferFrom(arc200Id: Application, from: Address, to: Address, amount: uint256): boolean {
		return sendMethodCall<[Address, Address, uint256], boolean>({
			sender: this.app.address,
			name: 'arc200_transferFrom',
			applicationID: arc200Id,
			methodArgs: [from, to, amount],
			fee: 1000,
		});
	}
	/*************************************************/

	PlaceOrder = new EventLogger<{
		orderId: uint64;
		maker: Address;
		algoAmount: uint64;
		arc200Amount: uint256;
		orderDirection: uint8;
	}>();

	FillOrder = new EventLogger<{
		orderId: uint64;
		maker: Address;
		taker: Address;
		filledAlgoAmount: uint64;
		filledArc200Amount: uint256;
		orderDirection: uint8;
		fee: uint256;
	}>();

	CancelOrder = new EventLogger<{
		orderId: uint64;
		maker: Address;
		returnedAmount: uint256;
		orderDirection: uint8;
	}>();

	createAlgoSellOrder(algoPayTxn: PayTxn, arc200Id: Application, arc200Amount: uint256): void {
		verifyPayTxn(algoPayTxn, {
			amount: { greaterThan: 0 },
			sender: this.txn.sender,
			receiver: this.app.address,
			rekeyTo: globals.zeroAddress,
			closeRemainderTo: globals.zeroAddress,
		});

		const orderId = this.orderCounter.value;
		assert(!this.orderbook(orderId).exists);

		this.orderbook(orderId).value = {
			maker: this.txn.sender,
			arc200Id: arc200Id,
			algoAmount: algoPayTxn.amount,
			arc200Amount: arc200Amount,
			isBuyingAlgo: 0,
		};

		this.PlaceOrder.log({
			orderId: orderId,
			maker: this.txn.sender,
			algoAmount: algoPayTxn.amount,
			arc200Amount: arc200Amount,
			orderDirection: 0,
		});

		this.orderCounter.value = orderId + 1;
	}

	createAlgoBuyOrder(arc200AppId: Application, arc200Amount: uint256, algoAmount: uint64): void {
		const orderId = this.orderCounter.value;
		assert(!this.orderbook(orderId).exists);

		this.arc200TranferFrom(arc200AppId, this.txn.sender, this.app.address, arc200Amount);

		this.orderbook(orderId).value = {
			maker: this.txn.sender,
			arc200Id: arc200AppId,
			algoAmount: algoAmount,
			arc200Amount: arc200Amount,
			isBuyingAlgo: 1,
		};

		this.PlaceOrder.log({
			orderId: this.orderCounter.value,
			maker: this.txn.sender,
			algoAmount: algoAmount,
			arc200Amount: arc200Amount,
			orderDirection: 1,
		});

		this.orderCounter.value = orderId + 1;
	}

	fillAlgoToArc200Order(orderId: uint64, arc200Amount: uint256): void {
		assert(arc200Amount > 0);
		assert(this.orderbook(orderId).exists);
		const boxSnap = this.orderbook(orderId).value;

		assert(boxSnap.isBuyingAlgo === 0);

		this.arc200TranferFrom(boxSnap.arc200Id, this.txn.sender, boxSnap.maker, arc200Amount);

		const _amountOfAlgos = (arc200Amount * <uint256>boxSnap.algoAmount) / boxSnap.arc200Amount;

		const amountOfAlgos = <uint<64>>_amountOfAlgos;

		/** uint64 */
		const newArc200Amount = boxSnap.arc200Amount - arc200Amount;

		/** uint64 */
		const newAlgoAmount = boxSnap.algoAmount - amountOfAlgos;

		const denominator = <uint256>amountOfAlgos * <uint256>this.fee.value;
		const feeUint256 = denominator / <uint256>SCALE;
		/** uint64 */
		const fee = <uint64>feeUint256;

		this.transferTo(this.txn.sender, amountOfAlgos - fee);
		this.feeAccumulated.value = this.feeAccumulated.value + fee;

		this.FillOrder.log({
			orderId: orderId,
			maker: this.orderbook(orderId).value.maker,
			taker: this.txn.sender,
			filledAlgoAmount: amountOfAlgos,
			filledArc200Amount: arc200Amount,
			orderDirection: 0,
			fee: <uint256>fee,
		});

		if (newAlgoAmount <= 1000) {
			this.orderbook(orderId).delete();
		} else {
			this.orderbook(orderId).value = {
				maker: boxSnap.maker,
				arc200Id: boxSnap.arc200Id,
				algoAmount: newAlgoAmount,
				arc200Amount: newArc200Amount,
				isBuyingAlgo: boxSnap.isBuyingAlgo,
			};
		}
	}

	fillArc200ToAlgoOrder(orderId: uint64, algoPayTxn: PayTxn): void {
		assert(this.orderbook(orderId).exists);
		const boxSnap = this.orderbook(orderId).value;

		assert(boxSnap.isBuyingAlgo !== 0);

		verifyPayTxn(algoPayTxn, {
			amount: { greaterThan: 0 },
			sender: this.txn.sender,
			receiver: this.app.address,
		});

		const denominator = <uint256>algoPayTxn.amount * <uint256>this.fee.value;
		const feeUint256 = denominator / <uint256>SCALE;

		/** uint64 */
		const fee = <uint64>feeUint256;

		/** uint64 */
		const algoOutAmount = algoPayTxn.amount - fee;

		this.transferTo(boxSnap.maker, algoOutAmount);
		this.feeAccumulated.value = this.feeAccumulated.value + fee;

		/** uint256 */
		const algoOutAmountUint256 = <uint256>algoOutAmount;
		const boxAlgoAmountUint256 = <uint256>boxSnap.algoAmount;
		const arc200OutAmount = (algoOutAmountUint256 * boxSnap.arc200Amount) / boxAlgoAmountUint256;

		this.arc200TransferTo(boxSnap.arc200Id, this.txn.sender, <uint256>arc200OutAmount);

		const newArc200Amount = boxSnap.arc200Amount - arc200OutAmount;
		const newAlgoAmount = boxSnap.algoAmount - algoOutAmount;

		this.FillOrder.log({
			orderId: orderId,
			maker: this.orderbook(orderId).value.maker,
			taker: this.txn.sender,
			filledAlgoAmount: algoOutAmount,
			filledArc200Amount: arc200OutAmount,
			orderDirection: 1,
			fee: <uint256>fee,
		});

		if (newAlgoAmount <= 1000) {
			this.orderbook(orderId).delete();
		} else {
			this.orderbook(orderId).value = {
				maker: boxSnap.maker,
				arc200Id: boxSnap.arc200Id,
				algoAmount: newAlgoAmount,
				arc200Amount: newArc200Amount,
				isBuyingAlgo: boxSnap.isBuyingAlgo,
			};
		}
	}

	cancelOrder(orderId: uint64): void {
		assert(this.orderbook(orderId).exists);
		const boxSnap = this.orderbook(orderId).value;
		assert(boxSnap.maker === this.txn.sender);

		if (boxSnap.isBuyingAlgo === 0) {
			this.transferTo(boxSnap.maker, boxSnap.algoAmount);
			this.CancelOrder.log({
				maker: boxSnap.maker,
				orderId: orderId,
				returnedAmount: <uint256>boxSnap.algoAmount,
				orderDirection: boxSnap.isBuyingAlgo,
			});
		} else {
			this.arc200TransferTo(boxSnap.arc200Id, boxSnap.maker, boxSnap.arc200Amount);
			this.CancelOrder.log({
				maker: boxSnap.maker,
				orderId: orderId,
				returnedAmount: boxSnap.arc200Amount,
				orderDirection: boxSnap.isBuyingAlgo,
			});
		}

		this.orderbook(orderId).delete();
	}

	registerOnline(
		selection_pk: bytes,
		state_proof_pk: bytes,
		vote_pk: bytes,
		vote_first: uint64,
		vote_last: uint64,
		vote_key_dilution: uint64
	): void {
		assert(this.txn.sender === this.owner.value);

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

	registerOffline(): void {
		assert(this.txn.sender === this.owner.value);

		sendOfflineKeyRegistration({
			sender: this.app.address,
			fee: 1000,
		});
	}
}
