import {
    Field,
    PublicKey,
    PrivateKey,
    SmartContract,
    state,
    State,
    method,
    UInt64,
    Poseidon,
} from 'snarkyjs';

export class Odds extends SmartContract {
  // on-chain state definitions
  @state(PublicKey as any) user1 = State<PublicKey>();
  @state(PublicKey as any) user2 = State<PublicKey>();
  @state(UInt64) honeypot = State<UInt64>();
  @state(Field) player1commitment = State<Field>();
  @state(Field) player2commitment = State<Field>();

  @method init(
    _user1: PublicKey,
    _user2: PublicKey,
    initialBalance: UInt64,
    _honeypot: Field,
  ) {
    // initial values on on-chain states
    this.user1.set(_user1),
    this.user2.set(_user2),
    this.balance.addInPlace(initialBalance);
    this.honeypot.set(new UInt64(_honeypot));
  }

  @method player1SelectOdd(_player1Odd: Field, signerPrivateKey: PrivateKey) {
    // assert that function is being called by player1
    const signer = signerPrivateKey.toPublicKey()
    signer.assertEquals(this.user1.get())

    // check that number falls in range
    _player1Odd.assertGte(2)
    _player1Odd.assertLte(100)

    // subtract pot value from first player
    let potValue = this.honeypot.get();
    this.balance.addInPlace(potValue);

    // hash and store his commitment
    let hash = Poseidon.hash([_player1Odd]);
    this.player1commitment.set(hash);
  }

  @method player2SelectOdd(_player2Odd: Field, signerPrivateKey: PrivateKey) {
    // assert that function is being called by player1
    const signer = signerPrivateKey.toPublicKey()
    signer.assertEquals(this.user2.get())

    // check that number falls in range
    _player2Odd.assertGte(2)
    _player2Odd.assertLte(100)

    // hash and store his commitment
    let hash = Poseidon.hash([_player2Odd]);
    this.player2commitment.set(hash);
  }

  @method winsOdd() {
    // extract the commitment for comparison
    let player1commitment = this.player1commitment.get();
    let player2commitment = this.player2commitment.get();

    // if odds are equal, player2 wins honeypot
    let reward = this.honeypot.get();
    player1commitment.assertEquals(player2commitment);
    this.balance.subInPlace(reward);
  }
}
