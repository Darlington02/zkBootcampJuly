import {
  Field,
  PublicKey,
  SmartContract,
  state,
  State,
  PrivateKey,
  method,
  UInt64,
  Poseidon,
  Signature,
} from 'snarkyjs';

export class Guess extends SmartContract {
  @state(Field) hashOfGuess = State<Field>();
  @state(PublicKey as any) ownerAddr = State<PublicKey>();
  @state(UInt64) pot = State<UInt64>();

  @method init(initialbalance: UInt64, ownerAddr: PublicKey, potValue: Field) {
    this.ownerAddr.set(ownerAddr);
    this.balance.addInPlace(initialbalance);
    this.pot.set(new UInt64(potValue));
  }

  @method startRound(numberToGuess: Field, callerPrivKey: PrivateKey) {
    let ownerAddr = this.ownerAddr.get();
    let callerAddr = callerPrivKey.toPublicKey();
    let potValue = this.pot.get();
    callerAddr.assertEquals(ownerAddr);
    this.balance.addInPlace(potValue);
    this.hashOfGuess.set(
      Poseidon.hash([numberToGuess.add(potValue.toString())])
    );
  }
  // //another way to do access control
  @method startRoundWithSig(x: Field, signature: Signature, guess: Field) {
    let ownerAddr = this.ownerAddr.get();
    signature.verify(ownerAddr, [x]).assertEquals(true);
    this.hashOfGuess.set(Poseidon.hash([guess]));
  }

  @method submitGuess(guess: Field) {
    let potValue = this.pot.get();
    let userHash = Poseidon.hash([guess.add(potValue.toString())]);
    let stateHash = this.hashOfGuess.get();
    stateHash.assertEquals(userHash);
  }

  @method guessMultiplied(guess: Field, result: Field) {
    let potValue = this.pot.get();
    const onChainHash = this.hashOfGuess.get();
    onChainHash.assertEquals(Poseidon.hash([guess.add(potValue.toString())]));
    let multiplied = Field(guess).mul(2);
    multiplied.assertEquals(result);
    this.balance.subInPlace(potValue);
  }
}
